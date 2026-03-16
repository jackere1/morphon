import {all, type ThreadGenerator} from '@revideo/core';
import {Circle, Line, Txt, Node} from '@revideo/2d';
import {createRef} from '@revideo/core';
import type {ActionStep, ManifestMeta} from '../types';
import type {SceneObjectEntry} from '../objects';
import type {TreeRefs, TreeLayoutState} from '../objects/tree-builder';
import {parseDuration} from '../utils/duration';
import {resolveEasing} from '../utils/easing';

/**
 * Recompute positions for all nodes after a tree structure change.
 * Uses the same algorithm as initial layout but updates in-place.
 */
function recomputeLayout(layout: TreeLayoutState): void {
  const {children, rootId, style} = layout;
  const levelSpacing = style.levelSpacing || 100;
  const siblingSpacing = style.siblingSpacing || 60;
  const nodeRadius = style.nodeRadius || 30;
  const minWidth = nodeRadius * 2 + siblingSpacing;

  const subtreeWidth = new Map<string, number>();

  function computeWidth(nodeId: string): number {
    const ch = children.get(nodeId);
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

  function assignPositions(nodeId: string, x: number, y: number): void {
    layout.positions.set(nodeId, {x, y});

    const ch = children.get(nodeId);
    if (!ch) return;

    const leftW = ch.left ? (subtreeWidth.get(ch.left) || minWidth) : 0;
    const rightW = ch.right ? (subtreeWidth.get(ch.right) || minWidth) : 0;

    if (ch.left) {
      const leftX = x - rightW / 2 - leftW / 2;
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
}

/**
 * Animate inserting a new node into the tree.
 * The node slides down from the parent position and an edge grows.
 */
export function* executeInsertNode(
  step: ActionStep,
  entry: SceneObjectEntry,
  meta: ManifestMeta,
  defaultEasing?: string,
): ThreadGenerator {
  const refs = entry.refs as TreeRefs;
  const layout = refs.treeLayout;
  const dur = parseDuration(step.duration);
  const easing = resolveEasing(step.easing, defaultEasing);

  const nodeId = step.node;
  const parentId = step.parent;
  const side = step.side as 'left' | 'right';
  const label = step.label || nodeId || '';

  if (!nodeId || !parentId || !side) {
    console.warn('insert-node requires node, parent, and side');
    return;
  }

  // Update layout state
  if (!layout.children.has(nodeId)) {
    layout.children.set(nodeId, {});
  }
  const parentChildren = layout.children.get(parentId);
  if (parentChildren) {
    parentChildren[side] = nodeId;
  }
  layout.parentOf.set(nodeId, parentId);

  // Recompute all positions
  recomputeLayout(layout);

  const newPos = layout.positions.get(nodeId);
  const parentPos = layout.positions.get(parentId);
  if (!newPos || !parentPos) return;

  // Create visual elements
  const nodeRadius = layout.style.nodeRadius || 30;
  const nodeColor = layout.style.nodeColor || '#2d4a7a';
  const nodeStroke = layout.style.nodeStroke || '#5b8fd9';
  const strokeWidth = layout.style.strokeWidth || 3;
  const edgeColor = layout.style.edgeColor || '#4a6a9a';
  const edgeWidth = layout.style.edgeWidth || 3;
  const labelColor = layout.style.labelColor || '#ffffff';
  const labelFontSize = layout.style.labelFont ? parseFontSize(layout.style.labelFont) : 20;

  const nodeRef = createRef<Circle>();
  const labelRef = createRef<Txt>();
  const edgeRef = createRef<Line>();
  const nodeWrapper = createRef<Node>();

  // Store refs
  refs.nodes.set(nodeId, nodeRef);
  refs.nodeLabels.set(nodeId, labelRef);
  const edgeKey = `${parentId}-${nodeId}`;
  refs.edges.set(edgeKey, edgeRef);

  // Create edge (starts as zero length from parent)
  const edgeElement = (
    <Line
      ref={edgeRef}
      points={[
        [parentPos.x, parentPos.y],
        [parentPos.x, parentPos.y],
      ]}
      stroke={edgeColor}
      lineWidth={edgeWidth}
    />
  );

  // Create node (starts at parent position, invisible)
  const nodeElement = (
    <Node ref={nodeWrapper} x={parentPos.x} y={parentPos.y} opacity={0}>
      <Circle
        ref={nodeRef}
        width={nodeRadius * 2}
        height={nodeRadius * 2}
        fill={nodeColor}
        stroke={nodeStroke}
        lineWidth={strokeWidth}
      />
      <Txt
        ref={labelRef}
        text={label}
        fill={labelColor}
        fontSize={labelFontSize}
        fontWeight={700}
        fontFamily={'monospace'}
        textAlign={'center'}
      />
    </Node>
  );

  // Add to scene (edge behind nodes)
  const rootNode = refs.root();
  // Insert edge at the beginning so it's behind nodes
  rootNode.insert(edgeElement, 0);
  rootNode.add(nodeElement);

  // Animate: node appears and slides to position, edge grows
  yield* all(
    nodeWrapper().opacity(1, dur * 0.3, easing),
    nodeWrapper().x(newPos.x, dur, easing),
    nodeWrapper().y(newPos.y, dur, easing),
    edgeRef().points(
      [
        [parentPos.x, parentPos.y],
        [newPos.x, newPos.y],
      ],
      dur,
      easing,
    ),
  );

  // Animate existing nodes to their new positions (tree may have rebalanced)
  const moveAnimations: ThreadGenerator[] = [];
  for (const [id, pos] of layout.positions) {
    if (id === nodeId) continue;
    const existingNodeRef = refs.nodes.get(id);
    if (!existingNodeRef) continue;
    const wrapper = existingNodeRef().parent() as Node;
    if (wrapper && typeof wrapper.x === 'function') {
      moveAnimations.push(wrapper.x(pos.x, dur * 0.5, easing));
      moveAnimations.push(wrapper.y(pos.y, dur * 0.5, easing));
    }

    // Update edges connected to this node
    const parentOfId = layout.parentOf.get(id);
    if (parentOfId) {
      const ek = `${parentOfId}-${id}`;
      const er = refs.edges.get(ek);
      const pp = layout.positions.get(parentOfId);
      if (er && pp) {
        moveAnimations.push(
          er().points([[pp.x, pp.y], [pos.x, pos.y]], dur * 0.5, easing),
        );
      }
    }
  }

  if (moveAnimations.length > 0) {
    yield* all(...moveAnimations);
  }
}

/**
 * Animate deleting a node from the tree.
 * The node and its edge fade out.
 */
export function* executeDeleteNode(
  step: ActionStep,
  entry: SceneObjectEntry,
  meta: ManifestMeta,
  defaultEasing?: string,
): ThreadGenerator {
  const refs = entry.refs as TreeRefs;
  const layout = refs.treeLayout;
  const dur = parseDuration(step.duration);
  const easing = resolveEasing(step.easing, defaultEasing);

  const nodeId = step.node;
  if (!nodeId) {
    console.warn('delete-node requires node');
    return;
  }

  const nodeRef = refs.nodes.get(nodeId);
  if (!nodeRef) return;

  // Fade out the node and its edge
  const fadeOuts: ThreadGenerator[] = [];

  const wrapper = nodeRef().parent() as Node;
  if (wrapper) {
    fadeOuts.push(wrapper.opacity(0, dur * 0.5, easing));
  }

  // Fade out edge from parent
  const parentId = layout.parentOf.get(nodeId);
  if (parentId) {
    const edgeKey = `${parentId}-${nodeId}`;
    const edgeRef = refs.edges.get(edgeKey);
    if (edgeRef) {
      fadeOuts.push(edgeRef().opacity(0, dur * 0.5, easing));
    }
  }

  // Also fade out all edges and nodes in the subtree
  const subtreeNodes = collectSubtree(nodeId, layout.children);
  for (const subId of subtreeNodes) {
    if (subId === nodeId) continue;
    const subRef = refs.nodes.get(subId);
    if (subRef) {
      const subWrapper = subRef().parent() as Node;
      if (subWrapper) fadeOuts.push(subWrapper.opacity(0, dur * 0.5, easing));
    }
    const subParent = layout.parentOf.get(subId);
    if (subParent) {
      const subEdgeKey = `${subParent}-${subId}`;
      const subEdgeRef = refs.edges.get(subEdgeKey);
      if (subEdgeRef) fadeOuts.push(subEdgeRef().opacity(0, dur * 0.5, easing));
    }
  }

  if (fadeOuts.length > 0) {
    yield* all(...fadeOuts);
  }

  // Remove from layout state
  if (parentId) {
    const parentChildren = layout.children.get(parentId);
    if (parentChildren) {
      if (parentChildren.left === nodeId) parentChildren.left = undefined;
      if (parentChildren.right === nodeId) parentChildren.right = undefined;
    }
  }

  // Remove subtree from maps
  for (const subId of subtreeNodes) {
    layout.children.delete(subId);
    layout.parentOf.delete(subId);
    layout.positions.delete(subId);
    refs.nodes.delete(subId);
    refs.nodeLabels.delete(subId);
  }

  // Recompute layout and animate remaining nodes
  recomputeLayout(layout);

  const moveAnimations: ThreadGenerator[] = [];
  for (const [id, pos] of layout.positions) {
    const existingNodeRef = refs.nodes.get(id);
    if (!existingNodeRef) continue;
    const w = existingNodeRef().parent() as Node;
    if (w && typeof w.x === 'function') {
      moveAnimations.push(w.x(pos.x, dur * 0.5, easing));
      moveAnimations.push(w.y(pos.y, dur * 0.5, easing));
    }

    const pid = layout.parentOf.get(id);
    if (pid) {
      const ek = `${pid}-${id}`;
      const er = refs.edges.get(ek);
      const pp = layout.positions.get(pid);
      if (er && pp) {
        moveAnimations.push(
          er().points([[pp.x, pp.y], [pos.x, pos.y]], dur * 0.5, easing),
        );
      }
    }
  }

  if (moveAnimations.length > 0) {
    yield* all(...moveAnimations);
  }
}

/**
 * Collect all node IDs in a subtree rooted at the given node.
 */
function collectSubtree(
  nodeId: string,
  children: Map<string, {left?: string; right?: string}>,
): string[] {
  const result: string[] = [nodeId];
  const ch = children.get(nodeId);
  if (!ch) return result;
  if (ch.left) result.push(...collectSubtree(ch.left, children));
  if (ch.right) result.push(...collectSubtree(ch.right, children));
  return result;
}

function parseFontSize(font?: string): number {
  if (!font) return 20;
  const match = font.match(/(\d+)px/);
  return match ? parseInt(match[1]) : 20;
}
