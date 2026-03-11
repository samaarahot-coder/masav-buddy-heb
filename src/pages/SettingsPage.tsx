import { useEffect, useState } from 'react';
import { getSettings, saveSettings, type SystemSettings } from '@/db/database';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

const defaultSettings: Omit<SystemSettings, 'id'> = {
  organizationName: '',
  masvInstitutionNumber: '',
  creditBankNumber: '',
  creditBranchNumber: '',
  creditAccountNumber: '',
  defaultChargeDay: 15,
};

export function SettingsPage() {
  const [settings, setSettings] = useState<Omit<SystemSettings, 'id'>>(defaultSettings);

  useEffect(() => {
    getSettings().then(s => { if (s) setSettings(s); });
  }, []);

  async function save() {
    if (!settings.organizationName || !settings.masvInstitutionNumber) {
      toast.error('שם העמותה ומספר מוסד מס"ב הם שדות חובה');
      return;
    }
    await saveSettings(settings);
    toast.success('ההגדרות נשמרו בהצלחה');
  }

  function update(field: keyof SystemSettings, value: string | number) {
    setSettings(prev => ({ ...prev, [field]: value }));
  }

  return (
    <div>
      <PageHeader title="הגדרות מערכת" description="הגדרות כלליות של המערכת" />
      <div className="bg-card rounded-lg border border-border p-6 max-w-xl">
        <div className="space-y-5">
          <div>
            <Label>שם העמותה *</Label>
            <Input value={settings.organizationName} onChange={e => update('organizationName', e.target.value)} />
          </div>
          <div>
            <Label>מספר מוסד מס"ב *</Label>
            <Input value={settings.masvInstitutionNumber} onChange={e => update('masvInstitutionNumber', e.target.value)} />
          </div>
          <div className="border-t border-border pt-5 mt-5">
            <h3 className="font-semibold text-sm mb-4">חשבון בנק לזיכוי</h3>
            <div className="grid grid-cols-3 gap-4">
              <div><Label>מספר בנק</Label><Input value={settings.creditBankNumber} onChange={e => update('creditBankNumber', e.target.value)} /></div>
              <div><Label>מספר סניף</Label><Input value={settings.creditBranchNumber} onChange={e => update('creditBranchNumber', e.target.value)} /></div>
              <div><Label>מספר חשבון</Label><Input value={settings.creditAccountNumber} onChange={e => update('creditAccountNumber', e.target.value)} /></div>
            </div>
          </div>
          <div>
            <Label>יום גבייה ברירת מחדל</Label>
            <Input type="number" min={1} max={28} value={settings.defaultChargeDay} onChange={e => update('defaultChargeDay', Number(e.target.value))} className="w-24" />
          </div>
          <Button onClick={save}>שמור הגדרות</Button>
        </div>
      </div>
    </div>
  );
}
