'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { payments } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Check } from 'lucide-react';

const plans = [
  {
    name: 'Free',
    slug: 'free' as const,
    price: '$0',
    period: 'forever',
    description: 'Get started with AI generation',
    features: [
      '10 image credits',
      '2 video credits',
      '1 API key',
      'Rate limited (60 req/min)',
      'Community support',
    ],
    cta: 'Current Plan',
    highlighted: false,
  },
  {
    name: 'Pro',
    slug: 'pro' as const,
    price: '$19',
    period: '/month',
    description: 'For serious creators and developers',
    features: [
      '200 image credits',
      '50 video credits',
      'Unlimited API keys',
      'Higher rate limits',
      'Priority support',
    ],
    cta: 'Upgrade to Pro',
    highlighted: true,
  },
  {
    name: 'Enterprise',
    slug: 'enterprise' as const,
    price: '$99',
    period: '/month',
    description: 'For teams and production workloads',
    features: [
      '2,000 image credits',
      '500 video credits',
      'Unlimited API keys',
      'No rate limits',
      'Dedicated support',
      'Custom model access',
    ],
    cta: 'Contact Sales',
    highlighted: false,
  },
];

export default function PricingPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState('');

  const currentPlan = user?.plan || 'free';

  async function handleUpgrade(plan: 'pro' | 'enterprise') {
    if (!user) {
      router.push('/login');
      return;
    }

    setLoading(plan);
    setError('');

    try {
      const { checkoutUrl } = await payments.createCheckout(plan);
      // In production this would redirect to Stripe/payment provider
      // For now it redirects to our billing success page
      window.location.href = checkoutUrl;
    } catch (err: any) {
      setError(err.message || 'Failed to create checkout session');
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link href="/" className="text-xl font-bold">
            AI API Proxy
          </Link>
          <div className="flex gap-2">
            {user ? (
              <Button asChild variant="outline" size="sm">
                <Link href="/dashboard">Dashboard</Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/login">Sign in</Link>
                </Button>
                <Button asChild size="sm">
                  <Link href="/register">Sign up</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Simple, transparent pricing</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Start free and scale as you grow. No hidden fees. Credits reset monthly on paid plans.
          </p>
        </div>

        {error && (
          <div className="mb-8 mx-auto max-w-md rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30 px-4 py-3 text-sm text-red-800 dark:text-red-200">
            {error}
          </div>
        )}

        <div className="grid gap-8 md:grid-cols-3">
          {plans.map((plan) => {
            const isCurrent = currentPlan === plan.slug;
            return (
              <Card
                key={plan.slug}
                className={
                  plan.highlighted
                    ? 'border-primary shadow-lg ring-1 ring-primary relative'
                    : 'relative'
                }
              >
                {plan.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
                    Most Popular
                  </div>
                )}
                <CardHeader>
                  <CardTitle>{plan.name}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                  <div className="mt-4">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    <span className="text-muted-foreground">{plan.period}</span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-2">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-2 text-sm">
                        <Check className="h-4 w-4 text-primary shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <div className="pt-4">
                    {isCurrent ? (
                      <Button variant="outline" className="w-full" disabled>
                        Current Plan
                      </Button>
                    ) : plan.slug === 'free' ? (
                      <Button variant="outline" className="w-full" disabled>
                        {currentPlan !== 'free' ? 'Included' : 'Current Plan'}
                      </Button>
                    ) : (
                      <Button
                        className="w-full"
                        variant={plan.highlighted ? 'default' : 'outline'}
                        onClick={() => handleUpgrade(plan.slug as 'pro' | 'enterprise')}
                        disabled={loading !== null}
                      >
                        {loading === plan.slug ? 'Redirecting...' : plan.cta}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="mt-16 text-center text-sm text-muted-foreground">
          <p>All plans include API access, usage tracking, and detailed documentation.</p>
          <p className="mt-1">Need a custom plan? Contact us at support@example.com</p>
        </div>
      </main>
    </div>
  );
}
