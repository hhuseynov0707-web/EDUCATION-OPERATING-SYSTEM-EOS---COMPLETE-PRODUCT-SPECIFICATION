'use client';

import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

  const load = useCallback(() => {
    api.get<Summary>(`/payments/summary?year=${year}&month=${month}`).then(setSummary).catch(() => undefined);
    const params = new URLSearchParams({ limit: '20', periodYear: String(year), periodMonth: String(month) });
    if (statusFilter) params.set('status', statusFilter);
    api.get<Paged>(`/payments?${params}`).then(setResult).catch(() => undefined);
  }, [year, month, statusFilter]);

  useEffect(load, [load]);

  async function generate() {
    await api.post('/payments/generate-monthly', { periodYear: year, periodMonth: month }).catch(() => undefined);
    load();
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
              </tr>
            ))}
            {result && result.data.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">No invoices for this period.</td></tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
