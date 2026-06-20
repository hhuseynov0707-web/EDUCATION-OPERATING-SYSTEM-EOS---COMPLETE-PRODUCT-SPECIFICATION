'use client';

import { ArrowLeft, CalendarCheck } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn, formatDate, formatMoney } from '@/lib/utils';

interface GroupDetail {
  id: string;
  name: string;
  monthlyFee: string;
  subject: { id: string; name: string };
  teacher: { firstName: string; lastName: string } | null;
  schedules: { id: string; weekday: string; startTime: string; endTime: string }[];
  enrollments: { status: string; student: { id: string; firstName: string; lastName: string; status: string } }[];
  curriculumCoverage: { totalTopics: number; completedTopics: number; percentage: number | null };
}
interface Board {
  percentage: number | null;
  topics: { topicId: string; name: string; status: string }[];
}
interface ExamRow {
  id: string;
  name: string;
  date: string;
  maxScore: string;
  _count: { results: number };
}

const TOPIC_STATES = [
  { key: 'NOT_STARTED', label: '○', cls: 'bg-white' },
  { key: 'IN_PROGRESS', label: '◐', cls: 'bg-amber-500 text-white' },
  { key: 'COMPLETED', label: '✓', cls: 'bg-green-600 text-white' },
];

interface StudentLite { id: string; firstName: string; lastName: string }

export default function GroupDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';
  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [board, setBoard] = useState<Board | null>(null);
  const [exams, setExams] = useState<ExamRow[]>([]);
  const [picker, setPicker] = useState(false);
  const [allStudents, setAllStudents] = useState<StudentLite[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [studentSearch, setStudentSearch] = useState('');

  const loadGroup = useCallback(() => {
    api.get<GroupDetail>(`/groups/${id}`).then(setGroup).catch(() => undefined);
  }, [id]);
  const loadBoard = useCallback(() => {
    api.get<Board>(`/curriculum/group/${id}`).then(setBoard).catch(() => undefined);
  }, [id]);

  useEffect(() => {
    loadGroup();
    api.get<ExamRow[]>(`/exams?groupId=${id}`).then(setExams).catch(() => undefined);
    loadBoard();
  }, [id, loadGroup, loadBoard]);

  function openPicker() {
    setPicker(true);
    setSelected({});
    setStudentSearch('');
    api.get<{ data: StudentLite[] }>('/students?limit=200').then((r) => setAllStudents(r.data)).catch(() => undefined);
  }

  async function enroll() {
    const studentIds = Object.keys(selected).filter((k) => selected[k]);
    if (studentIds.length === 0) return;
    await api.post(`/groups/${id}/enroll`, { studentIds }).catch(() => undefined);
    setPicker(false);
    loadGroup();
  }

  async function removeStudent(studentId: string) {
    if (!window.confirm('Remove this student from the group?')) return;
    await api.delete(`/groups/${id}/enroll/${studentId}`).catch(() => undefined);
    loadGroup();
  }

  async function setTopic(topicId: string, status: string) {
    await api.post(`/curriculum/group/${id}/status`, { topicId, status }).catch(() => undefined);
    loadBoard();
  }

  if (!group) return <p className="text-muted-foreground">Loading…</p>;
  const active = group.enrollments.filter((e) => e.status === 'ACTIVE');

  return (
    <div className="space-y-6">
      <Link href="/groups" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
        <ArrowLeft size={14} /> Groups
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{group.name}</h1>
          <p className="text-sm text-muted-foreground">
            {group.subject.name} · {group.teacher ? `${group.teacher.firstName} ${group.teacher.lastName}` : 'No teacher'} · {formatMoney(group.monthlyFee)}/mo
          </p>
        </div>
        <Link href={`/attendance?group=${group.id}`}>
          <Button><CalendarCheck size={16} /> Mark attendance</Button>
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Schedule</CardTitle></CardHeader>
          <CardContent className="text-sm">
            {group.schedules.length === 0 ? (
              <span className="text-muted-foreground">No schedule set.</span>
            ) : (
              <ul className="space-y-1">
                {group.schedules.map((s) => (
                  <li key={s.id} className="flex justify-between">
                    <span className="font-medium">{s.weekday}</span>
                    <span className="text-muted-foreground">{s.startTime}–{s.endTime}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Students</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-semibold">{active.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Curriculum Coverage</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{board?.percentage ?? group.curriculumCoverage.percentage ?? 0}%</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {board?.topics.filter((t) => t.status === 'COMPLETED').length ?? group.curriculumCoverage.completedTopics} / {board?.topics.length ?? group.curriculumCoverage.totalTopics} topics
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Roster ({active.length})</CardTitle>
            {isAdmin && (
              <Button variant="outline" size="sm" onClick={picker ? () => setPicker(false) : openPicker}>
                {picker ? 'Cancel' : 'Add students'}
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {picker && (
              <div className="mb-3 rounded-md border border-border p-3">
                <Input placeholder="Search students…" value={studentSearch} onChange={(e) => setStudentSearch(e.target.value)} className="mb-2" />
                <div className="max-h-48 overflow-auto">
                  {allStudents
                    .filter((s) => !active.some((e) => e.student.id === s.id))
                    .filter((s) => `${s.firstName} ${s.lastName}`.toLowerCase().includes(studentSearch.toLowerCase()))
                    .map((s) => (
                      <label key={s.id} className="flex items-center gap-2 py-1 text-sm">
                        <input
                          type="checkbox"
                          checked={!!selected[s.id]}
                          onChange={(e) => setSelected({ ...selected, [s.id]: e.target.checked })}
                        />
                        {s.firstName} {s.lastName}
                      </label>
                    ))}
                </div>
                <Button size="sm" className="mt-2" onClick={enroll}>Enroll selected</Button>
              </div>
            )}
            {active.length === 0 ? (
              <p className="text-sm text-muted-foreground">No students enrolled.</p>
            ) : (
              <ul className="divide-y divide-border text-sm">
                {active.map((e) => (
                  <li key={e.student.id} className="flex items-center justify-between py-1.5">
                    <Link href={`/students/${e.student.id}`} className="font-medium hover:underline">
                      {e.student.firstName} {e.student.lastName}
                    </Link>
                    <div className="flex items-center gap-2">
                      <Badge tone={e.student.status === 'ACTIVE' ? 'green' : 'gray'}>{e.student.status}</Badge>
                      {isAdmin && (
                        <button onClick={() => removeStudent(e.student.id)} className="text-muted-foreground hover:text-red-600" title="Remove from group">✕</button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Curriculum</CardTitle></CardHeader>
          <CardContent>
            {!board || board.topics.length === 0 ? (
              <p className="text-sm text-muted-foreground">No curriculum topics for this subject yet.</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {board.topics.map((t) => (
                  <li key={t.topicId} className="flex items-center justify-between gap-2">
                    <span className={cn(t.status === 'COMPLETED' && 'text-muted-foreground line-through')}>{t.name}</span>
                    <div className="flex gap-1">
                      {TOPIC_STATES.map((st) => (
                        <button
                          key={st.key}
                          onClick={() => setTopic(t.topicId, st.key)}
                          title={st.key}
                          className={cn(
                            'h-7 w-7 rounded-md border border-border text-xs font-semibold',
                            t.status === st.key ? st.cls : 'bg-white hover:bg-muted',
                          )}
                        >
                          {st.label}
                        </button>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Exams</CardTitle></CardHeader>
        <CardContent>
          {exams.length === 0 ? (
            <p className="text-sm text-muted-foreground">No exams for this group.</p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {exams.map((ex) => (
                <li key={ex.id} className="flex items-center justify-between py-1.5">
                  <Link href={`/exams/${ex.id}`} className="font-medium hover:underline">{ex.name}</Link>
                  <span className="text-muted-foreground">
                    {formatDate(ex.date)} · max {Number(ex.maxScore)} · {ex._count.results} results
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
