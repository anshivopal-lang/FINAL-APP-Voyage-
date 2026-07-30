'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { ConfirmDialog } from '@/components/ConfirmDialog';
import { HolidayHero } from '@/components/holiday/HolidayHero';
import {
  BookingsPanel,
  ChatPanel,
  DocumentsPanel,
  ExpensesPanel,
  ItineraryPanel,
  OverviewPanel,
  PhotosPanel,
} from '@/components/holiday/Panels';
import {
  ArchiveIcon,
  ChatIcon,
  CompassIcon,
  FileIcon,
  ImageIcon,
  LockIcon,
  PlaneIcon,
  WalletIcon,
  CalendarIcon,
} from '@/components/Icons';
import { useToast } from '@/components/Toast';
import { Badge, EmptyState } from '@/components/ui';
import { canAccess } from '@/lib/permissions';
import { useStore } from '@/lib/store';
import { cx } from '@/lib/utils';

const TABS = [
  { key: 'overview', label: 'Overview', icon: CompassIcon },
  { key: 'itinerary', label: 'Itinerary', icon: CalendarIcon },
  { key: 'bookings', label: 'Bookings', icon: PlaneIcon },
  { key: 'expenses', label: 'Expenses', icon: WalletIcon },
  { key: 'documents', label: 'Documents', icon: FileIcon },
  { key: 'photos', label: 'Photos', icon: ImageIcon },
  { key: 'chat', label: 'Chat', icon: ChatIcon },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export default function HolidayPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const store = useStore();
  const toast = useToast();
  const router = useRouter();

  const [tab, setTab] = useState<TabKey>('overview');
  const [archiving, setArchiving] = useState(false);

  const holiday = store.getHoliday(id);
  const hasAccess = holiday
    ? canAccess(holiday, store.currentMemberId)
    : false;

  const canManageDocuments = store.can(id, 'documents.manage');

  const documentView = useMemo(() => {
    if (!holiday) return null;
    return {
      ...holiday,
      documents: canManageDocuments
        ? holiday.documents
        : holiday.documents.filter((doc) => !doc.confidential),
    };
  }, [holiday, canManageDocuments]);

  if (!store.ready) {
    return (
      <div className="py-32 text-center text-sm text-ink-500">Loading…</div>
    );
  }

  if (!holiday) {
    return (
      <EmptyState
        icon={<CompassIcon width={28} height={28} />}
        title="This holiday no longer exists"
        description="It may have been permanently deleted by its owner."
        action={
          <Link href="/" className="btn btn-ghost">
            Back to dashboard
          </Link>
        }
      />
    );
  }

  if (!hasAccess) {
    return (
      <EmptyState
        icon={<LockIcon width={28} height={28} />}
        title="You do not have access to this holiday"
        description="Holidays are private. Ask the owner to add you as a member."
        action={
          <Link href="/" className="btn btn-ghost">
            Back to dashboard
          </Link>
        }
      />
    );
  }

  function duplicate() {
    const { result, id: newId } = store.duplicateHoliday(id);
    if (!toast.fromResult(result, 'Holiday duplicated.')) return;
    if (newId) router.push(`/holidays/${newId}`);
  }

  function archive() {
    setArchiving(false);
    if (toast.fromResult(store.archiveHoliday(id), 'Holiday moved to the archive.')) {
      router.push('/archive');
    }
  }

  const archived = holiday.status === 'archived';

  return (
    <div className="animate-rise space-y-6">
      <HolidayHero
        holiday={holiday}
        canEdit={store.can(id, 'holiday.edit')}
        canArchive={store.can(id, 'holiday.archive')}
        onDuplicate={duplicate}
        onArchive={() => setArchiving(true)}
      />

      {archived ? (
        <div className="panel flex flex-wrap items-center gap-3 px-5 py-4">
          <span className="text-ink-400">
            <ArchiveIcon width={17} height={17} />
          </span>
          <p className="min-w-0 flex-1 text-sm text-ink-300">
            This holiday is archived. It stays private to its members and is
            read-only until it is restored.
          </p>
          <Link href="/archive" className="btn btn-ghost">
            Open archive
          </Link>
        </div>
      ) : null}

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {TABS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className={cx(
                'flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-2 text-sm transition',
                tab === item.key
                  ? 'border-gold-500/40 bg-gold-500/12 text-gold-300'
                  : 'border-white/8 bg-white/3 text-ink-400 hover:bg-white/6 hover:text-ink-200',
              )}
            >
              <Icon width={15} height={15} />
              {item.label}
            </button>
          );
        })}
      </div>

      <div className="panel p-5 sm:p-6">
        {tab === 'overview' ? <OverviewPanel holiday={holiday} /> : null}

        {tab === 'itinerary' ? (
          <ItineraryPanel
            holiday={holiday}
            readOnly={archived || !store.can(id, 'itinerary.manage')}
          />
        ) : null}

        {tab === 'bookings' ? (
          <BookingsPanel
            holiday={holiday}
            readOnly={archived || !store.can(id, 'bookings.manage')}
          />
        ) : null}

        {tab === 'expenses' ? (
          <ExpensesPanel
            holiday={holiday}
            readOnly={archived || !store.can(id, 'expenses.manage')}
          />
        ) : null}

        {tab === 'documents' && documentView ? (
          <>
            <DocumentsPanel
              holiday={documentView}
              readOnly={archived || !canManageDocuments}
            />
            {!canManageDocuments &&
            holiday.documents.length !== documentView.documents.length ? (
              <p className="mt-4 flex items-center gap-2 text-xs text-ink-500">
                <LockIcon width={13} height={13} />
                {holiday.documents.length - documentView.documents.length}{' '}
                confidential document
                {holiday.documents.length - documentView.documents.length === 1
                  ? ''
                  : 's'}{' '}
                hidden from your permission level.
              </p>
            ) : null}
          </>
        ) : null}

        {tab === 'photos' ? (
          <PhotosPanel
            holiday={holiday}
            readOnly={archived || !store.can(id, 'photos.manage')}
          />
        ) : null}

        {tab === 'chat' ? (
          <ChatPanel
            holiday={holiday}
            readOnly={archived || !store.can(id, 'chat.post')}
          />
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-ink-500">
        <Badge tone="neutral">
          {store.isOwner(id) ? 'You own this holiday' : 'Shared with you'}
        </Badge>
        <span>Last updated {new Date(holiday.updatedAt).toLocaleString('en-GB')}</span>
      </div>

      <ConfirmDialog
        open={archiving}
        onCancel={() => setArchiving(false)}
        onConfirm={archive}
        tone="neutral"
        title="Archive this holiday?"
        description="Archiving keeps everything — it just moves the trip out of your active list."
        confirmLabel="Archive holiday"
        body={
          <ul className="space-y-1.5 text-sm text-ink-300">
            <li>· Itinerary, bookings, expenses, documents, chat and photos are kept.</li>
            <li>· Members keep access and can search it in the archive.</li>
            <li>· You can restore it later while restore stays enabled.</li>
          </ul>
        }
      />
    </div>
  );
}
