'use client';

import { useEffect, useState } from 'react';
import { TrendChart } from '@/components/trend-chart';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';

interface SelfView {
  student: {
    firstName: string;
    lastName: string;
    status: string;
    enrollments: { group: { id: string; name: string; subject: { name: string } } }[];
  };
  analytics: {
    attendance: { rate: number | null; totalSessions: number; present: number; absent: number; late: number };
    progressScore: number | null;
    exams: { count: number; averagePercentage: number | null; history: { examName: string; date: string; percentage: number | null }[] };
  };
  notes: { id: string; type: string; content: string; createdAt: string; teacher: { firstName: string; lastName: string } | null }[];
}

const noteTone: Record<string, 'green' | 'amber' | 'blue' | 'gray'> = {
  STRENGTH: 'green', WEAKNESS: 'amber', PROGRESS: 'blue', LESSON: 'gray', GENERAL: 'gray',
};

function Stat({ title, value, sub }: { title: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">{value}</div>
        {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  );
}

export default function StudentPortalPage() {
  const [data, setData] = useState<SelfView | null>(null);

  useEffect(() => {
    api.get<SelfView>('/student/me').then(setData).catch(() => undefined);
  }, []);

  if (!data) return <p className="text-muted-foreground">Loading…</p>;
  const a = data.analytics;
  const trend = a.exams.history.filter((h) => h.percentage !== null).map((h) => h.percentage as number);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold">Hi, {data.student.firstName}!</h1>
        <Badge tone={data.student.status === 'ACTIVE' ? 'green' : 'gray'}>{data.student.status}</Badge>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat title="Attendance" value={a.attendance.rate !== null ? `${a.attendance.rate}%` : '—'} sub={`${a.attendance.present}P · ${a.attendance.absent}A · ${a.attendance.late}L`} />
        <Stat title="Progress Score" value={a.progressScore !== null ? String(a.progressScore) : '—'} />
        <Stat title="Exam Average" value={a.exams.averagePercentage !== null ? `${a.exams.averagePercentage}%` : '—'} sub={`${a.exams.count} exams`} />
        <Stat title="My Groups" value={String(data.student.enrollments.length)} sub={data.student.enrollments.map((e) => e.group.subject.name).join(', ') || '—'} />
      </div>

      <Card>
        <CardHeader><CardTitle>My Exam Trend</CardTitle></CardHeader>
        <CardContent><TrendChart points={trend} labels={a.exams.history.filter((h) => h.percentage !== null).map((h) => h.examName.slice(0, 6))} /></CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Teacher Notes</CardTitle></CardHeader>
        <CardContent>
          {data.notes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No notes yet.</p>
          ) : (
            <ul className="space-y-3">
              {data.notes.map((n) => (
                <li key={n.id} className="border-l-2 border-border pl-3">
                  <div className="flex items-center gap-2">
                    <Badge tone={noteTone[n.type] ?? 'gray'}>{n.type}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(n.createdAt)}{n.teacher ? ` · ${n.teacher.firstName} ${n.teacher.lastName}` : ''}
                    </span>
                  </div>
                  <p className="mt-1 text-sm">{n.content}</p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
