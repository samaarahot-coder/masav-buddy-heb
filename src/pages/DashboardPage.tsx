import { useEffect, useState } from 'react';
import { db } from '@/db/database';
import { StatCard } from '@/components/layout/StatCard';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Users, CreditCard, FileText, TrendingUp, AlertTriangle, Plus, Upload, Zap } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface DashboardPageProps {
  onNavigate: (page: string) => void;
}

export function DashboardPage({ onNavigate }: DashboardPageProps) {
  const [stats, setStats] = useState({
    monthlyAmount: 0, yearlyAmount: 0, donorCount: 0,
    activeAuths: 0, failedDebits: 0, pendingCollections: 0,
  });
  const [monthlyData, setMonthlyData] = useState<{ month: string; amount: number }[]>([]);
  const [statusData, setStatusData] = useState<{ name: string; value: number; color: string }[]>([]);

  useEffect(() => { loadStats(); }, []);

  async function loadStats() {
    const donors = await db.donors.toArray();
    const activeAuths = await db.authorizations.where('status').equals('active').count();
    const failedDebits = await db.failedDebits.where('retried').equals(0).count();
    const pendingCollections = await db.collectionItems.where('status').equals('pending').count();

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const collections = await db.collections.toArray();

    let monthlyAmount = 0;
    let yearlyAmount = 0;
    const monthlyMap = new Map<string, number>();
    const hebrewMonths = ['ינו׳', 'פבר׳', 'מרץ', 'אפר׳', 'מאי', 'יוני', 'יולי', 'אוג׳', 'ספט׳', 'אוק׳', 'נוב׳', 'דצמ׳'];

    collections.forEach((c) => {
      const d = new Date(c.date);
      if (d.getFullYear() === currentYear) {
        yearlyAmount += c.totalAmount;
        if (d.getMonth() === currentMonth) monthlyAmount += c.totalAmount;
        const key = hebrewMonths[d.getMonth()];
        monthlyMap.set(key, (monthlyMap.get(key) || 0) + c.totalAmount);
      }
    });

    setMonthlyData(hebrewMonths.map(m => ({ month: m, amount: monthlyMap.get(m) || 0 })));

    const active = donors.filter(d => d.status === 'active').length;
    const frozen = donors.filter(d => d.status === 'frozen').length;
    const cancelled = donors.filter(d => d.status === 'cancelled').length;
    const expired = donors.filter(d => d.status === 'expired').length;
    setStatusData([
      { name: 'פעיל', value: active, color: 'hsl(152 55% 40%)' },
      { name: 'מוקפא', value: frozen, color: 'hsl(38 85% 48%)' },
      { name: 'מבוטל', value: cancelled, color: 'hsl(0 65% 52%)' },
      { name: 'פג תוקף', value: expired, color: 'hsl(220 9% 52%)' },
    ].filter(d => d.value > 0));

    setStats({ monthlyAmount, yearlyAmount, donorCount: donors.length, activeAuths, failedDebits, pendingCollections });
  }

  const fmt = (n: number) => `₪${n.toLocaleString('he-IL')}`;

  return (
    <div>
      <PageHeader
        title="דשבורד"
        description="סקירה כללית"
        actions={
          <div className="flex gap-1.5">
            <Button onClick={() => onNavigate('donors')} size="sm" className="gap-1 text-[11px] h-7"><Plus size={12} /> תורם</Button>
            <Button onClick={() => onNavigate('import')} variant="outline" size="sm" className="gap-1 text-[11px] h-7"><Upload size={12} /> ייבוא</Button>
            <Button onClick={() => onNavigate('collection')} variant="outline" size="sm" className="gap-1 text-[11px] h-7"><Zap size={12} /> גבייה</Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5 mb-4">
        <StatCard title="גבייה החודש" value={fmt(stats.monthlyAmount)} icon={CreditCard} />
        <StatCard title="גבייה השנה" value={fmt(stats.yearlyAmount)} icon={TrendingUp} />
        <StatCard title="תורמים" value={stats.donorCount} icon={Users} />
        <StatCard title={'הו"ק פעילות'} value={stats.activeAuths} icon={FileText} />
        <StatCard title="ממתין לגבייה" value={stats.pendingCollections} icon={AlertTriangle} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-2.5">
        <div className="lg:col-span-2 bg-card rounded-lg border border-border p-3.5">
          <h2 className="text-[11px] font-semibold mb-2">גבייה חודשית</h2>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 13% 91%)" />
                <XAxis dataKey="month" tick={{ fontSize: 9 }} />
                <YAxis tick={{ fontSize: 9 }} />
                <Tooltip formatter={(value: number) => [`₪${value.toLocaleString()}`, 'סכום']} />
                <Bar dataKey="amount" fill="hsl(222 62% 52%)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-card rounded-lg border border-border p-3.5">
          <h2 className="text-[11px] font-semibold mb-2">סטטוס תורמים</h2>
          {statusData.length > 0 ? (
            <div className="h-44 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusData} cx="50%" cy="50%" outerRadius={60} dataKey="value" label={({ name, value }) => `${name} (${value})`} labelLine={false}>
                    {statusData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-44 flex items-center justify-center text-xs text-muted-foreground">אין נתונים</div>
          )}
        </div>
      </div>
    </div>
  );
}
