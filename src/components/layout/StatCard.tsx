import { type LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: string;
  trendUp?: boolean;
}

export function StatCard({ title, value, icon: Icon }: StatCardProps) {
  return (
    <div className="bg-card rounded-lg border border-border p-3.5 hover:shadow-sm transition-shadow">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] text-muted-foreground font-medium">{title}</span>
        <Icon size={14} className="text-muted-foreground/60" />
      </div>
      <p className="text-lg font-bold text-foreground">{value}</p>
    </div>
  );
}
