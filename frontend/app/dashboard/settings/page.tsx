'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Settings, Globe, Key } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://free-backend-rho.vercel.app';

export default function SettingsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Project settings</h1>
        <p className="text-muted-foreground">Manage your project and API configuration</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            General
          </CardTitle>
          <CardDescription>Project identifier and API base URL</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium text-muted-foreground">Project ID</label>
            <p className="font-mono text-sm mt-1">Free API</p>
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">API base URL</label>
            <p className="font-mono text-sm mt-1 break-all">{API_BASE}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Set <code className="rounded bg-muted px-1">NEXT_PUBLIC_API_URL</code> in your frontend env to override.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Integration config
          </CardTitle>
          <CardDescription>Developers can fetch this config to integrate auth in their app</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            <code className="rounded bg-muted px-1">GET {API_BASE}/api/integration-config</code> — returns baseUrl, auth endpoints, and header names. No API key required.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            API keys
          </CardTitle>
          <CardDescription>Create and revoke keys in the API Keys section under Build</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Each key is scoped to your account. Use the key in the <code className="rounded bg-muted px-1">X-API-Key</code> header for all API and auth requests.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
