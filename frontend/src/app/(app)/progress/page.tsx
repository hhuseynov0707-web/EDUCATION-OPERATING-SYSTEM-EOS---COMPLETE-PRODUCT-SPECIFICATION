'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { api } from '@/lib/api';
import { cn, formatMoney } from '@/lib/utils';

interface MonthRow {
  year: number;
  month: number;
  label: string;
  expectedRevenue: number;
  collectedRevenue: number;
  collectionRate: number | null;
  students: number;
  attendanceRate: number | null;
  salariesPaid: number;
  netRevenue: number;
}

function Stat({ title, value, sub, tone }: { title: string; value: string; sub?: string; tone?: 'red' | 'green' }) {
  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent>
        <div className={cn('text-2xl font-semibold', tone === 'red' && 'text-red-600', tone === 'green' && 'text-green-600')}>{value}</div>
        {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  );
}

export default function ProgressPage() {
  const [months, setMonths] = useState(6);
  const [data, setData] = useState<MonthRow[]>([]);

  const load = useCallback(() => {
    api.get<MonthRow[]>(`/dashboard/monthly?months=${months}`).then(setData).catch(() => undefined);
  }, [months]);
  useEffect(load, [load]);

  const latest = data[data.length - 1] ?? null;
  const maxCollected = Math.max(1, ...data.map((d) => d.collectedRevenue));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Monthly Progress</h1>
          <p className="text-sm text-muted-foreground">How the academy is developing month over month.</p>
        </div>
        <Select value={months} onChange={(e) => setMonths(Number(e.target.value))}>
          <option value={3}>Last 3 months</option>
          <option value={6}>Last 6 months</option>
          <option value={12}>Last 12 months</option>
        </Select>
      </div>

      {latest && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat title={`Collected · ${latest.label}`} value={formatMoney(latest.collectedRevenue)} sub={`of ${formatMoney(latest.expectedRevenue)} expected`} />
          <Stat title="Collection rate" value={`${latest.collectionRate ?? 0}%`} sub={`${latest.students} students billed`} />
          <Stat title="Attendance" value={latest.attendanceRate != null ? `${latest.attendanceRate}%` : '—'} />
          <Stat title="Net (after salaries)" value={formatMoney(latest.netRevenue)} sub={`salaries ${formatMoney(latest.salariesPaid)}`} tone={latest.netRevenue < 0 ? 'red' : 'green'} />
        </div>
      )}

      {/* Collected-revenue trend (dependency-free CSS bars). */}
      <Card>
        <CardHeader><CardTitle>Collected revenue trend</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-end gap-3" style={{ height: 180 }}>
            {data.map((d) => (
              <div key={`${d.year}-${d.month}`} className="flex flex-1 flex-col items-center justify-end gap-1">
                <div className="text-[11px] font-medium text-muted-foreground">{formatMoney(d.collectedRevenue)}</div>
                <div
                  className="w-full rounded-t bg-primary/80"
                  style={{ height: `${Math.round((d.collectedRevenue / maxCollected) * 140)}px` }}
                  title={`${d.label}: ${formatMoney(d.collectedRevenue)}`}
                />
                <div className="text-[11px] text-muted-foreground">{d.label}</div>
              </div>
            ))}
            {data.length === 0 && <p className="text-sm text-muted-foreground">No data yet.</p>}
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2">Month</th>
              <th className="px-4 py-2">Expected</th>
              <th className="px-4 py-2">Collected</th>
              <th className="px-4 py-2">Rate</th>
              <th className="px-4 py-2">Students</th>
              <th className="px-4 py-2">Attendance</th>
              <th className="px-4 py-2">Salaries</th>
              <th className="px-4 py-2">Net</th>
            </tr>
          </thead>
          <tbody>
            {[...data].reverse().map((d) => (
              <tr key={`${d.year}-${d.month}`} className="border-t border-border hover:bg-muted/50">
                <td className="px-4 py-2 font-medium">{d.label}</td>
                <td className="px-4 py-2">{formatMoney(d.expectedRevenue)}</td>
                <td className="px-4 py-2">{formatMoney(d.collectedRevenue)}</td>
                <td className="px-4 py-2">{d.collectionRate != null ? `${d.collectionRate}%` : '—'}</td>
                <td className="px-4 py-2">{d.students}</td>
                <td className="px-4 py-2">{d.attendanceRate != null ? `${d.attendanceRate}%` : '—'}</td>
                <td className="px-4 py-2">{formatMoney(d.salariesPaid)}</td>
                <td className={cn('px-4 py-2 font-medium', d.netRevenue < 0 ? 'text-red-600' : 'text-green-600')}>{formatMoney(d.netRevenue)}</td>
              </tr>
            ))}
            {data.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-6 text-center text-muted-foreground">No data yet.</td></tr>
            )}
          </tbody>
        </table>
      </Card>

      <p className="text-xs text-muted-foreground">
        Revenue and collection come from invoices; “Students” counts those billed that month; attendance is the
        present/late rate across all lessons; “Net” is collected revenue minus salaries paid.
      </p>
    </div>
  );
}
