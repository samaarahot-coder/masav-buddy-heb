import { useState, useEffect, useRef, useMemo } from 'react';
import { Search, Users, CreditCard, FileText, Settings, Bell, History, BarChart3 } from 'lucide-react';
import { db, type Donor } from '@/db/database';

interface GlobalSearchProps {
  onNavigate: (page: string) => void;
}

const pages = [
  { id: 'dashboard', label: 'דשבורד', icon: BarChart3, keywords: ['ראשי', 'סקירה', 'dashboard'] },
  { id: 'donors', label: 'תורמים', icon: Users, keywords: ['תורם', 'לקוח', 'donors'] },
  { id: 'collection', label: 'יצירת גבייה', icon: CreditCard, keywords: ['גבייה', 'מסב', 'collection'] },
  { id: 'history', label: 'היסטוריית גבייה', icon: History, keywords: ['אצוות', 'history'] },
  { id: 'authorizations', label: 'הוראות קבע', icon: FileText, keywords: ['הוראה', 'authorization'] },
  { id: 'reports', label: 'דוחות', icon: BarChart3, keywords: ['דוח', 'report', 'סטטיסטיקה'] },
  { id: 'reminders', label: 'תזכורות', icon: Bell, keywords: ['תזכורת', 'reminder'] },
  { id: 'settings', label: 'הגדרות', icon: Settings, keywords: ['הגדרה', 'settings'] },
];

export function GlobalSearch({ onNavigate }: GlobalSearchProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [donors, setDonors] = useState<Donor[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (query.length >= 2) {
      db.donors.toArray().then(setDonors);
    }
  }, [query]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const results = useMemo(() => {
    if (!query.trim()) return { pages: [], donors: [] };
    const q = query.toLowerCase();
    const matchedPages = pages.filter(p => p.label.includes(q) || p.keywords.some(k => k.includes(q)));
    const matchedDonors = donors.filter(d => d.fullName.includes(query) || d.idNumber.includes(query) || d.phone.includes(query)).slice(0, 5);
    return { pages: matchedPages, donors: matchedDonors };
  }, [query, donors]);

  const hasResults = results.pages.length > 0 || results.donors.length > 0;

  return (
    <div className="relative flex-1 max-w-md" ref={ref}>
      <div className="relative">
        <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
        <input
          type="text"
          placeholder="חיפוש מהיר..."
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => query && setOpen(true)}
          className="w-full h-8 pr-9 pl-3 text-xs bg-muted/50 border border-border/40 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary/40 placeholder:text-muted-foreground/40 transition-all"
        />
      </div>

      {open && query && hasResults && (
        <div className="absolute top-full right-0 left-0 mt-1 bg-popover border border-border/60 rounded-xl shadow-lg overflow-hidden z-50">
          {results.pages.length > 0 && (
            <div className="p-1.5">
              <p className="text-[10px] text-muted-foreground px-2 py-1">עמודים</p>
              {results.pages.map(p => (
                <button
                  key={p.id}
                  onClick={() => { onNavigate(p.id); setOpen(false); setQuery(''); }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-lg hover:bg-muted/60 transition-colors text-right"
                >
                  <p.icon size={13} className="text-primary/70" />
                  <span>{p.label}</span>
                </button>
              ))}
            </div>
          )}
          {results.donors.length > 0 && (
            <div className="p-1.5 border-t border-border/30">
              <p className="text-[10px] text-muted-foreground px-2 py-1">תורמים</p>
              {results.donors.map(d => (
                <button
                  key={d.id}
                  onClick={() => { onNavigate('donors'); setOpen(false); setQuery(''); }}
                  className="w-full flex items-center justify-between px-2.5 py-1.5 text-xs rounded-lg hover:bg-muted/60 transition-colors text-right"
                >
                  <div className="flex items-center gap-2">
                    <Users size={12} className="text-muted-foreground/60" />
                    <span>{d.fullName}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">₪{d.monthlyAmount}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
