import { Router } from 'express';
import generateRoutes from './routes/generate.js';
import renderRoutes from './routes/render.js';
import jobsRoutes from './routes/jobs.js';
import downloadsRoutes from './routes/downloads.js';

const router = Router();

console.log('[API v1] Mounting routes...');
console.log('  generateRoutes:', typeof generateRoutes, generateRoutes?.name);
console.log('  renderRoutes:', typeof renderRoutes, renderRoutes?.name);
console.log('  jobsRoutes:', typeof jobsRoutes, jobsRoutes?.name);
console.log('  downloadsRoutes:', typeof downloadsRoutes, downloadsRoutes?.name);

/**
 * API v1 Routes
 * Modular route structure with proper separation of concerns
 */

// AI generation
router.use('/generate', generateRoutes);

// Rendering
router.use('/render', renderRoutes);

// Job management
router.use('/jobs', jobsRoutes);

// Downloads
router.use('/download', downloadsRoutes);

console.log('[API v1] Routes mounted successfully');

export default router;
