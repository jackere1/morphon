import { readFileSync, mkdirSync, writeFileSync } from 'fs';
import { createCanvas } from 'canvas';
import YAML from 'yaml';
import { parseDuration } from '../manifest/schema.js';
import { validateManifest } from '../manifest/validate.js';

const FPS = 30;

// ── Scene State ──────────────────────────────────────────────────────
class SceneState {
  constructor(manifest) {
    this.canvas = manifest.meta.canvas;
    this.objects = new Map();
    this.queueState = new Map(); // track queue contents

    for (const obj of manifest.objects) {
      this.objects.set(obj.id, {
        ...obj,
        opacity: 0, // start hidden, fade-in reveals
        highlightedNodes: new Map(),
        highlightedEdges: new Map(),
      });
    }
  }
}

// ── Drawing Functions ────────────────────────────────────────────────
function drawGraph(ctx, obj) {
  const style = obj.style || {};
  const nodeRadius = style.nodeRadius || 30;
  const nodeColor = style.nodeColor || '#4a4a6a';
  const nodeStroke = style.nodeStroke || '#7c7caa';
  const edgeColor = style.edgeColor || '#3a3a5a';
  const labelColor = style.labelColor || '#ffffff';
  const labelFont = style.labelFont || '16px monospace';

  const alpha = obj.opacity;
  if (alpha <= 0) return;

  const nodeMap = new Map(obj.nodes.map((n) => [n.id, n]));

  // Draw edges
  for (const edge of obj.edges) {
    const from = nodeMap.get(edge.from);
    const to = nodeMap.get(edge.to);
    if (!from || !to) continue;

    const edgeKey = `${edge.from}-${edge.to}`;
    const highlightColor = obj.highlightedEdges.get(edgeKey);

    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.strokeStyle = highlightColor || edgeColor;
    ctx.globalAlpha = alpha;
    ctx.lineWidth = highlightColor ? 3 : 2;
    ctx.stroke();
  }

  // Draw nodes
  for (const node of obj.nodes) {
    const highlightColor = obj.highlightedNodes.get(node.id);

    ctx.beginPath();
    ctx.arc(node.x, node.y, nodeRadius, 0, Math.PI * 2);
    ctx.fillStyle = highlightColor || nodeColor;
    ctx.globalAlpha = alpha;
    ctx.fill();
    ctx.strokeStyle = highlightColor || nodeStroke;
    ctx.lineWidth = highlightColor ? 3 : 2;
    ctx.stroke();

    // Label
    ctx.fillStyle = labelColor;
    ctx.font = labelFont;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(node.label || node.id, node.x, node.y);
  }

  ctx.globalAlpha = 1;
}

function drawQueue(ctx, obj, queueValues) {
  const style = obj.style || {};
  const cellW = style.cellWidth || 60;
  const cellH = style.cellHeight || 40;
  const fill = style.fillColor || '#2a2a4a';
  const border = style.borderColor || '#5a5a8a';
  const textColor = style.textColor || '#ffffff';

  const alpha = obj.opacity;
  if (alpha <= 0) return;

  const values = queueValues || [];
  const totalW = Math.max(values.length, 1) * cellW;
  const startX = obj.position.x - totalW / 2;
  const y = obj.position.y;

  ctx.globalAlpha = alpha;

  // Label
  ctx.fillStyle = '#aaaacc';
  ctx.font = '14px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('Queue', obj.position.x, y - cellH - 5);

  // Draw cells
  for (let i = 0; i < values.length; i++) {
    const x = startX + i * cellW;
    ctx.fillStyle = fill;
    ctx.fillRect(x, y - cellH / 2, cellW, cellH);
    ctx.strokeStyle = border;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y - cellH / 2, cellW, cellH);

    ctx.fillStyle = textColor;
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(values[i], x + cellW / 2, y);
  }

  // Arrow showing front
  if (values.length > 0) {
    ctx.fillStyle = '#aaaacc';
    ctx.font = '12px monospace';
    ctx.fillText('← front', startX + cellW / 2, y + cellH / 2 + 18);
  }

  ctx.globalAlpha = 1;
}

function drawText(ctx, obj) {
  const alpha = obj.opacity;
  if (alpha <= 0) return;

  const style = obj.style || {};
  ctx.globalAlpha = alpha;
  ctx.fillStyle = style.color || '#ffffff';
  ctx.font = style.font || '20px sans-serif';
  ctx.textAlign = style.align || 'left';
  ctx.textBaseline = 'middle';

  const content = obj._currentText !== undefined ? obj._currentText : obj.content;
  ctx.fillText(content, obj.position.x, obj.position.y);
  ctx.globalAlpha = 1;
}

// ── Frame Renderer ───────────────────────────────────────────────────
function renderFrame(state) {
  const { width, height, background } = state.canvas;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = background || '#1a1a2e';
  ctx.fillRect(0, 0, width, height);

  // Draw objects in order
  for (const [id, obj] of state.objects) {
    switch (obj.type) {
      case 'graph':
        drawGraph(ctx, obj);
        break;
      case 'data-structure':
        drawQueue(ctx, obj, state.queueState.get(id) || []);
        break;
      case 'text':
        drawText(ctx, obj);
        break;
    }
  }

  return canvas;
}

// ── Animation Executor ───────────────────────────────────────────────
function executeTimeline(manifest, outputDir) {
  const state = new SceneState(manifest);
  let frameNum = 0;

  function emitFrames(durationSec) {
    const numFrames = Math.max(1, Math.round(durationSec * FPS));
    for (let i = 0; i < numFrames; i++) {
      const canvas = renderFrame(state);
      const buf = canvas.toBuffer('image/png');
      const framePath = `${outputDir}/frame_${String(frameNum).padStart(5, '0')}.png`;
      writeFileSync(framePath, buf);
      frameNum++;
    }
    return numFrames;
  }

  // Interpolation helper for fade animations
  function fadeIn(objId, durationSec) {
    const obj = state.objects.get(objId);
    if (!obj) return;
    const numFrames = Math.max(1, Math.round(durationSec * FPS));
    for (let i = 0; i < numFrames; i++) {
      obj.opacity = (i + 1) / numFrames;
      const canvas = renderFrame(state);
      const buf = canvas.toBuffer('image/png');
      const framePath = `${outputDir}/frame_${String(frameNum).padStart(5, '0')}.png`;
      writeFileSync(framePath, buf);
      frameNum++;
    }
  }

  for (const step of manifest.timeline) {
    const dur = parseDuration(step.duration) || 0;
    const obj = step.target ? state.objects.get(step.target) : null;

    switch (step.action) {
      case 'fade-in':
        fadeIn(step.target, dur);
        break;

      case 'fade-out':
        if (obj) {
          const numFrames = Math.max(1, Math.round(dur * FPS));
          for (let i = 0; i < numFrames; i++) {
            obj.opacity = 1 - (i + 1) / numFrames;
            const canvas = renderFrame(state);
            writeFileSync(
              `${outputDir}/frame_${String(frameNum).padStart(5, '0')}.png`,
              canvas.toBuffer('image/png')
            );
            frameNum++;
          }
        }
        break;

      case 'highlight-node':
        if (obj) {
          obj.highlightedNodes.set(step.node, step.color);
          emitFrames(dur);
        }
        break;

      case 'highlight-edge':
        if (obj && Array.isArray(step.edge)) {
          const key = `${step.edge[0]}-${step.edge[1]}`;
          obj.highlightedEdges.set(key, step.color);
          emitFrames(dur);
        }
        break;

      case 'enqueue':
        if (obj) {
          const q = state.queueState.get(step.target) || [];
          q.push(...step.values);
          state.queueState.set(step.target, q);
          emitFrames(dur);
        }
        break;

      case 'dequeue':
        if (obj) {
          const q = state.queueState.get(step.target) || [];
          q.shift();
          state.queueState.set(step.target, q);
          emitFrames(dur);
        }
        break;

      case 'set-text':
        if (obj) {
          obj._currentText = step.value;
          emitFrames(dur || 1 / FPS); // at least one frame
        }
        break;

      case 'pause':
        emitFrames(dur);
        break;

      default:
        console.warn(`Unknown action: ${step.action}`);
        emitFrames(dur);
    }
  }

  return frameNum;
}

// ── CLI Entry Point ──────────────────────────────────────────────────
const file = process.argv[2];
if (!file) {
  console.log('Usage: node src/renderer/render.js <manifest.yaml>');
  process.exit(1);
}

console.log(`\n🎬 CS Animation Renderer`);
console.log(`========================\n`);

const raw = readFileSync(file, 'utf-8');
const manifest = YAML.parse(raw);

// Validate first
const { errors } = validateManifest(manifest);
if (errors.length > 0) {
  console.error('\nManifest has errors, cannot render.');
  process.exit(1);
}

// Create output directory
const outputDir = 'output/frames';
mkdirSync(outputDir, { recursive: true });

console.log(`\nRendering at ${FPS} FPS...`);
const totalFrames = executeTimeline(manifest, outputDir);
console.log(`\n✓ Rendered ${totalFrames} frames to ${outputDir}/`);
console.log(`\nTo create video, run:`);
console.log(`  ffmpeg -framerate ${FPS} -i ${outputDir}/frame_%05d.png -c:v libx264 -pix_fmt yuv420p output/bfs.mp4\n`);
