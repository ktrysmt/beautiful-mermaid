// ============================================================================
// ASCII renderer — grid-based layout
//
// Ported from AlexanderGrooff/mermaid-ascii cmd/graph.go + cmd/mapping_node.go.
// Places nodes on a logical grid, computes column/row sizes,
// converts grid coordinates to character-level drawing coordinates,
// and handles subgraph bounding boxes.
// ============================================================================

import type {
  GridCoord, DrawingCoord, Direction, AsciiGraph, AsciiNode, AsciiSubgraph,
} from './types.ts'
import { gridKey } from './types.ts'
import { mkCanvas, setCanvasSizeToGrid, setRoleCanvasSizeToGrid } from './canvas.ts'
import { determinePath, determineLabelLine, pathToCells } from './edge-routing.ts'
import { analyzeEdgeBundles, processBundles } from './edge-bundling.ts'
import { drawBox } from './draw.ts'
import { maxLineWidth, lineCount } from './multiline-utils.ts'
import { getShapeDimensions } from './shapes/index.ts'

// ============================================================================
// Grid coordinate → drawing coordinate conversion
// ============================================================================

/**
 * Convert a grid coordinate to a drawing (character) coordinate.
 * Sums column widths up to the target column, and row heights up to the target row,
 * then centers within the cell.
 */
export function gridToDrawingCoord(
  graph: AsciiGraph,
  c: GridCoord,
  dir?: Direction,
): DrawingCoord {
  const target: GridCoord = dir
    ? { x: c.x + dir.x, y: c.y + dir.y }
    : c

  let x = 0
  for (let col = 0; col < target.x; col++) {
    x += graph.columnWidth.get(col) ?? 0
  }

  let y = 0
  for (let row = 0; row < target.y; row++) {
    y += graph.rowHeight.get(row) ?? 0
  }

  const colW = graph.columnWidth.get(target.x) ?? 0
  const rowH = graph.rowHeight.get(target.y) ?? 0
  return {
    x: x + Math.floor(colW / 2) + graph.offsetX,
    y: y + Math.floor(rowH / 2) + graph.offsetY,
  }
}

/** Convert a path of grid coords to drawing coords. */
export function lineToDrawing(graph: AsciiGraph, line: GridCoord[]): DrawingCoord[] {
  return line.map(c => gridToDrawingCoord(graph, c))
}

// ============================================================================
// Node placement on the grid
// ============================================================================

/**
 * Reserve a 3x3 block in the grid for a node.
 * If the requested position is occupied, recursively shift by 4 grid units
 * (in the perpendicular direction based on effective direction) until a free spot is found.
 *
 * @param effectiveDir - Optional direction override. If not provided, uses the node's
 *                       effective direction (subgraph direction if in a subgraph with override,
 *                       otherwise graph direction).
 */
export function reserveSpotInGrid(
  graph: AsciiGraph,
  node: AsciiNode,
  requested: GridCoord,
  effectiveDir?: 'LR' | 'TD',
): GridCoord {
  // Determine direction for collision handling
  const dir = effectiveDir ?? getEffectiveDirection(graph, node)

  if (graph.grid.has(gridKey(requested))) {
    // Collision — shift perpendicular to main flow direction
    if (dir === 'LR') {
      return reserveSpotInGrid(graph, node, { x: requested.x, y: requested.y + 4 }, dir)
    } else {
      return reserveSpotInGrid(graph, node, { x: requested.x + 4, y: requested.y }, dir)
    }
  }

  // Reserve the 3x3 block
  for (let dx = 0; dx < 3; dx++) {
    for (let dy = 0; dy < 3; dy++) {
      const reserved: GridCoord = { x: requested.x + dx, y: requested.y + dy }
      graph.grid.set(gridKey(reserved), node)
    }
  }

  node.gridCoord = requested
  return requested
}

// ============================================================================
// Column width / row height computation
// ============================================================================

/**
 * Set column widths and row heights for a node's 3x3 grid block.
 * Each node occupies 3 columns (border, content, border) and 3 rows.
 * Uses shape-aware dimensions to properly size non-rectangular shapes.
 */
export function setColumnWidth(graph: AsciiGraph, node: AsciiNode): void {
  const gc = node.gridCoord!
  const padding = graph.config.boxBorderPadding

  // Get shape-aware dimensions
  const shapeDims = getShapeDimensions(node.shape, node.displayLabel, {
    useAscii: graph.config.useAscii,
    padding,
  })

  // Use shape-provided grid dimensions
  const colWidths = shapeDims.gridColumns
  const rowHeights = shapeDims.gridRows

  for (let idx = 0; idx < colWidths.length; idx++) {
    const xCoord = gc.x + idx
    const current = graph.columnWidth.get(xCoord) ?? 0
    graph.columnWidth.set(xCoord, Math.max(current, colWidths[idx]!))
  }

  for (let idx = 0; idx < rowHeights.length; idx++) {
    const yCoord = gc.y + idx
    const current = graph.rowHeight.get(yCoord) ?? 0
    graph.rowHeight.set(yCoord, Math.max(current, rowHeights[idx]!))
  }

  // Padding column/row before the node (spacing between nodes)
  if (gc.x > 0) {
    const current = graph.columnWidth.get(gc.x - 1) ?? 0
    graph.columnWidth.set(gc.x - 1, Math.max(current, graph.config.paddingX))
  }

  if (gc.y > 0) {
    let basePadding = graph.config.paddingY
    // Extra vertical padding for nodes with incoming edges from outside their subgraph
    if (hasIncomingEdgeFromOutsideSubgraph(graph, node)) {
      const subgraphOverhead = 4
      basePadding += subgraphOverhead
    }
    const current = graph.rowHeight.get(gc.y - 1) ?? 0
    graph.rowHeight.set(gc.y - 1, Math.max(current, basePadding))
  }
}

/** Ensure grid has width/height entries for all cells along an edge path. */
export function increaseGridSizeForPath(graph: AsciiGraph, path: GridCoord[]): void {
  for (const c of path) {
    if (!graph.columnWidth.has(c.x)) {
      graph.columnWidth.set(c.x, Math.floor(graph.config.paddingX / 2))
    }
    if (!graph.rowHeight.has(c.y)) {
      graph.rowHeight.set(c.y, Math.floor(graph.config.paddingY / 2))
    }
  }
}

// ============================================================================
// Subgraph helpers
// ============================================================================

function isNodeInAnySubgraph(graph: AsciiGraph, node: AsciiNode): boolean {
  return graph.subgraphs.some(sg => sg.nodes.includes(node))
}

/**
 * Get the innermost subgraph that directly contains this node.
 * Returns null if node is not in any subgraph.
 */
export function getNodeSubgraph(graph: AsciiGraph, node: AsciiNode): AsciiSubgraph | null {
  // Find the innermost (most deeply nested) subgraph containing the node
  let innermost: AsciiSubgraph | null = null
  for (const sg of graph.subgraphs) {
    if (sg.nodes.includes(node)) {
      // Check if this subgraph is deeper (more nested) than current innermost
      if (!innermost || isAncestorOrSelf(innermost, sg)) {
        innermost = sg
      }
    }
  }
  return innermost
}

/** Check if `candidate` is the same as or an ancestor of `target`. */
function isAncestorOrSelf(candidate: AsciiSubgraph, target: AsciiSubgraph): boolean {
  let current: AsciiSubgraph | null = target
  while (current !== null) {
    if (current === candidate) return true
    current = current.parent
  }
  return false
}

/**
 * Get the effective direction for a node's layout.
 * Returns the subgraph's direction override if the node is in a subgraph with one,
 * otherwise returns the graph-level direction.
 */
export function getEffectiveDirection(graph: AsciiGraph, node: AsciiNode): 'LR' | 'TD' {
  const sg = getNodeSubgraph(graph, node)
  if (sg?.direction) {
    return sg.direction
  }
  return graph.config.graphDirection
}

/**
 * Check if a node has an incoming edge from outside its subgraph
 * AND is the topmost such node in its subgraph.
 * Used to add extra vertical padding for subgraph borders.
 */
function hasIncomingEdgeFromOutsideSubgraph(graph: AsciiGraph, node: AsciiNode): boolean {
  const nodeSg = getNodeSubgraph(graph, node)
  if (!nodeSg) return false

  let hasExternalEdge = false
  for (const edge of graph.edges) {
    if (edge.to === node) {
      const sourceSg = getNodeSubgraph(graph, edge.from)
      if (sourceSg !== nodeSg) {
        hasExternalEdge = true
        break
      }
    }
  }

  if (!hasExternalEdge) return false

  // Only return true for the topmost node with an external incoming edge
  for (const otherNode of nodeSg.nodes) {
    if (otherNode === node || !otherNode.gridCoord) continue
    let otherHasExternal = false
    for (const edge of graph.edges) {
      if (edge.to === otherNode) {
        const sourceSg = getNodeSubgraph(graph, edge.from)
        if (sourceSg !== nodeSg) {
          otherHasExternal = true
          break
        }
      }
    }
    if (otherHasExternal && otherNode.gridCoord.y < node.gridCoord!.y) {
      return false
    }
  }

  return true
}

// ============================================================================
// Subgraph bounding boxes
// ============================================================================

function calculateSubgraphBoundingBox(graph: AsciiGraph, sg: AsciiSubgraph): void {
  if (sg.nodes.length === 0) return

  let minX = 1_000_000
  let minY = 1_000_000
  let maxX = -1_000_000
  let maxY = -1_000_000

  // Include children's bounding boxes
  for (const child of sg.children) {
    calculateSubgraphBoundingBox(graph, child)
    if (child.nodes.length > 0) {
      minX = Math.min(minX, child.minX)
      minY = Math.min(minY, child.minY)
      maxX = Math.max(maxX, child.maxX)
      maxY = Math.max(maxY, child.maxY)
    }
  }

  // Include node positions
  for (const node of sg.nodes) {
    if (!node.drawingCoord || !node.drawing) continue
    const nodeMinX = node.drawingCoord.x
    const nodeMinY = node.drawingCoord.y
    const nodeMaxX = nodeMinX + node.drawing.length - 1
    const nodeMaxY = nodeMinY + node.drawing[0]!.length - 1
    minX = Math.min(minX, nodeMinX)
    minY = Math.min(minY, nodeMinY)
    maxX = Math.max(maxX, nodeMaxX)
    maxY = Math.max(maxY, nodeMaxY)
  }

  const subgraphPadding = 2
  const subgraphLabelSpace = 2
  sg.minX = minX - subgraphPadding
  sg.minY = minY - subgraphPadding - subgraphLabelSpace
  sg.maxX = maxX + subgraphPadding
  sg.maxY = maxY + subgraphPadding
}

/** Ensure non-overlapping root subgraphs have minimum spacing. */
function ensureSubgraphSpacing(graph: AsciiGraph): void {
  const minSpacing = 1
  const rootSubgraphs = graph.subgraphs.filter(sg => sg.parent === null && sg.nodes.length > 0)

  for (let i = 0; i < rootSubgraphs.length; i++) {
    for (let j = i + 1; j < rootSubgraphs.length; j++) {
      const sg1 = rootSubgraphs[i]!
      const sg2 = rootSubgraphs[j]!

      // Check for 2D overlap (use <= for touching/equal boundaries)
      const hOverlap = sg1.minX <= sg2.maxX && sg1.maxX >= sg2.minX
      const vOverlap = sg1.minY <= sg2.maxY && sg1.maxY >= sg2.minY

      if (!hOverlap || !vOverlap) continue

      // Both axes overlap — need to separate.
      // Use <= (not <) so equal min values are handled.
      // Horizontal overlap → adjust vertical
      if (hOverlap) {
        if (sg1.maxY >= sg2.minY - minSpacing && sg1.minY <= sg2.minY) {
          const newMinY = sg1.maxY + minSpacing + 1
          // Preserve bbox height: shift maxY if newMinY would exceed it
          if (newMinY > sg2.maxY) {
            sg2.maxY = newMinY + (sg2.maxY - sg2.minY)
          }
          sg2.minY = newMinY
        } else if (sg2.maxY >= sg1.minY - minSpacing && sg2.minY <= sg1.minY) {
          const newMinY = sg2.maxY + minSpacing + 1
          if (newMinY > sg1.maxY) {
            sg1.maxY = newMinY + (sg1.maxY - sg1.minY)
          }
          sg1.minY = newMinY
        }
      }
      // Vertical overlap → adjust horizontal
      if (sg1.minY <= sg2.maxY && sg1.maxY >= sg2.minY) {
        if (sg1.maxX >= sg2.minX - minSpacing && sg1.minX <= sg2.minX) {
          const newMinX = sg1.maxX + minSpacing + 1
          if (newMinX > sg2.maxX) {
            sg2.maxX = newMinX + (sg2.maxX - sg2.minX)
          }
          sg2.minX = newMinX
        } else if (sg2.maxX >= sg1.minX - minSpacing && sg2.minX <= sg1.minX) {
          const newMinX = sg2.maxX + minSpacing + 1
          if (newMinX > sg1.maxX) {
            sg1.maxX = newMinX + (sg1.maxX - sg1.minX)
          }
          sg1.minX = newMinX
        }
      }
    }
  }
}

export function calculateSubgraphBoundingBoxes(graph: AsciiGraph): void {
  for (const sg of graph.subgraphs) {
    calculateSubgraphBoundingBox(graph, sg)
  }
  ensureSubgraphSpacing(graph)
}

/**
 * Offset all drawing coordinates so subgraph borders don't go negative.
 * If any subgraph has negative min coordinates, shift everything positive.
 */
export function offsetDrawingForSubgraphs(graph: AsciiGraph): void {
  if (graph.subgraphs.length === 0) return

  let minX = 0
  let minY = 0
  for (const sg of graph.subgraphs) {
    minX = Math.min(minX, sg.minX)
    minY = Math.min(minY, sg.minY)
  }

  const offsetX = -minX
  const offsetY = -minY
  if (offsetX === 0 && offsetY === 0) return

  graph.offsetX = offsetX
  graph.offsetY = offsetY

  for (const sg of graph.subgraphs) {
    sg.minX += offsetX
    sg.minY += offsetY
    sg.maxX += offsetX
    sg.maxY += offsetY
  }

  for (const node of graph.nodes) {
    if (node.drawingCoord) {
      node.drawingCoord.x += offsetX
      node.drawingCoord.y += offsetY
    }
  }
}

// ============================================================================
// Main layout orchestrator
// ============================================================================

/**
 * createMapping performs the full grid layout:
 * 1. Place root nodes on the grid
 * 2. Place child nodes level by level
 * 3. Compute column widths and row heights
 * 4. Run A* pathfinding for all edges
 * 5. Determine label placement
 * 6. Convert grid coords → drawing coords
 * 7. Generate node box drawings
 * 8. Calculate subgraph bounding boxes
 */
export function createMapping(graph: AsciiGraph): void {
  const dir = graph.config.graphDirection
  const highestPositionPerLevel: number[] = new Array(100).fill(0)

  // Identify root nodes — nodes that aren't the target of any edge.
  // Use a direct edge-target check so the result is independent of
  // node insertion order in the parser. When every node is an edge
  // target (pure cycle / self-reference), fall back to the original
  // forward-scan heuristic that picks roots by definition order.
  const edgeTargets = new Set(graph.edges.map(e => e.to.name))
  const strictRoots = graph.nodes.filter(n => !edgeTargets.has(n.name))

  let rootNodes: AsciiNode[]
  if (strictRoots.length > 0) {
    rootNodes = strictRoots
  } else {
    // Fallback: all nodes are edge targets (cycles / self-references).
    // Use forward-scan to pick roots by definition order.
    const nodesFound = new Set<string>()
    rootNodes = []
    for (const node of graph.nodes) {
      if (!nodesFound.has(node.name)) {
        rootNodes.push(node)
      }
      nodesFound.add(node.name)
      for (const child of getChildren(graph, node)) {
        nodesFound.add(child.name)
      }
    }
  }

  // In LR mode with both external and subgraph roots, separate them
  // so subgraph roots are placed one level deeper
  let hasExternalRoots = false
  let hasSubgraphRootsWithEdges = false
  for (const node of rootNodes) {
    if (isNodeInAnySubgraph(graph, node)) {
      if (getChildren(graph, node).length > 0) hasSubgraphRootsWithEdges = true
    } else {
      hasExternalRoots = true
    }
  }
  const shouldSeparate = dir === 'LR' && hasExternalRoots && hasSubgraphRootsWithEdges

  // Identify downstream subgraphs — root-level subgraphs that receive
  // cross-subgraph edges. Their roots are deferred so upstream subgraphs
  // are laid out above them in TD mode (or to the left in LR mode).
  const downstreamSgs = new Set<AsciiSubgraph>()
  for (const edge of graph.edges) {
    const fromSg = getNodeSubgraph(graph, edge.from)
    const toSg = getNodeSubgraph(graph, edge.to)
    if (fromSg && toSg && fromSg !== toSg && !fromSg.parent && !toSg.parent) {
      downstreamSgs.add(toSg)
    }
  }

  let externalRootNodes: AsciiNode[]
  let subgraphRootNodes: AsciiNode[] = []

  if (shouldSeparate) {
    externalRootNodes = rootNodes.filter(n => !isNodeInAnySubgraph(graph, n))
    subgraphRootNodes = rootNodes.filter(n => isNodeInAnySubgraph(graph, n))
  } else {
    externalRootNodes = rootNodes
  }

  // Split roots into primary (placed now) and deferred (placed when their
  // subgraph is first entered via a cross-subgraph edge).
  const deferredRoots = new Set<AsciiNode>()
  const primaryRoots: AsciiNode[] = []
  for (const root of externalRootNodes) {
    const sg = getNodeSubgraph(graph, root)
    if (sg && downstreamSgs.has(sg)) {
      deferredRoots.add(root)
    } else {
      primaryRoots.push(root)
    }
  }

  // Place primary root nodes, grouped by their immediate downstream target.
  // Roots feeding into the same target are placed contiguously so that edge
  // paths from different fan-in groups don't overlap.
  const rootsByTarget = new Map<string, AsciiNode[]>()
  for (const root of primaryRoots) {
    const children = getChildren(graph, root)
    const targetName = children.length > 0 ? children[0]!.name : '__ungrouped__'
    const group = rootsByTarget.get(targetName) ?? []
    group.push(root)
    rootsByTarget.set(targetName, group)
  }

  for (const [, roots] of rootsByTarget) {
    for (const node of roots) {
      const requested: GridCoord = dir === 'LR'
        ? { x: 0, y: highestPositionPerLevel[0]! }
        : { x: highestPositionPerLevel[0]!, y: 0 }
      reserveSpotInGrid(graph, graph.nodes[node.index]!, requested)
      highestPositionPerLevel[0] = highestPositionPerLevel[0]! + 4
    }
  }

  // Place subgraph root nodes at level 4 (one level in from the edge)
  if (shouldSeparate && subgraphRootNodes.length > 0) {
    const subgraphLevel = 4
    for (const node of subgraphRootNodes) {
      const requested: GridCoord = dir === 'LR'
        ? { x: subgraphLevel, y: highestPositionPerLevel[subgraphLevel]! }
        : { x: highestPositionPerLevel[subgraphLevel]!, y: subgraphLevel }
      reserveSpotInGrid(graph, graph.nodes[node.index]!, requested)
      highestPositionPerLevel[subgraphLevel] = highestPositionPerLevel[subgraphLevel]! + 4
    }
  }

  // Precompute in-degree for fan-in detection
  const inDegree = new Map<string, number>()
  for (const edge of graph.edges) {
    inDegree.set(edge.to.name, (inDegree.get(edge.to.name) ?? 0) + 1)
  }

  // Place child nodes level by level
  // Use subgraph direction only when both parent and child are in the same subgraph
  // Multi-pass: iterate until all nodes are placed (handles non-topological node order)
  // Note: when shouldSeparate, externalRootNodes + subgraphRootNodes = rootNodes
  //       otherwise, externalRootNodes = rootNodes and subgraphRootNodes is empty
  let placedCount = primaryRoots.length + subgraphRootNodes.length
  while (placedCount < graph.nodes.length) {
    const prevCount = placedCount
    for (const node of graph.nodes) {
      if (node.gridCoord === null) continue  // skip unplaced nodes
      const gc = node.gridCoord

      for (const child of getChildren(graph, node)) {
        if (child.gridCoord !== null) continue // already placed

        // Determine direction for this edge (parent -> child)
        // Use subgraph direction only if both are in the same subgraph with override
        const parentSg = getNodeSubgraph(graph, node)
        const childSg = getNodeSubgraph(graph, child)
        const edgeDir = (parentSg && parentSg === childSg && parentSg.direction)
          ? parentSg.direction
          : graph.config.graphDirection

        // Longest-path layer assignment: the child must be placed at least
        // one level after ALL its already-placed predecessors, not just the
        // current parent.  Without this, a fan-in node like C in "A→B, A→C,
        // B→C" would be placed at the same level as B (because A places C
        // first), making the B→C edge go backward/sideways.
        let maxPredLevel = edgeDir === 'LR' ? gc.x : gc.y
        for (const e of graph.edges) {
          if (e.to.name === child.name && e.from.gridCoord !== null) {
            const predLevel = edgeDir === 'LR' ? e.from.gridCoord.x : e.from.gridCoord.y
            if (predLevel > maxPredLevel) maxPredLevel = predLevel
          }
        }
        let childLevel = maxPredLevel + 4

        // Deferred root placement: when a cross-subgraph edge first enters
        // a downstream subgraph, place that subgraph's deferred roots at the
        // entry level. This ensures upstream subgraphs are rendered above
        // downstream ones in TD mode (WS1 above WS3).
        if (childSg && parentSg !== childSg && deferredRoots.size > 0) {
          let placedDeferred = false
          for (const dr of [...deferredRoots]) {
            if (dr.gridCoord !== null) continue
            const drSg = getNodeSubgraph(graph, dr)
            if (drSg !== childSg) continue

            const drPerp = highestPositionPerLevel[childLevel] ?? 0
            const drRequested: GridCoord = edgeDir === 'LR'
              ? { x: childLevel, y: drPerp }
              : { x: drPerp, y: childLevel }
            reserveSpotInGrid(graph, graph.nodes[dr.index]!, drRequested, edgeDir)
            highestPositionPerLevel[childLevel] = drPerp + 4
            deferredRoots.delete(dr)
            placedCount++
            placedDeferred = true
          }
          // Push the actual child one level deeper so it appears below the
          // deferred roots (which are typically sources of intra-subgraph edges)
          if (placedDeferred) {
            childLevel += 4
          }
        }

        // Determine position based on direction context
        let highestPosition: number
        if (edgeDir !== graph.config.graphDirection) {
          // Cross-direction: use parent's perpendicular coordinate
          // This keeps children aligned with parent when direction changes
          highestPosition = edgeDir === 'LR' ? gc.y : gc.x
        } else if ((inDegree.get(child.name) ?? 0) > 1) {
          // Fan-in target: align with parent's perpendicular position to keep
          // the target near its root group and avoid long diagonal edges
          const parentPerpendicular = graph.config.graphDirection === 'LR' ? gc.y : gc.x
          highestPosition = Math.max(highestPositionPerLevel[childLevel]!, parentPerpendicular)
        } else {
          // Same direction: use level tracker
          highestPosition = highestPositionPerLevel[childLevel]!
        }

        // Subgraph containment: ensure node is placed in the spatial region
        // of its own subgraph. Without this, cross-subgraph edges (e.g. A in WS1 → B in WS3)
        // would place B at A's perpendicular position, causing WS3's bounding box
        // to engulf WS1.
        if (childSg) {
          const existingSgNodes = childSg.nodes.filter(n => n !== child && n.gridCoord !== null)
          if (existingSgNodes.length > 0) {
            const perpPositions = existingSgNodes.map(n =>
              graph.config.graphDirection === 'TD' ? n.gridCoord!.x : n.gridCoord!.y
            )
            const sgMinPerp = Math.min(...perpPositions)
            highestPosition = Math.max(highestPosition, sgMinPerp)
          } else if (parentSg && parentSg !== childSg) {
            // First node in a different subgraph with no existing members.
            // If childLevel falls within the parent subgraph's level range, the child
            // would end up inside the parent's bounding box. Push it beyond the parent's
            // max perpendicular extent to keep the subgraphs spatially separate.
            const parentSgNodes = parentSg.nodes.filter(n => n.gridCoord !== null)
            if (parentSgNodes.length > 0) {
              const parentLevels = parentSgNodes.map(n =>
                graph.config.graphDirection === 'TD' ? n.gridCoord!.y : n.gridCoord!.x
              )
              const parentMaxLevel = Math.max(...parentLevels) + 2 // +2 for node's 3-cell block
              if (childLevel <= parentMaxLevel) {
                const maxPerp = Math.max(...parentSgNodes.map(n =>
                  graph.config.graphDirection === 'TD' ? n.gridCoord!.x : n.gridCoord!.y
                ))
                highestPosition = Math.max(highestPosition, maxPerp + 4)
              }
            }
          }
        }

        const requested: GridCoord = edgeDir === 'LR'
          ? { x: childLevel, y: highestPosition }
          : { x: highestPosition, y: childLevel }
        reserveSpotInGrid(graph, graph.nodes[child.index]!, requested, edgeDir)

        // Only update level tracker for same-direction placements
        if (edgeDir === graph.config.graphDirection) {
          highestPositionPerLevel[childLevel] = highestPosition + 4
        }
        placedCount++
      }
    }
    // Safety: break if no progress made (handles disconnected nodes)
    if (placedCount === prevCount) break
  }

  // Compute column widths and row heights
  for (const node of graph.nodes) {
    setColumnWidth(graph, node)
  }

  // Fan-in space allocation: increase row height before nodes with many
  // labeled incoming edges so that congestion-aware routing has room to
  // spread edges across different grid lanes.
  const labeledInDegree = new Map<string, number>()
  for (const edge of graph.edges) {
    if (edge.text.length > 0) {
      labeledInDegree.set(edge.to.name, (labeledInDegree.get(edge.to.name) ?? 0) + 1)
    }
  }
  for (const node of graph.nodes) {
    const deg = labeledInDegree.get(node.name) ?? 0
    if (deg >= 3 && node.gridCoord) {
      const approachRow = node.gridCoord.y - 1
      if (approachRow >= 0) {
        const extra = Math.min((deg - 2) * 2, 10)
        const current = graph.rowHeight.get(approachRow) ?? 0
        graph.rowHeight.set(approachRow, Math.max(current, current + extra))
      }
    }
  }

  // Analyze edges for bundling (parallel links like A & B --> C)
  // This groups edges that share sources or targets for cleaner visualization
  graph.bundles = analyzeEdgeBundles(graph)

  // Route bundled edges through junction points
  processBundles(graph)

  // Initialize label midpoint tracking and edge congestion map.
  // Congestion tracks cells used by earlier edge paths so that A*
  // encourages later edges to take alternative routes.
  graph.usedLabelMidpoints = new Set<string>()
  const congestion = new Map<string, number>()

  // Route non-bundled edges via A* and determine label positions
  for (const edge of graph.edges) {
    // Skip edges that were already routed as part of a bundle
    if (edge.bundle && edge.path.length > 0) {
      increaseGridSizeForPath(graph, edge.path)
      determineLabelLine(graph, edge)
      // Record bundle path cells in congestion map
      for (const cell of pathToCells(edge.path)) {
        const k = gridKey(cell)
        congestion.set(k, (congestion.get(k) ?? 0) + 1)
      }
      continue
    }

    determinePath(graph, edge, congestion)
    increaseGridSizeForPath(graph, edge.path)
    determineLabelLine(graph, edge)

    // Record this edge's path cells in congestion map
    for (const cell of pathToCells(edge.path)) {
      const k = gridKey(cell)
      congestion.set(k, (congestion.get(k) ?? 0) + 1)
    }
  }

  // Convert grid coords → drawing coords and generate box drawings
  for (const node of graph.nodes) {
    node.drawingCoord = gridToDrawingCoord(graph, node.gridCoord!)
    node.drawing = drawBox(node, graph)
  }

  // Set canvas size and compute subgraph bounding boxes
  setCanvasSizeToGrid(graph.canvas, graph.columnWidth, graph.rowHeight)
  setRoleCanvasSizeToGrid(graph.roleCanvas, graph.columnWidth, graph.rowHeight)
  calculateSubgraphBoundingBoxes(graph)
  offsetDrawingForSubgraphs(graph)
}

// ============================================================================
// Graph traversal helpers
// ============================================================================

/** Get all edges originating from a node. */
function getEdgesFromNode(graph: AsciiGraph, node: AsciiNode): AsciiGraph['edges'] {
  return graph.edges.filter(e => e.from.name === node.name)
}

/** Get all direct children of a node (targets of outgoing edges). */
function getChildren(graph: AsciiGraph, node: AsciiNode): AsciiNode[] {
  return getEdgesFromNode(graph, node).map(e => e.to)
}
