import {
  LayoutDashboard, Users, FileText, CreditCard,
  History, AlertTriangle, Upload, Download,
  Building2, Settings, ChevronRight, ChevronLeft,
  FolderOpen, Bell, ClipboardList, BarChart3, Database,
  Moon, Sun
} from 'lucide-react';
import appLogo from '@/assets/app-logo.ico';
import { useState, useEffect } from 'react';

const menuSections = [
  {
    title: 'ראשי',
    items: [
      { id: 'dashboard', label: 'דשבורד', icon: LayoutDashboard },
      { id: 'donors', label: 'תורמים', icon: Users },
      { id: 'groups', label: 'קבוצות', icon: FolderOpen },
    ],
  },
  {
    title: 'גבייה',
    items: [
      { id: 'authorizations', label: 'הוראות קבע', icon: FileText },
      { id: 'collection', label: 'יצירת גבייה', icon: CreditCard },
      { id: 'history', label: 'אצוות', icon: History },
      { id: 'returns', label: 'החזרות', icon: AlertTriangle },
    ],
  },
  {
    title: 'כלים',
    items: [
      { id: 'reports', label: 'דוחות', icon: BarChart3 },
      { id: 'import', label: 'ייבוא', icon: Upload },
      { id: 'export', label: 'יצוא', icon: Download },
      { id: 'reminders', label: 'תזכורות', icon: Bell },
    ],
  },
  {
    title: 'מערכת',
    items: [
      { id: 'banks', label: 'בנקים', icon: Building2 },
      { id: 'activity', label: 'יומן', icon: ClipboardList },
      { id: 'backup', label: 'גיבוי', icon: Database },
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
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    if (next) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('masav-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('masav-theme', 'light');
    }
  }

  return (
    <aside className={`sidebar-gradient flex flex-col transition-all duration-200 ${collapsed ? 'w-[54px]' : 'w-[210px]'} flex-shrink-0`}>
      {/* Logo */}
      <div className="flex items-center justify-between px-3 h-14 border-b border-white/[0.06]">
        {!collapsed && (
          <div className="flex items-center gap-2.5">
            <img src={appLogo} alt="מערכת מס״ב" className="h-7 w-7 rounded" />
            <div>
              <span className="text-[11px] font-bold text-white/90 block leading-tight">מערכת מס"ב</span>
              <span className="text-[9px] text-white/30">SA מערכות</span>
            </div>
          </div>
        )}
        <button onClick={onToggle} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-white/30 hover:text-white/60 transition-colors">
          {collapsed ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-3">
        {menuSections.map((section) => (
          <div key={section.title}>
            {!collapsed && (
              <p className="text-[9px] uppercase tracking-wider text-white/20 font-semibold px-2 mb-1">
                {section.title}
              </p>
            )}
            {section.items.map((item) => {
              const Icon = item.icon;
              const isActive = currentPage === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-[7px] text-[12px] rounded-lg transition-all duration-100 mb-0.5 ${
                    isActive
                      ? 'bg-primary/20 text-white font-medium shadow-sm shadow-primary/10'
                      : 'text-white/45 hover:text-white/70 hover:bg-white/[0.05]'
                  } ${collapsed ? 'justify-center px-0' : ''}`}
                  title={collapsed ? item.label : undefined}
                >
                  <Icon size={15} className={isActive ? 'text-primary' : 'opacity-50'} />
                  {!collapsed && <span>{item.label}</span>}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Theme Toggle */}
      <div className="px-2 pb-3">
        <button
          onClick={toggleTheme}
          className={`w-full flex items-center gap-2 px-2.5 py-2 text-[11px] rounded-lg text-white/40 hover:text-white/70 hover:bg-white/[0.05] transition-colors ${collapsed ? 'justify-center' : ''}`}
          title={dark ? 'מצב בהיר' : 'מצב כהה'}
        >
          {dark ? <Sun size={14} /> : <Moon size={14} />}
          {!collapsed && <span>{dark ? 'מצב בהיר' : 'מצב כהה'}</span>}
        </button>
      </div>
    </aside>
  );
}
