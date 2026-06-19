'use client';

import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

import { api } from '@/lib/api';

interface RiskRow {
  id: string;
  level: string;
  score: number;
  reasons: { code: string; message: string }[];
  student: { id: string; firstName: string; lastName: string };
}

const tone: Record<string, 'amber' | 'red'> = {
  MEDIUM: 'amber',
  HIGH: 'red',
  CRITICAL: 'red',
};

export default function RiskPage() {
  const [rows, setRows] = useState<RiskRow[]>([]);
  const [recomputing, setRecomputing] = useState(false);

  const load = useCallback(() => {
    api.get<RiskRow[]>('/risk?minLevel=MEDIUM').then(setRows).catch(() => undefined);
  }, []);

  useEffect(load, [load]);

  async function recompute() {
    setRecomputing(true);
    try {
      await api.post('/risk/recompute');
      load();
    } finally {
      setRecomputing(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">At-Risk Students</h1>
        <Button variant="outline" size="sm" onClick={recompute} disabled={recomputing}>
          {recomputing ? 'Recomputing…' : 'Recompute now'}
        </Button>
      </div>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2">Student</th>
              <th className="px-4 py-2">Level</th>
              <th className="px-4 py-2">Score</th>
              <th className="px-4 py-2">Reasons</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-border hover:bg-muted/50">
                <td className="px-4 py-2 font-medium">
                  {r.student.firstName} {r.student.lastName}
                </td>
                <td className="px-4 py-2">
                  <Badge tone={tone[r.level] ?? 'amber'}>{r.level}</Badge>
                </td>
                <td className="px-4 py-2">{r.score}</td>
                <td className="px-4 py-2 text-muted-foreground">
                  {r.reasons.map((x) => x.message).join('; ')}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                  No at-risk students. 🎉
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
