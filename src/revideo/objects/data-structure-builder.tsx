import {Rect, Txt, Node} from '@revideo/2d';
import {createRef, type Reference} from '@revideo/core';
import type {DataStructureObject, ManifestMeta} from '../types';
import {resolveStyle} from '../utils/style-resolver';

export interface DataStructureRefs {
  root: Reference<Node>;
  container: Reference<Node>;
  label: Reference<Txt>;
}

export function buildDataStructure(
  obj: DataStructureObject,
  meta: ManifestMeta,
): {node: JSX.Element; refs: DataStructureRefs} {
  const style = resolveStyle('data-structure', obj.style, meta);
  const root = createRef<Node>();
  const container = createRef<Node>();
  const label = createRef<Txt>();

  // Canvas center offset
  const x = obj.position.x - meta.canvas.width / 2;
  const y = obj.position.y - meta.canvas.height / 2;

  const variantLabel =
    obj.variant.charAt(0).toUpperCase() + obj.variant.slice(1);

  const node = (
    <Node ref={root} x={x} y={y} opacity={0}>
      <Txt
        ref={label}
        text={variantLabel}
        fill={'#aaaacc'}
        fontSize={14}
        fontFamily={'monospace'}
        y={-40}
        textAlign={'center'}
      />
      <Node ref={container} />
    </Node>
  );

  return {node, refs: {root, container, label}};
}

/**
 * Calculate the x position for a cell at a given index in the container.
 * Cells are centered around x=0 as a group.
 */
export function getCellX(
  index: number,
  totalCount: number,
  style: Record<string, any>,
): number {
  const cellW = style.cellWidth || 60;
  const gap = style.gap ?? 4;
  const totalWidth = totalCount * cellW + (totalCount - 1) * gap;
  // leftmost edge of the first cell (centered)
  const startX = -totalWidth / 2 + cellW / 2;
  return startX + index * (cellW + gap);
}

/**
 * Creates a queue/stack cell (Rect with Txt label).
 */
export function createCell(
  value: string,
  style: Record<string, any>,
  x: number = 0,
): JSX.Element {
  const cellW = style.cellWidth || 60;
  const cellH = style.cellHeight || 40;
  const fill = style.fillColor || '#2a2a4a';
  const border = style.borderColor || '#5a5a8a';
  const textColor = style.textColor || '#ffffff';

  return (
    <Rect
      x={x}
      width={cellW}
      height={cellH}
      fill={fill}
      stroke={border}
      lineWidth={2}
      radius={6}
    >
      <Txt
        text={value}
        fill={textColor}
        fontSize={16}
        fontWeight={700}
        fontFamily={'monospace'}
      />
    </Rect>
  );
}
