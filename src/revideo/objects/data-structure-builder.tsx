import {Rect, Txt, Layout, Node} from '@revideo/2d';
import {createRef, type Reference} from '@revideo/core';
import type {DataStructureObject, ManifestMeta} from '../types';
import {resolveStyle} from '../utils/style-resolver';

export interface DataStructureRefs {
  root: Reference<Node>;
  container: Reference<Layout>;
  label: Reference<Txt>;
}

export function buildDataStructure(
  obj: DataStructureObject,
  meta: ManifestMeta,
): {node: JSX.Element; refs: DataStructureRefs} {
  const style = resolveStyle('data-structure', obj.style, meta);
  const root = createRef<Node>();
  const container = createRef<Layout>();
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
      <Layout
        ref={container}
        direction={'row'}
        gap={2}
      />
    </Node>
  );

  return {node, refs: {root, container, label}};
}

/**
 * Creates a queue/stack cell (Rect with Txt label) that can be added to the container.
 */
export function createCell(
  value: string,
  style: Record<string, any>,
): JSX.Element {
  const cellW = style.cellWidth || 60;
  const cellH = style.cellHeight || 40;
  const fill = style.fillColor || '#2a2a4a';
  const border = style.borderColor || '#5a5a8a';
  const textColor = style.textColor || '#ffffff';

  return (
    <Rect
      width={cellW}
      height={cellH}
      fill={fill}
      stroke={border}
      lineWidth={2}
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
