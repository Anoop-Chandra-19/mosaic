import { getDb } from '@/lib/storage/mosaicDb';
import type { Version } from '@shared/types/db';

/** A version never changes once written, so what was read by id stays true. */
const MAX_CACHED = 40;
const cached = new Map<string, Version>();

/** The version, if it was read already; for drawing it without waiting. */
export function peekVersion(id: string): Version | undefined {
  return cached.get(id);
}

/** Reads a version once, keeping the most recent few. */
export async function loadVersion(id: string): Promise<Version> {
  const hit = cached.get(id);
  if (hit) return hit;
  const version = await getDb().versions.get(id);
  cached.set(id, version);
  if (cached.size > MAX_CACHED) cached.delete(cached.keys().next().value!);
  return version;
}
