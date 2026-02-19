import express from 'express';
import {resolve, dirname} from 'path';
import {fileURLToPath} from 'url';
import {mkdirSync, existsSync} from 'fs';
import apiRoutes from './routes/api.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || '3000', 10);

const app = express();

// Parse raw YAML text bodies
app.use('/api', express.text({type: '*/*', limit: '1mb'}));

// API routes
app.use('/api', apiRoutes);

// Serve frontend static files
app.use(express.static(resolve(__dirname, '../web')));

// Serve rendered videos
const outputDir = resolve(__dirname, '../../output');
if (!existsSync(outputDir)) mkdirSync(outputDir, {recursive: true});
app.use('/output', express.static(outputDir));

app.listen(PORT, () => {
  console.log(`\n🎬 CS Animation Platform`);
  console.log(`========================`);
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`API: POST /api/render, GET /api/status/:id, GET /api/download/:id\n`);
});
