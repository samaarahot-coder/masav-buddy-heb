import { useEffect, useState } from 'react';
import { db, type Donor } from '@/db/database';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, Edit, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const emptyDonor: Omit<Donor, 'id'> = {
  fullName: '', phone: '', email: '', idNumber: '', address: '', notes: '',
  bankNumber: '', branchNumber: '', accountNumber: '', authorizationNumber: '',
  monthlyAmount: 0, chargeDay: 1, startDate: new Date().toISOString().split('T')[0],
  endDate: '', status: 'active', createdAt: '', updatedAt: '',
};

export function DonorsPage() {
  const [donors, setDonors] = useState<Donor[]>([]);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDonor, setEditingDonor] = useState<Partial<Donor> & Omit<Donor, 'id'>>(emptyDonor);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => { loadDonors(); }, []);

  async function loadDonors() {
    const all = await db.donors.toArray();
    setDonors(all);
  }

  const filtered = donors.filter(d =>
    d.fullName.includes(search) || d.idNumber.includes(search) || d.phone.includes(search)
  );

  function openNew() {
    setEditingDonor({ ...emptyDonor, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    setIsEditing(false);
    setDialogOpen(true);
  }

  function openEdit(donor: Donor) {
    setEditingDonor({ ...donor });
    setIsEditing(true);
    setDialogOpen(true);
  }

  async function saveDonor() {
    if (!editingDonor.fullName.trim()) {
      toast.error('שם מלא הוא שדה חובה');
      return;
    }
    try {
      if (isEditing && editingDonor.id) {
        await db.donors.update(editingDonor.id, { ...editingDonor, updatedAt: new Date().toISOString() });
        toast.success('התורם עודכן בהצלחה');
      } else {
        const donorData = { ...editingDonor, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        const donorId = await db.donors.add(donorData as Donor);
        // Create authorization
        await db.authorizations.add({
          donorId: donorId as number,
          amount: editingDonor.monthlyAmount,
          chargeDay: editingDonor.chargeDay,
          startDate: editingDonor.startDate,
          endDate: editingDonor.endDate,
          status: editingDonor.status,
          createdAt: new Date().toISOString(),
        });
        toast.success('התורם נוסף בהצלחה');
      }
      setDialogOpen(false);
      loadDonors();
    } catch (e) {
      toast.error('שגיאה בשמירת התורם');
    }
  }

  async function deleteDonor(id: number) {
    if (!confirm('האם אתה בטוח שברצונך למחוק תורם זה?')) return;
    await db.donors.delete(id);
    await db.authorizations.where('donorId').equals(id).delete();
    toast.success('התורם נמחק');
    loadDonors();
  }

  const statusLabels: Record<string, string> = { active: 'פעיל', frozen: 'מוקפא', cancelled: 'מבוטל' };
  const statusColors: Record<string, string> = { active: 'bg-success/10 text-success', frozen: 'bg-warning/10 text-warning', cancelled: 'bg-destructive/10 text-destructive' };

  function updateField(field: keyof Donor, value: string | number) {
    setEditingDonor(prev => ({ ...prev, [field]: value }));
  }

  return (
    <div>
      <PageHeader
        title="תורמים"
        description={`${donors.length} תורמים במערכת`}
        actions={
          <Button onClick={openNew} size="sm">
            <Plus size={16} className="ml-1" />
            הוסף תורם
          </Button>
        }
      />

      <div className="mb-4">
        <div className="relative max-w-sm">
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="חיפוש לפי שם, ת.ז. או טלפון..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-9"
          />
        </div>
      </div>

      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="text-right p-3 font-medium text-muted-foreground">שם מלא</th>
                <th className="text-right p-3 font-medium text-muted-foreground">ת.ז.</th>
                <th className="text-right p-3 font-medium text-muted-foreground">טלפון</th>
                <th className="text-right p-3 font-medium text-muted-foreground">בנק</th>
                <th className="text-right p-3 font-medium text-muted-foreground">סניף</th>
                <th className="text-right p-3 font-medium text-muted-foreground">חשבון</th>
                <th className="text-right p-3 font-medium text-muted-foreground">סכום</th>
                <th className="text-right p-3 font-medium text-muted-foreground">סטטוס</th>
                <th className="text-right p-3 font-medium text-muted-foreground">פעולות</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((donor) => (
                <tr key={donor.id} className="border-b border-border table-row-hover">
                  <td className="p-3 font-medium">{donor.fullName}</td>
                  <td className="p-3">{donor.idNumber}</td>
                  <td className="p-3">{donor.phone}</td>
                  <td className="p-3">{donor.bankNumber}</td>
                  <td className="p-3">{donor.branchNumber}</td>
                  <td className="p-3">{donor.accountNumber}</td>
                  <td className="p-3">₪{donor.monthlyAmount.toLocaleString()}</td>
                  <td className="p-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[donor.status]}`}>
                      {statusLabels[donor.status]}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(donor)} className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                        <Edit size={14} />
                      </button>
                      <button onClick={() => deleteDonor(donor.id!)} className="p-1.5 rounded hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">לא נמצאו תורמים</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>{isEditing ? 'עריכת תורם' : 'הוספת תורם חדש'}</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4">
            <div><Label>שם מלא *</Label><Input value={editingDonor.fullName} onChange={e => updateField('fullName', e.target.value)} /></div>
            <div><Label>תעודת זהות</Label><Input value={editingDonor.idNumber} onChange={e => updateField('idNumber', e.target.value)} /></div>
            <div><Label>טלפון</Label><Input value={editingDonor.phone} onChange={e => updateField('phone', e.target.value)} /></div>
            <div><Label>אימייל</Label><Input value={editingDonor.email} onChange={e => updateField('email', e.target.value)} /></div>
            <div className="col-span-2"><Label>כתובת</Label><Input value={editingDonor.address} onChange={e => updateField('address', e.target.value)} /></div>

            <div className="col-span-2 border-t border-border pt-4 mt-2">
              <h3 className="font-semibold text-sm mb-3">פרטי בנק</h3>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>מספר בנק</Label><Input value={editingDonor.bankNumber} onChange={e => updateField('bankNumber', e.target.value)} /></div>
                <div><Label>מספר סניף</Label><Input value={editingDonor.branchNumber} onChange={e => updateField('branchNumber', e.target.value)} /></div>
                <div><Label>מספר חשבון</Label><Input value={editingDonor.accountNumber} onChange={e => updateField('accountNumber', e.target.value)} /></div>
                <div><Label>מספר הרשאה</Label><Input value={editingDonor.authorizationNumber} onChange={e => updateField('authorizationNumber', e.target.value)} /></div>
              </div>
            </div>

            <div className="col-span-2 border-t border-border pt-4 mt-2">
              <h3 className="font-semibold text-sm mb-3">פרטי תרומה</h3>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>סכום חודשי (₪)</Label><Input type="number" value={editingDonor.monthlyAmount} onChange={e => updateField('monthlyAmount', Number(e.target.value))} /></div>
                <div><Label>יום חיוב</Label><Input type="number" min={1} max={28} value={editingDonor.chargeDay} onChange={e => updateField('chargeDay', Number(e.target.value))} /></div>
                <div><Label>תאריך התחלה</Label><Input type="date" value={editingDonor.startDate} onChange={e => updateField('startDate', e.target.value)} /></div>
                <div><Label>תאריך סיום</Label><Input type="date" value={editingDonor.endDate} onChange={e => updateField('endDate', e.target.value)} /></div>
                <div>
                  <Label>סטטוס</Label>
                  <Select value={editingDonor.status} onValueChange={v => updateField('status', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">פעיל</SelectItem>
                      <SelectItem value="frozen">מוקפא</SelectItem>
                      <SelectItem value="cancelled">מבוטל</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="col-span-2"><Label>הערות</Label><Input value={editingDonor.notes} onChange={e => updateField('notes', e.target.value)} /></div>
          </div>

          <DialogFooter className="flex gap-2 mt-4">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>ביטול</Button>
            <Button onClick={saveDonor}>{isEditing ? 'עדכן' : 'הוסף'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
