import { useEffect, useState, useMemo } from 'react';
import { db, type Donor, type Bank, type Branch, type DonorGroup, logActivity } from '@/db/database';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Plus, Search, Edit, Trash2, Eye, Ban, PlayCircle, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';

const emptyDonor: Omit<Donor, 'id'> = {
  fullName: '', phone: '', email: '', idNumber: '', address: '', notes: '',
  bankNumber: '', branchNumber: '', accountNumber: '', authorizationNumber: '',
  monthlyAmount: 0, chargeDay: 1, startDate: new Date().toISOString().split('T')[0],
  endDate: '', monthCount: 0, monthsCollected: 0, lastCollectedDate: '',
  status: 'active', groupId: null, createdAt: '', updatedAt: '',
};

// Searchable bank/branch selector component
function BankSelector({ banks, value, onChange, placeholder }: { banks: Bank[]; value: string; onChange: (v: string) => void; placeholder: string }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => {
    if (!search) return banks.slice(0, 80);
    return banks.filter(b => b.bankName.includes(search) || b.bankNumber.includes(search)).slice(0, 80);
  }, [banks, search]);
  const selected = banks.find(b => b.bankNumber === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="w-full flex items-center justify-between h-9 px-3 text-sm border border-input rounded-md bg-background hover:bg-muted/30 transition-colors text-right">
          <span className={selected ? 'text-foreground' : 'text-muted-foreground'}>
            {selected ? `${selected.bankNumber} - ${selected.bankName}` : placeholder}
          </span>
          <ChevronDown size={12} className="text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="start">
        <div className="p-2 border-b border-border">
          <Input
            placeholder="חפש בנק..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-8 text-xs"
            autoFocus
          />
        </div>
        <div className="max-h-48 overflow-y-auto">
          {filtered.map(b => (
            <button
              key={b.id}
              onClick={() => { onChange(b.bankNumber); setOpen(false); setSearch(''); }}
              className={`w-full text-right px-3 py-1.5 text-xs hover:bg-muted/50 transition-colors ${value === b.bankNumber ? 'bg-primary/5 text-primary font-medium' : ''}`}
            >
              {b.bankNumber} - {b.bankName}
            </button>
          ))}
          {filtered.length === 0 && <div className="p-3 text-xs text-muted-foreground text-center">לא נמצא</div>}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function BranchSelector({ branches, bankNumber, value, onChange }: { branches: Branch[]; bankNumber: string; value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const bankBranches = useMemo(() => branches.filter(b => b.bankNumber === bankNumber), [branches, bankNumber]);
  const filtered = useMemo(() => {
    if (!search) return bankBranches.slice(0, 80);
    return bankBranches.filter(b => b.branchName.includes(search) || b.branchNumber.includes(search)).slice(0, 80);
  }, [bankBranches, search]);
  const selected = bankBranches.find(b => b.branchNumber === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="w-full flex items-center justify-between h-9 px-3 text-sm border border-input rounded-md bg-background hover:bg-muted/30 transition-colors text-right" disabled={!bankNumber}>
          <span className={selected ? 'text-foreground' : 'text-muted-foreground'}>
            {selected ? `${selected.branchNumber} - ${selected.branchName}` : 'בחר סניף'}
          </span>
          <ChevronDown size={12} className="text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="start">
        <div className="p-2 border-b border-border">
          <Input
            placeholder="חפש סניף..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-8 text-xs"
            autoFocus
          />
        </div>
        <div className="max-h-48 overflow-y-auto">
          {filtered.map(b => (
            <button
              key={b.id}
              onClick={() => { onChange(b.branchNumber); setOpen(false); setSearch(''); }}
              className={`w-full text-right px-3 py-1.5 text-xs hover:bg-muted/50 transition-colors ${value === b.branchNumber ? 'bg-primary/5 text-primary font-medium' : ''}`}
            >
              {b.branchNumber} - {b.branchName}
            </button>
          ))}
          {filtered.length === 0 && <div className="p-3 text-xs text-muted-foreground text-center">{bankNumber ? 'לא נמצא' : 'בחר בנק קודם'}</div>}
        </div>
      </PopoverContent>
    </Popover>
  );
}

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
        toast.success('התורם עודכן');
      } else {
        const donorData = { ...editingDonor, endDate, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        const donorId = await db.donors.add(donorData as Donor);
        if (editingDonor.monthlyAmount > 0) {
          await db.authorizations.add({
            donorId: donorId as number, amount: editingDonor.monthlyAmount, chargeDay: editingDonor.chargeDay,
            startDate: editingDonor.startDate, endDate: endDate || '', monthCount: editingDonor.monthCount,
            monthsCollected: 0, status: 'active', createdAt: new Date().toISOString(),
          });
        }
        await logActivity('הוספה', `הוספת תורם: ${editingDonor.fullName}`, 'donor', donorId as number, editingDonor.fullName, '', true, JSON.stringify(donorData));
        toast.success('התורם נוסף');
      }
      setDialogOpen(false);
      loadAll();
    } catch {
      toast.error('שגיאה בשמירה');
    }
  }

  async function deleteDonor(donor: Donor) {
    if (!confirm(`למחוק את ${donor.fullName}?`)) return;
    await logActivity('מחיקה', `מחיקת תורם: ${donor.fullName}`, 'donor', donor.id!, donor.fullName, '', true, JSON.stringify(donor));
    await db.donors.delete(donor.id!);
    await db.authorizations.where('donorId').equals(donor.id!).delete();
    toast.success('נמחק');
    loadAll();
  }

  async function toggleDonorStatus(donor: Donor, newStatus: Donor['status']) {
    await db.donors.update(donor.id!, { status: newStatus, updatedAt: new Date().toISOString() });
    await logActivity('שינוי סטטוס', `${donor.fullName}: ${statusLabels[donor.status]} → ${statusLabels[newStatus]}`, 'donor', donor.id!, donor.fullName);
    toast.success(`סטטוס: ${statusLabels[newStatus]}`);
    loadAll();
  }

  const statusLabels: Record<string, string> = { active: 'פעיל', frozen: 'מוקפא', cancelled: 'מבוטל', expired: 'פג תוקף', failed: 'נכשל' };
  const statusColors: Record<string, string> = {
    active: 'bg-emerald-50 text-emerald-700',
    frozen: 'bg-amber-50 text-amber-700',
    cancelled: 'bg-red-50 text-red-700',
    expired: 'bg-muted text-muted-foreground',
    failed: 'bg-red-50 text-red-700',
  };

  function updateField(field: keyof Donor, value: string | number | null) {
    setEditingDonor(prev => ({ ...prev, [field]: value }));
  }

  const groupMap = new Map(groups.map(g => [g.id, g]));
  const totalMonthly = filtered.filter(d => d.status === 'active').reduce((s, d) => s + d.monthlyAmount, 0);

  return (
    <div>
      <PageHeader
        title="תורמים"
        description={`${donors.length} תורמים | סה"כ חודשי: ₪${totalMonthly.toLocaleString()}`}
        actions={<Button onClick={openNew} size="sm" className="gap-1.5 text-xs"><Plus size={14} /> תורם חדש</Button>}
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-3">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="חיפוש..." value={search} onChange={e => setSearch(e.target.value)} className="pr-8 h-8 text-xs" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-28 h-8 text-xs"><SelectValue placeholder="סטטוס" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">הכל</SelectItem>
            <SelectItem value="active">פעיל</SelectItem>
            <SelectItem value="frozen">מוקפא</SelectItem>
            <SelectItem value="cancelled">מבוטל</SelectItem>
            <SelectItem value="expired">פג תוקף</SelectItem>
          </SelectContent>
        </Select>
        <Select value={groupFilter} onValueChange={setGroupFilter}>
          <SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="קבוצה" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל הקבוצות</SelectItem>
            <SelectItem value="none">ללא קבוצה</SelectItem>
            {groups.map(g => <SelectItem key={g.id} value={g.id!.toString()}>{g.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {[
                  { key: 'fullName', label: 'שם' },
                  { key: 'idNumber', label: 'ת.ז.' },
                  { key: 'phone', label: 'טלפון' },
                  { key: 'bankNumber', label: 'בנק/סניף' },
                  { key: 'monthlyAmount', label: 'סכום' },
                  { key: 'monthsCollected', label: 'נגבה' },
                  { key: 'status', label: 'סטטוס' },
                ].map(col => (
                  <th key={col.key} className="text-right p-2.5 font-medium text-muted-foreground text-[11px] cursor-pointer hover:text-foreground select-none" onClick={() => toggleSort(col.key)}>
                    {col.label} {sortField === col.key && (sortDir === 'asc' ? '↑' : '↓')}
                  </th>
                ))}
                <th className="text-right p-2.5 font-medium text-muted-foreground text-[11px] w-24">פעולות</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(donor => (
                <tr key={donor.id} className="border-b border-border/50 table-row-hover">
                  <td className="p-2.5">
                    <div className="font-medium text-[12px]">{donor.fullName}</div>
                    {donor.groupId && groupMap.get(donor.groupId) && (
                      <span className="text-[9px] px-1.5 py-px rounded-full bg-accent text-accent-foreground">{groupMap.get(donor.groupId)!.name}</span>
                    )}
                  </td>
                  <td className="p-2.5 text-muted-foreground">{donor.idNumber}</td>
                  <td className="p-2.5 text-muted-foreground">{donor.phone}</td>
                  <td className="p-2.5 text-muted-foreground font-mono text-[11px]">{donor.bankNumber}/{donor.branchNumber}</td>
                  <td className="p-2.5 font-semibold">₪{donor.monthlyAmount.toLocaleString()}</td>
                  <td className="p-2.5 text-muted-foreground text-[11px]">
                    {donor.monthsCollected}/{donor.monthCount || '∞'}
                    <span className="text-[10px] mr-1 text-muted-foreground/70">
                      (₪{(donor.monthsCollected * donor.monthlyAmount).toLocaleString()})
                    </span>
                  </td>
                  <td className="p-2.5">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${statusColors[donor.status]}`}>
                      {statusLabels[donor.status]}
                    </span>
                  </td>
                  <td className="p-2.5">
                    <div className="flex gap-px">
                      <button onClick={() => openView(donor)} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-primary" title="צפייה"><Eye size={13} /></button>
                      <button onClick={() => openEdit(donor)} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground" title="עריכה"><Edit size={13} /></button>
                      {donor.status === 'active' ? (
                        <button onClick={() => toggleDonorStatus(donor, 'frozen')} className="p-1 rounded hover:bg-amber-50 text-muted-foreground hover:text-amber-600" title="הקפאה"><Ban size={13} /></button>
                      ) : donor.status !== 'cancelled' ? (
                        <button onClick={() => toggleDonorStatus(donor, 'active')} className="p-1 rounded hover:bg-emerald-50 text-muted-foreground hover:text-emerald-600" title="הפעלה"><PlayCircle size={13} /></button>
                      ) : null}
                      <button onClick={() => deleteDonor(donor)} className="p-1 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600" title="מחיקה"><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="p-10 text-center text-muted-foreground text-xs">לא נמצאו תורמים</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-sm">{isEditing ? 'עריכת תורם' : 'תורם חדש'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2.5">
              <div><Label className="text-[11px]">שם מלא *</Label><Input value={editingDonor.fullName} onChange={e => updateField('fullName', e.target.value)} className="h-8 text-xs" /></div>
              <div><Label className="text-[11px]">תעודת זהות</Label><Input value={editingDonor.idNumber} onChange={e => updateField('idNumber', e.target.value)} className="h-8 text-xs" /></div>
              <div><Label className="text-[11px]">טלפון</Label><Input value={editingDonor.phone} onChange={e => updateField('phone', e.target.value)} className="h-8 text-xs" /></div>
              <div><Label className="text-[11px]">אימייל</Label><Input value={editingDonor.email} onChange={e => updateField('email', e.target.value)} className="h-8 text-xs" /></div>
              <div className="col-span-2"><Label className="text-[11px]">כתובת</Label><Input value={editingDonor.address} onChange={e => updateField('address', e.target.value)} className="h-8 text-xs" /></div>
            </div>

            <div className="border-t pt-3">
              <h3 className="text-xs font-semibold mb-2">פרטי בנק</h3>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <Label className="text-[11px]">בנק</Label>
                  <BankSelector banks={banks} value={editingDonor.bankNumber} onChange={v => { updateField('bankNumber', v); updateField('branchNumber', ''); }} placeholder="בחר בנק" />
                </div>
                <div>
                  <Label className="text-[11px]">סניף</Label>
                  <BranchSelector branches={branches} bankNumber={editingDonor.bankNumber} value={editingDonor.branchNumber} onChange={v => updateField('branchNumber', v)} />
                </div>
                <div><Label className="text-[11px]">מספר חשבון</Label><Input value={editingDonor.accountNumber} onChange={e => updateField('accountNumber', e.target.value)} className="h-8 text-xs" /></div>
                <div><Label className="text-[11px]">מספר הרשאה</Label><Input value={editingDonor.authorizationNumber} onChange={e => updateField('authorizationNumber', e.target.value)} className="h-8 text-xs" /></div>
              </div>
            </div>

            <div className="border-t pt-3">
              <h3 className="text-xs font-semibold mb-2">פרטי תרומה</h3>
              <div className="grid grid-cols-2 gap-2.5">
                <div><Label className="text-[11px]">סכום חודשי (₪)</Label><Input type="number" value={editingDonor.monthlyAmount} onChange={e => updateField('monthlyAmount', Number(e.target.value))} className="h-8 text-xs" /></div>
                <div><Label className="text-[11px]">יום חיוב</Label><Input type="number" min={1} max={28} value={editingDonor.chargeDay} onChange={e => updateField('chargeDay', Number(e.target.value))} className="h-8 text-xs" /></div>
                <div><Label className="text-[11px]">תאריך התחלה</Label><Input type="date" value={editingDonor.startDate} onChange={e => updateField('startDate', e.target.value)} className="h-8 text-xs" /></div>
                <div><Label className="text-[11px]">חודשים (0 = ללא הגבלה)</Label><Input type="number" min={0} value={editingDonor.monthCount} onChange={e => updateField('monthCount', Number(e.target.value))} className="h-8 text-xs" /></div>
                <div>
                  <Label className="text-[11px]">קבוצה</Label>
                  <Select value={editingDonor.groupId?.toString() || 'none'} onValueChange={v => updateField('groupId', v === 'none' ? null : Number(v))}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="בחר קבוצה" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">ללא</SelectItem>
                      {groups.map(g => <SelectItem key={g.id} value={g.id!.toString()}>{g.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[11px]">סטטוס</Label>
                  <Select value={editingDonor.status} onValueChange={v => updateField('status', v)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">פעיל</SelectItem>
                      <SelectItem value="frozen">מוקפא</SelectItem>
                      <SelectItem value="cancelled">מבוטל</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div><Label className="text-[11px]">הערות</Label><Input value={editingDonor.notes} onChange={e => updateField('notes', e.target.value)} className="h-8 text-xs" /></div>
          </div>

          <DialogFooter className="gap-2 mt-3">
            <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>ביטול</Button>
            <Button size="sm" onClick={saveDonor}>{isEditing ? 'עדכן' : 'הוסף'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-sm">{viewingDonor?.fullName}</DialogTitle>
          </DialogHeader>
          {viewingDonor && (
            <Tabs defaultValue="details">
              <TabsList className="mb-3">
                <TabsTrigger value="details" className="text-xs">פרטים</TabsTrigger>
                <TabsTrigger value="collections" className="text-xs">היסטוריה</TabsTrigger>
              </TabsList>
              <TabsContent value="details">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div><span className="text-muted-foreground">שם:</span> <strong>{viewingDonor.fullName}</strong></div>
                  <div><span className="text-muted-foreground">ת.ז.:</span> <strong>{viewingDonor.idNumber}</strong></div>
                  <div><span className="text-muted-foreground">טלפון:</span> <strong>{viewingDonor.phone}</strong></div>
                  <div><span className="text-muted-foreground">אימייל:</span> <strong>{viewingDonor.email}</strong></div>
                  <div><span className="text-muted-foreground">כתובת:</span> <strong>{viewingDonor.address}</strong></div>
                  <div><span className="text-muted-foreground">סטטוס:</span> <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${statusColors[viewingDonor.status]}`}>{statusLabels[viewingDonor.status]}</span></div>
                  <div><span className="text-muted-foreground">בנק/סניף/חשבון:</span> <strong>{viewingDonor.bankNumber}/{viewingDonor.branchNumber}/{viewingDonor.accountNumber}</strong></div>
                  <div><span className="text-muted-foreground">סכום חודשי:</span> <strong>₪{viewingDonor.monthlyAmount.toLocaleString()}</strong></div>
                  <div><span className="text-muted-foreground">יום חיוב:</span> <strong>{viewingDonor.chargeDay}</strong></div>
                  <div><span className="text-muted-foreground">נגבה:</span> <strong>{viewingDonor.monthsCollected}/{viewingDonor.monthCount || '∞'}</strong></div>
                  <div className="col-span-2 bg-muted/30 rounded p-2">
                    <span className="text-muted-foreground">סה"כ נגבה מתורם זה: </span>
                    <strong className="text-primary text-sm">₪{(viewingDonor.monthsCollected * viewingDonor.monthlyAmount).toLocaleString()}</strong>
                    {viewingDonor.monthCount > 0 && (
                      <span className="text-muted-foreground mr-2">
                        מתוך ₪{(viewingDonor.monthCount * viewingDonor.monthlyAmount).toLocaleString()}
                      </span>
                    )}
                  </div>
                  {viewingDonor.notes && <div className="col-span-2"><span className="text-muted-foreground">הערות:</span> {viewingDonor.notes}</div>}
                </div>
                <div className="flex gap-2 mt-3">
                  <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => { setViewDialogOpen(false); openEdit(viewingDonor); }}>עריכה</Button>
                  {viewingDonor.status === 'active' && (
                    <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => { toggleDonorStatus(viewingDonor, 'frozen'); setViewDialogOpen(false); }}>הקפאה</Button>
                  )}
                  {viewingDonor.status === 'frozen' && (
                    <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => { toggleDonorStatus(viewingDonor, 'active'); setViewDialogOpen(false); }}>הפעלה</Button>
                  )}
                </div>
              </TabsContent>
              <TabsContent value="collections">
                <table className="w-full text-xs">
                  <thead><tr className="border-b"><th className="text-right p-2 text-[11px] text-muted-foreground">סכום</th><th className="text-right p-2 text-[11px] text-muted-foreground">סטטוס</th></tr></thead>
                  <tbody>
                    {donorCollections.map((item: any) => (
                      <tr key={item.id} className="border-b border-border/50">
                        <td className="p-2">₪{item.amount.toLocaleString()}</td>
                        <td className="p-2">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] ${item.status === 'collected' ? 'bg-emerald-50 text-emerald-700' : item.status === 'pending' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`}>
                            {item.status === 'collected' ? 'נגבה' : item.status === 'pending' ? 'ממתין' : 'נכשל'}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {donorCollections.length === 0 && <tr><td colSpan={2} className="p-4 text-center text-muted-foreground text-xs">אין היסטוריה</td></tr>}
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
