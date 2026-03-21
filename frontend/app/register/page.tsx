'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { firebaseAuth } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

export default function RegisterPage() {
  const router = useRouter();
  const { login, loginFirebaseOnly, exchangeFirebaseToken } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      return setError('Password must be at least 8 characters.');
    }
    setLoading(true);
    try {
      const { user: fb } = await createUserWithEmailAndPassword(firebaseAuth, email, password);
      if (name.trim()) await updateProfile(fb, { displayName: name.trim() });

      const idToken = await fb.getIdToken();
      try {
        const { token, user } = await exchangeFirebaseToken(idToken);
        login(token, user);
      } catch {
        loginFirebaseOnly({ id: fb.uid, email: fb.email ?? '', name: name || (fb.email ?? 'User') });
      }
      router.push('/dashboard');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f0f0f] p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <Link href="/" className="inline-flex items-center justify-center h-10 w-10 rounded-full bg-[#10a37f] mb-3">
            <span className="text-white font-bold text-lg">E</span>
          </Link>
          <h1 className="text-2xl font-bold text-white">Create your account</h1>
          <p className="text-sm text-[#8e8ea0]">Start using EIOR for free — no credit card required</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          {error && <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 p-3 rounded-xl">{error}</p>}
          <input
            id="name" placeholder="Name (optional)" value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-[#2f2f2f] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-[#8e8ea0] outline-none focus:border-[#10a37f]/50 transition-colors"
          />
          <input
            id="email" type="email" placeholder="Email address" value={email}
            onChange={(e) => setEmail(e.target.value)} required
            className="w-full bg-[#2f2f2f] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-[#8e8ea0] outline-none focus:border-[#10a37f]/50 transition-colors"
          />
          <input
            id="password" type="password" placeholder="Password (min 8 characters)" value={password}
            onChange={(e) => setPassword(e.target.value)} required
            className="w-full bg-[#2f2f2f] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-[#8e8ea0] outline-none focus:border-[#10a37f]/50 transition-colors"
          />
          <button type="submit" disabled={loading}
            className="w-full py-3 rounded-xl bg-[#10a37f] hover:bg-[#0d9270] disabled:opacity-50 text-white text-sm font-semibold transition-colors">
            {loading ? 'Creating account…' : 'Create account — free'}
          </button>
        </form>
        <p className="text-sm text-center text-[#8e8ea0]">
          Already have an account?{' '}
          <Link href="/login" className="text-[#10a37f] hover:underline font-medium">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
