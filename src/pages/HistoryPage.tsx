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
    toast.success('סומן כנגבה');
    if (selectedCollection) {
      const items = await db.collectionItems.where('collectionId').equals(selectedCollection.id!).toArray();
      setSelectedItems(items);
      if (items.every(it => it.status === 'collected')) {
        await db.collections.update(selectedCollection.id!, { status: 'collected' });
        loadCollections();
      }
    }
  }

  const statusLabels: Record<string, string> = { pending: 'ממתין', collected: 'נגבה', partial: 'חלקי' };

  return (
    <div>
      <PageHeader title="היסטוריית גבייה" description={`${collections.length} אצוות`} />
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <table className="w-full text-[12px]">
          <thead><tr className="bg-muted/30 border-b border-border">
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
                <td className="p-2.5 font-mono text-[10px] text-muted-foreground">{c.fileName}</td>
                <td className="p-2.5">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                    c.status === 'collected' ? 'bg-emerald-50 text-emerald-700' : 
                    c.status === 'pending' ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'
                  }`}>{statusLabels[c.status]}</span>
                </td>
                <td className="p-2.5 flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => viewDetails(c)} className="h-6 text-[10px] gap-1 px-1.5">
                    <Eye size={11} /> צפייה
                  </Button>
                  {c.status === 'pending' && (
                    <Button size="sm" variant="ghost" onClick={() => markAsCollected(c.id!)} className="h-6 text-[10px] gap-1 px-1.5 text-emerald-600 hover:text-emerald-700">
                      <CheckCircle size={11} /> סמן כנגבה
                    </Button>
                  )}
                </td>
              </tr>
            ))}
            {collections.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground text-xs">אין אצוות</td></tr>}
          </tbody>
        </table>
      </div>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[75vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-sm">אצווה - {selectedCollection?.date}</DialogTitle>
          </DialogHeader>
          {selectedCollection?.status === 'pending' && (
            <div className="bg-amber-50 border border-amber-200 rounded p-2.5 mb-2 flex items-center justify-between">
              <span className="text-xs text-amber-700">אצווה זו ממתינה לאישור גבייה</span>
              <Button size="sm" className="h-6 text-[10px] gap-1 bg-emerald-600 hover:bg-emerald-700" onClick={() => markAsCollected(selectedCollection.id!)}>
                <CheckCircle size={11} /> סמן הכל כנגבה
              </Button>
            </div>
          )}
          <table className="w-full text-[12px]">
            <thead><tr className="bg-muted/30 border-b">
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
                  <td className="p-2 text-muted-foreground font-mono text-[10px]">{item.accountNumber}</td>
                  <td className="p-2 font-semibold">₪{item.amount.toLocaleString()}</td>
                  <td className="p-2">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] ${item.status === 'collected' ? 'bg-emerald-50 text-emerald-700' : item.status === 'pending' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`}>
                      {item.status === 'collected' ? 'נגבה' : item.status === 'pending' ? 'ממתין' : 'נכשל'}
                    </span>
                  </td>
                  <td className="p-2">
                    {item.status === 'pending' && (
                      <button onClick={() => markItemCollected(item.id!)} className="text-[10px] text-emerald-600 hover:underline">סמן כנגבה</button>
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
