'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';

interface StudentRow {
  id: string;
  firstName: string;
  lastName: string;
  status: string;
  phone: string | null;
  enrollments: { group: { id: string; name: string } }[];
  riskFlags: { level: string; score: number }[];
}
interface Paged {
  data: StudentRow[];
  meta: { page: number; total: number; totalPages: number };
}

const statusTone: Record<string, 'green' | 'amber' | 'gray' | 'red'> = {
  ACTIVE: 'green',
  FROZEN: 'amber',
  GRADUATED: 'blue' as 'gray',
  LEFT: 'red',
};
const riskTone: Record<string, 'green' | 'amber' | 'red' | 'gray'> = {
  LOW: 'green',
  MEDIUM: 'amber',
  HIGH: 'red',
  CRITICAL: 'red',
};

export default function StudentsPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<Paged | null>(null);

  const load = useCallback(() => {
    const params = new URLSearchParams({ page: String(page), limit: '15' });
    if (search) params.set('search', search);
    api.get<Paged>(`/students?${params}`).then(setResult).catch(() => undefined);
  }, [page, search]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Students</h1>
        {result && <span className="text-sm text-muted-foreground">{result.meta.total} total</span>}
      </div>
      <Input
        placeholder="Search by name or phone…"
        value={search}
        onChange={(e) => {
          setPage(1);
          setSearch(e.target.value);
        }}
        className="max-w-sm"
      />
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Groups</th>
              <th className="px-4 py-2">Phone</th>
              <th className="px-4 py-2">Risk</th>
            </tr>
          </thead>
          <tbody>
            {result?.data.map((s) => {
              const risk = s.riskFlags[0];
              return (
                <tr key={s.id} className="border-t border-border hover:bg-muted/50">
                  <td className="px-4 py-2 font-medium">
                    <Link href={`/students/${s.id}`} className="hover:underline">
                      {s.firstName} {s.lastName}
                    </Link>
                  </td>
                  <td className="px-4 py-2">
                    <Badge tone={statusTone[s.status] ?? 'gray'}>{s.status}</Badge>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {s.enrollments.map((e) => e.group.name).join(', ') || '—'}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{s.phone ?? '—'}</td>
                  <td className="px-4 py-2">
                    {risk && risk.score > 0 ? (
                      <Badge tone={riskTone[risk.level]}>{risk.level}</Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {result && result.data.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                  No students found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
      {result && result.meta.totalPages > 1 && (
        <div className="flex items-center gap-2 text-sm">
          <button
            className="rounded border border-border px-3 py-1 disabled:opacity-40"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Prev
          </button>
          <span className="text-muted-foreground">
            Page {result.meta.page} of {result.meta.totalPages}
          </span>
          <button
            className="rounded border border-border px-3 py-1 disabled:opacity-40"
            disabled={page >= result.meta.totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
