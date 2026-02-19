import {readFileSync} from 'fs';
import {dirname, resolve} from 'path';
import {renderVideo} from '@revideo/renderer';
import YAML from 'yaml';
import type {Manifest, ShowManifest, ResolvedShow, TransitionConfig} from './types';
import {isShowManifest} from './types';
import {resolvePalette} from './utils/palette';

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.log('Usage: npx vite-node src/revideo/render.ts <manifest.yaml>');
    console.log('  Accepts single scene manifests or multi-scene show manifests.');
    process.exit(1);
  }

  console.log('\n🎬 CS Animation Renderer (Revideo)');
  console.log('====================================\n');

  // 1. Read and parse YAML
  const raw = readFileSync(file, 'utf-8');
  const parsed = YAML.parse(raw);

  let variableData: string;
  let topic: string;

  if (isShowManifest(parsed)) {
    // ── Multi-scene show ──
    const show = parsed as ShowManifest;
    const baseDir = dirname(file);
    console.log(`Show: ${show.meta.title}`);
    console.log(`Scenes: ${show.scenes.length}`);

    const resolved: ResolvedShow = {
      meta: show.meta,
      scenes: [],
    };

    for (const scene of show.scenes) {
      const scenePath = resolve(baseDir, scene.file);
      const sceneRaw = readFileSync(scenePath, 'utf-8');
      const sceneManifest: Manifest = YAML.parse(sceneRaw);

      // Inherit meta from show if scene doesn't define it
      sceneManifest.meta.canvas = sceneManifest.meta.canvas || show.meta.canvas;
      sceneManifest.meta.palette = {
        ...show.meta.palette,
        ...sceneManifest.meta.palette,
      };
      sceneManifest.meta.defaults = {
        ...show.meta.defaults,
        ...sceneManifest.meta.defaults,
      };
      sceneManifest.meta.easing = sceneManifest.meta.easing || show.meta.easing;

      // Resolve palette in each scene
      resolvePalette(sceneManifest);

      const transition: TransitionConfig | undefined =
        scene.transition === 'none' || !scene.transition
          ? undefined
          : scene.transition;

      resolved.scenes.push({manifest: sceneManifest, transition});
      console.log(
        `  - ${scene.file} (${sceneManifest.objects.length} objects, ${sceneManifest.timeline.length} steps)` +
          (transition ? ` [${transition.type}]` : ''),
      );
    }

    variableData = JSON.stringify({type: 'show', show: resolved});
    topic = show.meta.topic || 'show';
  } else {
    // ── Single scene manifest ──
    const manifest = parsed as Manifest;
    console.log(`Title: ${manifest.meta.title}`);
    console.log(`Canvas: ${manifest.meta.canvas.width}x${manifest.meta.canvas.height}`);
    console.log(`Objects: ${manifest.objects.map((o) => o.id).join(', ')}`);
    console.log(`Timeline steps: ${manifest.timeline.length}`);

    resolvePalette(manifest);
    variableData = JSON.stringify({type: 'single', manifest});
    topic = manifest.meta.topic || 'video';
  }

  // 2. Render via Revideo
  const outFile = `output/${topic}.mp4` as `${string}.mp4`;
  console.log(`\nRendering to ${outFile}...`);

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

  console.log(`\n✓ Video rendered: ${outputPath}\n`);
}

main().catch((err) => {
  console.error('Render failed:', err);
  process.exit(1);
});
