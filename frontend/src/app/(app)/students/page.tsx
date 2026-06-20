'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

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
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<Paged | null>(null);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ firstName: '', lastName: '', phone: '' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(() => {
    const params = new URLSearchParams({ page: String(page), limit: '15' });
    if (search) params.set('search', search);
    api.get<Paged>(`/students?${params}`).then(setResult).catch(() => undefined);
  }, [page, search]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  async function createStudent(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      await api.post('/students', {
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.phone || undefined,
      });
      setForm({ firstName: '', lastName: '', phone: '' });
      setOpen(false);
      load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Could not add student.');
    } finally {
      setSaving(false);
    }
  }

  async function deleteStudent(id: string, name: string) {
    if (!window.confirm(`Delete student ${name}? They are marked as left and hidden. History is kept.`)) return;
    try {
      await api.delete(`/students/${id}`);
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not delete student.');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Students</h1>
        <div className="flex items-center gap-3">
          {result && <span className="text-sm text-muted-foreground">{result.meta.total} total</span>}
          {isAdmin && (
            <Button variant={open ? 'outline' : 'default'} onClick={() => { setOpen((o) => !o); setMsg(null); }}>
              {open ? 'Cancel' : 'New student'}
            </Button>
          )}
        </div>
      </div>

      {open && isAdmin && (
        <Card>
          <CardHeader><CardTitle>Add student</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={createStudent} className="grid gap-3 sm:grid-cols-3">
              <Input placeholder="First name" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required />
              <Input placeholder="Last name" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required />
              <Input placeholder="Phone (optional)" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              <div className="sm:col-span-3">
                <Button disabled={saving}>{saving ? 'Saving…' : 'Add student'}</Button>
                {msg && <span className="ml-3 text-sm text-red-600">{msg}</span>}
              </div>
            </form>
          </CardContent>
        </Card>
      )}

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
              {isAdmin && <th className="px-4 py-2"></th>}
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
                  {isAdmin && (
                    <td className="px-4 py-2 text-right">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => deleteStudent(s.id, `${s.firstName} ${s.lastName}`)}
                      >
                        Delete
                      </Button>
                    </td>
                  )}
                </tr>
              );
            })}
            {result && result.data.length === 0 && (
              <tr>
                <td colSpan={isAdmin ? 6 : 5} className="px-4 py-6 text-center text-muted-foreground">
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
