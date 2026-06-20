'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { api } from '@/lib/api';

interface Child {
  id: string;
  firstName: string;
  lastName: string;
  status: string;
  relationship: string | null;
}

const tone: Record<string, 'green' | 'amber' | 'gray' | 'red'> = {
  ACTIVE: 'green', FROZEN: 'amber', GRADUATED: 'gray', LEFT: 'red',
};

export default function ParentHomePage() {
  const [children, setChildren] = useState<Child[]>([]);

  useEffect(() => {
    api.get<Child[]>('/parent/children').then(setChildren).catch(() => undefined);
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">My Children</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {children.map((c) => (
          <Link key={c.id} href={`/parent/${c.id}`}>
            <Card className="h-full transition-shadow hover:shadow-md">
              <CardContent className="pt-5">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">{c.firstName} {c.lastName}</h3>
                  <Badge tone={tone[c.status] ?? 'gray'}>{c.status}</Badge>
                </div>
                {c.relationship && <p className="mt-1 text-sm text-muted-foreground capitalize">{c.relationship}</p>}
                <p className="mt-3 text-sm text-muted-foreground">View attendance, exams &amp; teacher notes →</p>
              </CardContent>
            </Card>
          </Link>
        ))}
        {children.length === 0 && <p className="text-sm text-muted-foreground">No children linked to your account yet. Please contact the academy.</p>}
      </div>
    </div>
  );
}
