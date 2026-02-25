import {GoogleGenerativeAI} from '@google/generative-ai';
import type {InlineShowManifest} from '../../../revideo/types.js';
import {buildSystemPrompt} from './ai-prompt.js';
import {normalizeShow} from './normalize.js';

let systemPrompt: string | null = null;

function getSystemPrompt(): string {
  if (!systemPrompt) {
    systemPrompt = buildSystemPrompt();
  }
  return systemPrompt;
}

export interface GenerateResult {
  show: InlineShowManifest;
  warnings: string[];
}

/**
 * Generates a multi-scene show manifest from a user prompt using Gemini.
 */
export async function generateShow(userPrompt: string): Promise<GenerateResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not set.');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-3-flash-preview',
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.7,
      maxOutputTokens: 131072,
    },
  });

  const prompt = getSystemPrompt() + '\n\n## USER REQUEST\n\n' + userPrompt;

  console.log(`[AI] Generating show for prompt: "${userPrompt.slice(0, 100)}..."`);
  const startTime = Date.now();

  const result = await model.generateContent(prompt);
  const text = result.response.text();

  console.log(`[AI] Response received in ${((Date.now() - startTime) / 1000).toFixed(1)}s (${text.length} chars)`);

  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    console.error(`[AI] Invalid JSON response (first 500 chars): ${text.slice(0, 500)}`);
    throw new Error('AI returned invalid JSON. Please try again.');
  }

  // Handle both {show: ...} and direct show object
  const show = parsed.show || parsed;

  // Validate structure, normalize fields, fix palette refs
  const warnings = validateShow(show);
  normalizeShow(show, warnings);

  return {show: show as InlineShowManifest, warnings};
}

/**
 * Basic validation of the generated show structure.
 * Returns warnings but does not throw — let the user see and fix issues.
 */
function validateShow(show: any): string[] {
  const warnings: string[] = [];

  if (!show.meta) {
    warnings.push('Show is missing "meta" field.');
  }

  if (!show.scenes || !Array.isArray(show.scenes) || show.scenes.length === 0) {
    warnings.push('Show has no scenes.');
    return warnings;
  }

  for (let i = 0; i < show.scenes.length; i++) {
    const scene = show.scenes[i];
    const name = scene.name || `Scene ${i + 1}`;

    if (!scene.manifest) {
      warnings.push(`${name}: missing "manifest" field.`);
      continue;
    }

    const m = scene.manifest;

    if (!m.meta) {
      warnings.push(`${name}: manifest missing "meta".`);
    }

    if (!m.objects || !Array.isArray(m.objects)) {
      warnings.push(`${name}: manifest missing "objects" array.`);
    }

    if (!m.timeline || !Array.isArray(m.timeline)) {
      warnings.push(`${name}: manifest missing "timeline" array.`);
    }

    // Ensure canvas exists in each scene
    if (m.meta && !m.meta.canvas) {
      m.meta.canvas = show.meta?.canvas || {width: 1920, height: 1080, background: '#0f0f23'};
    }

    // Validate object IDs and check timeline targets
    if (m.objects && m.timeline) {
      const objectIds = new Set(m.objects.map((o: any) => o.id));

      const checkAction = (action: any, label: string) => {
        if (action.target && !objectIds.has(action.target)) {
          warnings.push(`${name}: ${label} targets "${action.target}" which doesn't exist in objects.`);
        }
      };

      for (let j = 0; j < m.timeline.length; j++) {
        const entry = m.timeline[j];
        if (entry.parallel && Array.isArray(entry.parallel)) {
          for (const a of entry.parallel) {
            checkAction(a, `parallel action`);
          }
        } else if (entry.action) {
          checkAction(entry, `action "${entry.action}"`);
        }
      }
    }
  }

  return warnings;
}

