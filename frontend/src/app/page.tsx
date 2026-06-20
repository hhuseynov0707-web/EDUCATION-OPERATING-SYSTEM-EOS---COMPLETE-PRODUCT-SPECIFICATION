'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/lib/auth';

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
    } else {
      router.replace(user.role === 'PARENT' ? '/parent' : '/dashboard');
    }
  }, [user, loading, router]);

  return (
    <div className="flex h-screen items-center justify-center text-muted-foreground">
      Loading…
    </div>
  );
}
