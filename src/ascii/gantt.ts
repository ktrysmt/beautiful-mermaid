// ============================================================================
// ASCII renderer — Gantt Chart
//
// Renders gantt diagrams to ASCII/Unicode text art.
// Uses the parsed GanttChart type directly (not positioned).
//
// Layout: section labels on the left, task bars on the right,
// date axis along the top.
//
//   Section A
//     Task 1   ████████████
//     Task 2          ██████████
//   Section B
//     Task 3     ████████
//               ─────────────────────────
//               Jan    Feb    Mar    Apr
// ============================================================================

import { parseGanttChart } from '../gantt/parser.ts'
import type { GanttChart, GanttTask, GanttTag } from '../gantt/types.ts'
import type { AsciiConfig, AsciiTheme, ColorMode, CharRole, Canvas, RoleCanvas } from './types.ts'
import { colorizeText } from './ansi.ts'

// ============================================================================
// Constants
// ============================================================================

const PLOT_WIDTH = 60     // width of the timeline area
const LABEL_WIDTH = 20    // max width for task names
const BAR_CHAR_DONE = '░'
const BAR_CHAR_ACTIVE = '█'
const BAR_CHAR_CRIT = '▓'
const BAR_CHAR_DEFAULT = '█'
const MILESTONE_CHAR = '◆'

const UNI = {
  hLine: '─',
  bar: BAR_CHAR_DEFAULT,
  barDone: BAR_CHAR_DONE,
  barActive: BAR_CHAR_ACTIVE,
  barCrit: BAR_CHAR_CRIT,
  milestone: MILESTONE_CHAR,
} as const

const ASC = {
  hLine: '-',
  bar: '#',
  barDone: '.',
  barActive: '#',
  barCrit: '=',
  milestone: '<>',
} as const

// ============================================================================
// Public API
// ============================================================================

export function renderGanttAscii(
  text: string,
  config: AsciiConfig,
  colorMode: ColorMode,
  theme: AsciiTheme,
): string {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('%%'))
  const chart = parseGanttChart(lines)
  const ch = config.useAscii ? ASC : UNI

  return renderChart(chart, ch, colorMode, theme)
}

// ============================================================================
// Rendering
// ============================================================================

function renderChart(
  chart: GanttChart,
  ch: typeof UNI | typeof ASC,
  colorMode: ColorMode,
  theme: AsciiTheme,
): string {
  // Gather all tasks with dates
  const allTasks: GanttTask[] = []
  for (const section of chart.sections) {
    for (const task of section.tasks) {
      allTasks.push(task)
    }
  }

  if (allTasks.length === 0) return chart.title ?? ''

  // Compute global date range
  let minDate = Infinity
  let maxDate = -Infinity
  for (const task of allTasks) {
    if (task.startDate) minDate = Math.min(minDate, task.startDate.getTime())
    if (task.endDate) maxDate = Math.max(maxDate, task.endDate.getTime())
  }

  if (!isFinite(minDate) || !isFinite(maxDate)) {
    return chart.title ?? '(no dates)'
  }

  // Add 2% padding
  const range = maxDate - minDate || 86400000 // at least 1 day
  minDate -= range * 0.02
  maxDate += range * 0.02
  const totalRange = maxDate - minDate

  const dateToCol = (d: Date): number => {
    const t = (d.getTime() - minDate) / totalRange
    return Math.round(t * (PLOT_WIDTH - 1))
  }

  // Compute label column width
  const labelW = Math.min(
    LABEL_WIDTH,
    Math.max(10, ...allTasks.map(t => t.name.length + 2)),
  )

  const hasTitle = !!chart.title
  const plotLeft = labelW + 2

  // Count total rows
  let totalRows = 0
  for (const section of chart.sections) {
    totalRows += 1 // section header
    totalRows += section.tasks.length
  }

  // Canvas dimensions
  const totalW = plotLeft + PLOT_WIDTH + 1
  const axisRow = (hasTitle ? 2 : 0) + totalRows
  const tickRow = axisRow + 1
  const totalH = tickRow + 2

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

  // 2. Sections + task bars
  let currentRow = hasTitle ? 2 : 0

  for (const section of chart.sections) {
    // Section header
    const sectionLabel = section.name.length > labelW
      ? section.name.slice(0, labelW - 2) + '..'
      : section.name
    writeText(currentRow, 0, sectionLabel, 'text')
    currentRow++

    for (const task of section.tasks) {
      // Task label (indented)
      const taskLabel = task.name.length > labelW - 2
        ? '  ' + task.name.slice(0, labelW - 4) + '..'
        : '  ' + task.name
      writeText(currentRow, 0, taskLabel, 'text')

      // Task bar
      if (task.startDate && task.endDate) {
        const isMilestone = task.tags.includes('milestone')
        const startCol = plotLeft + dateToCol(task.startDate)
        const endCol = plotLeft + dateToCol(task.endDate)

        if (isMilestone) {
          set(currentRow, startCol, ch.milestone, 'arrow')
        } else {
          const barChar = getBarChar(task.tags, ch)
          const barRole: CharRole = task.tags.includes('crit') ? 'arrow' : 'line'
          for (let c = startCol; c <= endCol; c++) {
            set(currentRow, c, barChar, barRole)
          }
        }
      }

      currentRow++
    }
  }

  // 3. Axis line
  for (let c = plotLeft; c < plotLeft + PLOT_WIDTH; c++) {
    set(axisRow, c, ch.hLine, 'border')
  }

  // 4. Axis tick labels
  const ticks = computeAxisTicks(new Date(minDate), new Date(maxDate))
  for (const tick of ticks) {
    const col = plotLeft + dateToCol(tick.date)
    const label = tick.label
    const labelStart = col - Math.floor(label.length / 2)
    writeText(tickRow, Math.max(plotLeft, labelStart), label, 'text')
  }

  return canvasToString(canvas, roles, colorMode, theme)
}

function getBarChar(tags: GanttTag[], ch: typeof UNI | typeof ASC): string {
  if (tags.includes('done')) return ch.barDone
  if (tags.includes('active')) return ch.barActive
  if (tags.includes('crit')) return ch.barCrit
  return ch.bar
}

// ============================================================================
// Axis ticks
// ============================================================================

interface AxisTick {
  date: Date
  label: string
}

function computeAxisTicks(start: Date, end: Date): AxisTick[] {
  const rangeMs = end.getTime() - start.getTime()
  const rangeDays = rangeMs / 86400000
  const ticks: AxisTick[] = []

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

  if (rangeDays <= 14) {
    // Day ticks
    const d = new Date(start)
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() + 1)
    while (d.getTime() <= end.getTime()) {
      ticks.push({ date: new Date(d), label: `${d.getDate()}` })
      d.setDate(d.getDate() + 1)
    }
  } else if (rangeDays <= 90) {
    // Week ticks
    const d = new Date(start)
    d.setHours(0, 0, 0, 0)
    // Align to Monday
    d.setDate(d.getDate() + ((8 - d.getDay()) % 7))
    while (d.getTime() <= end.getTime()) {
      ticks.push({ date: new Date(d), label: `${months[d.getMonth()]!} ${d.getDate()}` })
      d.setDate(d.getDate() + 7)
    }
  } else if (rangeDays <= 730) {
    // Month ticks
    const d = new Date(start)
    d.setHours(0, 0, 0, 0)
    d.setDate(1)
    d.setMonth(d.getMonth() + 1)
    while (d.getTime() <= end.getTime()) {
      ticks.push({ date: new Date(d), label: months[d.getMonth()]! })
      d.setMonth(d.getMonth() + 1)
    }
  } else {
    // Quarter ticks
    const d = new Date(start)
    d.setHours(0, 0, 0, 0)
    d.setDate(1)
    d.setMonth(Math.ceil((d.getMonth() + 1) / 3) * 3)
    while (d.getTime() <= end.getTime()) {
      const q = Math.floor(d.getMonth() / 3) + 1
      ticks.push({ date: new Date(d), label: `Q${q} ${d.getFullYear()}` })
      d.setMonth(d.getMonth() + 3)
    }
  }

  return ticks
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
