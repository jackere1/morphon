import { Router } from 'express';
import { writeFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import { generateShow } from '../../services/ai/ai-service.js';
import { validateGenerateRequest } from '../middleware/validation.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';

const router = Router();

/**
 * POST /api/v1/generate
 * Generate a show manifest from a text prompt using AI
 *
 * Request body:
 *   { prompt: string }
 *
 * Response:
 *   { show: InlineShowManifest, warnings: string[] }
 */
router.post(
  '/',
  validateGenerateRequest,
  asyncHandler(async (req, res) => {
    const { prompt } = req.body;

    // Check if AI service is available
    if (!process.env.GEMINI_API_KEY) {
      throw new AppError(
        503,
        'AI generation service unavailable',
        'GEMINI_API_KEY is not configured. Please set it in the .env file.'
      );
    }

    // Generate show using AI
    const result = await generateShow(prompt.trim());

    // Save debug dump to filesystem for debugging
    try {
      const debugDir = resolve('output', 'debug-manifests');
      mkdirSync(debugDir, { recursive: true });
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const debugPath = resolve(debugDir, `${timestamp}.json`);
      writeFileSync(debugPath, JSON.stringify({ prompt: prompt.trim(), show: result.show, warnings: result.warnings }, null, 2));
      console.log(`[Debug] Manifest saved → ${debugPath}`);
    } catch (e) {
      // Don't fail the request if debug dump fails
      console.warn(`[Debug] Failed to save manifest dump:`, e);
    }

    res.json({
      show: result.show,
      warnings: result.warnings,
      timestamp: new Date().toISOString(),
    });
  })
);

export default router;
