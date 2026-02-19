import {all, type ThreadGenerator} from '@revideo/core';
import type {Rect, Node} from '@revideo/2d';
import type {ActionStep, ManifestMeta} from '../types';
import type {SceneObjectEntry, DataStructureRefs} from '../objects';
import {createCell, getCellX} from '../objects/data-structure-builder';
import {resolveStyle} from '../utils/style-resolver';
import {parseDuration} from '../utils/duration';
import {resolveEasing} from '../utils/easing';

/**
 * Smoothly reposition all cells so the group is centered around x=0.
 */
function* repositionCells(
  container: Node,
  style: Record<string, any>,
  duration: number,
  easing: any,
): ThreadGenerator {
  const children = container.children() as Rect[];
  if (children.length === 0) return;

  const animations: ThreadGenerator[] = [];
  for (let i = 0; i < children.length; i++) {
    const targetX = getCellX(i, children.length, style);
    animations.push(children[i].x(targetX, duration, easing));
  }
  yield* all(...animations);
}

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
    // Add cell off-screen (scale 0) at a temporary position
    const count = refs.container().children().length;
    const tempX = getCellX(count, count + 1, style);
    const cell = createCell(val, style, tempX);
    refs.container().add(cell);

    const newChild = refs.container().children()[
      refs.container().children().length - 1
    ] as Rect;
    newChild.scale(0);

    // Animate: scale in the new cell + reposition all cells to stay centered
    yield* all(
      newChild.scale(1, perItem, easing),
      ...repositionAll(refs.container() as Node, style, perItem, easing),
    );
  }
}

/**
 * Helper: returns an array of x-position tweens for all children.
 */
function repositionAll(
  container: Node,
  style: Record<string, any>,
  duration: number,
  easing: any,
): ThreadGenerator[] {
  const children = container.children() as Rect[];
  const animations: ThreadGenerator[] = [];
  for (let i = 0; i < children.length; i++) {
    const targetX = getCellX(i, children.length, style);
    animations.push(children[i].x(targetX, duration, easing));
  }
  return animations;
}

export function* executeDequeue(
  step: ActionStep,
  entry: SceneObjectEntry,
  meta: ManifestMeta,
  defaultEasing?: string,
): ThreadGenerator {
  const refs = entry.refs as DataStructureRefs;
  const style = resolveStyle('data-structure', entry.obj.style, meta);
  const dur = parseDuration(step.duration);
  const easing = resolveEasing(step.easing, defaultEasing);

  const children = refs.container().children() as Rect[];
  if (children.length === 0) return;

  // Shrink the first cell
  const first = children[0] as Rect;
  yield* first.scale(0, dur * 0.5, easing);
  first.remove();

  // Reposition remaining cells to stay centered
  if (refs.container().children().length > 0) {
    yield* repositionCells(refs.container() as Node, style, dur * 0.5, easing);
  }
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
  meta: ManifestMeta,
  defaultEasing?: string,
): ThreadGenerator {
  const refs = entry.refs as DataStructureRefs;
  const style = resolveStyle('data-structure', entry.obj.style, meta);
  const dur = parseDuration(step.duration);
  const easing = resolveEasing(step.easing, defaultEasing);

  const children = refs.container().children() as Rect[];
  if (children.length === 0) return;

  // Pop removes from end (stack = LIFO)
  const last = children[children.length - 1] as Rect;
  yield* last.scale(0, dur * 0.5, easing);
  last.remove();

  // Reposition remaining cells to stay centered
  if (refs.container().children().length > 0) {
    yield* repositionCells(refs.container() as Node, style, dur * 0.5, easing);
  }
}
