'use client';

import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { api } from '@/lib/api';
import { formatDate, formatMoney } from '@/lib/utils';

interface Row {
  teacherId: string;
  name: string;
  salary: number;
  expectedSalary: number;
  manualSalary: number | null;
  studentCount: number;
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

  const [paying, setPaying] = useState<Row | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [savingPay, setSavingPay] = useState(false);

  const load = useCallback(() => {
    api.get<Overview>(`/salaries?year=${year}&month=${month}`).then(setData).catch(() => undefined);
  }, [year, month]);
  useEffect(load, [load]);

  function openPay(r: Row) {
    setPaying(r);
    // Prefill with what's already paid (so it can be corrected), else the default salary.
    setPayAmount(String(r.paid && r.amount != null ? r.amount : r.salary));
  }

  async function savePay() {
    if (!paying) return;
    setSavingPay(true);
    try {
      await api.post('/salaries/pay', {
        teacherId: paying.teacherId,
        periodYear: year,
        periodMonth: month,
        amount: Number(payAmount) || 0,
      });
      setPaying(null);
      load();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Could not record salary.');
    } finally {
      setSavingPay(false);
    }
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
                <td className="px-4 py-2">
                  <div>{formatMoney(r.salary)}</div>
                  <div className="text-xs text-muted-foreground">
                    {r.manualSalary != null
                      ? 'fixed salary'
                      : `${r.studentCount} student${r.studentCount === 1 ? '' : 's'} · 50/50 share`}
                  </div>
                </td>
                <td className="px-4 py-2">
                  {r.paid
                    ? <Badge tone="green">Paid {formatMoney(r.amount)} · {formatDate(r.paidAt)}</Badge>
                    : <Badge tone="red">Unpaid</Badge>}
                </td>
                <td className="px-4 py-2 text-right">
                  {r.paid ? (
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => openPay(r)}>Edit</Button>
                      <Button variant="outline" size="sm" onClick={() => unmark(r)}>Unmark</Button>
                    </div>
                  ) : (
                    <Button size="sm" onClick={() => openPay(r)}>Mark paid</Button>
                  )}
                </td>
              </tr>
            ))}
            {data && data.rows.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">No teachers yet.</td></tr>
            )}
          </tbody>
        </table>
      </Card>

      <p className="text-xs text-muted-foreground">
        Salary defaults to a <strong>50/50 split</strong>: the teacher earns half of what their groups bill
        (active students × group fee ÷ 2). Set a <strong>fixed salary</strong> on a teacher to override it.
        “Mark paid” records the payment for the selected month — you can adjust the amount before saving.
      </p>

      {paying && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setPaying(null)}>
          <Card className="w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <CardHeader><CardTitle>{paying.paid ? 'Edit salary payment' : 'Pay salary'}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {paying.name} · {MONTHS[month - 1]} {year}
                <br />
                {paying.manualSalary != null
                  ? `Fixed salary: ${formatMoney(paying.manualSalary)}`
                  : `${paying.studentCount} student${paying.studentCount === 1 ? '' : 's'} · 50/50 share = ${formatMoney(paying.expectedSalary)}`}
              </p>
              <div>
                <label className="mb-1 block text-sm font-medium">Amount to pay</label>
                <Input type="number" min={0} value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
              </div>
              <div className="flex gap-2">
                <Button onClick={savePay} disabled={savingPay}>{savingPay ? 'Saving…' : 'Save'}</Button>
                <Button variant="outline" onClick={() => setPaying(null)}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
