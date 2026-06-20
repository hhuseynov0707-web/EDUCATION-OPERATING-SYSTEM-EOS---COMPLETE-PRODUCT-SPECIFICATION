'use client';

import { CalendarCheck } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatMoney } from '@/lib/utils';

interface AdminDash {
  students: { total: number; active: number };
  teachers: { active: number };
  attendanceToday: { marked: number; present: number; rate: number | null };
  revenue: { expected: number; collected: number; overdue: number; month: number; year: number };
  risk: { LOW: number; MEDIUM: number; HIGH: number; CRITICAL: number; total: number };
  recentActivity: { id: string; action: string; entity: string; createdAt: string; actor?: { email: string } }[];
}

interface TeacherDash {
  groupCount: number;
  studentCount: number;
  todayLessons: { groupId: string; name: string; subject: string; students: number; attendanceMarked: boolean }[];
  groups: { id: string; name: string; subject: string; students: number }[];
}

function Stat({ title, value, sub, href }: { title: string; value: string; sub?: string; href?: string }) {
  const inner = (
    <Card className={href ? 'h-full transition-shadow hover:shadow-md' : undefined}>
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">{value}</div>
        {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';
  const [admin, setAdmin] = useState<AdminDash | null>(null);
  const [teacher, setTeacher] = useState<TeacherDash | null>(null);

  useEffect(() => {
    if (user?.role === 'PARENT') {
      router.replace('/parent');
      return;
    }
    if (user?.role === 'STUDENT') {
      router.replace('/student');
      return;
    }
    if (isAdmin) api.get<AdminDash>('/dashboard/admin').then(setAdmin).catch(() => undefined);
    else if (user?.role === 'TEACHER') api.get<TeacherDash>('/dashboard/teacher').then(setTeacher).catch(() => undefined);
  }, [isAdmin, user, router]);

  if (isAdmin) {
    if (!admin) return <p className="text-muted-foreground">Loading dashboard…</p>;
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Admin Dashboard</h1>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat title="Total Students" value={String(admin.students.total)} sub={`${admin.students.active} active`} href="/students" />
          <Stat title="Active Teachers" value={String(admin.teachers.active)} />
          <Stat
            title="Today's Attendance"
            value={admin.attendanceToday.rate !== null ? `${admin.attendanceToday.rate}%` : '—'}
            sub={`${admin.attendanceToday.present}/${admin.attendanceToday.marked} present`}
            href="/attendance"
          />
          <Stat title="At-Risk Students" value={String(admin.risk.total)} sub={`${admin.risk.HIGH} high · ${admin.risk.CRITICAL} critical`} href="/risk" />
          <Stat title="Expected Revenue" value={formatMoney(admin.revenue.expected)} sub="this month" href="/payments" />
          <Stat title="Collected" value={formatMoney(admin.revenue.collected)} sub="this month" href="/payments" />
          <Stat title="Overdue" value={formatMoney(admin.revenue.overdue)} sub="outstanding" href="/payments" />
        </div>

        <Card>
          <CardHeader><CardTitle>Recent Activity</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {admin.recentActivity.map((a) => (
                <li key={a.id} className="flex justify-between border-b border-border pb-1 last:border-0">
                  <span><span className="font-medium">{a.action}</span> {a.entity}</span>
                  <span className="text-muted-foreground">
                    {a.actor?.email ?? 'system'} · {new Date(a.createdAt).toLocaleString()}
                  </span>
                </li>
              ))}
              {admin.recentActivity.length === 0 && <li className="text-muted-foreground">No activity yet.</li>}
            </ul>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!teacher) return <p className="text-muted-foreground">Loading dashboard…</p>;
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Teacher Dashboard</h1>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat title="My Groups" value={String(teacher.groupCount)} href="/groups" />
        <Stat title="My Students" value={String(teacher.studentCount)} href="/students" />
        <Stat title="Today's Lessons" value={String(teacher.todayLessons.length)} />
      </div>

      <Card>
        <CardHeader><CardTitle>Today&apos;s Lessons</CardTitle></CardHeader>
        <CardContent>
          {teacher.todayLessons.length === 0 ? (
            <p className="text-sm text-muted-foreground">No lessons scheduled today.</p>
          ) : (
            <ul className="space-y-2">
              {teacher.todayLessons.map((l) => (
                <li key={l.groupId} className="flex items-center justify-between rounded-md border border-border p-3">
                  <div>
                    <Link href={`/groups/${l.groupId}`} className="font-medium hover:underline">{l.name}</Link>
                    <span className="text-muted-foreground"> · {l.subject} · {l.students} students</span>
                  </div>
                  <Link href={`/attendance?group=${l.groupId}`}>
                    <Button variant={l.attendanceMarked ? 'outline' : 'default'} size="sm">
                      <CalendarCheck size={14} />
                      {l.attendanceMarked ? 'Edit attendance' : 'Mark attendance'}
                    </Button>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>My Groups</CardTitle></CardHeader>
        <CardContent>
          {teacher.groups.length === 0 ? (
            <p className="text-sm text-muted-foreground">No groups assigned.</p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {teacher.groups.map((g) => (
                <li key={g.id} className="flex items-center justify-between py-1.5">
                  <Link href={`/groups/${g.id}`} className="font-medium hover:underline">{g.name}</Link>
                  <span className="text-muted-foreground">{g.subject} · {g.students} students</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
