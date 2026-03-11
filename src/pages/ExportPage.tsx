import { db } from '@/db/database';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { Download } from 'lucide-react';

function downloadSheet(data: Record<string, unknown>[], name: string, format: 'xlsx' | 'csv') {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  if (format === 'csv') {
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  } else {
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([buf]);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  }
  toast.success('הקובץ הורד בהצלחה');
}

export function ExportPage() {
  async function exportDonors(format: 'xlsx' | 'csv') {
    const donors = await db.donors.toArray();
    const data = donors.map(d => ({
      'שם מלא': d.fullName, 'תעודת זהות': d.idNumber, 'טלפון': d.phone, 'אימייל': d.email,
      'כתובת': d.address, 'מספר בנק': d.bankNumber, 'מספר סניף': d.branchNumber,
      'מספר חשבון': d.accountNumber, 'מספר הרשאה': d.authorizationNumber,
      'סכום חודשי': d.monthlyAmount, 'יום חיוב': d.chargeDay,
      'סטטוס': d.status === 'active' ? 'פעיל' : d.status === 'frozen' ? 'מוקפא' : d.status === 'expired' ? 'פג תוקף' : 'מבוטל',
    }));
    downloadSheet(data, `תורמים_${new Date().toISOString().split('T')[0]}`, format);
  }

  async function exportAuthorizations(format: 'xlsx' | 'csv') {
    const auths = await db.authorizations.toArray();
    const donors = await db.donors.toArray();
    const donorMap = new Map(donors.map(d => [d.id, d.fullName]));
    const data = auths.map(a => ({
      'תורם': donorMap.get(a.donorId) || '', 'סכום': a.amount, 'יום חיוב': a.chargeDay,
      'תאריך התחלה': a.startDate, 'חודשים': a.monthCount || 'ללא הגבלה',
      'נגבו': a.monthsCollected,
      'סטטוס': a.status === 'active' ? 'פעיל' : a.status === 'frozen' ? 'מוקפא' : a.status === 'expired' ? 'פג תוקף' : 'מבוטל',
    }));
    downloadSheet(data, `הוראות_קבע_${new Date().toISOString().split('T')[0]}`, format);
  }

  async function exportCollections(format: 'xlsx' | 'csv') {
    const collections = await db.collections.toArray();
    const data = collections.map(c => ({
      'תאריך': c.date, 'מספר חיובים': c.totalRecords, 'סכום כולל': c.totalAmount,
      'שם קובץ': c.fileName, 'סטטוס': c.status === 'collected' ? 'נגבה' : c.status === 'pending' ? 'ממתין' : 'חלקי',
    }));
    downloadSheet(data, `היסטוריית_גבייה_${new Date().toISOString().split('T')[0]}`, format);
  }

  async function exportFailedDebits(format: 'xlsx' | 'csv') {
    const returns = await db.failedDebits.toArray();
    const data = returns.map(r => ({
      'תורם': r.donorName, 'סכום': r.amount, 'סיבה': r.reason,
      'תאריך': new Date(r.createdAt).toLocaleDateString('he-IL'),
      'נגבה מחדש': r.retried ? 'כן' : 'לא',
    }));
    downloadSheet(data, `החזרות_${new Date().toISOString().split('T')[0]}`, format);
  }

  const exports = [
    { title: 'רשימת תורמים', description: 'כל התורמים עם פרטים מלאים', fn: exportDonors },
    { title: 'הוראות קבע', description: 'כל ההוראות הפעילות והמבוטלות', fn: exportAuthorizations },
    { title: 'היסטוריית גבייה', description: 'כל הגביות שבוצעו', fn: exportCollections },
    { title: 'החזרות חיוב', description: 'כל ההחזרות עם סיבות', fn: exportFailedDebits },
  ];

  return (
    <div>
      <PageHeader title="יצוא נתונים" description="יצוא נתונים לאקסל או CSV" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {exports.map(exp => (
          <div key={exp.title} className="bg-card rounded-xl border border-border/50 p-5 hover:shadow-md transition-shadow">
            <h3 className="font-semibold text-sm mb-1">{exp.title}</h3>
            <p className="text-xs text-muted-foreground mb-4">{exp.description}</p>
            <div className="flex gap-2">
              <Button onClick={() => exp.fn('xlsx')} size="sm" variant="outline" className="gap-1.5 text-xs">
                <Download size={13} /> Excel
              </Button>
              <Button onClick={() => exp.fn('csv')} size="sm" variant="outline" className="gap-1.5 text-xs">
                <Download size={13} /> CSV
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
