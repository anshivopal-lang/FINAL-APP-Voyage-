'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo, useState, type ReactNode } from 'react';

import { ArchiveIcon, CompassIcon } from './Icons';
import { Avatar } from './ui';
import { useStore } from '@/lib/store';
import { cx } from '@/lib/utils';

const NAV = [
  { href: '/', label: 'Dashboard', icon: CompassIcon },
  { href: '/archive', label: 'Archive', icon: ArchiveIcon },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { holidays, currentMemberId, setCurrentMember, ready } = useStore();
  const [switcherOpen, setSwitcherOpen] = useState(false);

  /**
   * Every distinct person across the account's holidays. Switching identity is
   * how the permission model can be seen working end to end.
   */
  const people = useMemo(() => {
    const seen = new Map<
      string,
      { id: string; name: string; email: string; avatarColor: string; trips: number }
    >();

    for (const holiday of holidays) {
      for (const member of holiday.members) {
        const existing = seen.get(member.id);
        if (existing) {
          existing.trips += 1;
        } else {
          seen.set(member.id, {
            id: member.id,
            name: member.name,
            email: member.email,
            avatarColor: member.avatarColor,
            trips: 1,
          });
        }
      }
    }

    return [...seen.values()].sort((a, b) => b.trips - a.trips);
  }, [holidays]);

  const currentPerson =
    people.find((person) => person.id === currentMemberId) ?? people[0];

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-50 border-b border-white/7 bg-ink-950/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-gold-500/40 bg-gold-500/12 text-gold-400">
              <CompassIcon width={17} height={17} />
            </span>
            <span className="display text-lg tracking-tight text-ink-100">
              Voyage
            </span>
          </Link>

          <nav className="ml-2 flex items-center gap-1">
            {NAV.map((item) => {
              const active =
                item.href === '/'
                  ? pathname === '/'
                  : pathname.startsWith(item.href);
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cx(
                    'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm transition',
                    active
                      ? 'bg-white/8 text-ink-100'
                      : 'text-ink-400 hover:bg-white/5 hover:text-ink-200',
                  )}
                >
                  <Icon width={15} height={15} />
                  <span className="hidden sm:inline">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            {ready && currentPerson ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setSwitcherOpen((open) => !open)}
                  className="flex items-center gap-2 rounded-xl border border-white/9 bg-white/4 px-2 py-1.5 text-left transition hover:bg-white/8"
                >
                  <Avatar
                    name={currentPerson.name}
                    color={currentPerson.avatarColor}
                    size={26}
                  />
                  <span className="hidden min-w-0 sm:block">
                    <span className="block truncate text-xs font-medium text-ink-100">
                      {currentPerson.name}
                    </span>
                    <span className="block text-[0.6875rem] text-ink-500">
                      Signed in
                    </span>
                  </span>
                </button>

                {switcherOpen ? (
                  <>
                    <button
                      type="button"
                      aria-label="Close menu"
                      onClick={() => setSwitcherOpen(false)}
                      className="fixed inset-0 z-10 cursor-default"
                    />
                    <div className="panel absolute right-0 z-20 mt-2 w-72 overflow-hidden p-1.5">
                      <p className="px-2.5 py-2 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-ink-500">
                        View as member
                      </p>
                      {people.map((person) => (
                        <button
                          key={person.id}
                          type="button"
                          onClick={() => {
                            setCurrentMember(person.id);
                            setSwitcherOpen(false);
                          }}
                          className={cx(
                            'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition',
                            person.id === currentMemberId
                              ? 'bg-gold-500/12'
                              : 'hover:bg-white/6',
                          )}
                        >
                          <Avatar
                            name={person.name}
                            color={person.avatarColor}
                            size={30}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm text-ink-100">
                              {person.name}
                            </span>
                            <span className="block truncate text-xs text-ink-500">
                              {person.trips} holiday
                              {person.trips === 1 ? '' : 's'}
                            </span>
                          </span>
                        </button>
                      ))}
                      <p className="border-t border-white/7 px-2.5 pt-2.5 pb-2 text-xs leading-relaxed text-ink-500">
                        Switching identity applies the permissions that person
                        holds on each holiday.
                      </p>
                    </div>
                  </>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pt-8 pb-20 sm:px-6">{children}</main>

      <footer className="border-t border-white/7 py-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 text-xs text-ink-500 sm:px-6">
          <p>Voyage — private holiday management.</p>
          <p>Your holidays are visible only to members you invite.</p>
        </div>
      </footer>
    </div>
  );
}
