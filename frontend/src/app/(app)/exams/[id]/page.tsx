'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';

interface ExamDetail {
  id: string;
  name: string;
  date: string;
  maxScore: string;
  subject: { name: string };
  group: { id: string; name: string } | null;
  results: { score: string; note: string | null; student: { id: string; firstName: string; lastName: string } }[];
  stats: { count: number; average: number | null; highest: number | null; lowest: number | null; averagePercentage: number | null };
}
interface GroupDetail {
  enrollments: { status: string; student: { id: string; firstName: string; lastName: string } }[];
}

export default function ExamDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [exam, setExam] = useState<ExamDetail | null>(null);
  const [roster, setRoster] = useState<{ studentId: string; name: string }[]>([]);
  const [scores, setScores] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function load() {
    api.get<ExamDetail>(`/exams/${id}`).then(async (ex) => {
      setExam(ex);
      const existing: Record<string, string> = {};
      ex.results.forEach((r) => (existing[r.student.id] = String(Number(r.score))));
      setScores(existing);

      if (ex.group) {
        const g = await api.get<GroupDetail>(`/groups/${ex.group.id}`).catch(() => null);
        if (g) {
          setRoster(
            g.enrollments
              .filter((e) => e.status === 'ACTIVE')
              .map((e) => ({ studentId: e.student.id, name: `${e.student.firstName} ${e.student.lastName}` })),
          );
          return;
        }
      }
      setRoster(ex.results.map((r) => ({ studentId: r.student.id, name: `${r.student.firstName} ${r.student.lastName}` })));
    }).catch(() => undefined);
  }
  useEffect(load, [id]);

  async function save() {
    if (!exam) return;
    setSaving(true);
    setMsg(null);
    try {
      const results = roster
        .filter((r) => scores[r.studentId] !== undefined && scores[r.studentId] !== '')
        .map((r) => ({ studentId: r.studentId, score: Number(scores[r.studentId]) }));
      const res = await api.post<{ saved: number }>(`/exams/${id}/results`, { results });
      setMsg(`Saved ${res.saved} results.`);
      load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  if (!exam) return <p className="text-muted-foreground">Loading…</p>;
  const max = Number(exam.maxScore);
  const ranked = [...exam.results].sort((a, b) => Number(b.score) - Number(a.score));

  return (
    <div className="space-y-6">
      <Link href="/exams" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
        <ArrowLeft size={14} /> Exams
      </Link>

      <div>
        <h1 className="text-2xl font-semibold">{exam.name}</h1>
        <p className="text-sm text-muted-foreground">
          {exam.subject.name} · {exam.group?.name ?? 'No group'} · {formatDate(exam.date)} · max {max}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card><CardHeader><CardTitle>Results</CardTitle></CardHeader><CardContent><div className="text-2xl font-semibold">{exam.stats.count}</div></CardContent></Card>
        <Card><CardHeader><CardTitle>Average</CardTitle></CardHeader><CardContent><div className="text-2xl font-semibold">{exam.stats.average ?? '—'}</div><div className="mt-1 text-xs text-muted-foreground">{exam.stats.averagePercentage ?? 0}%</div></CardContent></Card>
        <Card><CardHeader><CardTitle>Highest</CardTitle></CardHeader><CardContent><div className="text-2xl font-semibold text-green-600">{exam.stats.highest ?? '—'}</div></CardContent></Card>
        <Card><CardHeader><CardTitle>Lowest</CardTitle></CardHeader><CardContent><div className="text-2xl font-semibold text-red-600">{exam.stats.lowest ?? '—'}</div></CardContent></Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Enter scores</CardTitle></CardHeader>
          <CardContent>
            {roster.length === 0 ? (
              <p className="text-sm text-muted-foreground">No students to grade (assign this exam to a group).</p>
            ) : (
              <>
                <ul className="divide-y divide-border">
                  {roster.map((r) => (
                    <li key={r.studentId} className="flex items-center justify-between py-1.5 text-sm">
                      <span>{r.name}</span>
                      <Input
                        type="number"
                        min={0}
                        max={max}
                        value={scores[r.studentId] ?? ''}
                        onChange={(e) => setScores((s) => ({ ...s, [r.studentId]: e.target.value }))}
                        className="h-8 w-24"
                      />
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex items-center gap-3">
                  <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save scores'}</Button>
                  {msg && <span className="text-sm text-muted-foreground">{msg}</span>}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Ranked results</CardTitle></CardHeader>
          <CardContent>
            {ranked.length === 0 ? (
              <p className="text-sm text-muted-foreground">No results entered yet.</p>
            ) : (
              <ol className="space-y-1 text-sm">
                {ranked.map((r, i) => (
                  <li key={r.student.id} className="flex justify-between">
                    <span>{i + 1}. {r.student.firstName} {r.student.lastName}</span>
                    <span className="font-medium">
                      {Number(r.score)} <span className="text-muted-foreground">({Math.round((Number(r.score) / max) * 100)}%)</span>
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
