import {makeScene2D, Node, Txt} from '@revideo/2d';
import {all, useScene, waitFor, createRef, type ThreadGenerator} from '@revideo/core';
import type {Manifest, ActionStep, ResolvedShow, ResolvedScene} from '../types';
import {isParallelBlock} from '../types';
import {createSceneObjects} from '../objects';
import {executeAction} from '../actions';
import {executeTransition} from '../actions/transition';

const SUBTITLE_ID = '__subtitle';
const WORDS_PER_SECOND = 2.5;

export default makeScene2D('cs-animation', function* (view) {
  const dataJson = useScene().variables.get('manifest', '{}')();
  const data = JSON.parse(dataJson as string);

  if (data.type === 'show') {
    yield* renderShow(view, data.show as ResolvedShow);
  } else if (data.type === 'single') {
    yield* renderSingleScene(view, data.manifest as Manifest);
  } else {
    // Legacy: direct manifest object (backward compat)
    yield* renderSingleScene(view, data as Manifest);
  }

  yield* waitFor(0.5);
});

/** Execute a timeline (shared by single and multi-scene) */
function* executeTimeline(
  timeline: any[],
  objects: Map<string, any>,
  camera: Node,
  meta: any,
) {
  for (let i = 0; i < timeline.length; i++) {
    const entry = timeline[i];
    try {
      if (isParallelBlock(entry)) {
        yield* all(
          ...entry.parallel.map((step: ActionStep) =>
            executeAction(step, objects, camera, meta),
          ),
        );
      } else {
        yield* executeAction(entry as ActionStep, objects, camera, meta);
      }
    } catch (err: any) {
      console.error(`[Render] Action ${i} failed (${entry.action || 'parallel'}): ${err.message}`);
      // Continue rendering remaining actions instead of stopping the video
    }
  }
}

/**
 * Run subtitles as an independent parallel track.
 * Cycles through chunks, distributing them evenly across the total scene duration.
 * Each chunk: fade-in → hold → fade-out → brief gap.
 */
function* runSubtitleTrack(
  subtitleRef: any,
  chunks: string[],
  totalDuration: number,
): ThreadGenerator {
  if (chunks.length === 0 || totalDuration <= 0) return;

  // Distribute chunks evenly across the scene duration
  const timePerChunk = totalDuration / chunks.length;
  const fadeTime = 0.3;
  const gapTime = 0.3;

  for (let i = 0; i < chunks.length; i++) {
    const holdTime = Math.max(timePerChunk - fadeTime * 2 - gapTime, 1.0);

    // Set text, fade in, hold, fade out
    subtitleRef().text(chunks[i]);
    yield* subtitleRef().opacity(1, fadeTime);
    yield* waitFor(holdTime);
    yield* subtitleRef().opacity(0, fadeTime);

    // Brief gap between chunks (except after last)
    if (i < chunks.length - 1) {
      yield* waitFor(gapTime);
    }
  }
}

/**
 * Compute the total duration of a timeline by summing action durations.
 * Used to know how long the subtitle track should run.
 */
function computeTimelineDuration(timeline: any[]): number {
  let total = 0;
  for (const entry of timeline) {
    if (entry.parallel && Array.isArray(entry.parallel)) {
      let maxDur = 0;
      for (const step of entry.parallel) {
        const d = parseDurationLocal(step.duration);
        if (d > maxDur) maxDur = d;
      }
      total += maxDur;
    } else {
      total += parseDurationLocal(entry.duration);
    }
  }
  return total;
}

function parseDurationLocal(dur?: string | number): number {
  if (dur === undefined || dur === null) return 0;
  if (typeof dur === 'number') return dur;
  const match = String(dur).match(/^([\d.]+)\s*(s|ms)$/);
  if (!match) return 0;
  const val = parseFloat(match[1]);
  return match[2] === 'ms' ? val / 1000 : val;
}

/** Renders a single scene manifest. */
function* renderSingleScene(view: any, manifest: Manifest) {
  view.fill(manifest.meta.canvas.background || '#1a1a2e');

  // Camera node wraps all objects — zoom/pan applies here, not on view
  const camera = createRef<Node>();
  view.add(<Node ref={camera} />);

  const objects = createSceneObjects(camera() as any, manifest.objects, manifest.meta);
  yield* executeTimeline(manifest.timeline, objects, camera(), manifest.meta);
}

/** Renders a multi-scene show with transitions. */
function* renderShow(view: any, show: ResolvedShow) {
  view.fill(show.meta.canvas.background || '#1a1a2e');

  // Camera node wraps all scene containers
  const camera = createRef<Node>();
  view.add(<Node ref={camera} />);

  let previousContainer: Node | null = null;

  for (let i = 0; i < show.scenes.length; i++) {
    const scene = show.scenes[i];
    const manifest = scene.manifest;

    // Create a container for this scene inside the camera
    const container = createRef<Node>();
    camera().add(<Node ref={container} opacity={0} />);

    // Create scene objects inside the container
    const objects = createSceneObjects(
      container() as any,
      manifest.objects,
      manifest.meta,
    );

    // Transition from previous scene (or just show first scene)
    if (previousContainer && scene.transition) {
      yield* executeTransition(
        previousContainer,
        container(),
        scene.transition,
        show.meta,
      );
    } else {
      if (previousContainer) previousContainer.remove();
      container().opacity(1);
    }

    // Reset camera before each scene (clean slate)
    camera().scale(1);
    camera().position([0, 0]);

    // Check for subtitle chunks (passed via ResolvedScene)
    const subtitleChunks = scene.subtitleChunks || (manifest.meta as any).__subtitleChunks;
    const subtitleEntry = subtitleChunks?.length > 0
      ? objects.get(SUBTITLE_ID)
      : null;

    if (subtitleEntry && subtitleChunks) {
      // Run timeline + subtitles IN PARALLEL — subtitles are an independent track
      const sceneDuration = computeTimelineDuration(manifest.timeline);
      yield* all(
        executeTimeline(manifest.timeline, objects, camera(), manifest.meta),
        runSubtitleTrack(subtitleEntry.refs.root, subtitleChunks, sceneDuration),
      );
    } else {
      // No subtitles — run timeline normally
      yield* executeTimeline(manifest.timeline, objects, camera(), manifest.meta);
    }

    previousContainer = container();
  }
}
