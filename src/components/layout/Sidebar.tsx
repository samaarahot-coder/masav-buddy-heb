import {
  LayoutDashboard, Users, FileText, CreditCard, FileDown,
  History, AlertTriangle, Upload, Download, Database,
  RotateCcw, Building2, Settings, ChevronRight, ChevronLeft
} from 'lucide-react';

const menuItems = [
  { id: 'dashboard', label: 'דשבורד', icon: LayoutDashboard },
  { id: 'donors', label: 'תורמים', icon: Users },
  { id: 'authorizations', label: 'הוראות קבע', icon: FileText },
  { id: 'collection', label: 'גבייה', icon: CreditCard },
  { id: 'masav', label: 'יצירת קובץ מס"ב', icon: FileDown },
  { id: 'history', label: 'היסטוריית גבייה', icon: History },
  { id: 'returns', label: 'החזרות חיוב', icon: AlertTriangle },
  { id: 'import', label: 'ייבוא אקסל', icon: Upload },
  { id: 'export', label: 'יצוא נתונים', icon: Download },
  { id: 'backup', label: 'גיבוי', icon: Database },
  { id: 'restore', label: 'שחזור', icon: RotateCcw },
  { id: 'banks', label: 'בנקים וסניפים', icon: Building2 },
  { id: 'settings', label: 'הגדרות מערכת', icon: Settings },
];

interface SidebarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ currentPage, onNavigate, collapsed, onToggle }: SidebarProps) {
  return (
    <aside className={`sidebar-gradient text-sidebar-fg flex flex-col transition-all duration-300 ${collapsed ? 'w-16' : 'w-60'} flex-shrink-0`}>
      <div className="flex items-center justify-between p-4 border-b border-sidebar-hover">
        {!collapsed && (
          <h1 className="text-lg font-bold text-primary-foreground tracking-tight">
            ניהול מס"ב
          </h1>
        )}
        <button
          onClick={onToggle}
          className="p-1.5 rounded-md hover:bg-sidebar-hover transition-colors text-sidebar-fg"
        >
          {collapsed ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto py-2">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                isActive
                  ? 'bg-sidebar-active/20 text-primary-foreground border-l-3 border-sidebar-active'
                  : 'hover:bg-sidebar-hover text-sidebar-fg'
              } ${collapsed ? 'justify-center px-0' : ''}`}
              title={collapsed ? item.label : undefined}
            >
              <Icon size={18} className={isActive ? 'text-sidebar-active' : ''} />
              {!collapsed && <span>{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {!collapsed && (
        <div className="p-4 border-t border-sidebar-hover text-xs text-sidebar-fg/50">
          מערכת ניהול מס"ב v1.0
        </div>
      )}
    </aside>
  );
}
