'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

function BillingSuccessContent() {
  const params = useSearchParams();
  const plan = params.get('plan') || 'pro';
  const simulated = params.get('simulated') === 'true';
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) { clearInterval(timer); window.location.href = '/dashboard'; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <Card className="w-full max-w-md text-center">
      <CardHeader className="items-center">
        <div className="rounded-full bg-green-100 p-4 mb-2">
          <CheckCircle2 className="h-10 w-10 text-green-600" />
        </div>
        <CardTitle className="text-2xl">Payment successful!</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground">
          Your account has been upgraded to <strong className="capitalize">{plan}</strong>.
          Your new credits are ready to use.
        </p>
        {simulated && (
          <p className="text-xs text-amber-600 bg-amber-50 rounded-md p-3">
            This was a simulated checkout. Connect Stripe to enable real payments.
          </p>
        )}
        <p className="text-sm text-muted-foreground">
          Redirecting to dashboard in <strong>{countdown}s</strong>…
        </p>
        <Button asChild className="w-full">
          <Link href="/dashboard">Go to dashboard now</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export default function BillingSuccessPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Suspense fallback={<div className="text-muted-foreground animate-pulse">Loading…</div>}>
        <BillingSuccessContent />
      </Suspense>
    </div>
  );
}
