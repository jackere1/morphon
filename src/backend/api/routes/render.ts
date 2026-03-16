import { Router } from 'express';
import { randomUUID } from 'crypto';
import { resolve } from 'path';
import { existsSync, renameSync, unlinkSync } from 'fs';
import PQueue from 'p-queue';
import { renderManifest, renderShow } from '../../services/render/render-service.js';
import { generatePerSceneNarration, mergeAudioWithVideo } from '../../services/ai/tts-service.js';
import { computeShowDurations, padSceneTimelines, injectSubtitles } from '../../services/render/duration-calculator.js';
import * as jobStorage from '../../services/storage/jobStorage.js';
import { validateRenderShowRequest, validateRenderRequest } from '../middleware/validation.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = Router();

// Job queue — concurrency 1 because Revideo spawns Puppeteer per render
const queue = new PQueue({ concurrency: 1 });

/**
 * POST /api/v1/render-show
 * Render a multi-scene show to MP4
 *
 * Request body:
 *   { show: InlineShowManifest, topic?: string, tts?: boolean }
 *
 * Response:
 *   { jobId: string, status: string, queueSize: number }
 */
router.post(
  '/show',
  validateRenderShowRequest,
  asyncHandler(async (req, res) => {
    const { show, topic, tts, subtitles } = req.body;

    const jobId = randomUUID();
    const now = Date.now();

    // Create job in database
    jobStorage.createJob({
      id: jobId,
      status: 'queued',
      progress: 0,
      topic: topic || undefined,
      manifest: show,
      createdAt: now,
      updatedAt: now,
    });

    // Add to render queue
    queue.add(async () => {
      jobStorage.updateJob(jobId, { status: 'rendering' });

      try {
        let ttsResult: Awaited<ReturnType<typeof generatePerSceneNarration>> = null;

        // ── TTS-first pipeline: generate audio BEFORE rendering ──
        // This lets us pad the video timelines so video >= audio duration
        if (tts) {
          // Step 0: Inject subtitles if requested (extends video with narration text on screen)
          if (subtitles !== false) {
            const subCount = injectSubtitles(show);
            if (subCount > 0) {
              console.log(`[Sync] Injected subtitles into ${subCount} scene(s)`);
            }
          }

          // Step 1: Compute per-scene video durations from manifest (after subtitles)
          const { sceneDurations } = computeShowDurations(show);
          console.log(`[Sync] Scene video durations: [${sceneDurations.map(d => d.toFixed(1) + 's').join(', ')}]`);
          jobStorage.updateJob(jobId, { progress: 2, title: 'Computing durations...' });

          // Step 2: Generate per-scene TTS audio
          const narrations = show.scenes.map((s: any) => s.narration || '');
          const hasAnyNarration = narrations.some((n: string) => n.trim().length > 0);

          if (hasAnyNarration) {
            ttsResult = await generatePerSceneNarration(narrations, jobId, (scene, total) => {
              const ttsProgress = 5 + Math.floor((scene / total) * 20);
              jobStorage.updateJob(jobId, {
                progress: ttsProgress,
                title: `Narrating scene ${scene}/${total}...`,
              });
            });

            // Step 3: Pad scene timelines where audio exceeds video
            if (ttsResult) {
              console.log(`[Sync] Audio durations: [${ttsResult.sceneAudioDurations.map(d => d.toFixed(1) + 's').join(', ')}]`);
              const paddedCount = padSceneTimelines(show, sceneDurations, ttsResult.sceneAudioDurations);
              if (paddedCount > 0) {
                console.log(`[Sync] Padded ${paddedCount} scene(s) to match audio`);
              }
            }
          }
        }

        // Step 4: Render video (with padded timelines if TTS was used)
        jobStorage.updateJob(jobId, { progress: tts ? 25 : 0, title: 'Rendering video...' });
        const result = await renderShow(show, jobId, (percent) => {
          const scaled = tts
            ? 25 + Math.floor(percent * 0.65)  // 25-90% for video when TTS
            : Math.floor(percent);              // 0-100% for video without TTS
          jobStorage.updateJob(jobId, { progress: scaled });
        });

        // Step 5: Merge audio with video
        if (tts && ttsResult) {
          jobStorage.updateJob(jobId, { progress: 90, title: 'Merging audio...' });

          const silentVideo = resolve(result.outputPath);
          const finalVideo = resolve(`output/${jobId}-final.mp4`);

          mergeAudioWithVideo(silentVideo, ttsResult.combinedAudioPath, finalVideo);

          // Replace silent video with merged version
          unlinkSync(silentVideo);
          renameSync(finalVideo, silentVideo);

          // Clean up narration WAV
          try { unlinkSync(ttsResult.combinedAudioPath); } catch {}

          console.log(`[Sync] Final video rendered with synced narration`);
        }

        jobStorage.updateJob(jobId, {
          status: 'done',
          progress: 100,
          title: result.title,
          outputPath: result.outputPath,
          completedAt: Date.now(),
        });
      } catch (err: any) {
        jobStorage.updateJob(jobId, {
          status: 'error',
          error: err.message || 'Render failed',
          completedAt: Date.now(),
        });
      }
    });

    res.json({
      jobId,
      status: 'queued',
      queueSize: queue.size,
      timestamp: new Date().toISOString(),
    });
  })
);

/**
 * POST /api/v1/render
 * Render a single-scene YAML manifest to MP4
 *
 * Request body: raw YAML text
 *
 * Response:
 *   { jobId: string, status: string, queueSize: number }
 */
router.post(
  '/',
  validateRenderRequest,
  asyncHandler(async (req, res) => {
    const yaml = req.body;

    const jobId = randomUUID();
    const now = Date.now();

    // Create job in database (store YAML as manifest for legacy support)
    jobStorage.createJob({
      id: jobId,
      status: 'queued',
      progress: 0,
      manifest: { yaml }, // Wrap YAML in object for storage
      createdAt: now,
      updatedAt: now,
    });

    // Add to render queue
    queue.add(async () => {
      jobStorage.updateJob(jobId, { status: 'rendering' });

      try {
        const result = await renderManifest(yaml, jobId, (percent) => {
          jobStorage.updateJob(jobId, { progress: Math.floor(percent) });
        });

        jobStorage.updateJob(jobId, {
          status: 'done',
          progress: 100,
          title: result.title,
          outputPath: result.outputPath,
          completedAt: Date.now(),
        });
      } catch (err: any) {
        jobStorage.updateJob(jobId, {
          status: 'error',
          error: err.message || 'Render failed',
          completedAt: Date.now(),
        });
      }
    });

    res.json({
      jobId,
      status: 'queued',
      queueSize: queue.size,
      timestamp: new Date().toISOString(),
    });
  })
);

export default router;
