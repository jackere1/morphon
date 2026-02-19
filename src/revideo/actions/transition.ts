import {all, waitFor, type ThreadGenerator} from '@revideo/core';
import type {Node} from '@revideo/2d';
import type {TransitionConfig, ManifestMeta} from '../types';
import {parseDuration} from '../utils/duration';
import {resolveEasing} from '../utils/easing';

/**
 * Executes a transition between two scene containers.
 * @param outgoing - The current scene container (will be removed after)
 * @param incoming - The new scene container (already added to view)
 * @param config - Transition configuration
 * @param meta - Manifest meta for canvas dimensions
 */
export function* executeTransition(
  outgoing: Node,
  incoming: Node,
  config: TransitionConfig,
  meta: ManifestMeta,
): ThreadGenerator {
  const dur = parseDuration(config.duration);
  const easing = resolveEasing(config.easing, meta.easing);
  const canvasW = meta.canvas.width;

  switch (config.type) {
    case 'fade':
      // Fade out old, then fade in new
      yield* outgoing.opacity(0, dur / 2, easing);
      outgoing.remove();
      incoming.opacity(0);
      yield* incoming.opacity(1, dur / 2, easing);
      break;

    case 'crossfade':
      // Overlap: fade out old while fading in new simultaneously
      incoming.opacity(0);
      yield* all(
        outgoing.opacity(0, dur, easing),
        incoming.opacity(1, dur, easing),
      );
      outgoing.remove();
      break;

    case 'slide-left':
      // New scene slides in from right, old slides out to left
      incoming.position.x(canvasW);
      incoming.opacity(1);
      yield* all(
        outgoing.position.x(-canvasW, dur, easing),
        incoming.position.x(0, dur, easing),
      );
      outgoing.remove();
      break;

    case 'slide-right':
      // New scene slides in from left, old slides out to right
      incoming.position.x(-canvasW);
      incoming.opacity(1);
      yield* all(
        outgoing.position.x(canvasW, dur, easing),
        incoming.position.x(0, dur, easing),
      );
      outgoing.remove();
      break;

    default:
      // No transition — just swap
      outgoing.remove();
      incoming.opacity(1);
      break;
  }
}
