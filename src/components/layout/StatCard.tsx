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
    <div className="glass-card p-3.5 group hover:shadow-md transition-all duration-200">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] text-muted-foreground font-medium">{title}</span>
        <div className="w-7 h-7 rounded-lg bg-primary/8 flex items-center justify-center group-hover:bg-primary/12 transition-colors">
          <Icon size={14} className="text-primary/70" />
        </div>
      </div>
      <p className="text-xl font-bold text-foreground">{value}</p>
    </div>
  );
}
