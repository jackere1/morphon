# CS Animation Platform

## Vision
Text-to-animation platform for CS education. Markdown in → animated video out.
Like 3Blue1Brown but for CS concepts with a completely different authoring UX.

## Architecture
```
Markdown → AI Extraction → Animation Manifest (JSON/YAML) → Render Engine → Video
```

## Current Phase: Phase 1 - Foundation Scripts (Node.js)
No backend yet. Just CLI scripts to validate the pipeline.

## Progress Tracker

### Phase 1: Manifest & Renderer Foundation
- [x] Design manifest spec (start with BFS traversal)
- [x] Build manifest parser/validator
- [x] Build basic renderer (Canvas frames → PNG)
- [x] End-to-end test: hardcoded manifest → 455 frames rendered

### Phase 2: More CS Concepts
- [ ] Binary tree insertion manifest
- [ ] Sorting algorithm manifest (bubble/merge)
- [ ] Stack/Queue operations manifest
- [ ] Expand manifest vocabulary based on learnings

### Phase 3: AI Extraction Layer
- [ ] Markdown → manifest prompt engineering
- [ ] Anthropic API integration
- [ ] Validation of AI-generated manifests

### Phase 4: Video Pipeline
- [ ] Motion Canvas or Remotion integration
- [ ] Frame composition and timing
- [ ] Video export (MP4, silent)

### Phase 5: Web Platform
- [ ] Web UI for markdown input
- [ ] Preview/edit manifest
- [ ] Render and download

## Key Decisions
- **Renderer**: Motion Canvas (primary candidate) - TypeScript, timeline-based
- **Why not Manim**: Python dependency too heavy, math-focused not CS-focused
- **Manifest is source of truth**: AI assists but humans can review/edit
- **Start narrow**: CS education only (graphs, trees, sorting, algorithms)

## Tech Stack
- Node.js scripts (current phase)
- Motion Canvas / Remotion (renderer - future)
- Anthropic API (AI extraction - future)
- YAML/JSON for manifests

## File Structure
```
src/
  manifest/       # Manifest spec, parser, validator
  renderer/       # Render engine (SVG → frames → video)
  examples/       # Sample manifests for CS concepts
  ai/             # AI extraction layer (future)
```
