'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { keys, usage } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Key, BarChart3, BookOpen } from 'lucide-react';

export default function DashboardPage() {
  const { user } = useAuth();
  const [keyCount, setKeyCount] = useState<number | null>(null);
  const [totalUsage, setTotalUsage] = useState<number | null>(null);

  useEffect(() => {
    keys.list().then((r) => setKeyCount(r.keys.length)).catch(() => setKeyCount(0));
    usage.get(30).then((r) => setTotalUsage(r.total)).catch(() => setTotalUsage(0));
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back, {user?.name}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">API Keys</CardTitle>
            <Key className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{keyCount ?? '—'}</p>
            <p className="text-xs text-muted-foreground">Create and manage keys</p>
            <Button variant="outline" size="sm" className="mt-2" asChild>
              <Link href="/dashboard/keys">Manage keys</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">API calls (30 days)</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalUsage ?? '—'}</p>
            <p className="text-xs text-muted-foreground">Total requests</p>
            <Button variant="outline" size="sm" className="mt-2" asChild>
              <Link href="/dashboard/usage">View usage</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quick start</CardTitle>
          <CardDescription>Get your API key and start making requests</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
            <li>Create an API key in the API Keys section.</li>
            <li>Use the key in the <code className="rounded bg-muted px-1">X-API-Key</code> header or <code className="rounded bg-muted px-1">apiKey</code> query parameter.</li>
            <li>Check the Documentation for available endpoints and examples.</li>
          </ol>
          <Button asChild>
            <Link href="/dashboard/docs" className="inline-flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              View documentation
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
