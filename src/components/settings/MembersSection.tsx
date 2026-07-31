'use client';

import { useState } from 'react';

import { ConfirmDialog } from '@/components/ConfirmDialog';
import { CheckIcon, LockIcon, PlusIcon, ShieldIcon, TrashIcon } from '@/components/Icons';
import { useToast } from '@/components/Toast';
import { Avatar, Badge, Field } from '@/components/ui';
import {
  effectivePermissions,
  PERMISSIONS,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  ROLE_PERMISSIONS,
} from '@/lib/permissions';
import { useStore } from '@/lib/store';
import type { Holiday, MemberRole } from '@/lib/types';
import { cx, formatTimestamp } from '@/lib/utils';

const ASSIGNABLE_ROLES: MemberRole[] = ['organiser', 'traveller', 'viewer'];

export function MembersSection({
  holiday,
  readOnly,
}: {
  holiday: Holiday;
  readOnly: boolean;
}) {
  const store = useStore();
  const toast = useToast();
  const [invite, setInvite] = useState({
    name: '',
    email: '',
    role: 'traveller' as MemberRole,
  });
  const [removing, setRemoving] = useState<string | null>(null);
  const [transferring, setTransferring] = useState<string | null>(null);

  const isOwner = store.isOwner(holiday.id);
  const removingMember = holiday.members.find((member) => member.id === removing);
  const transferMember = holiday.members.find(
    (member) => member.id === transferring,
  );

  async function add() {
    if (!invite.email.trim()) {
      toast.error('Enter an email address to invite someone.');
      return;
    }
    if (
      await toast.fromResult(
        store.addMember(holiday.id, invite),
        `${invite.name.trim() || invite.email} added to the holiday.`,
      )
    ) {
      setInvite({ name: '', email: '', role: 'traveller' });
    }
  }

  return (
    <div className="space-y-7">
      <section>
        <h3 className="display mb-1.5 text-lg text-ink-100">Members</h3>
        <p className="mb-4 text-sm text-ink-400">
          Everyone here can see the holiday. What they can change is set by their
          role and any extra permissions below.
        </p>

        <div className="space-y-2">
          {holiday.members.map((member) => {
            const owner = member.id === holiday.ownerId;
            const permissions = effectivePermissions(holiday, member);

            return (
              <div key={member.id} className="panel-flat px-4 py-3.5">
                <div className="flex flex-wrap items-center gap-3">
                  <Avatar name={member.name} color={member.avatarColor} size={36} />

                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-sm text-ink-100">
                      {member.name}
                      {member.userId === store.currentUserId ? (
                        <Badge tone="gold">You</Badge>
                      ) : null}
                      {owner ? <Badge tone="sage">Owner</Badge> : null}
                    </p>
                    <p className="truncate text-xs text-ink-500">
                      {member.email} · joined {formatTimestamp(member.joinedAt)}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {owner ? (
                      <span className="chip chip-gold">
                        <ShieldIcon width={12} height={12} />
                        Full control
                      </span>
                    ) : (
                      <select
                        className="field w-auto py-1.5 text-xs"
                        aria-label={`Role for ${member.name}`}
                        disabled={readOnly}
                        value={member.role}
                        onChange={(event) =>
                          toast.fromResult(
                            store.updateMemberRole(
                              holiday.id,
                              member.id,
                              event.target.value as MemberRole,
                            ),
                            `${member.name} is now a ${ROLE_LABELS[
                              event.target.value as MemberRole
                            ].toLowerCase()}.`,
                          )
                        }
                      >
                        {ASSIGNABLE_ROLES.map((role) => (
                          <option key={role} value={role}>
                            {ROLE_LABELS[role]}
                          </option>
                        ))}
                      </select>
                    )}

                    {isOwner && !owner ? (
                      <button
                        type="button"
                        title="Transfer ownership"
                        onClick={() => setTransferring(member.id)}
                        className="rounded-lg p-1.5 text-ink-500 transition hover:bg-white/6 hover:text-gold-400"
                      >
                        <ShieldIcon width={15} height={15} />
                      </button>
                    ) : null}

                    {!readOnly && !owner ? (
                      <button
                        type="button"
                        title={`Remove ${member.name}`}
                        onClick={() => setRemoving(member.id)}
                        className="rounded-lg p-1.5 text-ink-500 transition hover:bg-white/6 hover:text-rose-500"
                      >
                        <TrashIcon width={15} height={15} />
                      </button>
                    ) : null}
                  </div>
                </div>

                <p className="mt-2 text-xs text-ink-500">
                  {owner
                    ? ROLE_DESCRIPTIONS.owner
                    : `${ROLE_DESCRIPTIONS[member.role]} · ${permissions.length} permission${permissions.length === 1 ? '' : 's'}`}
                </p>
              </div>
            );
          })}
        </div>

        {!readOnly ? (
          <div className="panel-flat mt-4 p-4">
            <p className="mb-3 text-sm font-medium text-ink-200">
              Invite someone
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Name" htmlFor="inv-name">
                <input
                  id="inv-name"
                  className="field"
                  value={invite.name}
                  placeholder="Optional"
                  onChange={(event) =>
                    setInvite({ ...invite, name: event.target.value })
                  }
                />
              </Field>
              <Field label="Email" htmlFor="inv-email">
                <input
                  id="inv-email"
                  type="email"
                  className="field"
                  value={invite.email}
                  placeholder="name@example.com"
                  onChange={(event) =>
                    setInvite({ ...invite, email: event.target.value })
                  }
                />
              </Field>
              <Field label="Role" htmlFor="inv-role">
                <select
                  id="inv-role"
                  className="field"
                  value={invite.role}
                  onChange={(event) =>
                    setInvite({
                      ...invite,
                      role: event.target.value as MemberRole,
                    })
                  }
                >
                  {ASSIGNABLE_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {ROLE_LABELS[role]}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="mt-3 flex justify-end">
              <button type="button" className="btn btn-primary" onClick={add}>
                <PlusIcon width={15} height={15} />
                Add member
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <section>
        <h3 className="display mb-1.5 text-lg text-ink-100">Permissions</h3>
        <p className="mb-4 text-sm text-ink-400">
          A tick from the role is automatic. Add extra permissions on top for
          individual members — deleting and archiving stay with the owner.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[42rem] border-collapse text-sm">
            <thead>
              <tr>
                <th className="eyebrow-muted sticky left-0 z-10 bg-ink-900 px-3 py-3 text-left">
                  Permission
                </th>
                {holiday.members.map((member) => (
                  <th key={member.id} className="px-2 py-2.5">
                    <span className="flex flex-col items-center gap-1">
                      <Avatar
                        name={member.name}
                        color={member.avatarColor}
                        size={26}
                      />
                      <span className="max-w-20 truncate text-[0.6875rem] font-normal text-ink-400">
                        {member.name.split(' ')[0]}
                      </span>
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERMISSIONS.map((permission) => (
                <tr key={permission.key} className="border-t border-white/6">
                  <td className="sticky left-0 z-10 bg-ink-900 px-3 py-3">
                    <span className="flex items-center gap-1.5 text-ink-200">
                      {permission.label}
                      {permission.ownerOnly ? (
                        <span
                          className="text-gold-500"
                          title="Owner only — cannot be delegated"
                        >
                          <LockIcon width={12} height={12} />
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-0.5 block text-xs text-ink-500">
                      {permission.description}
                    </span>
                  </td>

                  {holiday.members.map((member) => {
                    const owner = member.id === holiday.ownerId;
                    const fromRole =
                      !owner &&
                      ROLE_PERMISSIONS[member.role].includes(permission.key);
                    const held = effectivePermissions(holiday, member).includes(
                      permission.key,
                    );
                    const locked =
                      readOnly || owner || fromRole || permission.ownerOnly;

                    return (
                      <td key={member.id} className="px-2 py-2.5 text-center">
                        <button
                          type="button"
                          disabled={locked}
                          aria-label={`${permission.label} for ${member.name}`}
                          aria-pressed={held}
                          title={
                            owner
                              ? 'The owner holds every permission.'
                              : permission.ownerOnly
                                ? 'Owner only — cannot be granted.'
                                : fromRole
                                  ? `Granted by the ${ROLE_LABELS[member.role].toLowerCase()} role.`
                                  : held
                                    ? 'Granted directly — click to remove.'
                                    : 'Click to grant.'
                          }
                          onClick={() =>
                            toast.fromResult(
                              store.toggleMemberPermission(
                                holiday.id,
                                member.id,
                                permission.key,
                              ),
                              'Permissions updated.',
                            )
                          }
                          className={cx(
                            'inline-flex h-7 w-7 items-center justify-center rounded-lg border transition',
                            held
                              ? fromRole || owner
                                ? 'border-white/12 bg-white/8 text-ink-300'
                                : 'border-gold-500/50 bg-gold-500/18 text-gold-300'
                              : 'border-white/8 bg-transparent text-transparent',
                            !locked && 'hover:border-gold-500/45',
                            locked && 'cursor-not-allowed',
                          )}
                        >
                          <CheckIcon width={14} height={14} />
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-3 flex flex-wrap gap-4 text-xs text-ink-500">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded border border-white/12 bg-white/8" />
            From role
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded border border-gold-500/50 bg-gold-500/18" />
            Granted individually
          </span>
          <span className="flex items-center gap-1.5">
            <LockIcon width={12} height={12} />
            Owner only
          </span>
        </div>
      </section>

      <ConfirmDialog
        open={Boolean(removing)}
        onCancel={() => setRemoving(null)}
        onConfirm={() => {
          if (!removingMember) return;
          toast.fromResult(
            store.removeMember(holiday.id, removingMember.id),
            `${removingMember.name} removed from the holiday.`,
          );
          setRemoving(null);
        }}
        title={`Remove ${removingMember?.name ?? 'member'}?`}
        description="They lose access to this holiday immediately."
        confirmLabel="Remove member"
        body={
          <ul className="space-y-1.5 text-sm text-ink-300">
            <li>· Their expenses and messages stay on the holiday.</li>
            <li>· They will no longer see the itinerary, documents or photos.</li>
            <li>· You can invite them again at any time.</li>
          </ul>
        }
      />

      <ConfirmDialog
        open={Boolean(transferring)}
        onCancel={() => setTransferring(null)}
        onConfirm={() => {
          if (!transferMember) return;
          toast.fromResult(
            store.transferOwnership(holiday.id, transferMember.id),
            `${transferMember.name} is now the owner.`,
          );
          setTransferring(null);
        }}
        tone="neutral"
        title={`Make ${transferMember?.name ?? 'member'} the owner?`}
        description="Ownership carries the right to archive and permanently delete this holiday."
        confirmLabel="Transfer ownership"
        body={
          <ul className="space-y-1.5 text-sm text-ink-300">
            <li>· They gain every permission, including deletion.</li>
            <li>· You become an organiser and keep editing rights.</li>
            <li>· Only the new owner can transfer ownership back.</li>
          </ul>
        }
      />
    </div>
  );
}
