import { useEffect, useState } from 'react';
import { getSettings, saveSettings, type SystemSettings } from '@/db/database';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Palette, Save, Moon, Sun, Monitor } from 'lucide-react';

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

const sidebarPresets = [
  { name: 'כהה', value: '222 28% 12%' },
  { name: 'כחול כהה', value: '220 30% 15%' },
  { name: 'אפור כהה', value: '210 15% 18%' },
  { name: 'חום כהה', value: '20 15% 15%' },
  { name: 'ירוק כהה', value: '160 20% 12%' },
  { name: 'סגול כהה', value: '260 25% 14%' },
];

export function SettingsPage() {
  const [settings, setSettings] = useState<Omit<SystemSettings, 'id'>>(defaultSettings);
  const [selectedColor, setSelectedColor] = useState(() => localStorage.getItem('trombon-primary-color') || '217 91% 60%');
  const [selectedSidebarColor, setSelectedSidebarColor] = useState(() => localStorage.getItem('trombon-sidebar-color') || '222 28% 12%');
  const [theme, setTheme] = useState<'light' | 'dark'>(() => 
    document.documentElement.classList.contains('dark') ? 'dark' : 'light'
  );

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
    toast.success('צבע המערכת עודכן');
  }

  function applySidebarColor(color: string) {
    setSelectedSidebarColor(color);
    localStorage.setItem('masav-sidebar-color', color);
    document.documentElement.style.setProperty('--sidebar-bg', color);
    toast.success('צבע התפריט עודכן');
  }

  function applyTheme(t: 'light' | 'dark') {
    setTheme(t);
    if (t === 'dark') {
      document.documentElement.classList.add('dark');
      localStorage.setItem('masav-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('masav-theme', 'light');
    }
    toast.success(t === 'dark' ? 'מצב כהה הופעל' : 'מצב בהיר הופעל');
  }

  function update(field: keyof SystemSettings, value: string | number) {
    setSettings(prev => ({ ...prev, [field]: value }));
  }

  return (
    <div>
      <PageHeader title="הגדרות מערכת" description="הגדרות כלליות, צבעים ופרטי מוסד" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 max-w-4xl">
        {/* Organization Settings */}
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">📋 פרטי מוסד</h3>
          <div className="space-y-3">
            <div><Label className="text-xs">שם העמותה *</Label><Input value={settings.organizationName} onChange={e => update('organizationName', e.target.value)} /></div>
            <div><Label className="text-xs">מספר מוסד מס"ב (עד 8 ספרות) *</Label><Input value={settings.masvInstitutionNumber} onChange={e => update('masvInstitutionNumber', e.target.value)} maxLength={8} /></div>
            <div><Label className="text-xs">מספר מוסד שולח (5 ספרות)</Label><Input value={settings.sendingInstitutionNumber} onChange={e => update('sendingInstitutionNumber', e.target.value)} maxLength={5} /></div>
            <div><Label className="text-xs">יום גבייה ברירת מחדל</Label><Input type="number" min={1} max={28} value={settings.defaultChargeDay} onChange={e => update('defaultChargeDay', Number(e.target.value))} className="w-28" /></div>
          </div>
        </div>

        {/* Bank Account */}
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">🏦 חשבון בנק לזיכוי</h3>
          <div className="space-y-3">
            <div><Label className="text-xs">מספר בנק</Label><Input value={settings.creditBankNumber} onChange={e => update('creditBankNumber', e.target.value)} /></div>
            <div><Label className="text-xs">מספר סניף</Label><Input value={settings.creditBranchNumber} onChange={e => update('creditBranchNumber', e.target.value)} /></div>
            <div><Label className="text-xs">מספר חשבון</Label><Input value={settings.creditAccountNumber} onChange={e => update('creditAccountNumber', e.target.value)} /></div>
          </div>
          <Button onClick={save} className="mt-4 w-full gap-2">
            <Save size={14} /> שמור הגדרות
          </Button>
        </div>

        {/* Theme Toggle */}
        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Monitor size={16} className="text-primary" />
            <h3 className="text-sm font-semibold">מצב תצוגה</h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => applyTheme('light')}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${theme === 'light' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'}`}
            >
              <Sun size={24} className={theme === 'light' ? 'text-primary' : 'text-muted-foreground'} />
              <span className="text-xs font-medium">מצב בהיר</span>
            </button>
            <button
              onClick={() => applyTheme('dark')}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${theme === 'dark' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'}`}
            >
              <Moon size={24} className={theme === 'dark' ? 'text-primary' : 'text-muted-foreground'} />
              <span className="text-xs font-medium">מצב כהה</span>
            </button>
          </div>
        </div>

        {/* Primary Color */}
        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Palette size={16} className="text-primary" />
            <h3 className="text-sm font-semibold">צבע מערכת</h3>
          </div>
          <div className="grid grid-cols-4 gap-3">
            {colorPresets.map(c => (
              <button
                key={c.value}
                onClick={() => applyColor(c.value)}
                className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl transition-all ${selectedColor === c.value ? 'ring-2 ring-primary bg-primary/5 scale-105' : 'hover:bg-muted/50 hover:scale-105'}`}
              >
                <div
                  className="w-10 h-10 rounded-full shadow-md border-2 border-white dark:border-gray-700"
                  style={{ backgroundColor: `hsl(${c.value})` }}
                />
                <span className="text-[10px] font-medium text-muted-foreground">{c.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Sidebar Color */}
        <div className="glass-card p-5 lg:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <Palette size={16} className="text-primary" />
            <h3 className="text-sm font-semibold">צבע תפריט צד</h3>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            {sidebarPresets.map(c => (
              <button
                key={c.value}
                onClick={() => applySidebarColor(c.value)}
                className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl transition-all ${selectedSidebarColor === c.value ? 'ring-2 ring-primary bg-primary/5 scale-105' : 'hover:bg-muted/50 hover:scale-105'}`}
              >
                <div
                  className="w-12 h-8 rounded-lg shadow-md border border-white/20"
                  style={{ backgroundColor: `hsl(${c.value})` }}
                />
                <span className="text-[10px] font-medium text-muted-foreground">{c.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
