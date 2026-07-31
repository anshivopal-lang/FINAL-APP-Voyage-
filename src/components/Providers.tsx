'use client';

import type { ReactNode } from 'react';

import { ToastProvider } from './Toast';
import { StoreProvider } from '@/lib/store';
import type { SessionUser } from '@/lib/types';

export function Providers({
  user,
  children,
}: {
  user: SessionUser;
  children: ReactNode;
}) {
  return (
    <ToastProvider>
      <StoreProvider user={user}>{children}</StoreProvider>
    </ToastProvider>
  );
}
