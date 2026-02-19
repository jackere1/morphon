import {sequence, type ThreadGenerator} from '@revideo/core';
import type {Rect} from '@revideo/2d';
import type {ActionStep, ManifestMeta} from '../types';
import type {SceneObjectEntry, DataStructureRefs} from '../objects';
import {createCell} from '../objects/data-structure-builder';
import {resolveStyle} from '../utils/style-resolver';
import {parseDuration} from '../utils/duration';
import {resolveEasing} from '../utils/easing';

export function* executeEnqueue(
  step: ActionStep,
  entry: SceneObjectEntry,
  meta: ManifestMeta,
  defaultEasing?: string,
): ThreadGenerator {
  const refs = entry.refs as DataStructureRefs;
  const style = resolveStyle('data-structure', entry.obj.style, meta);
  const dur = parseDuration(step.duration);
  const easing = resolveEasing(step.easing, defaultEasing);
  const values = step.values || [];

  const perItem = values.length > 0 ? dur / values.length : dur;

  for (const val of values) {
    const cell = createCell(val, style);
    refs.container().add(cell);
    // Animate scale from 0 to 1
    const lastChild = refs.container().children()[
      refs.container().children().length - 1
    ] as Rect;
    lastChild.scale(0);
    yield* lastChild.scale(1, perItem, easing);
  }
}

export function* executeDequeue(
  step: ActionStep,
  entry: SceneObjectEntry,
  defaultEasing?: string,
): ThreadGenerator {
  const refs = entry.refs as DataStructureRefs;
  const dur = parseDuration(step.duration);
  const easing = resolveEasing(step.easing, defaultEasing);

  const children = refs.container().children();
  if (children.length === 0) return;

  const first = children[0] as Rect;
  yield* first.scale(0, dur, easing);
  first.remove();
}

export function* executePush(
  step: ActionStep,
  entry: SceneObjectEntry,
  meta: ManifestMeta,
  defaultEasing?: string,
): ThreadGenerator {
  // Push is the same as enqueue for visual purposes (add to end)
  yield* executeEnqueue(step, entry, meta, defaultEasing);
}

export function* executePop(
  step: ActionStep,
  entry: SceneObjectEntry,
  defaultEasing?: string,
): ThreadGenerator {
  const refs = entry.refs as DataStructureRefs;
  const dur = parseDuration(step.duration);
  const easing = resolveEasing(step.easing, defaultEasing);

  const children = refs.container().children();
  if (children.length === 0) return;

  // Pop removes from end (stack behavior)
  const last = children[children.length - 1] as Rect;
  yield* last.scale(0, dur, easing);
  last.remove();
}
