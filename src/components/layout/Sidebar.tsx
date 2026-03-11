import {
  LayoutDashboard, Users, FileText, CreditCard,
  History, AlertTriangle, Upload, Download, Database,
  RotateCcw, Building2, Settings, ChevronRight, ChevronLeft,
  FolderOpen, Bell, ClipboardList, BarChart3
} from 'lucide-react';

const menuSections = [
  {
    title: 'ראשי',
    items: [
      { id: 'dashboard', label: 'דשבורד', icon: LayoutDashboard },
    ],
  },
  {
    title: 'ניהול',
    items: [
      { id: 'donors', label: 'תורמים', icon: Users },
      { id: 'groups', label: 'קבוצות', icon: FolderOpen },
      { id: 'authorizations', label: 'הוראות קבע', icon: FileText },
    ],
  },
  {
    title: 'גבייה',
    items: [
      { id: 'collection', label: 'יצירת גבייה', icon: CreditCard },
      { id: 'history', label: 'היסטוריית גבייה', icon: History },
      { id: 'returns', label: 'החזרות חיוב', icon: AlertTriangle },
    ],
  },
  {
    title: 'נתונים',
    items: [
      { id: 'import', label: 'ייבוא אקסל', icon: Upload },
      { id: 'export', label: 'יצוא ודוחות', icon: Download },
      { id: 'reports', label: 'דוחות', icon: BarChart3 },
    ],
  },
  {
    title: 'מערכת',
    items: [
      { id: 'banks', label: 'בנקים וסניפים', icon: Building2 },
      { id: 'reminders', label: 'תזכורות', icon: Bell },
      { id: 'activity', label: 'יומן פעולות', icon: ClipboardList },
      { id: 'backup', label: 'גיבוי', icon: Database },
      { id: 'restore', label: 'שחזור', icon: RotateCcw },
      { id: 'settings', label: 'הגדרות', icon: Settings },
    ],
  },
];

interface SidebarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ currentPage, onNavigate, collapsed, onToggle }: SidebarProps) {
  return (
    <aside className={`sidebar-gradient flex flex-col transition-all duration-300 ${collapsed ? 'w-[60px]' : 'w-[240px]'} flex-shrink-0`}>
      {/* Logo */}
      <div className="flex items-center justify-between px-4 h-16 border-b border-white/5">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <CreditCard size={16} className="text-primary-foreground" />
            </div>
            <span className="text-sm font-bold text-white tracking-tight">מערכת מס"ב</span>
          </div>
        )}
        <button
          onClick={onToggle}
          className="p-1.5 rounded-lg hover:bg-white/5 transition-colors text-white/50 hover:text-white/80"
        >
          {collapsed ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
        {menuSections.map((section) => (
          <div key={section.title}>
            {!collapsed && (
              <div className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/25">
                {section.title}
              </div>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = currentPage === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onNavigate(item.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-[13px] rounded-lg transition-all duration-150 ${
                      isActive
                        ? 'bg-primary/20 text-white shadow-sm'
                        : 'text-white/50 hover:text-white/80 hover:bg-white/5'
                    } ${collapsed ? 'justify-center px-2' : ''}`}
                    title={collapsed ? item.label : undefined}
                  >
                    <Icon size={17} className={isActive ? 'text-primary' : ''} />
                    {!collapsed && <span>{item.label}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {!collapsed && (
        <div className="px-4 py-3 border-t border-white/5 text-[10px] text-white/20">
          מערכת מס"ב v2.0
        </div>
      )}
    </aside>
  );
}
