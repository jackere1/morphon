import {Router} from 'express';
import {randomUUID} from 'crypto';
import {existsSync, unlinkSync} from 'fs';
import {resolve} from 'path';
import PQueue from 'p-queue';
import {renderManifest} from '../render-service.js';

const router = Router();

// Job queue — concurrency 1 because Revideo spawns Puppeteer per render
const queue = new PQueue({concurrency: 1});

// In-memory job tracking
interface Job {
  id: string;
  status: 'queued' | 'rendering' | 'done' | 'error';
  progress: number;
  title?: string;
  outputPath?: string;
  error?: string;
  createdAt: number;
}

const jobs = new Map<string, Job>();

// Auto-cleanup: remove finished jobs and files after 10 minutes
setInterval(() => {
  const cutoff = Date.now() - 10 * 60 * 1000;
  for (const [id, job] of jobs) {
    if (job.createdAt < cutoff && (job.status === 'done' || job.status === 'error')) {
      if (job.outputPath && existsSync(job.outputPath)) {
        try { unlinkSync(job.outputPath); } catch {}
      }
      jobs.delete(id);
    }
  }
}, 60 * 1000);

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
  const job: Job = {
    id: jobId,
    status: 'queued',
    progress: 0,
    createdAt: Date.now(),
  };
  jobs.set(jobId, job);

  // Queue the render
  queue.add(async () => {
    job.status = 'rendering';
    try {
      const result = await renderManifest(yaml, jobId);
      job.status = 'done';
      job.progress = 100;
      job.title = result.title;
      job.outputPath = result.outputPath;
    } catch (err: any) {
      job.status = 'error';
      job.error = err.message || 'Render failed';
    }
  });

  res.json({jobId, status: 'queued', queueSize: queue.size});
});

/**
 * GET /api/status/:jobId
 * Returns: { status, progress, title?, error? }
 */
router.get('/status/:jobId', (req, res) => {
  const job = jobs.get(req.params.jobId);
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
  const job = jobs.get(req.params.jobId);
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

export default router;
