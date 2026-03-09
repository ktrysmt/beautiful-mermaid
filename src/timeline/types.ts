// ============================================================================
// Timeline diagram types
// ============================================================================

/** Parsed timeline (output of parser) */
export interface TimelineDiagram {
  title?: string
  sections: TimelineSection[]
}

export interface TimelineSection {
  name?: string
  periods: TimelinePeriod[]
}

export interface TimelinePeriod {
  time: string
  events: string[]
}

// ============================================================================
// Positioned types (output of layout, input to renderer)
// ============================================================================

export interface PositionedTimelineDiagram {
  width: number
  height: number
  title?: { text: string; x: number; y: number }
  sections: PositionedTimelineSection[]
  /** Connecting lines between period boxes */
  connectors: { x1: number; y1: number; x2: number; y2: number }[]
}

export interface PositionedTimelineSection {
  name?: string
  /** Section label position */
  labelX: number
  labelY: number
  /** Section background rect */
  bgX: number
  bgY: number
  bgW: number
  bgH: number
  periods: PositionedTimelinePeriod[]
}

export interface PositionedTimelinePeriod {
  time: string
  /** Period box position */
  boxX: number
  boxY: number
  boxW: number
  boxH: number
  /** Event card positions */
  events: PositionedTimelineEvent[]
}

export interface PositionedTimelineEvent {
  text: string
  x: number
  y: number
  width: number
  height: number
}
