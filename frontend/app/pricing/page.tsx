'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { payments } from '@/lib/api-v2';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, Zap } from 'lucide-react';

const plans = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    period: 'forever',
    imageCredits: 10,
    videoCredits: 2,
    features: ['10 image generations', '2 video generations', '60 req/min rate limit', 'Community support'],
    cta: 'Current plan',
    highlight: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$19',
    period: 'per month',
    imageCredits: 200,
    videoCredits: 50,
    features: ['200 image generations', '50 video generations', '60 req/min rate limit', 'Email support', 'Credits refresh monthly'],
    cta: 'Upgrade to Pro',
    highlight: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: '$99',
    period: 'per month',
    imageCredits: 2000,
    videoCredits: 500,
    features: ['2000 image generations', '500 video generations', 'Custom rate limits', 'Priority support', 'SLA available'],
    cta: 'Upgrade to Enterprise',
    highlight: false,
  },
];

export default function PricingPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState('');

  async function handleUpgrade(planId: string) {
    if (!user) { router.push('/login'); return; }
    if (planId === 'free') return;
    setError('');
    setLoading(planId);
    try {
      const { checkoutUrl } = await payments.createCheckout(planId as 'pro' | 'enterprise');
      window.location.href = checkoutUrl;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not start checkout');
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b px-6 h-14 flex items-center justify-between max-w-6xl mx-auto">
        <Link href="/" className="font-bold text-primary text-lg">GenAPI</Link>
        {user ? (
          <Button asChild size="sm" variant="outline"><Link href="/dashboard">Dashboard</Link></Button>
        ) : (
          <Button asChild size="sm"><Link href="/login">Sign in</Link></Button>
        )}
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary rounded-full px-3 py-1 text-sm mb-4">
            <Zap className="h-4 w-4" /> Simple pricing
          </div>
          <h1 className="text-4xl font-bold mb-3">Choose your plan</h1>
          <p className="text-muted-foreground text-lg">Start free. Upgrade when you need more credits.</p>
        </div>

        {error && (
          <p className="text-center text-destructive mb-6">{error}</p>
        )}

        <div className="grid sm:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <Card
              key={plan.id}
              className={`flex flex-col ${plan.highlight ? 'border-primary ring-2 ring-primary/20' : ''}`}
            >
              <CardHeader>
                {plan.highlight && (
                  <span className="text-xs font-medium text-primary bg-primary/10 rounded-full px-2.5 py-0.5 w-fit mb-2">
                    Most popular
                  </span>
                )}
                <CardTitle>{plan.name}</CardTitle>
                <div className="mt-2">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  <span className="text-muted-foreground ml-1 text-sm">/{plan.period}</span>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col flex-1 gap-4">
                <ul className="space-y-2 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button
                  className="w-full"
                  variant={plan.highlight ? 'default' : 'outline'}
                  disabled={plan.id === 'free' || loading === plan.id}
                  onClick={() => handleUpgrade(plan.id)}
                >
                  {loading === plan.id ? 'Redirecting…' : plan.cta}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <p className="text-center text-sm text-muted-foreground mt-8">
          All plans include Replicate-powered image & video generation. Credits do not roll over.
          <br />Have questions?{' '}
          <a href="mailto:support@yourdomain.com" className="text-primary hover:underline">Contact support</a>
        </p>
      </div>
    </div>
  );
}
