'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { firebaseAuth } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

function isNetworkOrBackendError(err: unknown): boolean {
  if (err instanceof TypeError && err.message === 'Failed to fetch') return true;
  if (err instanceof Error && err.message.toLowerCase().includes('fetch')) return true;
  return false;
}

function firebaseUserToUser(fb: { uid: string; email: string | null; displayName: string | null }): { id: string; email: string; name: string } {
  return {
    id: fb.uid,
    email: fb.email ?? '',
    name: fb.displayName ?? fb.email ?? 'User',
  };
}

export default function LoginPage() {
  const router = useRouter();
  const { login, loginFirebaseOnly, exchangeFirebaseToken } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);
    try {
      const { user: fbUser } = await signInWithEmailAndPassword(firebaseAuth, email, password);
      const idToken = await fbUser.getIdToken();
      if (!idToken) throw new Error('Could not get token');
      try {
        const { token, user } = await exchangeFirebaseToken(idToken);
        login(token, user);
        router.push('/dashboard');
        router.refresh();
      } catch (exchangeErr: unknown) {
        if (isNetworkOrBackendError(exchangeErr)) {
          loginFirebaseOnly(firebaseUserToUser(fbUser));
          setInfo("You're signed in. To create API keys and see usage, the backend must be deployed and connected. See DEPLOY.md for steps.");
          router.push('/dashboard');
          router.refresh();
        } else {
          throw exchangeErr;
        }
      }
    } catch (err: unknown) {
      if (!info) setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>Enter your email and password</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            {info && (
              <p className="text-sm text-muted-foreground">{info}</p>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign in'}
            </Button>
            <p className="text-sm text-muted-foreground">
              Don&apos;t have an account?{' '}
              <Link href="/register" className="text-primary hover:underline">
                Sign up
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
