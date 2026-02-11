'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const PUBLIC_BASE = `${API_BASE}/api/public`;

export default function DocsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Documentation</h1>
        <p className="text-muted-foreground">Use your API key to call these endpoints</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Authentication</CardTitle>
          <CardDescription>Include your API key in every request</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm">Option 1 — Header (recommended):</p>
          <pre className="rounded-lg bg-muted p-4 text-sm overflow-x-auto">
            {`X-API-Key: fk_your_api_key_here`}
          </pre>
          <p className="text-sm">Option 2 — Query parameter:</p>
          <pre className="rounded-lg bg-muted p-4 text-sm overflow-x-auto">
            {`GET ${PUBLIC_BASE}/v1/health?apiKey=fk_your_api_key_here`}
          </pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Rate limits</CardTitle>
          <CardDescription>Free tier limits (configurable per deployment)</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Each API key is limited to a number of requests per minute. Responses include:
          </p>
          <ul className="list-disc list-inside mt-2 text-sm text-muted-foreground space-y-1">
            <li><code className="rounded bg-muted px-1">X-RateLimit-Limit</code> — max requests per window</li>
            <li><code className="rounded bg-muted px-1">X-RateLimit-Remaining</code> — remaining in current window</li>
            <li><code className="rounded bg-muted px-1">X-RateLimit-Reset</code> — Unix timestamp when the window resets</li>
          </ul>
          <p className="text-sm text-muted-foreground mt-2">When exceeded, you get <code className="rounded bg-muted px-1">429 Too Many Requests</code>.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Endpoints</CardTitle>
          <CardDescription>Base URL: {PUBLIC_BASE}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <p className="font-mono text-sm font-medium text-primary">GET /v1/health</p>
            <p className="text-sm text-muted-foreground mt-1">Check API status. Returns status and timestamp.</p>
            <pre className="rounded-lg bg-muted p-4 text-sm overflow-x-auto mt-2">
{`curl -H "X-API-Key: YOUR_KEY" "${PUBLIC_BASE}/v1/health"`}
            </pre>
          </div>

          <div>
            <p className="font-mono text-sm font-medium text-primary">GET /v1/echo?message=...</p>
            <p className="text-sm text-muted-foreground mt-1">Echo back a message. Optional query: message.</p>
            <pre className="rounded-lg bg-muted p-4 text-sm overflow-x-auto mt-2">
{`curl -H "X-API-Key: YOUR_KEY" "${PUBLIC_BASE}/v1/echo?message=hello"`}
            </pre>
          </div>

          <div>
            <p className="font-mono text-sm font-medium text-primary">GET /v1/random?min=0&max=100</p>
            <p className="text-sm text-muted-foreground mt-1">Random integer in range [min, max]. Defaults: min=0, max=100.</p>
            <pre className="rounded-lg bg-muted p-4 text-sm overflow-x-auto mt-2">
{`curl -H "X-API-Key: YOUR_KEY" "${PUBLIC_BASE}/v1/random?min=1&max=6"`}
            </pre>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Errors</CardTitle>
          <CardDescription>JSON error responses</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p><strong>401 Unauthorized</strong> — Missing or invalid API key.</p>
          <p><strong>429 Too Many Requests</strong> — Rate limit exceeded.</p>
          <p>All errors include an <code className="rounded bg-muted px-1">error</code> field and optionally <code className="rounded bg-muted px-1">message</code>.</p>
        </CardContent>
      </Card>
    </div>
  );
}
