import { useEffect, useState } from 'react';
import { db, type Bank, type Branch } from '@/db/database';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Search, Upload } from 'lucide-react';
import * as XLSX from 'xlsx';

export function BanksPage() {
  const [banks, setBanks] = useState<Bank[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [search, setSearch] = useState('');
  const [selectedBank, setSelectedBank] = useState<string | null>(null);
  const [bankDialogOpen, setBankDialogOpen] = useState(false);
  const [branchDialogOpen, setBranchDialogOpen] = useState(false);
  const [newBank, setNewBank] = useState({ bankNumber: '', bankName: '' });
  const [newBranch, setNewBranch] = useState({ bankNumber: '', branchNumber: '', branchName: '', address: '' });

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setBanks(await db.banks.toArray());
    setBranches(await db.branches.toArray());
  }

  const filteredBanks = banks.filter(b =>
    b.bankName.includes(search) || b.bankNumber.includes(search)
  );

  const filteredBranches = selectedBank
    ? branches.filter(b => b.bankNumber === selectedBank)
    : [];

  async function addBank() {
    if (!newBank.bankNumber || !newBank.bankName) { toast.error('יש למלא את כל השדות'); return; }
    await db.banks.add(newBank);
    toast.success('הבנק נוסף בהצלחה');
    setBankDialogOpen(false);
    setNewBank({ bankNumber: '', bankName: '' });
    loadData();
  }

  async function addBranch() {
    if (!newBranch.branchNumber || !newBranch.branchName) { toast.error('יש למלא את כל השדות'); return; }
    await db.branches.add({ ...newBranch, bankNumber: selectedBank || newBranch.bankNumber });
    toast.success('הסניף נוסף בהצלחה');
    setBranchDialogOpen(false);
    setNewBranch({ bankNumber: '', branchNumber: '', branchName: '', address: '' });
    loadData();
  }

  async function importBanksExcel(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const wb = XLSX.read(evt.target?.result, { type: 'binary' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: '' });

      let bankCount = 0, branchCount = 0;
      const seenBanks = new Set<string>();

      for (const row of rows) {
        const bankNum = String(row['מספר בנק'] || row['bank_code'] || row['קוד בנק'] || '').trim();
        const bankName = String(row['שם בנק'] || row['bank_name'] || row['שם הבנק'] || '').trim();
        const branchNum = String(row['מספר סניף'] || row['branch_code'] || row['קוד סניף'] || '').trim();
        const branchName = String(row['שם סניף'] || row['branch_name'] || row['שם הסניף'] || '').trim();
        const address = String(row['כתובת'] || row['address'] || '').trim();

        if (bankNum && bankName && !seenBanks.has(bankNum)) {
          const existing = await db.banks.where('bankNumber').equals(bankNum).first();
          if (!existing) {
            await db.banks.add({ bankNumber: bankNum, bankName });
            bankCount++;
          }
          seenBanks.add(bankNum);
        }

        if (bankNum && branchNum) {
          const existing = await db.branches.where({ bankNumber: bankNum, branchNumber: branchNum }).first();
          if (!existing) {
            await db.branches.add({ bankNumber: bankNum, branchNumber: branchNum, branchName: branchName || `סניף ${branchNum}`, address });
            branchCount++;
          }
        }
      }

      toast.success(`יובאו ${bankCount} בנקים ו-${branchCount} סניפים`);
      loadData();
    };
    reader.readAsBinaryString(file);
  }

  return (
    <div>
      <PageHeader title="בנקים וסניפים" description={`${banks.length} בנקים, ${branches.length} סניפים`}
        actions={
          <div className="flex gap-2">
            <label className="cursor-pointer">
              <Input type="file" accept=".xlsx,.xls,.csv" onChange={importBanksExcel} className="hidden" />
              <div className="flex items-center gap-1 px-3 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 transition-colors text-sm">
                <Upload size={14} />ייבוא אקסל
              </div>
            </label>
            <Button onClick={() => setBankDialogOpen(true)} size="sm"><Plus size={16} className="ml-1" />בנק חדש</Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <div className="mb-3 relative">
            <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="חיפוש בנק..." value={search} onChange={e => setSearch(e.target.value)} className="pr-9" />
          </div>
          <div className="bg-card rounded-lg border border-border overflow-hidden max-h-[500px] overflow-y-auto">
            {filteredBanks.map(b => (
              <button key={b.id} onClick={() => setSelectedBank(b.bankNumber)}
                className={`w-full text-right p-3 border-b border-border hover:bg-muted/50 transition-colors text-sm ${selectedBank === b.bankNumber ? 'bg-primary/5 border-r-2 border-r-primary' : ''}`}>
                <span className="font-medium">{b.bankName}</span>
                <span className="text-muted-foreground mr-2">({b.bankNumber})</span>
              </button>
            ))}
            {filteredBanks.length === 0 && <div className="p-6 text-center text-muted-foreground">אין בנקים</div>}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">סניפים {selectedBank ? `(בנק ${selectedBank})` : ''}</h3>
            {selectedBank && <Button size="sm" variant="outline" onClick={() => setBranchDialogOpen(true)}><Plus size={14} className="ml-1" />סניף חדש</Button>}
          </div>
          <div className="bg-card rounded-lg border border-border overflow-hidden max-h-[500px] overflow-y-auto">
            {filteredBranches.map(b => (
              <div key={b.id} className="p-3 border-b border-border text-sm">
                <div className="font-medium">{b.branchName} <span className="text-muted-foreground">({b.branchNumber})</span></div>
                {b.address && <div className="text-xs text-muted-foreground mt-1">{b.address}</div>}
              </div>
            ))}
            {!selectedBank && <div className="p-6 text-center text-muted-foreground">בחר בנק לצפייה בסניפים</div>}
            {selectedBank && filteredBranches.length === 0 && <div className="p-6 text-center text-muted-foreground">אין סניפים לבנק זה</div>}
          </div>
        </div>
      </div>

      <Dialog open={bankDialogOpen} onOpenChange={setBankDialogOpen}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>הוספת בנק חדש</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>מספר בנק</Label><Input value={newBank.bankNumber} onChange={e => setNewBank({ ...newBank, bankNumber: e.target.value })} /></div>
            <div><Label>שם בנק</Label><Input value={newBank.bankName} onChange={e => setNewBank({ ...newBank, bankName: e.target.value })} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setBankDialogOpen(false)}>ביטול</Button><Button onClick={addBank}>הוסף</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={branchDialogOpen} onOpenChange={setBranchDialogOpen}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>הוספת סניף חדש</DialogTitle></DialogHeader>
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
