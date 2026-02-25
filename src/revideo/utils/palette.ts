import type {Manifest, ActionStep} from '../types.js';
import {isParallelBlock} from '../types.js';

/**
 * Resolves all $paletteRef strings in the manifest timeline to actual hex colors.
 * Mutates the manifest in place.
 */
export function resolvePalette(manifest: Manifest): void {
  const palette = manifest.meta.palette;
  if (!palette) return;

  for (const entry of manifest.timeline) {
    if (isParallelBlock(entry)) {
      for (const action of entry.parallel) {
        resolveActionPalette(action, palette);
      }
    } else {
      resolveActionPalette(entry as ActionStep, palette);
    }
  }
}

function resolveActionPalette(
  action: ActionStep,
  palette: Record<string, string>,
): void {
  if (action.color && action.color.startsWith('$')) {
    const key = action.color.slice(1);
    if (palette[key]) {
      action.color = palette[key];
    } else {
      // Fallback: unresolved palette ref → default highlight color
      console.warn(`[Palette] Unresolved ref "$${key}" — using fallback #e74c3c`);
      action.color = '#e74c3c';
    }
  }
}
