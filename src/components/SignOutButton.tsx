'use client';

import { signOut } from 'next-auth/react';

import { LogOutIcon } from './Icons';

export function SignOutButton() {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: '/signin' })}
      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm text-ink-300 transition hover:bg-white/5 hover:text-ink-100"
    >
      <LogOutIcon width={15} height={15} />
      Sign out
    </button>
  );
}
