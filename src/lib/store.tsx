'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { can as canDo, isOwner as isOwnerOf } from './permissions';
import type {
  Booking,
  Expense,
  Holiday,
  HolidayDetailsDraft,
  HolidayDocument,
  ItineraryItem,
  MemberRole,
  NotificationSettings,
  Permission,
} from './types';
import { USER_COOKIE, type BuiltInUser } from './users';

export interface Result {
  ok: boolean;
  error?: string;
}

/** Sections that can be wiped individually from holiday settings. */
export type DataSection =
  | 'itinerary'
  | 'bookings'
  | 'expenses'
  | 'documents'
  | 'chat'
  | 'photos';

export const DATA_SECTION_LABELS: Record<DataSection, string> = {
  itinerary: 'Itinerary items',
  bookings: 'Bookings',
  expenses: 'Expenses',
  documents: 'Documents',
  chat: 'Chat history',
  photos: 'Photos',
};

export interface NewHolidayInput {
  name: string;
  country: string;
  cities: string[];
  startDate: string;
  endDate: string;
  primaryCurrency?: string;
  description?: string;
  coverImage?: string;
}

/* ------------------------------------------------------------------ *
 * Transport
 * ------------------------------------------------------------------ */

interface ApiResult<T> {
  ok: boolean;
  error?: string;
  data?: T;
}

/**
 * Every call is same-origin and carries the session cookie automatically.
 * No token is ever held in JavaScript, so nothing identity-related is
 * reachable from the client.
 */
async function api<T>(
  path: string,
  init?: RequestInit,
): Promise<ApiResult<T>> {
  try {
    const response = await fetch(path, {
      ...init,
      headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
      credentials: 'same-origin',
    });

    const body = response.status === 204 ? null : await response.json();

    if (!response.ok) {
      return {
        ok: false,
        error: body?.error?.message ?? 'Something went wrong.',
      };
    }

    return { ok: true, data: body as T };
  } catch {
    return { ok: false, error: 'Could not reach the server.' };
  }
}

/* ------------------------------------------------------------------ *
 * Store
 * ------------------------------------------------------------------ */

interface StoreValue {
  ready: boolean;
  holidays: Holiday[];
  currentUserId: string;
  currentUserName: string;
  currentUser: BuiltInUser;
  /** The four built-in accounts, for the header switcher. */
  users: BuiltInUser[];
  /** Switches account in place — no sign-in, no page reload. */
  switchUser: (userId: string) => void;

  refresh: () => Promise<void>;
  getHoliday: (id: string) => Holiday | undefined;
  can: (holidayId: string, permission: Permission) => boolean;
  isOwner: (holidayId: string) => boolean;

  createHoliday: (
    input: NewHolidayInput,
  ) => Promise<{ result: Result; id?: string }>;
  duplicateHoliday: (id: string) => Promise<{ result: Result; id?: string }>;
  updateHolidayDetails: (
    id: string,
    draft: HolidayDetailsDraft,
  ) => Promise<Result>;
  archiveHoliday: (id: string) => Promise<Result>;
  restoreHoliday: (id: string) => Promise<Result>;
  deleteHoliday: (id: string, confirmName: string) => Promise<Result>;
  setRestoreEnabled: (id: string, enabled: boolean) => Promise<Result>;

  addMember: (
    id: string,
    input: { name: string; email: string; role: MemberRole },
  ) => Promise<Result>;
  updateMemberRole: (
    id: string,
    memberId: string,
    role: MemberRole,
  ) => Promise<Result>;
  toggleMemberPermission: (
    id: string,
    memberId: string,
    permission: Permission,
  ) => Promise<Result>;
  removeMember: (id: string, memberId: string) => Promise<Result>;
  transferOwnership: (id: string, memberId: string) => Promise<Result>;

  updateNotifications: (
    id: string,
    patch: Partial<NotificationSettings>,
  ) => Promise<Result>;
  updateCurrencies: (
    id: string,
    primary: string,
    secondary: string[],
  ) => Promise<Result>;

  addItineraryItem: (
    id: string,
    item: Omit<ItineraryItem, 'id'>,
  ) => Promise<Result>;
  removeItineraryItem: (id: string, itemId: string) => Promise<Result>;
  addBooking: (id: string, booking: Omit<Booking, 'id'>) => Promise<Result>;
  removeBooking: (id: string, bookingId: string) => Promise<Result>;
  addExpense: (id: string, expense: Omit<Expense, 'id'>) => Promise<Result>;
  removeExpense: (id: string, expenseId: string) => Promise<Result>;
  addDocument: (
    id: string,
    doc: Omit<HolidayDocument, 'id' | 'addedAt'>,
  ) => Promise<Result>;
  removeDocument: (id: string, docId: string) => Promise<Result>;
  toggleDocumentConfidential: (id: string, docId: string) => Promise<Result>;
  addPhoto: (id: string, caption: string) => Promise<Result>;
  removePhoto: (id: string, photoId: string) => Promise<Result>;
  postMessage: (id: string, body: string) => Promise<Result>;

  purgeSections: (id: string, sections: DataSection[]) => Promise<Result>;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({
  user,
  users,
  children,
}: {
  user: BuiltInUser;
  users: BuiltInUser[];
  children: ReactNode;
}) {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [ready, setReady] = useState(false);
  const [currentUser, setCurrentUser] = useState<BuiltInUser>(user);

  /** Folds a holiday returned by the API back into local state. */
  const upsert = useCallback((holiday: Holiday) => {
    setHolidays((current) => {
      const index = current.findIndex((item) => item.id === holiday.id);
      if (index === -1) return [holiday, ...current];
      const next = [...current];
      next[index] = holiday;
      return next;
    });
  }, []);

  const refresh = useCallback(async () => {
    const response = await api<{ holidays: Holiday[] }>('/api/holidays');
    if (response.ok && response.data) setHolidays(response.data.holidays);
    setReady(true);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /**
   * Selects a different account.
   *
   * The cookie is written first so the very next request already carries the
   * new identity, then local state updates and the holiday list is refetched.
   * Nothing navigates, so the page never reloads.
   */
  const switchUser = useCallback(
    (userId: string) => {
      const next = users.find((candidate) => candidate.id === userId);
      if (!next || next.id === currentUser.id) return;

      document.cookie = `${USER_COOKIE}=${next.id}; path=/; max-age=31536000; samesite=lax`;
      setCurrentUser(next);
      setReady(false);
      setHolidays([]);
      void refresh();
    },
    [users, currentUser.id, refresh],
  );

  const value = useMemo<StoreValue>(() => {
    const find = (id: string) => holidays.find((holiday) => holiday.id === id);

    /** Sends a mutation and folds the returned holiday back into state. */
    async function mutate(
      path: string,
      init: RequestInit,
    ): Promise<Result> {
      const response = await api<{ holiday: Holiday }>(path, init);
      if (!response.ok) return { ok: false, error: response.error };
      if (response.data?.holiday) upsert(response.data.holiday);
      return { ok: true };
    }

    const post = (path: string, body: unknown) => ({
      method: 'POST',
      body: JSON.stringify(body),
    });

    return {
      ready,
      holidays,
      currentUserId: currentUser.id,
      currentUserName: currentUser.name,
      currentUser,
      users,
      switchUser,

      refresh,
      getHoliday: find,

      // Client-side permission checks decide what to *render*. The server
      // re-checks everything and is the only thing that actually protects data.
      can(holidayId, permission) {
        const holiday = find(holidayId);
        return holiday ? canDo(holiday, currentUser.id, permission) : false;
      },

      isOwner(holidayId) {
        const holiday = find(holidayId);
        return holiday ? isOwnerOf(holiday, currentUser.id) : false;
      },

      async createHoliday(input) {
        const response = await api<{ holiday: Holiday }>(
          '/api/holidays',
          post('/api/holidays', {
            ...input,
            primaryCurrency: input.primaryCurrency ?? 'GBP',
            description: input.description ?? '',
            coverImage: input.coverImage ?? 'aurora',
          }),
        );

        if (!response.ok) return { result: { ok: false, error: response.error } };
        upsert(response.data!.holiday);
        return { result: { ok: true }, id: response.data!.holiday.id };
      },

      async duplicateHoliday(id) {
        const response = await api<{ holiday: Holiday }>(
          `/api/holidays/${id}/duplicate`,
          { method: 'POST' },
        );

        if (!response.ok) return { result: { ok: false, error: response.error } };
        upsert(response.data!.holiday);
        return { result: { ok: true }, id: response.data!.holiday.id };
      },

      updateHolidayDetails(id, draft) {
        return mutate(`/api/holidays/${id}`, {
          method: 'PATCH',
          body: JSON.stringify(draft),
        });
      },

      archiveHoliday(id) {
        return mutate(
          `/api/holidays/${id}/lifecycle`,
          post('', { action: 'archive' }),
        );
      },

      restoreHoliday(id) {
        return mutate(
          `/api/holidays/${id}/lifecycle`,
          post('', { action: 'restore' }),
        );
      },

      setRestoreEnabled(id, enabled) {
        return mutate(
          `/api/holidays/${id}/lifecycle`,
          post('', { action: 'set-restore-enabled', restoreEnabled: enabled }),
        );
      },

      purgeSections(id, sections) {
        return mutate(
          `/api/holidays/${id}/lifecycle`,
          post('', { action: 'purge', sections }),
        );
      },

      async deleteHoliday(id, confirmName) {
        const response = await api(`/api/holidays/${id}`, {
          method: 'DELETE',
          body: JSON.stringify({ confirmName }),
        });

        if (!response.ok) return { ok: false, error: response.error };
        setHolidays((current) => current.filter((item) => item.id !== id));
        return { ok: true };
      },

      addMember(id, input) {
        return mutate(`/api/holidays/${id}/members`, post('', input));
      },

      updateMemberRole(id, memberId, role) {
        return mutate(`/api/holidays/${id}/members/${memberId}`, {
          method: 'PATCH',
          body: JSON.stringify({ role }),
        });
      },

      toggleMemberPermission(id, memberId, permission) {
        const holiday = find(id);
        const member = holiday?.members.find((item) => item.id === memberId);
        if (!member) return Promise.resolve({ ok: false, error: 'Unknown member.' });

        const held = member.permissions.includes(permission);
        const permissions = held
          ? member.permissions.filter((item) => item !== permission)
          : [...member.permissions, permission];

        return mutate(`/api/holidays/${id}/members/${memberId}`, {
          method: 'PATCH',
          body: JSON.stringify({ permissions }),
        });
      },

      removeMember(id, memberId) {
        return mutate(`/api/holidays/${id}/members/${memberId}`, {
          method: 'DELETE',
        });
      },

      transferOwnership(id, memberId) {
        return mutate(
          `/api/holidays/${id}/settings`,
          post('', { action: 'transfer-ownership', memberId }),
        );
      },

      updateNotifications(id, patch) {
        return mutate(
          `/api/holidays/${id}/settings`,
          post('', { action: 'notifications', ...patch }),
        );
      },

      updateCurrencies(id, primary, secondary) {
        return mutate(
          `/api/holidays/${id}/settings`,
          post('', {
            action: 'currencies',
            primaryCurrency: primary,
            secondaryCurrencies: secondary,
          }),
        );
      },

      addItineraryItem: (id, item) =>
        mutate(`/api/holidays/${id}/items/itinerary`, post('', item)),
      removeItineraryItem: (id, itemId) =>
        mutate(`/api/holidays/${id}/items/itinerary/${itemId}`, {
          method: 'DELETE',
        }),

      addBooking: (id, booking) =>
        mutate(`/api/holidays/${id}/items/bookings`, post('', booking)),
      removeBooking: (id, bookingId) =>
        mutate(`/api/holidays/${id}/items/bookings/${bookingId}`, {
          method: 'DELETE',
        }),

      addExpense: (id, expense) =>
        mutate(`/api/holidays/${id}/items/expenses`, post('', expense)),
      removeExpense: (id, expenseId) =>
        mutate(`/api/holidays/${id}/items/expenses/${expenseId}`, {
          method: 'DELETE',
        }),

      addDocument: (id, doc) =>
        mutate(`/api/holidays/${id}/items/documents`, post('', doc)),
      removeDocument: (id, docId) =>
        mutate(`/api/holidays/${id}/items/documents/${docId}`, {
          method: 'DELETE',
        }),

      toggleDocumentConfidential(id, docId) {
        const doc = find(id)?.documents.find((item) => item.id === docId);
        if (!doc) return Promise.resolve({ ok: false, error: 'Unknown document.' });

        return mutate(`/api/holidays/${id}/items/documents/${docId}`, {
          method: 'PATCH',
          body: JSON.stringify({ confidential: !doc.confidential }),
        });
      },

      addPhoto: (id, caption) =>
        mutate(`/api/holidays/${id}/items/photos`, post('', { caption })),
      removePhoto: (id, photoId) =>
        mutate(`/api/holidays/${id}/items/photos/${photoId}`, {
          method: 'DELETE',
        }),

      postMessage: (id, body) =>
        mutate(`/api/holidays/${id}/items/chat`, post('', { body })),
    };
  }, [holidays, ready, refresh, upsert, currentUser, users, switchUser]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStore must be used inside <StoreProvider>.');
  }
  return context;
}
