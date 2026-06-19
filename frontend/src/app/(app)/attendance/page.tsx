'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

interface Group {
  id: string;
  name: string;
}
interface RosterStudent {
  studentId: string;
  firstName: string;
  lastName: string;
  status: AttStatus | null;
}
interface Roster {
  group: { id: string; name: string };
  date: string;
  students: RosterStudent[];
}
type AttStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';

const STATUSES: { key: AttStatus; label: string; active: string }[] = [
  { key: 'PRESENT', label: 'P', active: 'bg-green-600 text-white' },
  { key: 'ABSENT', label: 'A', active: 'bg-red-600 text-white' },
  { key: 'LATE', label: 'L', active: 'bg-amber-500 text-white' },
  { key: 'EXCUSED', label: 'E', active: 'bg-blue-600 text-white' },
];

export default function AttendancePage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupId, setGroupId] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [marks, setMarks] = useState<Record<string, AttStatus>>({});
  const [roster, setRoster] = useState<Roster | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ data: Group[] }>('/groups?limit=100')
      .then((r) => {
        setGroups(r.data);
        // Preselect via ?group=<id> (e.g. from the teacher dashboard), else first.
        const pre = new URLSearchParams(window.location.search).get('group');
        if (pre && r.data.some((g) => g.id === pre)) setGroupId(pre);
        else if (r.data[0]) setGroupId(r.data[0].id);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!groupId || !date) return;
    api
      .get<Roster>(`/attendance/roster?groupId=${groupId}&date=${date}`)
      .then((r) => {
        setRoster(r);
        const initial: Record<string, AttStatus> = {};
        r.students.forEach((s) => {
          if (s.status) initial[s.studentId] = s.status;
        });
        setMarks(initial);
        setSavedMsg(null);
      })
      .catch(() => undefined);
  }, [groupId, date]);

  function setAll(status: AttStatus) {
    if (!roster) return;
    const next: Record<string, AttStatus> = {};
    roster.students.forEach((s) => (next[s.studentId] = status));
    setMarks(next);
  }

  async function save() {
    if (!roster) return;
    setSaving(true);
    setSavedMsg(null);
    try {
      const records = roster.students
        .filter((s) => marks[s.studentId])
        .map((s) => ({ studentId: s.studentId, status: marks[s.studentId] }));
      const res = await api.post<{ saved: number }>('/attendance/mark', { groupId, date, records });
      setSavedMsg(`Saved ${res.saved} records.`);
    } catch (e) {
      setSavedMsg(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  const markedCount = roster ? roster.students.filter((s) => marks[s.studentId]).length : 0;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Attendance</h1>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Group</label>
          <select
            className="h-9 rounded-md border border-border bg-white px-3 text-sm"
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
          >
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Date</label>
          <input
            type="date"
            className="h-9 rounded-md border border-border bg-white px-3 text-sm"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div className="flex gap-1">
          <Button variant="outline" size="sm" onClick={() => setAll('PRESENT')}>
            All present
          </Button>
        </div>
      </div>

      {roster && (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2">Student</th>
                <th className="px-4 py-2 text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              {roster.students.map((s) => (
                <tr key={s.studentId} className="border-t border-border">
                  <td className="px-4 py-2 font-medium">
                    {s.firstName} {s.lastName}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex justify-end gap-1">
                      {STATUSES.map((st) => (
                        <button
                          key={st.key}
                          onClick={() => setMarks((m) => ({ ...m, [s.studentId]: st.key }))}
                          className={cn(
                            'h-8 w-8 rounded-md border border-border text-xs font-semibold',
                            marks[s.studentId] === st.key ? st.active : 'bg-white hover:bg-muted',
                          )}
                          title={st.key}
                        >
                          {st.label}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
              {roster.students.length === 0 && (
                <tr>
                  <td colSpan={2} className="px-4 py-6 text-center text-muted-foreground">
                    No students enrolled in this group.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      )}

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={saving || markedCount === 0}>
          {saving ? 'Saving…' : `Save attendance (${markedCount})`}
        </Button>
        {savedMsg && <span className="text-sm text-muted-foreground">{savedMsg}</span>}
      </div>
    </div>
  );
}
