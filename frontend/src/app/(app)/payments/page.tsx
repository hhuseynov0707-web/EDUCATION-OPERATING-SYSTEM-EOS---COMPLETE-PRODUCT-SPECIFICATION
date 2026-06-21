'use client';

import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
  student: { firstName: string; lastName: string };
}
interface Paged {
  data: PaymentRow[];
  meta: { page: number; total: number; totalPages: number };
}

const tone: Record<string, 'green' | 'amber' | 'red' | 'gray'> = {
  PAID: 'green',
  PARTIAL: 'amber',
  PENDING: 'gray',
  OVERDUE: 'red',
};

export default function PaymentsPage() {
  const now = new Date();
  const [year] = useState(now.getUTCFullYear());
  const [month] = useState(now.getUTCMonth() + 1);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [result, setResult] = useState<Paged | null>(null);

  const [recording, setRecording] = useState<PaymentRow | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [savingPay, setSavingPay] = useState(false);

  const load = useCallback(() => {
    api.get<Summary>(`/payments/summary?year=${year}&month=${month}`).then(setSummary).catch(() => undefined);
    const params = new URLSearchParams({ limit: '100', periodYear: String(year), periodMonth: String(month) });
    if (statusFilter) params.set('status', statusFilter);
    api.get<Paged>(`/payments?${params}`).then(setResult).catch(() => undefined);
  }, [year, month, statusFilter]);

  useEffect(load, [load]);

  async function generate() {
    await api.post('/payments/generate-monthly', { periodYear: year, periodMonth: month }).catch(() => undefined);
    load();
  }

  function openRecord(p: PaymentRow) {
    setRecording(p);
    // Prefill with what's already paid (so a mistaken PAID can be corrected),
    // otherwise default to the full amount due.
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

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Payments</h1>
        <Button variant="outline" size="sm" onClick={generate}>
          Generate this month&apos;s invoices
        </Button>
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

      <div className="flex gap-2">
        {['', 'OVERDUE', 'PENDING', 'PARTIAL', 'PAID'].map((s) => (
          <button
            key={s || 'all'}
            onClick={() => setStatusFilter(s)}
            className={`rounded-md border border-border px-3 py-1 text-sm ${statusFilter === s ? 'bg-primary text-primary-foreground' : 'bg-white hover:bg-muted'}`}
          >
            {s || 'All'}
          </button>
        ))}
      </div>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2">Student</th>
              <th className="px-4 py-2">Period</th>
              <th className="px-4 py-2">Due</th>
              <th className="px-4 py-2">Paid</th>
              <th className="px-4 py-2">Due date</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {result?.data.map((p) => (
              <tr key={p.id} className="border-t border-border hover:bg-muted/50">
                <td className="px-4 py-2 font-medium">{p.student.firstName} {p.student.lastName}</td>
                <td className="px-4 py-2 text-muted-foreground">{p.periodMonth}/{p.periodYear}</td>
                <td className="px-4 py-2">{formatMoney(p.amountDue)}</td>
                <td className="px-4 py-2">{formatMoney(p.amountPaid)}</td>
                <td className="px-4 py-2 text-muted-foreground">{formatDate(p.dueDate)}</td>
                <td className="px-4 py-2"><Badge tone={tone[p.status] ?? 'gray'}>{p.status}</Badge></td>
                <td className="px-4 py-2 text-right">
                  <Button variant="outline" size="sm" onClick={() => openRecord(p)}>
                    {p.status === 'PAID' ? 'Edit' : 'Record payment'}
                  </Button>
                </td>
              </tr>
            ))}
            {result && result.data.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">No invoices for this period.</td></tr>
            )}
          </tbody>
        </table>
      </Card>

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
