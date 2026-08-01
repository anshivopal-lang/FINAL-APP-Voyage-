'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { useState, type ReactNode } from 'react';

import { BrandMark } from './Brand';
import { AlertIcon } from './Icons';

/** Shell shared by sign-in and sign-up so the two pages stay identical. */
export function AuthShell({
  title,
  intro,
  children,
  footer,
}: {
  title: string;
  intro: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-16">
      <div className="w-full max-w-md">
        <div className="mb-9 flex flex-col items-center text-center">
          <BrandMark size={44} />
          <h1 className="display-lg mt-6 text-ink-100">{title}</h1>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-ink-400">
            {intro}
          </p>
        </div>

        <div className="panel p-7">{children}</div>

        <p className="mt-6 text-center text-sm text-ink-400">{footer}</p>
      </div>
    </main>
  );
}

function ErrorNote({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="mb-5 flex items-start gap-2.5 rounded-xl border border-rose-500/35 bg-rose-500/8 px-4 py-3 text-sm leading-relaxed text-[#e8b9bc]"
    >
      <span className="mt-0.5 shrink-0">
        <AlertIcon width={16} height={16} />
      </span>
      {message}
    </p>
  );
}

/* -- Sign in ---------------------------------------------------------- */

export function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get('callbackUrl') ?? '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(
    params.get('error') ? 'That email and password do not match.' : '',
  );
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setBusy(true);

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    });

    setBusy(false);

    if (!result || result.error) {
      // One message for every failure. Distinguishing "no such account" from
      // "wrong password" would confirm which emails are registered.
      setError('That email and password do not match.');
      return;
    }

    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <form onSubmit={submit} noValidate>
      {error ? <ErrorNote message={error} /> : null}

      <div className="space-y-4">
        <div>
          <label className="label" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            className="field"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label className="label" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            className="field"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••••"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={busy}
        className="btn btn-primary mt-6 w-full justify-center py-3 text-sm"
      >
        {busy ? 'Signing in…' : 'Sign in'}
      </button>

      <div className="my-6 flex items-center gap-3">
        <span className="rule-gold flex-1 opacity-40" />
        <span className="eyebrow-muted">Private by default</span>
        <span className="rule-gold flex-1 opacity-40" />
      </div>

      <ul className="space-y-2.5 text-xs leading-relaxed text-ink-400">
        <li>· Your holidays are visible only to you and people you invite.</li>
        <li>· Every request is checked against your account on the server.</li>
        <li>· Passwords are hashed with bcrypt and never stored in plain text.</li>
      </ul>
    </form>
  );
}

/* -- Sign up ---------------------------------------------------------- */

interface FieldErrors {
  name?: string;
  email?: string;
  password?: string;
}

export function SignUpForm() {
  const router = useRouter();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setFieldErrors({});
    setBusy(true);

    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });

    const body = await response.json().catch(() => null);

    if (!response.ok) {
      setBusy(false);

      const details = body?.error?.details as
        | Array<{ field: string; message: string }>
        | undefined;

      if (details?.length) {
        setFieldErrors(
          Object.fromEntries(
            details.map((detail) => [detail.field, detail.message]),
          ),
        );
        return;
      }

      setError(body?.error?.message ?? 'Could not create your account.');
      return;
    }

    // Registration succeeded — sign straight in so the user lands inside.
    const signedIn = await signIn('credentials', {
      email,
      password,
      redirect: false,
    });

    setBusy(false);

    if (!signedIn || signedIn.error) {
      setError('Account created, but sign-in failed. Try signing in.');
      return;
    }

    router.push('/');
    router.refresh();
  }

  return (
    <form onSubmit={submit} noValidate>
      {error ? <ErrorNote message={error} /> : null}

      <div className="space-y-4">
        <div>
          <label className="label" htmlFor="name">
            Name
          </label>
          <input
            id="name"
            className="field"
            autoComplete="name"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Alice Nakamura"
            aria-invalid={Boolean(fieldErrors.name)}
          />
          {fieldErrors.name ? (
            <p className="mt-1.5 text-xs text-[#e8a9ad]">{fieldErrors.name}</p>
          ) : null}
        </div>

        <div>
          <label className="label" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            className="field"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            aria-invalid={Boolean(fieldErrors.email)}
          />
          {fieldErrors.email ? (
            <p className="mt-1.5 text-xs text-[#e8a9ad]">{fieldErrors.email}</p>
          ) : null}
        </div>

        <div>
          <label className="label" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            className="field"
            autoComplete="new-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="At least 10 characters"
            aria-invalid={Boolean(fieldErrors.password)}
          />
          {fieldErrors.password ? (
            <p className="mt-1.5 text-xs text-[#e8a9ad]">
              {fieldErrors.password}
            </p>
          ) : (
            <p className="mt-2 text-xs leading-relaxed text-ink-500">
              At least 10 characters. A memorable phrase beats a short password
              full of symbols.
            </p>
          )}
        </div>
      </div>

      <button
        type="submit"
        disabled={busy}
        className="btn btn-primary mt-6 w-full justify-center py-3 text-sm"
      >
        {busy ? 'Creating account…' : 'Create account'}
      </button>

      <p className="mt-5 text-xs leading-relaxed text-ink-500">
        By creating an account you agree to your email being used to identify
        you and to receive holiday invitations.
      </p>
    </form>
  );
}

export function AuthLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="text-gold-400 underline-offset-4 hover:underline">
      {children}
    </Link>
  );
}
