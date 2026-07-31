import type { NotificationSettings } from './types';

/** Shared by the client store, the API routes and the database layer. */
export const DEFAULT_NOTIFICATIONS: NotificationSettings = {
  itineraryChanges: true,
  newExpenses: true,
  memberActivity: true,
  documentUploads: true,
  chatMessages: false,
  departureReminder: true,
  digest: 'instant',
};
