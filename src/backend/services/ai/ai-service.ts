import {GoogleGenAI} from '@google/genai';
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

  const ai = new GoogleGenAI({apiKey});

  const prompt = getSystemPrompt() + '\n\n## USER REQUEST\n\n' + userPrompt;

  console.log(`[AI] Generating show for prompt: "${userPrompt.slice(0, 100)}..."`);
  const startTime = Date.now();

  const result = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      temperature: 0.7,
      maxOutputTokens: 331072,
    },
  });

  const text = result.text ?? '';

  console.log(`[AI] Response received in ${((Date.now() - startTime) / 1000).toFixed(1)}s (${text.length} chars)`);

  let parsed: any;
  let wasTruncated = false;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    console.error(`[AI] Invalid JSON — last 300 chars: ...${text.slice(-300)}`);
    // Try to repair truncated JSON (model ran out of tokens mid-output)
    const repaired = repairTruncatedJson(text);
    if (repaired) {
      console.warn(`[AI] JSON was truncated and repaired — some scenes/actions may be missing`);
      wasTruncated = true;
      parsed = repaired;
    } else {
      console.error(`[AI] JSON repair failed (first 500 chars): ${text.slice(0, 500)}`);
      throw new Error('AI returned invalid JSON that could not be repaired. Try a simpler prompt or try again.');
    }
  }

  // Handle both {show: ...} and direct show object
  const show = parsed.show || parsed;

  // Validate structure, normalize fields, fix palette refs
  const warnings = validateShow(show);
  normalizeShow(show, warnings);

  if (wasTruncated) {
    warnings.unshift('Output was truncated by AI model — some scenes or actions may be missing. Try a simpler prompt or retry.');
  }

  // Count total actions and estimate duration
  const stats = countShowActions(show);
  console.log(`[AI] Generated show: ${stats.sceneCount} scenes, ${stats.totalActions} total actions, estimated ~${stats.estimatedMinutes.toFixed(1)} minutes`);

  if (stats.totalActions < 200) {
    warnings.push(`Low action count (${stats.totalActions}) — video may be shorter than expected. Target is 250-500+ actions.`);
  }

  return {show: show as InlineShowManifest, warnings};
}

/**
 * Count total actions across all scenes and estimate video duration.
 */
function countShowActions(show: any): {sceneCount: number; totalActions: number; estimatedMinutes: number} {
  let totalActions = 0;
  let estimatedSeconds = 0;
  const scenes = show.scenes || [];

  for (const scene of scenes) {
    const timeline = scene.manifest?.timeline || [];
    for (const entry of timeline) {
      if (entry.parallel && Array.isArray(entry.parallel)) {
        totalActions += entry.parallel.length;
        // Parallel block duration = max of its actions (estimate ~0.5s)
        estimatedSeconds += 0.5;
      } else if (entry.action) {
        totalActions++;
        // Parse duration or use defaults
        const dur = entry.duration;
        if (typeof dur === 'string') {
          const match = dur.match(/^([\d.]+)\s*(s|ms)$/);
          if (match) {
            estimatedSeconds += match[2] === 'ms' ? parseFloat(match[1]) / 1000 : parseFloat(match[1]);
          } else {
            estimatedSeconds += 1;
          }
        } else if (typeof dur === 'number') {
          estimatedSeconds += dur;
        } else {
          estimatedSeconds += 0.5;
        }
      }
    }
  }

  return {sceneCount: scenes.length, totalActions, estimatedMinutes: estimatedSeconds / 60};
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

/**
 * Attempt to repair truncated JSON from the AI model.
 * The model sometimes runs out of tokens mid-output, leaving unclosed
 * brackets/braces. This function tries to close them.
 */
function repairTruncatedJson(text: string): any | null {
  // Strip trailing whitespace
  let json = text.trimEnd();

  // If it ends with a comma, remove it
  if (json.endsWith(',')) {
    json = json.slice(0, -1);
  }

  // Try progressively more aggressive truncation + closing
  // Strategy: find the last valid array/object boundary, truncate there, close brackets
  for (let trimAmount = 0; trimAmount < 500; trimAmount += 10) {
    let attempt = trimAmount > 0 ? json.slice(0, -trimAmount) : json;

    // Remove trailing comma if present
    attempt = attempt.replace(/,\s*$/, '');

    // Count unclosed brackets/braces
    const closers = getClosingBrackets(attempt);
    attempt += closers;

    try {
      return JSON.parse(attempt);
    } catch {
      // Try next trim amount
    }
  }

  return null;
}

/**
 * Analyze a partial JSON string and return the closing brackets/braces needed.
 */
function getClosingBrackets(text: string): string {
  const stack: string[] = [];
  let inString = false;
  let escape = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (escape) {
      escape = false;
      continue;
    }

    if (ch === '\\' && inString) {
      escape = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (ch === '{') stack.push('}');
    else if (ch === '[') stack.push(']');
    else if (ch === '}' || ch === ']') {
      if (stack.length > 0 && stack[stack.length - 1] === ch) {
        stack.pop();
      }
    }
  }

  // If we're still inside a string, close it first
  let closers = '';
  if (inString) closers += '"';

  // Close all unclosed brackets in reverse order
  closers += stack.reverse().join('');
  return closers;
}
