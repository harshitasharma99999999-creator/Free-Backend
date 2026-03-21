'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2 } from 'lucide-react';

export default function SignInMethodPage() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Sign-in providers</CardTitle>
          <CardDescription>
            The methods your app can use to let users sign in.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-primary/10 p-2">
                <CheckCircle2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">Email/Password</p>
                <p className="text-sm text-muted-foreground">
                  Users sign in with email and password (register and login endpoints).
                </p>
              </div>
            </div>
            <span className="rounded-full bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 text-xs font-medium px-2.5 py-1">
              Enabled
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Use POST /api/auth/client-register and POST /api/auth/client-login with your API key.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
