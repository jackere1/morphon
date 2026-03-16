import {all, chain, type ThreadGenerator} from '@revideo/core';
import {Txt} from '@revideo/2d';
import type {Rect, Node} from '@revideo/2d';
import type {ActionStep, ManifestMeta} from '../types';
import type {SceneObjectEntry, DataStructureRefs} from '../objects';
import {createCell, getCellX} from '../objects/data-structure-builder';
import {resolveStyle} from '../utils/style-resolver';
import {parseDuration} from '../utils/duration';
import {resolveEasing} from '../utils/easing';

/**
 * Sync index labels below the array cells.
 * Only for variant === 'array'.
 */
function syncIndexLabels(refs: DataStructureRefs, style: Record<string, any>): void {
  if (refs.variant !== 'array') return;

  const indexContainer = refs.indexLabels();
  const cellCount = refs.container().children().length;

  // Clear existing index labels
  for (const child of [...indexContainer.children()]) {
    child.remove();
  }

  // Create new index labels
  for (let i = 0; i < cellCount; i++) {
    const x = getCellX(i, cellCount, style);
    indexContainer.add(
      <Txt
        text={`[${i}]`}
        x={x}
        fill={'#888899'}
        fontSize={11}
        fontFamily={'monospace'}
        textAlign={'center'}
      />,
    );
  }
}

/**
 * Initialize a data structure with pre-populated values.
 * All cells appear with a staggered scale-in animation.
 */
export function* executeInitCells(
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

  if (values.length === 0) return;

  // Create all cells at once at their final positions
  for (let i = 0; i < values.length; i++) {
    const x = getCellX(i, values.length, style);
    const cell = createCell(values[i], style, x);
    refs.container().add(cell);

    // Start invisible (scale 0)
    const child = refs.container().children()[
      refs.container().children().length - 1
    ] as Rect;
    child.scale(0);
  }

  // Sync index labels for array variant
  syncIndexLabels(refs, style);

  // Staggered scale-in animation
  const children = refs.container().children() as Rect[];
  const perItem = dur / values.length;

  for (let i = 0; i < children.length; i++) {
    yield* children[i].scale(1, perItem, easing);
  }
}

/**
 * Set the value of a specific cell by index.
 * If the index doesn't exist yet, this is a no-op.
 */
export function* executeSetCell(
  step: ActionStep,
  entry: SceneObjectEntry,
  meta: ManifestMeta,
  defaultEasing?: string,
): ThreadGenerator {
  const refs = entry.refs as DataStructureRefs;
  const style = resolveStyle('data-structure', entry.obj.style, meta);
  const dur = parseDuration(step.duration);
  const easing = resolveEasing(step.easing, defaultEasing);
  const index = step.index;
  const value = step.value || '';

  if (index === undefined || index === null) {
    console.warn('set-cell requires index');
    return;
  }

  const children = refs.container().children() as Rect[];
  if (index < 0 || index >= children.length) {
    console.warn(`set-cell: index ${index} out of bounds (${children.length} cells)`);
    return;
  }

  const cell = children[index] as Rect;
  // Find the Txt child inside the Rect
  const txtNode = cell.children()[0];
  if (txtNode && typeof (txtNode as any).text === 'function') {
    if (dur > 0) {
      // Brief scale pulse to draw attention
      yield* all(
        cell.scale(1.2, dur * 0.3, easing),
      );
      (txtNode as any).text(value);
      yield* cell.scale(1, dur * 0.3, easing);
    } else {
      (txtNode as any).text(value);
      yield;
    }
  }
}

/**
 * Highlight a specific cell by index (change its fill color).
 */
export function* executeHighlightCell(
  step: ActionStep,
  entry: SceneObjectEntry,
  meta: ManifestMeta,
  defaultEasing?: string,
): ThreadGenerator {
  const refs = entry.refs as DataStructureRefs;
  const dur = parseDuration(step.duration);
  const easing = resolveEasing(step.easing, defaultEasing);
  const index = step.index;
  const color = step.color || '#ff6b6b';

  if (index === undefined || index === null) {
    console.warn('highlight-cell requires index');
    return;
  }

  const children = refs.container().children() as Rect[];
  if (index < 0 || index >= children.length) {
    console.warn(`highlight-cell: index ${index} out of bounds (${children.length} cells)`);
    return;
  }

  const cell = children[index] as Rect;
  yield* all(
    cell.fill(color, dur, easing),
    cell.stroke('#ffffff', dur, easing),
    cell.lineWidth(3, dur, easing),
  );
}

/**
 * Swap two cells by index with an arc animation.
 * Cells physically cross over each other.
 */
export function* executeSwapCells(
  step: ActionStep,
  entry: SceneObjectEntry,
  meta: ManifestMeta,
  defaultEasing?: string,
): ThreadGenerator {
  const refs = entry.refs as DataStructureRefs;
  const style = resolveStyle('data-structure', entry.obj.style, meta);
  const dur = parseDuration(step.duration);
  const easing = resolveEasing(step.easing, defaultEasing);
  const indices = step.indices;

  if (!indices || indices.length < 2) {
    console.warn('swap-cells requires indices array with 2 elements');
    return;
  }

  const [i, j] = indices;
  const children = refs.container().children() as Rect[];

  if (i < 0 || i >= children.length || j < 0 || j >= children.length) {
    console.warn(`swap-cells: indices [${i}, ${j}] out of bounds (${children.length} cells)`);
    return;
  }

  const cellA = children[i] as Rect;
  const cellB = children[j] as Rect;

  const posA = cellA.x();
  const posB = cellB.x();
  const cellH = style.cellHeight || 40;
  const liftY = -(cellH + 20); // Lift above the row

  // Animate: cellA lifts up, moves to B's position, drops down
  //          cellB drops down, moves to A's position, lifts back up
  const thirdDur = dur / 3;

  yield* all(
    // Cell A: up → across → down
    chain(
      cellA.y(liftY, thirdDur, easing),
      cellA.x(posB, thirdDur, easing),
      cellA.y(0, thirdDur, easing),
    ),
    // Cell B: down → across → up
    chain(
      cellB.y(-liftY, thirdDur, easing),
      cellB.x(posA, thirdDur, easing),
      cellB.y(0, thirdDur, easing),
    ),
  );

  // Swap the DOM order so future index references stay correct
  // We need to actually move the nodes in the container's children list
  // Revideo doesn't have a direct swap, so we remove and re-insert
  const containerNode = refs.container() as Node;
  const allChildren = [...containerNode.children()];

  // Get positions of both cells in the children array
  const minIdx = Math.min(i, j);
  const maxIdx = Math.max(i, j);

  // Remove both (remove from end first to preserve indices)
  const maxChild = allChildren[maxIdx];
  const minChild = allChildren[minIdx];

  maxChild.remove();
  minChild.remove();

  // Re-insert in swapped order
  const remaining = [...containerNode.children()];

  // Build new order
  const newOrder: any[] = [];
  let ri = 0;
  for (let k = 0; k < allChildren.length; k++) {
    if (k === minIdx) {
      newOrder.push(maxChild); // put the max cell at min position
    } else if (k === maxIdx) {
      newOrder.push(minChild); // put the min cell at max position
    } else {
      newOrder.push(remaining[ri++]);
    }
  }

  // Clear and re-add in correct order
  for (const child of [...containerNode.children()]) {
    child.remove();
  }
  for (const child of newOrder) {
    containerNode.add(child);
  }

  // Recalculate x positions for all cells
  const total = containerNode.children().length;
  const repositioned = containerNode.children() as Rect[];
  for (let k = 0; k < total; k++) {
    const targetX = getCellX(k, total, style);
    repositioned[k].x(targetX);
  }

  // Sync index labels
  syncIndexLabels(refs, style);
}
