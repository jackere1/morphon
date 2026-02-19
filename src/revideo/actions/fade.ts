import type {ThreadGenerator} from '@revideo/core';
import type {ActionStep} from '../types';
import type {SceneObjectEntry} from '../objects';
import {parseDuration} from '../utils/duration';
import {resolveEasing} from '../utils/easing';

export function* executeFadeIn(
  step: ActionStep,
  entry: SceneObjectEntry,
  defaultEasing?: string,
): ThreadGenerator {
  const dur = parseDuration(step.duration);
  const easing = resolveEasing(step.easing, defaultEasing);
  const root = (entry.refs as any).root();
  yield* root.opacity(1, dur, easing);
}

export function* executeFadeOut(
  step: ActionStep,
  entry: SceneObjectEntry,
  defaultEasing?: string,
): ThreadGenerator {
  const dur = parseDuration(step.duration);
  const easing = resolveEasing(step.easing, defaultEasing);
  const root = (entry.refs as any).root();
  yield* root.opacity(0, dur, easing);
}
