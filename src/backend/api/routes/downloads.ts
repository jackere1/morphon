import { Router } from 'express';
import { resolve } from 'path';
import { existsSync } from 'fs';
import * as jobStorage from '../../services/storage/jobStorage.js';
import { validateJobId } from '../middleware/validation.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';

const router = Router();

/**
 * GET /api/v1/download/:jobId
 * Download the rendered MP4 file for a completed job
 *
 * Response:
 *   Binary MP4 file download
 */
router.get(
  '/:jobId',
  validateJobId,
  asyncHandler(async (req, res) => {
    const job = jobStorage.getJob(req.params.jobId);

    if (!job) {
      throw new AppError(404, 'Job not found', `No job found with ID: ${req.params.jobId}`);
    }

    if (job.status !== 'done' || !job.outputPath) {
      throw new AppError(
        400,
        'Video not ready',
        `Job status is "${job.status}". Video is only available when status is "done".`
      );
    }

    const filePath = resolve(job.outputPath);

    if (!existsSync(filePath)) {
      throw new AppError(
        404,
        'Video file not found',
        'The video file may have been cleaned up due to retention policy. Try re-rendering.'
      );
    }

    // Set appropriate headers
    const filename = `${job.title || 'animation'}.mp4`.replace(/[^a-z0-9.-]/gi, '_');
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // Stream the file
    res.download(filePath, filename);
  })
);

export default router;
