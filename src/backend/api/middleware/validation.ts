import type { Request, Response, NextFunction } from 'express';

/**
 * Validation middleware for request body schemas
 */

export function validateGenerateRequest(req: Request, res: Response, next: NextFunction): void {
  const { prompt } = req.body || {};

  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    res.status(400).json({
      error: 'Validation failed',
      details: [{ field: 'prompt', message: 'Missing or invalid "prompt" field in request body' }]
    });
    return;
  }

  if (prompt.length > 5000) {
    res.status(400).json({
      error: 'Validation failed',
      details: [{ field: 'prompt', message: 'Prompt too long (max 5000 characters)' }]
    });
    return;
  }

  next();
}

export function validateRenderShowRequest(req: Request, res: Response, next: NextFunction): void {
  const { show } = req.body || {};

  if (!show || !show.meta || !show.scenes || !Array.isArray(show.scenes)) {
    res.status(400).json({
      error: 'Validation failed',
      details: [{ field: 'show', message: 'Invalid show manifest. Must have "show" with "meta" and "scenes"' }]
    });
    return;
  }

  if (show.scenes.length === 0) {
    res.status(400).json({
      error: 'Validation failed',
      details: [{ field: 'show.scenes', message: 'Show must have at least one scene' }]
    });
    return;
  }

  if (show.scenes.length > 15) {
    res.status(400).json({
      error: 'Validation failed',
      details: [{ field: 'show.scenes', message: 'Too many scenes (max 15)' }]
    });
    return;
  }

  next();
}

export function validateRenderRequest(req: Request, res: Response, next: NextFunction): void {
  const yaml = req.body;

  if (!yaml || typeof yaml !== 'string' || yaml.trim().length === 0) {
    res.status(400).json({
      error: 'Validation failed',
      details: [{ field: 'body', message: 'Request body must be YAML text' }]
    });
    return;
  }

  if (yaml.length > 1024 * 1024) {
    res.status(413).json({
      error: 'Validation failed',
      details: [{ field: 'body', message: 'Manifest too large (max 1MB)' }]
    });
    return;
  }

  next();
}

export function validateJobId(req: Request, res: Response, next: NextFunction): void {
  const { jobId } = req.params;

  if (!jobId || typeof jobId !== 'string') {
    res.status(400).json({
      error: 'Validation failed',
      details: [{ field: 'jobId', message: 'Missing or invalid job ID' }]
    });
    return;
  }

  // Basic UUID validation
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(jobId)) {
    res.status(400).json({
      error: 'Validation failed',
      details: [{ field: 'jobId', message: 'Invalid job ID format (must be UUID)' }]
    });
    return;
  }

  next();
}
