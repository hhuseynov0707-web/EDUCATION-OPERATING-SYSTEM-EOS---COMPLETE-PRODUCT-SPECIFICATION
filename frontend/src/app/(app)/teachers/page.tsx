'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { formatMoney } from '@/lib/utils';

interface TeacherRow {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  subjectsTaught: string[];
  salary: string | null;
  user: { email: string; isActive: boolean } | null;
  _count: { groups: number };
}

const empty = { firstName: '', lastName: '', email: '', password: '', phone: '', subjects: '', salary: '' };

export default function TeachersPage() {
  const [rows, setRows] = useState<TeacherRow[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...empty });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(() => {
    api.get<{ data: TeacherRow[] }>('/teachers?limit=100').then((r) => setRows(r.data)).catch(() => undefined);
  }, []);
  useEffect(load, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (form.password.length < 8) {
      setMsg({ ok: false, text: 'Password must be at least 8 characters.' });
      return;
    }
    setSaving(true);
    try {
      await api.post('/teachers', {
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        password: form.password,
        phone: form.phone || undefined,
        subjectsTaught: form.subjects ? form.subjects.split(',').map((s) => s.trim()).filter(Boolean) : [],
        salary: form.salary ? Number(form.salary) : undefined,
      });
      setMsg({ ok: true, text: `Teacher created. They log in with ${form.email}.` });
      setForm({ ...empty });
      setOpen(false);
      load();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : 'Could not create teacher.' });
    } finally {
      setSaving(false);
    }
  }

  async function resetPassword(t: TeacherRow) {
    const np = window.prompt(`New password for ${t.firstName} ${t.lastName} (min 8 chars):`);
    if (!np) return;
    if (np.length < 8) {
      alert('Password must be at least 8 characters.');
      return;
    }
    try {
      await api.post(`/teachers/${t.id}/reset-password`, { newPassword: np });
      alert(`Password updated for ${t.firstName}. Share it with them.`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not reset password.');
    }
  }

  async function deleteTeacher(t: TeacherRow) {
    if (!window.confirm(`Delete teacher ${t.firstName} ${t.lastName}? Their login is disabled and groups are left without a teacher. History is kept.`)) return;
    try {
      await api.delete(`/teachers/${t.id}`);
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not delete teacher.');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Teachers</h1>
        <Button variant={open ? 'outline' : 'default'} onClick={() => { setOpen((o) => !o); setMsg(null); }}>
          {open ? 'Cancel' : 'Add teacher'}
        </Button>
      </div>

      {open && (
        <Card>
          <CardHeader><CardTitle>New teacher</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={create} className="grid gap-3 sm:grid-cols-2">
              <Input placeholder="First name" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required />
              <Input placeholder="Last name" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required />
              <Input type="email" placeholder="Login email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
              <Input type="text" placeholder="Password (min 8 chars)" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
              <Input placeholder="Phone (optional)" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              <Input placeholder="Subjects, comma-separated" value={form.subjects} onChange={(e) => setForm({ ...form, subjects: e.target.value })} />
              <Input type="number" min={0} placeholder="Monthly salary (optional)" value={form.salary} onChange={(e) => setForm({ ...form, salary: e.target.value })} />
              <div className="sm:col-span-2">
                <Button disabled={saving}>{saving ? 'Saving…' : 'Create teacher'}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {msg && <p className={msg.ok ? 'text-sm text-green-600' : 'text-sm text-red-600'}>{msg.text}</p>}

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Login email</th>
              <th className="px-4 py-2">Subjects</th>
              <th className="px-4 py-2">Groups</th>
              <th className="px-4 py-2">Salary</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.id} className="border-t border-border hover:bg-muted/50">
                <td className="px-4 py-2 font-medium">{t.firstName} {t.lastName}</td>
                <td className="px-4 py-2 text-muted-foreground">{t.user?.email ?? '—'}</td>
                <td className="px-4 py-2 text-muted-foreground">{t.subjectsTaught.join(', ') || '—'}</td>
                <td className="px-4 py-2 text-muted-foreground">{t._count.groups}</td>
                <td className="px-4 py-2 text-muted-foreground">{t.salary != null ? formatMoney(t.salary) : '—'}</td>
                <td className="px-4 py-2 text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => resetPassword(t)}>Reset password</Button>
                    <Button variant="destructive" size="sm" onClick={() => deleteTeacher(t)}>Delete</Button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">No teachers yet. Click “Add teacher”.</td></tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
