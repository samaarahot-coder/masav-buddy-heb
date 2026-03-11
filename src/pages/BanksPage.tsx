import { useEffect, useState } from 'react';
import { db, type Bank, type Branch } from '@/db/database';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Search, Building2 } from 'lucide-react';

export function BanksPage() {
  const [banks, setBanks] = useState<Bank[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [search, setSearch] = useState('');
  const [branchSearch, setBranchSearch] = useState('');
  const [selectedBank, setSelectedBank] = useState<string | null>(null);
  const [bankDialogOpen, setBankDialogOpen] = useState(false);
  const [branchDialogOpen, setBranchDialogOpen] = useState(false);
  const [newBank, setNewBank] = useState({ bankNumber: '', bankName: '' });
  const [newBranch, setNewBranch] = useState({ branchNumber: '', branchName: '', address: '' });

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setBanks(await db.banks.toArray());
    setBranches(await db.branches.toArray());
  }

  const filteredBanks = banks.filter(b =>
    b.bankName.includes(search) || b.bankNumber.includes(search)
  );

  const filteredBranches = selectedBank
    ? branches.filter(b => b.bankNumber === selectedBank).filter(b =>
      !branchSearch || b.branchName.includes(branchSearch) || b.branchNumber.includes(branchSearch)
    )
    : [];

  async function addBank() {
    if (!newBank.bankNumber || !newBank.bankName) { toast.error('יש למלא את כל השדות'); return; }
    await db.banks.add(newBank);
    toast.success('הבנק נוסף');
    setBankDialogOpen(false);
    setNewBank({ bankNumber: '', bankName: '' });
    loadData();
  }

  async function addBranch() {
    if (!newBranch.branchNumber || !newBranch.branchName) { toast.error('יש למלא את כל השדות'); return; }
    await db.branches.add({ ...newBranch, bankNumber: selectedBank! });
    toast.success('הסניף נוסף');
    setBranchDialogOpen(false);
    setNewBranch({ branchNumber: '', branchName: '', address: '' });
    loadData();
  }

  return (
    <div>
      <PageHeader title="בנקים וסניפים" description={`${banks.length} בנקים, ${branches.length} סניפים`}
        actions={<Button onClick={() => setBankDialogOpen(true)} size="sm" className="gap-1.5"><Plus size={15} /> בנק חדש</Button>}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Banks */}
        <div>
          <div className="mb-3 relative">
            <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="חיפוש בנק..." value={search} onChange={e => setSearch(e.target.value)} className="pr-9" />
          </div>
          <div className="bg-card rounded-xl border border-border/50 overflow-hidden max-h-[500px] overflow-y-auto">
            {filteredBanks.map(b => (
              <button key={b.id} onClick={() => setSelectedBank(b.bankNumber)}
                className={`w-full text-right p-3 border-b border-border/50 hover:bg-muted/40 transition-colors text-sm flex items-center gap-2 ${selectedBank === b.bankNumber ? 'bg-primary/5 border-r-2 border-r-primary' : ''}`}>
                <Building2 size={14} className="text-muted-foreground flex-shrink-0" />
                <span className="font-medium">{b.bankName}</span>
                <span className="text-muted-foreground text-xs mr-auto">({b.bankNumber})</span>
              </button>
            ))}
            {filteredBanks.length === 0 && <div className="p-8 text-center text-muted-foreground text-sm">אין בנקים</div>}
          </div>
        </div>

        {/* Branches */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="relative flex-1">
              <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="חיפוש סניף..." value={branchSearch} onChange={e => setBranchSearch(e.target.value)} className="pr-9" disabled={!selectedBank} />
            </div>
            {selectedBank && <Button size="sm" variant="outline" onClick={() => setBranchDialogOpen(true)} className="mr-2 gap-1"><Plus size={14} /> סניף</Button>}
          </div>
          <div className="bg-card rounded-xl border border-border/50 overflow-hidden max-h-[500px] overflow-y-auto">
            {filteredBranches.map(b => (
              <div key={b.id} className="p-3 border-b border-border/50 text-sm">
                <div className="font-medium">{b.branchName} <span className="text-muted-foreground text-xs">({b.branchNumber})</span></div>
                {b.address && <div className="text-xs text-muted-foreground mt-0.5">{b.address}{b.city ? `, ${b.city}` : ''}</div>}
              </div>
            ))}
            {!selectedBank && <div className="p-8 text-center text-muted-foreground text-sm">בחר בנק לצפייה בסניפים</div>}
            {selectedBank && filteredBranches.length === 0 && <div className="p-8 text-center text-muted-foreground text-sm">אין סניפים</div>}
          </div>
        </div>
      </div>

      <Dialog open={bankDialogOpen} onOpenChange={setBankDialogOpen}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>הוספת בנק</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>מספר בנק</Label><Input value={newBank.bankNumber} onChange={e => setNewBank({ ...newBank, bankNumber: e.target.value })} /></div>
            <div><Label>שם בנק</Label><Input value={newBank.bankName} onChange={e => setNewBank({ ...newBank, bankName: e.target.value })} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setBankDialogOpen(false)}>ביטול</Button><Button onClick={addBank}>הוסף</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={branchDialogOpen} onOpenChange={setBranchDialogOpen}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>הוספת סניף</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>מספר סניף</Label><Input value={newBranch.branchNumber} onChange={e => setNewBranch({ ...newBranch, branchNumber: e.target.value })} /></div>
            <div><Label>שם סניף</Label><Input value={newBranch.branchName} onChange={e => setNewBranch({ ...newBranch, branchName: e.target.value })} /></div>
            <div><Label>כתובת</Label><Input value={newBranch.address} onChange={e => setNewBranch({ ...newBranch, address: e.target.value })} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setBranchDialogOpen(false)}>ביטול</Button><Button onClick={addBranch}>הוסף</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
