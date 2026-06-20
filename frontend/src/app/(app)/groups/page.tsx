'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatMoney } from '@/lib/utils';

interface GroupRow {
  id: string;
  name: string;
  monthlyFee: string;
  subject: { name: string };
  teacher: { firstName: string; lastName: string } | null;
  schedules: { weekday: string; startTime: string; endTime: string }[];
  _count: { enrollments: number };
}
interface Subject { id: string; name: string }
interface Teacher { id: string; firstName: string; lastName: string }
interface ScheduleSlot { weekday: string; startTime: string; endTime: string }

const WEEKDAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const emptyForm = { name: '', subjectId: '', teacherId: '', monthlyFee: '0' };

export default function GroupsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [slots, setSlots] = useState<ScheduleSlot[]>([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const loadGroups = useCallback(() => {
    api.get<{ data: GroupRow[] }>('/groups?limit=100').then((r) => setGroups(r.data)).catch(() => undefined);
  }, []);
  const loadRefs = useCallback(() => {
    api.get<Subject[]>('/catalog/subjects').then(setSubjects).catch(() => undefined);
    if (isAdmin) api.get<{ data: Teacher[] }>('/teachers?limit=100').then((r) => setTeachers(r.data)).catch(() => undefined);
  }, [isAdmin]);

  useEffect(() => { loadGroups(); loadRefs(); }, [loadGroups, loadRefs]);

  async function addSubject() {
    const name = window.prompt('New subject name (e.g. "SAT Math", "AP Physics"):');
    if (!name?.trim()) return;
    try {
      const s = await api.post<Subject>('/catalog/subjects', { name: name.trim() });
      await new Promise((r) => setTimeout(r, 150));
      loadRefs();
      setForm((f) => ({ ...f, subjectId: s.id }));
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Could not add subject.');
    }
  }

  async function createGroup(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!form.subjectId) { setMsg({ ok: false, text: 'Choose a subject (or add one).' }); return; }
    setSaving(true);
    try {
      await api.post('/groups', {
        name: form.name,
        subjectId: form.subjectId,
        teacherId: form.teacherId || undefined,
        monthlyFee: Number(form.monthlyFee) || 0,
        schedules: slots.filter((s) => s.startTime && s.endTime),
      });
      setForm({ ...emptyForm });
      setSlots([]);
      setOpen(false);
      loadGroups();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : 'Could not create group.' });
    } finally {
      setSaving(false);
    }
  }

  async function deleteGroup(g: GroupRow) {
    if (!window.confirm(`Archive group "${g.name}"? Its history is kept, but it will no longer be active.`)) return;
    try {
      await api.delete(`/groups/${g.id}`);
      loadGroups();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Could not delete group.');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Groups</h1>
        {isAdmin && (
          <Button variant={open ? 'outline' : 'default'} onClick={() => { setOpen((o) => !o); setMsg(null); }}>
            {open ? 'Cancel' : 'New group'}
          </Button>
        )}
      </div>

      {open && isAdmin && (
        <Card>
          <CardHeader><CardTitle>Create group</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={createGroup} className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Input placeholder="Group name (e.g. SAT Math A)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                <div className="flex gap-1">
                  <Select value={form.subjectId} onChange={(e) => setForm({ ...form, subjectId: e.target.value })} className="flex-1">
                    <option value="">Subject…</option>
                    {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </Select>
                  <Button type="button" variant="outline" size="sm" onClick={addSubject} title="Add subject">＋</Button>
                </div>
                <Select value={form.teacherId} onChange={(e) => setForm({ ...form, teacherId: e.target.value })}>
                  <option value="">Teacher (optional)…</option>
                  {teachers.map((t) => <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>)}
                </Select>
                <Input type="number" min={0} placeholder="Monthly fee" value={form.monthlyFee} onChange={(e) => setForm({ ...form, monthlyFee: e.target.value })} />
              </div>

              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground">Schedule (optional)</div>
                {slots.map((slot, i) => (
                  <div key={i} className="flex gap-2">
                    <Select value={slot.weekday} onChange={(e) => setSlots(slots.map((s, j) => j === i ? { ...s, weekday: e.target.value } : s))}>
                      {WEEKDAYS.map((d) => <option key={d} value={d}>{d}</option>)}
                    </Select>
                    <Input type="time" value={slot.startTime} onChange={(e) => setSlots(slots.map((s, j) => j === i ? { ...s, startTime: e.target.value } : s))} />
                    <Input type="time" value={slot.endTime} onChange={(e) => setSlots(slots.map((s, j) => j === i ? { ...s, endTime: e.target.value } : s))} />
                    <Button type="button" variant="ghost" size="sm" onClick={() => setSlots(slots.filter((_, j) => j !== i))}>✕</Button>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={() => setSlots([...slots, { weekday: 'MON', startTime: '16:00', endTime: '17:30' }])}>
                  ＋ Add time slot
                </Button>
              </div>

              {msg && <p className={msg.ok ? 'text-sm text-green-600' : 'text-sm text-red-600'}>{msg.text}</p>}
              <Button disabled={saving}>{saving ? 'Saving…' : 'Create group'}</Button>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {groups.map((g) => (
          <Card key={g.id} className="h-full">
            <CardContent className="pt-5">
              <div className="flex items-start justify-between">
                <Link href={`/groups/${g.id}`} className="hover:underline">
                  <h3 className="font-semibold">{g.name}</h3>
                  <p className="text-sm text-muted-foreground">{g.subject.name}</p>
                </Link>
                <span className="text-sm font-medium">{formatMoney(g.monthlyFee)}/mo</span>
              </div>
              <div className="mt-3 space-y-1 text-sm text-muted-foreground">
                <div>{g.teacher ? `${g.teacher.firstName} ${g.teacher.lastName}` : 'No teacher assigned'}</div>
                <div>{g._count.enrollments} students</div>
                <div>{g.schedules.length > 0 ? g.schedules.map((s) => `${s.weekday} ${s.startTime}`).join(', ') : 'No schedule'}</div>
              </div>
              <div className="mt-3 flex gap-2">
                <Link href={`/groups/${g.id}`}><Button variant="outline" size="sm">Open</Button></Link>
                {isAdmin && <Button variant="destructive" size="sm" onClick={() => deleteGroup(g)}>Delete</Button>}
              </div>
            </CardContent>
          </Card>
        ))}
        {groups.length === 0 && <p className="text-sm text-muted-foreground">No groups yet. Click “New group”.</p>}
      </div>
    </div>
  );
}
