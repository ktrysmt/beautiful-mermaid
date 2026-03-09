import type { TimelineDiagram, TimelineSection, TimelinePeriod } from './types.ts'

// ============================================================================
// Timeline diagram parser
//
// Line-by-line regex parsing of timeline syntax.
//
// Supported:
//   timeline
//   title <text>
//   section <name>
//   <time> : <event>
//          : <event>     (continuation — adds to current period)
// ============================================================================

const TITLE_RE = /^title\s+(.+)$/i
const SECTION_RE = /^section\s+(.+)$/i
const PERIOD_RE = /^(.+?)\s*:\s*(.+)$/
const CONTINUATION_RE = /^\s*:\s*(.+)$/

export function parseTimeline(lines: string[]): TimelineDiagram {
  const diagram: TimelineDiagram = {
    sections: [],
  }

  let currentSection: TimelineSection = { periods: [] }
  let currentPeriod: TimelinePeriod | null = null

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || /^timeline\s*$/i.test(trimmed) || trimmed.startsWith('%%')) continue

    let m: RegExpMatchArray | null

    if ((m = trimmed.match(TITLE_RE))) {
      diagram.title = m[1]!.trim()
      continue
    }

    if ((m = trimmed.match(SECTION_RE))) {
      // Flush current section if it has periods
      if (currentSection.periods.length > 0) {
        diagram.sections.push(currentSection)
      }
      currentSection = { name: m[1]!.trim(), periods: [] }
      currentPeriod = null
      continue
    }

    // Continuation event (starts with : )
    if ((m = trimmed.match(CONTINUATION_RE)) && currentPeriod) {
      currentPeriod.events.push(m[1]!.trim())
      continue
    }

    // New period: time : event
    if ((m = trimmed.match(PERIOD_RE))) {
      currentPeriod = {
        time: m[1]!.trim(),
        events: [m[2]!.trim()],
      }
      currentSection.periods.push(currentPeriod)
      continue
    }

    // Bare line (no colon) — treat as a period with no events initially
    // or as an event continuation if we have a current period
    if (currentPeriod) {
      currentPeriod.events.push(trimmed)
    } else {
      currentPeriod = { time: trimmed, events: [] }
      currentSection.periods.push(currentPeriod)
    }
  }

  // Flush last section
  if (currentSection.periods.length > 0) {
    diagram.sections.push(currentSection)
  }

  return diagram
}
