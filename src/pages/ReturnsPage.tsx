import { useEffect, useState } from 'react';
import { db, type FailedDebit, type CollectionItem } from '@/db/database';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';

const failReasons = [
  'אין כיסוי',
  'חשבון סגור',
  'הרשאה בוטלה',
  'שגיאה טכנית',
];

export function ReturnsPage() {
  const [returns, setReturns] = useState<FailedDebit[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [collectionItems, setCollectionItems] = useState<CollectionItem[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [reason, setReason] = useState(failReasons[0]);

  useEffect(() => { loadReturns(); }, []);

  async function loadReturns() {
    const all = await db.failedDebits.toArray();
    setReturns(all);
  }

  async function openAddDialog() {
    const items = await db.collectionItems.where('status').equals('success').toArray();
    setCollectionItems(items);
    setDialogOpen(true);
  }

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
    toast.success('החזרה נרשמה בהצלחה');
    setDialogOpen(false);
    loadReturns();
  }

  return (
    <div>
      <PageHeader title="החזרות חיוב" description={`${returns.length} החזרות`}
        actions={<Button onClick={openAddDialog} size="sm"><Plus size={16} className="ml-1" />רישום החזרה</Button>}
      />
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="bg-muted/50 border-b border-border">
            <th className="text-right p-3 font-medium text-muted-foreground">תורם</th>
            <th className="text-right p-3 font-medium text-muted-foreground">סכום</th>
            <th className="text-right p-3 font-medium text-muted-foreground">סיבה</th>
            <th className="text-right p-3 font-medium text-muted-foreground">תאריך</th>
            <th className="text-right p-3 font-medium text-muted-foreground">ניסיון חוזר</th>
          </tr></thead>
          <tbody>
            {returns.map(r => (
              <tr key={r.id} className="border-b border-border table-row-hover">
                <td className="p-3 font-medium">{r.donorName}</td>
                <td className="p-3">₪{r.amount.toLocaleString()}</td>
                <td className="p-3">{r.reason}</td>
                <td className="p-3">{new Date(r.createdAt).toLocaleDateString('he-IL')}</td>
                <td className="p-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs ${r.retried ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>
                    {r.retried ? 'בוצע' : 'ממתין'}
                  </span>
                </td>
              </tr>
            ))}
            {returns.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">אין החזרות</td></tr>}
          </tbody>
        </table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>רישום החזרת חיוב</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>בחר חיוב</Label>
              <Select value={selectedItemId} onValueChange={setSelectedItemId}>
                <SelectTrigger><SelectValue placeholder="בחר חיוב..." /></SelectTrigger>
                <SelectContent>
                  {collectionItems.map(item => (
                    <SelectItem key={item.id} value={item.id!.toString()}>
                      {item.donorName} - ₪{item.amount.toLocaleString()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>סיבת החזרה</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {failReasons.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
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
