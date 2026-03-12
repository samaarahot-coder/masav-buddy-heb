import { useEffect, useState } from 'react';
import { db, type ActivityLog } from '@/db/database';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Trash2, Undo2, ClipboardList } from 'lucide-react';

export function ActivityPage() {
  const [activities, setActivities] = useState<ActivityLog[]>([]);

  useEffect(() => { load(); }, []);

  async function load() {
    const all = await db.activityLog.orderBy('createdAt').reverse().toArray();
    setActivities(all);
  }

  async function reverseAction(activity: ActivityLog) {
    if (activity.reversed) { toast.error('פעולה זו כבר בוטלה'); return; }
    if (!confirm(`ביטול פעולה "${activity.description}" יבטל את הפעולה. להמשיך?`)) return;

    try {
      // Try to reverse based on entity type and action
      if (activity.reverseData) {
        const data = JSON.parse(activity.reverseData);

        if (activity.action === 'מחיקה' && activity.entityType === 'donor') {
          // Restore deleted donor
          await db.donors.add(data);
          toast.success('התורם שוחזר');
        } else if (activity.action === 'הוספה' && activity.entityType === 'donor' && activity.entityId) {
          // Delete added donor
          await db.donors.delete(activity.entityId);
          toast.success('התורם נמחק');
        } else if (activity.action === 'עריכה' && activity.entityType === 'donor' && activity.entityId) {
          // Restore previous version
          await db.donors.update(activity.entityId, data);
          toast.success('הנתונים שוחזרו');
        } else if (activity.action === 'גבייה' && activity.entityType === 'collection' && data.collectionId) {
          // Reverse collection
          await db.collectionItems.where('collectionId').equals(data.collectionId).delete();
          await db.collections.delete(data.collectionId);
          // Reset donor lastCollectedDate
          if (data.items) {
            for (const donorId of data.items) {
              const donor = await db.donors.get(donorId);
              if (donor) {
                await db.donors.update(donorId, {
                  monthsCollected: Math.max(0, (donor.monthsCollected || 1) - 1),
                  lastCollectedDate: '',
                  status: donor.status === 'expired' ? 'active' : donor.status,
                });
              }
            }
          }
          toast.success('הגבייה בוטלה');
        } else {
          toast.error('לא ניתן לבטל פעולה זו אוטומטית');
          return;
        }
      } else {
        toast.error('אין נתונים לביטול הפעולה');
        return;
      }

      await db.activityLog.update(activity.id!, { reversed: true });
      load();
    } catch {
      toast.error('שגיאה בביטול הפעולה');
    }
  }

  async function deleteActivity(id: number) {
    await db.activityLog.delete(id);
    toast.success('הרשומה נמחקה');
    load();
  }

  const actionColors: Record<string, string> = {
    'הוספה': 'bg-success/10 text-success',
    'עריכה': 'bg-info/10 text-info',
    'מחיקה': 'bg-destructive/10 text-destructive',
    'גבייה': 'bg-primary/10 text-primary',
    'החזרה': 'bg-warning/10 text-warning',
    'שינוי סטטוס': 'bg-info/10 text-info',
    'חידוש': 'bg-success/10 text-success',
    'גבייה מחדש': 'bg-primary/10 text-primary',
  };

  return (
    <div>
      <PageHeader title="יומן פעולות" description={`${activities.length} פעולות`} />

      <div className="space-y-2">
        {activities.map(a => (
          <div key={a.id} className={`glass-card p-4 flex items-center justify-between ${a.reversed ? 'opacity-40' : ''}`}>
            <div className="flex items-center gap-3">
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${actionColors[a.action] || 'bg-muted text-muted-foreground'}`}>{a.action}</span>
              <div>
                <p className="text-sm">{a.description}</p>
                <p className="text-[11px] text-muted-foreground">{new Date(a.createdAt).toLocaleString('he-IL')}</p>
                {a.reversed && <p className="text-[10px] text-destructive">בוטלה</p>}
              </div>
            </div>
            <div className="flex gap-1">
              {a.reversible && !a.reversed && (
                <button onClick={() => reverseAction(a)} className="p-1.5 rounded-lg hover:bg-warning/10 text-muted-foreground hover:text-warning" title="ביטול פעולה">
                  <Undo2 size={14} />
                </button>
              )}
              <button onClick={() => deleteActivity(a.id!)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive" title="מחק רשומה">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
        {activities.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <ClipboardList size={40} className="mx-auto mb-3 opacity-30" />
            <p>אין פעולות ביומן</p>
          </div>
        )}
      </div>
    </div>
  );
}
