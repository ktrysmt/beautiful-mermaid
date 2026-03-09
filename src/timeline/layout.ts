import type {
  TimelineDiagram, PositionedTimelineDiagram, PositionedTimelineSection,
  PositionedTimelinePeriod, PositionedTimelineEvent,
} from './types.ts'
import type { RenderOptions } from '../types.ts'
import { estimateTextWidth } from '../styles.ts'
import { CHART } from '../chart-constants.ts'
import { TYPOGRAPHY } from '../design-tokens.ts'

// ============================================================================
// Timeline diagram layout engine
//
// Horizontal timeline with alternating above/below event stacking.
// Matches the visual style of the official Mermaid timeline renderer:
//
//   [Section: Founding]     [Section: Growth]
//        ┊                       ┊
//   ┌─────────┐            ┌─────────┐
//   │ Event A │            │ Event C │       (above events — even periods)
//   └─────────┘            └─────────┘
//        ┊                       ┊
//   ╔═══════╗   ╔═══════╗  ╔═══════╗
// ──║ 2018  ║───║ 2019  ║──║ 2020  ║──────▸  (arrow line + period boxes)
//   ╚═══════╝   ╚═══════╝  ╚═══════╝
//                    ┊
//               ┌─────────┐
//               │ Event B │                  (below events — odd periods)
//               └─────────┘
// ============================================================================

const TL = {
  padding: CHART.padding,
  titleFontSize: CHART.titleFontSize,
  titleFontWeight: CHART.titleFontWeight,
  titleHeight: CHART.titleHeight,
  periodFontSize: CHART.labelFontSize,
  periodFontWeight: CHART.labelFontWeight,
  eventFontSize: TYPOGRAPHY.secondaryLabel.size,
  eventFontWeight: TYPOGRAPHY.secondaryLabel.weight,
  sectionFontSize: CHART.axisLabelFontSize,
  sectionFontWeight: TYPOGRAPHY.sectionHeading.weight,
  /** Period box dimensions */
  periodBoxH: 40,
  periodBoxMinW: 100,
  periodBoxPadX: 24,
  /** Event label dimensions (no boxes, just text) */
  eventCardH: 18,
  eventCardMinW: 80,
  eventCardPadX: 12,
  /** Spacing */
  periodGap: 20,
  eventGap: 3,
  periodToEventGap: 20,
  /** Section bar height and spacing */
  sectionBarH: 34,
  sectionBarGap: 20,
  /** Extra gap between the last period of one section and the first of the next */
  sectionBreakGap: 12,
  /** Arrow overshoot past last period box */
  arrowOvershoot: 28,
} as const

export function layoutTimeline(
  diagram: TimelineDiagram,
  _options: RenderOptions = {},
): PositionedTimelineDiagram {
  const hasTitle = !!diagram.title
  const hasSections = diagram.sections.some(s => s.name)

  // Flatten all periods with section metadata
  const allPeriods: { period: typeof diagram.sections[0]['periods'][0]; sectionIdx: number }[] = []
  for (let si = 0; si < diagram.sections.length; si++) {
    for (const period of diagram.sections[si]!.periods) {
      allPeriods.push({ period, sectionIdx: si })
    }
  }

  if (allPeriods.length === 0) {
    const emptyH = TL.padding * 2 + (hasTitle ? TL.titleHeight : 0)
    return {
      width: TL.padding * 2,
      height: emptyH,
      sections: [],
      arrow: { x1: 0, y1: 0, x2: 0, y2: 0 },
    }
  }

  // --- All events below the timeline ---

  let maxEventCount = 0
  for (let i = 0; i < allPeriods.length; i++) {
    maxEventCount = Math.max(maxEventCount, allPeriods[i]!.period.events.length)
  }

  const belowEventsH = maxEventCount > 0
    ? maxEventCount * TL.eventCardH + (maxEventCount - 1) * TL.eventGap
    : 0

  // --- Vertical positions (top to bottom) ---
  let y = TL.padding

  // Title
  if (hasTitle) y += TL.titleHeight + 12

  // Section bars
  const sectionBarY = y
  if (hasSections) y += TL.sectionBarH + TL.sectionBarGap

  // Period boxes + arrow line
  const periodBoxY = y
  const arrowY = y + TL.periodBoxH / 2
  y += TL.periodBoxH

  // Below events region
  if (belowEventsH > 0) y += TL.periodToEventGap
  const belowRegionTop = y
  y += belowEventsH

  const totalH = y + TL.padding

  // --- Compute period box widths ---
  const boxWidths: number[] = allPeriods.map(({ period }) => {
    const periodTextW = estimateTextWidth(period.time, TL.periodFontSize, TL.periodFontWeight)
    return Math.max(TL.periodBoxMinW, periodTextW + TL.periodBoxPadX * 2)
  })

  // --- Horizontal pass: position boxes by box width, events center below ---
  const positionedPeriods: (PositionedTimelinePeriod & { colX: number; colW: number })[] = []
  let cursorX = TL.padding

  for (let i = 0; i < allPeriods.length; i++) {
    const { period, sectionIdx } = allPeriods[i]!
    const boxW = boxWidths[i]!

    // Extra gap between sections
    if (i > 0 && allPeriods[i - 1]!.sectionIdx !== sectionIdx) {
      cursorX += TL.sectionBreakGap
    }

    const boxX = cursorX
    const centerX = cursorX + boxW / 2

    // Position events (all below, centered on period box)
    const events: PositionedTimelineEvent[] = []

    for (let ei = 0; ei < period.events.length; ei++) {
      const evText = period.events[ei]!
      const ew = estimateTextWidth(evText, TL.eventFontSize, TL.eventFontWeight)
      const evW = Math.max(TL.eventCardMinW, ew + TL.eventCardPadX * 2)
      const evY = belowRegionTop + ei * (TL.eventCardH + TL.eventGap)
      events.push({ text: evText, x: centerX - evW / 2, y: evY, width: evW, height: TL.eventCardH })
    }

    // Dashed drop connector
    let drop: PositionedTimelinePeriod['drop'] = undefined
    if (events.length > 0) {
      const nearestEventTop = events[0]!.y
      drop = { x: centerX, y1: periodBoxY + TL.periodBoxH, y2: nearestEventTop }
    }

    positionedPeriods.push({
      time: period.time,
      boxX,
      boxY: periodBoxY,
      boxW,
      boxH: TL.periodBoxH,
      events,
      eventsAbove: false,
      drop,
      colX: cursorX,
      colW: boxW,
    })

    cursorX += boxW + TL.periodGap
  }

  // --- Build sections ---
  const sections: PositionedTimelineSection[] = []

  for (let si = 0; si < diagram.sections.length; si++) {
    const section = diagram.sections[si]!
    const sectionPeriods = positionedPeriods.filter((_, idx) => allPeriods[idx]!.sectionIdx === si)
    if (sectionPeriods.length === 0) continue

    const firstP = sectionPeriods[0]!
    const lastP = sectionPeriods[sectionPeriods.length - 1]!
    const barX = firstP.boxX
    const barW = (lastP.boxX + lastP.boxW) - firstP.boxX

    // Clean periods (strip internal layout fields)
    const cleanPeriods: PositionedTimelinePeriod[] = sectionPeriods.map(p => ({
      time: p.time, boxX: p.boxX, boxY: p.boxY, boxW: p.boxW, boxH: p.boxH,
      events: p.events, eventsAbove: p.eventsAbove, drop: p.drop,
    }))

    sections.push({
      name: section.name,
      labelX: barX + barW / 2,
      labelY: sectionBarY + TL.sectionBarH / 2,
      bgX: barX,
      bgY: sectionBarY,
      bgW: barW,
      bgH: TL.sectionBarH,
      periods: cleanPeriods,
    })
  }

  // --- Total width ---
  const lastPeriod = positionedPeriods[positionedPeriods.length - 1]!
  const contentRight = lastPeriod.colX + lastPeriod.colW
  const totalW = contentRight + TL.arrowOvershoot + TL.padding

  // Arrow — spans exactly from first box to last box
  const firstBox = positionedPeriods[0]!
  const arrow = {
    x1: firstBox.boxX,
    y1: arrowY,
    x2: lastPeriod.boxX + lastPeriod.boxW,
    y2: arrowY,
  }

  const title = hasTitle
    ? { text: diagram.title!, x: totalW / 2, y: TL.padding + TL.titleFontSize }
    : undefined

  return { width: totalW, height: totalH, title, sections, arrow }
}
