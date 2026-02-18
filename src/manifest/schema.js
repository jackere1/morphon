// Manifest schema definition and constants
// Defines valid object types, action types, and their required fields

export const OBJECT_TYPES = {
  graph: {
    required: ['id', 'type', 'nodes', 'edges'],
    optional: ['layout', 'style'],
    nodeFields: ['id', 'label', 'x', 'y'],
    edgeFields: ['from', 'to'],
  },
  'data-structure': {
    required: ['id', 'type', 'variant', 'position'],
    optional: ['style'],
    variants: ['queue', 'stack', 'array', 'linked-list'],
  },
  text: {
    required: ['id', 'type', 'content', 'position'],
    optional: ['style'],
  },
};

export const ACTION_TYPES = {
  'fade-in': {
    required: ['target', 'duration'],
    optional: [],
  },
  'fade-out': {
    required: ['target', 'duration'],
    optional: [],
  },
  'highlight-node': {
    required: ['target', 'node', 'color', 'duration'],
    optional: [],
  },
  'highlight-edge': {
    required: ['target', 'edge', 'color', 'duration'],
    optional: [],
  },
  enqueue: {
    required: ['target', 'values', 'duration'],
    optional: [],
  },
  dequeue: {
    required: ['target', 'duration'],
    optional: [],
  },
  push: {
    required: ['target', 'values', 'duration'],
    optional: [],
  },
  pop: {
    required: ['target', 'duration'],
    optional: [],
  },
  'set-text': {
    required: ['target', 'value'],
    optional: ['duration'],
  },
  pause: {
    required: ['duration'],
    optional: [],
  },
};

export function parseDuration(str) {
  if (typeof str === 'number') return str;
  const match = String(str).match(/^([\d.]+)\s*(s|ms)$/);
  if (!match) return null;
  const val = parseFloat(match[1]);
  return match[2] === 'ms' ? val / 1000 : val;
}
