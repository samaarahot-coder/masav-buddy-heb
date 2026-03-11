import { useEffect, useState } from 'react';
import { db, type Collection, type CollectionItem, logActivity } from '@/db/database';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CheckCircle, Eye } from 'lucide-react';
import { toast } from 'sonner';

export function HistoryPage() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedItems, setSelectedItems] = useState<CollectionItem[]>([]);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null);

  useEffect(() => { loadCollections(); }, []);

  async function loadCollections() {
    setCollections(await db.collections.orderBy('date').reverse().toArray());
  }

  async function viewDetails(collection: Collection) {
    const items = await db.collectionItems.where('collectionId').equals(collection.id!).toArray();
    setSelectedItems(items);
    setSelectedCollection(collection);
    setDetailOpen(true);
  }

  async function markAsCollected(collectionId: number) {
    await db.collectionItems.where('collectionId').equals(collectionId).modify({ status: 'collected' });
    await db.collections.update(collectionId, { status: 'collected' });
    await logActivity('גבייה', 'סימון גבייה כנגבתה', 'collection', collectionId, '');
    toast.success('הגבייה סומנה כנגבתה');
    loadCollections();
    if (selectedCollection?.id === collectionId) {
      const items = await db.collectionItems.where('collectionId').equals(collectionId).toArray();
      setSelectedItems(items);
    }
  }

  async function markItemCollected(itemId: number) {
    await db.collectionItems.update(itemId, { status: 'collected' });
    toast.success('החיוב סומן כנגבה');
    if (selectedCollection) {
      const items = await db.collectionItems.where('collectionId').equals(selectedCollection.id!).toArray();
      setSelectedItems(items);
      // Check if all items collected
      if (items.every(it => it.status === 'collected')) {
        await db.collections.update(selectedCollection.id!, { status: 'collected' });
        loadCollections();
      }
    }
  }

  const statusLabels: Record<string, string> = { pending: 'ממתין', collected: 'נגבה', partial: 'חלקי' };
  const statusStyles: Record<string, string> = { 
    pending: 'bg-warning/10 text-warning', 
    collected: 'bg-success/10 text-success', 
    partial: 'bg-info/10 text-info' 
  };

  return (
    <div>
      <PageHeader title="היסטוריית גבייה" description={`${collections.length} גביות`} />
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <table className="w-full text-[13px]">
          <thead><tr className="bg-muted/40 border-b border-border">
            <th className="text-right p-2.5 font-medium text-muted-foreground text-[11px]">תאריך</th>
            <th className="text-right p-2.5 font-medium text-muted-foreground text-[11px]">חיובים</th>
            <th className="text-right p-2.5 font-medium text-muted-foreground text-[11px]">סכום</th>
            <th className="text-right p-2.5 font-medium text-muted-foreground text-[11px]">קובץ</th>
            <th className="text-right p-2.5 font-medium text-muted-foreground text-[11px]">סטטוס</th>
            <th className="text-right p-2.5 font-medium text-muted-foreground text-[11px]">פעולות</th>
          </tr></thead>
          <tbody>
            {collections.map(c => (
              <tr key={c.id} className="border-b border-border/50 table-row-hover">
                <td className="p-2.5">{c.date}</td>
                <td className="p-2.5">{c.totalRecords}</td>
                <td className="p-2.5 font-semibold">₪{c.totalAmount.toLocaleString()}</td>
                <td className="p-2.5 text-[11px] font-mono text-muted-foreground">{c.fileName}</td>
                <td className="p-2.5">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${statusStyles[c.status]}`}>{statusLabels[c.status]}</span>
                </td>
                <td className="p-2.5 flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => viewDetails(c)} className="h-6 text-[11px] gap-1 px-2"><Eye size={11} /> צפייה</Button>
                  {c.status === 'pending' && (
                    <Button size="sm" variant="ghost" onClick={() => markAsCollected(c.id!)} className="h-6 text-[11px] gap-1 px-2 text-success hover:text-success"><CheckCircle size={11} /> נגבה</Button>
                  )}
                </td>
              </tr>
            ))}
            {collections.length === 0 && <tr><td colSpan={6} className="p-10 text-center text-muted-foreground text-sm">אין היסטוריית גביות</td></tr>}
          </tbody>
        </table>
      </div>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[75vh] overflow-y-auto" dir="rtl">
          <DialogHeader><DialogTitle className="text-base">פרטי גבייה - {selectedCollection?.date}</DialogTitle></DialogHeader>
          <table className="w-full text-[13px]">
            <thead><tr className="bg-muted/40 border-b">
              <th className="text-right p-2 text-[11px] text-muted-foreground">שם</th>
              <th className="text-right p-2 text-[11px] text-muted-foreground">בנק/סניף</th>
              <th className="text-right p-2 text-[11px] text-muted-foreground">חשבון</th>
              <th className="text-right p-2 text-[11px] text-muted-foreground">סכום</th>
              <th className="text-right p-2 text-[11px] text-muted-foreground">סטטוס</th>
              <th className="text-right p-2 text-[11px] text-muted-foreground">פעולה</th>
            </tr></thead>
            <tbody>
              {selectedItems.map(item => (
                <tr key={item.id} className="border-b border-border/50">
                  <td className="p-2 font-medium">{item.donorName}</td>
                  <td className="p-2 text-muted-foreground">{item.bankNumber}/{item.branchNumber}</td>
                  <td className="p-2 text-muted-foreground font-mono text-[11px]">{item.accountNumber}</td>
                  <td className="p-2 font-semibold">₪{item.amount.toLocaleString()}</td>
                  <td className="p-2">
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${item.status === 'collected' ? 'bg-success/10 text-success' : item.status === 'pending' ? 'bg-warning/10 text-warning' : 'bg-destructive/10 text-destructive'}`}>
                      {item.status === 'collected' ? 'נגבה' : item.status === 'pending' ? 'ממתין' : 'נכשל'}
                    </span>
                  </td>
                  <td className="p-2">
                    {item.status === 'pending' && (
                      <button onClick={() => markItemCollected(item.id!)} className="text-[11px] text-success hover:underline">סמן כנגבה</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DialogContent>
      </Dialog>
    </div>
  );
}
