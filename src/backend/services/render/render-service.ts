import {renderVideo} from '@revideo/renderer';
import YAML from 'yaml';
import type {Manifest, ShowManifest, ResolvedShow, ResolvedScene, TransitionConfig, InlineShowManifest} from '../../../revideo/types.js';
import {isShowManifest} from '../../../revideo/types.js';
import {resolvePalette} from '../../../revideo/utils/palette.js';
import {validateManifest} from '../../../manifest/validate.js';

export interface RenderResult {
  outputPath: string;
  title: string;
  topic: string;
}

/**
 * Renders a single-scene YAML manifest string to an MP4 file.
 * Returns the path to the rendered video.
 */
export async function renderManifest(
  yamlString: string,
  jobId: string,
  onProgress?: (percent: number) => void,
): Promise<RenderResult> {
  const parsed = YAML.parse(yamlString);

  if (isShowManifest(parsed)) {
    throw new Error(
      'Multi-scene show manifests are not supported via web UI. ' +
      'Use single-scene manifests or the CLI for shows.',
    );
  }

  const manifest = parsed as Manifest;

  if (!manifest.meta || !manifest.objects || !manifest.timeline) {
    throw new Error('Invalid manifest: must have meta, objects, and timeline fields.');
  }

  resolvePalette(manifest);

  // Validate manifest before rendering — catch errors early
  const {errors} = validateManifest(manifest);
  if (errors.length > 0) {
    throw new Error(`Manifest validation failed:\n${errors.join('\n')}`);
  }

  const variableData = JSON.stringify({type: 'single', manifest});
  const topic = manifest.meta.topic || jobId;
  const outFile = `output/${jobId}.mp4` as `${string}.mp4`;

  const outputPath = await renderVideo({
    projectFile: './src/revideo/project.ts',
    variables: {
      manifest: variableData,
    },
    settings: {
      outFile,
      outDir: '.',
      logProgress: true,
      workers: 1,
      puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      },
      progressCallback: (_worker: number, progress: number) => {
        onProgress?.(Math.round(progress * 100));
      },
    },
  });

  return {
    outputPath,
    title: manifest.meta.title || 'Untitled',
    topic,
  };
}

/**
 * Renders an inline multi-scene show to an MP4 file.
 * Scenes are embedded as objects (no file references).
 */
export async function renderShow(
  inlineShow: InlineShowManifest,
  jobId: string,
  onProgress?: (percent: number) => void,
): Promise<RenderResult> {
  if (!inlineShow.meta || !inlineShow.scenes || inlineShow.scenes.length === 0) {
    throw new Error('Invalid show: must have meta and at least one scene.');
  }

  const resolved: ResolvedShow = {
    meta: inlineShow.meta,
    scenes: [],
  };

  for (const scene of inlineShow.scenes) {
    const m = scene.manifest;

    // Inherit meta from show → scene (same logic as CLI render.ts)
    m.meta.canvas = m.meta.canvas || inlineShow.meta.canvas;
    m.meta.palette = {...inlineShow.meta.palette, ...m.meta.palette};
    m.meta.defaults = {...inlineShow.meta.defaults, ...m.meta.defaults};
    m.meta.easing = m.meta.easing || inlineShow.meta.easing;

    resolvePalette(m);

    // Validate each scene manifest — catch errors before they crash Revideo
    const {errors} = validateManifest(m);
    if (errors.length > 0) {
      const sceneName = scene.name || `Scene ${resolved.scenes.length + 1}`;
      throw new Error(`${sceneName} validation failed:\n${errors.join('\n')}`);
    }

    const transition =
      scene.transition === 'none' || !scene.transition
        ? undefined
        : (scene.transition as TransitionConfig);

    resolved.scenes.push({manifest: m, transition});
  }

  const variableData = JSON.stringify({type: 'show', show: resolved});
  const topic = inlineShow.meta.topic || jobId;
  const outFile = `output/${jobId}.mp4` as `${string}.mp4`;

  const outputPath = await renderVideo({
    projectFile: './src/revideo/project.ts',
    variables: {manifest: variableData},
    settings: {
      outFile,
      outDir: '.',
      logProgress: true,
      workers: 1,
      puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      },
      progressCallback: (_worker: number, progress: number) => {
        onProgress?.(Math.round(progress * 100));
      },
    },
  });

  return {
    outputPath,
    title: inlineShow.meta.title || 'Untitled',
    topic,
  };
}
