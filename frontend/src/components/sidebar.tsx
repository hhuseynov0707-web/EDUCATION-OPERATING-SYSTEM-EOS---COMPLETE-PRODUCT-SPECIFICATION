'use client';

import {
  CalendarCheck,
  Contact,
  CreditCard,
  FileText,
  GraduationCap,
  LayoutDashboard,
  Layers,
  LogOut,
  MessageSquare,
  Settings,
  ShieldAlert,
  UserCog,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { APP_NAME } from '@/lib/brand';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['SUPER_ADMIN', 'ADMIN', 'TEACHER'] },
  { href: '/parent', label: 'My Children', icon: Users, roles: ['PARENT'] },
  { href: '/students', label: 'Students', icon: Users, roles: ['SUPER_ADMIN', 'ADMIN', 'TEACHER'] },
  { href: '/teachers', label: 'Teachers', icon: UserCog, roles: ['SUPER_ADMIN', 'ADMIN'] },
  { href: '/parents', label: 'Parents', icon: Contact, roles: ['SUPER_ADMIN', 'ADMIN'] },
  { href: '/groups', label: 'Groups', icon: Layers, roles: ['SUPER_ADMIN', 'ADMIN', 'TEACHER'] },
  { href: '/attendance', label: 'Attendance', icon: CalendarCheck, roles: ['SUPER_ADMIN', 'ADMIN', 'TEACHER'] },
  { href: '/exams', label: 'Exams', icon: GraduationCap, roles: ['SUPER_ADMIN', 'ADMIN', 'TEACHER'] },
  { href: '/messages', label: 'Messages', icon: MessageSquare, roles: ['SUPER_ADMIN', 'ADMIN', 'TEACHER', 'PARENT'] },
  { href: '/payments', label: 'Payments', icon: CreditCard, roles: ['SUPER_ADMIN', 'ADMIN'] },
  { href: '/risk', label: 'At-Risk', icon: ShieldAlert, roles: ['SUPER_ADMIN', 'ADMIN'] },
  { href: '/audit', label: 'Audit Log', icon: FileText, roles: ['SUPER_ADMIN', 'ADMIN'] },
  { href: '/settings', label: 'Settings', icon: Settings, roles: ['SUPER_ADMIN', 'ADMIN', 'TEACHER', 'PARENT'] },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const role = user?.role ?? '';

  return (
    <aside className="flex h-screen w-60 flex-col border-r border-border bg-white">
      <div className="px-5 py-5">
        <h1 className="text-lg font-semibold tracking-tight">{APP_NAME}</h1>
        <p className="text-xs text-muted-foreground">Education OS</p>
      </div>
      <nav className="flex-1 space-y-1 px-3">
        {NAV.filter((n) => n.roles.includes(role)).map((item) => {
          const active = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                active ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-muted',
              )}
            >
              <Icon size={18} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-border p-3">
        <div className="mb-2 px-2 text-xs text-muted-foreground">
          <div className="truncate font-medium text-foreground">{user?.email}</div>
          <div>{role.replace('_', ' ')}</div>
        </div>
        <button
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
        >
          <LogOut size={18} />
          Sign out
        </button>
      </div>
    </aside>
  );
}
