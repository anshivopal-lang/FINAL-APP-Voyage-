import { redirect } from 'next/navigation';
import { Suspense } from 'react';

import { auth } from '@/auth';
import { AuthLink, AuthShell, SignInForm } from '@/components/AuthCard';

export const metadata = { title: 'Sign in' };
export const dynamic = 'force-dynamic';

export default async function SignInPage() {
  const session = await auth();
  if (session?.user?.id) redirect('/');

  return (
    <AuthShell
      title="Voyager"
      intro="A private place for the trips that matter. Sign in to reach your own holidays — nothing here is shared unless you invite someone."
      footer={
        <>
          New here? <AuthLink href="/signup">Create an account</AuthLink>
        </>
      }
    >
      {/* useSearchParams needs a Suspense boundary during prerender. */}
      <Suspense fallback={null}>
        <SignInForm />
      </Suspense>
    </AuthShell>
  );
}
