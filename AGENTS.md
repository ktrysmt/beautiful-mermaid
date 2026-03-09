# AGENTS.md

## Project
- **Name:** beautiful-mermaid
- **Purpose:** Render Mermaid diagrams as beautiful SVGs or ASCII art.
- **Runtime/tooling:** Prefer **Bun** for scripts, tests, and local execution.

## Core commands
- Install: `bun install`
- Test: `bun test src/__tests__/`
- Dev samples: `bun run dev.ts`
- Build package: `bun run build`
- Generate samples: `bun run index.ts`
- Compare samples: `bun run compare-index.ts`

## Working conventions
- **Edit source files in `src/` first.** Do not hand-edit generated/demo HTML artifacts unless the task explicitly requires it.
- Prefer small, local changes over cross-cutting refactors.
- Keep **SVG and ASCII behavior aligned** when practical, especially for shared diagram concepts.
- When changing rendering/layout behavior, add or update tests in `src/__tests__/`.
- Preserve the library’s design goals: **compact output, strong theming, no DOM dependency, synchronous rendering**.

## Source layout
- `src/index.ts` — public API and diagram routing
- `src/parser.ts`, `src/layout.ts`, `src/renderer.ts` — core flowchart pipeline
- `src/sequence/*` — sequence diagrams
- `src/class/*` — class diagrams
- `src/er/*` — ER diagrams
- `src/xychart/*` — XY charts
- `src/quadrant/*` — quadrant charts
- `src/timeline/*` — timeline charts
- `src/gantt/*` — gantt charts
- `src/ascii/*` — ASCII/Unicode renderers
- `src/__tests__/*` — test coverage

## Design guidance
- Favor **compact, readable layouts** over large decorative spacing.
- Reuse shared tokens/constants where possible (`chart-constants.ts`, `design-tokens.ts`).
- For interactive SVG features, follow patterns already used in `src/xychart/renderer.ts`.
- If a chart supports labels, try to avoid unnecessary overflow or wasted width.
- Keep theme behavior CSS-variable-friendly so live theme switching continues to work.

## Testing expectations
- Run the most relevant tests for the area you touched.
- For parser/layout/renderer changes, add regression tests for edge cases.
- If output structure changes meaningfully, verify sample/demo generation still works.

## Notes for agents
- The repo may contain generated output files in the root or site/demo artifacts.
- Be careful not to confuse generated files with source-of-truth implementation files.
- If you notice suspicious root artifacts or zero-byte files, report them before deleting.
- Ask before destructive actions like deleting files or removing generated artifacts.
