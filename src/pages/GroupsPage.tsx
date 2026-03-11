import { useEffect, useState } from 'react';
import { db, type DonorGroup, type Donor, logActivity } from '@/db/database';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Edit, Trash2, Users } from 'lucide-react';
import { toast } from 'sonner';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];

export function GroupsPage() {
  const [groups, setGroups] = useState<(DonorGroup & { donorCount: number })[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<DonorGroup>>({ name: '', description: '', color: COLORS[0] });
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    const allGroups = await db.donorGroups.toArray();
    const donors = await db.donors.toArray();
    setGroups(allGroups.map(g => ({
      ...g,
      donorCount: donors.filter(d => d.groupId === g.id).length,
    })));
  }

  function openNew() {
    setEditing({ name: '', description: '', color: COLORS[groups.length % COLORS.length] });
    setIsEditing(false);
    setDialogOpen(true);
  }

  function openEdit(group: DonorGroup) {
    setEditing({ ...group });
    setIsEditing(true);
    setDialogOpen(true);
  }

  async function save() {
    if (!editing.name?.trim()) { toast.error('שם קבוצה הוא שדה חובה'); return; }
    if (isEditing && editing.id) {
      await db.donorGroups.update(editing.id, { name: editing.name, description: editing.description, color: editing.color });
      toast.success('הקבוצה עודכנה');
    } else {
      await db.donorGroups.add({ name: editing.name!, description: editing.description || '', color: editing.color || COLORS[0], createdAt: new Date().toISOString() });
      await logActivity('הוספה', `יצירת קבוצה: ${editing.name}`, 'group', null, editing.name!);
      toast.success('הקבוצה נוצרה');
    }
    setDialogOpen(false);
    load();
  }

  async function deleteGroup(group: DonorGroup & { donorCount: number }) {
    if (group.donorCount > 0) {
      if (!confirm(`בקבוצה ${group.donorCount} תורמים. למחוק?`)) return;
      // Remove group from donors
      const donors = await db.donors.where('groupId').equals(group.id!).toArray();
      for (const d of donors) await db.donors.update(d.id!, { groupId: null });
    }
    await db.donorGroups.delete(group.id!);
    await logActivity('מחיקה', `מחיקת קבוצה: ${group.name}`, 'group', group.id!, group.name);
    toast.success('הקבוצה נמחקה');
    load();
  }

  return (
    <div>
      <PageHeader title="קבוצות תורמים" description={`${groups.length} קבוצות`} actions={
        <Button onClick={openNew} size="sm" className="gap-1.5"><Plus size={15} /> קבוצה חדשה</Button>
      } />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {groups.map(g => (
          <div key={g.id} className="bg-card rounded-xl border border-border/50 p-5 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: g.color }} />
                <h3 className="font-semibold text-sm">{g.name}</h3>
              </div>
              <div className="flex gap-1">
                <button onClick={() => openEdit(g)} className="p-1 rounded hover:bg-muted text-muted-foreground"><Edit size={13} /></button>
                <button onClick={() => deleteGroup(g)} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 size={13} /></button>
              </div>
            </div>
            {g.description && <p className="text-xs text-muted-foreground mb-3">{g.description}</p>}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Users size={13} /> {g.donorCount} תורמים
            </div>
          </div>
        ))}
        {groups.length === 0 && (
          <div className="col-span-full text-center py-12 text-muted-foreground">
            <Users size={40} className="mx-auto mb-3 opacity-30" />
            <p>אין קבוצות. צור קבוצה חדשה לארגון התורמים.</p>
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>{isEditing ? 'עריכת קבוצה' : 'קבוצה חדשה'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>שם קבוצה *</Label><Input value={editing.name} onChange={e => setEditing(p => ({ ...p, name: e.target.value }))} /></div>
            <div><Label>תיאור</Label><Input value={editing.description} onChange={e => setEditing(p => ({ ...p, description: e.target.value }))} /></div>
            <div>
              <Label>צבע</Label>
              <div className="flex gap-2 mt-1">
                {COLORS.map(c => (
                  <button key={c} onClick={() => setEditing(p => ({ ...p, color: c }))}
                    className={`w-7 h-7 rounded-full border-2 transition-all ${editing.color === c ? 'border-foreground scale-110' : 'border-transparent'}`}
                    style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>ביטול</Button><Button onClick={save}>{isEditing ? 'עדכן' : 'צור'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
