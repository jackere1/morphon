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

## Manifest Format (v2)

A manifest is a YAML file that describes **what to draw** (objects) and **what to animate** (timeline). The renderer reads the manifest and produces a video deterministically — same manifest always produces the same video.

### Structure

```yaml
meta:       # Canvas size, colors, defaults
objects:    # Things on screen (graphs, text, queues)
timeline:   # Sequence of animation steps
```

---

## `meta` — Global Settings

```yaml
meta:
  title: "My Animation"
  topic: "my-topic"         # Used for output filename
  canvas:
    width: 1920
    height: 1080
    background: "#1a1a2e"
  defaults:                  # Default styles per object type
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
  palette:                   # Named colors, referenced with $
    visited: "#ff6b6b"
    queued: "#ffd93d"
    current: "#6bff6b"
  easing: easeInOutCubic     # Default easing for all animations
```

### Palette References

Define colors once in `meta.palette`, then reference them with `$name`:

```yaml
palette:
  visited: "#ff6b6b"

# In timeline:
- action: highlight-node
  color: $visited         # Resolves to "#ff6b6b"
```

### Coordinate System

Positions in the manifest use **absolute screen coordinates** where `(0, 0)` is the top-left corner. The center of a 1920x1080 canvas is `(960, 540)`.

---

## `objects` — Scene Objects

### Graph

A node-and-edge graph. Nodes are circles, edges are lines.

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
  style:                    # Overrides meta.defaults.graph
    nodeRadius: 35
```

### Data Structure

Visualizations of queues, stacks, arrays, and linked lists.

```yaml
- id: my-queue
  type: data-structure
  variant: queue            # queue | stack | array | linked-list
  position: { x: 960, y: 800 }
  style:
    cellWidth: 70
```

### Text

Labels, titles, descriptions — any text on screen.

```yaml
- id: title
  type: text
  content: "Hello World"    # Initial text (can be empty "")
  position: { x: 960, y: 100 }
  style:
    font: "bold 42px sans-serif"
    align: center           # center | left | right
    color: "#ffffff"
```

---

## `timeline` — Animation Steps

The timeline is a **sequential** list of actions. Each action runs to completion before the next one starts, unless grouped in a `parallel` block.

### Sequential Execution

```yaml
timeline:
  - action: fade-in
    target: title
    duration: 0.8s

  - action: pause
    duration: 1s

  - action: fade-out
    target: title
    duration: 0.5s
```

### Parallel Execution

Use `parallel:` to run multiple actions at the same time:

```yaml
  - parallel:
      - action: highlight-node
        target: graph
        node: A
        color: $visited
        duration: 0.5s
      - action: highlight-node
        target: graph
        node: B
        color: $queued
        duration: 0.5s
      - action: fade-in
        target: label
        duration: 0.5s
```

All actions inside a `parallel` block start simultaneously. The block completes when the longest action finishes.

---

## Action Reference

### Visibility

| Action | Fields | Description |
|--------|--------|-------------|
| `fade-in` | `target`, `duration` | Fade object from transparent to visible |
| `fade-out` | `target`, `duration` | Fade object from visible to transparent |

### Graph Actions

| Action | Fields | Description |
|--------|--------|-------------|
| `highlight-node` | `target`, `node`, `color`, `duration` | Change a graph node's fill color |
| `highlight-edge` | `target`, `edge: [from, to]`, `color`, `duration` | Change an edge's color |
| `move-node` | `target`, `node`, `position: {x, y}`, `duration` | Move a graph node to a new position |

### Data Structure Actions

| Action | Fields | Description |
|--------|--------|-------------|
| `enqueue` | `target`, `values: [...]`, `duration` | Add values to a queue |
| `dequeue` | `target`, `duration` | Remove front value from a queue |
| `push` | `target`, `values: [...]`, `duration` | Push values onto a stack |
| `pop` | `target`, `duration` | Pop top value from a stack |

### Text Actions

| Action | Fields | Description |
|--------|--------|-------------|
| `set-text` | `target`, `value` | Change text content (instant) |

### Movement

| Action | Fields | Description |
|--------|--------|-------------|
| `move-to` | `target`, `position: {x, y}`, `duration` | Move any object to a position |

### Camera

| Action | Fields | Description |
|--------|--------|-------------|
| `camera-zoom` | `scale`, `duration` | Zoom in/out (1.0 = normal) |
| `camera-pan` | `position: {x, y}`, `duration` | Pan camera to a position |
| `camera-reset` | `duration` | Reset zoom and pan to defaults |

### Style

| Action | Fields | Description |
|--------|--------|-------------|
| `set-style` | `target`, `style: {...}`, `duration` | Animate style properties (fill, stroke, fontSize, etc.) |
| `set-style` | `target`, `node`, `style: {...}`, `duration` | Change style of a specific graph node |

### Timing

| Action | Fields | Description |
|--------|--------|-------------|
| `pause` | `duration` | Wait without doing anything |

### Duration Format

Durations can be written as:
- `0.5s` — seconds (string)
- `500ms` — milliseconds (string)
- `0.5` — seconds (number)

### Easing

Every action with a `duration` accepts an optional `easing` override:

```yaml
- action: fade-in
  target: title
  duration: 0.8s
  easing: easeOutCubic    # Overrides meta.easing
```

Available easings: `linear`, `easeIn`, `easeOut`, `easeInOut`, `easeInSine`, `easeOutSine`, `easeInOutSine`, `easeInQuad`, `easeOutQuad`, `easeInOutQuad`, `easeInCubic`, `easeOutCubic`, `easeInOutCubic`, `easeInQuart`, `easeOutQuart`, `easeInOutQuart`, `easeInExpo`, `easeOutExpo`, `easeInOutExpo`, `easeInBack`, `easeOutBack`, `easeInOutBack`, `easeInBounce`, `easeOutBounce`, `easeInOutBounce`, `easeInElastic`, `easeOutElastic`, `easeInOutElastic`

---

## Multi-Scene Shows

For longer videos or courses, split content into multiple scene files and combine them with a **show manifest**.

### Show Manifest (show.yaml)

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

### Scene Files

Each scene file is a regular manifest (with `meta`, `objects`, `timeline`) but **inherits** palette, defaults, canvas, and easing from the master show manifest. Scene-level values override show-level values.

```yaml
# scenes/intro.yaml
meta:
  title: "Intro"
  canvas:
    width: 1920
    height: 1080
    background: "#1a1a2e"

objects:
  - id: title
    type: text
    content: ""
    position: { x: 960, y: 400 }
    style:
      font: "bold 48px sans-serif"

timeline:
  - action: set-text
    target: title
    value: "Welcome!"
  - action: fade-in
    target: title
    duration: 0.8s
  - action: pause
    duration: 2s
```

### Transitions

Transitions animate the switch between scenes:

| Type | Effect |
|------|--------|
| `none` | Instant cut (no animation) |
| `fade` | Fade out old scene, then fade in new scene |
| `crossfade` | Old scene fades out while new scene fades in simultaneously |
| `slide-left` | New scene slides in from the right |
| `slide-right` | New scene slides in from the left |

---

## File Layout

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

## Tips

- **Start objects invisible**: Set text `content: ""` and use `set-text` + `fade-in` to reveal them.
- **Use parallel blocks** for simultaneous highlights, fades, and movements.
- **Use pauses** to give viewers time to absorb information.
- **Camera zoom** works well for focusing on a specific part of a graph.
- **Palette references** (`$name`) keep colors consistent and easy to change.
- **Style defaults** in `meta.defaults` reduce repetition across objects.
