'use client';

import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { api } from '@/lib/api';
import { formatDate, formatMoney } from '@/lib/utils';

interface Row {
  teacherId: string;
  name: string;
  salary: number | null;
  paid: boolean;
  amount: number | null;
  paidAt: string | null;
}
interface Overview {
  totals: { totalSalary: number; totalPaid: number; totalUnpaid: number; paidCount: number; teacherCount: number };
  rows: Row[];
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function Stat({ title, value, sub }: { title: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">{value}</div>
        {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  );
}

export default function SalariesPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getUTCFullYear());
  const [month, setMonth] = useState(now.getUTCMonth() + 1);
  const [data, setData] = useState<Overview | null>(null);

  const load = useCallback(() => {
    api.get<Overview>(`/salaries?year=${year}&month=${month}`).then(setData).catch(() => undefined);
  }, [year, month]);
  useEffect(load, [load]);

  async function markPaid(r: Row) {
    await api.post('/salaries/pay', { teacherId: r.teacherId, periodYear: year, periodMonth: month }).catch(() => undefined);
    load();
  }
  async function unmark(r: Row) {
    await api.post('/salaries/unpay', { teacherId: r.teacherId, periodYear: year, periodMonth: month }).catch(() => undefined);
    load();
  }

  const years = [now.getUTCFullYear() - 1, now.getUTCFullYear(), now.getUTCFullYear() + 1];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Teacher Salaries</h1>
        <div className="flex gap-2">
          <Select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </Select>
          <Select value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </Select>
        </div>
      </div>

      {data && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat title="Total Salaries" value={formatMoney(data.totals.totalSalary)} sub={`${data.totals.teacherCount} teachers`} />
          <Stat title="Paid" value={formatMoney(data.totals.totalPaid)} sub={`${data.totals.paidCount}/${data.totals.teacherCount} teachers`} />
          <Stat title="Unpaid" value={formatMoney(data.totals.totalUnpaid)} />
          <Stat title="Month" value={`${MONTHS[month - 1]} ${year}`} />
        </div>
      )}

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2">Teacher</th>
              <th className="px-4 py-2">Monthly salary</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {data?.rows.map((r) => (
              <tr key={r.teacherId} className="border-t border-border hover:bg-muted/50">
                <td className="px-4 py-2 font-medium">{r.name}</td>
                <td className="px-4 py-2">{r.salary != null ? formatMoney(r.salary) : <span className="text-muted-foreground">not set</span>}</td>
                <td className="px-4 py-2">
                  {r.paid
                    ? <Badge tone="green">Paid {formatMoney(r.amount)} · {formatDate(r.paidAt)}</Badge>
                    : <Badge tone="red">Unpaid</Badge>}
                </td>
                <td className="px-4 py-2 text-right">
                  {r.paid
                    ? <Button variant="outline" size="sm" onClick={() => unmark(r)}>Unmark</Button>
                    : <Button size="sm" onClick={() => markPaid(r)} disabled={r.salary == null}>Mark paid</Button>}
                </td>
              </tr>
            ))}
            {data && data.rows.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">No teachers yet.</td></tr>
            )}
          </tbody>
        </table>
      </Card>
      <p className="text-xs text-muted-foreground">Set each teacher’s monthly salary under <strong>Teachers</strong>. “Mark paid” records the payment for the selected month.</p>
    </div>
  );
}
