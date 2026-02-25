import {GoogleGenAI, Modality} from '@google/genai';
import {writeFileSync, mkdirSync, existsSync, unlinkSync} from 'fs';
import {resolve} from 'path';
import {execSync} from 'child_process';
import wavefile from 'wavefile';
const {WaveFile} = wavefile;

const TTS_MODEL = 'gemini-2.5-flash-preview-tts';
const VOICE_NAME = 'Charon'; // Informative and clear — good for CS education

// Use the ffmpeg/ffprobe bundled with @ffmpeg-installer (used by Revideo)
function findFfmpeg(): string {
  try {
    // Try the @ffmpeg-installer path first
    const installerPath = resolve('node_modules/@ffmpeg-installer/linux-x64/ffmpeg');
    if (existsSync(installerPath)) return installerPath;
  } catch {}
  // Fallback to system ffmpeg
  return 'ffmpeg';
}

function findFfprobe(): string {
  try {
    const installerPath = resolve('node_modules/@ffprobe-installer/linux-x64/ffprobe');
    if (existsSync(installerPath)) return installerPath;
  } catch {}
  return 'ffprobe';
}

const FFMPEG = findFfmpeg();
const FFPROBE = findFfprobe();

export interface TtsResult {
  audioPath: string; // Path to final WAV file
  durationSecs: number;
}

/**
 * Generate TTS audio for an array of narration texts (one per scene).
 * Uses a SINGLE API call with all narrations joined by pauses to ensure
 * consistent voice across the entire video (no voice drift between scenes).
 * Falls back to per-scene calls if the single call fails.
 */
export async function generateNarration(
  narrations: string[],
  jobId: string,
  onProgress?: (scene: number, total: number) => void,
): Promise<TtsResult | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not set.');
  }

  // Filter out empty narrations
  const validNarrations = narrations.filter(n => n && n.trim().length > 0);
  if (validNarrations.length === 0) {
    return null;
  }

  const ai = new GoogleGenAI({apiKey});
  const outputPath = resolve('output', `${jobId}-narration.wav`);

  // Try single-call approach first (consistent voice)
  const singleCallResult = await tryGenerateSingleCall(ai, narrations, outputPath, onProgress);
  if (singleCallResult) {
    return singleCallResult;
  }

  // Fallback: per-scene calls (may have voice drift)
  console.warn(`[TTS] Single-call failed, falling back to per-scene generation`);
  return generatePerScene(ai, narrations, jobId, outputPath, onProgress);
}

/**
 * Single API call approach: join all narrations with pause markers.
 * Produces consistent voice across the entire video.
 */
async function tryGenerateSingleCall(
  ai: GoogleGenAI,
  narrations: string[],
  outputPath: string,
  onProgress?: (scene: number, total: number) => void,
): Promise<TtsResult | null> {
  // Build combined text with natural pause markers between scenes
  const parts: string[] = [];
  for (let i = 0; i < narrations.length; i++) {
    const narration = narrations[i];
    if (narration && narration.trim().length > 0) {
      parts.push(narration.trim());
    }
  }

  if (parts.length === 0) return null;

  const combinedText = parts.join('\n\n...\n\n');
  console.log(`[TTS] Generating combined narration (${combinedText.length} chars, ${parts.length} sections)`);
  onProgress?.(1, 1);

  try {
    const response = await ai.models.generateContent({
      model: TTS_MODEL,
      contents: [{parts: [{text: combinedText}]}],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: VOICE_NAME,
            },
          },
        },
      },
    });

    const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!audioData) {
      console.warn(`[TTS] No audio data from single-call`);
      return null;
    }

    const pcmBuffer = Buffer.from(audioData, 'base64');
    pcmToWav(pcmBuffer, outputPath);
    const durationSecs = getAudioDuration(outputPath);
    console.log(`[TTS] Single-call narration: ${durationSecs.toFixed(1)}s (${(pcmBuffer.length / 1024).toFixed(0)} KB)`);

    return {audioPath: outputPath, durationSecs};
  } catch (err: any) {
    console.error(`[TTS] Single-call failed:`, err.message);
    return null;
  }
}

/**
 * Fallback: per-scene TTS generation (original approach).
 */
async function generatePerScene(
  ai: GoogleGenAI,
  narrations: string[],
  jobId: string,
  outputPath: string,
  onProgress?: (scene: number, total: number) => void,
): Promise<TtsResult | null> {
  const tmpDir = resolve('output', 'tts-tmp', jobId);
  mkdirSync(tmpDir, {recursive: true});

  const wavPaths: string[] = [];

  for (let i = 0; i < narrations.length; i++) {
    const narration = narrations[i];
    onProgress?.(i + 1, narrations.length);

    if (!narration || narration.trim().length === 0) {
      const silencePath = resolve(tmpDir, `scene-${i}-silence.wav`);
      generateSilenceWav(silencePath, 1.0);
      wavPaths.push(silencePath);
      continue;
    }

    console.log(`[TTS] Generating audio for scene ${i + 1}/${narrations.length} (${narration.length} chars)`);

    try {
      const response = await ai.models.generateContent({
        model: TTS_MODEL,
        contents: [{parts: [{text: narration}]}],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: VOICE_NAME,
              },
            },
          },
        },
      });

      const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!audioData) {
        console.warn(`[TTS] No audio data returned for scene ${i + 1}`);
        const silencePath = resolve(tmpDir, `scene-${i}-silence.wav`);
        generateSilenceWav(silencePath, 1.0);
        wavPaths.push(silencePath);
        continue;
      }

      const pcmBuffer = Buffer.from(audioData, 'base64');
      const wavPath = resolve(tmpDir, `scene-${i}.wav`);
      pcmToWav(pcmBuffer, wavPath);
      wavPaths.push(wavPath);

      console.log(`[TTS] Scene ${i + 1} audio saved (${(pcmBuffer.length / 1024).toFixed(0)} KB)`);
    } catch (err: any) {
      console.error(`[TTS] Failed to generate audio for scene ${i + 1}:`, err.message);
      const silencePath = resolve(tmpDir, `scene-${i}-silence.wav`);
      generateSilenceWav(silencePath, 1.0);
      wavPaths.push(silencePath);
    }
  }

  concatenateWavFiles(wavPaths, outputPath);
  const durationSecs = getAudioDuration(outputPath);

  for (const p of wavPaths) {
    try { unlinkSync(p); } catch {}
  }
  try { execSync(`rm -rf "${tmpDir}"`); } catch {}

  console.log(`[TTS] Final narration: ${durationSecs.toFixed(1)}s → ${outputPath}`);
  return {audioPath: outputPath, durationSecs};
}

/**
 * Merge an audio file with a video file using ffmpeg.
 * The audio is mixed as background narration.
 */
export function mergeAudioWithVideo(
  videoPath: string,
  audioPath: string,
  outputPath: string,
): void {
  // Use ffmpeg to merge: video stream from videoPath + audio from audioPath
  // -shortest: end when the shorter stream ends
  // If video is longer than audio, audio just stops
  // If audio is longer than video, truncate to video length
  const cmd = [
    `"${FFMPEG}"`, '-y',
    '-i', `"${videoPath}"`,
    '-i', `"${audioPath}"`,
    '-c:v', 'copy',
    '-c:a', 'aac',
    '-b:a', '192k',
    '-map', '0:v:0',
    '-map', '1:a:0',
    '-shortest',
    `"${outputPath}"`,
  ].join(' ');

  console.log(`[TTS] Merging audio with video...`);
  execSync(cmd, {stdio: 'pipe'});
  console.log(`[TTS] Merged → ${outputPath}`);
}

// ── Helpers ──────────────────────────────────────────────────────────

function pcmToWav(pcmBuffer: Buffer, outputPath: string): void {
  const samples = new Int16Array(
    pcmBuffer.buffer,
    pcmBuffer.byteOffset,
    pcmBuffer.length / Int16Array.BYTES_PER_ELEMENT,
  );
  const wav = new WaveFile();
  wav.fromScratch(1, 24000, '16', samples); // mono, 24kHz, 16-bit
  writeFileSync(outputPath, wav.toBuffer());
}

function generateSilenceWav(outputPath: string, durationSecs: number): void {
  const sampleRate = 24000;
  const numSamples = Math.floor(sampleRate * durationSecs);
  const samples = new Int16Array(numSamples); // All zeros = silence
  const wav = new WaveFile();
  wav.fromScratch(1, sampleRate, '16', samples);
  writeFileSync(outputPath, wav.toBuffer());
}

function concatenateWavFiles(wavPaths: string[], outputPath: string): void {
  if (wavPaths.length === 0) return;

  if (wavPaths.length === 1) {
    // Just copy the single file
    execSync(`cp "${wavPaths[0]}" "${outputPath}"`);
    return;
  }

  // Use ffmpeg concat filter to join WAV files
  const inputs = wavPaths.map(p => `-i "${p}"`).join(' ');
  const filterParts = wavPaths.map((_, i) => `[${i}:a]`).join('');
  const cmd = `"${FFMPEG}" -y ${inputs} -filter_complex "${filterParts}concat=n=${wavPaths.length}:v=0:a=1[out]" -map "[out]" "${outputPath}"`;

  execSync(cmd, {stdio: 'pipe'});
}

function getAudioDuration(filePath: string): number {
  try {
    const result = execSync(
      `"${FFPROBE}" -v error -show_entries format=duration -of csv=p=0 "${filePath}"`,
      {encoding: 'utf-8'},
    );
    return parseFloat(result.trim()) || 0;
  } catch {
    return 0;
  }
}
