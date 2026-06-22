'use client';

import { ChevronLeft, Search } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { api } from '@/lib/api';
import { formatDate, formatMoney } from '@/lib/utils';

interface Summary {
  expectedRevenue: number;
  collectedRevenue: number;
  overdueRevenue: number;
  collectionRate: number | null;
  invoiceCounts: Record<string, number>;
}
interface PaymentRow {
  id: string;
  periodYear: number;
  periodMonth: number;
  amountDue: string;
  amountPaid: string;
  status: string;
  dueDate: string;
  student: { id: string | null; firstName: string; lastName: string };
  group: { id: string; name: string } | null;
}
interface Paged { data: PaymentRow[]; meta: { page: number; total: number; totalPages: number } }

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const tone: Record<string, 'green' | 'amber' | 'red' | 'gray'> = {
  PAID: 'green', PARTIAL: 'amber', PENDING: 'gray', OVERDUE: 'red',
};

export default function PaymentsPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getUTCFullYear());
  const [month, setMonth] = useState(now.getUTCMonth() + 1);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const [recording, setRecording] = useState<PaymentRow | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [savingPay, setSavingPay] = useState(false);

  const load = useCallback(() => {
    api.get<Summary>(`/payments/summary?year=${year}&month=${month}`).then(setSummary).catch(() => undefined);
    api.get<Paged>(`/payments?limit=1000&periodYear=${year}&periodMonth=${month}`)
      .then((r) => setRows(r.data)).catch(() => undefined);
  }, [year, month]);
  useEffect(load, [load]);
  // Switching the period returns to the group list.
  useEffect(() => { setSelectedGroup(null); }, [year, month]);

  async function generate() {
    await api.post('/payments/generate-monthly', { periodYear: year, periodMonth: month }).catch(() => undefined);
    load();
  }

  // Group invoices by their group for the drill-down view.
  const groups = useMemo(() => {
    const map = new Map<string, { id: string; name: string; rows: PaymentRow[] }>();
    for (const p of rows) {
      const id = p.group?.id ?? 'none';
      if (!map.has(id)) map.set(id, { id, name: p.group?.name ?? 'No group', rows: [] });
      map.get(id)!.rows.push(p);
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [rows]);

  const query = search.trim().toLowerCase();
  const searchResults = useMemo(() => {
    if (!query) return [];
    return rows.filter((p) => `${p.student.firstName} ${p.student.lastName}`.toLowerCase().includes(query));
  }, [rows, query]);

  const activeGroup = groups.find((g) => g.id === selectedGroup) ?? null;

  function openRecord(p: PaymentRow) {
    setRecording(p);
    setPayAmount(String(Number(p.amountPaid) > 0 ? Number(p.amountPaid) : Number(p.amountDue)));
  }
  async function savePay() {
    if (!recording) return;
    setSavingPay(true);
    try {
      await api.patch(`/payments/${recording.id}/record`, { amountPaid: Number(payAmount) || 0 });
      setRecording(null);
      load();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Could not record payment.');
    } finally {
      setSavingPay(false);
    }
  }
  async function quickMark(p: PaymentRow, paid: boolean) {
    await api.patch(`/payments/${p.id}/record`, { amountPaid: paid ? Number(p.amountDue) : 0 }).catch(() => undefined);
    load();
  }

  const years = [now.getUTCFullYear() - 1, now.getUTCFullYear(), now.getUTCFullYear() + 1];

  function StudentTable({ list, showGroup }: { list: PaymentRow[]; showGroup?: boolean }) {
    return (
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2">Student</th>
              {showGroup && <th className="px-4 py-2">Group</th>}
              <th className="px-4 py-2">Due</th>
              <th className="px-4 py-2">Paid</th>
              <th className="px-4 py-2">Due date</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.id} className="border-t border-border hover:bg-muted/50">
                <td className="px-4 py-2 font-medium">{p.student.firstName} {p.student.lastName}</td>
                {showGroup && <td className="px-4 py-2 text-muted-foreground">{p.group?.name ?? '—'}</td>}
                <td className="px-4 py-2">{formatMoney(p.amountDue)}</td>
                <td className="px-4 py-2">{formatMoney(p.amountPaid)}</td>
                <td className="px-4 py-2 text-muted-foreground">{formatDate(p.dueDate)}</td>
                <td className="px-4 py-2"><Badge tone={tone[p.status] ?? 'gray'}>{p.status}</Badge></td>
                <td className="px-4 py-2">
                  <div className="flex justify-end gap-2">
                    {p.status === 'PAID'
                      ? <Button variant="outline" size="sm" onClick={() => quickMark(p, false)}>Unmark</Button>
                      : <Button size="sm" onClick={() => quickMark(p, true)}>Mark paid</Button>}
                    <Button variant="outline" size="sm" onClick={() => openRecord(p)}>Edit</Button>
                  </div>
                </td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr><td colSpan={showGroup ? 7 : 6} className="px-4 py-6 text-center text-muted-foreground">No invoices.</td></tr>
            )}
          </tbody>
        </table>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Payments</h1>
        <div className="flex items-center gap-2">
          <Select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </Select>
          <Select value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </Select>
          <Button variant="outline" size="sm" onClick={generate}>Generate invoices</Button>
        </div>
      </div>

      {summary && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Card>
            <CardHeader><CardTitle>Expected</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-semibold">{formatMoney(summary.expectedRevenue)}</div></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Collected</CardTitle></CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{formatMoney(summary.collectedRevenue)}</div>
              <div className="mt-1 text-xs text-muted-foreground">{summary.collectionRate ?? 0}% collection rate</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Overdue</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-semibold text-red-600">{formatMoney(summary.overdueRevenue)}</div></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Invoices</CardTitle></CardHeader>
            <CardContent>
              <div className="text-xs text-muted-foreground">
                {Object.entries(summary.invoiceCounts).map(([k, v]) => (
                  <span key={k} className="mr-2">{k}: {v}</span>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Search by student name — works across all groups. */}
      <div className="relative max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search student by name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {query ? (
        <>
          <p className="text-sm text-muted-foreground">{searchResults.length} result(s) for “{search}”.</p>
          <StudentTable list={searchResults} showGroup />
        </>
      ) : activeGroup ? (
        <>
          <button
            onClick={() => setSelectedGroup(null)}
            className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft size={16} /> All groups
          </button>
          <h2 className="text-lg font-semibold">{activeGroup.name}</h2>
          <StudentTable list={activeGroup.rows} />
        </>
      ) : groups.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
          No invoices for {MONTHS[month - 1]} {year}. Click <strong>Generate invoices</strong> to create them from each group&apos;s enrolled students.
        </CardContent></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((g) => {
            const paid = g.rows.filter((r) => r.status === 'PAID').length;
            const collected = g.rows.reduce((s, r) => s + Number(r.amountPaid), 0);
            const expected = g.rows.reduce((s, r) => s + Number(r.amountDue), 0);
            const allPaid = paid === g.rows.length;
            return (
              <button key={g.id} onClick={() => setSelectedGroup(g.id)} className="text-left">
                <Card className="h-full transition-colors hover:border-primary">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between gap-2">
                      <span>{g.name}</span>
                      <Badge tone={allPaid ? 'green' : 'amber'}>{paid}/{g.rows.length} paid</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm">{formatMoney(collected)} <span className="text-muted-foreground">/ {formatMoney(expected)} collected</span></div>
                    <div className="mt-1 text-xs text-muted-foreground">{g.rows.length} student{g.rows.length === 1 ? '' : 's'} · tap to open</div>
                  </CardContent>
                </Card>
              </button>
            );
          })}
        </div>
      )}

      {recording && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setRecording(null)}>
          <Card className="w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <CardHeader><CardTitle>Record payment</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {recording.student.firstName} {recording.student.lastName} · {recording.periodMonth}/{recording.periodYear}
                <br />Invoice: {formatMoney(recording.amountDue)} · already paid {formatMoney(recording.amountPaid)}
              </p>
              <div>
                <label className="mb-1 block text-sm font-medium">Total amount paid</label>
                <Input type="number" min={0} value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
                <p className="mt-1 text-xs text-muted-foreground">Status updates automatically (PAID / PARTIAL).</p>
              </div>
              <div className="flex gap-2">
                <Button onClick={savePay} disabled={savingPay}>{savingPay ? 'Saving…' : 'Save'}</Button>
                <Button variant="outline" onClick={() => setRecording(null)}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
