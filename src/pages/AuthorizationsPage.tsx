import { useEffect, useState } from 'react';
import { db, type Authorization, type Donor, logActivity } from '@/db/database';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

export function AuthorizationsPage() {
  const [auths, setAuths] = useState<(Authorization & { donorName?: string })[]>([]);
  const [tab, setTab] = useState('active');
  const [renewDialogOpen, setRenewDialogOpen] = useState(false);
  const [renewingAuth, setRenewingAuth] = useState<(Authorization & { donorName?: string }) | null>(null);
  const [renewMonths, setRenewMonths] = useState(12);

  useEffect(() => { loadAuths(); }, [tab]);

  async function loadAuths() {
    const statusFilter = tab === 'active' ? ['active', 'frozen'] : ['cancelled', 'expired'];
    const results = await db.authorizations.toArray();
    const filtered = results.filter(a => statusFilter.includes(a.status));
    const donors = await db.donors.toArray();
    const donorMap = new Map(donors.map(d => [d.id, d.fullName]));
    setAuths(filtered.map(a => ({ ...a, donorName: donorMap.get(a.donorId) || 'לא ידוע' })));
  }

  function openRenew(auth: Authorization & { donorName?: string }) {
    setRenewingAuth(auth);
    setRenewMonths(auth.monthCount || 12);
    setRenewDialogOpen(true);
  }

  async function renewAuth() {
    if (!renewingAuth) return;
    const newStart = new Date().toISOString().split('T')[0];
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + renewMonths);

    await db.authorizations.update(renewingAuth.id!, {
      status: 'active',
      startDate: newStart,
      endDate: renewMonths > 0 ? endDate.toISOString().split('T')[0] : '',
      monthCount: renewMonths,
      monthsCollected: 0,
    });

    // Update donor too
    await db.donors.update(renewingAuth.donorId, {
      status: 'active',
      startDate: newStart,
      endDate: renewMonths > 0 ? endDate.toISOString().split('T')[0] : '',
      monthCount: renewMonths,
      monthsCollected: 0,
      updatedAt: new Date().toISOString(),
    });

    await logActivity('חידוש', `חידוש הוראת קבע: ${renewingAuth.donorName}`, 'authorization', renewingAuth.id!, renewingAuth.donorName || '');
    toast.success('ההוראה חודשה בהצלחה');
    setRenewDialogOpen(false);
    loadAuths();
  }

  const statusLabels: Record<string, string> = { active: 'פעיל', frozen: 'מוקפא', cancelled: 'מבוטל', expired: 'פג תוקף' };
  const statusColors: Record<string, string> = { active: 'bg-success/10 text-success', frozen: 'bg-warning/10 text-warning', cancelled: 'bg-destructive/10 text-destructive', expired: 'bg-muted text-muted-foreground' };

  return (
    <div>
      <PageHeader title="הוראות קבע" description={`${auths.length} הוראות`} />

      <Tabs value={tab} onValueChange={setTab} className="mb-4">
        <TabsList>
          <TabsTrigger value="active">פעילות</TabsTrigger>
          <TabsTrigger value="expired">פגי תוקף / מבוטלות</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="bg-muted/30 border-b border-border">
            <th className="text-right p-3 font-medium text-muted-foreground text-xs">תורם</th>
            <th className="text-right p-3 font-medium text-muted-foreground text-xs">סכום</th>
            <th className="text-right p-3 font-medium text-muted-foreground text-xs">יום חיוב</th>
            <th className="text-right p-3 font-medium text-muted-foreground text-xs">חודשים</th>
            <th className="text-right p-3 font-medium text-muted-foreground text-xs">נגבו</th>
            <th className="text-right p-3 font-medium text-muted-foreground text-xs">סטטוס</th>
            {tab === 'expired' && <th className="text-right p-3 font-medium text-muted-foreground text-xs">פעולות</th>}
          </tr></thead>
          <tbody>
            {auths.map(a => (
              <tr key={a.id} className="border-b border-border/50 table-row-hover">
                <td className="p-3 font-medium">{a.donorName}</td>
                <td className="p-3">₪{a.amount.toLocaleString()}</td>
                <td className="p-3">{a.chargeDay}</td>
                <td className="p-3">{a.monthCount || '∞'}</td>
                <td className="p-3">{a.monthsCollected}</td>
                <td className="p-3">
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${statusColors[a.status]}`}>{statusLabels[a.status]}</span>
                </td>
                {tab === 'expired' && (
                  <td className="p-3">
                    <Button size="sm" variant="outline" onClick={() => openRenew(a)} className="gap-1 text-xs h-7">
                      <RefreshCw size={12} /> חידוש
                    </Button>
                  </td>
                )}
              </tr>
            ))}
            {auths.length === 0 && <tr><td colSpan={7} className="p-12 text-center text-muted-foreground">אין הוראות קבע</td></tr>}
          </tbody>
        </table>
      </div>

      <Dialog open={renewDialogOpen} onOpenChange={setRenewDialogOpen}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>חידוש הוראת קבע - {renewingAuth?.donorName}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>כמות חודשים (0 = ללא הגבלה)</Label>
              <Input type="number" min={0} value={renewMonths} onChange={e => setRenewMonths(Number(e.target.value))} />
            </div>
            <p className="text-sm text-muted-foreground">סכום: ₪{renewingAuth?.amount.toLocaleString()} | יום חיוב: {renewingAuth?.chargeDay}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenewDialogOpen(false)}>ביטול</Button>
            <Button onClick={renewAuth}>חדש הוראה</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
