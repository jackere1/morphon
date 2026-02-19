import {Txt} from '@revideo/2d';
import {createRef, type Reference} from '@revideo/core';
import type {TextObject, ManifestMeta} from '../types';
import {resolveStyle} from '../utils/style-resolver';

export interface TextRefs {
  root: Reference<Txt>;
}

export function buildText(
  obj: TextObject,
  meta: ManifestMeta,
): {node: JSX.Element; refs: TextRefs} {
  const style = resolveStyle('text', obj.style, meta);
  const root = createRef<Txt>();

  // Map manifest position to Revideo coordinates (centered origin)
  const x = obj.position.x - meta.canvas.width / 2;
  const y = obj.position.y - meta.canvas.height / 2;

  const node = (
    <Txt
      ref={root}
      text={obj.content}
      x={x}
      y={y}
      fill={style.color || '#ffffff'}
      fontSize={parseFontSize(style.font)}
      fontWeight={parseFontWeight(style.font)}
      fontFamily={parseFontFamily(style.font)}
      textAlign={style.align || 'left'}
      opacity={0}
    />
  );

  return {node, refs: {root}};
}

function parseFontSize(font?: string): number {
  if (!font) return 20;
  const match = font.match(/(\d+)px/);
  return match ? parseInt(match[1]) : 20;
}

function parseFontWeight(font?: string): number {
  if (!font) return 400;
  if (font.includes('bold')) return 700;
  return 400;
}

function parseFontFamily(font?: string): string {
  if (!font) return 'sans-serif';
  // Extract font family from CSS font shorthand like "bold 36px sans-serif"
  const match = font.match(/\d+px\s+(.+)$/);
  return match ? match[1] : 'sans-serif';
}
