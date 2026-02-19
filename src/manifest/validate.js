import { readFileSync } from 'fs';
import YAML from 'yaml';
import { OBJECT_TYPES, ACTION_TYPES, VALID_EASINGS, parseDuration } from './schema.js';

export function validateManifest(manifest) {
  const errors = [];
  const warnings = [];
  const objectIds = new Set();
  const palette = manifest.meta?.palette || {};

  // Validate meta
  if (!manifest.meta) {
    errors.push('Missing required field: meta');
  } else {
    if (!manifest.meta.title) errors.push('meta.title is required');
    if (!manifest.meta.canvas) errors.push('meta.canvas is required');
    if (manifest.meta.canvas) {
      if (!manifest.meta.canvas.width) errors.push('meta.canvas.width is required');
      if (!manifest.meta.canvas.height) errors.push('meta.canvas.height is required');
    }

    // v2: validate easing default
    if (manifest.meta.easing && !VALID_EASINGS.includes(manifest.meta.easing)) {
      warnings.push(`meta.easing "${manifest.meta.easing}" is not a known easing function`);
    }

    // v2: validate defaults structure
    if (manifest.meta.defaults && typeof manifest.meta.defaults !== 'object') {
      errors.push('meta.defaults must be an object');
    }

    // v2: validate palette
    if (manifest.meta.palette) {
      if (typeof manifest.meta.palette !== 'object') {
        errors.push('meta.palette must be an object');
      }
    }
  }

  // Validate objects
  if (!manifest.objects || !Array.isArray(manifest.objects)) {
    errors.push('Missing required field: objects (must be an array)');
  } else {
    for (const obj of manifest.objects) {
      if (!obj.id) {
        errors.push('Object missing required field: id');
        continue;
      }
      if (objectIds.has(obj.id)) {
        errors.push(`Duplicate object id: "${obj.id}"`);
      }
      objectIds.add(obj.id);

      if (!obj.type) {
        errors.push(`Object "${obj.id}" missing required field: type`);
        continue;
      }

      const schema = OBJECT_TYPES[obj.type];
      if (!schema) {
        warnings.push(`Object "${obj.id}" has unknown type: "${obj.type}"`);
        continue;
      }

      for (const field of schema.required) {
        if (obj[field] === undefined) {
          errors.push(`Object "${obj.id}" (type: ${obj.type}) missing required field: ${field}`);
        }
      }

      if (obj.type === 'graph') {
        validateGraph(obj, errors, warnings);
      }
      if (obj.type === 'data-structure' && schema.variants) {
        if (!schema.variants.includes(obj.variant)) {
          errors.push(`Object "${obj.id}" has invalid variant: "${obj.variant}". Valid: ${schema.variants.join(', ')}`);
        }
      }
    }
  }

  // Validate timeline
  if (!manifest.timeline || !Array.isArray(manifest.timeline)) {
    errors.push('Missing required field: timeline (must be an array)');
  } else {
    let totalDuration = 0;
    for (let i = 0; i < manifest.timeline.length; i++) {
      const step = manifest.timeline[i];
      const prefix = `timeline[${i}]`;

      // v2: handle parallel blocks
      if (step.parallel) {
        if (!Array.isArray(step.parallel)) {
          errors.push(`${prefix}.parallel must be an array`);
          continue;
        }
        let maxDur = 0;
        for (let j = 0; j < step.parallel.length; j++) {
          const dur = validateAction(
            step.parallel[j],
            `${prefix}.parallel[${j}]`,
            objectIds,
            palette,
            errors,
            warnings,
          );
          if (dur > maxDur) maxDur = dur;
        }
        totalDuration += maxDur;
        continue;
      }

      // Regular sequential action
      const dur = validateAction(step, prefix, objectIds, palette, errors, warnings);
      totalDuration += dur;
    }

    if (totalDuration > 0) {
      console.log(`  Estimated duration: ${totalDuration.toFixed(1)}s`);
    }
  }

  return { errors, warnings, objectIds: [...objectIds] };
}

function validateAction(step, prefix, objectIds, palette, errors, warnings) {
  if (!step.action) {
    errors.push(`${prefix} missing required field: action`);
    return 0;
  }

  const actionSchema = ACTION_TYPES[step.action];
  if (!actionSchema) {
    warnings.push(`${prefix} has unknown action: "${step.action}"`);
    return 0;
  }

  for (const field of actionSchema.required) {
    if (step[field] === undefined) {
      errors.push(`${prefix} (action: ${step.action}) missing required field: ${field}`);
    }
  }

  // Check target references valid object
  if (step.target && !objectIds.has(step.target)) {
    errors.push(`${prefix} references unknown object: "${step.target}"`);
  }

  // v2: validate palette references in color fields
  if (step.color && step.color.startsWith('$')) {
    const key = step.color.slice(1);
    if (!palette[key]) {
      errors.push(`${prefix} references unknown palette color: "${step.color}"`);
    }
  }

  // v2: validate easing
  if (step.easing && !VALID_EASINGS.includes(step.easing)) {
    warnings.push(`${prefix} has unknown easing: "${step.easing}"`);
  }

  // Validate duration
  let dur = 0;
  if (step.duration !== undefined) {
    const parsed = parseDuration(step.duration);
    if (parsed === null) {
      errors.push(`${prefix} has invalid duration: "${step.duration}"`);
    } else {
      dur = parsed;
    }
  }

  return dur;
}

function validateGraph(obj, errors, warnings) {
  if (!Array.isArray(obj.nodes)) return;
  const nodeIds = new Set(obj.nodes.map((n) => n.id));

  if (Array.isArray(obj.edges)) {
    for (const edge of obj.edges) {
      if (!nodeIds.has(edge.from)) {
        errors.push(`Graph "${obj.id}" edge references unknown node: "${edge.from}"`);
      }
      if (!nodeIds.has(edge.to)) {
        errors.push(`Graph "${obj.id}" edge references unknown node: "${edge.to}"`);
      }
    }
  }
}

// CLI entry point
const file = process.argv[2];
if (file) {
  console.log(`\nValidating: ${file}\n`);
  try {
    const raw = readFileSync(file, 'utf-8');
    const manifest = YAML.parse(raw);
    const { errors, warnings, objectIds } = validateManifest(manifest);

    if (warnings.length > 0) {
      console.log('Warnings:');
      warnings.forEach((w) => console.log(`  ⚠ ${w}`));
      console.log();
    }

    if (errors.length > 0) {
      console.log('Errors:');
      errors.forEach((e) => console.log(`  ✗ ${e}`));
      console.log(`\n✗ Validation failed with ${errors.length} error(s)\n`);
      process.exit(1);
    } else {
      console.log(`  Objects: ${objectIds.join(', ')}`);
      console.log(`\n✓ Manifest is valid!\n`);
    }
  } catch (e) {
    console.error(`Failed to parse manifest: ${e.message}`);
    process.exit(1);
  }
}
