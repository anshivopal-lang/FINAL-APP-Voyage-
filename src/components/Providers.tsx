'use client';

import type { ReactNode } from 'react';

import { ToastProvider } from './Toast';
import { StoreProvider } from '@/lib/store';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <StoreProvider>{children}</StoreProvider>
    </ToastProvider>
  );
}
