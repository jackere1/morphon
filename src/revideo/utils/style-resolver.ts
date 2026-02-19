import type {ManifestMeta} from '../types.js';

/**
 * Merges meta.defaults for an object type with per-object style overrides.
 * Per-object style takes precedence.
 */
export function resolveStyle(
  objectType: string,
  objectStyle: Record<string, any> | undefined,
  meta: ManifestMeta,
): Record<string, any> {
  const defaults = meta.defaults?.[objectType] || {};
  return {...defaults, ...(objectStyle || {})};
}
