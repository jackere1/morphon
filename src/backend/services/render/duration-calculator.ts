/**
 * Deterministic timeline duration calculator.
 * Computes how long a scene's video will be based on its timeline actions,
 * using the exact same duration parsing logic that Revideo uses.
 */

import type {InlineShowManifest, TimelineEntry, ActionStep, TransitionConfig} from '../../../revideo/types.js';
import {isParallelBlock} from '../../../revideo/types.js';

// Inline parseDuration (matches src/revideo/utils/duration.ts exactly)
function parseDuration(dur?: string | number): number {
  if (dur === undefined || dur === null) return 0;
  if (typeof dur === 'number') return dur;
  const match = String(dur).match(/^([\d.]+)\s*(s|ms)$/);
  if (!match) return 0;
  const val = parseFloat(match[1]);
  return match[2] === 'ms' ? val / 1000 : val;
}

/**
 * Compute the total video duration of a single scene's timeline in seconds.
 * Sequential actions are summed. Parallel blocks use the max duration.
 */
export function computeSceneDuration(timeline: TimelineEntry[]): number {
  let total = 0;

  for (const entry of timeline) {
    if (isParallelBlock(entry)) {
      // Parallel block: all actions run simultaneously, duration = max
      let maxDur = 0;
      for (const step of entry.parallel) {
        const d = parseDuration(step.duration);
        if (d > maxDur) maxDur = d;
      }
      total += maxDur;
    } else {
      // Sequential action
      const step = entry as ActionStep;
      const d = parseDuration(step.duration);
      total += d;
    }
  }

  return total;
}

/**
 * Compute per-scene and total video durations for a multi-scene show.
 * Accounts for transition durations between scenes and the trailing 0.5s waitFor.
 */
export function computeShowDurations(show: InlineShowManifest): {
  sceneDurations: number[];
  transitionDurations: number[];
  totalDuration: number;
} {
  const sceneDurations: number[] = [];
  const transitionDurations: number[] = [];
  let total = 0;

  for (let i = 0; i < show.scenes.length; i++) {
    const scene = show.scenes[i];
    const sceneDur = computeSceneDuration(scene.manifest.timeline);
    sceneDurations.push(sceneDur);
    total += sceneDur;

    // Add transition duration (transitions happen before the scene's timeline)
    let transitionDur = 0;
    if (i > 0 && scene.transition && scene.transition !== 'none') {
      const t = scene.transition as TransitionConfig;
      transitionDur = parseDuration(t.duration);
    }
    transitionDurations.push(transitionDur);
    total += transitionDur;
  }

  // Account for the trailing 0.5s waitFor in morphon-animation.tsx
  total += 0.5;

  return {sceneDurations, transitionDurations, totalDuration: total};
}

/**
 * Pad scene timelines so that video duration >= audio duration for each scene.
 * Injects pause actions into the manifest IN PLACE.
 *
 * Returns the number of scenes that were padded.
 */
export function padSceneTimelines(
  show: InlineShowManifest,
  sceneDurations: number[],
  sceneAudioDurations: number[],
): number {
  let paddedCount = 0;
  const MAX_PADDING = 15; // Cap padding at 15s to avoid degenerate cases

  for (let i = 0; i < show.scenes.length; i++) {
    const videoDur = sceneDurations[i];
    const audioDur = sceneAudioDurations[i];

    // Only pad if audio exceeds video by more than 0.5s
    if (audioDur <= videoDur + 0.5) continue;

    const excess = audioDur - videoDur + 1.0; // 1s buffer for breathing room
    const paddingSeconds = Math.min(excess, MAX_PADDING);

    if (excess > MAX_PADDING) {
      console.warn(
        `[Sync] Scene ${i + 1}: audio exceeds video by ${(audioDur - videoDur).toFixed(1)}s — ` +
        `capping padding at ${MAX_PADDING}s (narration may still be cut)`
      );
    }

    const timeline = show.scenes[i].manifest.timeline;
    const pauseAction = {action: 'pause', duration: `${paddingSeconds.toFixed(1)}s`};

    // Insert before the final fade-out block if one exists
    const insertIdx = findFadeOutBlockIndex(timeline);
    if (insertIdx >= 0) {
      timeline.splice(insertIdx, 0, pauseAction);
    } else {
      timeline.push(pauseAction);
    }

    // Update the scene duration to reflect padding
    sceneDurations[i] += paddingSeconds;
    paddedCount++;

    console.log(
      `[Sync] Padded scene ${i + 1}: +${paddingSeconds.toFixed(1)}s ` +
      `(audio=${audioDur.toFixed(1)}s, video was ${videoDur.toFixed(1)}s, now ${sceneDurations[i].toFixed(1)}s)`
    );
  }

  return paddedCount;
}

// ── Subtitle preparation ────────────────────────────────────────────

const SUBTITLE_ID = '__subtitle';

/**
 * Split narration text into subtitle-sized chunks (1-2 sentences each).
 * Aims for ~8-15 words per chunk so they fit on screen and match speech pacing.
 */
function splitIntoSubtitleChunks(text: string): string[] {
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  const chunks: string[] = [];
  let current = '';

  for (const sentence of sentences) {
    const wordCount = (current + ' ' + sentence).split(/\s+/).length;
    if (current && wordCount > 18) {
      chunks.push(current.trim());
      current = sentence;
    } else {
      current = current ? current + ' ' + sentence : sentence;
    }
  }
  if (current.trim()) {
    chunks.push(current.trim());
  }

  if (chunks.length === 0 && text.trim()) {
    const words = text.trim().split(/\s+/);
    for (let i = 0; i < words.length; i += 12) {
      chunks.push(words.slice(i, i + 12).join(' '));
    }
  }

  return chunks;
}

/**
 * Prepare subtitles for each scene: adds a __subtitle text object and stores
 * chunks in manifest metadata. Does NOT touch the timeline — the Revideo
 * renderer runs subtitles as an independent parallel track.
 *
 * Mutates the show manifest in place.
 * Returns the number of scenes that received subtitles.
 */
export function injectSubtitles(show: InlineShowManifest): number {
  let injectedCount = 0;

  for (let i = 0; i < show.scenes.length; i++) {
    const scene = show.scenes[i];
    const narration = scene.narration;
    if (!narration || narration.trim().length === 0) continue;

    const manifest = scene.manifest;

    // Skip if already prepared (idempotent)
    if (manifest.objects.some((o: any) => o.id === SUBTITLE_ID)) continue;

    const chunks = splitIntoSubtitleChunks(narration);
    if (chunks.length === 0) continue;

    // Add subtitle text object at the bottom of the screen
    manifest.objects.push({
      id: SUBTITLE_ID,
      type: 'text',
      content: '',
      position: {x: 960, y: 1010},
      style: {
        font: '20px sans-serif',
        color: '#ccccee',
        align: 'center',
      },
    } as any);

    // Store chunks in manifest metadata — the renderer picks these up
    // and runs them as a parallel track via all() in morphon-animation.tsx
    (manifest.meta as any).__subtitleChunks = chunks;

    injectedCount++;
    console.log(`[Subtitles] Scene ${i + 1}: ${chunks.length} chunks prepared`);
  }

  return injectedCount;
}

/**
 * Find the index of the final fade-out parallel block in a timeline.
 * A fade-out block is a parallel block where ALL actions are "fade-out".
 * Returns -1 if not found.
 */
function findFadeOutBlockIndex(timeline: TimelineEntry[]): number {
  if (timeline.length === 0) return -1;

  const lastEntry = timeline[timeline.length - 1];
  if (!isParallelBlock(lastEntry)) return -1;

  const allFadeOut = lastEntry.parallel.every(
    (step: ActionStep) => step.action === 'fade-out'
  );

  return allFadeOut ? timeline.length - 1 : -1;
}
