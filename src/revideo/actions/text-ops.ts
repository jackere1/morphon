import type {ThreadGenerator} from '@revideo/core';
import type {ActionStep} from '../types';
import type {SceneObjectEntry, TextRefs} from '../objects';
import {parseDuration} from '../utils/duration';

export function* executeSetText(
  step: ActionStep,
  entry: SceneObjectEntry,
): ThreadGenerator {
  const refs = entry.refs as TextRefs;
  const dur = parseDuration(step.duration);

  if (dur > 0) {
    yield* refs.root().text(step.value || '', dur);
  } else {
    refs.root().text(step.value || '');
    // Emit at least one frame
    yield;
  }
}
