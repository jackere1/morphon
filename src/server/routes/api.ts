import {Router} from 'express';
import {randomUUID} from 'crypto';
import {existsSync, unlinkSync} from 'fs';
import {resolve} from 'path';
import PQueue from 'p-queue';
import {renderManifest, renderShow} from '../render-service.js';
import {generateShow} from '../ai-service.js';
import * as jobStorage from '../../backend/services/storage/jobStorage.js';
import type {Job} from '../../backend/services/storage/jobStorage.js';

const router = Router();

// Job queue — concurrency 1 because Revideo spawns Puppeteer per render
const queue = new PQueue({concurrency: 1});

// Auto-cleanup: remove finished jobs and files after configured retention period
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const VIDEO_RETENTION_DAYS = parseInt(process.env.VIDEO_RETENTION_DAYS || '7', 10);

setInterval(() => {
  const deleted = jobStorage.deleteOldJobs(VIDEO_RETENTION_DAYS);
  if (deleted > 0) {
    console.log(`[Cleanup] Deleted ${deleted} old job(s) from database`);
  }

  // Also delete orphaned video files
  const jobs = jobStorage.listJobs({status: 'done'});
  for (const job of jobs) {
    if (job.outputPath && existsSync(job.outputPath)) {
      const fileAge = Date.now() - job.createdAt;
      const maxAge = VIDEO_RETENTION_DAYS * 24 * 60 * 60 * 1000;
      if (fileAge > maxAge) {
        try {
          unlinkSync(job.outputPath);
          console.log(`[Cleanup] Deleted old video file: ${job.outputPath}`);
        } catch {}
      }
    }
  }
}, CLEANUP_INTERVAL_MS);

/**
 * POST /api/generate
 * Body: JSON { prompt: "..." }
 * Returns: { show: InlineShowManifest, warnings: string[] }
 */
router.post('/generate', async (req, res) => {
  const {prompt} = req.body || {};

  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    res.status(400).json({error: 'Missing "prompt" field in request body.'});
    return;
  }

  if (!process.env.GEMINI_API_KEY) {
    res.status(503).json({error: 'AI generation not available. GEMINI_API_KEY is not configured.'});
    return;
  }

  try {
    const result = await generateShow(prompt.trim());
    res.json({show: result.show, warnings: result.warnings});
  } catch (err: any) {
    console.error('[API] Generation failed:', err.message);
    res.status(500).json({error: `Generation failed: ${err.message}`});
  }
});

/**
 * POST /api/render-show
 * Body: JSON { show: InlineShowManifest, topic?: string }
 * Returns: { jobId, status }
 */
router.post('/render-show', (req, res) => {
  const {show, topic} = req.body || {};

  if (!show || !show.meta || !show.scenes || !Array.isArray(show.scenes)) {
    res.status(400).json({error: 'Invalid show manifest. Must have "show" with "meta" and "scenes".'});
    return;
  }

  if (show.scenes.length === 0) {
    res.status(400).json({error: 'Show must have at least one scene.'});
    return;
  }

  if (show.scenes.length > 15) {
    res.status(400).json({error: 'Too many scenes (max 15).'});
    return;
  }

  const jobId = randomUUID();
  const now = Date.now();

  // Create job in database
  const job = jobStorage.createJob({
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
    jobStorage.updateJob(jobId, {status: 'rendering'});

    try {
      const result = await renderShow(show, jobId, (percent) => {
        jobStorage.updateJob(jobId, {progress: Math.floor(percent)});
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

  res.json({jobId, status: 'queued', queueSize: queue.size});
});

/**
 * POST /api/render
 * Body: raw YAML text
 * Returns: { jobId, status }
 */
router.post('/render', (req, res) => {
  const yaml = req.body;

  if (!yaml || typeof yaml !== 'string' || yaml.trim().length === 0) {
    res.status(400).json({error: 'Request body must be YAML text'});
    return;
  }

  if (yaml.length > 1024 * 1024) {
    res.status(413).json({error: 'Manifest too large (max 1MB)'});
    return;
  }

  const jobId = randomUUID();
  const now = Date.now();

  // Create job in database (store YAML as manifest for legacy support)
  const job = jobStorage.createJob({
    id: jobId,
    status: 'queued',
    progress: 0,
    manifest: {yaml}, // Wrap YAML in object for storage
    createdAt: now,
    updatedAt: now,
  });

  // Add to render queue
  queue.add(async () => {
    jobStorage.updateJob(jobId, {status: 'rendering'});

    try {
      const result = await renderManifest(yaml, jobId, (percent) => {
        jobStorage.updateJob(jobId, {progress: Math.floor(percent)});
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

  res.json({jobId, status: 'queued', queueSize: queue.size});
});

/**
 * GET /api/status/:jobId
 * Returns: { status, progress, title?, error? }
 */
router.get('/status/:jobId', (req, res) => {
  const job = jobStorage.getJob(req.params.jobId);
  if (!job) {
    res.status(404).json({error: 'Job not found'});
    return;
  }

  res.json({
    status: job.status,
    progress: job.progress,
    title: job.title,
    error: job.error,
    queuePosition: job.status === 'queued' ? queue.size : undefined,
  });
});

/**
 * GET /api/download/:jobId
 * Serves the rendered MP4 file
 */
router.get('/download/:jobId', (req, res) => {
  const job = jobStorage.getJob(req.params.jobId);
  if (!job) {
    res.status(404).json({error: 'Job not found'});
    return;
  }

  if (job.status !== 'done' || !job.outputPath) {
    res.status(400).json({error: 'Video not ready yet', status: job.status});
    return;
  }

  const filePath = resolve(job.outputPath);
  if (!existsSync(filePath)) {
    res.status(404).json({error: 'Video file not found (may have been cleaned up)'});
    return;
  }

  res.download(filePath, `${job.title || 'animation'}.mp4`);
});

/**
 * GET /api/jobs
 * List all jobs with optional filtering
 * Query params: status, limit, offset
 */
router.get('/jobs', (req, res) => {
  const {status, limit, offset} = req.query;

  const jobs = jobStorage.listJobs({
    status: status as any,
    limit: limit ? parseInt(limit as string, 10) : undefined,
    offset: offset ? parseInt(offset as string, 10) : undefined,
  });

  res.json({jobs, count: jobs.length});
});

/**
 * GET /api/jobs/:jobId
 * Get detailed job information including manifest
 */
router.get('/jobs/:jobId', (req, res) => {
  const job = jobStorage.getJob(req.params.jobId);
  if (!job) {
    res.status(404).json({error: 'Job not found'});
    return;
  }

  res.json(job);
});

/**
 * DELETE /api/jobs/:jobId
 * Delete a job and its video file
 */
router.delete('/jobs/:jobId', (req, res) => {
  const job = jobStorage.getJob(req.params.jobId);
  if (!job) {
    res.status(404).json({error: 'Job not found'});
    return;
  }

  // Delete video file if exists
  if (job.outputPath && existsSync(job.outputPath)) {
    try {
      unlinkSync(job.outputPath);
    } catch (err: any) {
      console.error(`[API] Failed to delete video file: ${err.message}`);
    }
  }

  // Delete from database
  jobStorage.deleteJob(req.params.jobId);

  res.json({success: true});
});

export default router;
