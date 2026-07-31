import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { auth } from '@/auth';
import { AppShell } from '@/components/AppShell';
import { Providers } from '@/components/Providers';

// Auth state is per-request, so nothing under here may be statically cached.
export const dynamic = 'force-dynamic';

/**
 * The gate for every authenticated page.
 *
 * This is a convenience redirect, not the security boundary — each API route
 * independently re-checks the session, so a page rendering without one still
 * cannot reach any data.
 */
export default async function AppLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/signin');
  }

  const user = {
    id: session.user.id,
    name: session.user.name ?? 'Traveller',
    email: session.user.email ?? '',
    image: session.user.image ?? null,
  };

  return (
    <Providers user={user}>
      <AppShell user={user}>{children}</AppShell>
    </Providers>
  );
}
