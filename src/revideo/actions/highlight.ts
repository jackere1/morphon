import {all, type ThreadGenerator} from '@revideo/core';
import type {ActionStep} from '../types';
import type {SceneObjectEntry, GraphRefs} from '../objects';
import {parseDuration} from '../utils/duration';
import {resolveEasing} from '../utils/easing';

export function* executeHighlightNode(
  step: ActionStep,
  entry: SceneObjectEntry,
  defaultEasing?: string,
): ThreadGenerator {
  const refs = entry.refs as GraphRefs;
  const nodeRef = refs.nodes.get(step.node!);
  if (!nodeRef) return;

  const dur = parseDuration(step.duration);
  const easing = resolveEasing(step.easing, defaultEasing);
  const color = step.color || '#ff6b6b';

  yield* all(
    nodeRef().fill(color, dur, easing),
    nodeRef().stroke(color, dur, easing),
  );
}

export function* executeHighlightEdge(
  step: ActionStep,
  entry: SceneObjectEntry,
  defaultEasing?: string,
): ThreadGenerator {
  const refs = entry.refs as GraphRefs;
  if (!step.edge || step.edge.length < 2) return;

  const key = `${step.edge[0]}-${step.edge[1]}`;
  const edgeRef = refs.edges.get(key);
  if (!edgeRef) return;

  const dur = parseDuration(step.duration);
  const easing = resolveEasing(step.easing, defaultEasing);
  const color = step.color || '#ff6b6b';

  yield* all(
    edgeRef().stroke(color, dur, easing),
    edgeRef().lineWidth(3, dur, easing),
  );
}
