import { useEffect, useState } from 'react';
import { db, type Collection, type CollectionItem } from '@/db/database';
import { PageHeader } from '@/components/layout/PageHeader';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export function HistoryPage() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedItems, setSelectedItems] = useState<CollectionItem[]>([]);
  const [detailOpen, setDetailOpen] = useState(false);

  useEffect(() => { loadCollections(); }, []);

  async function loadCollections() {
    const all = await db.collections.orderBy('date').reverse().toArray();
    setCollections(all);
  }

  async function viewDetails(collectionId: number) {
    const items = await db.collectionItems.where('collectionId').equals(collectionId).toArray();
    setSelectedItems(items);
    setDetailOpen(true);
  }

  return (
    <div>
      <PageHeader title="היסטוריית גבייה" description={`${collections.length} גביות`} />
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="bg-muted/50 border-b border-border">
            <th className="text-right p-3 font-medium text-muted-foreground">תאריך</th>
            <th className="text-right p-3 font-medium text-muted-foreground">מספר חיובים</th>
            <th className="text-right p-3 font-medium text-muted-foreground">סכום כולל</th>
            <th className="text-right p-3 font-medium text-muted-foreground">שם קובץ</th>
            <th className="text-right p-3 font-medium text-muted-foreground">פעולות</th>
          </tr></thead>
          <tbody>
            {collections.map(c => (
              <tr key={c.id} className="border-b border-border table-row-hover">
                <td className="p-3">{c.date}</td>
                <td className="p-3">{c.totalRecords}</td>
                <td className="p-3">₪{c.totalAmount.toLocaleString()}</td>
                <td className="p-3 text-xs font-mono">{c.fileName}</td>
                <td className="p-3">
                  <button onClick={() => viewDetails(c.id!)} className="text-primary hover:underline text-sm">צפייה</button>
                </td>
              </tr>
            ))}
            {collections.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">אין היסטוריית גביות</td></tr>}
          </tbody>
        </table>
      </div>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto" dir="rtl">
          <DialogHeader><DialogTitle>פרטי גבייה</DialogTitle></DialogHeader>
          <table className="w-full text-sm">
            <thead><tr className="bg-muted/50 border-b border-border">
              <th className="text-right p-2 font-medium text-muted-foreground">שם</th>
              <th className="text-right p-2 font-medium text-muted-foreground">בנק</th>
              <th className="text-right p-2 font-medium text-muted-foreground">סניף</th>
              <th className="text-right p-2 font-medium text-muted-foreground">חשבון</th>
              <th className="text-right p-2 font-medium text-muted-foreground">סכום</th>
              <th className="text-right p-2 font-medium text-muted-foreground">סטטוס</th>
            </tr></thead>
            <tbody>
              {selectedItems.map(item => (
                <tr key={item.id} className="border-b border-border">
                  <td className="p-2">{item.donorName}</td>
                  <td className="p-2">{item.bankNumber}</td>
                  <td className="p-2">{item.branchNumber}</td>
                  <td className="p-2">{item.accountNumber}</td>
                  <td className="p-2">₪{item.amount.toLocaleString()}</td>
                  <td className="p-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${item.status === 'success' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
                      {item.status === 'success' ? 'הצלחה' : 'נכשל'}
                    </span>
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
