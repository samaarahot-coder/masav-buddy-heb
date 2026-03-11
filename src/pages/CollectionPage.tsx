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
import { generateMasavFile, generateMasavPreview, validateDonorsForMasav, type MasavPreviewRecord, type MasavValidationError } from '@/lib/masav-generator';
import { FileText, AlertTriangle, CheckCircle } from 'lucide-react';

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

  useEffect(() => { loadEligibleDonors(); }, [collectionDate, groupFilter, includeAlreadyCollected]);

  useEffect(() => {
    db.donorGroups.toArray().then(setGroups);
  }, []);

  async function loadEligibleDonors() {
    const activeDonors = await db.donors.where('status').equals('active').toArray();
    const date = new Date(collectionDate);
    const currentMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    const eligible = activeDonors.filter(d => {
      // Filter by group
      if (groupFilter !== 'all' && d.groupId?.toString() !== groupFilter) return false;
      // Check date range
      if (d.endDate && new Date(d.endDate) < date) return false;
      if (new Date(d.startDate) > date) return false;
      // Check month count
      if (d.monthCount > 0 && d.monthsCollected >= d.monthCount) return false;
      // Check if already collected this month (unless override)
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

    // Validate
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
    const fileName = `masav_${collectionDate.replace(/-/g, '')}.txt`;
    const date = new Date(collectionDate);
    const currentMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    // Create collection record (status: pending)
    const collectionId = await db.collections.add({
      date: collectionDate,
      totalAmount,
      totalRecords: selected.length,
      fileName,
      status: 'pending',
      createdAt: new Date().toISOString(),
    });

    // Create collection items (status: pending)
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

    // Update donors - mark as collected this month
    for (const d of selected) {
      await db.donors.update(d.id!, {
        lastCollectedDate: currentMonth,
        monthsCollected: (d.monthsCollected || 0) + 1,
        updatedAt: new Date().toISOString(),
      });

      // Check if expired
      if (d.monthCount > 0 && (d.monthsCollected || 0) + 1 >= d.monthCount) {
        await db.donors.update(d.id!, { status: 'expired' });
        await db.authorizations.where('donorId').equals(d.id!).modify({ status: 'expired' });
      }
    }

    // Generate MASAV file
    try {
      const fileContent = generateMasavFile(settings, selected, collectionDate);
      const blob = new Blob([fileContent], { type: 'text/plain;charset=windows-1255' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);

      await logActivity('גבייה', `יצירת קובץ מס"ב: ${selected.length} חיובים, ₪${totalAmount.toLocaleString()}`, 'collection', collectionId as number, fileName, '', true, JSON.stringify({ collectionId, items: selected.map(d => d.id) }));

      toast.success(`קובץ מס"ב נוצר! ${selected.length} חיובים, סה"כ ₪${totalAmount.toLocaleString()}`);
      setPreviewOpen(false);
      loadEligibleDonors();
    } catch {
      toast.error('שגיאה ביצירת קובץ מס"ב');
    }
  }

  const selectedCount = donors.filter(d => d.selected).length;
  const selectedTotal = donors.filter(d => d.selected).reduce((s, d) => s + d.monthlyAmount, 0);

  return (
    <div>
      <PageHeader title="יצירת גבייה" description="בחירת תורמים ויצירת קובץ מס״ב" />

      {/* Controls */}
      <div className="bg-card rounded-xl border border-border/50 p-5 mb-5">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <Label className="text-xs">תאריך גבייה</Label>
            <Input type="date" value={collectionDate} onChange={e => setCollectionDate(e.target.value)} className="w-44" />
          </div>
          <div>
            <Label className="text-xs">קבוצה</Label>
            <Select value={groupFilter} onValueChange={setGroupFilter}>
              <SelectTrigger className="w-40"><SelectValue placeholder="כל הקבוצות" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל הקבוצות</SelectItem>
                {groups.map(g => <SelectItem key={g.id} value={g.id!.toString()}>{g.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox checked={includeAlreadyCollected} onCheckedChange={c => setIncludeAlreadyCollected(!!c)} id="include-collected" />
            <label htmlFor="include-collected" className="text-xs text-muted-foreground cursor-pointer">כלול תורמים שכבר נגבו החודש</label>
          </div>
          <div className="mr-auto bg-primary/5 rounded-lg px-4 py-2">
            <span className="text-sm font-semibold">{selectedCount} תורמים</span>
            <span className="text-sm text-muted-foreground mr-2">| סה"כ</span>
            <span className="text-sm font-bold text-primary">₪{selectedTotal.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="bg-muted/30 border-b border-border">
            <th className="p-3 w-10">
              <Checkbox checked={donors.length > 0 && donors.every(d => d.selected)} onCheckedChange={c => toggleAll(!!c)} />
            </th>
            <th className="text-right p-3 font-medium text-muted-foreground text-xs">שם</th>
            <th className="text-right p-3 font-medium text-muted-foreground text-xs">בנק</th>
            <th className="text-right p-3 font-medium text-muted-foreground text-xs">סניף</th>
            <th className="text-right p-3 font-medium text-muted-foreground text-xs">חשבון</th>
            <th className="text-right p-3 font-medium text-muted-foreground text-xs">סכום</th>
            <th className="text-right p-3 font-medium text-muted-foreground text-xs">יום חיוב</th>
          </tr></thead>
          <tbody>
            {donors.map(d => (
              <tr key={d.id} className={`border-b border-border/50 table-row-hover ${!d.selected ? 'opacity-40' : ''}`}>
                <td className="p-3"><Checkbox checked={d.selected} onCheckedChange={() => toggleDonor(d.id!)} /></td>
                <td className="p-3 font-medium">{d.fullName}</td>
                <td className="p-3 text-muted-foreground">{d.bankNumber}</td>
                <td className="p-3 text-muted-foreground">{d.branchNumber}</td>
                <td className="p-3 text-muted-foreground">{d.accountNumber}</td>
                <td className="p-3 font-semibold">₪{d.monthlyAmount.toLocaleString()}</td>
                <td className="p-3 text-muted-foreground">{d.chargeDay}</td>
              </tr>
            ))}
            {donors.length === 0 && <tr><td colSpan={7} className="p-12 text-center text-muted-foreground">אין תורמים זכאים לגבייה בתאריך זה</td></tr>}
          </tbody>
        </table>
      </div>

      {donors.length > 0 && (
        <div className="mt-5 flex justify-end">
          <Button onClick={showPreview} size="lg" className="gap-2">
            <FileText size={18} /> תצוגה מקדימה ({selectedCount} חיובים)
          </Button>
        </div>
      )}

      {/* MASAV Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto" dir="rtl">
          <DialogHeader><DialogTitle>תצוגה מקדימה - קובץ מס"ב</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {previewRecords.map((rec, i) => (
              <div key={i} className={`rounded-lg border p-4 ${rec.type === 'header' ? 'bg-primary/5 border-primary/20' : rec.type === 'summary' ? 'bg-success/5 border-success/20' : 'bg-muted/30 border-border/50'}`}>
                <div className="flex items-center gap-2 mb-2">
                  {rec.type === 'header' && <FileText size={14} className="text-primary" />}
                  {rec.type === 'transaction' && <CheckCircle size={14} className="text-success" />}
                  {rec.type === 'summary' && <FileText size={14} className="text-success" />}
                  <span className="text-xs font-semibold">{rec.fields['סוג רשומה']}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  {Object.entries(rec.fields).filter(([k]) => k !== 'סוג רשומה').map(([key, val]) => (
                    <div key={key}><span className="text-muted-foreground">{key}:</span> <strong>{val}</strong></div>
                  ))}
                </div>
                <div className="mt-2 font-mono text-[10px] bg-background/50 p-2 rounded overflow-x-auto text-muted-foreground leading-relaxed" dir="ltr">
                  {rec.raw}
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>סגור</Button>
            <Button onClick={createCollection} className="gap-1.5">
              <FileText size={16} /> צור קובץ והורד
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Validation Errors Dialog */}
      <Dialog open={errorsOpen} onOpenChange={setErrorsOpen}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader><DialogTitle className="flex items-center gap-2 text-destructive"><AlertTriangle size={18} /> שגיאות אימות</DialogTitle></DialogHeader>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {validationErrors.map((err, i) => (
              <div key={i} className="bg-destructive/5 border border-destructive/20 rounded-lg p-3">
                <p className="font-semibold text-sm mb-1">{err.donorName}</p>
                <ul className="text-xs text-destructive space-y-0.5">
                  {err.errors.map((e, j) => <li key={j}>• {e}</li>)}
                </ul>
              </div>
            ))}
          </div>
          <Button variant="outline" onClick={() => setErrorsOpen(false)} className="mt-2">סגור</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
