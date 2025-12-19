# PRD: Utility Nodes + Image Grid Split Node

**Version:** 1.0
**Last Updated:** December 2025
**Status:** Draft
**Related PRD:** Node-Based Image Annotation & Generation Workflow (v1.0)

---

## 1. Overview

### 1.1 Product Summary

Add a new node category called **Utility Nodes** for non-generative operations (pure transforms) inside the workflow graph. The first utility node splits a single image into an **R×C** grid and outputs each tile as a separate image output.

### 1.2 Problem Statement

Users frequently need to:

- split a generated/edited image into consistent tiles (e.g., grids for carousels, texture/detail crops, multi-variant boards),
- feed specific tiles into subsequent nodes (annotation or generation) without exporting/re-importing assets.

### 1.3 Goals / Success Criteria

- User can split an image into a grid (e.g., 3×3) and route any tile into downstream nodes in **under 30 seconds**.
- Split node outputs are **stable, deterministic**, and **preserve pixel fidelity**.
- Workflow execution correctly propagates per-tile outputs via edges.

---

## 2. Scope

### 2.1 In Scope (v1)

- New **Utility** node group in node picker/action bar.
- **Image Grid Split Node**:

  - accepts image input + rows/columns configuration,
  - produces **rows × columns** tile outputs as images (base64 PNG),
  - exposes **one output handle per tile**.

- Workflow engine support for **multi-output nodes** (output keyed by `sourceHandle`).

### 2.2 Out of Scope (v1)

- “Batch” execution semantics (one node consuming an array and producing arrays).
- Auto-creating downstream nodes per tile.
- Advanced split features (overlap, padding/gutter, arbitrary crops, smart content-aware splitting).
- Persisting/exporting tiles as a zip.

---

## 3. Tech / Architecture Notes

### 3.1 Data Type Additions

Add new conceptual data patterns:

- `image` (existing): a single base64 image
- `image:tile` (new, still compatible with `image`): same payload shape as image, plus metadata
- **Multi-output**: node produces multiple `image` outputs keyed by output handle id

### 3.2 Workflow Engine Change (Multi-Output)

Current execution assumes a node returns a single output. Update to store outputs per node **and per output handle**.

**Proposed runtime shape:**

```ts
type NodeOutputMap = Record<
  string /* nodeId */,
  Record<string /* handleId */, unknown>
>;
// Example: outputs[nodeId]["tile-0"] = { imageBase64, meta }
```

Edge propagation uses:

- `edge.source` + `edge.sourceHandle` → find the exact output payload
- assign payload to downstream node input keyed by `edge.targetHandle`

---

## 4. Node Graph Updates

### 4.1 Node Connection Rules (Additions)

New node type:

```
Image Grid Split Node → [image input] [tile image outputs...]
```

Compatibility:

- Split outputs (`image`) can connect to any node expecting `image input` (Annotation Node, Nano Banana Node, Output Node).
- Split node requires an upstream image (Image Input / Annotation / Nano Banana / Output).

---

## 5. Utility Nodes

### 5.1 Utility Node Category

**Definition:** Nodes that transform or restructure data locally (client-side), without calling external AI APIs.

**General Requirements**

| ID    | Requirement                                                                          | Priority |
| ----- | ------------------------------------------------------------------------------------ | -------- |
| UT-01 | Utility nodes appear in the same add-node UI (sidebar or action bar)                 | Must     |
| UT-02 | Utility nodes use the same selection, deletion, and edge behaviors as existing nodes | Must     |
| UT-03 | Utility nodes execute as part of Run Workflow ordering                               | Must     |
| UT-04 | Utility nodes are deterministic and fast; show status if processing is non-trivial   | Should   |

---

## 6. Node Spec: Image Grid Split Node

### 6.1 Purpose

Split a single input image into **equal** rows and columns and output each tile as an image.

### 6.2 Inputs / Outputs

**Inputs**

- `image` (required) — from an upstream node
- `rows` (required) — integer
- `columns` (required) — integer

**Outputs**

- `tile-0 ... tile-(rows*columns - 1)` — each is an `image` output (base64 PNG), plus metadata

**Tile ordering**

- Row-major order:

  - index = `row * columns + col`
  - `tile-0` = (row 0, col 0), `tile-1` = (row 0, col 1), …

### 6.3 Requirements

| ID    | Requirement                                                        | Priority |
| ----- | ------------------------------------------------------------------ | -------- |
| GS-01 | Accept image input from connected node                             | Must     |
| GS-02 | Rows and Columns are numeric inputs inside the node                | Must     |
| GS-03 | Validate rows/columns are integers within allowed range            | Must     |
| GS-04 | Produce rows×columns outputs as individual image handles           | Must     |
| GS-05 | Display a preview with a grid overlay                              | Should   |
| GS-06 | Display tile thumbnails (collapsible)                              | Should   |
| GS-07 | Preserve pixel fidelity (no resampling unless explicitly required) | Must     |
| GS-08 | Deterministic split behavior when dimensions don’t divide evenly   | Must     |
| GS-09 | Show error state if split cannot be performed                      | Must     |

### 6.4 Constraints / Validation

- `rows`: integer, min 1, max **10** (configurable constant)
- `columns`: integer, min 1, max **10**
- Max tiles: `rows * columns <= 64` (default cap; prevents UI/edge explosion)

### 6.5 Split Algorithm (Deterministic)

Given image width `W`, height `H`, columns `C`, rows `R`:

- Base tile width `tw = floor(W / C)`
- Base tile height `th = floor(H / R)`
- Remainders:

  - `rw = W - tw*C`
  - `rh = H - th*R`

**Remainder policy (simple + predictable):**

- Distribute extra pixels to the **last column** and **last row**:

  - last column width = `tw + rw`
  - last row height = `th + rh`

This guarantees:

- All pixels are included exactly once
- No overlap, no gaps

### 6.6 Output Payload

Each tile output payload:

```ts
interface ImageTilePayload {
  imageBase64: string; // PNG base64 (no data: prefix in internal storage if consistent with current app)
  mimeType: "image/png";
  meta: {
    sourceNodeId: string;
    sourceImageWidth: number;
    sourceImageHeight: number;
    row: number;
    col: number;
    index: number;
    crop: { x: number; y: number; width: number; height: number };
  };
}
```

---

## 7. UI / UX

### 7.1 Node UI Layout

- Node header: **“Grid Split”** + utility icon
- Body:

  - Numeric inputs: `Rows`, `Columns`
  - Preview area: source image thumbnail + grid overlay
  - Tile preview strip (optional collapsible): mini thumbnails labeled `r1c1`, `r1c2`, …

- Handles:

  - **1 input handle** (left): `image`
  - **N output handles** (right): one per tile, labeled by `rXcY` (or `1,2,3…`)

### 7.2 Output Handle Naming

- Handle id: `tile-${index}`
- Label: `r${row+1}c${col+1}` (human readable)

### 7.3 Canvas Clutter Controls (Must-have guardrails)

- If `rows*columns > 16`, collapse handle labels to short form (e.g., `t0..t15`) with tooltip on hover.
- Enforce max tiles cap (default 64) with inline validation error.

---

## 8. Workflow Execution

### 8.1 Execution Behavior

During `Run Workflow`:

1. Split node waits for its upstream image to resolve.
2. Performs client-side split (Canvas drawImage crop per tile).
3. Emits each tile output mapped to its output handle id.
4. Downstream nodes receive the tile image that corresponds to the connected edge’s `sourceHandle`.

### 8.2 Status States

| State    | Meaning                              |
| -------- | ------------------------------------ |
| idle     | not executed yet / inputs missing    |
| ready    | image present and rows/cols valid    |
| loading  | splitting in progress                |
| complete | tiles available                      |
| error    | invalid inputs or processing failure |

---

## 9. Error States

| Scenario                                     | User Feedback                                 |
| -------------------------------------------- | --------------------------------------------- |
| Missing image input                          | Node shows “Connect an image input”           |
| rows/cols invalid (0, negative, non-integer) | Inline validation + node error                |
| Too many tiles (exceeds cap)                 | Inline validation: “Max tiles is 64”          |
| Image decode/canvas failure                  | Toast + node error: “Could not process image” |
| Memory pressure / very large image           | Toast warning + node error if split fails     |

---

## 10. State / Types (Implementation Notes)

### 10.1 Node Data Interface

```ts
interface GridSplitNodeData {
  inputImage: string | null; // base64
  rows: number; // default 2
  columns: number; // default 2
  status: "idle" | "ready" | "loading" | "complete" | "error";
  error: string | null;

  // optional UI convenience
  previewImage: string | null; // thumbnail (can reuse inputImage)
  tileCount: number; // rows * columns
}
```

### 10.2 Workflow Output Storage

```ts
type HandleId = string;

interface WorkflowRuntime {
  outputs: Record<string /* nodeId */, Record<HandleId, unknown>>;
}
```

---

## 11. Acceptance Criteria

### 11.1 Node Creation & Editing

- [ ] User can add **Grid Split** node from Utility section
- [ ] User can set rows/columns (defaults: 2×2)
- [ ] Node validates rows/columns and shows errors inline

### 11.2 Splitting & Routing

- [ ] When connected to an image and run, node produces **rows×columns** tile outputs
- [ ] Each tile output can connect to **Annotation**, **Nano Banana**, or **Output** nodes
- [ ] Downstream nodes receive the correct tile image (verified by visual inspection using distinct quadrants)

### 11.3 Determinism

- [ ] Given the same image + rows/cols, the tile crop boundaries are stable across runs
- [ ] Non-divisible dimensions follow the documented remainder policy

### 11.4 UX Guardrails

- [ ] Tile cap prevents UI blow-ups (default max 64 tiles)
- [ ] Node remains usable on common laptop resolutions without excessive overlap

---

## 12. Design Choice (Where the graph model matters)

| Option                                 | What it means                                 | Prob. it scales well |               Payoff if right | Failure mode                            |
| -------------------------------------- | --------------------------------------------- | -------------------: | ----------------------------: | --------------------------------------- |
| A) **One output handle per tile**      | Split produces N discrete `image` outputs     |                 0.75 | Highest usability for routing | Canvas clutter at high N                |
| B) Output an `image[]` array           | One output handle, downstream consumes arrays |                 0.55 |                 Cleaner graph | Requires “array-aware” downstream nodes |
| C) Hybrid: handles up to 9, else array | Smart defaults                                |                 0.65 |                  Best of both | More complexity in type system          |

If the goal is “route any tile into existing nodes without changing them,” option **A** has the highest payoff because it preserves the existing `image` contract.

---

## 13. Follow-on Utility Nodes (Likely needed soon)

- **Tile Picker Node**: takes `image[]` (or a split node reference) + index → outputs single image
- **Grid Merge Node**: N tiles → one composite image
- **Batch Generate Node**: multiple images + one prompt → multiple generated outputs (rate-limit aware)
