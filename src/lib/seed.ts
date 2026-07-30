import { AVATAR_COLORS, PHOTO_GRADIENTS } from './covers';
import type { Holiday, Member, NotificationSettings, VoyageState } from './types';

export const STATE_VERSION = 1;

/** The signed-in member. Fixed id so the seed can reference it everywhere. */
export const CURRENT_MEMBER_ID = 'mem_you';

export const DEFAULT_NOTIFICATIONS: NotificationSettings = {
  itineraryChanges: true,
  newExpenses: true,
  memberActivity: true,
  documentUploads: true,
  chatMessages: false,
  departureReminder: true,
  digest: 'instant',
};

function offsetDate(days: number): string {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function offsetTimestamp(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function member(
  id: string,
  name: string,
  email: string,
  role: Member['role'],
  colorIndex: number,
  joinedDaysAgo: number,
): Member {
  return {
    id,
    name,
    email,
    role,
    permissions: [],
    joinedAt: offsetTimestamp(-joinedDaysAgo),
    avatarColor: AVATAR_COLORS[colorIndex % AVATAR_COLORS.length],
  };
}

const you = () =>
  member(CURRENT_MEMBER_ID, 'Aashish Opal', 'aashishopal@gmail.com', 'owner', 0, 400);

function buildJapan(): Holiday {
  const start = offsetDate(48);
  const end = offsetDate(62);
  return {
    id: 'hol_japan',
    name: 'Cherry Blossom in Japan',
    country: 'Japan',
    cities: ['Tokyo', 'Hakone', 'Kyoto', 'Osaka'],
    startDate: start,
    endDate: end,
    departure: {
      date: start,
      time: '11:20',
      location: 'London Heathrow (LHR) · Terminal 3',
      reference: 'JL044',
    },
    arrival: {
      date: end,
      time: '06:15',
      location: 'London Heathrow (LHR) · Terminal 3',
      reference: 'JL043',
    },
    primaryCurrency: 'JPY',
    secondaryCurrencies: ['GBP'],
    coverImage: 'orchid',
    description:
      'Two weeks chasing the blossom north to south — ryokan nights in Hakone, temple mornings in Kyoto and far too much food in Osaka.',
    ownerId: CURRENT_MEMBER_ID,
    members: [
      you(),
      member('mem_priya', 'Priya Raman', 'priya.raman@example.com', 'organiser', 1, 90),
      member('mem_tom', 'Tom Whitfield', 'tom.whitfield@example.com', 'traveller', 2, 88),
      member('mem_lena', 'Lena Fischer', 'lena.fischer@example.com', 'viewer', 3, 40),
    ],
    status: 'active',
    archivedAt: null,
    restoreEnabled: true,
    createdAt: offsetTimestamp(-95),
    updatedAt: offsetTimestamp(-2),
    notifications: { ...DEFAULT_NOTIFICATIONS },
    itinerary: [
      {
        id: 'itin_jp_1',
        title: 'Arrive Haneda, check in at Shibuya',
        date: offsetDate(49),
        time: '07:30',
        city: 'Tokyo',
        notes: 'Airport limousine bus to the hotel. Rest, then evening walk to the crossing.',
      },
      {
        id: 'itin_jp_2',
        title: 'TeamLab Planets + Toyosu market breakfast',
        date: offsetDate(50),
        time: '06:00',
        city: 'Tokyo',
        notes: 'Timed entry tickets already booked — 13:30 slot.',
      },
      {
        id: 'itin_jp_3',
        title: 'Shinkansen to Hakone, ryokan night',
        date: offsetDate(53),
        time: '09:40',
        city: 'Hakone',
        notes: 'Private onsen booked for 19:00. Kaiseki dinner included.',
      },
      {
        id: 'itin_jp_4',
        title: 'Fushimi Inari before sunrise',
        date: offsetDate(56),
        time: '05:15',
        city: 'Kyoto',
        notes: 'Beat the crowds — full circuit takes around two hours.',
      },
    ],
    bookings: [
      {
        id: 'bk_jp_1',
        title: 'JAL — London to Tokyo Haneda',
        type: 'flight',
        reference: 'QK7T2P',
        date: start,
        amount: 4380,
        currency: 'GBP',
      },
      {
        id: 'bk_jp_2',
        title: 'Cerulean Tower Tokyu — 4 nights',
        type: 'hotel',
        reference: 'CT-889120',
        date: offsetDate(49),
        amount: 268400,
        currency: 'JPY',
      },
      {
        id: 'bk_jp_3',
        title: 'Gora Kadan ryokan — 2 nights',
        type: 'hotel',
        reference: 'GK-4471',
        date: offsetDate(53),
        amount: 412000,
        currency: 'JPY',
      },
      {
        id: 'bk_jp_4',
        title: 'JR Pass — 14 day, green car',
        type: 'transport',
        reference: 'JRP-220913',
        date: offsetDate(45),
        amount: 320000,
        currency: 'JPY',
      },
    ],
    expenses: [
      {
        id: 'exp_jp_1',
        title: 'Pocket wifi rental',
        category: 'travel',
        amount: 9800,
        currency: 'JPY',
        date: offsetDate(-5),
        paidByMemberId: 'mem_priya',
      },
      {
        id: 'exp_jp_2',
        title: 'Travel insurance — group policy',
        category: 'other',
        amount: 214,
        currency: 'GBP',
        date: offsetDate(-12),
        paidByMemberId: CURRENT_MEMBER_ID,
      },
    ],
    documents: [
      {
        id: 'doc_jp_1',
        name: 'Passports (all members).pdf',
        type: 'passport',
        addedAt: offsetTimestamp(-30),
        sizeKb: 2480,
        confidential: true,
      },
      {
        id: 'doc_jp_2',
        name: 'JAL e-tickets.pdf',
        type: 'ticket',
        addedAt: offsetTimestamp(-28),
        sizeKb: 640,
        confidential: false,
      },
      {
        id: 'doc_jp_3',
        name: 'Group travel insurance certificate.pdf',
        type: 'insurance',
        addedAt: offsetTimestamp(-12),
        sizeKb: 310,
        confidential: true,
      },
    ],
    chat: [
      {
        id: 'msg_jp_1',
        memberId: 'mem_priya',
        body: 'Ryokan confirmed for the 3rd night — they hold the private onsen from 7pm.',
        sentAt: offsetTimestamp(-4),
      },
      {
        id: 'msg_jp_2',
        memberId: 'mem_tom',
        body: 'Adding a Nara day trip to the itinerary if nobody objects.',
        sentAt: offsetTimestamp(-2),
      },
    ],
    photos: [],
  };
}

function buildAmalfi(): Holiday {
  const start = offsetDate(-3);
  const end = offsetDate(6);
  return {
    id: 'hol_amalfi',
    name: 'Amalfi Coast Escape',
    country: 'Italy',
    cities: ['Naples', 'Positano', 'Ravello'],
    startDate: start,
    endDate: end,
    departure: {
      date: start,
      time: '06:55',
      location: 'London Gatwick (LGW) · North Terminal',
      reference: 'BA2606',
    },
    arrival: {
      date: end,
      time: '21:40',
      location: 'London Gatwick (LGW) · North Terminal',
      reference: 'BA2607',
    },
    primaryCurrency: 'EUR',
    secondaryCurrencies: ['GBP'],
    coverImage: 'sunset',
    description:
      'Nine slow days on the coast. Boat to Capri midweek, and a table booked at the cliffside place in Ravello for the last night.',
    ownerId: CURRENT_MEMBER_ID,
    members: [
      you(),
      member('mem_sofia', 'Sofia Marchetti', 'sofia.m@example.com', 'organiser', 4, 60),
      member('mem_dan', 'Dan Okonkwo', 'dan.okonkwo@example.com', 'traveller', 5, 58),
    ],
    status: 'active',
    archivedAt: null,
    restoreEnabled: true,
    createdAt: offsetTimestamp(-70),
    updatedAt: offsetTimestamp(-1),
    notifications: { ...DEFAULT_NOTIFICATIONS, chatMessages: true },
    itinerary: [
      {
        id: 'itin_am_1',
        title: 'Private transfer Naples → Positano',
        date: start,
        time: '10:30',
        city: 'Positano',
        notes: 'Driver meets at arrivals with a name board.',
      },
      {
        id: 'itin_am_2',
        title: 'Boat day to Capri',
        date: offsetDate(1),
        time: '09:00',
        city: 'Positano',
        notes: 'Skipper picks us up from the main beach jetty.',
      },
      {
        id: 'itin_am_3',
        title: 'Dinner at Rossellinis, Ravello',
        date: offsetDate(5),
        time: '20:00',
        city: 'Ravello',
        notes: 'Smart dress. Table for three on the terrace.',
      },
    ],
    bookings: [
      {
        id: 'bk_am_1',
        title: 'Le Sirenuse — 9 nights, sea view',
        type: 'hotel',
        reference: 'LS-77210',
        date: start,
        amount: 7420,
        currency: 'EUR',
      },
      {
        id: 'bk_am_2',
        title: 'BA — Gatwick to Naples return',
        type: 'flight',
        reference: 'PN4K9D',
        date: start,
        amount: 812,
        currency: 'GBP',
      },
    ],
    expenses: [
      {
        id: 'exp_am_1',
        title: 'Airport transfer',
        category: 'travel',
        amount: 180,
        currency: 'EUR',
        date: start,
        paidByMemberId: CURRENT_MEMBER_ID,
      },
      {
        id: 'exp_am_2',
        title: 'Lunch at Chez Black',
        category: 'food',
        amount: 96.5,
        currency: 'EUR',
        date: offsetDate(-2),
        paidByMemberId: 'mem_sofia',
      },
      {
        id: 'exp_am_3',
        title: 'Boat charter deposit',
        category: 'activity',
        amount: 350,
        currency: 'EUR',
        date: offsetDate(-1),
        paidByMemberId: 'mem_dan',
      },
    ],
    documents: [
      {
        id: 'doc_am_1',
        name: 'Le Sirenuse reservation.pdf',
        type: 'reservation',
        addedAt: offsetTimestamp(-40),
        sizeKb: 220,
        confidential: false,
      },
      {
        id: 'doc_am_2',
        name: 'EHIC + insurance.pdf',
        type: 'insurance',
        addedAt: offsetTimestamp(-20),
        sizeKb: 180,
        confidential: true,
      },
    ],
    chat: [
      {
        id: 'msg_am_1',
        memberId: 'mem_sofia',
        body: 'Boat is confirmed for Wednesday, 9am from the jetty.',
        sentAt: offsetTimestamp(-1),
      },
    ],
    photos: [
      {
        id: 'pho_am_1',
        caption: 'First morning on the terrace',
        takenAt: offsetTimestamp(-2),
        gradient: PHOTO_GRADIENTS[0],
      },
      {
        id: 'pho_am_2',
        caption: 'Steps down to the beach',
        takenAt: offsetTimestamp(-1),
        gradient: PHOTO_GRADIENTS[5],
      },
    ],
  };
}

function buildLisbon(): Holiday {
  const start = offsetDate(-124);
  const end = offsetDate(-117);
  return {
    id: 'hol_lisbon',
    name: 'Lisbon Long Weekend',
    country: 'Portugal',
    cities: ['Lisbon', 'Sintra'],
    startDate: start,
    endDate: end,
    departure: {
      date: start,
      time: '07:10',
      location: 'London Stansted (STN)',
      reference: 'TP1363',
    },
    arrival: {
      date: end,
      time: '22:05',
      location: 'London Stansted (STN)',
      reference: 'TP1364',
    },
    primaryCurrency: 'EUR',
    secondaryCurrencies: ['GBP'],
    coverImage: 'citrus',
    description:
      'Seven days of tiles, trams and too many pastéis de nata. Day trip out to Sintra on the Thursday.',
    ownerId: CURRENT_MEMBER_ID,
    members: [
      you(),
      member('mem_tom', 'Tom Whitfield', 'tom.whitfield@example.com', 'traveller', 2, 200),
    ],
    status: 'active',
    archivedAt: null,
    restoreEnabled: true,
    createdAt: offsetTimestamp(-180),
    updatedAt: offsetTimestamp(-116),
    notifications: { ...DEFAULT_NOTIFICATIONS },
    itinerary: [
      {
        id: 'itin_li_1',
        title: 'Tram 28 end to end',
        date: offsetDate(-123),
        time: '09:00',
        city: 'Lisbon',
        notes: 'Start at Martim Moniz to get a seat.',
      },
      {
        id: 'itin_li_2',
        title: 'Sintra — Pena Palace and Quinta da Regaleira',
        date: offsetDate(-120),
        time: '08:15',
        city: 'Sintra',
        notes: 'Train from Rossio. Palace tickets timed for 10:00.',
      },
    ],
    bookings: [
      {
        id: 'bk_li_1',
        title: 'Memmo Alfama — 7 nights',
        type: 'hotel',
        reference: 'MA-3391',
        date: start,
        amount: 1180,
        currency: 'EUR',
      },
    ],
    expenses: [
      {
        id: 'exp_li_1',
        title: 'Time Out Market dinner',
        category: 'food',
        amount: 62,
        currency: 'EUR',
        date: offsetDate(-122),
        paidByMemberId: CURRENT_MEMBER_ID,
      },
      {
        id: 'exp_li_2',
        title: 'Sintra train + palace tickets',
        category: 'activity',
        amount: 47.5,
        currency: 'EUR',
        date: offsetDate(-120),
        paidByMemberId: 'mem_tom',
      },
    ],
    documents: [
      {
        id: 'doc_li_1',
        name: 'Memmo Alfama booking.pdf',
        type: 'reservation',
        addedAt: offsetTimestamp(-170),
        sizeKb: 150,
        confidential: false,
      },
    ],
    chat: [],
    photos: [
      {
        id: 'pho_li_1',
        caption: 'Miradouro da Senhora do Monte at golden hour',
        takenAt: offsetTimestamp(-122),
        gradient: PHOTO_GRADIENTS[1],
      },
    ],
  };
}

function buildIceland(): Holiday {
  const start = offsetDate(-410);
  const end = offsetDate(-402);
  return {
    id: 'hol_iceland',
    name: 'Iceland Ring Road',
    country: 'Iceland',
    cities: ['Reykjavík', 'Vík', 'Höfn', 'Akureyri'],
    startDate: start,
    endDate: end,
    departure: {
      date: start,
      time: '13:45',
      location: 'London Heathrow (LHR) · Terminal 2',
      reference: 'FI451',
    },
    arrival: {
      date: end,
      time: '17:30',
      location: 'London Heathrow (LHR) · Terminal 2',
      reference: 'FI450',
    },
    primaryCurrency: 'EUR',
    secondaryCurrencies: ['GBP', 'USD'],
    coverImage: 'aurora',
    description:
      'Eight days driving the ring road anticlockwise. Northern lights on night four near Höfn — worth the cold.',
    ownerId: CURRENT_MEMBER_ID,
    members: [
      you(),
      member('mem_priya', 'Priya Raman', 'priya.raman@example.com', 'organiser', 1, 500),
      member('mem_lena', 'Lena Fischer', 'lena.fischer@example.com', 'traveller', 3, 480),
    ],
    status: 'archived',
    archivedAt: offsetTimestamp(-400),
    restoreEnabled: true,
    createdAt: offsetTimestamp(-520),
    updatedAt: offsetTimestamp(-400),
    notifications: { ...DEFAULT_NOTIFICATIONS, digest: 'off' },
    itinerary: [
      {
        id: 'itin_is_1',
        title: 'Collect 4x4 and drive the Golden Circle',
        date: offsetDate(-409),
        time: '09:00',
        city: 'Reykjavík',
        notes: 'Þingvellir, Geysir, Gullfoss. Long day.',
      },
      {
        id: 'itin_is_2',
        title: 'Jökulsárlón glacier lagoon',
        date: offsetDate(-406),
        time: '10:30',
        city: 'Höfn',
        notes: 'Zodiac boat tour booked for midday.',
      },
    ],
    bookings: [
      {
        id: 'bk_is_1',
        title: 'Ring road 4x4 — 8 days',
        type: 'transport',
        reference: 'BL-99120',
        date: start,
        amount: 1240,
        currency: 'EUR',
      },
      {
        id: 'bk_is_2',
        title: 'Icelandair return',
        type: 'flight',
        reference: 'ZK2M1B',
        date: start,
        amount: 690,
        currency: 'GBP',
      },
    ],
    expenses: [
      {
        id: 'exp_is_1',
        title: 'Fuel — full loop',
        category: 'travel',
        amount: 428,
        currency: 'EUR',
        date: offsetDate(-404),
        paidByMemberId: CURRENT_MEMBER_ID,
      },
      {
        id: 'exp_is_2',
        title: 'Blue Lagoon entry x3',
        category: 'activity',
        amount: 267,
        currency: 'EUR',
        date: offsetDate(-403),
        paidByMemberId: 'mem_priya',
      },
      {
        id: 'exp_is_3',
        title: 'Groceries and road snacks',
        category: 'food',
        amount: 195,
        currency: 'EUR',
        date: offsetDate(-407),
        paidByMemberId: 'mem_lena',
      },
    ],
    documents: [
      {
        id: 'doc_is_1',
        name: 'Car hire agreement.pdf',
        type: 'reservation',
        addedAt: offsetTimestamp(-515),
        sizeKb: 410,
        confidential: false,
      },
      {
        id: 'doc_is_2',
        name: 'Winter driving insurance.pdf',
        type: 'insurance',
        addedAt: offsetTimestamp(-512),
        sizeKb: 260,
        confidential: true,
      },
    ],
    chat: [
      {
        id: 'msg_is_1',
        memberId: 'mem_lena',
        body: 'Aurora forecast is a 5 tonight — driving out past the lagoon after dinner.',
        sentAt: offsetTimestamp(-406),
      },
    ],
    photos: [
      {
        id: 'pho_is_1',
        caption: 'Aurora over Höfn',
        takenAt: offsetTimestamp(-406),
        gradient: PHOTO_GRADIENTS[3],
      },
      {
        id: 'pho_is_2',
        caption: 'Black sand at Reynisfjara',
        takenAt: offsetTimestamp(-408),
        gradient: PHOTO_GRADIENTS[4],
      },
      {
        id: 'pho_is_3',
        caption: 'Seljalandsfoss from behind',
        takenAt: offsetTimestamp(-409),
        gradient: PHOTO_GRADIENTS[2],
      },
    ],
  };
}

export function createSeedState(): VoyageState {
  return {
    version: STATE_VERSION,
    currentMemberId: CURRENT_MEMBER_ID,
    holidays: [buildJapan(), buildAmalfi(), buildLisbon(), buildIceland()],
  };
}
