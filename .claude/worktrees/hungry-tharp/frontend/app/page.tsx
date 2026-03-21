'use client';

import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Image, Video, Key, Zap, Shield, BarChart3 } from 'lucide-react';

const features = [
  {
    icon: Image,
    title: 'Image Generation',
    description: 'Generate images from text prompts using state-of-the-art AI models via Replicate and HuggingFace.',
  },
  {
    icon: Video,
    title: 'Video Generation',
    description: 'Create videos from text descriptions. We proxy requests to the best external providers.',
  },
  {
    icon: Key,
    title: 'API Key Management',
    description: 'Generate secure API keys, manage access, and revoke keys instantly from your dashboard.',
  },
  {
    icon: Zap,
    title: 'Fast & Reliable',
    description: 'Built on scalable infrastructure with automatic failover between AI providers.',
  },
  {
    icon: Shield,
    title: 'Secure by Default',
    description: 'Helmet security headers, rate limiting, and input validation on every request.',
  },
  {
    icon: BarChart3,
    title: 'Usage Analytics',
    description: 'Track API usage with detailed dashboards. Monitor credits and plan limits in real-time.',
  },
];

export default function HomePage() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">Welcome back, {user.name}</p>
          <Button asChild>
            <Link href="/dashboard">Go to Dashboard</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <span className="text-xl font-bold">AI API Proxy</span>
          <div className="flex gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/pricing">Pricing</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/register">Sign up</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 py-24 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
          AI Image & Video Generation
          <br />
          <span className="text-primary">via Simple API</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          Get an API key, send a prompt, receive generated images and videos.
          We handle the AI infrastructure so you can focus on building your product.
        </p>
        <div className="mt-10 flex justify-center gap-4">
          <Button size="lg" asChild>
            <Link href="/register">Get Started Free</Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/pricing">View Pricing</Link>
          </Button>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          10 free image credits. No credit card required.
        </p>
      </section>

      {/* Code example */}
      <section className="mx-auto max-w-6xl px-4 pb-16">
        <div className="mx-auto max-w-2xl">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">Quick example</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="rounded-lg bg-muted p-4 text-sm overflow-x-auto">
{`curl -X POST https://your-api.com/api/public/v1/generate-image \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"prompt": "A futuristic city at sunset"}'`}
              </pre>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-border bg-muted/30">
        <div className="mx-auto max-w-6xl px-4 py-24">
          <h2 className="text-3xl font-bold text-center mb-12">Everything you need</h2>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <Card key={feature.title}>
                  <CardContent className="pt-6">
                    <Icon className="h-8 w-8 text-primary mb-4" />
                    <h3 className="font-semibold mb-2">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground">{feature.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 py-24 text-center">
        <h2 className="text-3xl font-bold mb-4">Ready to get started?</h2>
        <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
          Create an account, get your API key, and start generating in minutes.
        </p>
        <Button size="lg" asChild>
          <Link href="/register">Create Free Account</Link>
        </Button>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="mx-auto max-w-6xl px-4 flex flex-wrap items-center justify-between gap-4 text-sm text-muted-foreground">
          <p>AI API Proxy Platform</p>
          <div className="flex gap-4">
            <Link href="/pricing" className="hover:text-foreground">Pricing</Link>
            <Link href="/login" className="hover:text-foreground">Sign in</Link>
            <Link href="/register" className="hover:text-foreground">Sign up</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
