import {waitFor} from '@revideo/core';
import type {ActionStep} from '../types';
import {parseDuration} from '../utils/duration';

export function* executePause(step: ActionStep) {
  const dur = parseDuration(step.duration);
  if (dur > 0) {
    yield* waitFor(dur);
  }
}
