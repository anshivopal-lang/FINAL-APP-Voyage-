'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';

import { BrandMark, BrandWordmark } from './Brand';
import { ArchiveIcon, CheckIcon, CompassIcon } from './Icons';
import { Avatar } from './ui';
import { useStore } from '@/lib/store';
import { cx } from '@/lib/utils';

const NAV = [
  { href: '/', label: 'Dashboard', icon: CompassIcon },
  { href: '/archive', label: 'Archive', icon: ArchiveIcon },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { currentUser, users, switchUser } = useStore();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
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

  // Close the menu whenever the route changes.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

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
                    active ? 'text-ink-100' : 'text-ink-400 hover:text-ink-200',
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

          {/*
            Account switcher. There is no authentication: this simply chooses
            which of the four built-in accounts the app is acting as, and each
            one sees only its own holidays.
          */}
          <div className="relative ml-auto">
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label={`Switch account — currently ${currentUser.name}`}
              onClick={() => setMenuOpen((open) => !open)}
              className="flex items-center gap-2.5 rounded-full border border-white/9 bg-white/4 py-1 pr-3.5 pl-1 text-left transition hover:border-white/16 hover:bg-white/7"
            >
              <Avatar
                name={currentUser.name}
                color={currentUser.avatarColor}
                size={28}
              />
              <span className="hidden min-w-0 sm:block">
                <span className="block max-w-[9rem] truncate text-[0.8125rem] leading-tight text-ink-100">
                  {currentUser.name}
                </span>
                <span className="block text-[0.625rem] leading-tight tracking-[0.12em] text-ink-500 uppercase">
                  Switch account
                </span>
              </span>
            </button>

            {menuOpen ? (
              <>
                <button
                  type="button"
                  aria-label="Close menu"
                  onClick={() => setMenuOpen(false)}
                  className="fixed inset-0 z-10 cursor-default"
                />
                <div
                  role="menu"
                  className="panel animate-rise absolute right-0 z-20 mt-2.5 w-[17rem] overflow-hidden p-1.5"
                >
                  <p className="eyebrow-muted px-3 py-2.5">Accounts</p>

                  {users.map((person) => {
                    const active = person.id === currentUser.id;
                    return (
                      <button
                        key={person.id}
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          switchUser(person.id);
                          setMenuOpen(false);
                        }}
                        className={cx(
                          'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition',
                          active ? 'bg-gold-500/10' : 'hover:bg-white/5',
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
                            {person.email}
                          </span>
                        </span>
                        {active ? (
                          <span className="shrink-0 text-gold-400">
                            <CheckIcon width={15} height={15} />
                          </span>
                        ) : null}
                      </button>
                    );
                  })}

                  <p className="mt-1 border-t border-white/7 px-3 pt-3 pb-2 text-xs leading-relaxed text-ink-500">
                    Each account keeps its own holidays, expenses and documents.
                    Nothing is shared between them.
                  </p>
                </div>
              </>
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
              Four built-in accounts · no sign-in required
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
