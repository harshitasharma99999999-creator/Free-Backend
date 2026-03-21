'use client';

import { useEffect, useState } from 'react';
import { keys as keysApi, type ApiKeyPreview, type ApiKeyCreated } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Key, Plus, Trash2 } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

function isNetworkError(err: unknown): boolean {
  if (err instanceof TypeError && err.message === 'Failed to fetch') return true;
  if (err instanceof Error && err.message.toLowerCase().includes('fetch')) return true;
  return false;
}

const BACKEND_UNREACHABLE_MSG =
  'Could not reach the API server. Deploy the backend and set NEXT_PUBLIC_API_URL to use API keys. See DEPLOY.md in the project for steps.';

export default function KeysPage() {
  const [list, setList] = useState<ApiKeyPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createdKey, setCreatedKey] = useState<ApiKeyCreated | null>(null);
  const [error, setError] = useState('');
  const [networkMessage, setNetworkMessage] = useState('');

  const fetchKeys = () => {
    setNetworkMessage('');
    keysApi
      .list()
      .then((r) => setList(r.keys))
      .catch((err) => {
        setList([]);
        if (isNetworkError(err)) setNetworkMessage(BACKEND_UNREACHABLE_MSG);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchKeys();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setError('');
    setCreating(true);
    try {
      const created = await keysApi.create(newName.trim());
      setCreatedKey(created);
      setNewName('');
      fetchKeys();
    } catch (err: unknown) {
      setError(isNetworkError(err) ? BACKEND_UNREACHABLE_MSG : (err instanceof Error ? err.message : 'Failed to create key'));
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(id: string) {
    if (!confirm('Revoke this API key? It will stop working immediately.')) return;
    try {
      await keysApi.revoke(id);
      setCreatedKey(null);
      fetchKeys();
    } catch (err: unknown) {
      setError(isNetworkError(err) ? BACKEND_UNREACHABLE_MSG : 'Failed to revoke key');
    }
  }

  function copyKey(key: string) {
    navigator.clipboard.writeText(key);
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">API Keys</h1>
        <p className="text-muted-foreground">Create and manage keys for your applications</p>
      </div>

      {createdKey && (
        <Card className="border-primary/50 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-base">Key created — copy it now</CardTitle>
            <CardDescription>
              This is the only time you&apos;ll see the full key. Store it securely.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-2">
            <code className="flex-1 min-w-0 rounded bg-muted px-2 py-1 text-sm break-all">
              {createdKey.key}
            </code>
            <Button
              size="sm"
              variant="outline"
              onClick={() => copyKey(createdKey.key)}
            >
              Copy
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setCreatedKey(null)}>
              Dismiss
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Create key
          </CardTitle>
          <CardDescription>Give the key a name to identify it (e.g. &quot;My App&quot;)</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 space-y-2">
              <Label htmlFor="key-name">Name</Label>
              <Input
                id="key-name"
                placeholder="My App"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={creating}>
                {creating ? 'Creating...' : 'Create key'}
              </Button>
            </div>
          </form>
          {error && <p className="text-sm text-destructive mt-2">{error}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Your keys
          </CardTitle>
          <CardDescription>Use the key in X-API-Key header when calling the API</CardDescription>
        </CardHeader>
        <CardContent>
          {networkMessage && (
            <p className="text-sm text-amber-700 dark:text-amber-300 mb-3">{networkMessage}</p>
          )}
          {loading ? (
            <p className="text-muted-foreground text-sm">Loading...</p>
          ) : list.length === 0 && !networkMessage ? (
            <p className="text-muted-foreground text-sm">No API keys yet. Create one above.</p>
          ) : list.length === 0 ? null : (
            <ul className="space-y-3">
              {list.map((k) => (
                <li
                  key={k.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
                >
                  <div>
                    <p className="font-medium">{k.name}</p>
                    <p className="text-sm text-muted-foreground font-mono">{k.keyPreview}</p>
                    <p className="text-xs text-muted-foreground">
                      Created {new Date(k.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleRevoke(k.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">
            Base URL for API requests: <code className="rounded bg-muted px-1">{API_BASE}/api/public</code>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
