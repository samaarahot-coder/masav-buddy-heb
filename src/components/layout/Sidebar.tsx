import {
  LayoutDashboard, Users, FileText, CreditCard,
  History, AlertTriangle, Upload, Download,
  Building2, Settings, ChevronRight, ChevronLeft,
  FolderOpen, Bell, ClipboardList, BarChart3, Database
} from 'lucide-react';

const menuItems = [
  { id: 'dashboard', label: 'דשבורד', icon: LayoutDashboard },
  { id: 'donors', label: 'תורמים', icon: Users },
  { id: 'groups', label: 'קבוצות', icon: FolderOpen },
  { id: 'authorizations', label: 'הוראות קבע', icon: FileText },
  { id: 'collection', label: 'גבייה', icon: CreditCard },
  { id: 'history', label: 'היסטוריה', icon: History },
  { id: 'returns', label: 'החזרות', icon: AlertTriangle },
  { id: 'reports', label: 'דוחות', icon: BarChart3 },
  { id: 'import', label: 'ייבוא', icon: Upload },
  { id: 'export', label: 'יצוא', icon: Download },
  { id: 'banks', label: 'בנקים', icon: Building2 },
  { id: 'reminders', label: 'תזכורות', icon: Bell },
  { id: 'activity', label: 'יומן', icon: ClipboardList },
  { id: 'backup', label: 'גיבוי', icon: Database },
  { id: 'settings', label: 'הגדרות', icon: Settings },
];

interface SidebarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ currentPage, onNavigate, collapsed, onToggle }: SidebarProps) {
  return (
    <aside className={`sidebar-gradient flex flex-col transition-all duration-200 ${collapsed ? 'w-[52px]' : 'w-[200px]'} flex-shrink-0`}>
      <div className="flex items-center justify-between px-3 h-12 border-b border-white/[0.06]">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-primary flex items-center justify-center">
              <CreditCard size={12} className="text-primary-foreground" />
            </div>
            <span className="text-xs font-bold text-white/90">מס"ב</span>
          </div>
        )}
        <button onClick={onToggle} className="p-1 rounded hover:bg-white/[0.06] text-white/30 hover:text-white/60">
          {collapsed ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto py-1.5 px-1.5">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center gap-2 px-2 py-[6px] text-[12px] rounded transition-all duration-75 mb-px ${
                isActive
                  ? 'bg-primary/15 text-white font-medium'
                  : 'text-white/40 hover:text-white/65 hover:bg-white/[0.04]'
              } ${collapsed ? 'justify-center px-0' : ''}`}
              title={collapsed ? item.label : undefined}
            >
              <Icon size={14} className={isActive ? 'text-primary' : 'opacity-60'} />
              {!collapsed && <span>{item.label}</span>}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
