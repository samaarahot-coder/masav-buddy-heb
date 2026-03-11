import { type LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: string;
  trendUp?: boolean;
}

export function StatCard({ title, value, icon: Icon, trend, trendUp }: StatCardProps) {
  return (
    <div className="bg-card rounded-lg p-4 stat-card-shadow border border-border transition-shadow duration-200">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] text-muted-foreground font-medium">{title}</span>
        <div className="w-7 h-7 rounded-md bg-primary/8 flex items-center justify-center">
          <Icon size={14} className="text-primary" />
        </div>
      </div>
      <div className="text-lg font-bold text-foreground">{value}</div>
      {trend && (
        <div className={`text-[10px] mt-0.5 font-medium ${trendUp ? 'text-success' : 'text-destructive'}`}>
          {trend}
        </div>
      )}
    </div>
  );
}
