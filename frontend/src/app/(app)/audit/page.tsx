'use client';

import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { api } from '@/lib/api';

interface AuditRow {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  newValue: Record<string, unknown> | null;
  ip: string | null;
  createdAt: string;
  actor: { email: string; role: string } | null;
}
interface Paged {
  data: AuditRow[];
  meta: { page: number; total: number; totalPages: number };
}

const ACTIONS = ['', 'CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'EXPORT'];
const ENTITIES = ['', 'Student', 'Teacher', 'Group', 'Payment', 'Attendance', 'Exam', 'ExamResult', 'TeacherNote', 'CurriculumProgress', 'User'];
const actionTone: Record<string, 'green' | 'amber' | 'red' | 'blue' | 'gray'> = {
  CREATE: 'green', UPDATE: 'amber', DELETE: 'red', LOGIN: 'blue', LOGOUT: 'gray', EXPORT: 'gray',
};

export default function AuditPage() {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');
  const [entity, setEntity] = useState('');
  const [result, setResult] = useState<Paged | null>(null);

  const load = useCallback(() => {
    const params = new URLSearchParams({ page: String(page), limit: '25' });
    if (action) params.set('action', action);
    if (entity) params.set('entity', entity);
    api.get<Paged>(`/audit-logs?${params}`).then(setResult).catch(() => undefined);
  }, [page, action, entity]);

  useEffect(load, [load]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Audit Log</h1>
      <p className="text-sm text-muted-foreground">Every sensitive change is recorded — who, what, when, and from where.</p>

      <div className="flex gap-2">
        <Select value={action} onChange={(e) => { setPage(1); setAction(e.target.value); }}>
          {ACTIONS.map((a) => <option key={a || 'all'} value={a}>{a || 'All actions'}</option>)}
        </Select>
        <Select value={entity} onChange={(e) => { setPage(1); setEntity(e.target.value); }}>
          {ENTITIES.map((en) => <option key={en || 'all'} value={en}>{en || 'All entities'}</option>)}
        </Select>
      </div>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2">When</th>
              <th className="px-4 py-2">Actor</th>
              <th className="px-4 py-2">Action</th>
              <th className="px-4 py-2">Entity</th>
              <th className="px-4 py-2">Details</th>
              <th className="px-4 py-2">IP</th>
            </tr>
          </thead>
          <tbody>
            {result?.data.map((r) => (
              <tr key={r.id} className="border-t border-border align-top hover:bg-muted/50">
                <td className="px-4 py-2 whitespace-nowrap text-muted-foreground">{new Date(r.createdAt).toLocaleString()}</td>
                <td className="px-4 py-2">{r.actor?.email ?? 'system'}</td>
                <td className="px-4 py-2"><Badge tone={actionTone[r.action] ?? 'gray'}>{r.action}</Badge></td>
                <td className="px-4 py-2">{r.entity}{r.entityId ? <span className="text-muted-foreground"> #{r.entityId.slice(0, 8)}</span> : ''}</td>
                <td className="px-4 py-2 max-w-xs truncate text-muted-foreground" title={r.newValue ? JSON.stringify(r.newValue) : ''}>
                  {r.newValue ? JSON.stringify(r.newValue) : '—'}
                </td>
                <td className="px-4 py-2 text-muted-foreground">{r.ip ?? '—'}</td>
              </tr>
            ))}
            {result && result.data.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">No matching audit entries.</td></tr>
            )}
          </tbody>
        </table>
      </Card>

      {result && result.meta.totalPages > 1 && (
        <div className="flex items-center gap-2 text-sm">
          <button className="rounded border border-border px-3 py-1 disabled:opacity-40" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</button>
          <span className="text-muted-foreground">Page {result.meta.page} of {result.meta.totalPages}</span>
          <button className="rounded border border-border px-3 py-1 disabled:opacity-40" disabled={page >= result.meta.totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
        </div>
      )}
    </div>
  );
}
