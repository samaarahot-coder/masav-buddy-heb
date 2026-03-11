import { useEffect, useState } from 'react';
import { db, type Donor, type CollectionItem, type DonorGroup, getSettings, logActivity } from '@/db/database';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { generateMasavBlob, generateMasavPreview, validateDonorsForMasav, type MasavPreviewRecord, type MasavValidationError } from '@/lib/masav-generator';
import { FileText, AlertTriangle, CheckCircle, Info } from 'lucide-react';

export function CollectionPage() {
  const [collectionDate, setCollectionDate] = useState(new Date().toISOString().split('T')[0]);
  const [donors, setDonors] = useState<(Donor & { selected: boolean })[]>([]);
  const [groups, setGroups] = useState<DonorGroup[]>([]);
  const [groupFilter, setGroupFilter] = useState('all');
  const [includeAlreadyCollected, setIncludeAlreadyCollected] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewRecords, setPreviewRecords] = useState<MasavPreviewRecord[]>([]);
  const [validationErrors, setValidationErrors] = useState<MasavValidationError[]>([]);
  const [errorsOpen, setErrorsOpen] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [lastFileName, setLastFileName] = useState('');
  const [lastCollectionId, setLastCollectionId] = useState<number | null>(null);

  useEffect(() => { loadEligibleDonors(); }, [collectionDate, groupFilter, includeAlreadyCollected]);
  useEffect(() => { db.donorGroups.toArray().then(setGroups); }, []);

  async function loadEligibleDonors() {
    const activeDonors = await db.donors.where('status').equals('active').toArray();
    const date = new Date(collectionDate);
    const currentMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    const eligible = activeDonors.filter(d => {
      if (groupFilter !== 'all' && d.groupId?.toString() !== groupFilter) return false;
      if (d.endDate && new Date(d.endDate) < date) return false;
      if (new Date(d.startDate) > date) return false;
      if (d.monthCount > 0 && d.monthsCollected >= d.monthCount) return false;
      if (!includeAlreadyCollected && d.lastCollectedDate === currentMonth) return false;
      return true;
    });

    setDonors(eligible.map(d => ({ ...d, selected: true })));
  }

  function toggleDonor(id: number) {
    setDonors(prev => prev.map(d => d.id === id ? { ...d, selected: !d.selected } : d));
  }

  function toggleAll(checked: boolean) {
    setDonors(prev => prev.map(d => ({ ...d, selected: checked })));
  }

  async function showPreview() {
    const selected = donors.filter(d => d.selected);
    if (selected.length === 0) { toast.error('לא נבחרו תורמים'); return; }

    const settings = await getSettings();
    if (!settings?.masvInstitutionNumber) { toast.error('יש להגדיר פרטי מוסד בהגדרות'); return; }

    const errors = validateDonorsForMasav(settings, selected);
    if (errors.length > 0) {
      setValidationErrors(errors);
      setErrorsOpen(true);
      return;
    }

    const records = generateMasavPreview(settings, selected, collectionDate);
    setPreviewRecords(records);
    setPreviewOpen(true);
  }

  async function createCollection() {
    const selected = donors.filter(d => d.selected);
    const settings = await getSettings();
    if (!settings) return;

    const totalAmount = selected.reduce((sum, d) => sum + d.monthlyAmount, 0);
    const fileName = `masav_${collectionDate.replace(/-/g, '')}.msx`;
    const date = new Date(collectionDate);
    const currentMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    const collectionId = await db.collections.add({
      date: collectionDate,
      totalAmount,
      totalRecords: selected.length,
      fileName,
      status: 'pending',
      createdAt: new Date().toISOString(),
    });

    const items: Omit<CollectionItem, 'id'>[] = selected.map(d => ({
      collectionId: collectionId as number,
      donorId: d.id!,
      donorName: d.fullName,
      bankNumber: d.bankNumber,
      branchNumber: d.branchNumber,
      accountNumber: d.accountNumber,
      authorizationNumber: d.authorizationNumber,
      amount: d.monthlyAmount,
      status: 'pending' as const,
    }));

    await db.collectionItems.bulkAdd(items as CollectionItem[]);

    // Update donors
    for (const d of selected) {
      await db.donors.update(d.id!, {
        lastCollectedDate: currentMonth,
        monthsCollected: (d.monthsCollected || 0) + 1,
        updatedAt: new Date().toISOString(),
      });

      if (d.monthCount > 0 && (d.monthsCollected || 0) + 1 >= d.monthCount) {
        await db.donors.update(d.id!, { status: 'expired' });
        await db.authorizations.where('donorId').equals(d.id!).modify({ status: 'expired' });
      }
    }

    // Generate and download MASAV file with Windows-1255 encoding
    try {
      const blob = generateMasavBlob(settings, selected, collectionDate);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);

      await logActivity('גבייה', `יצירת קובץ מס"ב: ${selected.length} חיובים, ₪${totalAmount.toLocaleString()}`, 'collection', collectionId as number, fileName, '', true, JSON.stringify({ collectionId, items: selected.map(d => d.id) }));

      setPreviewOpen(false);
      setLastFileName(fileName);
      setLastCollectionId(collectionId as number);
      setSuccessOpen(true);
      loadEligibleDonors();
    } catch {
      toast.error('שגיאה ביצירת קובץ מס"ב');
    }
  }

  async function markCollectionDone() {
    if (lastCollectionId) {
      await db.collectionItems.where('collectionId').equals(lastCollectionId).modify({ status: 'collected' });
      await db.collections.update(lastCollectionId, { status: 'collected' });
      await logActivity('גבייה', 'סימון גבייה כנגבתה', 'collection', lastCollectionId, '');
      toast.success('הגבייה סומנה כנגבתה בהצלחה');
    }
    setSuccessOpen(false);
  }

  const selectedCount = donors.filter(d => d.selected).length;
  const selectedTotal = donors.filter(d => d.selected).reduce((s, d) => s + d.monthlyAmount, 0);

  return (
    <div>
      <PageHeader title="יצירת גבייה" description="בחירת תורמים ויצירת קובץ מס״ב" />

      {/* Controls */}
      <div className="bg-card rounded-lg border border-border p-4 mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label className="text-[11px] text-muted-foreground">תאריך גבייה</Label>
            <Input type="date" value={collectionDate} onChange={e => setCollectionDate(e.target.value)} className="w-40 h-9 text-sm" />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">קבוצה</Label>
            <Select value={groupFilter} onValueChange={setGroupFilter}>
              <SelectTrigger className="w-36 h-9 text-sm"><SelectValue placeholder="כל הקבוצות" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל הקבוצות</SelectItem>
                {groups.map(g => <SelectItem key={g.id} value={g.id!.toString()}>{g.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-1.5">
            <Checkbox checked={includeAlreadyCollected} onCheckedChange={c => setIncludeAlreadyCollected(!!c)} id="include-collected" />
            <label htmlFor="include-collected" className="text-[11px] text-muted-foreground cursor-pointer">כלול תורמים שכבר נגבו</label>
          </div>
          <div className="mr-auto bg-primary/5 rounded-md px-3 py-1.5 border border-primary/10">
            <span className="text-xs font-semibold">{selectedCount} תורמים</span>
            <span className="text-xs text-muted-foreground mr-1.5">|</span>
            <span className="text-xs font-bold text-primary">₪{selectedTotal.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <table className="w-full text-[13px]">
          <thead><tr className="bg-muted/40 border-b border-border">
            <th className="p-2.5 w-8">
              <Checkbox checked={donors.length > 0 && donors.every(d => d.selected)} onCheckedChange={c => toggleAll(!!c)} />
            </th>
            <th className="text-right p-2.5 font-medium text-muted-foreground text-[11px]">שם</th>
            <th className="text-right p-2.5 font-medium text-muted-foreground text-[11px]">בנק</th>
            <th className="text-right p-2.5 font-medium text-muted-foreground text-[11px]">סניף</th>
            <th className="text-right p-2.5 font-medium text-muted-foreground text-[11px]">חשבון</th>
            <th className="text-right p-2.5 font-medium text-muted-foreground text-[11px]">סכום</th>
            <th className="text-right p-2.5 font-medium text-muted-foreground text-[11px]">יום חיוב</th>
          </tr></thead>
          <tbody>
            {donors.map(d => (
              <tr key={d.id} className={`border-b border-border/50 table-row-hover ${!d.selected ? 'opacity-35' : ''}`}>
                <td className="p-2.5"><Checkbox checked={d.selected} onCheckedChange={() => toggleDonor(d.id!)} /></td>
                <td className="p-2.5 font-medium">{d.fullName}</td>
                <td className="p-2.5 text-muted-foreground">{d.bankNumber}</td>
                <td className="p-2.5 text-muted-foreground">{d.branchNumber}</td>
                <td className="p-2.5 text-muted-foreground font-mono text-[12px]">{d.accountNumber}</td>
                <td className="p-2.5 font-semibold">₪{d.monthlyAmount.toLocaleString()}</td>
                <td className="p-2.5 text-muted-foreground">{d.chargeDay}</td>
              </tr>
            ))}
            {donors.length === 0 && <tr><td colSpan={7} className="p-10 text-center text-muted-foreground text-sm">אין תורמים זכאים לגבייה בתאריך זה</td></tr>}
          </tbody>
        </table>
      </div>

      {donors.length > 0 && (
        <div className="mt-4 flex justify-end">
          <Button onClick={showPreview} size="default" className="gap-1.5 text-sm">
            <FileText size={15} /> תצוגה מקדימה ({selectedCount})
          </Button>
        </div>
      )}

      {/* MASAV Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto" dir="rtl">
          <DialogHeader><DialogTitle className="text-base">תצוגה מקדימה - קובץ מס"ב</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {previewRecords.map((rec, i) => (
              <div key={i} className={`rounded-md border p-3 ${rec.type === 'header' ? 'bg-primary/5 border-primary/15' : rec.type === 'summary' ? 'bg-success/5 border-success/15' : 'bg-muted/30 border-border/50'}`}>
                <div className="flex items-center gap-1.5 mb-1.5">
                  {rec.type === 'header' && <FileText size={12} className="text-primary" />}
                  {rec.type === 'transaction' && <CheckCircle size={12} className="text-success" />}
                  {rec.type === 'summary' && <FileText size={12} className="text-success" />}
                  <span className="text-[11px] font-semibold">{rec.fields['סוג רשומה']}</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5 text-[11px]">
                  {Object.entries(rec.fields).filter(([k]) => k !== 'סוג רשומה').map(([key, val]) => (
                    <div key={key}><span className="text-muted-foreground">{key}:</span> <strong>{val}</strong></div>
                  ))}
                </div>
                <div className="mt-1.5 font-mono text-[9px] bg-background/60 p-1.5 rounded overflow-x-auto text-muted-foreground leading-relaxed" dir="ltr">
                  {rec.raw}
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2 mt-3">
            <Button variant="outline" size="sm" onClick={() => setPreviewOpen(false)}>סגור</Button>
            <Button size="sm" onClick={createCollection} className="gap-1">
              <FileText size={14} /> צור קובץ והורד
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Success Dialog - Post Collection */}
      <Dialog open={successOpen} onOpenChange={setSuccessOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <div className="text-center py-4">
            <div className="w-14 h-14 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-3">
              <CheckCircle size={28} className="text-success" />
            </div>
            <h2 className="text-lg font-bold mb-1">הקובץ נוצר בהצלחה!</h2>
            <p className="text-sm text-muted-foreground mb-4">הקובץ <span className="font-mono font-medium text-foreground">{lastFileName}</span> הורד למחשב שלך</p>
            
            <div className="bg-info/5 border border-info/15 rounded-md p-3 mb-4 text-right">
              <div className="flex items-start gap-2">
                <Info size={16} className="text-info mt-0.5 flex-shrink-0" />
                <div className="text-xs text-muted-foreground leading-relaxed">
                  <strong className="text-foreground">השלב הבא:</strong> יש לטעון את הקובץ שנוצר בתוכנת מס"ב ולשדר אותו לבנק. 
                  לאחר שהגבייה בוצעה בהצלחה, לחצו על "סמן כנגבה" כדי לעדכן את המערכת.
                </div>
              </div>
            </div>

            <div className="flex gap-2 justify-center">
              <Button variant="outline" size="sm" onClick={() => setSuccessOpen(false)}>סגור</Button>
              <Button size="sm" onClick={markCollectionDone} className="gap-1 bg-success hover:bg-success/90">
                <CheckCircle size={14} /> סמן כנגבה
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Validation Errors Dialog */}
      <Dialog open={errorsOpen} onOpenChange={setErrorsOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader><DialogTitle className="flex items-center gap-1.5 text-destructive text-sm"><AlertTriangle size={16} /> שגיאות אימות</DialogTitle></DialogHeader>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {validationErrors.map((err, i) => (
              <div key={i} className="bg-destructive/5 border border-destructive/15 rounded-md p-2.5">
                <p className="font-semibold text-xs mb-0.5">{err.donorName}</p>
                <ul className="text-[11px] text-destructive space-y-0.5">
                  {err.errors.map((e, j) => <li key={j}>• {e}</li>)}
                </ul>
              </div>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={() => setErrorsOpen(false)} className="mt-1">סגור</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
