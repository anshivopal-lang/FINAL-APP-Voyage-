import type {
  Holiday,
  Member,
  MemberRole,
  Permission,
  PermissionDescriptor,
} from './types';

export const PERMISSIONS: PermissionDescriptor[] = [
  {
    key: 'holiday.view',
    label: 'View holiday',
    description: 'See the holiday, its itinerary and its shared media.',
  },
  {
    key: 'holiday.edit',
    label: 'Edit holiday details',
    description: 'Change dates, destinations, travel legs, cover and currencies.',
  },
  {
    key: 'members.manage',
    label: 'Manage members',
    description: 'Invite, remove and re-permission travelling companions.',
  },
  {
    key: 'itinerary.manage',
    label: 'Manage itinerary',
    description: 'Add, reorder and remove day-by-day plans.',
  },
  {
    key: 'bookings.manage',
    label: 'Manage bookings',
    description: 'Record flights, stays and reservations.',
  },
  {
    key: 'expenses.manage',
    label: 'Manage expenses',
    description: 'Log spending and settle up in any holiday currency.',
  },
  {
    key: 'documents.manage',
    label: 'Manage documents',
    description: 'Upload and remove passports, visas and insurance.',
  },
  {
    key: 'photos.manage',
    label: 'Manage photos',
    description: 'Add to and curate the shared holiday album.',
  },
  {
    key: 'chat.post',
    label: 'Post in chat',
    description: 'Send messages in the holiday group chat.',
  },
  {
    key: 'holiday.archive',
    label: 'Archive holiday',
    description: 'Move a finished holiday into the archive.',
    ownerOnly: true,
  },
  {
    key: 'holiday.delete',
    label: 'Delete holiday',
    description: 'Permanently erase the holiday and everything inside it.',
    ownerOnly: true,
  },
];

/** Permissions that are reserved for the holiday owner, always. */
export const OWNER_ONLY_PERMISSIONS: Permission[] = PERMISSIONS.filter(
  (permission) => permission.ownerOnly,
).map((permission) => permission.key);

export const ROLE_LABELS: Record<MemberRole, string> = {
  owner: 'Owner',
  organiser: 'Organiser',
  traveller: 'Traveller',
  viewer: 'Viewer',
};

export const ROLE_DESCRIPTIONS: Record<MemberRole, string> = {
  owner: 'Full control, including archiving and permanent deletion.',
  organiser: 'Plans the trip and manages everyone else — cannot delete it.',
  traveller: 'Joins in: logs expenses, adds photos and chats.',
  viewer: 'Read-only access to the holiday.',
};

/** Baseline permissions granted purely by holding a role. */
export const ROLE_PERMISSIONS: Record<MemberRole, Permission[]> = {
  owner: PERMISSIONS.map((permission) => permission.key),
  organiser: [
    'holiday.view',
    'holiday.edit',
    'members.manage',
    'itinerary.manage',
    'bookings.manage',
    'expenses.manage',
    'documents.manage',
    'photos.manage',
    'chat.post',
  ],
  traveller: [
    'holiday.view',
    'itinerary.manage',
    'expenses.manage',
    'photos.manage',
    'chat.post',
  ],
  viewer: ['holiday.view'],
};

/**
 * The permissions a member actually holds: role defaults plus explicit grants,
 * with owner-only permissions stripped from anyone who is not the owner.
 */
export function effectivePermissions(
  holiday: Holiday,
  member: Member | undefined,
): Permission[] {
  if (!member) return [];

  if (member.id === holiday.ownerId) {
    return ROLE_PERMISSIONS.owner;
  }

  const granted = new Set<Permission>([
    ...ROLE_PERMISSIONS[member.role],
    ...member.permissions,
  ]);

  for (const ownerOnly of OWNER_ONLY_PERMISSIONS) {
    granted.delete(ownerOnly);
  }

  return PERMISSIONS.map((permission) => permission.key).filter((key) =>
    granted.has(key),
  );
}

export function findMember(
  holiday: Holiday,
  memberId: string,
): Member | undefined {
  return holiday.members.find((member) => member.id === memberId);
}

/** Central authorisation check used by every mutation in the store. */
export function can(
  holiday: Holiday,
  memberId: string,
  permission: Permission,
): boolean {
  const member = findMember(holiday, memberId);
  if (!member) return false;
  return effectivePermissions(holiday, member).includes(permission);
}

export function isOwner(holiday: Holiday, memberId: string): boolean {
  return holiday.ownerId === memberId;
}

/**
 * Whether a member is allowed to see the holiday at all. Archived holidays stay
 * private: only members who were on the trip keep access.
 */
export function canAccess(holiday: Holiday, memberId: string): boolean {
  return can(holiday, memberId, 'holiday.view');
}
