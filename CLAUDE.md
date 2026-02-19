# CS Animation Platform

## Vision
Text-to-animation platform for CS education. Markdown in → animated video out.
Like 3Blue1Brown but for CS concepts with a completely different authoring UX.

## Architecture
```
Markdown → AI Extraction → Animation Manifest (YAML) → Revideo Renderer → MP4 Video
```

## Current Phase: Phase 2 - More CS Concepts
Multi-scene shows with transitions working. MANUAL.md written. Next: more CS concept manifests.

## Progress Tracker

### Phase 1: Manifest & Renderer Foundation
- [x] Design manifest spec (start with BFS traversal)
- [x] Build manifest parser/validator
- [x] Build basic renderer (Canvas frames → PNG) — removed, replaced by Revideo
- [x] End-to-end test: hardcoded manifest → 455 frames rendered

### Phase 1.5: Revideo Integration + Manifest v2
- [x] Research Motion Canvas → discovered Revideo (headless fork)
- [x] Design manifest v2 (parallel blocks, palette refs, easing, defaults)
- [x] Build Revideo scene generator (manifest → Revideo nodes + animations)
- [x] Build object builders (graph, data-structure, text)
- [x] Build action executors (fade, highlight, enqueue/dequeue, text, movement, camera, set-style)
- [x] End-to-end: BFS v2 manifest → MP4 video via Revideo
- [x] Multi-scene show manifests with transitions (fade, crossfade, slide-left, slide-right)
- [x] BFS course example (4 scenes with transitions)
- [x] MANUAL.md user documentation

### Phase 2: More CS Concepts
- [ ] Binary tree insertion manifest
- [ ] Sorting algorithm manifest (bubble/merge)
- [ ] Stack/Queue operations manifest
- [ ] Expand manifest vocabulary based on learnings

### Phase 3: AI Extraction Layer
- [ ] Markdown → manifest prompt engineering
- [ ] Anthropic API integration
- [ ] Validation of AI-generated manifests

### Phase 4: Video Pipeline Enhancements
- [ ] Audio/voiceover sync
- [ ] Code block animations

### Phase 5: Web Platform
- [ ] Web UI for markdown input
- [ ] Preview/edit manifest
- [ ] Render and download

## Key Decisions
- **Renderer**: Revideo (Motion Canvas fork) — headless rendering, MP4 output, TypeScript
- **Why Revideo over Motion Canvas**: headless renderVideo() API, no editor required
- **Why not Manim**: Python dependency too heavy, math-focused not CS-focused
- **Manifest is source of truth**: AI assists but humans can review/edit
- **Start narrow**: CS education only (graphs, trees, sorting, algorithms)
- **Manifest v2 features**: parallel blocks, $palette refs, easing per-action, style defaults
- **Multi-scene model**: show.yaml references scene files, meta inherited from show to scenes

## Tech Stack
- Node.js + TypeScript
- Revideo (@revideo/core, @revideo/2d, @revideo/renderer)
- Vite + vite-node
- YAML for manifests
- Anthropic API (AI extraction - future)

## CLI Commands
```bash
npm run validate <manifest.yaml>    # Validate a manifest
npm run render <manifest.yaml>      # Render single or multi-scene to MP4
npm run dev                         # Revideo editor (browser)
npm run demo                        # Render the BFS v2 demo
```

## File Structure
```
src/
  manifest/           # Manifest spec, parser, validator
    schema.js         # Object types, action types, easing list
    validate.js       # Validation logic (v1 + v2 compatible)
  revideo/            # Revideo render pipeline
    project.ts        # Revideo project entry
    render.ts         # CLI: YAML → renderVideo() → MP4 (single + show)
    types.ts          # TypeScript interfaces (Manifest, ShowManifest, etc.)
    scenes/
      cs-animation.tsx  # Core scene generator (single + multi-scene)
    objects/          # Manifest objects → Revideo nodes
      graph-builder.tsx
      data-structure-builder.tsx
      text-builder.tsx
      index.ts
    actions/          # Timeline actions → Revideo animations
      fade.ts, highlight.ts, data-ops.tsx
      text-ops.ts, movement.ts, camera.ts
      timing.ts, style.ts, transition.ts, index.ts
    utils/
      easing.ts, palette.ts, style-resolver.ts, duration.ts
  examples/           # Sample manifests
    bfs-traversal-v2.yaml             # Single-scene BFS video
    bfs-course/                       # Multi-scene course example
      show.yaml                       # Master show manifest
      scenes/intro.yaml
      scenes/walkthrough.yaml
      scenes/recap.yaml
      scenes/outro.yaml
```

## Manifest v2 Quick Reference
```yaml
meta:
  defaults:           # Style defaults per object type
  palette:            # Named colors ($visited → "#ff6b6b")
  easing: easeInOut   # Default easing for all animations

timeline:
  - action: fade-in   # Sequential action
    easing: easeOutCubic  # Per-action easing override

  - parallel:          # Actions run simultaneously
      - action: highlight-node
        color: $visited  # Palette reference
      - action: set-text
        value: "Step 1"
```

## Multi-Scene Show Format
```yaml
# show.yaml
meta: { ... }          # Shared meta (inherited by scenes)
scenes:
  - file: scenes/intro.yaml
    transition: none
  - file: scenes/lesson.yaml
    transition: { type: crossfade, duration: 1s }
```

See [MANUAL.md](MANUAL.md) for full documentation.
