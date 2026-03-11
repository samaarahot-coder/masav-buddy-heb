import { db } from '@/db/database';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { Download } from 'lucide-react';

export function ExportPage() {
  async function exportDonors(format: 'xlsx' | 'csv') {
    const donors = await db.donors.toArray();
    const data = donors.map(d => ({
      'שם מלא': d.fullName,
      'תעודת זהות': d.idNumber,
      'טלפון': d.phone,
      'אימייל': d.email,
      'כתובת': d.address,
      'מספר בנק': d.bankNumber,
      'מספר סניף': d.branchNumber,
      'מספר חשבון': d.accountNumber,
      'מספר הרשאה': d.authorizationNumber,
      'סכום חודשי': d.monthlyAmount,
      'יום חיוב': d.chargeDay,
      'סטטוס': d.status === 'active' ? 'פעיל' : d.status === 'frozen' ? 'מוקפא' : 'מבוטל',
    }));
    downloadSheet(data, `תורמים_${new Date().toISOString().split('T')[0]}`, format);
  }

  async function exportAuthorizations(format: 'xlsx' | 'csv') {
    const auths = await db.authorizations.toArray();
    const donors = await db.donors.toArray();
    const donorMap = new Map(donors.map(d => [d.id, d.fullName]));
    const data = auths.map(a => ({
      'תורם': donorMap.get(a.donorId) || '',
      'סכום': a.amount,
      'יום חיוב': a.chargeDay,
      'תאריך התחלה': a.startDate,
      'סטטוס': a.status === 'active' ? 'פעיל' : a.status === 'frozen' ? 'מוקפא' : 'מבוטל',
    }));
    downloadSheet(data, `הוראות_קבע_${new Date().toISOString().split('T')[0]}`, format);
  }

  async function exportCollections(format: 'xlsx' | 'csv') {
    const collections = await db.collections.toArray();
    const data = collections.map(c => ({
      'תאריך': c.date,
      'מספר חיובים': c.totalRecords,
      'סכום כולל': c.totalAmount,
      'שם קובץ': c.fileName,
    }));
    downloadSheet(data, `היסטוריית_גבייה_${new Date().toISOString().split('T')[0]}`, format);
  }

  function downloadSheet(data: Record<string, unknown>[], name: string, format: 'xlsx' | 'csv') {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    if (format === 'csv') {
      const csv = XLSX.utils.sheet_to_csv(ws);
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
      saveAs(blob, `${name}.csv`);
    } else {
      const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      saveAs(new Blob([buf]), `${name}.xlsx`);
    }
    toast.success('הקובץ הורד בהצלחה');
  }

  const exports = [
    { title: 'רשימת תורמים', fn: exportDonors },
    { title: 'הוראות קבע', fn: exportAuthorizations },
    { title: 'היסטוריית גבייה', fn: exportCollections },
  ];

  return (
    <div>
      <PageHeader title="יצוא נתונים" description="יצוא נתונים לאקסל או CSV" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {exports.map(exp => (
          <div key={exp.title} className="bg-card rounded-lg border border-border p-6">
            <h3 className="font-semibold mb-4">{exp.title}</h3>
            <div className="flex gap-2">
              <Button onClick={() => exp.fn('xlsx')} size="sm" variant="outline">
                <Download size={14} className="ml-1" />Excel
              </Button>
              <Button onClick={() => exp.fn('csv')} size="sm" variant="outline">
                <Download size={14} className="ml-1" />CSV
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
