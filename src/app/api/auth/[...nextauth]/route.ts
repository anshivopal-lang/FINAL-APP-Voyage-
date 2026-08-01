import { handlers } from '@/auth';

// bcrypt and the database driver need Node, not the edge runtime.
export const runtime = 'nodejs';

export const { GET, POST } = handlers;
