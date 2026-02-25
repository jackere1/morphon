# CS Animation Platform — User Manual

## Quick Start

```bash
# Validate a manifest
npm run validate src/examples/bfs-traversal-v2.yaml

# Render a single-scene video
npm run render src/examples/bfs-traversal-v2.yaml

# Render a multi-scene course
npm run render src/examples/bfs-course/show.yaml

# Open the Revideo editor (browser preview)
npm run dev
```

Output MP4s are written to `output/<topic>.mp4`.

---

## 1. How It Works

A **manifest** is a YAML file that describes what to draw and how to animate it. The renderer reads the manifest and produces a video deterministically — same manifest always produces the same video.

```
Manifest (YAML) → Parser → Revideo Scene Graph → Renderer → MP4 Video
```

Every manifest has three sections:

```yaml
meta:       # Canvas size, colors, palette, style defaults, easing
objects:    # Things on screen — graphs, text, data structures
timeline:   # Ordered sequence of animation steps
```

The renderer processes the timeline **top to bottom**. Each action runs to completion before the next begins, unless actions are grouped in a `parallel` block (which runs them simultaneously).

---

## 2. Core Concepts

These are the foundational rules of the platform. Understanding them prevents the most common bugs.

### 2.1 Objects Start Invisible

**Every object is created with opacity 0.** Graphs, text, data structures — all of them. Nothing appears on screen until you explicitly use a `fade-in` action.

If you define an object but never fade it in, the viewer sees nothing. This is the single most common source of broken videos.

```yaml
# WRONG — graph is defined but never shown
objects:
  - id: graph
    type: graph
    nodes: [...]
    edges: [...]
timeline:
  - action: highlight-node    # Highlighting an invisible graph — viewer sees nothing
    target: graph
    node: A
    color: "#ff0000"
    duration: 0.5s
```

```yaml
# CORRECT — fade in first, then animate
timeline:
  - action: fade-in           # Now the graph becomes visible
    target: graph
    duration: 0.5s
  - action: highlight-node    # Viewer can see the highlight
    target: graph
    node: A
    color: "#ff0000"
    duration: 0.5s
```

The same applies to text. `set-text` changes the text content but does NOT make it visible. You must `fade-in` separately:

```yaml
# CORRECT pattern for text
- action: set-text        # Set content while still invisible (this is fine)
  target: title
  value: "Hello World"
- action: fade-in         # NOW the text appears
  target: title
  duration: 0.5s
```

### 2.2 Coordinate System

Positions use **absolute screen coordinates**. The origin `(0, 0)` is the **top-left** corner. On a 1920x1080 canvas:

```
(0, 0) ─────────────────────────── (1920, 0)
│                                           │
│              (960, 540)                   │
│               center                      │
│                                           │
(0, 1080) ──────────────────────── (1920, 1080)
```

All object positions (`x`, `y`) and graph node positions use this system. Internally, the renderer converts these to Revideo's centered coordinate system — you don't need to worry about that.

Spacing guidelines:
- Graph nodes: at least **150px** apart for readability
- Text labels: keep **60-80px** vertical spacing between lines
- Data structures: position near the bottom (y: 800-950) to leave room for graphs above

### 2.3 Style Inheritance

Styles resolve in three layers, from lowest to highest priority:

```
meta.defaults (global)  →  object.style (per-object)  →  action fields (per-action)
```

1. **`meta.defaults`** — Define base styles for each object type. Applied to all objects of that type.
2. **`object.style`** — Override specific properties on a single object.
3. **Action fields** — Runtime overrides (e.g., `color` in `highlight-node`).

```yaml
meta:
  defaults:
    graph:
      nodeRadius: 30          # All graphs get 30px radius
      nodeColor: "#4a4a6a"

objects:
  - id: my-graph
    type: graph
    style:
      nodeRadius: 40          # This graph gets 40px (overrides default)
    nodes: [...]
    edges: [...]

timeline:
  - action: highlight-node
    target: my-graph
    node: A
    color: "#ff0000"          # This node turns red (action override)
    duration: 0.5s
```

### 2.4 Palette System

Define named colors once in `meta.palette`, then reference them with `$name` in timeline actions:

```yaml
meta:
  palette:
    visited: "#ff6b6b"
    queued: "#ffd93d"
    active: "#6bff6b"

timeline:
  - action: highlight-node
    target: graph
    node: A
    color: $visited           # Resolves to "#ff6b6b"
    duration: 0.5s
```

Rules:
- Palette references (`$name`) are **only valid** in the `color` field of `highlight-node` and `highlight-edge` actions.
- Do NOT use `$name` in object `style` definitions — use raw hex colors there.
- An unresolved `$name` (one that doesn't exist in the palette) falls back to `#e74c3c` with a warning.

### 2.5 Timeline Execution Model

The timeline is a **sequential** list. Each entry runs to completion before the next starts.

```yaml
timeline:
  - action: fade-in           # Runs first
    target: title
    duration: 0.8s
  - action: pause             # Waits until fade-in completes, then pauses
    duration: 2s
  - action: fade-out          # Waits until pause completes, then fades out
    target: title
    duration: 0.5s
```

To run multiple actions at the same time, wrap them in a `parallel` block:

```yaml
  - parallel:
      - action: highlight-node
        target: graph
        node: A
        color: $visited
        duration: 0.5s
      - action: enqueue
        target: queue
        values: ["A"]
        duration: 0.5s
      - action: set-text
        target: step
        value: "Visit node A"
```

A `parallel` block completes when its **longest** action finishes. Then the next timeline entry begins.

### 2.6 Duration & Easing

**Duration** can be written three ways:

| Format | Example | Meaning |
|--------|---------|---------|
| Seconds (string) | `"0.5s"` | 0.5 seconds |
| Milliseconds (string) | `"500ms"` | 500 milliseconds |
| Seconds (number) | `0.5` | 0.5 seconds |

**Easing** controls the acceleration curve of an animation. Set a default for the whole manifest, or override per action:

```yaml
meta:
  easing: easeInOutCubic      # Default for all actions

timeline:
  - action: fade-in
    target: title
    duration: 0.8s
    easing: easeOutBack        # Override for this action
```

Available easings:

| Family | In | Out | InOut |
|--------|----|-----|-------|
| Sine | `easeInSine` | `easeOutSine` | `easeInOutSine` |
| Quad | `easeInQuad` | `easeOutQuad` | `easeInOutQuad` |
| Cubic | `easeInCubic` | `easeOutCubic` | `easeInOutCubic` |
| Quart | `easeInQuart` | `easeOutQuart` | `easeInOutQuart` |
| Expo | `easeInExpo` | `easeOutExpo` | `easeInOutExpo` |
| Back | `easeInBack` | `easeOutBack` | `easeInOutBack` |
| Bounce | `easeInBounce` | `easeOutBounce` | `easeInOutBounce` |
| Elastic | `easeInElastic` | `easeOutElastic` | `easeInOutElastic` |

Plus `linear` (no easing) and shorthand aliases `easeIn`, `easeOut`, `easeInOut` (which map to Quad).

### 2.7 Scene Isolation

In multi-scene shows, **each scene is completely independent**:
- Each scene has its own `objects` array — objects do NOT carry over between scenes.
- Object IDs can repeat across scenes (e.g., every scene can have a `title` text).
- Each scene starts fresh: all objects invisible, camera reset to default position/zoom.

---

## 3. Object Reference

### 3.1 Graph

A node-and-edge graph. Nodes render as circles with text labels. Edges render as lines between nodes.

```yaml
- id: my-graph
  type: graph
  nodes:
    - { id: A, label: A, x: 960, y: 300 }
    - { id: B, label: B, x: 760, y: 500 }
    - { id: C, label: C, x: 1160, y: 500 }
  edges:
    - { from: A, to: B }
    - { from: A, to: C }
  style:                       # Optional — overrides meta.defaults.graph
    nodeRadius: 35
```

**Node fields:**

| Field | Required | Description |
|-------|----------|-------------|
| `id` | Yes | Unique identifier (used in timeline actions) |
| `label` | No | Display text inside the circle (defaults to `id`) |
| `x` | Yes | Horizontal position (screen coordinates) |
| `y` | Yes | Vertical position (screen coordinates) |

**Edge fields:**

| Field | Required | Description |
|-------|----------|-------------|
| `from` | Yes | Source node ID |
| `to` | Yes | Target node ID |

Edge lookup key is `"from-to"` — when using `highlight-edge`, the `edge: [X, Y]` must match a defined edge direction.

**Style properties** (via `meta.defaults.graph` or `object.style`):

| Property | Default | Description |
|----------|---------|-------------|
| `nodeRadius` | `30` | Circle radius in pixels |
| `nodeColor` | `"#4a4a6a"` | Circle fill color |
| `nodeStroke` | `"#7c7caa"` | Circle border color |
| `edgeColor` | `"#3a3a5a"` | Line color |
| `edgeWidth` | `3` | Line width in pixels |
| `strokeWidth` | `3` | Circle border width |
| `labelColor` | `"#ffffff"` | Node label text color |
| `labelFont` | `"16px monospace"` | Node label font (CSS shorthand) |

### 3.2 Data Structure

Visual representation of queues, stacks, arrays, and linked lists. Starts empty — use `enqueue`/`push` actions to add elements.

```yaml
- id: my-queue
  type: data-structure
  variant: queue
  position: { x: 960, y: 800 }
  style:
    cellWidth: 70
```

**Fields:**

| Field | Required | Description |
|-------|----------|-------------|
| `id` | Yes | Unique identifier |
| `variant` | Yes | One of: `queue`, `stack`, `array`, `linked-list` |
| `position` | Yes | `{ x, y }` screen coordinates |
| `style` | No | Style overrides |

**Style properties** (via `meta.defaults.data-structure` or `object.style`):

| Property | Default | Description |
|----------|---------|-------------|
| `cellWidth` | `60` | Width of each cell |
| `cellHeight` | `40` | Height of each cell |
| `fillColor` | `"#2a2a4a"` | Cell background color |
| `borderColor` | `"#5a5a8a"` | Cell border color |
| `textColor` | `"#ffffff"` | Cell text color |
| `gap` | `4` | Spacing between cells |

### 3.3 Text

Labels, titles, descriptions — any text on screen.

```yaml
- id: title
  type: text
  content: ""                  # Start empty, populate with set-text
  position: { x: 960, y: 100 }
  style:
    font: "bold 42px sans-serif"
    align: center
    color: "#ffffff"
```

**Fields:**

| Field | Required | Description |
|-------|----------|-------------|
| `id` | Yes | Unique identifier |
| `content` | Yes | Initial text. Use `""` and set-text + fade-in to reveal. |
| `position` | Yes | `{ x, y }` screen coordinates |
| `style` | No | Style overrides |

**Style properties** (via `meta.defaults.text` or `object.style`):

| Property | Default | Description |
|----------|---------|-------------|
| `font` | `"20px sans-serif"` | CSS font shorthand (`"bold 24px monospace"`) |
| `color` | `"#ffffff"` | Text color |
| `align` | `"left"` | Text alignment: `left`, `center`, or `right` |

The `font` property uses CSS shorthand format: `[weight] <size>px <family>`. Examples:
- `"20px sans-serif"` — normal weight, 20px, sans-serif
- `"bold 36px sans-serif"` — bold, 36px, sans-serif
- `"24px monospace"` — normal weight, 24px, monospace

---

## 4. Action Reference

All 16 supported action types are listed below. Using an unsupported action type will produce a warning and be skipped.

### 4.1 Visibility

| Action | Required Fields | Optional Fields | Description |
|--------|----------------|-----------------|-------------|
| `fade-in` | `target`, `duration` | `easing` | Animate object from opacity 0 → 1 |
| `fade-out` | `target`, `duration` | `easing` | Animate object from opacity 1 → 0 |

### 4.2 Graph Actions

| Action | Required Fields | Optional Fields | Description |
|--------|----------------|-----------------|-------------|
| `highlight-node` | `target`, `node`, `color`, `duration` | `easing` | Change a node's fill + stroke color |
| `highlight-edge` | `target`, `edge`, `color`, `duration` | `easing` | Change an edge's stroke color |
| `move-node` | `target`, `node`, `position`, `duration` | `easing` | Move a graph node to `{x, y}` |

- `target` = the graph object's `id`
- `node` = the specific node's `id` within that graph
- `edge` = array `[from, to]` matching a defined edge direction

### 4.3 Data Structure Actions

| Action | Required Fields | Optional Fields | Description |
|--------|----------------|-----------------|-------------|
| `enqueue` | `target`, `values`, `duration` | `easing` | Add values to end of queue |
| `dequeue` | `target`, `duration` | `easing` | Remove first value from queue |
| `push` | `target`, `values`, `duration` | `easing` | Push values onto stack |
| `pop` | `target`, `duration` | `easing` | Pop top value from stack |

- `values` must be a **string array**: `["A", "B"]`

### 4.4 Text Actions

| Action | Required Fields | Optional Fields | Description |
|--------|----------------|-----------------|-------------|
| `set-text` | `target`, `value` | `duration`, `easing` | Replace text content. Instant by default. |

`set-text` does **not** change visibility. A text object must be faded in separately.

### 4.5 Movement

| Action | Required Fields | Optional Fields | Description |
|--------|----------------|-----------------|-------------|
| `move-to` | `target`, `position`, `duration` | `easing` | Move any object to `{x, y}` |

Position uses screen coordinates (same as object definitions).

### 4.6 Camera

| Action | Required Fields | Optional Fields | Description |
|--------|----------------|-----------------|-------------|
| `camera-zoom` | `scale`, `duration` | `easing` | Zoom camera (`1.0` = normal, `2.0` = 2x zoom in) |
| `camera-pan` | `position`, `duration` | `easing` | Pan camera to `{x, y}` |
| `camera-reset` | `duration` | `easing` | Reset zoom to 1.0 and position to center |

Camera actions affect **all objects** on screen. Pan positions use screen coordinates.

### 4.7 Style

| Action | Required Fields | Optional Fields | Description |
|--------|----------------|-----------------|-------------|
| `set-style` | `target`, `style`, `duration` | `node`, `easing` | Animate style properties |

Use `node` to target a specific graph node within a graph object. The `style` object can include any of the style properties for that object type.

### 4.8 Timing

| Action | Required Fields | Description |
|--------|----------------|-------------|
| `pause` | `duration` | Do nothing for the specified duration |

---

## 5. `meta` — Full Reference

```yaml
meta:
  title: "My Animation"
  topic: "my-topic"            # Used for output filename
  canvas:
    width: 1920
    height: 1080
    background: "#1a1a2e"
  defaults:
    graph:
      nodeRadius: 30
      nodeColor: "#4a4a6a"
      nodeStroke: "#7c7caa"
      edgeColor: "#3a3a5a"
      labelColor: "#ffffff"
      labelFont: "16px monospace"
    data-structure:
      cellWidth: 60
      cellHeight: 40
      fillColor: "#2a2a4a"
      borderColor: "#5a5a8a"
      textColor: "#ffffff"
    text:
      font: "20px sans-serif"
      color: "#e0e0ff"
  palette:
    visited: "#ff6b6b"
    queued: "#ffd93d"
    current: "#6bff6b"
  easing: easeInOutCubic
```

| Field | Required | Description |
|-------|----------|-------------|
| `title` | Yes | Human-readable title |
| `topic` | No | Used for output filename (`output/<topic>.mp4`) |
| `canvas` | Yes | `width`, `height`, `background` |
| `defaults` | No | Default styles per object type (`graph`, `data-structure`, `text`) |
| `palette` | No | Named colors for use in timeline actions with `$` prefix |
| `easing` | No | Default easing for all animations (default: `linear`) |

---

## 6. Multi-Scene Shows

For longer videos or courses, split content into multiple scenes. A **show manifest** orchestrates them.

### 6.1 Show Manifest

```yaml
meta:
  title: "My Course"
  topic: "my-course"
  canvas:
    width: 1920
    height: 1080
    background: "#1a1a2e"
  palette:
    highlight: "#ff6b6b"
  defaults:
    graph:
      nodeRadius: 30

scenes:
  - file: scenes/intro.yaml
    transition: none

  - file: scenes/lesson1.yaml
    transition:
      type: crossfade
      duration: 1s

  - file: scenes/recap.yaml
    transition:
      type: fade
      duration: 0.8s
```

### 6.2 Scene Inheritance

Each scene file is a regular manifest (`meta`, `objects`, `timeline`) that **inherits** from the show manifest:
- `palette` — merged (scene can add or override colors)
- `defaults` — merged (scene can override specific properties)
- `canvas` — scene must repeat the canvas (required field)
- `easing` — inherited if not specified

### 6.3 Transitions

Transitions animate the switch between scenes:

| Type | Effect |
|------|--------|
| `none` | Instant cut (no animation) |
| `fade` | Fade out old scene, then fade in new scene |
| `crossfade` | Old fades out while new fades in simultaneously |
| `slide-left` | New scene slides in from the right |
| `slide-right` | New scene slides in from the left |

The first scene's transition should always be `none`.

---

## 7. Common Patterns

### 7.1 Scene Setup (Explanation Scene)

Every explanation scene should start by fading in all its objects:

```yaml
objects:
  - id: graph
    type: graph
    nodes: [...]
    edges: [...]
  - id: step
    type: text
    content: ""
    position: { x: 960, y: 80 }
    style: { font: "bold 28px sans-serif", align: center }
  - id: queue
    type: data-structure
    variant: queue
    position: { x: 960, y: 900 }

timeline:
  # Step 0: Make everything visible
  - parallel:
      - action: fade-in
        target: graph
        duration: 0.5s
      - action: fade-in
        target: step
        duration: 0.5s
      - action: fade-in
        target: queue
        duration: 0.5s
  - action: pause
    duration: 1s

  # Step 1: Start animating
  - action: set-text
    target: step
    value: "Step 1: Visit node A"
  - action: highlight-node
    target: graph
    node: A
    color: "#ff6b6b"
    duration: 0.5s
  - action: pause
    duration: 3s
```

### 7.2 Text Reveal (Intro/Recap Scene)

For text-heavy scenes, set content then fade in one by one:

```yaml
objects:
  - id: title
    type: text
    content: ""
    position: { x: 960, y: 300 }
    style: { font: "bold 48px sans-serif", align: center }
  - id: subtitle
    type: text
    content: ""
    position: { x: 960, y: 400 }
    style: { font: "24px sans-serif", align: center, color: "#8a8abb" }

timeline:
  - action: set-text
    target: title
    value: "Breadth-First Search"
  - action: fade-in
    target: title
    duration: 0.8s
    easing: easeOutCubic
  - action: pause
    duration: 1s

  - action: set-text
    target: subtitle
    value: "A fundamental graph traversal algorithm"
  - action: fade-in
    target: subtitle
    duration: 0.6s
  - action: pause
    duration: 2s
```

### 7.3 Algorithm Step Pattern

Each step in an algorithm animation typically follows this pattern:

```yaml
  # 1. Label the step
  - action: set-text
    target: step
    value: "Dequeue C, visit neighbors"

  # 2. Highlight the active element
  - action: highlight-node
    target: graph
    node: C
    color: $active
    duration: 0.5s
  - action: pause
    duration: 1s

  # 3. Perform the operation (often in parallel)
  - parallel:
      - action: dequeue
        target: queue
        duration: 0.5s
      - action: highlight-edge
        target: graph
        edge: [C, D]
        color: $visited
        duration: 0.5s

  # 4. Pause for viewer comprehension
  - action: pause
    duration: 4s
```

### 7.4 Scene Cleanup

Fade out objects before a scene transition for a clean handoff:

```yaml
  # End of scene — fade everything out
  - parallel:
      - action: fade-out
        target: graph
        duration: 0.8s
      - action: fade-out
        target: step
        duration: 0.8s
      - action: fade-out
        target: queue
        duration: 0.8s
  - action: pause
    duration: 0.3s
```

---

## 8. File Layout

```
src/examples/
  bfs-traversal-v2.yaml           # Single-scene example
  bfs-course/
    show.yaml                     # Multi-scene show manifest
    scenes/
      intro.yaml
      walkthrough.yaml
      recap.yaml
      outro.yaml
```

---

## 9. Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| Black screen / nothing visible | Missing `fade-in` actions | Add `fade-in` for every object before using it |
| Text invisible after `set-text` | `set-text` doesn't change opacity | Add `fade-in` after `set-text` |
| `$colorName` not resolving | Missing from `meta.palette` | Add the color to `palette` or use raw hex |
| Graph node not highlighting | Wrong `target` (should be graph ID, not node ID) | Use `target: graph-id` + `node: node-id` |
| Edge not highlighting | `edge` direction doesn't match definition | `edge: [from, to]` must match the defined `from`→`to` direction |
| Objects from previous scene visible | Objects don't carry between scenes | Each scene defines its own objects |
| Camera stuck zoomed in | No `camera-reset` before scene end | Add `camera-reset` or rely on auto-reset between scenes |
