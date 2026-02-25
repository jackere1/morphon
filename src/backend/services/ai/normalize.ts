/**
 * Normalizes and repairs AI-generated show manifests in-place.
 * Fixes common Gemini output errors: wrong types, missing fields,
 * bare string transitions, number durations, undeclared palette refs, etc.
 */

const VALID_ACTIONS = new Set([
  'fade-in', 'fade-out', 'highlight-node', 'highlight-edge',
  'enqueue', 'dequeue', 'push', 'pop', 'set-text', 'pause',
  'move-to', 'move-node', 'camera-zoom', 'camera-pan', 'camera-reset', 'set-style',
]);

const VALID_EASINGS = new Set([
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
]);

const VALID_TRANSITIONS = new Set(['fade', 'slide-left', 'slide-right', 'crossfade']);

const VALID_VARIANTS = new Set(['queue', 'stack', 'array', 'linked-list']);

const DEFAULT_CANVAS = {width: 1920, height: 1080, background: '#0f0f23'};

// Allowed properties per action type (everything else gets stripped)
const ACTION_PROPERTIES: Record<string, Set<string>> = {
  'fade-in': new Set(['action', 'target', 'duration', 'easing']),
  'fade-out': new Set(['action', 'target', 'duration', 'easing']),
  'highlight-node': new Set(['action', 'target', 'node', 'color', 'duration', 'easing']),
  'highlight-edge': new Set(['action', 'target', 'edge', 'color', 'duration', 'easing']),
  'enqueue': new Set(['action', 'target', 'values', 'duration', 'easing']),
  'dequeue': new Set(['action', 'target', 'duration', 'easing']),
  'push': new Set(['action', 'target', 'values', 'duration', 'easing']),
  'pop': new Set(['action', 'target', 'duration', 'easing']),
  'set-text': new Set(['action', 'target', 'value', 'duration', 'easing']),
  'pause': new Set(['action', 'duration']),
  'move-to': new Set(['action', 'target', 'position', 'duration', 'easing']),
  'move-node': new Set(['action', 'target', 'node', 'position', 'duration', 'easing']),
  'camera-zoom': new Set(['action', 'scale', 'duration', 'easing']),
  'camera-pan': new Set(['action', 'position', 'duration', 'easing']),
  'camera-reset': new Set(['action', 'duration', 'easing']),
  'set-style': new Set(['action', 'target', 'node', 'style', 'duration', 'easing']),
};

// Fallback colors for undeclared palette refs
const FALLBACK_COLORS = [
  '#e74c3c', '#2ecc71', '#3498db', '#f39c12', '#9b59b6',
  '#1abc9c', '#e67e22', '#ecf0f1', '#d35400', '#c0392b',
];

/**
 * Normalize an AI-generated show manifest in-place.
 * Fixes errors, coerces types, drops invalid entries, and collects warnings.
 */
export function normalizeShow(show: any, warnings: string[]): void {
  normalizeShowMeta(show, warnings);
  normalizeScenes(show, warnings);
  fixUndeclaredPaletteRefs(show, warnings);
}

// ── Show-level meta ──────────────────────────────────────────────

function normalizeShowMeta(show: any, warnings: string[]): void {
  if (!show.meta) {
    show.meta = {};
    warnings.push('Show was missing "meta" — created with defaults.');
  }

  // Canvas
  if (!show.meta.canvas || typeof show.meta.canvas !== 'object') {
    show.meta.canvas = {...DEFAULT_CANVAS};
    warnings.push('Show meta was missing "canvas" — set to 1920x1080.');
  } else {
    if (!show.meta.canvas.width || typeof show.meta.canvas.width !== 'number') {
      show.meta.canvas.width = DEFAULT_CANVAS.width;
    }
    if (!show.meta.canvas.height || typeof show.meta.canvas.height !== 'number') {
      show.meta.canvas.height = DEFAULT_CANVAS.height;
    }
    if (!show.meta.canvas.background || typeof show.meta.canvas.background !== 'string') {
      show.meta.canvas.background = DEFAULT_CANVAS.background;
    }
  }

  // Palette
  if (!show.meta.palette || typeof show.meta.palette !== 'object') {
    show.meta.palette = {};
  }

  // Easing
  if (show.meta.easing && !VALID_EASINGS.has(show.meta.easing)) {
    warnings.push(`Show meta has invalid easing "${show.meta.easing}" — removed.`);
    delete show.meta.easing;
  }

  // Scenes array
  if (!show.scenes || !Array.isArray(show.scenes)) {
    show.scenes = [];
    warnings.push('Show was missing "scenes" array — created empty.');
  }
}

// ── Scenes ───────────────────────────────────────────────────────

function normalizeScenes(show: any, warnings: string[]): void {
  for (let i = 0; i < show.scenes.length; i++) {
    const scene = show.scenes[i];
    const label = scene.name || `scene-${i + 1}`;

    // Ensure name
    if (!scene.name) {
      scene.name = `scene-${i + 1}`;
    }

    // Normalize transition
    normalizeTransition(scene, i, label, warnings);

    // Ensure manifest
    if (!scene.manifest || typeof scene.manifest !== 'object') {
      scene.manifest = {meta: {title: label, canvas: {...DEFAULT_CANVAS}}, objects: [], timeline: []};
      warnings.push(`${label}: was missing "manifest" — created empty.`);
      continue;
    }

    const m = scene.manifest;

    // Ensure meta
    if (!m.meta || typeof m.meta !== 'object') {
      m.meta = {title: label, canvas: {...show.meta.canvas}};
    }

    // Ensure canvas in scene
    if (!m.meta.canvas || typeof m.meta.canvas !== 'object') {
      m.meta.canvas = {...show.meta.canvas};
    }

    // Ensure objects array
    if (!m.objects || !Array.isArray(m.objects)) {
      m.objects = [];
      warnings.push(`${label}: was missing "objects" array.`);
    }

    // Ensure timeline array
    if (!m.timeline || !Array.isArray(m.timeline)) {
      m.timeline = [];
      warnings.push(`${label}: was missing "timeline" array.`);
    }

    // Normalize objects
    normalizeObjects(m, label, warnings);

    // Normalize timeline
    const objectIds = new Set(m.objects.map((o: any) => o.id));
    normalizeTimeline(m.timeline, objectIds, label, warnings);
  }
}

// ── Transition ───────────────────────────────────────────────────

function normalizeTransition(scene: any, index: number, label: string, warnings: string[]): void {
  // First scene must be "none"
  if (index === 0) {
    if (scene.transition && scene.transition !== 'none') {
      scene.transition = 'none';
    }
    return;
  }

  const t = scene.transition;

  if (!t || t === 'none') {
    scene.transition = 'none';
    return;
  }

  // Bare string like "crossfade" → object
  if (typeof t === 'string') {
    if (VALID_TRANSITIONS.has(t)) {
      scene.transition = {type: t, duration: '1s'};
      warnings.push(`${label}: transition "${t}" was a bare string — converted to {type: "${t}", duration: "1s"}.`);
    } else {
      scene.transition = 'none';
      warnings.push(`${label}: invalid transition "${t}" — set to "none".`);
    }
    return;
  }

  // Object — validate shape
  if (typeof t === 'object') {
    if (!t.type || !VALID_TRANSITIONS.has(t.type)) {
      scene.transition = 'none';
      warnings.push(`${label}: invalid transition type "${t.type}" — set to "none".`);
      return;
    }
    // Normalize duration
    t.duration = normalizeDuration(t.duration, '1s');
  }
}

// ── Objects ──────────────────────────────────────────────────────

function normalizeObjects(manifest: any, sceneLabel: string, warnings: string[]): void {
  const seen = new Set<string>();
  const cleaned: any[] = [];

  for (const obj of manifest.objects) {
    // Must have id and type
    if (!obj.id || !obj.type) {
      warnings.push(`${sceneLabel}: dropped object missing id or type.`);
      continue;
    }

    // Deduplicate
    if (seen.has(obj.id)) {
      warnings.push(`${sceneLabel}: dropped duplicate object "${obj.id}".`);
      continue;
    }
    seen.add(obj.id);

    // Type-specific normalization
    switch (obj.type) {
      case 'graph':
        normalizeGraph(obj, sceneLabel, warnings);
        break;
      case 'data-structure':
        normalizeDataStructure(obj, sceneLabel, warnings);
        break;
      case 'text':
        normalizeText(obj, sceneLabel, warnings);
        break;
      default:
        warnings.push(`${sceneLabel}: object "${obj.id}" has unknown type "${obj.type}".`);
        break;
    }

    cleaned.push(obj);
  }

  manifest.objects = cleaned;
}

function normalizeGraph(obj: any, sceneLabel: string, warnings: string[]): void {
  // Ensure nodes array
  if (!Array.isArray(obj.nodes)) {
    obj.nodes = [];
    warnings.push(`${sceneLabel}: graph "${obj.id}" was missing "nodes" — set to [].`);
  }

  // Validate each node
  const validNodes: any[] = [];
  const nodeIds = new Set<string>();
  for (const node of obj.nodes) {
    if (!node.id) {
      warnings.push(`${sceneLabel}: graph "${obj.id}" has a node without id — dropped.`);
      continue;
    }
    // Ensure numeric coordinates
    if (typeof node.x !== 'number') node.x = 0;
    if (typeof node.y !== 'number') node.y = 0;
    // Default label to id
    if (node.label === undefined) node.label = node.id;
    nodeIds.add(node.id);
    validNodes.push(node);
  }
  obj.nodes = validNodes;

  // Ensure edges array
  if (!Array.isArray(obj.edges)) {
    obj.edges = [];
  }

  // Prune edges referencing non-existent nodes
  const validEdges: any[] = [];
  for (const edge of obj.edges) {
    if (!edge.from || !edge.to) {
      warnings.push(`${sceneLabel}: graph "${obj.id}" has edge missing from/to — dropped.`);
      continue;
    }
    if (!nodeIds.has(edge.from)) {
      warnings.push(`${sceneLabel}: graph "${obj.id}" edge references unknown node "${edge.from}" — dropped.`);
      continue;
    }
    if (!nodeIds.has(edge.to)) {
      warnings.push(`${sceneLabel}: graph "${obj.id}" edge references unknown node "${edge.to}" — dropped.`);
      continue;
    }
    validEdges.push(edge);
  }
  obj.edges = validEdges;
}

function normalizeDataStructure(obj: any, sceneLabel: string, warnings: string[]): void {
  // Validate variant
  if (!obj.variant || !VALID_VARIANTS.has(obj.variant)) {
    warnings.push(`${sceneLabel}: data-structure "${obj.id}" has invalid variant "${obj.variant}" — defaulting to "array".`);
    obj.variant = 'array';
  }

  // Ensure position
  normalizePosition(obj, sceneLabel, `data-structure "${obj.id}"`, warnings);
}

function normalizeText(obj: any, sceneLabel: string, warnings: string[]): void {
  // Ensure content is string
  if (obj.content === undefined || obj.content === null) {
    obj.content = '';
  } else if (typeof obj.content !== 'string') {
    obj.content = String(obj.content);
  }

  // Ensure position
  normalizePosition(obj, sceneLabel, `text "${obj.id}"`, warnings);
}

function normalizePosition(obj: any, sceneLabel: string, desc: string, warnings: string[]): void {
  if (!obj.position || typeof obj.position !== 'object') {
    obj.position = {x: 960, y: 540};
    warnings.push(`${sceneLabel}: ${desc} was missing position — set to center (960, 540).`);
    return;
  }
  if (typeof obj.position.x !== 'number') obj.position.x = 960;
  if (typeof obj.position.y !== 'number') obj.position.y = 540;
}

// ── Timeline ─────────────────────────────────────────────────────

function normalizeTimeline(
  timeline: any[],
  objectIds: Set<string>,
  sceneLabel: string,
  warnings: string[],
): void {
  // Walk backwards so we can splice in place
  for (let i = timeline.length - 1; i >= 0; i--) {
    const entry = timeline[i];

    // Parallel block
    if (entry.parallel) {
      if (!Array.isArray(entry.parallel)) {
        warnings.push(`${sceneLabel}: timeline[${i}].parallel was not an array — dropped.`);
        timeline.splice(i, 1);
        continue;
      }
      // Normalize each action inside
      for (let j = entry.parallel.length - 1; j >= 0; j--) {
        if (!normalizeAction(entry.parallel[j], objectIds, `${sceneLabel}: parallel[${j}]`, warnings)) {
          entry.parallel.splice(j, 1);
        }
      }
      // Drop empty parallel blocks
      if (entry.parallel.length === 0) {
        timeline.splice(i, 1);
      }
      continue;
    }

    // Regular action
    if (!normalizeAction(entry, objectIds, `${sceneLabel}: timeline[${i}]`, warnings)) {
      timeline.splice(i, 1);
    }
  }
}

/**
 * Normalize a single action in-place. Returns false if the action
 * should be dropped entirely.
 */
function normalizeAction(
  action: any,
  objectIds: Set<string>,
  label: string,
  warnings: string[],
): boolean {
  // Must have action field
  if (!action.action || typeof action.action !== 'string') {
    warnings.push(`${label}: missing "action" field — dropped.`);
    return false;
  }

  // Must be known action type
  if (!VALID_ACTIONS.has(action.action)) {
    warnings.push(`${label}: unknown action "${action.action}" — dropped.`);
    return false;
  }

  // Normalize duration
  if (action.duration !== undefined) {
    action.duration = normalizeDuration(action.duration);
    if (action.duration === null) {
      // Duration was required for most actions — set a default
      action.duration = '1s';
      warnings.push(`${label}: invalid duration — defaulted to "1s".`);
    }
  }

  // Normalize easing
  if (action.easing) {
    if (!VALID_EASINGS.has(action.easing)) {
      warnings.push(`${label}: invalid easing "${action.easing}" — removed.`);
      delete action.easing;
    }
  }

  // Check target exists
  if (action.target && !objectIds.has(action.target)) {
    // Don't drop — just warn. The renderer will skip silently.
    warnings.push(`${label}: action "${action.action}" targets "${action.target}" which doesn't exist.`);
  }

  // Action-specific field validation
  switch (action.action) {
    case 'highlight-node':
      if (!action.node) {
        warnings.push(`${label}: highlight-node missing "node" — dropped.`);
        return false;
      }
      if (!action.color) {
        warnings.push(`${label}: highlight-node missing "color" — dropped.`);
        return false;
      }
      if (!action.duration) action.duration = '0.5s';
      break;

    case 'highlight-edge':
      if (!action.edge || !Array.isArray(action.edge) || action.edge.length < 2) {
        warnings.push(`${label}: highlight-edge missing valid "edge" array — dropped.`);
        return false;
      }
      if (!action.color) {
        warnings.push(`${label}: highlight-edge missing "color" — dropped.`);
        return false;
      }
      if (!action.duration) action.duration = '0.5s';
      break;

    case 'enqueue':
    case 'push':
      if (!action.values) {
        warnings.push(`${label}: ${action.action} missing "values" — dropped.`);
        return false;
      }
      // Coerce to string array
      if (!Array.isArray(action.values)) {
        action.values = [String(action.values)];
      } else {
        action.values = action.values.map((v: any) => String(v));
      }
      if (!action.duration) action.duration = '0.5s';
      break;

    case 'set-text':
      if (action.value === undefined || action.value === null) {
        warnings.push(`${label}: set-text missing "value" — set to "".`);
        action.value = '';
      } else if (typeof action.value !== 'string') {
        action.value = String(action.value);
      }
      break;

    case 'camera-zoom':
      if (action.scale === undefined || typeof action.scale !== 'number') {
        warnings.push(`${label}: camera-zoom missing or invalid "scale" — dropped.`);
        return false;
      }
      if (!action.duration) action.duration = '1s';
      break;

    case 'camera-pan':
    case 'move-to':
    case 'move-node':
      if (!action.position || typeof action.position !== 'object') {
        warnings.push(`${label}: ${action.action} missing "position" — dropped.`);
        return false;
      }
      if (typeof action.position.x !== 'number' || typeof action.position.y !== 'number') {
        warnings.push(`${label}: ${action.action} has non-numeric position — dropped.`);
        return false;
      }
      if (action.action === 'move-node' && !action.node) {
        warnings.push(`${label}: move-node missing "node" — dropped.`);
        return false;
      }
      if (!action.duration) action.duration = '1s';
      break;

    case 'set-style':
      if (!action.style || typeof action.style !== 'object') {
        warnings.push(`${label}: set-style missing "style" object — dropped.`);
        return false;
      }
      if (!action.duration) action.duration = '0.5s';
      break;

    case 'fade-in':
    case 'fade-out':
      if (!action.duration) action.duration = '0.5s';
      break;

    case 'dequeue':
    case 'pop':
      if (!action.duration) action.duration = '0.5s';
      break;

    case 'pause':
      if (!action.duration) action.duration = '3s';
      // Enforce minimum pause duration — AI consistently generates short pauses
      action.duration = enforceMinPauseDuration(action.duration, 3);
      break;

    case 'camera-reset':
      if (!action.duration) action.duration = '1s';
      break;
  }

  // Strip unknown properties (Gemini hallucinations like "animated", "weight", etc.)
  const allowed = ACTION_PROPERTIES[action.action];
  if (allowed) {
    for (const key of Object.keys(action)) {
      if (!allowed.has(key)) {
        warnings.push(`${label}: stripped unknown property "${key}" from ${action.action}.`);
        delete action[key];
      }
    }
  }

  return true;
}

// ── Palette refs ─────────────────────────────────────────────────

function fixUndeclaredPaletteRefs(show: any, warnings: string[]): void {
  const palette: Record<string, string> = show.meta.palette;
  let fallbackIdx = 0;

  const usedRefs = new Set<string>();

  for (const scene of show.scenes) {
    const timeline = scene.manifest?.timeline || [];
    collectPaletteRefs(timeline, usedRefs);
  }

  for (const ref of usedRefs) {
    if (!palette[ref]) {
      const color = FALLBACK_COLORS[fallbackIdx % FALLBACK_COLORS.length];
      fallbackIdx++;
      palette[ref] = color;
      warnings.push(`Palette: "$${ref}" was not declared — auto-assigned ${color}.`);
    }
  }
}

function collectPaletteRefs(timeline: any[], refs: Set<string>): void {
  for (const entry of timeline) {
    if (entry.parallel && Array.isArray(entry.parallel)) {
      for (const a of entry.parallel) {
        if (typeof a.color === 'string' && a.color.startsWith('$')) {
          refs.add(a.color.slice(1));
        }
      }
    } else {
      if (typeof entry.color === 'string' && entry.color.startsWith('$')) {
        refs.add(entry.color.slice(1));
      }
    }
  }
}

// ── Pause enforcement ────────────────────────────────────────────

/**
 * Enforce a minimum duration on pause actions.
 * The AI consistently generates 1-2s pauses despite being told 3-5s.
 * This guarantees the video isn't rushed.
 */
function enforceMinPauseDuration(dur: string, minSeconds: number): string {
  const match = dur.match(/^([\d.]+)\s*(s|ms)$/);
  if (!match) return `${minSeconds}s`;
  const value = parseFloat(match[1]);
  const unit = match[2];
  const seconds = unit === 'ms' ? value / 1000 : value;
  if (seconds < minSeconds) return `${minSeconds}s`;
  return dur;
}

// ── Duration helper ──────────────────────────────────────────────

/**
 * Normalize a duration value to a valid string like "1s" or "500ms".
 * Returns the normalized string, or `defaultVal` if invalid.
 */
function normalizeDuration(dur: any, defaultVal: string = '1s'): string | null {
  if (dur === undefined || dur === null) return null;

  // Already valid string format: "1s", "0.5s", "500ms"
  if (typeof dur === 'string') {
    if (/^[\d.]+\s*(s|ms)$/.test(dur)) return dur;
    // Bare number string like "2" → "2s"
    const num = parseFloat(dur);
    if (!isNaN(num) && num > 0) return `${num}s`;
    return null;
  }

  // Number → treat as seconds
  if (typeof dur === 'number' && dur > 0) {
    return `${dur}s`;
  }

  return null;
}
