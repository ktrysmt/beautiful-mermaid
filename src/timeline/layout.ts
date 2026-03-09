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
// Horizontal layout: periods as boxes connected by a line, events stacked
// below each period. Sections group periods with a label above.
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
  periodBoxH: 36,
  periodBoxMinW: 80,
  periodBoxPadX: 16,
  /** Event card dimensions */
  eventCardH: 28,
  eventCardMinW: 80,
  eventCardPadX: 12,
  /** Spacing */
  periodGap: 32,
  eventGap: 6,
  periodToEventGap: 16,
  sectionLabelGap: 12,
  sectionGap: 40,
  connectorY: 0, // computed: vertical center of period boxes
} as const

export function layoutTimeline(
  diagram: TimelineDiagram,
  _options: RenderOptions = {},
): PositionedTimelineDiagram {
  const hasTitle = !!diagram.title
  const sections: PositionedTimelineSection[] = []
  const connectors: PositionedTimelineDiagram['connectors'] = []

  let cursorY = TL.padding + (hasTitle ? TL.titleHeight : 0)

  for (const section of diagram.sections) {
    const hasSectionLabel = !!section.name
    const sectionStartY = cursorY
    if (hasSectionLabel) {
      cursorY += TL.sectionFontSize + TL.sectionLabelGap
    }

    const periodBoxY = cursorY
    cursorY += TL.periodBoxH + TL.periodToEventGap

    // Compute period widths and event heights
    const periodLayouts: {
      boxW: number
      events: { text: string; w: number }[]
      maxEventH: number
    }[] = []

    let maxEventsHeight = 0

    for (const period of section.periods) {
      const periodTextW = estimateTextWidth(period.time, TL.periodFontSize, TL.periodFontWeight)
      const boxW = Math.max(TL.periodBoxMinW, periodTextW + TL.periodBoxPadX * 2)

      const events = period.events.map(e => {
        const ew = estimateTextWidth(e, TL.eventFontSize, TL.eventFontWeight)
        return { text: e, w: Math.max(TL.eventCardMinW, ew + TL.eventCardPadX * 2) }
      })

      const eventsTotalH = events.length > 0
        ? events.length * TL.eventCardH + (events.length - 1) * TL.eventGap
        : 0

      maxEventsHeight = Math.max(maxEventsHeight, eventsTotalH)
      periodLayouts.push({ boxW, events, maxEventH: eventsTotalH })
    }

    // Position periods horizontally
    const positionedPeriods: PositionedTimelinePeriod[] = []
    let cursorX = TL.padding

    for (let i = 0; i < section.periods.length; i++) {
      const period = section.periods[i]!
      const pl = periodLayouts[i]!

      // The column width is max of period box and all event widths
      const colW = Math.max(pl.boxW, ...pl.events.map(e => e.w))

      const boxX = cursorX + (colW - pl.boxW) / 2

      // Period box
      const positioned: PositionedTimelinePeriod = {
        time: period.time,
        boxX,
        boxY: periodBoxY,
        boxW: pl.boxW,
        boxH: TL.periodBoxH,
        events: [],
      }

      // Events below
      let eventY = periodBoxY + TL.periodBoxH + TL.periodToEventGap
      for (const ev of pl.events) {
        const eventX = cursorX + (colW - ev.w) / 2
        positioned.events.push({
          text: ev.text,
          x: eventX,
          y: eventY,
          width: ev.w,
          height: TL.eventCardH,
        })
        eventY += TL.eventCardH + TL.eventGap
      }

      positionedPeriods.push(positioned)

      // Connector to next period
      if (i < section.periods.length - 1) {
        const fromX = boxX + pl.boxW
        const toXNext = cursorX + colW + TL.periodGap
        const connY = periodBoxY + TL.periodBoxH / 2
        connectors.push({
          x1: fromX,
          y1: connY,
          x2: toXNext,
          y2: connY,
        })
      }

      cursorX += colW + TL.periodGap
    }

    // Fix connectors: the toX should be the left edge of the next period box
    // We'll fix after all periods are positioned
    for (let i = 0; i < connectors.length; i++) {
      const nextPeriod = positionedPeriods[i + 1]
      if (nextPeriod) {
        connectors[i]!.x2 = nextPeriod.boxX
      }
    }

    const sectionW = cursorX - TL.periodGap - TL.padding
    const sectionH = TL.periodBoxH + TL.periodToEventGap + maxEventsHeight

    sections.push({
      name: section.name,
      labelX: TL.padding,
      labelY: sectionStartY + TL.sectionFontSize,
      bgX: TL.padding - 8,
      bgY: sectionStartY - 4,
      bgW: sectionW + 16,
      bgH: (hasSectionLabel ? TL.sectionFontSize + TL.sectionLabelGap : 0) + sectionH + 12,
      periods: positionedPeriods,
    })

    cursorY += maxEventsHeight + TL.sectionGap
  }

  // Compute total dimensions
  const maxX = Math.max(
    ...sections.flatMap(s => s.periods.map(p => {
      const eventMaxX = p.events.length > 0
        ? Math.max(...p.events.map(e => e.x + e.width))
        : 0
      return Math.max(p.boxX + p.boxW, eventMaxX)
    })),
    200
  )
  const totalW = maxX + TL.padding
  const totalH = cursorY - TL.sectionGap + TL.padding

  const title = hasTitle
    ? { text: diagram.title!, x: totalW / 2, y: TL.padding + TL.titleFontSize }
    : undefined

  return { width: totalW, height: totalH, title, sections, connectors }
}
