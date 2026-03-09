// ============================================================================
// ASCII renderer — Quadrant Chart
//
// Renders quadrantChart diagrams to ASCII/Unicode text art.
// Uses the parsed QuadrantChart type directly (not positioned).
//
// Layout: square plot area divided into 4 quadrants by a cross-hair.
// Points are plotted as single characters (*) at their [x,y] positions.
// ============================================================================

import { parseQuadrantChart } from '../quadrant/parser.ts'
import type { QuadrantChart } from '../quadrant/types.ts'
import type { AsciiConfig, AsciiTheme, ColorMode, CharRole, Canvas, RoleCanvas } from './types.ts'
import { colorizeText } from './ansi.ts'

// ============================================================================
// Constants
// ============================================================================

const PLOT_SIZE = 40  // square plot area (characters)

const UNI = {
  hLine: '─',
  vLine: '│',
  cross: '┼',
  tl: '┌',
  tr: '┐',
  bl: '└',
  br: '┘',
  teeDown: '┬',
  teeUp: '┴',
  teeRight: '├',
  teeLeft: '┤',
  dot: '●',
} as const

const ASC = {
  hLine: '-',
  vLine: '|',
  cross: '+',
  tl: '+',
  tr: '+',
  bl: '+',
  br: '+',
  teeDown: '+',
  teeUp: '+',
  teeRight: '+',
  teeLeft: '+',
  dot: '*',
} as const

// ============================================================================
// Public API
// ============================================================================

export function renderQuadrantAscii(
  text: string,
  config: AsciiConfig,
  colorMode: ColorMode,
  theme: AsciiTheme,
): string {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('%%'))
  const chart = parseQuadrantChart(lines)
  const ch = config.useAscii ? ASC : UNI

  return renderChart(chart, ch, colorMode, theme)
}

// ============================================================================
// Rendering
// ============================================================================

function renderChart(
  chart: QuadrantChart,
  ch: typeof UNI | typeof ASC,
  colorMode: ColorMode,
  theme: AsciiTheme,
): string {
  const plotW = PLOT_SIZE
  const plotH = PLOT_SIZE / 2  // half-height for aspect ratio

  // Gutters
  const yLabelW = Math.max(
    chart.yAxis.bottom?.length ?? 0,
    chart.yAxis.top?.length ?? 0,
    6,
  ) + 1
  const hasTitle = !!chart.title

  // Canvas dimensions
  const plotLeft = yLabelW + 1
  const plotTop = (hasTitle ? 2 : 0)

  // Ensure right-side point labels (e.g. points near x=1) are not cut off.
  // Base width keeps one-char gutter beyond the border; we expand if labels need more.
  const baseW = plotLeft + plotW + 2
  let requiredW = baseW
  for (const pt of chart.points) {
    const col = plotLeft + 1 + Math.round(pt.x * (plotW - 3))
    const labelCol = col + 2
    const labelRightExclusive = labelCol + pt.name.length
    if (labelRightExclusive + 1 > requiredW) {
      requiredW = labelRightExclusive + 1
    }
  }
  const totalW = requiredW
  const totalH = plotTop + plotH + 3  // +3 for x-axis line, x-labels, gap

  // Create canvas
  const canvas: Canvas = Array.from({ length: totalW }, () =>
    Array.from({ length: totalH }, () => ' ')
  )
  const roles: RoleCanvas = Array.from({ length: totalW }, () =>
    Array.from<CharRole | null>({ length: totalH }).fill(null)
  )

  const set = (row: number, col: number, char: string, role: CharRole) => {
    if (col >= 0 && col < totalW && row >= 0 && row < totalH) {
      canvas[col]![row] = char
      roles[col]![row] = role
    }
  }

  const writeText = (row: number, startCol: number, text: string, role: CharRole) => {
    for (let i = 0; i < text.length; i++) {
      set(row, startCol + i, text[i]!, role)
    }
  }

  // 1. Title
  if (hasTitle) {
    const title = chart.title!
    writeText(0, Math.floor(totalW / 2 - title.length / 2), title, 'text')
  }

  // 2. Plot border + cross-hair dividers
  const midRow = plotTop + Math.floor(plotH / 2)
  const midCol = plotLeft + Math.floor(plotW / 2)
  const lastRow = plotTop + plotH - 1
  const lastCol = plotLeft + plotW - 1

  // Top and bottom borders
  for (let c = plotLeft + 1; c < lastCol; c++) {
    set(plotTop, c, ch.hLine, 'border')
    set(lastRow, c, ch.hLine, 'border')
  }
  // Left and right borders
  for (let r = plotTop + 1; r < lastRow; r++) {
    set(r, plotLeft, ch.vLine, 'border')
    set(r, lastCol, ch.vLine, 'border')
  }
  // Corners
  set(plotTop, plotLeft, ch.tl, 'border')
  set(plotTop, lastCol, ch.tr, 'border')
  set(lastRow, plotLeft, ch.bl, 'border')
  set(lastRow, lastCol, ch.br, 'border')

  // Horizontal divider (mid row)
  for (let c = plotLeft + 1; c < lastCol; c++) {
    set(midRow, c, ch.hLine, 'border')
  }
  // Vertical divider (mid col)
  for (let r = plotTop + 1; r < lastRow; r++) {
    set(r, midCol, ch.vLine, 'border')
  }
  // Center cross
  set(midRow, midCol, ch.cross, 'border')
  // Tee junctions where dividers meet the border
  set(midRow, plotLeft, ch.teeRight, 'border')
  set(midRow, lastCol, ch.teeLeft, 'border')
  set(plotTop, midCol, ch.teeDown, 'border')
  set(lastRow, midCol, ch.teeUp, 'border')

  // 3. Quadrant labels (centered in each quadrant)
  const qPositions: [number, number][] = [
    // Q1 = top-right
    [plotTop + Math.floor(plotH / 4), plotLeft + Math.floor(plotW * 3 / 4)],
    // Q2 = top-left
    [plotTop + Math.floor(plotH / 4), plotLeft + Math.floor(plotW / 4)],
    // Q3 = bottom-left
    [plotTop + Math.floor(plotH * 3 / 4), plotLeft + Math.floor(plotW / 4)],
    // Q4 = bottom-right
    [plotTop + Math.floor(plotH * 3 / 4), plotLeft + Math.floor(plotW * 3 / 4)],
  ]

  for (let qi = 0; qi < 4; qi++) {
    const label = chart.quadrants[qi]
    if (label) {
      const [qr, qc] = qPositions[qi]!
      const truncated = label.length > Math.floor(plotW / 2) - 2
        ? label.slice(0, Math.floor(plotW / 2) - 4) + '..'
        : label
      writeText(qr!, qc! - Math.floor(truncated.length / 2), truncated, 'text')
    }
  }

  // 4. Axis labels (centered on their respective axis halves)
  const halfW = Math.floor(plotW / 2)
  if (chart.xAxis.left) {
    const label = chart.xAxis.left
    const centerCol = plotLeft + Math.floor(halfW / 2) - Math.floor(label.length / 2)
    writeText(lastRow + 1, Math.max(plotLeft, centerCol), label, 'text')
  }
  if (chart.xAxis.right) {
    const label = chart.xAxis.right
    const centerCol = plotLeft + halfW + Math.floor(halfW / 2) - Math.floor(label.length / 2)
    writeText(lastRow + 1, Math.max(midCol + 1, centerCol), label, 'text')
  }
  if (chart.yAxis.top) {
    const label = chart.yAxis.top
    const centerRow = plotTop + Math.floor((midRow - plotTop) / 2)
    writeText(centerRow, Math.max(0, yLabelW - label.length), label, 'text')
  }
  if (chart.yAxis.bottom) {
    const label = chart.yAxis.bottom
    const centerRow = midRow + Math.floor((lastRow - midRow) / 2)
    writeText(centerRow, Math.max(0, yLabelW - label.length), label, 'text')
  }

  // 5. Data points
  for (const pt of chart.points) {
    // Map [0,1] to plot interior (1px inset from border, y inverted: 0=bottom, 1=top)
    const col = plotLeft + 1 + Math.round(pt.x * (plotW - 3))
    const row = plotTop + 1 + Math.round((1 - pt.y) * (plotH - 3))
    set(row, col, ch.dot, 'arrow')

    // Label to the right of the point
    const labelCol = col + 2
    if (labelCol + pt.name.length <= totalW) {
      writeText(row, labelCol, pt.name, 'text')
    }
  }

  return canvasToString(canvas, roles, colorMode, theme)
}

// ============================================================================
// Canvas → string
// ============================================================================

function canvasToString(
  canvas: Canvas,
  roles: RoleCanvas,
  colorMode: ColorMode,
  theme: AsciiTheme,
): string {
  if (canvas.length === 0) return ''
  const height = canvas[0]!.length
  const width = canvas.length
  const lines: string[] = []

  for (let row = 0; row < height; row++) {
    const chars: string[] = []
    const rowRoles: (CharRole | null)[] = []
    for (let col = 0; col < width; col++) {
      chars.push(canvas[col]![row]!)
      rowRoles.push(roles[col]![row]!)
    }
    let end = chars.length - 1
    while (end >= 0 && chars[end] === ' ') end--
    if (end < 0) {
      lines.push('')
    } else {
      lines.push(colorizeRow(chars.slice(0, end + 1), rowRoles.slice(0, end + 1), theme, colorMode))
    }
  }

  while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop()
  return lines.join('\n')
}

function roleToHex(role: CharRole, theme: AsciiTheme): string {
  switch (role) {
    case 'text': return theme.fg
    case 'border': return theme.border
    case 'line': return theme.line
    case 'arrow': return theme.arrow
    case 'corner': return theme.corner ?? theme.line
    case 'junction': return theme.junction ?? theme.border
    default: return theme.fg
  }
}

function colorizeRow(
  chars: string[],
  roles: (CharRole | null)[],
  theme: AsciiTheme,
  mode: ColorMode,
): string {
  if (mode === 'none') return chars.join('')
  let result = ''
  let currentColor: string | null = null
  let buffer = ''

  for (let i = 0; i < chars.length; i++) {
    const char = chars[i]!
    if (char === ' ') {
      if (buffer.length > 0) {
        result += currentColor ? colorizeText(buffer, currentColor, mode) : buffer
        buffer = ''
        currentColor = null
      }
      result += ' '
      continue
    }
    const roleVal = roles[i] ?? null
    const color = roleVal ? roleToHex(roleVal, theme) : null
    if (color === currentColor) {
      buffer += char
    } else {
      if (buffer.length > 0) {
        result += currentColor ? colorizeText(buffer, currentColor, mode) : buffer
      }
      buffer = char
      currentColor = color
    }
  }
  if (buffer.length > 0) {
    result += currentColor ? colorizeText(buffer, currentColor, mode) : buffer
  }
  return result
}
