'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AuthenticationPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/dashboard/authentication/users');
  }, [router]);
  return null;
}
