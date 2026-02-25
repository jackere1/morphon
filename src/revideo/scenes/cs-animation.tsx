import {makeScene2D, Node} from '@revideo/2d';
import {all, useScene, waitFor, createRef} from '@revideo/core';
import type {Manifest, ActionStep, ResolvedShow} from '../types';
import {isParallelBlock} from '../types';
import {createSceneObjects} from '../objects';
import {executeAction} from '../actions';
import {executeTransition} from '../actions/transition';

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

    // Execute this scene's timeline — camera ops target the camera node
    yield* executeTimeline(manifest.timeline, objects, camera(), manifest.meta);

    previousContainer = container();
  }
}
