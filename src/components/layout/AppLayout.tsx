import { useState, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { GlobalSearch } from '../GlobalSearch';
import { CreditFooter } from '../CreditFooter';

interface AppLayoutProps {
  children: React.ReactNode;
  currentPage: string;
  onNavigate: (page: string) => void;
}

export function AppLayout({ children, currentPage, onNavigate }: AppLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Load theme and colors from localStorage
  useEffect(() => {
    const theme = localStorage.getItem('trombon-theme');
    if (theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');

    const primaryColor = localStorage.getItem('trombon-primary-color');
    if (primaryColor) {
      document.documentElement.style.setProperty('--user-primary', primaryColor);
    }

    const sidebarColor = localStorage.getItem('trombon-sidebar-color');
    if (sidebarColor) {
      document.documentElement.style.setProperty('--sidebar-bg', sidebarColor);
    }
  }, []);

  return (
    <div className="flex h-screen overflow-hidden" dir="rtl">
      <Sidebar
        currentPage={currentPage}
        onNavigate={onNavigate}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      <main className="flex-1 overflow-auto bg-background">
        {/* Top Bar */}
        <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border/40 px-4 lg:px-6 h-12 flex items-center gap-3">
          <GlobalSearch onNavigate={onNavigate} />
        </div>
        <div className="p-4 lg:p-6 max-w-[1200px] page-fade-in">
          {children}
          <CreditFooter />
        </div>
      </main>
    </div>
  );
}
