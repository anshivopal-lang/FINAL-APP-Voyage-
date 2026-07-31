import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';

import { upsertUser } from '@/lib/server/repository';

/**
 * Auth.js v5 configuration.
 *
 * Sessions are stateless JWTs in an httpOnly, SameSite=Lax cookie — nothing
 * about identity is readable or writable from client JavaScript, and the only
 * source of a user id anywhere in the app is `auth()` on the server.
 *
 * Google is the sole provider: there is no password to steal and no way to
 * assume another account from the UI.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      // Always let the user pick which Google account to use, rather than
      // silently reusing whichever one the browser is already signed into.
      authorization: { params: { prompt: 'select_account' } },
    }),
  ],

  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 },

  pages: { signIn: '/signin', error: '/signin' },

  callbacks: {
    /**
     * Runs on sign-in and on every token refresh. On first sign-in we mint (or
     * fetch) the local user row and pin its id into the token, so every later
     * request identifies the user without another database round trip.
     */
    async jwt({ token, account, profile }) {
      if (account && profile) {
        const user = await upsertUser({
          // Google's `sub` is stable and unique per account — the right join
          // key. Email is mutable and must never be the primary identity.
          googleId: profile.sub as string,
          email: (profile.email as string).toLowerCase(),
          name: (profile.name as string) ?? (profile.email as string),
          image: (profile.picture as string) ?? null,
        });

        token.userId = user.id;
        token.email = user.email;
        token.name = user.name;
        token.picture = user.image;
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
