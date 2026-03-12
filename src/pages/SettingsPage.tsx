import { useEffect, useState } from 'react';
import { getSettings, saveSettings, type SystemSettings } from '@/db/database';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Palette } from 'lucide-react';

const defaultSettings: Omit<SystemSettings, 'id'> = {
  organizationName: '',
  masvInstitutionNumber: '',
  sendingInstitutionNumber: '',
  creditBankNumber: '',
  creditBranchNumber: '',
  creditAccountNumber: '',
  defaultChargeDay: 15,
};

const colorPresets = [
  { name: 'כחול', value: '217 91% 60%' },
  { name: 'סגול', value: '262 83% 58%' },
  { name: 'ירוק', value: '142 71% 45%' },
  { name: 'כתום', value: '25 95% 53%' },
  { name: 'אדום', value: '0 72% 51%' },
  { name: 'טורקיז', value: '174 72% 42%' },
  { name: 'ורוד', value: '330 81% 60%' },
  { name: 'אינדיגו', value: '239 84% 67%' },
];

export function SettingsPage() {
  const [settings, setSettings] = useState<Omit<SystemSettings, 'id'>>(defaultSettings);
  const [selectedColor, setSelectedColor] = useState(() => localStorage.getItem('masav-primary-color') || '217 91% 60%');

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

  function applyColor(color: string) {
    setSelectedColor(color);
    localStorage.setItem('masav-primary-color', color);
    document.documentElement.style.setProperty('--user-primary', color);
    toast.success('הצבע עודכן');
  }

  function update(field: keyof SystemSettings, value: string | number) {
    setSettings(prev => ({ ...prev, [field]: value }));
  }

  return (
    <div>
      <PageHeader title="הגדרות מערכת" description="הגדרות כלליות ופרטי מוסד" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 max-w-3xl">
        {/* Organization Settings */}
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold mb-4">פרטי מוסד</h3>
          <div className="space-y-3">
            <div><Label className="text-xs">שם העמותה *</Label><Input value={settings.organizationName} onChange={e => update('organizationName', e.target.value)} /></div>
            <div><Label className="text-xs">מספר מוסד מס"ב (עד 8 ספרות) *</Label><Input value={settings.masvInstitutionNumber} onChange={e => update('masvInstitutionNumber', e.target.value)} maxLength={8} /></div>
            <div><Label className="text-xs">מספר מוסד שולח (5 ספרות, אם שונה)</Label><Input value={settings.sendingInstitutionNumber} onChange={e => update('sendingInstitutionNumber', e.target.value)} maxLength={5} /></div>
            <div><Label className="text-xs">יום גבייה ברירת מחדל</Label><Input type="number" min={1} max={28} value={settings.defaultChargeDay} onChange={e => update('defaultChargeDay', Number(e.target.value))} className="w-28" /></div>
          </div>
        </div>

        {/* Bank Account */}
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold mb-4">חשבון בנק לזיכוי</h3>
          <div className="space-y-3">
            <div><Label className="text-xs">מספר בנק</Label><Input value={settings.creditBankNumber} onChange={e => update('creditBankNumber', e.target.value)} /></div>
            <div><Label className="text-xs">מספר סניף</Label><Input value={settings.creditBranchNumber} onChange={e => update('creditBranchNumber', e.target.value)} /></div>
            <div><Label className="text-xs">מספר חשבון</Label><Input value={settings.creditAccountNumber} onChange={e => update('creditAccountNumber', e.target.value)} /></div>
          </div>
          <Button onClick={save} className="mt-4 w-full">שמור הגדרות</Button>
        </div>

        {/* Color Customization */}
        <div className="glass-card p-5 lg:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <Palette size={16} className="text-primary" />
            <h3 className="text-sm font-semibold">צבע מערכת</h3>
          </div>
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
            {colorPresets.map(c => (
              <button
                key={c.value}
                onClick={() => applyColor(c.value)}
                className={`flex flex-col items-center gap-1.5 p-2 rounded-lg transition-all ${selectedColor === c.value ? 'ring-2 ring-primary bg-primary/5' : 'hover:bg-muted/50'}`}
              >
                <div
                  className="w-8 h-8 rounded-full shadow-sm border-2 border-white"
                  style={{ backgroundColor: `hsl(${c.value})` }}
                />
                <span className="text-[10px] text-muted-foreground">{c.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
