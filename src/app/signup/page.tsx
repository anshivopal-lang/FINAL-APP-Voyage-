import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import { AuthLink, AuthShell, SignUpForm } from '@/components/AuthCard';

export const metadata = { title: 'Create an account' };
export const dynamic = 'force-dynamic';

export default async function SignUpPage() {
  const session = await auth();
  if (session?.user?.id) redirect('/');

  return (
    <AuthShell
      title="Create an account"
      intro="Start planning in a space that is yours alone. Invite others per trip, when you want to."
      footer={
        <>
          Already have an account? <AuthLink href="/signin">Sign in</AuthLink>
        </>
      }
    >
      <SignUpForm />
    </AuthShell>
  );
}
