// Manifest v2 TypeScript interfaces

// ── Single Scene Manifest ──────────────────────────────────────────

export interface Manifest {
  meta: ManifestMeta;
  objects: SceneObject[];
  timeline: TimelineEntry[];
}

export interface ManifestMeta {
  title: string;
  topic?: string;
  canvas: {
    width: number;
    height: number;
    background: string;
  };
  defaults?: Record<string, Record<string, any>>;
  palette?: Record<string, string>;
  easing?: string;
}

// ── Multi-Scene Show Manifest ──────────────────────────────────────

export interface ShowManifest {
  meta: ManifestMeta;
  scenes: ShowScene[];
}

export interface ShowScene {
  file: string;
  transition?: TransitionConfig | 'none';
}

export interface TransitionConfig {
  type: 'fade' | 'slide-left' | 'slide-right' | 'crossfade';
  duration: string | number;
  easing?: string;
}

/** Resolved show = all scene manifests loaded and merged */
export interface ResolvedShow {
  meta: ManifestMeta;
  scenes: ResolvedScene[];
}

export interface ResolvedScene {
  manifest: Manifest;
  transition?: TransitionConfig;
}

export function isShowManifest(obj: any): obj is ShowManifest {
  return 'scenes' in obj && Array.isArray(obj.scenes);
}

/** Inline show = scenes embedded as objects (no file references). Used by web UI + AI. */
export interface InlineShowManifest {
  meta: ManifestMeta;
  scenes: InlineShowScene[];
}

export interface InlineShowScene {
  name?: string;
  manifest: Manifest;
  transition?: TransitionConfig | 'none';
}

// ── Timeline ───────────────────────────────────────────────────────

export type TimelineEntry = ActionStep | ParallelBlock;

export interface ParallelBlock {
  parallel: ActionStep[];
}

export interface ActionStep {
  action: string;
  target?: string;
  duration?: string | number;
  easing?: string;
  // Action-specific fields
  node?: string;
  edge?: string[];
  color?: string;
  values?: string[];
  value?: string;
  position?: { x: number; y: number };
  scale?: number;
  style?: Record<string, any>;
  indices?: number[];
}

// ── Scene Objects ──────────────────────────────────────────────────

export interface GraphObject {
  id: string;
  type: 'graph';
  layout?: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  style?: Record<string, any>;
}

export interface GraphNode {
  id: string;
  label?: string;
  x: number;
  y: number;
}

export interface GraphEdge {
  from: string;
  to: string;
}

export interface DataStructureObject {
  id: string;
  type: 'data-structure';
  variant: 'queue' | 'stack' | 'array' | 'linked-list';
  position: { x: number; y: number };
  style?: Record<string, any>;
}

export interface TextObject {
  id: string;
  type: 'text';
  content: string;
  position: { x: number; y: number };
  style?: Record<string, any>;
}

export type SceneObject = GraphObject | DataStructureObject | TextObject;

export function isParallelBlock(entry: TimelineEntry): entry is ParallelBlock {
  return 'parallel' in entry;
}
