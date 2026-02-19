import {type ThreadGenerator} from '@revideo/core';
import type {Node} from '@revideo/2d';
import type {ActionStep, ManifestMeta} from '../types';
import type {SceneObjectEntry} from '../objects';
import {executeFadeIn, executeFadeOut} from './fade';
import {executeHighlightNode, executeHighlightEdge} from './highlight';
import {executeSetText} from './text-ops';
import {executeEnqueue, executeDequeue, executePush, executePop} from './data-ops';
import {executeMoveTo, executeMoveNode} from './movement';
import {executeCameraZoom, executeCameraPan, executeCameraReset} from './camera';
import {executePause} from './timing';
import {executeSetStyle} from './style';

/**
 * Dispatches a single action step to the appropriate executor.
 * The `camera` param is a Node wrapper used for camera operations (zoom/pan/reset).
 */
export function* executeAction(
  step: ActionStep,
  objects: Map<string, SceneObjectEntry>,
  camera: Node,
  meta: ManifestMeta,
): ThreadGenerator {
  const defaultEasing = meta.easing;
  const entry = step.target ? objects.get(step.target) : undefined;

  switch (step.action) {
    case 'fade-in':
      if (entry) yield* executeFadeIn(step, entry, defaultEasing);
      break;
    case 'fade-out':
      if (entry) yield* executeFadeOut(step, entry, defaultEasing);
      break;
    case 'highlight-node':
      if (entry) yield* executeHighlightNode(step, entry, defaultEasing);
      break;
    case 'highlight-edge':
      if (entry) yield* executeHighlightEdge(step, entry, defaultEasing);
      break;
    case 'set-text':
      if (entry) yield* executeSetText(step, entry);
      break;
    case 'enqueue':
      if (entry) yield* executeEnqueue(step, entry, meta, defaultEasing);
      break;
    case 'dequeue':
      if (entry) yield* executeDequeue(step, entry, meta, defaultEasing);
      break;
    case 'push':
      if (entry) yield* executePush(step, entry, meta, defaultEasing);
      break;
    case 'pop':
      if (entry) yield* executePop(step, entry, meta, defaultEasing);
      break;
    case 'move-to':
      if (entry) yield* executeMoveTo(step, entry, meta, defaultEasing);
      break;
    case 'move-node':
      if (entry) yield* executeMoveNode(step, entry, meta, defaultEasing);
      break;
    case 'camera-zoom':
      yield* executeCameraZoom(step, camera, meta, defaultEasing);
      break;
    case 'camera-pan':
      yield* executeCameraPan(step, camera, meta, defaultEasing);
      break;
    case 'camera-reset':
      yield* executeCameraReset(step, camera, defaultEasing);
      break;
    case 'set-style':
      if (entry) yield* executeSetStyle(step, entry, defaultEasing);
      break;
    case 'pause':
      yield* executePause(step);
      break;
    default:
      console.warn(`Unknown action: ${step.action}`);
      break;
  }
}
