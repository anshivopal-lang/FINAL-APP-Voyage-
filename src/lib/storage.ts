import { createSeedState, STATE_VERSION } from './seed';
import type { VoyageState } from './types';

export const STORAGE_KEY = 'voyage.state.v1';

/**
 * Reads persisted state. Falls back to the seed on first run, on a version
 * mismatch, or if the stored payload is unreadable — never throws, because a
 * corrupt entry should not brick the app.
 */
export function loadState(): VoyageState {
  if (typeof window === 'undefined') {
    return createSeedState();
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createSeedState();

    const parsed = JSON.parse(raw) as Partial<VoyageState>;
    if (
      parsed.version !== STATE_VERSION ||
      !Array.isArray(parsed.holidays) ||
      typeof parsed.currentMemberId !== 'string'
    ) {
      return createSeedState();
    }

    return parsed as VoyageState;
  } catch {
    return createSeedState();
  }
}

export function saveState(state: VoyageState): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Quota exceeded or storage disabled — the session still works in memory.
  }
}

export function clearState(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
