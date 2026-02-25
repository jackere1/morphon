import { Router } from 'express';
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

    res.json({
      show: result.show,
      warnings: result.warnings,
      timestamp: new Date().toISOString(),
    });
  })
);

export default router;
