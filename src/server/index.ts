import 'dotenv/config';
import express from 'express';
import {resolve, dirname} from 'path';
import {fileURLToPath} from 'url';
import {mkdirSync, existsSync} from 'fs';
import {initDatabase} from '../backend/database/client.js';
import {CONFIG, validateConfig} from '../backend/config/index.js';

// API routes
import apiV1Routes from '../backend/api/index.js';
import legacyApiRoutes from './routes/api-legacy.js';
import { errorHandler, notFoundHandler } from '../backend/api/middleware/errorHandler.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Validate configuration
validateConfig();

// Initialize database
initDatabase(CONFIG.DATABASE_PATH);

const app = express();

// Global body parsers for all API routes
app.use('/api', express.json({limit: '2mb'}));

// Text parser specifically for YAML render endpoints
app.use('/api/v1/render', express.text({type: 'text/plain', limit: '1mb'}));
app.use('/api/render', express.text({type: 'text/plain', limit: '1mb'}));

// Mount API routes (BEFORE static file serving)
app.use('/api/v1', apiV1Routes);        // New versioned API
app.use('/api', legacyApiRoutes);       // Backward compatibility layer

// Serve frontend static files
app.use(express.static(resolve(__dirname, '../web')));
app.use('/frontend', express.static(resolve(__dirname, '../frontend')));

// Serve rendered videos
const outputDir = resolve(__dirname, '../../output');
if (!existsSync(outputDir)) mkdirSync(outputDir, {recursive: true});
app.use('/output', express.static(outputDir));

// Error handling (must be last)
app.use(notFoundHandler);
app.use(errorHandler);

app.listen(CONFIG.PORT, () => {
  const hasGemini = !!CONFIG.GEMINI_API_KEY;
  console.log(`\n🎬 CS Animation Platform v2.0`);
  console.log(`==============================`);
  console.log(`Server running at http://localhost:${CONFIG.PORT}`);
  console.log(`AI generation: ${hasGemini ? 'enabled' : 'DISABLED (set GEMINI_API_KEY)'}`);
  console.log(`Database: ${CONFIG.DATABASE_PATH}`);
  console.log(`Video retention: ${CONFIG.VIDEO_RETENTION_DAYS} days`);
  console.log(`\nAPI v1 Routes:`);
  console.log(`  POST   /api/v1/generate        — AI prompt → show manifest`);
  console.log(`  POST   /api/v1/render/show     — Multi-scene show → MP4`);
  console.log(`  POST   /api/v1/render          — Single-scene YAML → MP4`);
  console.log(`  GET    /api/v1/jobs            — List all jobs (paginated)`);
  console.log(`  GET    /api/v1/jobs/:id        — Get job details`);
  console.log(`  GET    /api/v1/jobs/:id/status — Check render progress`);
  console.log(`  DELETE /api/v1/jobs/:id        — Delete job`);
  console.log(`  GET    /api/v1/download/:id    — Download rendered MP4`);
  console.log(`\nLegacy Routes (redirect to v1):`);
  console.log(`  /api/generate, /api/render-show, /api/render, /api/status/:id, /api/download/:id`);
  console.log(``);
});
