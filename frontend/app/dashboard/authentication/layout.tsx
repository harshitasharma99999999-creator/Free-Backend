'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const tabs = [
  { href: '/dashboard/authentication/users', label: 'Users' },
  { href: '/dashboard/authentication/sign-in-method', label: 'Sign-in method' },
];

export default function AuthenticationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Authentication</h1>
        <p className="text-muted-foreground">
          Manage how your app users sign in and view registered users
        </p>
      </div>
      <div className="border-b border-border">
        <nav className="flex gap-6">
          {tabs.map((tab) => {
            const active = pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  'pb-3 text-sm font-medium border-b-2 transition-colors -mb-px',
                  active ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
                )}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>
      {children}
    </div>
  );
}
