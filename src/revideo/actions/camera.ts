import {all, type ThreadGenerator} from '@revideo/core';
import type {View2D} from '@revideo/2d';
import type {ActionStep, ManifestMeta} from '../types';
import {parseDuration} from '../utils/duration';
import {resolveEasing} from '../utils/easing';

export function* executeCameraZoom(
  step: ActionStep,
  view: View2D,
  meta: ManifestMeta,
  defaultEasing?: string,
): ThreadGenerator {
  const dur = parseDuration(step.duration);
  const easing = resolveEasing(step.easing, defaultEasing);
  const scale = step.scale || 1;

  yield* view.scale(scale, dur, easing);
}

export function* executeCameraPan(
  step: ActionStep,
  view: View2D,
  meta: ManifestMeta,
  defaultEasing?: string,
): ThreadGenerator {
  const dur = parseDuration(step.duration);
  const easing = resolveEasing(step.easing, defaultEasing);

  if (step.position) {
    // Invert because moving camera right means scene moves left
    const x = -(step.position.x - meta.canvas.width / 2);
    const y = -(step.position.y - meta.canvas.height / 2);
    yield* view.position([x, y], dur, easing);
  }
}

export function* executeCameraReset(
  step: ActionStep,
  view: View2D,
  defaultEasing?: string,
): ThreadGenerator {
  const dur = parseDuration(step.duration);
  const easing = resolveEasing(step.easing, defaultEasing);

  yield* all(
    view.scale(1, dur, easing),
    view.position([0, 0], dur, easing),
  );
}
