import { db } from '@/db/database';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Database, Upload } from 'lucide-react';

export function BackupPage() {
  async function createBackup() {
    const backup = {
      version: 2,
      date: new Date().toISOString(),
      donors: await db.donors.toArray(),
      authorizations: await db.authorizations.toArray(),
      collections: await db.collections.toArray(),
      collectionItems: await db.collectionItems.toArray(),
      failedDebits: await db.failedDebits.toArray(),
      banks: await db.banks.toArray(),
      branches: await db.branches.toArray(),
      settings: await db.settings.toArray(),
      donorGroups: await db.donorGroups.toArray(),
      activityLog: await db.activityLog.toArray(),
      reminders: await db.reminders.toArray(),
    };

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `masav_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('גיבוי נוצר בהצלחה');
  }

  return (
    <div>
      <PageHeader title="גיבוי מערכת" description="יצירת גיבוי מלא של כל הנתונים" />
      <div className="bg-card rounded-xl border border-border/50 p-8 text-center max-w-md mx-auto">
        <Database size={48} className="mx-auto mb-4 text-primary opacity-60" />
        <h2 className="text-lg font-semibold mb-2">גיבוי מלא</h2>
        <p className="text-sm text-muted-foreground mb-6">
          כולל: תורמים, הוראות, גביות, החזרות, בנקים, קבוצות, תזכורות והגדרות
        </p>
        <Button onClick={createBackup} size="lg" className="gap-2">
          <Database size={18} /> צור גיבוי
        </Button>
      </div>
    </div>
  );
}

export function RestorePage() {
  async function handleRestore(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!confirm('שחזור יחליף את כל הנתונים הקיימים. להמשיך?')) return;

    const text = await file.text();
    try {
      const backup = JSON.parse(text);
      if (!backup.version || !backup.donors) { toast.error('קובץ גיבוי לא תקין'); return; }

      // Clear all tables
      await Promise.all([
        db.donors.clear(), db.authorizations.clear(), db.collections.clear(),
        db.collectionItems.clear(), db.failedDebits.clear(), db.banks.clear(),
        db.branches.clear(), db.settings.clear(), db.donorGroups.clear(),
        db.activityLog.clear(), db.reminders.clear(),
      ]);

      // Restore
      if (backup.donors?.length) await db.donors.bulkAdd(backup.donors);
      if (backup.authorizations?.length) await db.authorizations.bulkAdd(backup.authorizations);
      if (backup.collections?.length) await db.collections.bulkAdd(backup.collections);
      if (backup.collectionItems?.length) await db.collectionItems.bulkAdd(backup.collectionItems);
      if (backup.failedDebits?.length) await db.failedDebits.bulkAdd(backup.failedDebits);
      if (backup.banks?.length) await db.banks.bulkAdd(backup.banks);
      if (backup.branches?.length) await db.branches.bulkAdd(backup.branches);
      if (backup.settings?.length) await db.settings.bulkAdd(backup.settings);
      if (backup.donorGroups?.length) await db.donorGroups.bulkAdd(backup.donorGroups);
      if (backup.activityLog?.length) await db.activityLog.bulkAdd(backup.activityLog);
      if (backup.reminders?.length) await db.reminders.bulkAdd(backup.reminders);

      toast.success('השחזור הושלם בהצלחה');
    } catch {
      toast.error('שגיאה בשחזור הגיבוי');
    }
  }

  return (
    <div>
      <PageHeader title="שחזור מערכת" description="שחזור נתונים מקובץ גיבוי" />
      <div className="bg-card rounded-xl border border-border/50 p-8 text-center max-w-md mx-auto">
        <Upload size={48} className="mx-auto mb-4 text-warning opacity-60" />
        <h2 className="text-lg font-semibold mb-2">שחזור מגיבוי</h2>
        <p className="text-sm text-muted-foreground mb-6">שים לב: השחזור יחליף את כל הנתונים הקיימים</p>
        <label className="cursor-pointer">
          <Input type="file" accept=".json" onChange={handleRestore} className="hidden" />
          <div className="inline-flex items-center gap-2 px-6 py-3 bg-warning text-white rounded-lg hover:bg-warning/90 transition-colors font-medium">
            <Upload size={18} /> בחר קובץ גיבוי
          </div>
        </label>
      </div>
    </div>
  );
}
