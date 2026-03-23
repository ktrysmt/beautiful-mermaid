// ============================================================================
// ASCII renderer — A* pathfinding for edge routing
//
// Ported from AlexanderGrooff/mermaid-ascii cmd/arrow.go.
// Uses A* search with a corner-penalizing heuristic to find clean
// paths between nodes on the grid. Prefers straight lines over zigzags.
// ============================================================================

import type { GridCoord, AsciiNode, AsciiEdge } from './types.ts'
import { gridKey, gridCoordEquals } from './types.ts'

// ============================================================================
// Priority queue (min-heap) for A* open set
// ============================================================================

interface PQItem {
  coord: GridCoord
  priority: number
}

/**
 * Simple min-heap priority queue.
 * For the grid sizes we handle (~100s of cells), this is more than fast enough.
 */
class MinHeap {
  private items: PQItem[] = []

  get length(): number {
    return this.items.length
  }

  push(item: PQItem): void {
    this.items.push(item)
    this.bubbleUp(this.items.length - 1)
  }

  pop(): PQItem | undefined {
    if (this.items.length === 0) return undefined
    const top = this.items[0]!
    const last = this.items.pop()!
    if (this.items.length > 0) {
      this.items[0] = last
      this.sinkDown(0)
    }
    return top
  }

  private bubbleUp(i: number): void {
    while (i > 0) {
      const parent = (i - 1) >> 1
      if (this.items[i]!.priority < this.items[parent]!.priority) {
        ;[this.items[i], this.items[parent]] = [this.items[parent]!, this.items[i]!]
        i = parent
      } else {
        break
      }
    }
  }

  private sinkDown(i: number): void {
    const n = this.items.length
    while (true) {
      let smallest = i
      const left = 2 * i + 1
      const right = 2 * i + 2
      if (left < n && this.items[left]!.priority < this.items[smallest]!.priority) {
        smallest = left
      }
      if (right < n && this.items[right]!.priority < this.items[smallest]!.priority) {
        smallest = right
      }
      if (smallest !== i) {
        ;[this.items[i], this.items[smallest]] = [this.items[smallest]!, this.items[i]!]
        i = smallest
      } else {
        break
      }
    }
  }
}

// ============================================================================
// A* heuristic
// ============================================================================

/**
 * Manhattan distance with a +1 penalty when both dx and dy are non-zero.
 * This encourages the pathfinder to prefer straight lines and minimize corners.
 */
export function heuristic(a: GridCoord, b: GridCoord): number {
  const absX = Math.abs(a.x - b.x)
  const absY = Math.abs(a.y - b.y)
  if (absX === 0 || absY === 0) {
    return absX + absY
  }
  return absX + absY + 1
}

// ============================================================================
// A* pathfinding
// ============================================================================

/** 4-directional movement (no diagonals in grid pathfinding). */
const MOVE_DIRS: GridCoord[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
]

/** Check if a grid cell is unoccupied and has non-negative coordinates. */
function isFreeInGrid(grid: Map<string, AsciiNode>, c: GridCoord): boolean {
  if (c.x < 0 || c.y < 0) return false
  return !grid.has(gridKey(c))
}

/**
 * Maximum number of A* iterations before giving up.
 * Prevents unbounded memory growth when the destination is unreachable
 * through free cells (the grid has no positive upper-bound check).
 */
const MAX_ITERATIONS = 50_000

/** Penalty for overlapping with an unrelated previously-routed edge. */
const OCCUPIED_EDGE_PENALTY = 4
/** No penalty for overlapping with a related edge (same fan-in/fan-out family). */
const RELATED_EDGE_PENALTY = 0

/**
 * Compute occupancy penalty for stepping into a cell that already has routed edges.
 * Related edges (same source or target) get no penalty; unrelated edges get OCCUPIED_EDGE_PENALTY.
 */
function getOccupancyPenalty(
  cellKey: string,
  occupied: Map<string, AsciiEdge[]>,
  edge?: AsciiEdge,
): number {
  const occupants = occupied.get(cellKey)
  if (!occupants || occupants.length === 0) return 0
  if (!edge) return OCCUPIED_EDGE_PENALTY
  // Allow overlap with related edges (same source or target = same fan-in/fan-out family)
  for (const occ of occupants) {
    if (occ.from !== edge.from && occ.to !== edge.to &&
        occ.from !== edge.to && occ.to !== edge.from) {
      return OCCUPIED_EDGE_PENALTY
    }
  }
  return RELATED_EDGE_PENALTY
}

/**
 * Find a path from `from` to `to` on the grid using A*.
 * Returns the path as an array of GridCoords, or null if no path exists.
 *
 * When `occupied` is provided, paths through cells already used by unrelated edges
 * incur a penalty, encouraging visually distinct routes.
 */
export function getPath(
  grid: Map<string, AsciiNode>,
  from: GridCoord,
  to: GridCoord,
  occupied?: Map<string, AsciiEdge[]>,
  edge?: AsciiEdge,
): GridCoord[] | null {
  const pq = new MinHeap()
  pq.push({ coord: from, priority: 0 })

  const costSoFar = new Map<string, number>()
  costSoFar.set(gridKey(from), 0)

  const cameFrom = new Map<string, GridCoord | null>()
  cameFrom.set(gridKey(from), null)

  let iterations = 0
  while (pq.length > 0) {
    if (++iterations > MAX_ITERATIONS) {
      return null
    }

    const current = pq.pop()!.coord

    if (gridCoordEquals(current, to)) {
      // Reconstruct path by walking backwards through cameFrom
      const path: GridCoord[] = []
      let c: GridCoord | null = current
      while (c !== null) {
        path.unshift(c)
        c = cameFrom.get(gridKey(c)) ?? null
      }
      return path
    }

    const currentCost = costSoFar.get(gridKey(current))!

    for (const dir of MOVE_DIRS) {
      const next: GridCoord = { x: current.x + dir.x, y: current.y + dir.y }

      // Allow moving to the destination even if it's occupied (it's a node boundary)
      if (!isFreeInGrid(grid, next) && !gridCoordEquals(next, to)) {
        continue
      }

      const nextKey = gridKey(next)
      const occPenalty = occupied ? getOccupancyPenalty(nextKey, occupied, edge) : 0
      const newCost = currentCost + 1 + occPenalty
      const existingCost = costSoFar.get(nextKey)

      if (existingCost === undefined || newCost < existingCost) {
        costSoFar.set(nextKey, newCost)
        const priority = newCost + heuristic(next, to)
        pq.push({ coord: next, priority })
        cameFrom.set(nextKey, current)
      }
    }
  }

  return null // No path found
}

/**
 * Simplify a path by removing intermediate waypoints on straight segments.
 * E.g., [(0,0), (1,0), (2,0), (2,1)] becomes [(0,0), (2,0), (2,1)].
 * This reduces the number of line-drawing operations.
 */
export function mergePath(path: GridCoord[]): GridCoord[] {
  if (path.length <= 2) return path

  const toRemove = new Set<number>()
  let step0 = path[0]!
  let step1 = path[1]!

  for (let idx = 2; idx < path.length; idx++) {
    const step2 = path[idx]!
    const prevDx = step1.x - step0.x
    const prevDy = step1.y - step0.y
    const dx = step2.x - step1.x
    const dy = step2.y - step1.y

    // Same direction — the middle point is redundant
    if (prevDx === dx && prevDy === dy) {
      // In Go: indexToRemove = append(indexToRemove, idx+1) but idx is 0-based from path[2:]
      // which corresponds to index idx in the full path. Go uses idx+1 because idx iterates
      // from 0 in the [2:] slice, mapping to full-array index idx+1.
      // Actually re-checking Go code: the loop is `for idx, step2 := range path[2:]`
      // so idx=0 → path[2], and it removes idx+1 which is index 1 in the full array.
      // Wait, that doesn't look right. Let me re-read:
      //   step0 = path[0], step1 = path[1]
      //   for idx, step2 := range path[2:] { ... indexToRemove = append(indexToRemove, idx+1) ... }
      //   When idx=0, step2=path[2], and it removes index 1 (step1 = path[1]) if directions match
      // So it removes the middle point (step1) which is at index idx+1 in the original array
      // when counting from the 2-ahead loop. Let me just track which middle indices to remove.
      toRemove.add(idx - 1) // Remove the middle point (step1's position)
    }

    step0 = step1
    step1 = step2
  }

  return path.filter((_, i) => !toRemove.has(i))
}
