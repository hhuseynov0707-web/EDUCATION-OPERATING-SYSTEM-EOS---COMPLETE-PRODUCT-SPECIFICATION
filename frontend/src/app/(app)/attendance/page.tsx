'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

interface Group { id: string; name: string }
interface GridStudent { id: string; firstName: string; lastName: string }
interface GridData {
  group: { id: string; name: string };
  dates: string[];
  students: GridStudent[];
  records: Record<string, Record<string, string>>;
}

type Status = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
const CYCLE: Status[] = ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'];
const LETTER: Record<Status, string> = { PRESENT: 'P', ABSENT: 'A', LATE: 'L', EXCUSED: 'E' };
const CELL_CLS: Record<Status, string> = {
  PRESENT: 'bg-green-600 text-white',
  ABSENT: 'bg-red-600 text-white',
  LATE: 'bg-amber-500 text-white',
  EXCUSED: 'bg-blue-600 text-white',
};
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function AttendancePage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupId, setGroupId] = useState('');
  const now = new Date();
  const [ym, setYm] = useState({ y: now.getUTCFullYear(), m: now.getUTCMonth() }); // m: 0-11
  const [grid, setGrid] = useState<GridData | null>(null);
  const [changes, setChanges] = useState<Record<string, Record<string, Status>>>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    api.get<{ data: Group[] }>('/groups?limit=500').then((r) => {
      setGroups(r.data);
      const pre = new URLSearchParams(window.location.search).get('group');
      if (pre && r.data.some((g) => g.id === pre)) setGroupId(pre);
      else if (r.data[0]) setGroupId(r.data[0].id);
    }).catch(() => undefined);
  }, []);

  const load = useCallback(() => {
    if (!groupId) return;
    const from = `${ym.y}-${String(ym.m + 1).padStart(2, '0')}-01`;
    const lastDay = new Date(Date.UTC(ym.y, ym.m + 1, 0)).getUTCDate();
    const to = `${ym.y}-${String(ym.m + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    api.get<GridData>(`/attendance/grid?groupId=${groupId}&from=${from}&to=${to}`)
      .then((g) => { setGrid(g); setChanges({}); setMsg(null); })
      .catch((e) => setMsg(e instanceof Error ? e.message : 'Could not load attendance.'));
  }, [groupId, ym]);

  useEffect(load, [load]);

  function statusOf(sid: string, date: string): Status | null {
    return changes[sid]?.[date] ?? (grid?.records[sid]?.[date] as Status | undefined) ?? null;
  }

  function cycle(sid: string, date: string) {
    const cur = statusOf(sid, date);
    const next = cur === null ? CYCLE[0] : CYCLE[(CYCLE.indexOf(cur) + 1) % CYCLE.length];
    setChanges((c) => ({ ...c, [sid]: { ...(c[sid] ?? {}), [date]: next } }));
  }

  function fillColumnPresent(date: string) {
    if (!grid) return;
    setChanges((c) => {
      const next = { ...c };
      for (const s of grid.students) {
        if (statusOf(s.id, date) === null) next[s.id] = { ...(next[s.id] ?? {}), [date]: 'PRESENT' };
      }
      return next;
    });
  }

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const byDate: Record<string, { studentId: string; status: Status }[]> = {};
      for (const sid of Object.keys(changes)) {
        for (const date of Object.keys(changes[sid])) {
          (byDate[date] ??= []).push({ studentId: sid, status: changes[sid][date] });
        }
      }
      const dates = Object.keys(byDate);
      for (const date of dates) {
        await api.post('/attendance/mark', { groupId, date, records: byDate[date] });
      }
      setMsg(`Saved ${dates.length} day(s).`);
      load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  const changeCount = Object.values(changes).reduce((n, d) => n + Object.keys(d).length, 0);

  function shiftMonth(delta: number) {
    setYm(({ y, m }) => {
      const nm = m + delta;
      return { y: y + Math.floor(nm / 12), m: ((nm % 12) + 12) % 12 };
    });
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Attendance</h1>

      <div className="flex flex-wrap items-center gap-3">
        <select
          className="h-9 rounded-md border border-border bg-white px-3 text-sm"
          value={groupId}
          onChange={(e) => setGroupId(e.target.value)}
        >
          {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" onClick={() => shiftMonth(-1)}><ChevronLeft size={16} /></Button>
          <span className="w-40 text-center text-sm font-medium">{MONTHS[ym.m]} {ym.y}</span>
          <Button variant="outline" size="icon" onClick={() => shiftMonth(1)}><ChevronRight size={16} /></Button>
        </div>
        <div className="ml-auto flex items-center gap-3">
          {msg && <span className="text-sm text-muted-foreground">{msg}</span>}
          <Button onClick={save} disabled={saving || changeCount === 0}>
            {saving ? 'Saving…' : `Save${changeCount ? ` (${changeCount})` : ''}`}
          </Button>
        </div>
      </div>

      <div className="flex gap-3 text-xs text-muted-foreground">
        <span><b className="text-green-600">P</b> Present</span>
        <span><b className="text-red-600">A</b> Absent</span>
        <span><b className="text-amber-600">L</b> Late</span>
        <span><b className="text-blue-600">E</b> Excused</span>
        <span>· Click a cell to cycle · click a date header to fill the column Present</span>
      </div>

      <Card className="overflow-x-auto">
        {!grid ? (
          <p className="p-6 text-sm text-muted-foreground">Loading…</p>
        ) : grid.dates.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">
            No class days this month. Set the group&apos;s weekly schedule (Groups → Edit settings) so attendance days appear here.
          </p>
        ) : grid.students.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">No students enrolled in this group.</p>
        ) : (
          <table className="border-collapse text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 border-b border-r border-border bg-muted px-3 py-2 text-left text-xs uppercase text-muted-foreground">
                  Student
                </th>
                {grid.dates.map((d) => {
                  const dt = new Date(`${d}T00:00:00Z`);
                  return (
                    <th
                      key={d}
                      onClick={() => fillColumnPresent(d)}
                      title="Click to fill this day Present"
                      className="cursor-pointer border-b border-border bg-muted px-1 py-1 text-center text-[11px] font-medium text-muted-foreground hover:bg-gray-200"
                    >
                      <div>{dt.getUTCDate()}</div>
                      <div className="text-[9px]">{WD[dt.getUTCDay()]}</div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {grid.students.map((s) => (
                <tr key={s.id}>
                  <td className="sticky left-0 z-10 whitespace-nowrap border-b border-r border-border bg-white px-3 py-1.5 font-medium">
                    {s.firstName} {s.lastName}
                  </td>
                  {grid.dates.map((d) => {
                    const st = statusOf(s.id, d);
                    const changed = changes[s.id]?.[d] !== undefined;
                    return (
                      <td key={d} className="border-b border-border p-0.5 text-center">
                        <button
                          onClick={() => cycle(s.id, d)}
                          className={cn(
                            'h-7 w-7 rounded text-xs font-semibold',
                            st ? CELL_CLS[st] : 'bg-gray-50 text-gray-300 hover:bg-gray-100',
                            changed && 'ring-2 ring-offset-1 ring-primary',
                          )}
                        >
                          {st ? LETTER[st] : '·'}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
