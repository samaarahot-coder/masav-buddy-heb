import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { DashboardPage } from './DashboardPage';
import { DonorsPage } from './DonorsPage';
import { AuthorizationsPage } from './AuthorizationsPage';
import { CollectionPage } from './CollectionPage';
import { HistoryPage } from './HistoryPage';
import { ReturnsPage } from './ReturnsPage';
import { ImportPage } from './ImportPage';
import { ExportPage } from './ExportPage';
import { BackupPage, RestorePage } from './BackupRestorePage';
import { BanksPage } from './BanksPage';
import { SettingsPage } from './SettingsPage';

const Index = () => {
  const [currentPage, setCurrentPage] = useState('dashboard');

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard': return <DashboardPage onNavigate={setCurrentPage} />;
      case 'donors': return <DonorsPage />;
      case 'authorizations': return <AuthorizationsPage />;
      case 'collection':
      case 'masav': return <CollectionPage />;
      case 'history': return <HistoryPage />;
      case 'returns': return <ReturnsPage />;
      case 'import': return <ImportPage />;
      case 'export': return <ExportPage />;
      case 'backup': return <BackupPage />;
      case 'restore': return <RestorePage />;
      case 'banks': return <BanksPage />;
      case 'settings': return <SettingsPage />;
      default: return <DashboardPage onNavigate={setCurrentPage} />;
    }
  };

  return (
    <AppLayout currentPage={currentPage} onNavigate={setCurrentPage}>
      {renderPage()}
    </AppLayout>
  );
};

export default Index;
