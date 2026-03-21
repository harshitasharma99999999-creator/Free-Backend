'use client';

import { useEffect, useState } from 'react';
import { clientUsers, type ClientUser } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { UserPlus, Search } from 'lucide-react';

function isNetworkError(err: unknown): boolean {
  if (err instanceof TypeError && err.message === 'Failed to fetch') return true;
  if (err instanceof Error && err.message.toLowerCase().includes('fetch')) return true;
  return false;
}

const BACKEND_UNREACHABLE_MSG = 'Could not reach the API server. Deploy the backend to see users.';

export default function AuthUsersPage() {
  const { backendConnected } = useAuth();
  const [users, setUsers] = useState<ClientUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!backendConnected) {
      setUsers([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    clientUsers
      .list()
      .then((r) => setUsers(r.users))
      .catch((err) => {
        setUsers([]);
        if (isNetworkError(err)) setError(BACKEND_UNREACHABLE_MSG);
      })
      .finally(() => setLoading(false));
  }, [backendConnected]);

  const filtered = search.trim()
    ? users.filter(
        (u) =>
          u.email.toLowerCase().includes(search.toLowerCase()) ||
          (u.name && u.name.toLowerCase().includes(search.toLowerCase()))
      )
    : users;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <UserPlus className="h-4 w-4" />
            Users
          </CardTitle>
        </CardHeader>
        <CardDescription className="px-6 -mt-2">
          Users who signed up via your app (client-register / client-login). Search by email or name.
        </CardDescription>
        <CardContent className="pt-4">
          {error && (
            <p className="text-sm text-amber-700 dark:text-amber-300 mb-3">{error}</p>
          )}
          <div className="flex items-center gap-2 mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by email or name"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          {loading ? (
            <p className="text-muted-foreground text-sm">Loading...</p>
          ) : filtered.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              {users.length === 0
                ? 'No users yet. Users appear here when they register through your app using your API key.'
                : 'No users match your search.'}
            </p>
          ) : (
            <div className="rounded-md border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left font-medium p-3">Identifier</th>
                    <th className="text-left font-medium p-3">App (API key)</th>
                    <th className="text-left font-medium p-3">Created</th>
                    <th className="text-left font-medium p-3">User UID</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((u) => (
                    <tr key={u.id} className="border-t border-border">
                      <td className="p-3">{u.email}</td>
                      <td className="p-3 text-muted-foreground">{u.appName}</td>
                      <td className="p-3 text-muted-foreground">
                        {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}
                      </td>
                      <td className="p-3 font-mono text-xs text-muted-foreground truncate max-w-[120px]">
                        {u.id}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!loading && users.length > 0 && (
            <p className="text-xs text-muted-foreground mt-3">
              {filtered.length} user{filtered.length !== 1 ? 's' : ''} (rows per page: 50)
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
