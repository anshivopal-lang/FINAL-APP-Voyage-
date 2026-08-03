'use client';

import type { ReactNode } from 'react';

import { ToastProvider } from './Toast';
import { StoreProvider } from '@/lib/store';
import type { BuiltInUser } from '@/lib/users';

export function Providers({
  user,
  users,
  children,
}: {
  user: BuiltInUser;
  users: BuiltInUser[];
  children: ReactNode;
}) {
  return (
    <ToastProvider>
      <StoreProvider user={user} users={users}>
        {children}
      </StoreProvider>
    </ToastProvider>
  );
}
