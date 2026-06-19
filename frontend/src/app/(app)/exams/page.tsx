'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';

interface ExamRow {
  id: string;
  name: string;
  date: string;
  maxScore: string;
  subject: { name: string };
  group: { id: string; name: string } | null;
  _count: { results: number };
}
interface Subject { id: string; name: string }
interface Group { id: string; name: string }

export default function ExamsPage() {
  const [exams, setExams] = useState<ExamRow[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', subjectId: '', groupId: '', date: new Date().toISOString().slice(0, 10), maxScore: '100' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load() {
    api.get<ExamRow[]>('/exams').then(setExams).catch(() => undefined);
  }
  useEffect(() => {
    load();
    api.get<Subject[]>('/catalog/subjects').then(setSubjects).catch(() => undefined);
    api.get<{ data: Group[] }>('/groups?limit=100').then((r) => setGroups(r.data)).catch(() => undefined);
  }, []);

  async function create() {
    if (!form.name || !form.subjectId) {
      setError('Name and subject are required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.post('/exams', {
        name: form.name,
        subjectId: form.subjectId,
        groupId: form.groupId || undefined,
        date: form.date,
        maxScore: Number(form.maxScore),
      });
      setForm({ ...form, name: '' });
      setOpen(false);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create exam');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Exams</h1>
        <Button variant={open ? 'outline' : 'default'} onClick={() => setOpen((o) => !o)}>
          {open ? 'Cancel' : 'New exam'}
        </Button>
      </div>

      {open && (
        <Card>
          <CardHeader><CardTitle>Create exam</CardTitle></CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <Input placeholder="Exam name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <Select value={form.subjectId} onChange={(e) => setForm({ ...form, subjectId: e.target.value })}>
                <option value="">Subject…</option>
                {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
              <Select value={form.groupId} onChange={(e) => setForm({ ...form, groupId: e.target.value })}>
                <option value="">Group (optional)…</option>
                {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </Select>
              <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              <Input type="number" placeholder="Max score" value={form.maxScore} onChange={(e) => setForm({ ...form, maxScore: e.target.value })} />
            </div>
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
            <Button className="mt-3" onClick={create} disabled={saving}>{saving ? 'Saving…' : 'Create'}</Button>
          </CardContent>
        </Card>
      )}

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2">Exam</th>
              <th className="px-4 py-2">Subject</th>
              <th className="px-4 py-2">Group</th>
              <th className="px-4 py-2">Date</th>
              <th className="px-4 py-2">Max</th>
              <th className="px-4 py-2">Results</th>
            </tr>
          </thead>
          <tbody>
            {exams.map((ex) => (
              <tr key={ex.id} className="border-t border-border hover:bg-muted/50">
                <td className="px-4 py-2 font-medium">
                  <Link href={`/exams/${ex.id}`} className="hover:underline">{ex.name}</Link>
                </td>
                <td className="px-4 py-2 text-muted-foreground">{ex.subject.name}</td>
                <td className="px-4 py-2 text-muted-foreground">{ex.group?.name ?? '—'}</td>
                <td className="px-4 py-2 text-muted-foreground">{formatDate(ex.date)}</td>
                <td className="px-4 py-2">{Number(ex.maxScore)}</td>
                <td className="px-4 py-2 text-muted-foreground">{ex._count.results}</td>
              </tr>
            ))}
            {exams.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">No exams yet.</td></tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
