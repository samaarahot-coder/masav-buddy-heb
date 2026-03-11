import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { DashboardPage } from './DashboardPage';
import { DonorsPage } from './DonorsPage';
import { GroupsPage } from './GroupsPage';
import { AuthorizationsPage } from './AuthorizationsPage';
import { CollectionPage } from './CollectionPage';
import { HistoryPage } from './HistoryPage';
import { ReturnsPage } from './ReturnsPage';
import { ImportPage } from './ImportPage';
import { ExportPage } from './ExportPage';
import { ReportsPage } from './ReportsPage';
import { BackupPage, RestorePage } from './BackupRestorePage';
import { BanksPage } from './BanksPage';
import { SettingsPage } from './SettingsPage';
import { RemindersPage } from './RemindersPage';
import { ActivityPage } from './ActivityPage';
import { initializeBanks } from '@/db/database';

const Index = () => {
  const [currentPage, setCurrentPage] = useState('dashboard');

  useEffect(() => {
    initializeBanks();
  }, []);

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard': return <DashboardPage onNavigate={setCurrentPage} />;
      case 'donors': return <DonorsPage />;
      case 'groups': return <GroupsPage />;
      case 'authorizations': return <AuthorizationsPage />;
      case 'collection': return <CollectionPage />;
      case 'history': return <HistoryPage />;
      case 'returns': return <ReturnsPage />;
      case 'import': return <ImportPage />;
      case 'export': return <ExportPage />;
      case 'reports': return <ReportsPage />;
      case 'backup': return <BackupPage />;
      case 'restore': return <RestorePage />;
      case 'banks': return <BanksPage />;
      case 'settings': return <SettingsPage />;
      case 'reminders': return <RemindersPage />;
      case 'activity': return <ActivityPage />;
      default: return <DashboardPage onNavigate={setCurrentPage} />;
    }
  };

  return (
    <AppLayout currentPage={currentPage} onNavigate={setCurrentPage}>
      <div className="page-fade-in">
        {renderPage()}
      </div>
    </AppLayout>
  );
};

export default Index;
