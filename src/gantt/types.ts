// ============================================================================
// Gantt chart types
// ============================================================================

/** Parsed gantt chart (output of parser) */
export interface GanttChart {
  title?: string
  dateFormat: string
  axisFormat?: string
  excludes: string[]
  sections: GanttSection[]
}

export interface GanttSection {
  name: string
  tasks: GanttTask[]
}

export interface GanttTask {
  name: string
  id?: string
  tags: GanttTag[]
  startDate?: Date
  endDate?: Date
  afterId?: string
  duration?: string   // e.g. '5d', '2w'
}

export type GanttTag = 'done' | 'active' | 'crit' | 'milestone'

// ============================================================================
// Positioned types (output of layout, input to renderer)
// ============================================================================

export interface PositionedGanttChart {
  width: number
  height: number
  title?: { text: string; x: number; y: number }
  /** Time axis tick labels along the top */
  axisTicks: { label: string; x: number; y: number }[]
  /** Vertical grid lines at tick positions */
  gridLines: { x1: number; y1: number; x2: number; y2: number }[]
  /** Horizontal row lines inside the timeline plot */
  rowLines: { x1: number; y1: number; x2: number; y2: number }[]
  /** Plot area for the actual gantt timeline */
  plotArea: { x: number; y: number; width: number; height: number }
  sections: PositionedGanttSection[]
  /** Today marker line (optional) */
  todayLine?: { x: number; y1: number; y2: number }
}

export interface PositionedGanttSection {
  name: string
  labelX: number
  labelY: number
  bgX: number
  bgY: number
  bgW: number
  bgH: number
  tasks: PositionedGanttTask[]
}

export interface PositionedGanttTask {
  name: string
  sectionName: string
  tags: GanttTag[]
  /** Bar position */
  x: number
  y: number
  width: number
  height: number
  /** Full row hit-area / alignment info */
  rowX: number
  rowY: number
  rowW: number
  rowH: number
  /** Left-column row label */
  rowLabel: string
  rowLabelX: number
  rowLabelY: number
  /** Milestone renders as diamond instead of bar */
  isMilestone: boolean
  /** Tooltip / metadata */
  startLabel?: string
  endLabel?: string
  durationLabel?: string
  tooltipLabel: string
}
