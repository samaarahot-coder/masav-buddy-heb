import { useEffect, useState } from 'react';
import { db, type FailedDebit, type CollectionItem, type Donor, logActivity } from '@/db/database';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Plus, Edit, Trash2, RefreshCw } from 'lucide-react';

const failReasons = ['אין כיסוי', 'חשבון סגור', 'הרשאה בוטלה', 'שגיאה טכנית'];

export function ReturnsPage() {
  const [returns, setReturns] = useState<FailedDebit[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [donors, setDonors] = useState<Donor[]>([]);
  const [collectionItems, setCollectionItems] = useState<CollectionItem[]>([]);
  const [selectedDonorId, setSelectedDonorId] = useState('');
  const [selectedItemId, setSelectedItemId] = useState('');
  const [reason, setReason] = useState(failReasons[0]);

  useEffect(() => { loadReturns(); }, []);

  async function loadReturns() {
    setReturns(await db.failedDebits.toArray());
  }

  async function openAddDialog() {
    setDonors(await db.donors.toArray());
    setCollectionItems(await db.collectionItems.toArray());
    setSelectedDonorId('');
    setSelectedItemId('');
    setDialogOpen(true);
  }

  const donorItems = selectedDonorId
    ? collectionItems.filter(i => i.donorId.toString() === selectedDonorId && (i.status === 'collected' || i.status === 'pending'))
    : [];

  async function addReturn() {
    const item = collectionItems.find(i => i.id?.toString() === selectedItemId);
    if (!item) { toast.error('יש לבחור חיוב'); return; }

    await db.failedDebits.add({
      collectionItemId: item.id!,
      collectionId: item.collectionId,
      donorId: item.donorId,
      donorName: item.donorName,
      amount: item.amount,
      reason,
      retried: false,
      createdAt: new Date().toISOString(),
    });

    await db.collectionItems.update(item.id!, { status: 'failed', failReason: reason });
    await logActivity('החזרה', `החזרת חיוב: ${item.donorName} - ₪${item.amount}`, 'return', item.id!, item.donorName);
    toast.success('ההחזרה נרשמה');
    setDialogOpen(false);
    loadReturns();
  }

  async function retryDebit(r: FailedDebit) {
    if (!confirm(`לגבות מחדש ₪${r.amount} מ${r.donorName}?`)) return;
    await db.failedDebits.update(r.id!, { retried: true });
    // Re-enable the donor for next collection
    await db.donors.update(r.donorId, { lastCollectedDate: '', status: 'active', updatedAt: new Date().toISOString() });
    await logActivity('גבייה מחדש', `גבייה מחדש: ${r.donorName}`, 'return', r.id!, r.donorName);
    toast.success('החיוב ייכלל בגבייה הבאה');
    loadReturns();
  }

  async function deleteReturn(r: FailedDebit) {
    if (!confirm('למחוק החזרה זו?')) return;
    await db.failedDebits.delete(r.id!);
    await logActivity('מחיקה', `מחיקת החזרה: ${r.donorName}`, 'return', r.id!, r.donorName);
    toast.success('ההחזרה נמחקה');
    loadReturns();
  }

  return (
    <div>
      <PageHeader title="החזרות חיוב" description={`${returns.length} החזרות`}
        actions={<Button onClick={openAddDialog} size="sm" className="gap-1.5"><Plus size={15} /> רישום החזרה</Button>}
      />
      <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="bg-muted/30 border-b border-border">
            <th className="text-right p-3 font-medium text-muted-foreground text-xs">תורם</th>
            <th className="text-right p-3 font-medium text-muted-foreground text-xs">סכום</th>
            <th className="text-right p-3 font-medium text-muted-foreground text-xs">סיבה</th>
            <th className="text-right p-3 font-medium text-muted-foreground text-xs">תאריך</th>
            <th className="text-right p-3 font-medium text-muted-foreground text-xs">סטטוס</th>
            <th className="text-right p-3 font-medium text-muted-foreground text-xs">פעולות</th>
          </tr></thead>
          <tbody>
            {returns.map(r => (
              <tr key={r.id} className="border-b border-border/50 table-row-hover">
                <td className="p-3 font-medium">{r.donorName}</td>
                <td className="p-3 font-semibold">₪{r.amount.toLocaleString()}</td>
                <td className="p-3 text-muted-foreground">{r.reason}</td>
                <td className="p-3 text-muted-foreground">{new Date(r.createdAt).toLocaleDateString('he-IL')}</td>
                <td className="p-3">
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${r.retried ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>
                    {r.retried ? 'נגבה מחדש' : 'ממתין'}
                  </span>
                </td>
                <td className="p-3">
                  <div className="flex gap-0.5">
                    {!r.retried && (
                      <button onClick={() => retryDebit(r)} className="p-1.5 rounded-lg hover:bg-success/10 text-muted-foreground hover:text-success" title="גבייה מחדש">
                        <RefreshCw size={13} />
                      </button>
                    )}
                    <button onClick={() => deleteReturn(r)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive" title="מחיקה">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {returns.length === 0 && <tr><td colSpan={6} className="p-12 text-center text-muted-foreground">אין החזרות</td></tr>}
          </tbody>
        </table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>רישום החזרת חיוב</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>תורם</Label>
              <Select value={selectedDonorId} onValueChange={v => { setSelectedDonorId(v); setSelectedItemId(''); }}>
                <SelectTrigger><SelectValue placeholder="בחר תורם..." /></SelectTrigger>
                <SelectContent>{donors.map(d => <SelectItem key={d.id} value={d.id!.toString()}>{d.fullName}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {selectedDonorId && (
              <div>
                <Label>חיוב</Label>
                <Select value={selectedItemId} onValueChange={setSelectedItemId}>
                  <SelectTrigger><SelectValue placeholder="בחר חיוב..." /></SelectTrigger>
                  <SelectContent>
                    {donorItems.map(item => (
                      <SelectItem key={item.id} value={item.id!.toString()}>₪{item.amount.toLocaleString()} - {item.status === 'collected' ? 'נגבה' : 'ממתין'}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>סיבת החזרה</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{failReasons.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>ביטול</Button>
            <Button onClick={addReturn}>שמור</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
