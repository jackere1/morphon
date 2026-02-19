import {renderVideo} from '@revideo/renderer';
import YAML from 'yaml';
import type {Manifest, ShowManifest, ResolvedShow, TransitionConfig} from '../revideo/types.js';
import {isShowManifest} from '../revideo/types.js';
import {resolvePalette} from '../revideo/utils/palette.js';

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
    },
  });

  return {
    outputPath,
    title: manifest.meta.title || 'Untitled',
    topic,
  };
}
