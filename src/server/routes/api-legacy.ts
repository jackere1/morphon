/**
 * Legacy API routes (backward compatibility)
 * Redirects old /api/* endpoints to /api/v1/*
 *
 * This file maintains backward compatibility with the original API structure
 * while the new versioned API is in /api/v1/
 */

import { Router, Request, Response } from 'express';

const router = Router();

/**
 * Redirect legacy endpoints to v1
 * All old routes are preserved for backward compatibility
 */

// POST /api/generate → /api/v1/generate
router.post('/generate', (req: Request, res: Response) => {
  req.url = '/api/v1/generate';
  req.app.handle(req, res);
});

// POST /api/render-show → /api/v1/render/show
router.post('/render-show', (req: Request, res: Response) => {
  req.url = '/api/v1/render/show';
  req.app.handle(req, res);
});

// POST /api/render → /api/v1/render
router.post('/render', (req: Request, res: Response) => {
  req.url = '/api/v1/render';
  req.app.handle(req, res);
});

// GET /api/status/:jobId → /api/v1/jobs/:jobId/status
router.get('/status/:jobId', (req: Request, res: Response) => {
  req.url = `/api/v1/jobs/${req.params.jobId}/status`;
  req.app.handle(req, res);
});

// GET /api/download/:jobId → /api/v1/download/:jobId
router.get('/download/:jobId', (req: Request, res: Response) => {
  req.url = `/api/v1/download/${req.params.jobId}`;
  req.app.handle(req, res);
});

// GET /api/jobs → /api/v1/jobs (new endpoint, no legacy equivalent)
router.get('/jobs', (req: Request, res: Response) => {
  req.url = '/api/v1/jobs';
  req.app.handle(req, res);
});

// GET /api/jobs/:jobId → /api/v1/jobs/:jobId (new endpoint)
router.get('/jobs/:jobId', (req: Request, res: Response) => {
  req.url = `/api/v1/jobs/${req.params.jobId}`;
  req.app.handle(req, res);
});

// DELETE /api/jobs/:jobId → /api/v1/jobs/:jobId (new endpoint)
router.delete('/jobs/:jobId', (req: Request, res: Response) => {
  req.url = `/api/v1/jobs/${req.params.jobId}`;
  req.app.handle(req, res);
});

export default router;
