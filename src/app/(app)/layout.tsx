import { cookies } from 'next/headers';
import type { ReactNode } from 'react';

import { AppShell } from '@/components/AppShell';
import { Providers } from '@/components/Providers';
import { BUILT_IN_USERS, resolveUser, USER_COOKIE } from '@/lib/users';

// The selected account lives in a cookie, so nothing here may be cached.
export const dynamic = 'force-dynamic';

/**
 * The app shell.
 *
 * There is no authentication and nothing to redirect to — the dashboard opens
 * directly. The only thing read here is which of the four built-in accounts is
 * selected, so the first paint already shows the right person.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const store = await cookies();
  const current = resolveUser(store.get(USER_COOKIE)?.value);

  return (
    <Providers user={current} users={BUILT_IN_USERS}>
      <AppShell>{children}</AppShell>
    </Providers>
  );
}
