'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { keys, usage } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Key, BarChart3, BookOpen, Image, Video, CreditCard, Zap } from 'lucide-react';

export default function DashboardPage() {
  const { user } = useAuth();
  const [keyCount, setKeyCount] = useState<number | null>(null);
  const [totalUsage, setTotalUsage] = useState<number | null>(null);

  useEffect(() => {
    keys.list().then((r) => setKeyCount(r.keys.length)).catch(() => setKeyCount(0));
    usage.get(30).then((r) => setTotalUsage(r.total)).catch(() => setTotalUsage(0));
  }, []);

  const plan = user?.plan || 'free';
  const imageCredits = user?.imageCredits ?? 0;
  const videoCredits = user?.videoCredits ?? 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back, {user?.name}</p>
      </div>

      {/* Plan & Credits banner */}
      <div className="rounded-lg border border-border bg-gradient-to-r from-primary/5 to-primary/10 p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Zap className="h-5 w-5 text-primary" />
            <div>
              <p className="font-semibold capitalize">{plan} Plan</p>
              <p className="text-sm text-muted-foreground">
                {plan === 'free' ? 'Upgrade for more credits' : 'Thank you for subscribing'}
              </p>
            </div>
          </div>
          {plan === 'free' && (
            <Button asChild size="sm">
              <Link href="/pricing">Upgrade</Link>
            </Button>
          )}
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Image Credits</CardTitle>
            <Image className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{imageCredits}</p>
            <p className="text-xs text-muted-foreground">1 credit per image</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Video Credits</CardTitle>
            <Video className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{videoCredits}</p>
            <p className="text-xs text-muted-foreground">5 credits per video</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">API Keys</CardTitle>
            <Key className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{keyCount ?? '—'}</p>
            <p className="text-xs text-muted-foreground">Active keys</p>
            <Button variant="outline" size="sm" className="mt-2" asChild>
              <Link href="/dashboard/keys">Manage</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">API Calls (30d)</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalUsage ?? '—'}</p>
            <p className="text-xs text-muted-foreground">Total requests</p>
            <Button variant="outline" size="sm" className="mt-2" asChild>
              <Link href="/dashboard/usage">Details</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Quick start */}
      <Card>
        <CardHeader>
          <CardTitle>Quick start</CardTitle>
          <CardDescription>Generate images and videos with your API key</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
            <li>Create an API key in the <Link href="/dashboard/keys" className="text-primary underline">API Keys</Link> section.</li>
            <li>
              Use the key as{' '}
              <code className="rounded bg-muted px-1">Authorization: Bearer YOUR_KEY</code>{' '}
              or <code className="rounded bg-muted px-1">X-API-Key</code> header.
            </li>
            <li>
              Call <code className="rounded bg-muted px-1">POST /api/public/v1/generate-image</code>{' '}
              or <code className="rounded bg-muted px-1">POST /api/public/v1/generate-video</code>.
            </li>
            <li>Check the <Link href="/dashboard/docs" className="text-primary underline">Documentation</Link> for full examples.</li>
          </ol>
          <div className="flex gap-2">
            <Button asChild>
              <Link href="/dashboard/docs" className="inline-flex items-center gap-2">
                <BookOpen className="h-4 w-4" />
                View docs
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/pricing" className="inline-flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                View pricing
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
