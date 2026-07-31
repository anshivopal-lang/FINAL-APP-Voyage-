'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState, type ReactNode } from 'react';

import { BrandMark, BrandWordmark } from './Brand';
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
  const [scrolled, setScrolled] = useState(false);

  // The header only earns its border and blur once content passes under it.
  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 8);
    }
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

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
    <div className="flex min-h-screen flex-col">
      <header
        className={cx(
          'sticky top-0 z-50 transition-all duration-300',
          scrolled
            ? 'border-b border-white/7 bg-ink-950/72 backdrop-blur-xl'
            : 'border-b border-transparent',
        )}
      >
        <div className="mx-auto flex h-[4.5rem] max-w-6xl items-center gap-5 px-5 sm:px-8">
          <Link href="/" className="group flex items-center gap-2.5">
            <span className="transition-transform duration-500 group-hover:rotate-45">
              <BrandMark size={28} />
            </span>
            <BrandWordmark />
          </Link>

          <span className="hidden h-5 w-px bg-white/10 sm:block" />

          <nav className="flex items-center gap-0.5">
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
                    'relative flex items-center gap-1.5 rounded-lg px-3 py-2 text-[0.8125rem] transition',
                    active
                      ? 'text-ink-100'
                      : 'text-ink-400 hover:text-ink-200',
                  )}
                >
                  <Icon width={15} height={15} />
                  <span className="hidden sm:inline">{item.label}</span>
                  {active ? (
                    <span className="absolute inset-x-3 -bottom-px h-px bg-gradient-to-r from-transparent via-gold-500 to-transparent" />
                  ) : null}
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
                  className="flex items-center gap-2.5 rounded-full border border-white/9 bg-white/4 py-1 pr-3.5 pl-1 text-left transition hover:border-white/16 hover:bg-white/7"
                >
                  <Avatar
                    name={currentPerson.name}
                    color={currentPerson.avatarColor}
                    size={28}
                  />
                  <span className="hidden min-w-0 sm:block">
                    <span className="block truncate text-[0.8125rem] leading-tight text-ink-100">
                      {currentPerson.name}
                    </span>
                    <span className="block text-[0.625rem] leading-tight tracking-[0.12em] text-ink-500 uppercase">
                      Member
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
                    <div className="panel animate-rise absolute right-0 z-20 mt-2.5 w-[19rem] overflow-hidden p-1.5">
                      <p className="eyebrow-muted px-3 py-2.5">View as member</p>
                      {people.map((person) => (
                        <button
                          key={person.id}
                          type="button"
                          onClick={() => {
                            setCurrentMember(person.id);
                            setSwitcherOpen(false);
                          }}
                          className={cx(
                            'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition',
                            person.id === currentMemberId
                              ? 'bg-gold-500/10'
                              : 'hover:bg-white/5',
                          )}
                        >
                          <Avatar
                            name={person.name}
                            color={person.avatarColor}
                            size={32}
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
                          {person.id === currentMemberId ? (
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-gold-500" />
                          ) : null}
                        </button>
                      ))}
                      <p className="mt-1 border-t border-white/7 px-3 pt-3 pb-2 text-xs leading-relaxed text-ink-500">
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

      <main className="mx-auto w-full max-w-6xl flex-1 px-5 pt-10 pb-24 sm:px-8">
        {children}
      </main>

      <footer className="mt-auto">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <div className="rule-gold opacity-40" />
          <div className="flex flex-wrap items-center justify-between gap-3 py-8">
            <div className="flex items-center gap-2.5">
              <BrandMark size={18} />
              <p className="text-xs text-ink-500">
                Voyager — private holiday management.
              </p>
            </div>
            <p className="text-xs text-ink-500">
              Your holidays are visible only to members you invite.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
