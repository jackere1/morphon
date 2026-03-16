import {Circle, Line, Txt, Node} from '@revideo/2d';
import {createRef, type Reference} from '@revideo/core';
import type {ManifestMeta} from '../types';
import {resolveStyle} from '../utils/style-resolver';

export interface TreeNode {
  id: string;
  label?: string;
  parent?: string;
  side?: 'left' | 'right';
}

export interface TreeObject {
  id: string;
  type: 'tree';
  variant?: 'binary' | 'nary' | 'heap';
  root: string;
  nodes: TreeNode[];
  position: {x: number; y: number};
  style?: Record<string, any>;
}

export interface TreeRefs {
  root: Reference<Node>;
  nodes: Map<string, Reference<Circle>>;
  nodeLabels: Map<string, Reference<Txt>>;
  edges: Map<string, Reference<Line>>;
  // Tree-specific: internal layout state for insert/delete operations
  treeLayout: TreeLayoutState;
}

export interface TreeLayoutState {
  positions: Map<string, {x: number; y: number}>;
  children: Map<string, {left?: string; right?: string}>;
  parentOf: Map<string, string>;
  rootId: string;
  style: Record<string, any>;
  canvasOffset: {cx: number; cy: number};
  positionOffset: {x: number; y: number};
}

/**
 * Compute binary tree layout using a simple recursive algorithm.
 * Returns absolute positions for each node relative to the tree's root position.
 *
 * The algorithm:
 * 1. Post-order traversal to compute subtree widths
 * 2. Pre-order traversal to assign x positions
 * Root is at (0, 0), children at computed offsets.
 */
function computeTreeLayout(
  nodes: TreeNode[],
  rootId: string,
  style: Record<string, any>,
): {positions: Map<string, {x: number; y: number}>; children: Map<string, {left?: string; right?: string}>; parentOf: Map<string, string>} {
  const levelSpacing = style.levelSpacing || 100;
  const siblingSpacing = style.siblingSpacing || 60;
  const nodeRadius = style.nodeRadius || 30;

  // Build child lookup
  const childrenMap = new Map<string, {left?: string; right?: string}>();
  const parentOf = new Map<string, string>();

  for (const n of nodes) {
    if (!childrenMap.has(n.id)) {
      childrenMap.set(n.id, {});
    }
  }

  for (const n of nodes) {
    if (n.parent && n.side) {
      const parentChildren = childrenMap.get(n.parent);
      if (parentChildren) {
        parentChildren[n.side] = n.id;
      }
      parentOf.set(n.id, n.parent);
    }
  }

  // Compute subtree widths (bottom-up)
  const subtreeWidth = new Map<string, number>();
  const minWidth = nodeRadius * 2 + siblingSpacing;

  function computeWidth(nodeId: string): number {
    const ch = childrenMap.get(nodeId);
    if (!ch || (!ch.left && !ch.right)) {
      subtreeWidth.set(nodeId, minWidth);
      return minWidth;
    }

    let leftW = 0;
    let rightW = 0;
    if (ch.left) leftW = computeWidth(ch.left);
    if (ch.right) rightW = computeWidth(ch.right);

    const totalWidth = Math.max(leftW + rightW, minWidth);
    subtreeWidth.set(nodeId, totalWidth);
    return totalWidth;
  }

  computeWidth(rootId);

  // Assign positions (top-down)
  const positions = new Map<string, {x: number; y: number}>();

  function assignPositions(nodeId: string, x: number, y: number): void {
    positions.set(nodeId, {x, y});

    const ch = childrenMap.get(nodeId);
    if (!ch) return;

    const leftW = ch.left ? (subtreeWidth.get(ch.left) || minWidth) : 0;
    const rightW = ch.right ? (subtreeWidth.get(ch.right) || minWidth) : 0;

    if (ch.left) {
      const leftX = x - rightW / 2 - leftW / 2;
      // Ensure minimum spacing
      const adjustedLeftX = Math.min(leftX, x - siblingSpacing);
      assignPositions(ch.left, adjustedLeftX, y + levelSpacing);
    }

    if (ch.right) {
      const rightX = x + leftW / 2 + rightW / 2;
      const adjustedRightX = Math.max(rightX, x + siblingSpacing);
      assignPositions(ch.right, adjustedRightX, y + levelSpacing);
    }
  }

  assignPositions(rootId, 0, 0);

  return {positions, children: childrenMap, parentOf};
}

export function buildTree(
  obj: TreeObject,
  meta: ManifestMeta,
): {node: JSX.Element; refs: TreeRefs} {
  const style = resolveStyle('tree', obj.style, meta);
  const root = createRef<Node>();
  const nodeRefs = new Map<string, Reference<Circle>>();
  const labelRefs = new Map<string, Reference<Txt>>();
  const edgeRefs = new Map<string, Reference<Line>>();

  const nodeRadius = style.nodeRadius || 30;
  const nodeColor = style.nodeColor || '#2d4a7a';
  const nodeStroke = style.nodeStroke || '#5b8fd9';
  const edgeColor = style.edgeColor || '#4a6a9a';
  const edgeWidth = style.edgeWidth || 3;
  const strokeWidth = style.strokeWidth || 3;
  const labelColor = style.labelColor || '#ffffff';
  const labelFontSize = parseFontSize(style.labelFont);

  // Canvas center offset
  const cx = meta.canvas.width / 2;
  const cy = meta.canvas.height / 2;

  // Tree position offset (root of tree at this position)
  const treeX = obj.position.x - cx;
  const treeY = obj.position.y - cy;

  // Compute auto-layout
  const layout = computeTreeLayout(obj.nodes, obj.root, style);
  const nodeMap = new Map(obj.nodes.map((n) => [n.id, n]));

  // Create refs
  for (const n of obj.nodes) {
    nodeRefs.set(n.id, createRef<Circle>());
    labelRefs.set(n.id, createRef<Txt>());
  }

  // Create edge refs (parent → child edges)
  for (const n of obj.nodes) {
    if (n.parent) {
      const key = `${n.parent}-${n.id}`;
      edgeRefs.set(key, createRef<Line>());
    }
  }

  const node = (
    <Node ref={root} x={treeX} y={treeY} opacity={0}>
      {/* Edges first (behind nodes) */}
      {obj.nodes
        .filter((n) => n.parent)
        .map((n) => {
          const key = `${n.parent}-${n.id}`;
          const parentPos = layout.positions.get(n.parent!);
          const childPos = layout.positions.get(n.id);
          if (!parentPos || !childPos) return null;
          return (
            <Line
              ref={edgeRefs.get(key)!}
              points={[
                [parentPos.x, parentPos.y],
                [childPos.x, childPos.y],
              ]}
              stroke={edgeColor}
              lineWidth={edgeWidth}
            />
          );
        })}

      {/* Nodes with labels */}
      {obj.nodes.map((n) => {
        const pos = layout.positions.get(n.id);
        if (!pos) return null;
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
      treeLayout: {
        positions: layout.positions,
        children: layout.children,
        parentOf: layout.parentOf,
        rootId: obj.root,
        style,
        canvasOffset: {cx, cy},
        positionOffset: {x: treeX, y: treeY},
      },
    },
  };
}

function parseFontSize(font?: string): number {
  if (!font) return 20;
  const match = font.match(/(\d+)px/);
  return match ? parseInt(match[1]) : 20;
}
