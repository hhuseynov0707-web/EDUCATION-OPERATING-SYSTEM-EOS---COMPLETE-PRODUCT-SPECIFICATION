'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { TrendChart } from '@/components/trend-chart';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDate, formatMoney } from '@/lib/utils';

const STUDENT_STATUSES = ['ACTIVE', 'FROZEN', 'GRADUATED', 'LEFT'];

interface StudentDetail {
  id: string;
  firstName: string;
  lastName: string;
  status: string;
  phone: string | null;
  email: string | null;
  dateOfBirth: string | null;
  enrollmentDate: string;
  branch: { name: string } | null;
  user: { email: string } | null;
  enrollments: { status: string; group: { id: string; name: string; subject: { name: string } } }[];
  parentLinks: { relationship: string | null; parent: { firstName: string; lastName: string; phone: string | null } }[];
  riskFlags: { level: string; score: number; reasons: { message: string }[] }[];
  analytics: {
    attendance: { rate: number | null; totalSessions: number; present: number; absent: number; late: number; excused: number };
    payments: { overdueCount: number; pendingCount: number; outstandingAmount: number };
    exams: { count: number; averagePercentage: number | null; history: { examName: string; date: string; percentage: number | null }[] };
    progressScore: number | null;
  };
}

interface Note {
  id: string;
  type: string;
  content: string;
  createdAt: string;
  teacher: { firstName: string; lastName: string } | null;
  author: { email: string } | null;
}

const NOTE_TYPES = ['GENERAL', 'LESSON', 'PROGRESS', 'STRENGTH', 'WEAKNESS'];
const statusTone: Record<string, 'green' | 'amber' | 'red' | 'gray'> = {
  ACTIVE: 'green', FROZEN: 'amber', GRADUATED: 'gray', LEFT: 'red',
};
const riskTone: Record<string, 'green' | 'amber' | 'red'> = { LOW: 'green', MEDIUM: 'amber', HIGH: 'red', CRITICAL: 'red' };
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

export default function StudentProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';
  const [student, setStudent] = useState<StudentDetail | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [noteType, setNoteType] = useState('GENERAL');
  const [noteText, setNoteText] = useState('');
  const [saving, setSaving] = useState(false);

  const [editing, setEditing] = useState(false);
  const [ef, setEf] = useState({ firstName: '', lastName: '', phone: '', email: '', dateOfBirth: '', status: 'ACTIVE', enrollmentDate: '' });
  const [savingEdit, setSavingEdit] = useState(false);

  const loadStudent = useCallback(() => {
    api.get<StudentDetail>(`/students/${id}`).then(setStudent).catch(() => undefined);
  }, [id]);
  const loadNotes = useCallback(() => {
    api.get<Note[]>(`/notes/student/${id}`).then(setNotes).catch(() => undefined);
  }, [id]);

  useEffect(() => {
    loadStudent();
    loadNotes();
  }, [id, loadStudent, loadNotes]);

  function openEdit() {
    if (!student) return;
    setEditing(true);
    setEf({
      firstName: student.firstName,
      lastName: student.lastName,
      phone: student.phone ?? '',
      email: student.email ?? '',
      dateOfBirth: student.dateOfBirth ? student.dateOfBirth.slice(0, 10) : '',
      status: student.status,
      enrollmentDate: student.enrollmentDate ? student.enrollmentDate.slice(0, 10) : '',
    });
  }

  async function createLogin() {
    const email = window.prompt("Student's login email:");
    if (!email) return;
    const password = window.prompt('Temporary password (min 8 chars):');
    if (!password) return;
    if (password.length < 8) { alert('Password must be at least 8 characters.'); return; }
    try {
      await api.post(`/students/${id}/account`, { email, password });
      alert(`Login created. The student signs in with ${email}.`);
      loadStudent();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Could not create login.');
    }
  }

  async function resetLogin() {
    const np = window.prompt('New password for this student (min 8 chars):');
    if (!np) return;
    if (np.length < 8) { alert('Password must be at least 8 characters.'); return; }
    try {
      await api.post(`/students/${id}/reset-password`, { newPassword: np });
      alert('Password updated. Share it with the student.');
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Could not reset password.');
    }
  }

  async function saveEdit() {
    setSavingEdit(true);
    try {
      await api.patch(`/students/${id}`, {
        firstName: ef.firstName,
        lastName: ef.lastName,
        phone: ef.phone || undefined,
        email: ef.email || undefined,
        dateOfBirth: ef.dateOfBirth || undefined,
        status: ef.status,
        enrollmentDate: ef.enrollmentDate || undefined,
      });
      setEditing(false);
      loadStudent();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Could not save student.');
    } finally {
      setSavingEdit(false);
    }
  }

  async function addNote() {
    if (!noteText.trim()) return;
    setSaving(true);
    try {
      await api.post('/notes', { studentId: id, type: noteType, content: noteText.trim() });
      setNoteText('');
      loadNotes();
    } finally {
      setSaving(false);
    }
  }

  if (!student) return <p className="text-muted-foreground">Loading…</p>;

  const a = student.analytics;
  const risk = student.riskFlags[0];
  const trend = a.exams.history.filter((h) => h.percentage !== null);

  return (
    <div className="space-y-6">
      <Link href="/students" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
        <ArrowLeft size={14} /> Students
      </Link>

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">{student.firstName} {student.lastName}</h1>
        <Badge tone={statusTone[student.status] ?? 'gray'}>{student.status}</Badge>
        {risk && risk.score > 0 && <Badge tone={riskTone[risk.level]}>RISK: {risk.level} ({risk.score})</Badge>}
        {isAdmin && (
          <div className="ml-auto flex gap-2">
            {student.user ? (
              <Button variant="outline" size="sm" onClick={resetLogin}>Reset login password</Button>
            ) : (
              <Button variant="outline" size="sm" onClick={createLogin}>Create login</Button>
            )}
            <Button variant="outline" size="sm" onClick={editing ? () => setEditing(false) : openEdit}>
              {editing ? 'Cancel' : 'Edit'}
            </Button>
          </div>
        )}
      </div>

      {isAdmin && student.user && (
        <p className="text-sm text-muted-foreground">Student login: <span className="font-medium">{student.user.email}</span></p>
      )}

      {editing && isAdmin && (
        <Card>
          <CardHeader><CardTitle>Edit student</CardTitle></CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div><label className="mb-1 block text-xs font-medium text-muted-foreground">First name</label><Input value={ef.firstName} onChange={(e) => setEf({ ...ef, firstName: e.target.value })} /></div>
              <div><label className="mb-1 block text-xs font-medium text-muted-foreground">Last name</label><Input value={ef.lastName} onChange={(e) => setEf({ ...ef, lastName: e.target.value })} /></div>
              <div><label className="mb-1 block text-xs font-medium text-muted-foreground">Phone</label><Input value={ef.phone} onChange={(e) => setEf({ ...ef, phone: e.target.value })} /></div>
              <div><label className="mb-1 block text-xs font-medium text-muted-foreground">Email</label><Input type="email" value={ef.email} onChange={(e) => setEf({ ...ef, email: e.target.value })} /></div>
              <div><label className="mb-1 block text-xs font-medium text-muted-foreground">Date of birth</label><Input type="date" value={ef.dateOfBirth} onChange={(e) => setEf({ ...ef, dateOfBirth: e.target.value })} /></div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Enrollment date</label>
                <Input type="date" value={ef.enrollmentDate} onChange={(e) => setEf({ ...ef, enrollmentDate: e.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Status</label>
                <Select value={ef.status} onChange={(e) => setEf({ ...ef, status: e.target.value })} className="w-full">
                  {STUDENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </Select>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <Button onClick={saveEdit} disabled={savingEdit}>{savingEdit ? 'Saving…' : 'Save changes'}</Button>
              <Button variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {risk && risk.score > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-4 text-sm text-red-800">
            <span className="font-medium">Why at risk: </span>
            {risk.reasons.map((r) => r.message).join(' · ')}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat title="Attendance" value={a.attendance.rate !== null ? `${a.attendance.rate}%` : '—'} sub={`${a.attendance.present}P · ${a.attendance.absent}A · ${a.attendance.late}L over ${a.attendance.totalSessions}`} />
        <Stat title="Progress Score" value={a.progressScore !== null ? String(a.progressScore) : '—'} sub="exams + attendance" />
        <Stat title="Exam Average" value={a.exams.averagePercentage !== null ? `${a.exams.averagePercentage}%` : '—'} sub={`${a.exams.count} exams`} />
        <Stat title="Outstanding" value={formatMoney(a.payments.outstandingAmount)} sub={`${a.payments.overdueCount} overdue · ${a.payments.pendingCount} pending`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Exam Trend</CardTitle></CardHeader>
          <CardContent>
            <TrendChart points={trend.map((t) => t.percentage as number)} labels={trend.map((t) => t.examName.slice(0, 6))} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Details</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            <Row k="Phone" v={student.phone ?? '—'} />
            <Row k="Email" v={student.email ?? '—'} />
            <Row k="Date of birth" v={formatDate(student.dateOfBirth)} />
            <Row k="Enrolled" v={formatDate(student.enrollmentDate)} />
            <Row k="Branch" v={student.branch?.name ?? '—'} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Groups</CardTitle></CardHeader>
          <CardContent>
            {student.enrollments.length === 0 ? (
              <p className="text-sm text-muted-foreground">Not enrolled in any group.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {student.enrollments.map((e) => (
                  <li key={e.group.id} className="flex items-center justify-between">
                    <Link href={`/groups/${e.group.id}`} className="hover:underline">
                      {e.group.name} <span className="text-muted-foreground">({e.group.subject.name})</span>
                    </Link>
                    <Badge tone={e.status === 'ACTIVE' ? 'green' : 'gray'}>{e.status}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Parents / Guardians</CardTitle></CardHeader>
          <CardContent>
            {student.parentLinks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No parent linked.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {student.parentLinks.map((p, i) => (
                  <li key={i} className="flex justify-between">
                    <span>{p.parent.firstName} {p.parent.lastName} {p.relationship ? `(${p.relationship})` : ''}</span>
                    <span className="text-muted-foreground">{p.parent.phone ?? '—'}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Notes &amp; Academic History</CardTitle></CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-col gap-2 sm:flex-row">
            <Select value={noteType} onChange={(e) => setNoteType(e.target.value)} className="sm:w-40">
              {NOTE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
            <Textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Add a note (e.g. 'Strong in algebra, needs work on geometry')…"
              rows={2}
              className="flex-1"
            />
            <Button onClick={addNote} disabled={saving || !noteText.trim()}>
              {saving ? 'Saving…' : 'Add'}
            </Button>
          </div>

          {notes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No notes yet.</p>
          ) : (
            <ul className="space-y-3">
              {notes.map((n) => (
                <li key={n.id} className="border-l-2 border-border pl-3">
                  <div className="flex items-center gap-2">
                    <Badge tone={noteTone[n.type] ?? 'gray'}>{n.type}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(n.createdAt)} · {n.teacher ? `${n.teacher.firstName} ${n.teacher.lastName}` : n.author?.email ?? 'system'}
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

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-medium">{v}</span>
    </div>
  );
}
