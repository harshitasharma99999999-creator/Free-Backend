'use client';

import { useEffect, useState } from 'react';
import { usage as usageApi, type UsageLog } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3 } from 'lucide-react';

export default function UsagePage() {
  const [logs, setLogs] = useState<UsageLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    usageApi.get(50)
      .then((r) => setLogs(r.logs))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load usage'))
      .finally(() => setLoading(false));
  }, []);

  // Build per-day totals from logs
  const byDay: Record<string, number> = {};
  logs.forEach((l) => {
    const day = l.timestamp.slice(0, 10);
    byDay[day] = (byDay[day] || 0) + 1;
  });
  const days = Object.entries(byDay).sort((a, b) => a[0].localeCompare(b[0])).slice(-30);
  const maxCount = Math.max(...days.map(([, c]) => c), 1);

  const totalCost = logs.reduce((sum, l) => sum + (l.cost || 0), 0);
  const imageCount = logs.filter((l) => l.type === 'image').length;
  const videoCount = logs.filter((l) => l.type === 'video').length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Usage</h1>
        <p className="text-muted-foreground">API requests across all your keys</p>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: 'Total requests', value: logs.length },
          { label: 'Image generations', value: imageCount },
          { label: 'Video generations', value: videoCount },
        ].map((s) => (
          <Card key={s.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{s.label}</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{loading ? '—' : s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Bar chart */}
      <Card>
        <CardHeader>
          <CardTitle>Requests per day</CardTitle>
          <CardDescription>Last 30 days of activity</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : days.length === 0 ? (
            <p className="text-muted-foreground text-sm">No usage yet. Start making requests with your API key.</p>
          ) : (
            <div className="space-y-2">
              {days.map(([date, count]) => (
                <div key={date} className="flex items-center gap-4">
                  <span className="w-24 text-sm text-muted-foreground shrink-0">{date}</span>
                  <div className="flex-1 h-6 bg-muted rounded overflow-hidden">
                    <div className="h-full bg-primary rounded min-w-[4px] transition-all"
                      style={{ width: `${(count / maxCount) * 100}%` }} />
                  </div>
                  <span className="text-sm font-medium w-8 text-right">{count}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Log table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent requests</CardTitle>
          <CardDescription>Last {logs.length} logged requests</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : logs.length === 0 ? (
            <p className="text-muted-foreground text-sm">No logs yet.</p>
          ) : (
            <div className="rounded-md border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left font-medium p-3">Type</th>
                    <th className="text-left font-medium p-3">Provider</th>
                    <th className="text-left font-medium p-3">Credits used</th>
                    <th className="text-left font-medium p-3">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.slice(0, 50).map((l, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="p-3 capitalize">{l.type}</td>
                      <td className="p-3 text-muted-foreground">{l.provider}</td>
                      <td className="p-3">{l.cost}</td>
                      <td className="p-3 text-muted-foreground text-xs">
                        {new Date(l.timestamp).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
