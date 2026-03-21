'use client';

import { useState } from 'react';
import { type ApiKeyCreated } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Copy, CheckCircle2 } from 'lucide-react';

export default function KeysPage() {
  const { createApiKey, user } = useAuth();
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createdKey, setCreatedKey] = useState<ApiKeyCreated | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();

    if (!user) {
      setError('Please sign in to create API keys.');
      return;
    }

    setError('');
    setCreating(true);

    try {
      const created = await createApiKey(newName.trim() || 'My App');
      setCreatedKey(created);
      setNewName('');
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create key';
      setError(errorMessage);
      console.error('Failed to create API key:', err);
    } finally {
      setCreating(false);
    }
  }

  function copyKey(key: string) {
    navigator.clipboard.writeText(key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">API Keys</h1>
        <p className="text-muted-foreground">Create a key for using the API in your own app.</p>
      </div>

      {createdKey && (
        <Card className="border-primary/50 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              Key created - copy it now
            </CardTitle>
            <CardDescription>
              This is the only time you will see the full key. Store it securely (for example, in env vars).
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-2">
            <code className="flex-1 min-w-0 rounded bg-muted px-3 py-2 text-sm font-mono break-all">{createdKey.key}</code>
            <Button size="sm" variant="outline" onClick={() => copyKey(createdKey.key)}>
              <Copy className="h-3 w-3 mr-1" />
              {copied ? 'Copied!' : 'Copy'}
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
            <Plus className="h-5 w-5" /> Create new key
          </CardTitle>
          <CardDescription>Give your key a name so you can identify it later.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 space-y-1">
              <Label htmlFor="key-name">Key name</Label>
              <Input id="key-name" placeholder="My App" value={newName} onChange={(e) => setNewName(e.target.value)} />
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={creating || !user}>
                {creating ? 'Creating...' : 'Create key'}
              </Button>
            </div>
          </form>
          {error && <p className="text-sm text-destructive mt-3">{error}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
