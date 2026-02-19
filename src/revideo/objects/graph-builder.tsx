import {Circle, Line, Txt, Node} from '@revideo/2d';
import {createRef, type Reference} from '@revideo/core';
import type {GraphObject, ManifestMeta} from '../types';
import {resolveStyle} from '../utils/style-resolver';

export interface GraphRefs {
  root: Reference<Node>;
  nodes: Map<string, Reference<Circle>>;
  nodeLabels: Map<string, Reference<Txt>>;
  edges: Map<string, Reference<Line>>;
}

export function buildGraph(
  obj: GraphObject,
  meta: ManifestMeta,
): {node: JSX.Element; refs: GraphRefs} {
  const style = resolveStyle('graph', obj.style, meta);
  const root = createRef<Node>();
  const nodeRefs = new Map<string, Reference<Circle>>();
  const labelRefs = new Map<string, Reference<Txt>>();
  const edgeRefs = new Map<string, Reference<Line>>();

  const nodeRadius = style.nodeRadius || 30;
  const nodeColor = style.nodeColor || '#4a4a6a';
  const nodeStroke = style.nodeStroke || '#7c7caa';
  const edgeColor = style.edgeColor || '#3a3a5a';
  const edgeWidth = style.edgeWidth || 3;
  const strokeWidth = style.strokeWidth || 3;
  const labelColor = style.labelColor || '#ffffff';
  const labelFontSize = parseFontSize(style.labelFont);

  // Canvas center offset (Revideo uses centered origin)
  const cx = meta.canvas.width / 2;
  const cy = meta.canvas.height / 2;

  // Build node position lookup
  const nodePositions = new Map(
    obj.nodes.map((n) => [n.id, {x: n.x - cx, y: n.y - cy}]),
  );

  // Create refs for each node
  for (const n of obj.nodes) {
    nodeRefs.set(n.id, createRef<Circle>());
    labelRefs.set(n.id, createRef<Txt>());
  }

  // Create refs for each edge
  for (const e of obj.edges) {
    const key = `${e.from}-${e.to}`;
    edgeRefs.set(key, createRef<Line>());
  }

  const node = (
    <Node ref={root} opacity={0}>
      {/* Edges first (rendered behind nodes) */}
      {obj.edges.map((e) => {
        const key = `${e.from}-${e.to}`;
        const from = nodePositions.get(e.from)!;
        const to = nodePositions.get(e.to)!;
        return (
          <Line
            ref={edgeRefs.get(key)!}
            points={[
              [from.x, from.y],
              [to.x, to.y],
            ]}
            stroke={edgeColor}
            lineWidth={edgeWidth}
          />
        );
      })}

      {/* Nodes with labels */}
      {obj.nodes.map((n) => {
        const pos = nodePositions.get(n.id)!;
        return (
          <Node x={pos.x} y={pos.y}>
            <Circle
              ref={nodeRefs.get(n.id)!}
              width={nodeRadius * 2}
              height={nodeRadius * 2}
              fill={nodeColor}
              stroke={nodeStroke}
              lineWidth={strokeWidth}
            />
            <Txt
              ref={labelRefs.get(n.id)!}
              text={n.label || n.id}
              fill={labelColor}
              fontSize={labelFontSize}
              fontWeight={700}
              fontFamily={'monospace'}
              textAlign={'center'}
            />
          </Node>
        );
      })}
    </Node>
  );

  return {
    node,
    refs: {
      root,
      nodes: nodeRefs,
      nodeLabels: labelRefs,
      edges: edgeRefs,
    },
  };
}

function parseFontSize(font?: string): number {
  if (!font) return 20;
  const match = font.match(/(\d+)px/);
  return match ? parseInt(match[1]) : 20;
}
