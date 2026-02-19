// Manifest schema definition and constants (v2)
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
    optional: ['easing'],
  },
  'fade-out': {
    required: ['target', 'duration'],
    optional: ['easing'],
  },
  'highlight-node': {
    required: ['target', 'node', 'color', 'duration'],
    optional: ['easing'],
  },
  'highlight-edge': {
    required: ['target', 'edge', 'color', 'duration'],
    optional: ['easing'],
  },
  enqueue: {
    required: ['target', 'values', 'duration'],
    optional: ['easing'],
  },
  dequeue: {
    required: ['target', 'duration'],
    optional: ['easing'],
  },
  push: {
    required: ['target', 'values', 'duration'],
    optional: ['easing'],
  },
  pop: {
    required: ['target', 'duration'],
    optional: ['easing'],
  },
  'set-text': {
    required: ['target', 'value'],
    optional: ['duration', 'easing'],
  },
  pause: {
    required: ['duration'],
    optional: [],
  },
  // v2 actions
  'move-to': {
    required: ['target', 'position', 'duration'],
    optional: ['easing'],
  },
  'move-node': {
    required: ['target', 'node', 'position', 'duration'],
    optional: ['easing'],
  },
  'camera-zoom': {
    required: ['scale', 'duration'],
    optional: ['target', 'easing'],
  },
  'camera-pan': {
    required: ['position', 'duration'],
    optional: ['easing'],
  },
  'camera-reset': {
    required: ['duration'],
    optional: ['easing'],
  },
  'set-style': {
    required: ['target', 'style', 'duration'],
    optional: ['node', 'easing'],
  },
};

export const VALID_EASINGS = [
  'linear',
  'easeIn', 'easeOut', 'easeInOut',
  'easeInSine', 'easeOutSine', 'easeInOutSine',
  'easeInQuad', 'easeOutQuad', 'easeInOutQuad',
  'easeInCubic', 'easeOutCubic', 'easeInOutCubic',
  'easeInQuart', 'easeOutQuart', 'easeInOutQuart',
  'easeInExpo', 'easeOutExpo', 'easeInOutExpo',
  'easeInBack', 'easeOutBack', 'easeInOutBack',
  'easeInBounce', 'easeOutBounce', 'easeInOutBounce',
  'easeInElastic', 'easeOutElastic', 'easeInOutElastic',
];

export function parseDuration(str) {
  if (typeof str === 'number') return str;
  const match = String(str).match(/^([\d.]+)\s*(s|ms)$/);
  if (!match) return null;
  const val = parseFloat(match[1]);
  return match[2] === 'ms' ? val / 1000 : val;
}
