import {type ThreadGenerator} from '@revideo/core';
import type {ActionStep, ManifestMeta} from '../types';
import type {SceneObjectEntry, GraphRefs} from '../objects';
import {parseDuration} from '../utils/duration';
import {resolveEasing} from '../utils/easing';

export function* executeMoveTo(
  step: ActionStep,
  entry: SceneObjectEntry,
  meta: ManifestMeta,
  defaultEasing?: string,
): ThreadGenerator {
  const dur = parseDuration(step.duration);
  const easing = resolveEasing(step.easing, defaultEasing);
  const root = (entry.refs as any).root();

  if (step.position) {
    const x = step.position.x - meta.canvas.width / 2;
    const y = step.position.y - meta.canvas.height / 2;
    yield* root.position([x, y], dur, easing);
  }
}

export function* executeMoveNode(
  step: ActionStep,
  entry: SceneObjectEntry,
  meta: ManifestMeta,
  defaultEasing?: string,
): ThreadGenerator {
  const refs = entry.refs as GraphRefs;
  if (!step.node || !step.position) return;

  const nodeRef = refs.nodes.get(step.node);
  if (!nodeRef) return;

  const dur = parseDuration(step.duration);
  const easing = resolveEasing(step.easing, defaultEasing);
  const x = step.position.x - meta.canvas.width / 2;
  const y = step.position.y - meta.canvas.height / 2;

  yield* nodeRef().position([x, y], dur, easing);
}
