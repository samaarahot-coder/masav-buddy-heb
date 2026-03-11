import { useEffect, useState } from 'react';
import { db, type Donor, type Collection } from '@/db/database';
import { StatCard } from '@/components/layout/StatCard';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Users, CreditCard, FileText, TrendingUp, AlertTriangle, Plus, Upload, Zap } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface DashboardPageProps {
  onNavigate: (page: string) => void;
}

export function DashboardPage({ onNavigate }: DashboardPageProps) {
  const [stats, setStats] = useState({
    monthlyAmount: 0,
    yearlyAmount: 0,
    donorCount: 0,
    activeAuths: 0,
    failedDebits: 0,
  });
  const [monthlyData, setMonthlyData] = useState<{ month: string; amount: number }[]>([]);

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    const donors = await db.donors.count();
    const activeAuths = await db.authorizations.where('status').equals('active').count();
    const failedDebits = await db.failedDebits.where('retried').equals(0).count();

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const collections = await db.collections.toArray();
    let monthlyAmount = 0;
    let yearlyAmount = 0;

    const monthlyMap = new Map<string, number>();
    const hebrewMonths = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];

    collections.forEach((c) => {
      const d = new Date(c.date);
      if (d.getFullYear() === currentYear) {
        yearlyAmount += c.totalAmount;
        if (d.getMonth() === currentMonth) {
          monthlyAmount += c.totalAmount;
        }
        const key = hebrewMonths[d.getMonth()];
        monthlyMap.set(key, (monthlyMap.get(key) || 0) + c.totalAmount);
      }
    });

    const chartData = hebrewMonths.map(m => ({
      month: m,
      amount: monthlyMap.get(m) || 0,
    }));

    setMonthlyData(chartData);
    setStats({ monthlyAmount, yearlyAmount, donorCount: donors, activeAuths, failedDebits });
  }

  const formatCurrency = (n: number) => `₪${n.toLocaleString('he-IL')}`;

  return (
    <div>
      <PageHeader
        title="דשבורד"
        description="סקירה כללית של המערכת"
        actions={
          <div className="flex gap-2">
            <Button onClick={() => onNavigate('donors')} size="sm">
              <Plus size={16} className="ml-1" />
              הוסף תורם
            </Button>
            <Button onClick={() => onNavigate('import')} variant="outline" size="sm">
              <Upload size={16} className="ml-1" />
              ייבוא אקסל
            </Button>
            <Button onClick={() => onNavigate('collection')} variant="outline" size="sm">
              <Zap size={16} className="ml-1" />
              גבייה חדשה
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <StatCard title="גבייה החודש" value={formatCurrency(stats.monthlyAmount)} icon={CreditCard} />
        <StatCard title="גבייה השנה" value={formatCurrency(stats.yearlyAmount)} icon={TrendingUp} />
        <StatCard title="מספר תורמים" value={stats.donorCount} icon={Users} />
        <StatCard title="הוראות פעילות" value={stats.activeAuths} icon={FileText} />
        <StatCard title="גביות שנכשלו" value={stats.failedDebits} icon={AlertTriangle} />
      </div>

      <div className="bg-card rounded-lg border border-border p-6">
        <h2 className="text-lg font-semibold mb-4">גרף גבייה חודשית</h2>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(214 20% 88%)" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(value: number) => [`₪${value.toLocaleString()}`, 'סכום']} />
              <Bar dataKey="amount" fill="hsl(217 71% 45%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
