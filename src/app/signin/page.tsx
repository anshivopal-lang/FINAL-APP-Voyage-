import { redirect } from 'next/navigation';

import { auth, signIn } from '@/auth';
import { BrandMark } from '@/components/Brand';

export const metadata = { title: 'Sign in' };
export const dynamic = 'force-dynamic';

function GoogleGlyph() {
  return (
    <svg width="17" height="17" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"
      />
    </svg>
  );
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>;
}) {
  const session = await auth();
  if (session?.user?.id) redirect('/');

  const { error, callbackUrl } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-16">
      <div className="w-full max-w-md">
        <div className="mb-9 flex flex-col items-center text-center">
          <BrandMark size={44} />
          <h1 className="display-lg mt-6 text-ink-100">Voyager</h1>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-ink-400">
            A private place for the trips that matter. Sign in to reach your own
            holidays — nothing here is shared unless you invite someone.
          </p>
        </div>

        <div className="panel p-7">
          {error ? (
            <p
              role="alert"
              className="mb-5 rounded-xl border border-rose-500/35 bg-rose-500/8 px-4 py-3 text-sm text-[#e8b9bc]"
            >
              {error === 'OAuthAccountNotLinked'
                ? 'That email is already linked to a different sign-in method.'
                : 'Sign-in did not complete. Please try again.'}
            </p>
          ) : null}

          <form
            action={async () => {
              'use server';
              await signIn('google', {
                redirectTo: callbackUrl ?? '/',
              });
            }}
          >
            <button
              type="submit"
              className="btn btn-primary w-full justify-center py-3 text-sm"
            >
              <GoogleGlyph />
              Continue with Google
            </button>
          </form>

          <div className="my-6 flex items-center gap-3">
            <span className="rule-gold flex-1 opacity-40" />
            <span className="eyebrow-muted">Private by default</span>
            <span className="rule-gold flex-1 opacity-40" />
          </div>

          <ul className="space-y-2.5 text-xs leading-relaxed text-ink-400">
            <li>· Your holidays are visible only to you and people you invite.</li>
            <li>· Every request is checked against your account on the server.</li>
            <li>· We store your name, email and avatar from Google — nothing else.</li>
          </ul>
        </div>

        <p className="mt-6 text-center text-xs text-ink-500">
          By continuing you agree to your Google profile being used to identify
          your account.
        </p>
      </div>
    </main>
  );
}
