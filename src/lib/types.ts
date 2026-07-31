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
  id: string;
  name: string;
  email: string;
  role: MemberRole;
  /** Explicit grants layered on top of the role defaults. */
  permissions: Permission[];
  joinedAt: string;
  avatarColor: string;
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

  ownerId: string;
  members: Member[];

  status: HolidayStatus;
  archivedAt: string | null;
  /** When false, an archived holiday cannot be restored from the archive. */
  restoreEnabled: boolean;

  createdAt: string;
  updatedAt: string;

  notifications: NotificationSettings;

  itinerary: ItineraryItem[];
  bookings: Booking[];
  expenses: Expense[];
  documents: HolidayDocument[];
  chat: ChatMessage[];
  photos: Photo[];
}

/** Shape persisted to storage. Versioned so migrations stay possible. */
export interface VoyagerState {
  version: number;
  /** The member id the session is acting as. */
  currentMemberId: string;
  holidays: Holiday[];
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
