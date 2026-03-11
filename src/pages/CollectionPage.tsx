import { useEffect, useState } from 'react';
import { db, type Donor, type CollectionItem, getSettings } from '@/db/database';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { generateMasavFile } from '@/lib/masav-generator';

export function CollectionPage() {
  const [collectionDate, setCollectionDate] = useState(new Date().toISOString().split('T')[0]);
  const [donors, setDonors] = useState<(Donor & { selected: boolean })[]>([]);
  const [step, setStep] = useState<'select' | 'preview'>('select');

  useEffect(() => { loadEligibleDonors(); }, [collectionDate]);

  async function loadEligibleDonors() {
    const activeDonors = await db.donors.where('status').equals('active').toArray();
    const date = new Date(collectionDate);
    const eligible = activeDonors.filter(d => {
      if (d.endDate && new Date(d.endDate) < date) return false;
      if (new Date(d.startDate) > date) return false;
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

  async function createCollection() {
    const selected = donors.filter(d => d.selected);
    if (selected.length === 0) {
      toast.error('לא נבחרו תורמים לגבייה');
      return;
    }

    const settings = await getSettings();
    if (!settings?.masvInstitutionNumber) {
      toast.error('יש להגדיר את פרטי המוסד בהגדרות המערכת');
      return;
    }

    // Validate all records
    const errors: string[] = [];
    selected.forEach(d => {
      if (!d.bankNumber || d.bankNumber.length < 2) errors.push(`${d.fullName}: מספר בנק לא תקין`);
      if (!d.branchNumber || d.branchNumber.length < 3) errors.push(`${d.fullName}: מספר סניף לא תקין`);
      if (!d.accountNumber) errors.push(`${d.fullName}: מספר חשבון חסר`);
      if (!d.monthlyAmount || d.monthlyAmount <= 0) errors.push(`${d.fullName}: סכום לא תקין`);
    });

    if (errors.length > 0) {
      toast.error(`נמצאו ${errors.length} שגיאות:\n${errors.slice(0, 5).join('\n')}`);
      return;
    }

    const totalAmount = selected.reduce((sum, d) => sum + d.monthlyAmount, 0);
    const fileName = `masav_${collectionDate.replace(/-/g, '')}.txt`;

    // Create collection record
    const collectionId = await db.collections.add({
      date: collectionDate,
      totalAmount,
      totalRecords: selected.length,
      fileName,
      status: 'completed',
      createdAt: new Date().toISOString(),
    });

    // Create collection items
    const items: Omit<CollectionItem, 'id'>[] = selected.map(d => ({
      collectionId: collectionId as number,
      donorId: d.id!,
      donorName: d.fullName,
      bankNumber: d.bankNumber,
      branchNumber: d.branchNumber,
      accountNumber: d.accountNumber,
      authorizationNumber: d.authorizationNumber,
      amount: d.monthlyAmount,
      status: 'success' as const,
    }));

    await db.collectionItems.bulkAdd(items as CollectionItem[]);

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
      toast.success(`קובץ מס"ב נוצר בהצלחה! ${selected.length} חיובים, סה"כ ₪${totalAmount.toLocaleString()}`);
    } catch (e) {
      toast.error('שגיאה ביצירת קובץ מס"ב');
    }
  }

  const selectedCount = donors.filter(d => d.selected).length;
  const selectedTotal = donors.filter(d => d.selected).reduce((s, d) => s + d.monthlyAmount, 0);

  return (
    <div>
      <PageHeader title="יצירת גבייה" description="בחירת תורמים ויצירת קובץ מס״ב" />

      <div className="bg-card rounded-lg border border-border p-6 mb-6">
        <div className="flex items-end gap-4">
          <div>
            <Label>תאריך גבייה</Label>
            <Input type="date" value={collectionDate} onChange={e => setCollectionDate(e.target.value)} className="w-48" />
          </div>
          <div className="text-sm text-muted-foreground">
            {selectedCount} תורמים נבחרו | סה"כ ₪{selectedTotal.toLocaleString()}
          </div>
        </div>
      </div>

      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="bg-muted/50 border-b border-border">
            <th className="p-3 w-10">
              <Checkbox checked={donors.length > 0 && donors.every(d => d.selected)} onCheckedChange={(c) => toggleAll(!!c)} />
            </th>
            <th className="text-right p-3 font-medium text-muted-foreground">שם</th>
            <th className="text-right p-3 font-medium text-muted-foreground">בנק</th>
            <th className="text-right p-3 font-medium text-muted-foreground">סניף</th>
            <th className="text-right p-3 font-medium text-muted-foreground">חשבון</th>
            <th className="text-right p-3 font-medium text-muted-foreground">סכום</th>
          </tr></thead>
          <tbody>
            {donors.map(d => (
              <tr key={d.id} className={`border-b border-border table-row-hover ${!d.selected ? 'opacity-50' : ''}`}>
                <td className="p-3"><Checkbox checked={d.selected} onCheckedChange={() => toggleDonor(d.id!)} /></td>
                <td className="p-3 font-medium">{d.fullName}</td>
                <td className="p-3">{d.bankNumber}</td>
                <td className="p-3">{d.branchNumber}</td>
                <td className="p-3">{d.accountNumber}</td>
                <td className="p-3">₪{d.monthlyAmount.toLocaleString()}</td>
              </tr>
            ))}
            {donors.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">אין תורמים זכאים לגבייה בתאריך זה</td></tr>}
          </tbody>
        </table>
      </div>

      {donors.length > 0 && (
        <div className="mt-6 flex justify-end">
          <Button onClick={createCollection} size="lg">
            יצירת קובץ מס"ב ({selectedCount} חיובים)
          </Button>
        </div>
      )}
    </div>
  );
}
