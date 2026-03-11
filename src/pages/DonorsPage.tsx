import { useEffect, useState } from 'react';
import { db, type Donor, type Bank, type Branch, type DonorGroup, logActivity } from '@/db/database';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Plus, Search, Edit, Trash2, Eye, Ban, PlayCircle } from 'lucide-react';
import { toast } from 'sonner';

const emptyDonor: Omit<Donor, 'id'> = {
  fullName: '', phone: '', email: '', idNumber: '', address: '', notes: '',
  bankNumber: '', branchNumber: '', accountNumber: '', authorizationNumber: '',
  monthlyAmount: 0, chargeDay: 1, startDate: new Date().toISOString().split('T')[0],
  endDate: '', monthCount: 0, monthsCollected: 0, lastCollectedDate: '',
  status: 'active', groupId: null, createdAt: '', updatedAt: '',
};

export function DonorsPage() {
  const [donors, setDonors] = useState<Donor[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [groupFilter, setGroupFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewingDonor, setViewingDonor] = useState<Donor | null>(null);
  const [editingDonor, setEditingDonor] = useState<Partial<Donor> & Omit<Donor, 'id'>>(emptyDonor);
  const [isEditing, setIsEditing] = useState(false);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [groups, setGroups] = useState<DonorGroup[]>([]);
  const [bankSearch, setBankSearch] = useState('');
  const [branchSearch, setBranchSearch] = useState('');
  const [donorCollections, setDonorCollections] = useState<any[]>([]);
  const [sortField, setSortField] = useState<string>('fullName');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setDonors(await db.donors.toArray());
    setBanks(await db.banks.toArray());
    setBranches(await db.branches.toArray());
    setGroups(await db.donorGroups.toArray());
  }

  const filtered = donors
    .filter(d => {
      const matchSearch = !search || d.fullName.includes(search) || d.idNumber.includes(search) || d.phone.includes(search);
      const matchStatus = statusFilter === 'all' || d.status === statusFilter;
      const matchGroup = groupFilter === 'all' || (groupFilter === 'none' ? !d.groupId : d.groupId?.toString() === groupFilter);
      return matchSearch && matchStatus && matchGroup;
    })
    .sort((a, b) => {
      const aVal = (a as any)[sortField];
      const bVal = (b as any)[sortField];
      if (typeof aVal === 'number') return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
      return sortDir === 'asc' ? String(aVal || '').localeCompare(String(bVal || '')) : String(bVal || '').localeCompare(String(aVal || ''));
    });

  function toggleSort(field: string) {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  }

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

  async function openView(donor: Donor) {
    setViewingDonor(donor);
    const items = await db.collectionItems.where('donorId').equals(donor.id!).toArray();
    setDonorCollections(items);
    setViewDialogOpen(true);
  }

  async function saveDonor() {
    if (!editingDonor.fullName.trim()) { toast.error('שם מלא הוא שדה חובה'); return; }
    
    // Calculate endDate from monthCount
    let endDate = editingDonor.endDate;
    if (editingDonor.monthCount && editingDonor.monthCount > 0) {
      const start = new Date(editingDonor.startDate);
      start.setMonth(start.getMonth() + editingDonor.monthCount);
      endDate = start.toISOString().split('T')[0];
    }

    try {
      if (isEditing && editingDonor.id) {
        await db.donors.update(editingDonor.id, { ...editingDonor, endDate, updatedAt: new Date().toISOString() });
        await logActivity('עריכה', `עריכת תורם: ${editingDonor.fullName}`, 'donor', editingDonor.id, editingDonor.fullName, '', true, JSON.stringify(donors.find(d => d.id === editingDonor.id)));
        toast.success('התורם עודכן בהצלחה');
      } else {
        const donorData = { ...editingDonor, endDate, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        const donorId = await db.donors.add(donorData as Donor);
        if (editingDonor.monthlyAmount > 0) {
          await db.authorizations.add({
            donorId: donorId as number,
            amount: editingDonor.monthlyAmount,
            chargeDay: editingDonor.chargeDay,
            startDate: editingDonor.startDate,
            endDate: endDate || '',
            monthCount: editingDonor.monthCount,
            monthsCollected: 0,
            status: 'active',
            createdAt: new Date().toISOString(),
          });
        }
        await logActivity('הוספה', `הוספת תורם חדש: ${editingDonor.fullName}`, 'donor', donorId as number, editingDonor.fullName, '', true, JSON.stringify(donorData));
        toast.success('התורם נוסף בהצלחה');
      }
      setDialogOpen(false);
      loadAll();
    } catch {
      toast.error('שגיאה בשמירת התורם');
    }
  }

  async function deleteDonor(donor: Donor) {
    if (!confirm(`האם למחוק את ${donor.fullName}?`)) return;
    await logActivity('מחיקה', `מחיקת תורם: ${donor.fullName}`, 'donor', donor.id!, donor.fullName, '', true, JSON.stringify(donor));
    await db.donors.delete(donor.id!);
    await db.authorizations.where('donorId').equals(donor.id!).delete();
    toast.success('התורם נמחק');
    loadAll();
  }

  async function toggleDonorStatus(donor: Donor, newStatus: Donor['status']) {
    await db.donors.update(donor.id!, { status: newStatus, updatedAt: new Date().toISOString() });
    await logActivity('שינוי סטטוס', `${donor.fullName}: ${statusLabels[donor.status]} → ${statusLabels[newStatus]}`, 'donor', donor.id!, donor.fullName);
    toast.success(`הסטטוס עודכן ל${statusLabels[newStatus]}`);
    loadAll();
  }

  const statusLabels: Record<string, string> = { active: 'פעיל', frozen: 'מוקפא', cancelled: 'מבוטל', expired: 'פג תוקף', failed: 'נכשל' };
  const statusColors: Record<string, string> = {
    active: 'bg-success/10 text-success',
    frozen: 'bg-warning/10 text-warning',
    cancelled: 'bg-destructive/10 text-destructive',
    expired: 'bg-muted text-muted-foreground',
    failed: 'bg-destructive/10 text-destructive',
  };

  function updateField(field: keyof Donor, value: string | number | null) {
    setEditingDonor(prev => ({ ...prev, [field]: value }));
  }

  const selectedBankBranches = branches.filter(b => b.bankNumber === editingDonor.bankNumber);
  const filteredBanks = bankSearch ? banks.filter(b => b.bankName.includes(bankSearch) || b.bankNumber.includes(bankSearch)) : banks;
  const filteredBranches2 = branchSearch ? selectedBankBranches.filter(b => b.branchName.includes(branchSearch) || b.branchNumber.includes(branchSearch)) : selectedBankBranches;

  const groupMap = new Map(groups.map(g => [g.id, g]));

  return (
    <div>
      <PageHeader
        title="תורמים"
        description={`${donors.length} תורמים במערכת`}
        actions={<Button onClick={openNew} size="sm" className="gap-1.5"><Plus size={15} /> הוסף תורם</Button>}
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="חיפוש שם, ת.ז. או טלפון..." value={search} onChange={e => setSearch(e.target.value)} className="pr-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-32"><SelectValue placeholder="סטטוס" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">הכל</SelectItem>
            <SelectItem value="active">פעיל</SelectItem>
            <SelectItem value="frozen">מוקפא</SelectItem>
            <SelectItem value="cancelled">מבוטל</SelectItem>
            <SelectItem value="expired">פג תוקף</SelectItem>
          </SelectContent>
        </Select>
        <Select value={groupFilter} onValueChange={setGroupFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="קבוצה" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל הקבוצות</SelectItem>
            <SelectItem value="none">ללא קבוצה</SelectItem>
            {groups.map(g => <SelectItem key={g.id} value={g.id!.toString()}>{g.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {[
                  { key: 'fullName', label: 'שם' },
                  { key: 'idNumber', label: 'ת.ז.' },
                  { key: 'phone', label: 'טלפון' },
                  { key: 'bankNumber', label: 'בנק' },
                  { key: 'monthlyAmount', label: 'סכום' },
                  { key: 'status', label: 'סטטוס' },
                ].map(col => (
                  <th key={col.key} className="text-right p-3 font-medium text-muted-foreground text-xs cursor-pointer hover:text-foreground select-none" onClick={() => toggleSort(col.key)}>
                    {col.label} {sortField === col.key && (sortDir === 'asc' ? '↑' : '↓')}
                  </th>
                ))}
                <th className="text-right p-3 font-medium text-muted-foreground text-xs w-32">פעולות</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(donor => (
                <tr key={donor.id} className="border-b border-border/50 table-row-hover">
                  <td className="p-3 font-medium">
                    <div>{donor.fullName}</div>
                    {donor.groupId && groupMap.get(donor.groupId) && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">{groupMap.get(donor.groupId)!.name}</span>
                    )}
                  </td>
                  <td className="p-3 text-muted-foreground">{donor.idNumber}</td>
                  <td className="p-3 text-muted-foreground">{donor.phone}</td>
                  <td className="p-3 text-muted-foreground">{donor.bankNumber}/{donor.branchNumber}</td>
                  <td className="p-3 font-semibold">₪{donor.monthlyAmount.toLocaleString()}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${statusColors[donor.status]}`}>
                      {statusLabels[donor.status]}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="flex gap-0.5">
                      <button onClick={() => openView(donor)} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-primary" title="צפייה">
                        <Eye size={14} />
                      </button>
                      <button onClick={() => openEdit(donor)} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground" title="עריכה">
                        <Edit size={14} />
                      </button>
                      {donor.status === 'active' ? (
                        <button onClick={() => toggleDonorStatus(donor, 'frozen')} className="p-1.5 rounded-lg hover:bg-warning/10 transition-colors text-muted-foreground hover:text-warning" title="הקפאה">
                          <Ban size={14} />
                        </button>
                      ) : donor.status !== 'cancelled' ? (
                        <button onClick={() => toggleDonorStatus(donor, 'active')} className="p-1.5 rounded-lg hover:bg-success/10 transition-colors text-muted-foreground hover:text-success" title="הפעלה">
                          <PlayCircle size={14} />
                        </button>
                      ) : null}
                      <button onClick={() => deleteDonor(donor)} className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive" title="מחיקה">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="p-12 text-center text-muted-foreground">לא נמצאו תורמים</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>{isEditing ? 'עריכת תורם' : 'הוספת תורם חדש'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-5">
            {/* Personal */}
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">שם מלא *</Label><Input value={editingDonor.fullName} onChange={e => updateField('fullName', e.target.value)} /></div>
              <div><Label className="text-xs">תעודת זהות</Label><Input value={editingDonor.idNumber} onChange={e => updateField('idNumber', e.target.value)} /></div>
              <div><Label className="text-xs">טלפון</Label><Input value={editingDonor.phone} onChange={e => updateField('phone', e.target.value)} /></div>
              <div><Label className="text-xs">אימייל</Label><Input value={editingDonor.email} onChange={e => updateField('email', e.target.value)} /></div>
              <div className="col-span-2"><Label className="text-xs">כתובת</Label><Input value={editingDonor.address} onChange={e => updateField('address', e.target.value)} /></div>
            </div>

            {/* Bank - with autocomplete */}
            <div className="border-t pt-4">
              <h3 className="text-sm font-semibold mb-3">פרטי בנק</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">בנק</Label>
                  <Input placeholder="חיפוש בנק..." value={bankSearch} onChange={e => setBankSearch(e.target.value)} className="mb-1" />
                  <Select value={editingDonor.bankNumber} onValueChange={v => { updateField('bankNumber', v); updateField('branchNumber', ''); }}>
                    <SelectTrigger><SelectValue placeholder="בחר בנק" /></SelectTrigger>
                    <SelectContent className="max-h-48">
                      {filteredBanks.slice(0, 50).map(b => (
                        <SelectItem key={b.id} value={b.bankNumber}>{b.bankNumber} - {b.bankName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">סניף</Label>
                  <Input placeholder="חיפוש סניף..." value={branchSearch} onChange={e => setBranchSearch(e.target.value)} className="mb-1" />
                  <Select value={editingDonor.branchNumber} onValueChange={v => updateField('branchNumber', v)}>
                    <SelectTrigger><SelectValue placeholder="בחר סניף" /></SelectTrigger>
                    <SelectContent className="max-h-48">
                      {filteredBranches2.slice(0, 50).map(b => (
                        <SelectItem key={b.id} value={b.branchNumber}>{b.branchNumber} - {b.branchName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label className="text-xs">מספר חשבון</Label><Input value={editingDonor.accountNumber} onChange={e => updateField('accountNumber', e.target.value)} /></div>
                <div><Label className="text-xs">מספר הרשאה</Label><Input value={editingDonor.authorizationNumber} onChange={e => updateField('authorizationNumber', e.target.value)} /></div>
              </div>
            </div>

            {/* Donation details */}
            <div className="border-t pt-4">
              <h3 className="text-sm font-semibold mb-3">פרטי תרומה</h3>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">סכום חודשי (₪)</Label><Input type="number" value={editingDonor.monthlyAmount} onChange={e => updateField('monthlyAmount', Number(e.target.value))} /></div>
                <div><Label className="text-xs">יום חיוב</Label><Input type="number" min={1} max={28} value={editingDonor.chargeDay} onChange={e => updateField('chargeDay', Number(e.target.value))} /></div>
                <div><Label className="text-xs">תאריך התחלה</Label><Input type="date" value={editingDonor.startDate} onChange={e => updateField('startDate', e.target.value)} /></div>
                <div>
                  <Label className="text-xs">כמות חודשים (0 = ללא הגבלה)</Label>
                  <Input type="number" min={0} value={editingDonor.monthCount} onChange={e => updateField('monthCount', Number(e.target.value))} />
                </div>
                <div>
                  <Label className="text-xs">קבוצה</Label>
                  <Select value={editingDonor.groupId?.toString() || 'none'} onValueChange={v => updateField('groupId', v === 'none' ? null : Number(v))}>
                    <SelectTrigger><SelectValue placeholder="בחר קבוצה" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">ללא קבוצה</SelectItem>
                      {groups.map(g => <SelectItem key={g.id} value={g.id!.toString()}>{g.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">סטטוס</Label>
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

            <div><Label className="text-xs">הערות</Label><Input value={editingDonor.notes} onChange={e => updateField('notes', e.target.value)} /></div>
          </div>

          <DialogFooter className="gap-2 mt-4">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>ביטול</Button>
            <Button onClick={saveDonor}>{isEditing ? 'עדכן' : 'הוסף'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>פרטי תורם - {viewingDonor?.fullName}</DialogTitle>
          </DialogHeader>
          {viewingDonor && (
            <Tabs defaultValue="details">
              <TabsList className="mb-4">
                <TabsTrigger value="details">פרטים</TabsTrigger>
                <TabsTrigger value="collections">היסטוריית גבייה</TabsTrigger>
              </TabsList>
              <TabsContent value="details">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-muted-foreground">שם:</span> <strong>{viewingDonor.fullName}</strong></div>
                  <div><span className="text-muted-foreground">ת.ז.:</span> <strong>{viewingDonor.idNumber}</strong></div>
                  <div><span className="text-muted-foreground">טלפון:</span> <strong>{viewingDonor.phone}</strong></div>
                  <div><span className="text-muted-foreground">אימייל:</span> <strong>{viewingDonor.email}</strong></div>
                  <div><span className="text-muted-foreground">כתובת:</span> <strong>{viewingDonor.address}</strong></div>
                  <div><span className="text-muted-foreground">סטטוס:</span> <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[viewingDonor.status]}`}>{statusLabels[viewingDonor.status]}</span></div>
                  <div><span className="text-muted-foreground">בנק/סניף/חשבון:</span> <strong>{viewingDonor.bankNumber}/{viewingDonor.branchNumber}/{viewingDonor.accountNumber}</strong></div>
                  <div><span className="text-muted-foreground">סכום חודשי:</span> <strong>₪{viewingDonor.monthlyAmount.toLocaleString()}</strong></div>
                  <div><span className="text-muted-foreground">יום חיוב:</span> <strong>{viewingDonor.chargeDay}</strong></div>
                  <div><span className="text-muted-foreground">חודשים שנגבו:</span> <strong>{viewingDonor.monthsCollected}/{viewingDonor.monthCount || '∞'}</strong></div>
                  <div><span className="text-muted-foreground">סה"כ נגבה:</span> <strong>₪{(viewingDonor.monthsCollected * viewingDonor.monthlyAmount).toLocaleString()}</strong></div>
                  {viewingDonor.groupId && groupMap.get(viewingDonor.groupId) && (
                    <div><span className="text-muted-foreground">קבוצה:</span> <strong>{groupMap.get(viewingDonor.groupId)!.name}</strong></div>
                  )}
                  {viewingDonor.notes && <div className="col-span-2"><span className="text-muted-foreground">הערות:</span> {viewingDonor.notes}</div>}
                </div>
                <div className="flex gap-2 mt-4">
                  <Button size="sm" variant="outline" onClick={() => { setViewDialogOpen(false); openEdit(viewingDonor); }}>עריכה</Button>
                  {viewingDonor.status === 'active' && (
                    <Button size="sm" variant="outline" onClick={() => { toggleDonorStatus(viewingDonor, 'frozen'); setViewDialogOpen(false); }}>הקפאת חיוב</Button>
                  )}
                  {viewingDonor.status === 'frozen' && (
                    <Button size="sm" variant="outline" onClick={() => { toggleDonorStatus(viewingDonor, 'active'); setViewDialogOpen(false); }}>הפעלת חיוב</Button>
                  )}
                </div>
              </TabsContent>
              <TabsContent value="collections">
                <table className="w-full text-sm">
                  <thead><tr className="border-b"><th className="text-right p-2 text-xs text-muted-foreground">סכום</th><th className="text-right p-2 text-xs text-muted-foreground">סטטוס</th></tr></thead>
                  <tbody>
                    {donorCollections.map((item: any) => (
                      <tr key={item.id} className="border-b">
                        <td className="p-2">₪{item.amount.toLocaleString()}</td>
                        <td className="p-2">
                          <span className={`px-2 py-0.5 rounded-full text-[11px] ${item.status === 'collected' ? 'bg-success/10 text-success' : item.status === 'pending' ? 'bg-warning/10 text-warning' : 'bg-destructive/10 text-destructive'}`}>
                            {item.status === 'collected' ? 'נגבה' : item.status === 'pending' ? 'ממתין' : 'נכשל'}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {donorCollections.length === 0 && <tr><td colSpan={2} className="p-4 text-center text-muted-foreground">אין היסטוריית גבייה</td></tr>}
                  </tbody>
                </table>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
