import { useEffect, useState } from 'react';
import { db, type Authorization, type Donor } from '@/db/database';
import { PageHeader } from '@/components/layout/PageHeader';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function AuthorizationsPage() {
  const [auths, setAuths] = useState<(Authorization & { donorName?: string })[]>([]);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => { loadAuths(); }, [filter]);

  async function loadAuths() {
    let query = filter === 'all'
      ? db.authorizations.toArray()
      : db.authorizations.where('status').equals(filter).toArray();
    const results = await query;
    const donors = await db.donors.toArray();
    const donorMap = new Map(donors.map(d => [d.id, d.fullName]));
    setAuths(results.map(a => ({ ...a, donorName: donorMap.get(a.donorId) || 'לא ידוע' })));
  }

  const statusLabels: Record<string, string> = { active: 'פעיל', frozen: 'מוקפא', cancelled: 'מבוטל' };
  const statusColors: Record<string, string> = { active: 'bg-success/10 text-success', frozen: 'bg-warning/10 text-warning', cancelled: 'bg-destructive/10 text-destructive' };

  return (
    <div>
      <PageHeader title="הוראות קבע" description={`${auths.length} הוראות`}
        actions={
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">הכל</SelectItem>
              <SelectItem value="active">פעיל</SelectItem>
              <SelectItem value="frozen">מוקפא</SelectItem>
              <SelectItem value="cancelled">מבוטל</SelectItem>
            </SelectContent>
          </Select>
        }
      />
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="bg-muted/50 border-b border-border">
            <th className="text-right p-3 font-medium text-muted-foreground">תורם</th>
            <th className="text-right p-3 font-medium text-muted-foreground">סכום</th>
            <th className="text-right p-3 font-medium text-muted-foreground">יום חיוב</th>
            <th className="text-right p-3 font-medium text-muted-foreground">תאריך התחלה</th>
            <th className="text-right p-3 font-medium text-muted-foreground">סטטוס</th>
          </tr></thead>
          <tbody>
            {auths.map(a => (
              <tr key={a.id} className="border-b border-border table-row-hover">
                <td className="p-3 font-medium">{a.donorName}</td>
                <td className="p-3">₪{a.amount.toLocaleString()}</td>
                <td className="p-3">{a.chargeDay}</td>
                <td className="p-3">{a.startDate}</td>
                <td className="p-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[a.status]}`}>{statusLabels[a.status]}</span>
                </td>
              </tr>
            ))}
            {auths.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">אין הוראות קבע</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
