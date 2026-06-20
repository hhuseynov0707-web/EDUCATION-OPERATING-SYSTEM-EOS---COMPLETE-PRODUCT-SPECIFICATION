'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';

interface ParentRow {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  user: { email: string; isActive: boolean } | null;
  children: { student: { id: string; firstName: string; lastName: string } }[];
}
interface StudentLite { id: string; firstName: string; lastName: string }

const empty = { firstName: '', lastName: '', email: '', password: '', phone: '' };

export default function ParentsPage() {
  const [rows, setRows] = useState<ParentRow[]>([]);
  const [students, setStudents] = useState<StudentLite[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...empty });
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [studentSearch, setStudentSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(() => {
    api.get<ParentRow[]>('/parents').then(setRows).catch(() => undefined);
  }, []);
  useEffect(() => {
    load();
    api.get<{ data: StudentLite[] }>('/students?limit=200').then((r) => setStudents(r.data)).catch(() => undefined);
  }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const studentIds = Object.keys(picked).filter((k) => picked[k]);
    if (form.password.length < 8) { setMsg({ ok: false, text: 'Password must be at least 8 characters.' }); return; }
    if (studentIds.length === 0) { setMsg({ ok: false, text: 'Select at least one child.' }); return; }
    setSaving(true);
    try {
      await api.post('/parents', {
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        password: form.password,
        phone: form.phone || undefined,
        studentIds,
      });
      setMsg({ ok: true, text: `Parent created. They log in with ${form.email}.` });
      setForm({ ...empty });
      setPicked({});
      setOpen(false);
      load();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : 'Could not create parent.' });
    } finally {
      setSaving(false);
    }
  }

  async function resetPassword(p: ParentRow) {
    const np = window.prompt(`New password for ${p.firstName} ${p.lastName} (min 8 chars):`);
    if (!np) return;
    if (np.length < 8) { alert('Password must be at least 8 characters.'); return; }
    try {
      await api.post(`/parents/${p.id}/reset-password`, { newPassword: np });
      alert(`Password updated for ${p.firstName}. Share it with them.`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not reset password.');
    }
  }

  async function remove(p: ParentRow) {
    if (!window.confirm(`Delete parent ${p.firstName} ${p.lastName}? Their login is disabled.`)) return;
    try {
      await api.delete(`/parents/${p.id}`);
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not delete parent.');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Parents</h1>
        <Button variant={open ? 'outline' : 'default'} onClick={() => { setOpen((o) => !o); setMsg(null); }}>
          {open ? 'Cancel' : 'Add parent'}
        </Button>
      </div>

      {open && (
        <Card>
          <CardHeader><CardTitle>New parent</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={create} className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <Input placeholder="First name" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required />
                <Input placeholder="Last name" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required />
                <Input placeholder="Phone (optional)" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                <Input type="email" placeholder="Login email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
                <Input type="text" placeholder="Password (min 8 chars)" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
              </div>

              <div>
                <div className="mb-1 text-xs font-medium text-muted-foreground">Children (select one or more)</div>
                <Input placeholder="Search students…" value={studentSearch} onChange={(e) => setStudentSearch(e.target.value)} className="mb-2 max-w-sm" />
                <div className="max-h-44 overflow-auto rounded-md border border-border p-2">
                  {students
                    .filter((s) => `${s.firstName} ${s.lastName}`.toLowerCase().includes(studentSearch.toLowerCase()))
                    .map((s) => (
                      <label key={s.id} className="flex items-center gap-2 py-1 text-sm">
                        <input type="checkbox" checked={!!picked[s.id]} onChange={(e) => setPicked({ ...picked, [s.id]: e.target.checked })} />
                        {s.firstName} {s.lastName}
                      </label>
                    ))}
                </div>
              </div>

              {msg && <p className={msg.ok ? 'text-sm text-green-600' : 'text-sm text-red-600'}>{msg.text}</p>}
              <Button disabled={saving}>{saving ? 'Saving…' : 'Create parent'}</Button>
            </form>
          </CardContent>
        </Card>
      )}

      {msg && !open && <p className={msg.ok ? 'text-sm text-green-600' : 'text-sm text-red-600'}>{msg.text}</p>}

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Login email</th>
              <th className="px-4 py-2">Children</th>
              <th className="px-4 py-2">Phone</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className="border-t border-border hover:bg-muted/50">
                <td className="px-4 py-2 font-medium">{p.firstName} {p.lastName}</td>
                <td className="px-4 py-2 text-muted-foreground">{p.user?.email ?? '—'}</td>
                <td className="px-4 py-2 text-muted-foreground">{p.children.map((c) => `${c.student.firstName} ${c.student.lastName}`).join(', ') || '—'}</td>
                <td className="px-4 py-2 text-muted-foreground">{p.phone ?? '—'}</td>
                <td className="px-4 py-2 text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => resetPassword(p)}>Reset password</Button>
                    <Button variant="destructive" size="sm" onClick={() => remove(p)}>Delete</Button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">No parents yet. Click “Add parent”.</td></tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
