import { Router } from 'express';
import * as jobStorage from '../../services/storage/jobStorage.js';
import { validateJobId } from '../middleware/validation.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';

const router = Router();

/**
 * GET /api/v1/jobs
 * List all jobs with optional filtering and pagination
 *
 * Query params:
 *   - status: filter by job status (queued, rendering, done, error)
 *   - limit: max number of results (default: 50)
 *   - offset: skip first N results (default: 0)
 *
 * Response:
 *   { jobs: Job[], count: number, total: number }
 */
router.get(
  '/',
  (req, res, next) => {
    console.log('[Jobs Route] GET / handler called');
    next();
  },
  asyncHandler(async (req, res) => {
    console.log('[Jobs Route] asyncHandler executing');

    const { status, limit, offset } = req.query;

    const limitNum = limit ? parseInt(limit as string, 10) : 50;
    const offsetNum = offset ? parseInt(offset as string, 10) : 0;

    // Validate pagination params
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      throw new AppError(400, 'Invalid limit parameter (must be 1-100)');
    }

    if (isNaN(offsetNum) || offsetNum < 0) {
      throw new AppError(400, 'Invalid offset parameter (must be >= 0)');
    }

    const jobs = jobStorage.listJobs({
      status: status as any,
      limit: limitNum,
      offset: offsetNum,
    });

    const total = jobStorage.countJobs(status as any);

    res.json({
      jobs,
      count: jobs.length,
      total,
      limit: limitNum,
      offset: offsetNum,
      timestamp: new Date().toISOString(),
    });
  })
);

/**
 * GET /api/v1/jobs/:jobId
 * Get detailed information about a specific job
 *
 * Response:
 *   Job (includes manifest, timestamps, etc.)
 */
router.get(
  '/:jobId',
  validateJobId,
  asyncHandler(async (req, res) => {
    const job = jobStorage.getJob(req.params.jobId);

    if (!job) {
      throw new AppError(404, 'Job not found', `No job found with ID: ${req.params.jobId}`);
    }

    res.json(job);
  })
);

/**
 * GET /api/v1/jobs/:jobId/status
 * Get just the status of a job (lightweight endpoint for polling)
 *
 * Response:
 *   { status, progress, title?, error? }
 */
router.get(
  '/:jobId/status',
  validateJobId,
  asyncHandler(async (req, res) => {
    const job = jobStorage.getJob(req.params.jobId);

    if (!job) {
      throw new AppError(404, 'Job not found', `No job found with ID: ${req.params.jobId}`);
    }

    res.json({
      id: job.id,
      status: job.status,
      progress: job.progress,
      title: job.title,
      error: job.error,
      timestamp: new Date().toISOString(),
    });
  })
);

/**
 * DELETE /api/v1/jobs/:jobId
 * Delete a job and its associated video file
 *
 * Response:
 *   { success: true, deletedVideoFile: boolean }
 */
router.delete(
  '/:jobId',
  validateJobId,
  asyncHandler(async (req, res) => {
    const job = jobStorage.getJob(req.params.jobId);

    if (!job) {
      throw new AppError(404, 'Job not found', `No job found with ID: ${req.params.jobId}`);
    }

    // Delete video file if exists
    let deletedVideoFile = false;
    if (job.outputPath) {
      const { existsSync, unlinkSync } = await import('fs');
      if (existsSync(job.outputPath)) {
        try {
          unlinkSync(job.outputPath);
          deletedVideoFile = true;
        } catch (err: any) {
          console.error(`[API] Failed to delete video file: ${err.message}`);
        }
      }
    }

    // Delete from database
    jobStorage.deleteJob(req.params.jobId);

    res.json({
      success: true,
      deletedVideoFile,
      timestamp: new Date().toISOString(),
    });
  })
);

export default router;
