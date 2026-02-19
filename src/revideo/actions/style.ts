import {all, type ThreadGenerator} from '@revideo/core';
import type {ActionStep} from '../types';
import type {SceneObjectEntry, GraphRefs, TextRefs} from '../objects';
import {parseDuration} from '../utils/duration';
import {resolveEasing} from '../utils/easing';

export function* executeSetStyle(
  step: ActionStep,
  entry: SceneObjectEntry,
  defaultEasing?: string,
): ThreadGenerator {
  const dur = parseDuration(step.duration);
  const easing = resolveEasing(step.easing, defaultEasing);
  const styleChanges = step.style || {};

  // If targeting a specific node within a graph
  if (step.node && 'nodes' in (entry.refs as any)) {
    const refs = entry.refs as GraphRefs;
    const nodeRef = refs.nodes.get(step.node);
    if (!nodeRef) return;

    const anims: ThreadGenerator[] = [];
    if (styleChanges.nodeColor || styleChanges.fill) {
      anims.push(nodeRef().fill(styleChanges.nodeColor || styleChanges.fill, dur, easing));
    }
    if (styleChanges.nodeStroke || styleChanges.stroke) {
      anims.push(nodeRef().stroke(styleChanges.nodeStroke || styleChanges.stroke, dur, easing));
    }
    if (styleChanges.lineWidth) {
      anims.push(nodeRef().lineWidth(styleChanges.lineWidth, dur, easing));
    }
    if (anims.length > 0) yield* all(...anims);
    return;
  }

  // For text objects
  if ('root' in entry.refs && entry.obj.type === 'text') {
    const refs = entry.refs as TextRefs;
    const anims: ThreadGenerator[] = [];
    if (styleChanges.color || styleChanges.fill) {
      anims.push(refs.root().fill(styleChanges.color || styleChanges.fill, dur, easing));
    }
    if (styleChanges.fontSize) {
      anims.push(refs.root().fontSize(styleChanges.fontSize, dur, easing));
    }
    if (anims.length > 0) yield* all(...anims);
    return;
  }
}
