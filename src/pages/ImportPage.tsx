import { useState } from 'react';
import { db } from '@/db/database';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { Upload } from 'lucide-react';

export function ImportPage() {
  const [preview, setPreview] = useState<Record<string, string>[]>([]);
  const [importing, setImporting] = useState(false);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = evt.target?.result;
      const wb = XLSX.read(data, { type: 'binary' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: '' });
      setPreview(json);
      toast.success(`נקראו ${json.length} שורות`);
    };
    reader.readAsBinaryString(file);
  }

  async function doImport() {
    if (preview.length === 0) return;
    setImporting(true);

    let imported = 0;
    let errors = 0;

    for (const row of preview) {
      try {
        const name = row['שם'] || row['name'] || row['שם מלא'] || '';
        if (!name) { errors++; continue; }

        const donor = {
          fullName: name,
          phone: row['טלפון'] || row['phone'] || '',
          email: row['אימייל'] || row['email'] || '',
          idNumber: row['תעודת זהות'] || row['id'] || '',
          address: row['כתובת'] || row['address'] || '',
          notes: '',
          bankNumber: row['מספר בנק'] || row['bank'] || '',
          branchNumber: row['מספר סניף'] || row['branch'] || '',
          accountNumber: row['מספר חשבון'] || row['account'] || '',
          authorizationNumber: row['מספר הרשאה'] || row['authorization'] || '',
          monthlyAmount: Number(row['סכום'] || row['amount'] || 0),
          chargeDay: Number(row['יום חיוב'] || row['chargeDay'] || 1),
          startDate: new Date().toISOString().split('T')[0],
          endDate: '',
          status: 'active' as const,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        const donorId = await db.donors.add(donor);
        await db.authorizations.add({
          donorId: donorId as number,
          amount: donor.monthlyAmount,
          chargeDay: donor.chargeDay,
          startDate: donor.startDate,
          endDate: '',
          status: 'active',
          createdAt: new Date().toISOString(),
        });
        imported++;
      } catch {
        errors++;
      }
    }

    toast.success(`יובאו ${imported} תורמים בהצלחה${errors > 0 ? `, ${errors} שגיאות` : ''}`);
    setPreview([]);
    setImporting(false);
  }

  return (
    <div>
      <PageHeader title="ייבוא אקסל" description="ייבוא תורמים מקובץ אקסל" />

      <div className="bg-card rounded-lg border border-border p-6 mb-6">
        <div className="flex items-center gap-4">
          <label className="cursor-pointer">
            <Input type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} className="hidden" />
            <div className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors text-sm">
              <Upload size={16} />
              בחר קובץ
            </div>
          </label>
          {preview.length > 0 && (
            <Button onClick={doImport} disabled={importing}>
              {importing ? 'מייבא...' : `ייבוא ${preview.length} שורות`}
            </Button>
          )}
        </div>
        <div className="mt-4 text-sm text-muted-foreground">
          <p>עמודות נדרשות: שם, טלפון, תעודת זהות, מספר בנק, מספר סניף, מספר חשבון, מספר הרשאה, סכום, יום חיוב</p>
        </div>
      </div>

      {preview.length > 0 && (
        <div className="bg-card rounded-lg border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-muted/50 border-b border-border">
                {Object.keys(preview[0]).map(key => (
                  <th key={key} className="text-right p-2 font-medium text-muted-foreground text-xs">{key}</th>
                ))}
              </tr></thead>
              <tbody>
                {preview.slice(0, 20).map((row, i) => (
                  <tr key={i} className="border-b border-border">
                    {Object.values(row).map((val, j) => (
                      <td key={j} className="p-2 text-xs">{String(val)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {preview.length > 20 && <div className="p-3 text-center text-sm text-muted-foreground">מציג 20 מתוך {preview.length} שורות</div>}
        </div>
      )}
    </div>
  );
}
