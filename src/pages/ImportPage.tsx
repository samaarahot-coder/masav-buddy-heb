import { useState } from 'react';
import { db, logActivity } from '@/db/database';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { Upload, AlertTriangle, CheckCircle } from 'lucide-react';

interface ImportRow {
  data: Record<string, string>;
  errors: string[];
  duplicate: boolean;
}

export function ImportPage() {
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [fileName, setFileName] = useState('');

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const data = evt.target?.result;
      const wb = XLSX.read(data, { type: 'binary' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: '' });

      // Validate and check duplicates
      const existingIds = new Set((await db.donors.toArray()).map(d => d.idNumber).filter(Boolean));
      const banks = await db.banks.toArray();
      const bankNums = new Set(banks.map(b => b.bankNumber));

      const processed: ImportRow[] = json.map(row => {
        const errors: string[] = [];
        const name = row['שם'] || row['name'] || row['שם מלא'] || '';
        const idNum = row['תעודת זהות'] || row['id'] || '';
        const bankNum = row['מספר בנק'] || row['bank'] || '';
        const amount = Number(row['סכום'] || row['amount'] || 0);

        if (!name) errors.push('שם חסר');
        if (bankNum && !bankNums.has(bankNum)) errors.push(`בנק ${bankNum} לא קיים`);
        if (amount <= 0) errors.push('סכום לא תקין');

        return {
          data: row,
          errors,
          duplicate: idNum ? existingIds.has(idNum) : false,
        };
      });

      setRows(processed);
      const errorCount = processed.filter(r => r.errors.length > 0).length;
      const dupeCount = processed.filter(r => r.duplicate).length;
      toast.info(`נקראו ${json.length} שורות. ${errorCount} שגיאות, ${dupeCount} כפילויות.`);
    };
    reader.readAsBinaryString(file);
  }

  async function doImport() {
    if (rows.length === 0) return;
    setImporting(true);
    let imported = 0, skipped = 0;

    for (const row of rows) {
      if (row.errors.length > 0 || row.duplicate) { skipped++; continue; }
      try {
        const r = row.data;
        const donor = {
          fullName: r['שם'] || r['name'] || r['שם מלא'] || '',
          phone: r['טלפון'] || r['phone'] || '',
          email: r['אימייל'] || r['email'] || '',
          idNumber: r['תעודת זהות'] || r['id'] || '',
          address: r['כתובת'] || r['address'] || '',
          notes: '',
          bankNumber: r['מספר בנק'] || r['bank'] || '',
          branchNumber: r['מספר סניף'] || r['branch'] || '',
          accountNumber: r['מספר חשבון'] || r['account'] || '',
          authorizationNumber: r['מספר הרשאה'] || r['authorization'] || '',
          monthlyAmount: Number(r['סכום'] || r['amount'] || 0),
          chargeDay: Number(r['יום חיוב'] || r['chargeDay'] || 1),
          startDate: new Date().toISOString().split('T')[0],
          endDate: '',
          monthCount: 0,
          monthsCollected: 0,
          lastCollectedDate: '',
          status: 'active' as const,
          groupId: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        const donorId = await db.donors.add(donor);
        if (donor.monthlyAmount > 0) {
          await db.authorizations.add({
            donorId: donorId as number,
            amount: donor.monthlyAmount,
            chargeDay: donor.chargeDay,
            startDate: donor.startDate,
            endDate: '',
            monthCount: 0,
            monthsCollected: 0,
            status: 'active',
            createdAt: new Date().toISOString(),
          });
        }
        imported++;
      } catch { skipped++; }
    }

    await logActivity('ייבוא', `ייבוא ${imported} תורמים מקובץ ${fileName}`, 'import', null, fileName);
    toast.success(`יובאו ${imported} תורמים, ${skipped} דולגו`);
    setRows([]);
    setImporting(false);
  }

  const validRows = rows.filter(r => r.errors.length === 0 && !r.duplicate).length;

  return (
    <div>
      <PageHeader title="ייבוא אקסל" description="ייבוא תורמים מקובץ אקסל" />

      <div className="bg-card rounded-xl border border-border/50 p-6 mb-5">
        <div className="flex items-center gap-4">
          <label className="cursor-pointer">
            <Input type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} className="hidden" />
            <div className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium">
              <Upload size={16} /> בחר קובץ
            </div>
          </label>
          {rows.length > 0 && (
            <>
              <div className="text-sm">
                <span className="text-muted-foreground">{rows.length} שורות | </span>
                <span className="text-success font-medium">{validRows} תקינות</span>
                {rows.filter(r => r.errors.length > 0).length > 0 && (
                  <span className="text-destructive font-medium mr-1"> | {rows.filter(r => r.errors.length > 0).length} שגיאות</span>
                )}
                {rows.filter(r => r.duplicate).length > 0 && (
                  <span className="text-warning font-medium mr-1"> | {rows.filter(r => r.duplicate).length} כפילויות</span>
                )}
              </div>
              <Button onClick={doImport} disabled={importing || validRows === 0}>
                {importing ? 'מייבא...' : `ייבוא ${validRows} שורות`}
              </Button>
            </>
          )}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          עמודות: שם, טלפון, תעודת זהות, מספר בנק, מספר סניף, מספר חשבון, מספר הרשאה, סכום, יום חיוב
        </p>
      </div>

      {rows.length > 0 && (
        <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-muted/30 border-b border-border">
                <th className="p-2 text-right text-xs text-muted-foreground w-10">מצב</th>
                {Object.keys(rows[0].data).slice(0, 8).map(key => (
                  <th key={key} className="text-right p-2 text-xs text-muted-foreground">{key}</th>
                ))}
              </tr></thead>
              <tbody>
                {rows.slice(0, 30).map((row, i) => (
                  <tr key={i} className={`border-b border-border/50 ${row.errors.length > 0 ? 'bg-destructive/5' : row.duplicate ? 'bg-warning/5' : ''}`}>
                    <td className="p-2">
                      {row.errors.length > 0 ? <AlertTriangle size={14} className="text-destructive" /> :
                       row.duplicate ? <AlertTriangle size={14} className="text-warning" /> :
                       <CheckCircle size={14} className="text-success" />}
                    </td>
                    {Object.values(row.data).slice(0, 8).map((val, j) => (
                      <td key={j} className="p-2 text-xs">{String(val)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length > 30 && <div className="p-3 text-center text-xs text-muted-foreground">מציג 30 מתוך {rows.length}</div>}
        </div>
      )}
    </div>
  );
}
