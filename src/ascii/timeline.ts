// ============================================================================
// ASCII renderer — Timeline
//
// Renders timeline diagrams to ASCII/Unicode text art.
// Uses the parsed TimelineDiagram type directly (not positioned).
//
// Layout: horizontal timeline with period boxes connected by lines,
// event cards stacked below each period.
//
//   ┌──────────┐     ┌──────────┐     ┌──────────┐
//   │  2020 Q1 │─────│  2020 Q2 │─────│  2020 Q3 │
//   └──────────┘     └──────────┘     └──────────┘
//     Event A          Event B          Event C
//                      Event D
// ============================================================================

import { parseTimeline } from '../timeline/parser.ts'
import type { TimelineDiagram, TimelineSection, TimelinePeriod } from '../timeline/types.ts'
import type { AsciiConfig, AsciiTheme, ColorMode, CharRole, Canvas, RoleCanvas } from './types.ts'
import { colorizeText } from './ansi.ts'

// ============================================================================
// Constants
// ============================================================================

const BOX_PAD = 1         // padding inside period boxes
const COL_GAP = 5         // gap between period columns
const EVENT_GAP = 1       // vertical gap between event lines

const UNI = {
  hLine: '─',
  vLine: '│',
  tl: '┌',
  tr: '┐',
  bl: '└',
  br: '┘',
  connector: '─',
} as const

const ASC = {
  hLine: '-',
  vLine: '|',
  tl: '+',
  tr: '+',
  bl: '+',
  br: '+',
  connector: '-',
} as const

// ============================================================================
// Public API
// ============================================================================

export function renderTimelineAscii(
  text: string,
  config: AsciiConfig,
  colorMode: ColorMode,
  theme: AsciiTheme,
): string {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('%%'))
  const diagram = parseTimeline(lines)
  const ch = config.useAscii ? ASC : UNI

  return renderDiagram(diagram, ch, colorMode, theme)
}

// ============================================================================
// Rendering
// ============================================================================

function renderDiagram(
  diagram: TimelineDiagram,
  ch: typeof UNI | typeof ASC,
  colorMode: ColorMode,
  theme: AsciiTheme,
): string {
  // Flatten all periods across sections
  const allPeriods: { period: TimelinePeriod; sectionName?: string; sectionIdx: number }[] = []
  for (let si = 0; si < diagram.sections.length; si++) {
    const section = diagram.sections[si]!
    for (const period of section.periods) {
      allPeriods.push({ period, sectionName: section.name, sectionIdx: si })
    }
  }

  if (allPeriods.length === 0) return ''

  // Compute column widths
  const colWidths: number[] = allPeriods.map(({ period }) => {
    const timeW = period.time.length + BOX_PAD * 2 + 2 // +2 for border chars
    const maxEventW = period.events.reduce((max, e) => Math.max(max, e.length), 0)
    return Math.max(timeW, maxEventW + 2)
  })

  const hasTitle = !!diagram.title
  const hasSections = diagram.sections.some(s => s.name)

  // Row positions
  const titleRow = 0
  const sectionRow = hasTitle ? 2 : 0
  const boxTopRow = (hasTitle ? 2 : 0) + (hasSections ? 2 : 0)
  const boxH = 3 // top border, text, bottom border
  const boxBottomRow = boxTopRow + boxH - 1
  const eventStartRow = boxBottomRow + 1

  // Compute max events across all periods
  const maxEvents = allPeriods.reduce((max, { period }) => Math.max(max, period.events.length), 0)

  // Total dimensions
  const totalH = eventStartRow + maxEvents + 1
  let totalW = 0
  for (let i = 0; i < colWidths.length; i++) {
    if (i > 0) totalW += COL_GAP
    totalW += colWidths[i]!
  }
  totalW = Math.max(totalW, (diagram.title?.length ?? 0) + 4)

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
    const title = diagram.title!
    writeText(titleRow, Math.floor(totalW / 2 - title.length / 2), title, 'text')
  }

  // 2. Draw period boxes and events
  let colX = 0
  let prevBoxRightX = -1

  for (let i = 0; i < allPeriods.length; i++) {
    const { period, sectionName, sectionIdx } = allPeriods[i]!
    const w = colWidths[i]!
    const boxLeft = colX
    const boxRight = colX + w - 1

    // Section label (only for first period of each section)
    if (hasSections && sectionName) {
      const isFirstOfSection = i === 0 || allPeriods[i - 1]!.sectionIdx !== sectionIdx
      if (isFirstOfSection) {
        writeText(sectionRow, colX, sectionName, 'text')
      }
    }

    // Connector line from previous box
    if (prevBoxRightX >= 0) {
      const connRow = boxTopRow + 1 // middle of box
      for (let c = prevBoxRightX + 1; c < boxLeft; c++) {
        set(connRow, c, ch.connector, 'line')
      }
    }

    // Box top border
    set(boxTopRow, boxLeft, ch.tl, 'border')
    set(boxTopRow, boxRight, ch.tr, 'border')
    for (let c = boxLeft + 1; c < boxRight; c++) {
      set(boxTopRow, c, ch.hLine, 'border')
    }

    // Box sides
    set(boxTopRow + 1, boxLeft, ch.vLine, 'border')
    set(boxTopRow + 1, boxRight, ch.vLine, 'border')

    // Box bottom border
    set(boxBottomRow, boxLeft, ch.bl, 'border')
    set(boxBottomRow, boxRight, ch.br, 'border')
    for (let c = boxLeft + 1; c < boxRight; c++) {
      set(boxBottomRow, c, ch.hLine, 'border')
    }

    // Period text (centered in box)
    const textStart = boxLeft + 1 + Math.floor((w - 2 - period.time.length) / 2)
    writeText(boxTopRow + 1, Math.max(boxLeft + 1, textStart), period.time, 'text')

    // Events below box
    for (let ei = 0; ei < period.events.length; ei++) {
      const eventText = period.events[ei]!
      const eventCol = colX + Math.floor((w - eventText.length) / 2)
      writeText(eventStartRow + ei, Math.max(0, eventCol), eventText, 'arrow')
    }

    prevBoxRightX = boxRight
    colX += w + COL_GAP
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
