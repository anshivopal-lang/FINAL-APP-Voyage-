import { handlers } from '@/auth';

// The Google OAuth exchange and the database live in Node, not the edge.
export const runtime = 'nodejs';

export const { GET, POST } = handlers;
