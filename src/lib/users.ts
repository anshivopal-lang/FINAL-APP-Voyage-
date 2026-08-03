/**
 * The four built-in accounts.
 *
 * Authentication has been removed, so there is no sign-in and no session.
 * Identity is simply whichever of these four is selected in the header, carried
 * to the server in a plain cookie.
 *
 * The ids are fixed rather than generated so they survive a reseed, a redeploy
 * and a fresh database — the switcher and the data both keep pointing at the
 * same person.
 *
 * NOTE: a cookie the browser can write is not a security boundary. Anyone who
 * can reach the app can select any of the four. That is the accepted trade of
 * running without authentication; data is still kept strictly separate between
 * them, but it is separation for tidiness, not protection.
 */
export interface BuiltInUser {
  id: string;
  name: string;
  email: string;
  avatarColor: string;
}

export const BUILT_IN_USERS: BuiltInUser[] = [
  {
    id: '00000000-0000-4000-8000-000000000001',
    name: 'Aashish Opal',
    email: 'aashish@voyager.local',
    avatarColor: '#8b6f3f',
  },
  {
    id: '00000000-0000-4000-8000-000000000002',
    name: 'Neha Opal',
    email: 'neha@voyager.local',
    avatarColor: '#6b3f8b',
  },
  {
    id: '00000000-0000-4000-8000-000000000003',
    name: 'Anshiv Opal',
    email: 'anshiv@voyager.local',
    avatarColor: '#3f6b8b',
  },
  {
    id: '00000000-0000-4000-8000-000000000004',
    name: 'Shivom Opal',
    email: 'shivom@voyager.local',
    avatarColor: '#3f8b6b',
  },
];

/** Whoever the app falls back to when no choice has been made yet. */
export const DEFAULT_USER = BUILT_IN_USERS[0];

/** The cookie carrying the selected account to the server. */
export const USER_COOKIE = 'voyager.user';

/**
 * Resolves an id to a built-in user, falling back to the default.
 *
 * Every entry point goes through this, so an unknown or tampered cookie value
 * can only ever resolve to one of the four — it can never reach the database
 * as an arbitrary string.
 */
export function resolveUser(id: string | undefined | null): BuiltInUser {
  return BUILT_IN_USERS.find((user) => user.id === id) ?? DEFAULT_USER;
}
