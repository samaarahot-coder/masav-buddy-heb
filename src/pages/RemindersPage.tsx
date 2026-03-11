import { useEffect, useState } from 'react';
import { db, type Reminder, type Donor } from '@/db/database';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Bell, CheckCircle, Trash2, Calendar, Repeat, Clock } from 'lucide-react';
import { toast } from 'sonner';

export function RemindersPage() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [donors, setDonors] = useState<Donor[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filter, setFilter] = useState<'active' | 'completed'>('active');
  const [editing, setEditing] = useState<Partial<Reminder>>({
    title: '', description: '', donorId: null, donorName: '',
    type: 'once', scheduledDate: '', recurringDay: 1, completed: false,
  });

  useEffect(() => { load(); }, []);

  async function load() {
    setReminders(await db.reminders.toArray());
    setDonors(await db.donors.toArray());
  }

  function openNew() {
    setEditing({ title: '', description: '', donorId: null, donorName: '', type: 'once', scheduledDate: new Date().toISOString().split('T')[0], recurringDay: 1, completed: false });
    setDialogOpen(true);
  }

  async function save() {
    if (!editing.title?.trim()) { toast.error('כותרת היא שדה חובה'); return; }
    await db.reminders.add({
      title: editing.title!,
      description: editing.description || '',
      donorId: editing.donorId || null,
      donorName: editing.donorName || '',
      type: editing.type as Reminder['type'],
      scheduledDate: editing.scheduledDate || '',
      recurringDay: editing.recurringDay || 1,
      completed: false,
      createdAt: new Date().toISOString(),
    });
    toast.success('התזכורת נוספה');
    setDialogOpen(false);
    load();
  }

  async function toggleComplete(r: Reminder) {
    await db.reminders.update(r.id!, { completed: !r.completed });
    toast.success(r.completed ? 'התזכורת הופעלה מחדש' : 'התזכורת סומנה כבוצעה');
    load();
  }

  async function deleteReminder(id: number) {
    await db.reminders.delete(id);
    toast.success('התזכורת נמחקה');
    load();
  }

  // Check which reminders should show today
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const todayDay = today.getDate();

  const activeReminders = reminders.filter(r => {
    if (r.completed && filter === 'active') return false;
    if (!r.completed && filter === 'completed') return false;
    return true;
  });

  const urgentReminders = reminders.filter(r => {
    if (r.completed) return false;
    if (r.type === 'once' && !r.scheduledDate) return true; // permanent
    if (r.type === 'scheduled' && r.scheduledDate === todayStr) return true;
    if (r.type === 'recurring' && r.recurringDay === todayDay) return true;
    return false;
  });

  const typeIcons: Record<string, React.ReactNode> = {
    once: <Clock size={14} className="text-primary" />,
    scheduled: <Calendar size={14} className="text-warning" />,
    recurring: <Repeat size={14} className="text-info" />,
  };

  const typeLabels: Record<string, string> = { once: 'קבועה', scheduled: 'מתוזמנת', recurring: 'חודשית' };

  return (
    <div>
      <PageHeader title="תזכורות" description={`${urgentReminders.length} תזכורות פעילות היום`} actions={
        <Button onClick={openNew} size="sm" className="gap-1.5"><Plus size={15} /> תזכורת חדשה</Button>
      } />

      {/* Urgent banner */}
      {urgentReminders.length > 0 && (
        <div className="bg-warning/10 border border-warning/20 rounded-xl p-4 mb-5">
          <div className="flex items-center gap-2 mb-2">
            <Bell size={16} className="text-warning" />
            <span className="text-sm font-semibold">תזכורות להיום</span>
          </div>
          <div className="space-y-1">
            {urgentReminders.map(r => (
              <div key={r.id} className="flex items-center justify-between text-sm">
                <span>{r.title} {r.donorName && <span className="text-muted-foreground">({r.donorName})</span>}</span>
                <Button size="sm" variant="ghost" onClick={() => toggleComplete(r)} className="h-6 text-xs gap-1"><CheckCircle size={12} /> בוצע</Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-2 mb-4">
        <Button size="sm" variant={filter === 'active' ? 'default' : 'outline'} onClick={() => setFilter('active')}>פעילות</Button>
        <Button size="sm" variant={filter === 'completed' ? 'default' : 'outline'} onClick={() => setFilter('completed')}>הושלמו</Button>
      </div>

      {/* List */}
      <div className="space-y-2">
        {activeReminders.map(r => (
          <div key={r.id} className={`bg-card rounded-xl border border-border/50 p-4 flex items-center justify-between ${r.completed ? 'opacity-50' : ''}`}>
            <div className="flex items-center gap-3">
              {typeIcons[r.type]}
              <div>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-medium ${r.completed ? 'line-through' : ''}`}>{r.title}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">{typeLabels[r.type]}</span>
                </div>
                {r.description && <p className="text-xs text-muted-foreground">{r.description}</p>}
                {r.donorName && <p className="text-xs text-primary">תורם: {r.donorName}</p>}
                {r.type === 'scheduled' && <p className="text-xs text-muted-foreground">תאריך: {r.scheduledDate}</p>}
                {r.type === 'recurring' && <p className="text-xs text-muted-foreground">כל {r.recurringDay} לחודש</p>}
              </div>
            </div>
            <div className="flex gap-1">
              <button onClick={() => toggleComplete(r)} className={`p-1.5 rounded-lg hover:bg-success/10 text-muted-foreground ${r.completed ? 'hover:text-warning' : 'hover:text-success'}`}>
                <CheckCircle size={14} />
              </button>
              <button onClick={() => deleteReminder(r.id!)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
        {activeReminders.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Bell size={40} className="mx-auto mb-3 opacity-30" />
            <p>אין תזכורות {filter === 'active' ? 'פעילות' : 'שהושלמו'}</p>
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>תזכורת חדשה</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>כותרת *</Label><Input value={editing.title} onChange={e => setEditing(p => ({ ...p, title: e.target.value }))} /></div>
            <div><Label>תיאור</Label><Input value={editing.description} onChange={e => setEditing(p => ({ ...p, description: e.target.value }))} /></div>
            <div>
              <Label>שיוך לתורם (אופציונלי)</Label>
              <Select value={editing.donorId?.toString() || 'none'} onValueChange={v => {
                const donor = donors.find(d => d.id?.toString() === v);
                setEditing(p => ({ ...p, donorId: v === 'none' ? null : Number(v), donorName: donor?.fullName || '' }));
              }}>
                <SelectTrigger><SelectValue placeholder="בחר תורם..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">ללא</SelectItem>
                  {donors.map(d => <SelectItem key={d.id} value={d.id!.toString()}>{d.fullName}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>סוג תזכורת</Label>
              <Select value={editing.type} onValueChange={v => setEditing(p => ({ ...p, type: v as any }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="once">קבועה (עד סימון ביצוע)</SelectItem>
                  <SelectItem value="scheduled">מתוזמנת (תאריך ספציפי)</SelectItem>
                  <SelectItem value="recurring">חודשית (חוזרת כל חודש)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {editing.type === 'scheduled' && (
              <div><Label>תאריך</Label><Input type="date" value={editing.scheduledDate} onChange={e => setEditing(p => ({ ...p, scheduledDate: e.target.value }))} /></div>
            )}
            {editing.type === 'recurring' && (
              <div><Label>יום בחודש</Label><Input type="number" min={1} max={28} value={editing.recurringDay} onChange={e => setEditing(p => ({ ...p, recurringDay: Number(e.target.value) }))} /></div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>ביטול</Button>
            <Button onClick={save}>צור תזכורת</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
