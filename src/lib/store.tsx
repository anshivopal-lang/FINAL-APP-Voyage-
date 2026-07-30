'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { AVATAR_COLORS, PHOTO_GRADIENTS } from './covers';
import { COUNTRY_CURRENCY } from './currency';
import { can, isOwner, ROLE_PERMISSIONS } from './permissions';
import { CURRENT_MEMBER_ID, DEFAULT_NOTIFICATIONS } from './seed';
import { clearState, loadState, saveState, STORAGE_KEY } from './storage';
import type {
  Booking,
  ChatMessage,
  Expense,
  Holiday,
  HolidayDetailsDraft,
  HolidayDocument,
  ItineraryItem,
  Member,
  MemberRole,
  NotificationSettings,
  Permission,
  Photo,
  VoyageState,
} from './types';
import { createId, nowIso } from './utils';

export interface Result {
  ok: boolean;
  error?: string;
}

const OK: Result = { ok: true };

function fail(error: string): Result {
  return { ok: false, error };
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

interface StoreValue {
  /** False until localStorage has been read on the client. */
  ready: boolean;
  holidays: Holiday[];
  currentMemberId: string;
  currentMemberName: string;

  getHoliday: (id: string) => Holiday | undefined;
  can: (holidayId: string, permission: Permission) => boolean;
  isOwner: (holidayId: string) => boolean;

  setCurrentMember: (memberId: string) => void;

  createHoliday: (input: NewHolidayInput) => { result: Result; id?: string };
  duplicateHoliday: (id: string) => { result: Result; id?: string };
  updateHolidayDetails: (id: string, draft: HolidayDetailsDraft) => Result;
  archiveHoliday: (id: string) => Result;
  restoreHoliday: (id: string) => Result;
  deleteHoliday: (id: string) => Result;
  setRestoreEnabled: (id: string, enabled: boolean) => Result;

  addMember: (
    id: string,
    input: { name: string; email: string; role: MemberRole },
  ) => Result;
  updateMemberRole: (id: string, memberId: string, role: MemberRole) => Result;
  toggleMemberPermission: (
    id: string,
    memberId: string,
    permission: Permission,
  ) => Result;
  removeMember: (id: string, memberId: string) => Result;
  transferOwnership: (id: string, memberId: string) => Result;

  updateNotifications: (
    id: string,
    patch: Partial<NotificationSettings>,
  ) => Result;
  updateCurrencies: (
    id: string,
    primary: string,
    secondary: string[],
  ) => Result;

  addItineraryItem: (id: string, item: Omit<ItineraryItem, 'id'>) => Result;
  removeItineraryItem: (id: string, itemId: string) => Result;
  addBooking: (id: string, booking: Omit<Booking, 'id'>) => Result;
  removeBooking: (id: string, bookingId: string) => Result;
  addExpense: (id: string, expense: Omit<Expense, 'id'>) => Result;
  removeExpense: (id: string, expenseId: string) => Result;
  addDocument: (
    id: string,
    doc: Omit<HolidayDocument, 'id' | 'addedAt'>,
  ) => Result;
  removeDocument: (id: string, docId: string) => Result;
  toggleDocumentConfidential: (id: string, docId: string) => Result;
  addPhoto: (id: string, caption: string) => Result;
  removePhoto: (id: string, photoId: string) => Result;
  postMessage: (id: string, body: string) => Result;

  purgeSections: (id: string, sections: DataSection[]) => Result;
  resetDemoData: () => void;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<VoyageState | null>(null);
  const stateRef = useRef<VoyageState | null>(null);
  /** Set while we are the tab writing, so we ignore our own storage event. */
  const writingRef = useRef(false);

  const commit = useCallback((next: VoyageState) => {
    stateRef.current = next;
    setState(next);
    writingRef.current = true;
    saveState(next);
    writingRef.current = false;
  }, []);

  useEffect(() => {
    const initial = loadState();
    stateRef.current = initial;
    setState(initial);
  }, []);

  // Other tabs are other "sessions" of the same membership: when one of them
  // writes, pull the change in so every authorised view stays current.
  useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (event.key !== STORAGE_KEY || writingRef.current) return;
      const next = loadState();
      stateRef.current = next;
      setState(next);
    }

    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const value = useMemo<StoreValue>(() => {
    const holidays = state?.holidays ?? [];
    const currentMemberId = state?.currentMemberId ?? CURRENT_MEMBER_ID;

    function current(): VoyageState {
      return stateRef.current ?? { version: 1, currentMemberId, holidays: [] };
    }

    function getHoliday(id: string): Holiday | undefined {
      return current().holidays.find((holiday) => holiday.id === id);
    }

    /** Applies `patch` to one holiday after checking `permission`. */
    function mutateHoliday(
      id: string,
      permission: Permission,
      patch: (holiday: Holiday) => Holiday,
    ): Result {
      const snapshot = current();
      const holiday = snapshot.holidays.find((item) => item.id === id);
      if (!holiday) return fail('That holiday no longer exists.');

      if (!can(holiday, snapshot.currentMemberId, permission)) {
        return fail('You do not have permission to do that.');
      }

      commit({
        ...snapshot,
        holidays: snapshot.holidays.map((item) =>
          item.id === id ? { ...patch(item), updatedAt: nowIso() } : item,
        ),
      });

      return OK;
    }

    function nextAvatarColor(holiday: Holiday): string {
      return AVATAR_COLORS[holiday.members.length % AVATAR_COLORS.length];
    }

    function makeCurrentMember(): Member {
      const existing = current()
        .holidays.flatMap((holiday) => holiday.members)
        .find((member) => member.id === current().currentMemberId);

      return (
        existing ?? {
          id: CURRENT_MEMBER_ID,
          name: 'Aashish Opal',
          email: 'aashishopal@gmail.com',
          role: 'owner',
          permissions: [],
          joinedAt: nowIso(),
          avatarColor: AVATAR_COLORS[0],
        }
      );
    }

    const currentMemberName = makeCurrentMember().name;

    return {
      ready: state !== null,
      holidays,
      currentMemberId,
      currentMemberName,

      getHoliday,

      can(holidayId, permission) {
        const holiday = getHoliday(holidayId);
        if (!holiday) return false;
        return can(holiday, current().currentMemberId, permission);
      },

      isOwner(holidayId) {
        const holiday = getHoliday(holidayId);
        if (!holiday) return false;
        return isOwner(holiday, current().currentMemberId);
      },

      setCurrentMember(memberId) {
        commit({ ...current(), currentMemberId: memberId });
      },

      createHoliday(input) {
        const snapshot = current();
        const owner: Member = { ...makeCurrentMember(), role: 'owner', permissions: [] };
        const id = createId('hol');
        const timestamp = nowIso();
        const primaryCurrency =
          input.primaryCurrency || COUNTRY_CURRENCY[input.country] || 'GBP';

        const holiday: Holiday = {
          id,
          name: input.name.trim() || 'Untitled holiday',
          country: input.country,
          cities: input.cities.filter(Boolean),
          startDate: input.startDate,
          endDate: input.endDate,
          departure: {
            date: input.startDate,
            time: '',
            location: '',
            reference: '',
          },
          arrival: { date: input.endDate, time: '', location: '', reference: '' },
          primaryCurrency,
          secondaryCurrencies: [],
          coverImage: input.coverImage || 'aurora',
          description: input.description ?? '',
          ownerId: owner.id,
          members: [owner],
          status: 'active',
          archivedAt: null,
          restoreEnabled: true,
          createdAt: timestamp,
          updatedAt: timestamp,
          notifications: { ...DEFAULT_NOTIFICATIONS },
          itinerary: [],
          bookings: [],
          expenses: [],
          documents: [],
          chat: [],
          photos: [],
        };

        commit({ ...snapshot, holidays: [holiday, ...snapshot.holidays] });
        return { result: OK, id };
      },

      duplicateHoliday(sourceId) {
        const snapshot = current();
        const source = snapshot.holidays.find((item) => item.id === sourceId);
        if (!source) return { result: fail('That holiday no longer exists.') };
        if (!can(source, snapshot.currentMemberId, 'holiday.view')) {
          return { result: fail('You do not have access to that holiday.') };
        }

        const id = createId('hol');
        const timestamp = nowIso();
        const owner: Member = { ...makeCurrentMember(), role: 'owner', permissions: [] };

        // Planning details carry over; anything that happened on the original
        // trip (spend, chat, photos, dates) deliberately does not.
        const copy: Holiday = {
          ...source,
          id,
          name: `${source.name} (copy)`,
          startDate: '',
          endDate: '',
          departure: { date: '', time: '', location: source.departure.location, reference: '' },
          arrival: { date: '', time: '', location: source.arrival.location, reference: '' },
          ownerId: owner.id,
          members: [
            owner,
            ...source.members
              .filter((member) => member.id !== owner.id)
              .map((member) => ({ ...member, joinedAt: timestamp })),
          ],
          status: 'active',
          archivedAt: null,
          restoreEnabled: true,
          createdAt: timestamp,
          updatedAt: timestamp,
          notifications: { ...source.notifications },
          itinerary: source.itinerary.map((item) => ({
            ...item,
            id: createId('itin'),
            date: '',
          })),
          bookings: [],
          expenses: [],
          documents: source.documents
            .filter((doc) => !doc.confidential)
            .map((doc) => ({ ...doc, id: createId('doc'), addedAt: timestamp })),
          chat: [],
          photos: [],
        };

        commit({ ...snapshot, holidays: [copy, ...snapshot.holidays] });
        return { result: OK, id };
      },

      updateHolidayDetails(id, draft) {
        return mutateHoliday(id, 'holiday.edit', (holiday) => ({
          ...holiday,
          ...draft,
          cities: draft.cities.map((city) => city.trim()).filter(Boolean),
          secondaryCurrencies: draft.secondaryCurrencies.filter(
            (code) => code !== draft.primaryCurrency,
          ),
        }));
      },

      archiveHoliday(id) {
        return mutateHoliday(id, 'holiday.archive', (holiday) => ({
          ...holiday,
          status: 'archived',
          archivedAt: nowIso(),
        }));
      },

      restoreHoliday(id) {
        const holiday = getHoliday(id);
        if (holiday && !holiday.restoreEnabled) {
          return fail('Restore is disabled for this holiday.');
        }
        return mutateHoliday(id, 'holiday.archive', (item) => ({
          ...item,
          status: 'active',
          archivedAt: null,
        }));
      },

      setRestoreEnabled(id, enabled) {
        return mutateHoliday(id, 'holiday.archive', (holiday) => ({
          ...holiday,
          restoreEnabled: enabled,
        }));
      },

      deleteHoliday(id) {
        const snapshot = current();
        const holiday = snapshot.holidays.find((item) => item.id === id);
        if (!holiday) return fail('That holiday no longer exists.');

        // Deletion is owner-only and is never delegated, even to an organiser
        // holding every other permission.
        if (!isOwner(holiday, snapshot.currentMemberId)) {
          return fail('Only the holiday owner can delete a holiday.');
        }

        commit({
          ...snapshot,
          holidays: snapshot.holidays.filter((item) => item.id !== id),
        });

        return OK;
      },

      addMember(id, input) {
        const email = input.email.trim().toLowerCase();
        if (!email) return fail('An email address is required.');

        const holiday = getHoliday(id);
        if (holiday?.members.some((member) => member.email.toLowerCase() === email)) {
          return fail('That person is already on this holiday.');
        }

        return mutateHoliday(id, 'members.manage', (item) => ({
          ...item,
          members: [
            ...item.members,
            {
              id: createId('mem'),
              name: input.name.trim() || email.split('@')[0],
              email,
              role: input.role,
              permissions: [],
              joinedAt: nowIso(),
              avatarColor: nextAvatarColor(item),
            },
          ],
        }));
      },

      updateMemberRole(id, memberId, role) {
        const holiday = getHoliday(id);
        if (holiday && holiday.ownerId === memberId) {
          return fail('The owner’s role cannot be changed. Transfer ownership instead.');
        }

        return mutateHoliday(id, 'members.manage', (item) => ({
          ...item,
          members: item.members.map((member) =>
            member.id === memberId
              ? {
                  ...member,
                  role,
                  // Explicit grants already covered by the new role are folded
                  // back in so the permission grid reads cleanly.
                  permissions: member.permissions.filter(
                    (permission) => !ROLE_PERMISSIONS[role].includes(permission),
                  ),
                }
              : member,
          ),
        }));
      },

      toggleMemberPermission(id, memberId, permission) {
        const holiday = getHoliday(id);
        if (holiday && holiday.ownerId === memberId) {
          return fail('The owner always holds every permission.');
        }

        return mutateHoliday(id, 'members.manage', (item) => ({
          ...item,
          members: item.members.map((member) => {
            if (member.id !== memberId) return member;

            const fromRole = ROLE_PERMISSIONS[member.role].includes(permission);
            const granted = member.permissions.includes(permission);

            if (fromRole) {
              // Role already grants it; removing means downgrading the role.
              return member;
            }

            return {
              ...member,
              permissions: granted
                ? member.permissions.filter((key) => key !== permission)
                : [...member.permissions, permission],
            };
          }),
        }));
      },

      removeMember(id, memberId) {
        const holiday = getHoliday(id);
        if (holiday && holiday.ownerId === memberId) {
          return fail('The owner cannot be removed from their own holiday.');
        }

        return mutateHoliday(id, 'members.manage', (item) => ({
          ...item,
          members: item.members.filter((member) => member.id !== memberId),
        }));
      },

      transferOwnership(id, memberId) {
        const snapshot = current();
        const holiday = snapshot.holidays.find((item) => item.id === id);
        if (!holiday) return fail('That holiday no longer exists.');
        if (!isOwner(holiday, snapshot.currentMemberId)) {
          return fail('Only the current owner can transfer ownership.');
        }
        if (!holiday.members.some((member) => member.id === memberId)) {
          return fail('That person is not a member of this holiday.');
        }

        commit({
          ...snapshot,
          holidays: snapshot.holidays.map((item) =>
            item.id !== id
              ? item
              : {
                  ...item,
                  ownerId: memberId,
                  updatedAt: nowIso(),
                  members: item.members.map((member) => {
                    if (member.id === memberId) return { ...member, role: 'owner' };
                    if (member.id === item.ownerId) {
                      return { ...member, role: 'organiser' };
                    }
                    return member;
                  }),
                },
          ),
        });

        return OK;
      },

      updateNotifications(id, patch) {
        return mutateHoliday(id, 'holiday.view', (holiday) => ({
          ...holiday,
          notifications: { ...holiday.notifications, ...patch },
        }));
      },

      updateCurrencies(id, primary, secondary) {
        return mutateHoliday(id, 'holiday.edit', (holiday) => ({
          ...holiday,
          primaryCurrency: primary,
          secondaryCurrencies: secondary.filter((code) => code !== primary),
        }));
      },

      addItineraryItem(id, item) {
        return mutateHoliday(id, 'itinerary.manage', (holiday) => ({
          ...holiday,
          itinerary: [...holiday.itinerary, { ...item, id: createId('itin') }].sort(
            (a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`),
          ),
        }));
      },

      removeItineraryItem(id, itemId) {
        return mutateHoliday(id, 'itinerary.manage', (holiday) => ({
          ...holiday,
          itinerary: holiday.itinerary.filter((item) => item.id !== itemId),
        }));
      },

      addBooking(id, booking) {
        return mutateHoliday(id, 'bookings.manage', (holiday) => ({
          ...holiday,
          bookings: [...holiday.bookings, { ...booking, id: createId('bk') }],
        }));
      },

      removeBooking(id, bookingId) {
        return mutateHoliday(id, 'bookings.manage', (holiday) => ({
          ...holiday,
          bookings: holiday.bookings.filter((booking) => booking.id !== bookingId),
        }));
      },

      addExpense(id, expense) {
        return mutateHoliday(id, 'expenses.manage', (holiday) => ({
          ...holiday,
          expenses: [{ ...expense, id: createId('exp') }, ...holiday.expenses],
        }));
      },

      removeExpense(id, expenseId) {
        return mutateHoliday(id, 'expenses.manage', (holiday) => ({
          ...holiday,
          expenses: holiday.expenses.filter((expense) => expense.id !== expenseId),
        }));
      },

      addDocument(id, doc) {
        return mutateHoliday(id, 'documents.manage', (holiday) => ({
          ...holiday,
          documents: [
            { ...doc, id: createId('doc'), addedAt: nowIso() },
            ...holiday.documents,
          ],
        }));
      },

      removeDocument(id, docId) {
        return mutateHoliday(id, 'documents.manage', (holiday) => ({
          ...holiday,
          documents: holiday.documents.filter((doc) => doc.id !== docId),
        }));
      },

      toggleDocumentConfidential(id, docId) {
        return mutateHoliday(id, 'documents.manage', (holiday) => ({
          ...holiday,
          documents: holiday.documents.map((doc) =>
            doc.id === docId ? { ...doc, confidential: !doc.confidential } : doc,
          ),
        }));
      },

      addPhoto(id, caption) {
        return mutateHoliday(id, 'photos.manage', (holiday) => {
          const photo: Photo = {
            id: createId('pho'),
            caption: caption.trim() || 'Untitled',
            takenAt: nowIso(),
            gradient:
              PHOTO_GRADIENTS[holiday.photos.length % PHOTO_GRADIENTS.length],
          };
          return { ...holiday, photos: [photo, ...holiday.photos] };
        });
      },

      removePhoto(id, photoId) {
        return mutateHoliday(id, 'photos.manage', (holiday) => ({
          ...holiday,
          photos: holiday.photos.filter((photo) => photo.id !== photoId),
        }));
      },

      postMessage(id, body) {
        const text = body.trim();
        if (!text) return fail('Message is empty.');

        return mutateHoliday(id, 'chat.post', (holiday) => {
          const message: ChatMessage = {
            id: createId('msg'),
            memberId: current().currentMemberId,
            body: text,
            sentAt: nowIso(),
          };
          return { ...holiday, chat: [...holiday.chat, message] };
        });
      },

      purgeSections(id, sections) {
        const snapshot = current();
        const holiday = snapshot.holidays.find((item) => item.id === id);
        if (!holiday) return fail('That holiday no longer exists.');
        if (!isOwner(holiday, snapshot.currentMemberId)) {
          return fail('Only the holiday owner can erase holiday data.');
        }

        commit({
          ...snapshot,
          holidays: snapshot.holidays.map((item) => {
            if (item.id !== id) return item;
            const next = { ...item, updatedAt: nowIso() };
            for (const section of sections) {
              next[section] = [] as never;
            }
            return next;
          }),
        });

        return OK;
      },

      resetDemoData() {
        clearState();
        const fresh = loadState();
        commit(fresh);
      },
    };
  }, [state, commit]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStore must be used inside <StoreProvider>.');
  }
  return context;
}

/** Convenience hook for a single holiday plus the caller's rights on it. */
export function useHoliday(id: string) {
  const store = useStore();
  const holiday = store.getHoliday(id);

  return {
    ...store,
    holiday,
    canEdit: store.can(id, 'holiday.edit'),
    canManageMembers: store.can(id, 'members.manage'),
    owner: holiday ? store.isOwner(id) : false,
  };
}
