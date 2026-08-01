import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';

import { rateLimit } from '@/lib/server/rate-limit';
import { verifyCredentials } from '@/lib/server/repository';

/**
 * Auth.js v5 — email and password only.
 *
 * Sessions are stateless JWTs in an httpOnly, SameSite=Lax cookie, so nothing
 * about identity is readable or writable from client JavaScript. The only
 * source of a user id anywhere in the app is `auth()` on the server.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      name: 'Email and password',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },

      /**
       * Runs on every sign-in attempt.
       *
       * Returning null makes Auth.js answer with a generic CredentialsSignin
       * error. That is deliberate: the UI must not be able to distinguish
       * "no such account" from "wrong password", or it becomes an oracle for
       * which email addresses are registered.
       */
      async authorize(raw, request) {
        const email = typeof raw?.email === 'string' ? raw.email.trim() : '';
        const password = typeof raw?.password === 'string' ? raw.password : '';

        if (!email || !password) return null;

        // Throttle per address *and* per target account, so neither spraying
        // one password across many emails nor hammering one account is cheap.
        const ip =
          request?.headers?.get('x-forwarded-for')?.split(',')[0]?.trim() ??
          'unknown';

        for (const key of [`login:ip:${ip}`, `login:email:${email.toLowerCase()}`]) {
          if (!rateLimit(key, 10, 15 * 60 * 1000).allowed) return null;
        }

        const user = await verifyCredentials(email, password);
        if (!user) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
  ],

  // Credentials sign-in requires JWT sessions; the database-session strategy
  // is not supported for this provider.
  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 },

  pages: { signIn: '/signin', error: '/signin' },

  callbacks: {
    /**
     * `user` is present only on the request that established the session —
     * that is where the account id gets pinned into the token, so every later
     * request identifies the user without another database round trip.
     */
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id as string;
        token.email = user.email;
        token.name = user.name;
        token.picture = user.image ?? null;
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.userId as string;
        session.user.email = token.email as string;
        session.user.name = token.name as string;
        session.user.image = (token.picture as string) ?? null;
      }
      return session;
    },
  },

  trustHost: true,
});
