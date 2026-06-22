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

  const [editing, setEditing] = useState<TeacherRow | null>(null);
  const [ef, setEf] = useState({ firstName: '', lastName: '', phone: '', subjects: '', salary: '' });
  const [savingEdit, setSavingEdit] = useState(false);

  const load = useCallback(() => {
    api.get<{ data: TeacherRow[] }>('/teachers?limit=500').then((r) => setRows(r.data)).catch(() => undefined);
  }, []);
  useEffect(load, [load]);

  function openEdit(t: TeacherRow) {
    setEditing(t);
    setEf({
      firstName: t.firstName,
      lastName: t.lastName,
      phone: t.phone ?? '',
      subjects: t.subjectsTaught.join(', '),
      salary: t.salary != null ? String(Number(t.salary)) : '',
    });
  }

  async function saveEdit() {
    if (!editing) return;
    setSavingEdit(true);
    try {
      await api.patch(`/teachers/${editing.id}`, {
        firstName: ef.firstName,
        lastName: ef.lastName,
        phone: ef.phone || undefined,
        subjectsTaught: ef.subjects ? ef.subjects.split(',').map((s) => s.trim()).filter(Boolean) : [],
        salary: ef.salary === '' ? null : Number(ef.salary),
      });
      setEditing(null);
      load();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Could not save teacher.');
    } finally {
      setSavingEdit(false);
    }
  }

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
    if (!window.confirm(`Delete teacher ${t.firstName} ${t.lastName}?\n\nThis removes their account and frees the email. Salary records are kept; groups are left without a teacher.`)) return;
    if (!window.confirm(`Are you sure? This cannot be undone. Delete ${t.firstName} ${t.lastName} permanently?`)) return;
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
              <Input type="number" min={0} placeholder="Fixed salary — leave blank for auto 50/50" value={form.salary} onChange={(e) => setForm({ ...form, salary: e.target.value })} />
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
                    <Button variant="outline" size="sm" onClick={() => openEdit(t)}>Edit</Button>
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

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setEditing(null)}>
          <Card className="w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <CardHeader><CardTitle>Edit teacher — {editing.firstName} {editing.lastName}</CardTitle></CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2">
                <div><label className="mb-1 block text-xs font-medium text-muted-foreground">First name</label><Input value={ef.firstName} onChange={(e) => setEf({ ...ef, firstName: e.target.value })} /></div>
                <div><label className="mb-1 block text-xs font-medium text-muted-foreground">Last name</label><Input value={ef.lastName} onChange={(e) => setEf({ ...ef, lastName: e.target.value })} /></div>
                <div><label className="mb-1 block text-xs font-medium text-muted-foreground">Phone</label><Input value={ef.phone} onChange={(e) => setEf({ ...ef, phone: e.target.value })} /></div>
                <div><label className="mb-1 block text-xs font-medium text-muted-foreground">Fixed salary <span className="font-normal">(blank = auto 50/50)</span></label><Input type="number" min={0} value={ef.salary} onChange={(e) => setEf({ ...ef, salary: e.target.value })} /></div>
                <div className="sm:col-span-2"><label className="mb-1 block text-xs font-medium text-muted-foreground">Subjects (comma-separated)</label><Input value={ef.subjects} onChange={(e) => setEf({ ...ef, subjects: e.target.value })} /></div>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">Login email is changed by the teacher in their own Settings.</p>
              <div className="mt-4 flex gap-2">
                <Button onClick={saveEdit} disabled={savingEdit}>{savingEdit ? 'Saving…' : 'Save changes'}</Button>
                <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
