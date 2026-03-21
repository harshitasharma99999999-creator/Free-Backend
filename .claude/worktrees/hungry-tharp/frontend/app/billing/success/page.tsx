'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { payments } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, ArrowRight } from 'lucide-react';

export default function BillingSuccessPage() {
  const searchParams = useSearchParams();
  const { user, refreshUser } = useAuth();
  const [upgrading, setUpgrading] = useState(false);
  const [upgraded, setUpgraded] = useState(false);
  const [error, setError] = useState('');

  const sessionId = searchParams.get('session_id');
  const plan = searchParams.get('plan') as 'pro' | 'enterprise' | null;

  useEffect(() => {
    // Auto-simulate the upgrade on page load (in production, the webhook handles this)
    if (plan && !upgraded && !upgrading) {
      setUpgrading(true);
      payments
        .simulateUpgrade(plan)
        .then(() => {
          setUpgraded(true);
          // Refresh user data so dashboard shows updated credits
          refreshUser();
        })
        .catch((err: any) => {
          setError(err.message || 'Failed to process upgrade');
        })
        .finally(() => setUpgrading(false));
    }
  }, [plan]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          {upgraded ? (
            <>
              <CheckCircle className="mx-auto h-12 w-12 text-green-500 mb-4" />
              <CardTitle className="text-2xl">Payment Successful!</CardTitle>
            </>
          ) : upgrading ? (
            <>
              <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent mb-4" />
              <CardTitle className="text-2xl">Processing...</CardTitle>
            </>
          ) : error ? (
            <>
              <div className="mx-auto h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
                <span className="text-2xl text-red-500">!</span>
              </div>
              <CardTitle className="text-2xl">Something went wrong</CardTitle>
            </>
          ) : (
            <CardTitle className="text-2xl">Billing</CardTitle>
          )}
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          {upgraded && (
            <>
              <p className="text-muted-foreground">
                Your account has been upgraded to the{' '}
                <span className="font-semibold capitalize text-foreground">{plan}</span> plan.
                Your credits have been updated.
              </p>
              {sessionId && (
                <p className="text-xs text-muted-foreground">
                  Session: {sessionId}
                </p>
              )}
              <div className="pt-4">
                <Button asChild className="w-full">
                  <Link href="/dashboard" className="inline-flex items-center gap-2">
                    Go to Dashboard
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </>
          )}

          {upgrading && (
            <p className="text-muted-foreground">
              Activating your {plan} plan. This will only take a moment...
            </p>
          )}

          {error && (
            <>
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              <div className="flex gap-2 justify-center pt-4">
                <Button asChild variant="outline">
                  <Link href="/pricing">Back to Pricing</Link>
                </Button>
                <Button asChild>
                  <Link href="/dashboard">Dashboard</Link>
                </Button>
              </div>
            </>
          )}

          {!upgraded && !upgrading && !error && (
            <div className="pt-4">
              <Button asChild>
                <Link href="/dashboard">Go to Dashboard</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
