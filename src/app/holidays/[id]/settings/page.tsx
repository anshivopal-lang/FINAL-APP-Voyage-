'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';

import {
  AlertIcon,
  ArchiveIcon,
  BellIcon,
  ChevronLeftIcon,
  CompassIcon,
  FileIcon,
  LockIcon,
  SettingsIcon,
  UsersIcon,
  WalletIcon,
} from '@/components/Icons';
import { DetailsSection } from '@/components/settings/DetailsSection';
import { MembersSection } from '@/components/settings/MembersSection';
import {
  ArchiveSection,
  CurrencySection,
  DangerSection,
  DocumentsSection,
  NotificationsSection,
} from '@/components/settings/Sections';
import { Badge, EmptyState } from '@/components/ui';
import { canAccess } from '@/lib/permissions';
import { useStore } from '@/lib/store';
import { cx } from '@/lib/utils';

const SECTIONS = [
  { key: 'details', label: 'Holiday details', icon: SettingsIcon },
  { key: 'members', label: 'Members & permissions', icon: UsersIcon },
  { key: 'notifications', label: 'Notifications', icon: BellIcon },
  { key: 'currency', label: 'Currency', icon: WalletIcon },
  { key: 'documents', label: 'Documents', icon: FileIcon },
  { key: 'archive', label: 'Archive', icon: ArchiveIcon },
  { key: 'danger', label: 'Data & deletion', icon: AlertIcon },
] as const;

type SectionKey = (typeof SECTIONS)[number]['key'];

export default function HolidaySettingsPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const store = useStore();
  const [section, setSection] = useState<SectionKey>('details');

  const holiday = store.getHoliday(id);

  if (!store.ready) {
    return <div className="py-32 text-center text-sm text-ink-500">Loading…</div>;
  }

  if (!holiday) {
    return (
      <EmptyState
        icon={<CompassIcon width={28} height={28} />}
        title="This holiday no longer exists"
        description="It may have been permanently deleted."
        action={
          <Link href="/" className="btn btn-ghost">
            Back to dashboard
          </Link>
        }
      />
    );
  }

  if (!canAccess(holiday, store.currentMemberId)) {
    return (
      <EmptyState
        icon={<LockIcon width={28} height={28} />}
        title="You do not have access to these settings"
        description="Holiday settings are visible only to its members."
        action={
          <Link href="/" className="btn btn-ghost">
            Back to dashboard
          </Link>
        }
      />
    );
  }

  const canEdit = store.can(id, 'holiday.edit');
  const canManageMembers = store.can(id, 'members.manage');
  const canManageDocuments = store.can(id, 'documents.manage');
  const isOwner = store.isOwner(id);

  return (
    <div className="animate-rise">
      <Link
        href={`/holidays/${id}`}
        className="mb-5 inline-flex items-center gap-1 text-sm text-ink-400 transition hover:text-ink-100"
      >
        <ChevronLeftIcon width={15} height={15} />
        Back to {holiday.name}
      </Link>

      <div className="mb-9 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Holiday settings</p>
          <h1 className="display-lg mt-3 text-ink-100">{holiday.name}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {holiday.status === 'archived' ? (
            <Badge tone="neutral">Archived</Badge>
          ) : null}
          <Badge tone={isOwner ? 'gold' : 'neutral'}>
            {isOwner ? 'Owner' : 'Member'}
          </Badge>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[15rem_1fr]">
        <nav className="panel h-fit p-2 lg:sticky lg:top-24">
          <ul className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
            {SECTIONS.map((item) => {
              const Icon = item.icon;
              const active = section === item.key;
              const danger = item.key === 'danger';

              return (
                <li key={item.key} className="shrink-0 lg:shrink">
                  <button
                    type="button"
                    onClick={() => setSection(item.key)}
                    className={cx(
                      'flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[0.8125rem] transition duration-200',
                      active
                        ? danger
                          ? 'bg-rose-500/12 text-[#f0b4b8]'
                          : 'bg-gold-500/12 text-gold-300 shadow-[0_1px_0_rgba(255,255,255,0.06)_inset]'
                        : 'text-ink-400 hover:bg-white/4 hover:text-ink-200',
                    )}
                  >
                    <Icon width={16} height={16} />
                    <span className="whitespace-nowrap lg:whitespace-normal">
                      {item.label}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="panel p-5 sm:p-6">
          {section === 'details' ? (
            <DetailsSection
              holiday={holiday}
              readOnly={!canEdit || holiday.status === 'archived'}
            />
          ) : null}

          {section === 'members' ? (
            <MembersSection
              holiday={holiday}
              readOnly={!canManageMembers || holiday.status === 'archived'}
            />
          ) : null}

          {section === 'notifications' ? (
            <NotificationsSection holiday={holiday} />
          ) : null}

          {section === 'currency' ? (
            <CurrencySection
              holiday={holiday}
              readOnly={!canEdit || holiday.status === 'archived'}
            />
          ) : null}

          {section === 'documents' ? (
            <DocumentsSection
              holiday={{
                ...holiday,
                documents: canManageDocuments
                  ? holiday.documents
                  : holiday.documents.filter((doc) => !doc.confidential),
              }}
              readOnly={!canManageDocuments || holiday.status === 'archived'}
            />
          ) : null}

          {section === 'archive' ? <ArchiveSection holiday={holiday} /> : null}

          {section === 'danger' ? <DangerSection holiday={holiday} /> : null}
        </div>
      </div>
    </div>
  );
}
