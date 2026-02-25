# CS Animation Platform

## Vision
Text-to-animation platform for CS education. Markdown in → animated video out.
Like 3Blue1Brown but for CS concepts with a completely different authoring UX.

## Architecture
```
Markdown → AI Extraction → Animation Manifest (YAML) → Revideo Renderer → MP4 Video
```

## Current Phase: Phase 3 - Multi-Page Architecture + Neubrutalism UI
Backend restructured with SQLite persistence. Building multi-page frontend with bold Neubrutalism design.

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

### Phase 3: AI Extraction Layer (COMPLETE)
- [x] Gemini Flash 2.0 integration
- [x] Prompt engineering with MANUAL.md + examples
- [x] AI-generated manifest normalization
- [x] Web UI for AI generation

### Phase 4: Multi-Page Architecture (IN PROGRESS)
- [x] Phase 1: SQLite persistence (COMPLETE)
- [x] Phase 2: Backend API restructuring (90% - v1 routing issue)
- [x] Phase 3: Frontend routing (COMPLETE)
- [ ] Phase 4: Component extraction
- [ ] Phase 5: History page
- [ ] Phase 6: Templates & Settings

### Phase 5: Neubrutalism Design System (COMPLETE)
- [x] Bold, vibrant color palette (Pink, Cyan, Yellow)
- [x] Thick borders & hard shadows
- [x] Space Grotesk + Inter typography
- [x] Responsive grid layouts
- [x] Animated interactions
- [x] Accessible, high-contrast UI

## Key Decisions

### Technical
- **Renderer**: Revideo (Motion Canvas fork) — headless rendering, MP4 output, TypeScript
- **Why Revideo over Motion Canvas**: headless renderVideo() API, no editor required
- **Why not Manim**: Python dependency too heavy, math-focused not CS-focused
- **Database**: SQLite3 (zero config, file-based, sufficient for single instance)
- **AI Model**: Gemini Flash 2.0 (fast, cheap, good JSON structured output)
- **Frontend**: Vanilla JS + hash routing (no build step, fast dev iteration)

### Design
- **UI Style**: Neubrutalism (bold, playful, high-contrast, accessible)
- **Color Palette**: Hot Pink (#FF006E), Cyan (#00F5FF), Yellow (#FFBE0B)
- **Typography**: Space Grotesk (display), Inter (body), JetBrains Mono (code)
- **Shadows**: Hard, offset box-shadows (no soft shadows)
- **Borders**: Thick (3-4px), always black
- **Philosophy**: Brutalist simplicity meets vibrant energy

### Architecture
- **Manifest is source of truth**: AI assists but humans can review/edit YAML
- **Start narrow**: CS education only (graphs, trees, sorting, algorithms)
- **Manifest v2 features**: parallel blocks, $palette refs, easing per-action, style defaults
- **Multi-scene model**: show.yaml references scene files, meta inherited from show to scenes
- **Multi-page**: Hash routing (#/, #/templates, #/history, #/settings)

## Tech Stack

### Backend
- Node.js 24 + TypeScript + ESM
- Express.js (REST API)
- SQLite3 (via better-sqlite3) - Job persistence
- Revideo (@revideo/core, @revideo/2d, @revideo/renderer)
- Gemini Flash 2.0 (@google/generative-ai) - AI generation

### Frontend
- Vanilla JavaScript (ES modules)
- Hash-based client-side routing
- Neubrutalism design system
- js-yaml (YAML ↔ JSON)
- No build step (optional bundler later)

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

## Neubrutalism Design System

### Visual Language
The CS Animation Platform uses **Neubrutalism** — a bold, playful, high-contrast design system that makes CS education feel energetic and accessible.

### Color Palette
```css
--primary: #FF006E        /* Hot Pink - primary actions, emphasis */
--secondary: #00F5FF      /* Cyan - active states, highlights */
--accent: #FFBE0B         /* Yellow - CTAs, warnings */
--success: #06FFA5        /* Mint Green - success states */
--error: #FF006E          /* Hot Pink - errors (same as primary) */
--warning: #FB5607        /* Orange - warnings */
--black: #000000          /* Borders, text */
--white: #FFFFFF          /* Backgrounds, reverse text */
--gray-50: #F8F9FA        /* Page background */
```

### Design Principles

**1. BOLD BORDERS**
- All borders are 2-4px thick
- Always solid black (#000000)
- No subtle grays or thin 1px lines
```css
border: 3px solid #000000;
```

**2. HARD SHADOWS**
- Offset box-shadows (no blur)
- Creates depth without softness
```css
box-shadow: 4px 4px 0 #000000;  /* Medium shadow */
box-shadow: 6px 6px 0 #000000;  /* Large shadow */
```

**3. VIBRANT COLORS**
- Use saturated, bright colors
- High contrast for accessibility
- No pastels or muted tones

**4. CHUNKY TYPOGRAPHY**
- Display: Space Grotesk (800 weight)
- Body: Inter (400-700 weight)
- Code: JetBrains Mono (400-700 weight)
- Uppercase labels with letter-spacing

**5. MINIMAL RADIUS**
- Small border-radius (4-8px max)
- No fully rounded elements
```css
border-radius: 4px;  /* Small */
border-radius: 8px;  /* Medium */
```

**6. INTERACTIVE FEEDBACK**
- Buttons move on hover/active
- Transform + shadow shift creates tactile feel
```css
.btn:hover {
  transform: translate(2px, 2px);
  box-shadow: 2px 2px 0 #000000;
}
```

### Component Patterns

**Buttons:**
```html
<button class="btn btn-primary">
  <span>✨ ACTION TEXT</span>
</button>
```
- Always uppercase
- Include emoji for personality
- `btn-primary`, `btn-secondary`, `btn-accent`, `btn-outline`

**Cards:**
```html
<div class="card">
  <div class="card-header">
    <h3 class="card-title">TITLE</h3>
  </div>
  <div class="card-body">Content</div>
  <div class="card-footer">Actions</div>
</div>
```
- White background + black border + shadow
- Hover lifts slightly

**Badges:**
```html
<span class="badge badge-success">DONE</span>
```
- Mini versions of buttons
- Uppercase, small shadows

### Typography Scale
```
h1: 3rem (48px)     - Page titles
h2: 2.25rem (36px)  - Section headers
h3: 1.75rem (28px)  - Card titles
h4: 1.25rem (20px)  - Subsections
body: 1rem (16px)   - Base text
small: 0.875rem     - Meta text
```

### Spacing Scale
```
--space-1: 4px
--space-2: 8px
--space-3: 12px
--space-4: 16px
--space-6: 24px
--space-8: 32px
--space-12: 48px
--space-16: 64px
```

### DO's and DON'Ts

✅ **DO:**
- Use bright, saturated colors
- Add thick black borders to everything
- Include hard shadows for depth
- Make interactions feel tactile (transform on click)
- Use emojis for personality
- Keep animations snappy (100-200ms)

❌ **DON'T:**
- Use soft shadows or blurs
- Use thin 1px borders
- Use muted or pastel colors
- Make rounded circles (use minimal radius)
- Add gradients to UI elements (only backgrounds)
- Make slow, easing animations

### Accessibility
- All text meets WCAG AA contrast ratios
- Focus states have visible outlines
- Colors are not the only indicator of state
- Touch targets minimum 44x44px

### Example Components

**Primary CTA:**
```html
<button class="btn btn-primary btn-lg">
  🚀 RENDER VIDEO
</button>
```

**Status Badge:**
```html
<span class="badge badge-success">✅ DONE</span>
```

**Card with Action:**
```html
<div class="card">
  <div class="card-header">
    <h3>🎬 PROJECT TITLE</h3>
  </div>
  <div class="card-body">
    <p>Description of the project...</p>
  </div>
  <div class="card-footer">
    <button class="btn btn-primary btn-sm">LOAD</button>
    <button class="btn btn-outline btn-sm">DELETE</button>
  </div>
</div>
```

See `src/frontend/styles/neubrutalism.css` for the complete design system implementation.
