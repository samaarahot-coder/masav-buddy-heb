import { useEffect, useState } from 'react';
import { db } from '@/db/database';
import { PageHeader } from '@/components/layout/PageHeader';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Download } from 'lucide-react';
import * as XLSX from 'xlsx';

export function ReportsPage() {
  const [period, setPeriod] = useState<'month' | 'year'>('month');
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [summary, setSummary] = useState({ totalCollected: 0, totalDonors: 0, totalFailed: 0, avgAmount: 0 });

  useEffect(() => { loadReports(); }, [period]);

  async function loadReports() {
    const collections = await db.collections.toArray();
    const donors = await db.donors.toArray();
    const failed = await db.failedDebits.toArray();

    const now = new Date();
    const hebrewMonths = ['ינו׳', 'פבר׳', 'מרץ', 'אפר׳', 'מאי', 'יוני', 'יולי', 'אוג׳', 'ספט׳', 'אוק׳', 'נוב׳', 'דצמ׳'];

    if (period === 'month') {
      const map = new Map<string, number>();
      collections.forEach(c => {
        const d = new Date(c.date);
        if (d.getFullYear() === now.getFullYear()) {
          const key = hebrewMonths[d.getMonth()];
          map.set(key, (map.get(key) || 0) + c.totalAmount);
        }
      });
      setMonthlyData(hebrewMonths.map(m => ({ period: m, amount: map.get(m) || 0 })));
    } else {
      const map = new Map<string, number>();
      collections.forEach(c => {
        const year = new Date(c.date).getFullYear().toString();
        map.set(year, (map.get(year) || 0) + c.totalAmount);
      });
      setMonthlyData(Array.from(map.entries()).map(([period, amount]) => ({ period, amount })));
    }

    const totalCollected = collections.reduce((s, c) => s + c.totalAmount, 0);
    const activeDonors = donors.filter(d => d.status === 'active').length;
    setSummary({
      totalCollected,
      totalDonors: activeDonors,
      totalFailed: failed.filter(f => !f.retried).length,
      avgAmount: activeDonors > 0 ? Math.round(donors.filter(d => d.status === 'active').reduce((s, d) => s + d.monthlyAmount, 0) / activeDonors) : 0,
    });
  }

  function exportReport() {
    const data = monthlyData.map(d => ({ 'תקופה': d.period, 'סכום': d.amount }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'דוח');
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([buf]);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `דוח_${period === 'month' ? 'חודשי' : 'שנתי'}_${new Date().toISOString().split('T')[0]}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <PageHeader title="דוחות" description="דוחות וניתוח נתונים" actions={
        <div className="flex gap-2">
          <Select value={period} onValueChange={(v: any) => setPeriod(v)}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="month">חודשי</SelectItem>
              <SelectItem value="year">שנתי</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={exportReport} className="gap-1.5">
            <Download size={14} /> יצוא
          </Button>
        </div>
      } />

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'סה"כ נגבה', value: `₪${summary.totalCollected.toLocaleString()}` },
          { label: 'תורמים פעילים', value: summary.totalDonors },
          { label: 'החזרות ממתינות', value: summary.totalFailed },
          { label: 'ממוצע לתורם', value: `₪${summary.avgAmount.toLocaleString()}` },
        ].map(s => (
          <div key={s.label} className="bg-card rounded-xl border border-border/50 p-4">
            <p className="text-xs text-muted-foreground mb-1">{s.label}</p>
            <p className="text-xl font-bold">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="bg-card rounded-xl border border-border/50 p-5">
        <h2 className="text-sm font-semibold mb-4">גרף גבייה {period === 'month' ? 'חודשית' : 'שנתית'}</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(214 32% 91%)" />
              <XAxis dataKey="period" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(value: number) => [`₪${value.toLocaleString()}`, 'סכום']} />
              <Bar dataKey="amount" fill="hsl(221 83% 53%)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
