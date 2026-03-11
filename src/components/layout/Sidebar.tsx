import {
  LayoutDashboard, Users, FileText, CreditCard,
  History, AlertTriangle, Upload, Download, Database,
  RotateCcw, Building2, Settings, ChevronRight, ChevronLeft,
  FolderOpen, Bell, ClipboardList, BarChart3
} from 'lucide-react';

const menuItems = [
  { id: 'dashboard', label: 'דשבורד', icon: LayoutDashboard, section: 'ראשי' },
  { id: 'donors', label: 'תורמים', icon: Users, section: 'ניהול' },
  { id: 'groups', label: 'קבוצות', icon: FolderOpen, section: 'ניהול' },
  { id: 'authorizations', label: 'הוראות קבע', icon: FileText, section: 'ניהול' },
  { id: 'collection', label: 'יצירת גבייה', icon: CreditCard, section: 'גבייה' },
  { id: 'history', label: 'היסטוריה', icon: History, section: 'גבייה' },
  { id: 'returns', label: 'החזרות', icon: AlertTriangle, section: 'גבייה' },
  { id: 'import', label: 'ייבוא', icon: Upload, section: 'נתונים' },
  { id: 'export', label: 'יצוא', icon: Download, section: 'נתונים' },
  { id: 'reports', label: 'דוחות', icon: BarChart3, section: 'נתונים' },
  { id: 'banks', label: 'בנקים', icon: Building2, section: 'מערכת' },
  { id: 'reminders', label: 'תזכורות', icon: Bell, section: 'מערכת' },
  { id: 'activity', label: 'יומן', icon: ClipboardList, section: 'מערכת' },
  { id: 'backup', label: 'גיבוי/שחזור', icon: Database, section: 'מערכת' },
  { id: 'settings', label: 'הגדרות', icon: Settings, section: 'מערכת' },
];

const sections = ['ראשי', 'ניהול', 'גבייה', 'נתונים', 'מערכת'];

interface SidebarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ currentPage, onNavigate, collapsed, onToggle }: SidebarProps) {
  return (
    <aside className={`sidebar-gradient flex flex-col transition-all duration-200 ${collapsed ? 'w-[56px]' : 'w-[220px]'} flex-shrink-0`}>
      {/* Logo */}
      <div className="flex items-center justify-between px-3 h-14 border-b border-white/[0.06]">
        {!collapsed && (
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-primary/90 flex items-center justify-center">
              <CreditCard size={14} className="text-white" />
            </div>
            <span className="text-[13px] font-bold text-white/90 tracking-tight">מס"ב</span>
          </div>
        )}
        <button
          onClick={onToggle}
          className="p-1 rounded-md hover:bg-white/[0.06] transition-colors text-white/30 hover:text-white/60"
        >
          {collapsed ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2 px-1.5">
        {sections.map((section) => {
          const items = menuItems.filter(m => m.section === section);
          return (
            <div key={section} className="mb-1">
              {!collapsed && (
                <div className="px-2.5 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-white/20">
                  {section}
                </div>
              )}
              {items.map((item) => {
                const Icon = item.icon;
                const isActive = currentPage === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onNavigate(item.id)}
                    className={`w-full flex items-center gap-2 px-2.5 py-[7px] text-[12.5px] rounded-md transition-all duration-100 mb-[1px] ${
                      isActive
                        ? 'bg-primary/15 text-white font-medium'
                        : 'text-white/40 hover:text-white/70 hover:bg-white/[0.04]'
                    } ${collapsed ? 'justify-center px-0' : ''}`}
                    title={collapsed ? item.label : undefined}
                  >
                    <Icon size={15} className={isActive ? 'text-primary' : 'opacity-70'} />
                    {!collapsed && <span>{item.label}</span>}
                  </button>
                );
              })}
            </div>
          );
        })}
      </nav>

      {!collapsed && (
        <div className="px-3 py-2.5 border-t border-white/[0.04] text-[9px] text-white/15 font-medium">
          v2.0
        </div>
      )}
    </aside>
  );
}
