/**
 * Domain model for the Voyager holiday management system.
 *
 * Everything a holiday owns lives on the `Holiday` record so that archiving,
 * restoring and permanent deletion are single, atomic operations.
 */

export type HolidayStatus = 'active' | 'archived';

export type MemberRole = 'owner' | 'organiser' | 'traveller' | 'viewer';

/** Granular capabilities that can be granted to a member of a holiday. */
export type Permission =
  | 'holiday.view'
  | 'holiday.edit'
  | 'holiday.archive'
  | 'holiday.delete'
  | 'members.manage'
  | 'itinerary.manage'
  | 'bookings.manage'
  | 'expenses.manage'
  | 'documents.manage'
  | 'photos.manage'
  | 'chat.post';

export interface PermissionDescriptor {
  key: Permission;
  label: string;
  description: string;
  /** Owner-only permissions can never be granted to another member. */
  ownerOnly?: boolean;
}

export interface Member {
  /** Membership id — unique to this person *on this holiday*. */
  id: string;
  /**
   * The account this membership belongs to, or null when the invited address
   * is not one of the four built-in accounts. With no sign-in there is nothing
   * to claim such an invitation, so it stays unbound — it names someone on the
   * trip without granting anybody access.
   *
   * Ownership and every permission check key on this, never on `id` or
   * `email`, both of which can be re-pointed at a different person.
   */
  userId: string | null;
  name: string;
  email: string;
  image?: string | null;
  role: MemberRole;
  /** Explicit grants layered on top of the role defaults. */
  permissions: Permission[];
  joinedAt: string;
  avatarColor: string;
  /** True when no built-in account backs this membership — see `userId`. */
  pending?: boolean;
  /** Per-member, never shared: each person chooses their own. */
  notifications?: NotificationSettings;
}

export interface TravelLeg {
  /** ISO date, e.g. 2026-08-14 */
  date: string;
  /** 24h time, e.g. 09:45 */
  time: string;
  /** Airport, station or port. Free text. */
  location: string;
  /** Flight/train reference, optional. */
  reference: string;
}

export interface NotificationSettings {
  itineraryChanges: boolean;
  newExpenses: boolean;
  memberActivity: boolean;
  documentUploads: boolean;
  chatMessages: boolean;
  departureReminder: boolean;
  /** Digest cadence for non-urgent updates. */
  digest: 'instant' | 'daily' | 'weekly' | 'off';
}

export interface ItineraryItem {
  id: string;
  title: string;
  date: string;
  time: string;
  city: string;
  notes: string;
}

export interface Booking {
  id: string;
  title: string;
  type: 'flight' | 'hotel' | 'transport' | 'activity' | 'other';
  reference: string;
  date: string;
  amount: number;
  currency: string;
}

export interface Expense {
  id: string;
  title: string;
  category: 'food' | 'travel' | 'stay' | 'activity' | 'shopping' | 'other';
  amount: number;
  currency: string;
  date: string;
  paidByMemberId: string;
}

export interface HolidayDocument {
  id: string;
  name: string;
  type: 'passport' | 'visa' | 'insurance' | 'ticket' | 'reservation' | 'other';
  addedAt: string;
  sizeKb: number;
  /** Documents can be restricted to members who hold `documents.manage`. */
  confidential: boolean;
}

export interface ChatMessage {
  id: string;
  memberId: string;
  /** Author's account id, taken from the session — never from the request. */
  userId?: string | null;
  body: string;
  sentAt: string;
}

export interface Photo {
  id: string;
  caption: string;
  takenAt: string;
  /** A CSS gradient token — the demo has no upload backend. */
  gradient: string;
}

export interface Holiday {
  id: string;
  name: string;
  country: string;
  cities: string[];
  startDate: string;
  endDate: string;
  departure: TravelLeg;
  arrival: TravelLeg;
  primaryCurrency: string;
  secondaryCurrencies: string[];
  coverImage: string;
  description: string;

  /** The *account id* of the owner, not a membership id. */
  ownerId: string;
  members: Member[];

  status: HolidayStatus;
  archivedAt: string | null;
  /** When false, an archived holiday cannot be restored from the archive. */
  restoreEnabled: boolean;

  createdAt: string;
  updatedAt: string;

  /** The requesting member's own preferences, resolved server-side. */
  notifications: NotificationSettings;

  /** How many confidential documents were withheld from this viewer. */
  hiddenDocumentCount?: number;

  itinerary: ItineraryItem[];
  bookings: Booking[];
  expenses: Expense[];
  documents: HolidayDocument[];
  chat: ChatMessage[];
  photos: Photo[];
}

/** The signed-in account, as the client sees it. */
export interface SessionUser {
  id: string;
  name: string;
  email: string;
  image?: string | null;
}

/** Everything a user can change through the holiday editor. */
export type HolidayDetailsDraft = Pick<
  Holiday,
  | 'name'
  | 'country'
  | 'cities'
  | 'startDate'
  | 'endDate'
  | 'departure'
  | 'arrival'
  | 'primaryCurrency'
  | 'secondaryCurrencies'
  | 'coverImage'
  | 'description'
>;
