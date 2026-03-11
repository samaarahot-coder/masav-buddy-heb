import { useEffect, useState } from 'react';
import { db, type Collection, type CollectionItem, logActivity } from '@/db/database';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CheckCircle, Clock, Eye } from 'lucide-react';
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
    // Mark all pending items as collected
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
    }
  }

  const statusLabels: Record<string, string> = { pending: 'ממתין לגבייה', collected: 'נגבה', partial: 'חלקי' };
  const statusColors: Record<string, string> = { pending: 'bg-warning/10 text-warning', collected: 'bg-success/10 text-success', partial: 'bg-info/10 text-info' };

  return (
    <div>
      <PageHeader title="היסטוריית גבייה" description={`${collections.length} גביות`} />
      <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="bg-muted/30 border-b border-border">
            <th className="text-right p-3 font-medium text-muted-foreground text-xs">תאריך</th>
            <th className="text-right p-3 font-medium text-muted-foreground text-xs">חיובים</th>
            <th className="text-right p-3 font-medium text-muted-foreground text-xs">סכום</th>
            <th className="text-right p-3 font-medium text-muted-foreground text-xs">קובץ</th>
            <th className="text-right p-3 font-medium text-muted-foreground text-xs">סטטוס</th>
            <th className="text-right p-3 font-medium text-muted-foreground text-xs">פעולות</th>
          </tr></thead>
          <tbody>
            {collections.map(c => (
              <tr key={c.id} className="border-b border-border/50 table-row-hover">
                <td className="p-3">{c.date}</td>
                <td className="p-3">{c.totalRecords}</td>
                <td className="p-3 font-semibold">₪{c.totalAmount.toLocaleString()}</td>
                <td className="p-3 text-xs font-mono text-muted-foreground">{c.fileName}</td>
                <td className="p-3">
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${statusColors[c.status]}`}>{statusLabels[c.status]}</span>
                </td>
                <td className="p-3 flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => viewDetails(c)} className="h-7 text-xs gap-1"><Eye size={12} /> צפייה</Button>
                  {c.status === 'pending' && (
                    <Button size="sm" variant="ghost" onClick={() => markAsCollected(c.id!)} className="h-7 text-xs gap-1 text-success"><CheckCircle size={12} /> נגבה</Button>
                  )}
                </td>
              </tr>
            ))}
            {collections.length === 0 && <tr><td colSpan={6} className="p-12 text-center text-muted-foreground">אין היסטוריית גביות</td></tr>}
          </tbody>
        </table>
      </div>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto" dir="rtl">
          <DialogHeader><DialogTitle>פרטי גבייה - {selectedCollection?.date}</DialogTitle></DialogHeader>
          <table className="w-full text-sm">
            <thead><tr className="bg-muted/30 border-b">
              <th className="text-right p-2 text-xs text-muted-foreground">שם</th>
              <th className="text-right p-2 text-xs text-muted-foreground">בנק</th>
              <th className="text-right p-2 text-xs text-muted-foreground">סניף</th>
              <th className="text-right p-2 text-xs text-muted-foreground">חשבון</th>
              <th className="text-right p-2 text-xs text-muted-foreground">סכום</th>
              <th className="text-right p-2 text-xs text-muted-foreground">סטטוס</th>
              <th className="text-right p-2 text-xs text-muted-foreground">פעולה</th>
            </tr></thead>
            <tbody>
              {selectedItems.map(item => (
                <tr key={item.id} className="border-b">
                  <td className="p-2 font-medium">{item.donorName}</td>
                  <td className="p-2">{item.bankNumber}</td>
                  <td className="p-2">{item.branchNumber}</td>
                  <td className="p-2">{item.accountNumber}</td>
                  <td className="p-2 font-semibold">₪{item.amount.toLocaleString()}</td>
                  <td className="p-2">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] ${item.status === 'collected' ? 'bg-success/10 text-success' : item.status === 'pending' ? 'bg-warning/10 text-warning' : 'bg-destructive/10 text-destructive'}`}>
                      {item.status === 'collected' ? 'נגבה' : item.status === 'pending' ? 'ממתין' : 'נכשל'}
                    </span>
                  </td>
                  <td className="p-2">
                    {item.status === 'pending' && (
                      <button onClick={() => markItemCollected(item.id!)} className="text-xs text-success hover:underline">סמן כנגבה</button>
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
