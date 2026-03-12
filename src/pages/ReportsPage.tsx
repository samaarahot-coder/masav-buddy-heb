import { useEffect, useState } from 'react';
import { db } from '@/db/database';
import { PageHeader } from '@/components/layout/PageHeader';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Download } from 'lucide-react';
import * as XLSX from 'xlsx';

export function ReportsPage() {
  const [period, setPeriod] = useState<'month' | 'year'>('month');
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [summary, setSummary] = useState({ totalCollected: 0, totalPending: 0, totalDonors: 0, totalFailed: 0, avgAmount: 0 });

  useEffect(() => { loadReports(); }, [period]);

  async function loadReports() {
    const collections = await db.collections.toArray();
    const collectionItems = await db.collectionItems.toArray();
    const donors = await db.donors.toArray();
    const failed = await db.failedDebits.toArray();

    const now = new Date();
    const hebrewMonths = ['ינו׳', 'פבר׳', 'מרץ', 'אפר׳', 'מאי', 'יוני', 'יולי', 'אוג׳', 'ספט׳', 'אוק׳', 'נוב׳', 'דצמ׳'];

    if (period === 'month') {
      const map = new Map<string, { collected: number; pending: number }>();
      collections.forEach(c => {
        const d = new Date(c.date);
        if (d.getFullYear() === now.getFullYear()) {
          const key = hebrewMonths[d.getMonth()];
          const existing = map.get(key) || { collected: 0, pending: 0 };
          if (c.status === 'collected') existing.collected += c.totalAmount;
          else existing.pending += c.totalAmount;
          map.set(key, existing);
        }
      });
      setMonthlyData(hebrewMonths.map(m => ({ period: m, collected: map.get(m)?.collected || 0, pending: map.get(m)?.pending || 0 })));
    } else {
      const map = new Map<string, { collected: number; pending: number }>();
      collections.forEach(c => {
        const year = new Date(c.date).getFullYear().toString();
        const existing = map.get(year) || { collected: 0, pending: 0 };
        if (c.status === 'collected') existing.collected += c.totalAmount;
        else existing.pending += c.totalAmount;
        map.set(year, existing);
      });
      setMonthlyData(Array.from(map.entries()).map(([period, v]) => ({ period, ...v })));
    }

    const totalCollected = collectionItems.filter(i => i.status === 'collected').reduce((s, i) => s + i.amount, 0);
    const totalPending = collectionItems.filter(i => i.status === 'pending').reduce((s, i) => s + i.amount, 0);
    const activeDonors = donors.filter(d => d.status === 'active').length;
    setSummary({
      totalCollected,
      totalPending,
      totalDonors: activeDonors,
      totalFailed: failed.filter(f => !f.retried).length,
      avgAmount: activeDonors > 0 ? Math.round(donors.filter(d => d.status === 'active').reduce((s, d) => s + d.monthlyAmount, 0) / activeDonors) : 0,
    });
  }

  function exportReport() {
    const data = monthlyData.map(d => ({ 'תקופה': d.period, 'נגבה': d.collected, 'ממתין': d.pending }));
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

  const summaryCards = [
    { label: 'נגבה', value: `₪${summary.totalCollected.toLocaleString()}`, color: 'text-emerald-600 dark:text-emerald-400' },
    { label: 'ממתין לגבייה', value: `₪${summary.totalPending.toLocaleString()}`, color: 'text-amber-600 dark:text-amber-400' },
    { label: 'תורמים פעילים', value: summary.totalDonors, color: '' },
    { label: 'החזרות', value: summary.totalFailed, color: '' },
    { label: 'ממוצע לתורם', value: `₪${summary.avgAmount.toLocaleString()}`, color: '' },
  ];

  return (
    <div>
      <PageHeader title="דוחות" description="ניתוח נתוני גבייה" actions={
        <div className="flex gap-2">
          <Select value={period} onValueChange={(v: any) => setPeriod(v)}>
            <SelectTrigger className="w-24 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="month">חודשי</SelectItem>
              <SelectItem value="year">שנתי</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={exportReport} className="gap-1.5 text-xs">
            <Download size={13} /> יצוא Excel
          </Button>
        </div>
      } />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
        {summaryCards.map(s => (
          <div key={s.label} className="glass-card p-3.5">
            <p className="text-[10px] text-muted-foreground mb-1.5">{s.label}</p>
            <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="glass-card p-4">
        <h2 className="text-sm font-semibold mb-4">גרף גבייה {period === 'month' ? 'חודשית' : 'שנתית'}</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="period" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip formatter={(value: number) => [`₪${value.toLocaleString()}`, '']} />
              <Legend />
              <Bar dataKey="collected" fill="hsl(142 71% 45%)" radius={[4, 4, 0, 0]} name="נגבה" stackId="a" />
              <Bar dataKey="pending" fill="hsl(38 92% 50%)" radius={[4, 4, 0, 0]} name="ממתין" stackId="a" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
