'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { api } from '@/lib/api';
import { formatMoney } from '@/lib/utils';

interface GroupRow {
  id: string;
  name: string;
  monthlyFee: string;
  subject: { name: string };
  teacher: { firstName: string; lastName: string } | null;
  schedules: { weekday: string; startTime: string; endTime: string }[];
  _count: { enrollments: number };
}

export default function GroupsPage() {
  const [groups, setGroups] = useState<GroupRow[]>([]);

  useEffect(() => {
    api.get<{ data: GroupRow[] }>('/groups?limit=100').then((r) => setGroups(r.data)).catch(() => undefined);
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Groups</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {groups.map((g) => (
          <Link key={g.id} href={`/groups/${g.id}`}>
            <Card className="h-full transition-shadow hover:shadow-md">
              <CardContent className="pt-5">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold">{g.name}</h3>
                    <p className="text-sm text-muted-foreground">{g.subject.name}</p>
                  </div>
                  <span className="text-sm font-medium">{formatMoney(g.monthlyFee)}/mo</span>
                </div>
                <div className="mt-3 space-y-1 text-sm text-muted-foreground">
                  <div>{g.teacher ? `${g.teacher.firstName} ${g.teacher.lastName}` : 'No teacher assigned'}</div>
                  <div>{g._count.enrollments} students</div>
                  <div>
                    {g.schedules.length > 0
                      ? g.schedules.map((s) => `${s.weekday} ${s.startTime}`).join(', ')
                      : 'No schedule'}
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
        {groups.length === 0 && <p className="text-sm text-muted-foreground">No groups yet.</p>}
      </div>
    </div>
  );
}
