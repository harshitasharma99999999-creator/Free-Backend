'use client';

import { useEffect, useState } from 'react';
import { usage as usageApi } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type UsageData = { total: number; byDay: { date: string; count: number }[] };

function isNetworkError(err: unknown): boolean {
  if (err instanceof TypeError && err.message === 'Failed to fetch') return true;
  if (err instanceof Error && err.message.toLowerCase().includes('fetch')) return true;
  return false;
}

const BACKEND_UNREACHABLE_MSG =
  'Could not reach the API server. Deploy the backend and set NEXT_PUBLIC_API_URL to see usage. See DEPLOY.md in the project for steps.';

export default function UsagePage() {
  const [data, setData] = useState<UsageData | null>(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [networkMessage, setNetworkMessage] = useState('');

  useEffect(() => {
    setLoading(true);
    setNetworkMessage('');
    usageApi
      .get(days)
      .then((d) => {
        setData(d);
        setNetworkMessage('');
      })
      .catch((err) => {
        setData({ total: 0, byDay: [] });
        if (isNetworkError(err)) setNetworkMessage(BACKEND_UNREACHABLE_MSG);
      })
      .finally(() => setLoading(false));
  }, [days]);

  const maxCount = data?.byDay.length ? Math.max(...data.byDay.map((d) => d.count), 1) : 1;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Usage</h1>
        <p className="text-muted-foreground">API calls per day (rate limit applies per key)</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {[7, 30, 90].map((d) => (
          <button
            key={d}
            onClick={() => setDays(d)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              days === d
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            Last {d} days
          </button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Total requests</CardTitle>
          <CardDescription>Across all your API keys in the selected period</CardDescription>
        </CardHeader>
        <CardContent>
          {networkMessage && (
            <p className="text-sm text-amber-700 dark:text-amber-300 mb-2">{networkMessage}</p>
          )}
          {loading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : (
            <p className="text-3xl font-bold">{data?.total ?? 0}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>By day</CardTitle>
          <CardDescription>Daily request volume</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : !data?.byDay.length ? (
            <p className="text-muted-foreground text-sm">No usage in this period.</p>
          ) : (
            <div className="space-y-2">
              {data.byDay.slice(-30).map((d) => (
                <div key={d.date} className="flex items-center gap-4">
                  <span className="w-24 text-sm text-muted-foreground">{d.date}</span>
                  <div className="flex-1 h-6 bg-muted rounded overflow-hidden">
                    <div
                      className="h-full bg-primary rounded min-w-[2px]"
                      style={{ width: `${(d.count / maxCount) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium w-12 text-right">{d.count}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
