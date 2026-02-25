import { Router } from 'express';
import { randomUUID } from 'crypto';
import PQueue from 'p-queue';
import { renderManifest, renderShow } from '../../services/render/render-service.js';
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
 *   { show: InlineShowManifest, topic?: string }
 *
 * Response:
 *   { jobId: string, status: string, queueSize: number }
 */
router.post(
  '/show',
  validateRenderShowRequest,
  asyncHandler(async (req, res) => {
    const { show, topic } = req.body;

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
        const result = await renderShow(show, jobId, (percent) => {
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
