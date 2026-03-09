// ============================================================================
// Quadrant chart types
// ============================================================================

/** Parsed quadrant chart (output of parser) */
export interface QuadrantChart {
  title?: string
  xAxis: { left?: string; right?: string }
  yAxis: { bottom?: string; top?: string }
  /** Quadrant labels: [Q1 top-right, Q2 top-left, Q3 bottom-left, Q4 bottom-right] */
  quadrants: [string?, string?, string?, string?]
  points: QuadrantPoint[]
}

export interface QuadrantPoint {
  name: string
  x: number   // 0–1
  y: number   // 0–1
  style?: {
    color?: string
    radius?: number
    strokeColor?: string
    strokeWidth?: number
  }
}

// ============================================================================
// Positioned types (output of layout, input to renderer)
// ============================================================================

export interface PositionedQuadrantChart {
  width: number
  height: number
  title?: { text: string; x: number; y: number }
  plotArea: { x: number; y: number; width: number; height: number }
  /** Axis labels at the four edges */
  xAxis: { left?: PositionedLabel; right?: PositionedLabel }
  yAxis: { bottom?: PositionedLabel; top?: PositionedLabel }
  /** Quadrant label positions (centered in each quadrant) */
  quadrantLabels: PositionedLabel[]
  /** Divider lines (vertical + horizontal at 0.5) */
  dividers: { x1: number; y1: number; x2: number; y2: number }[]
  /** Data points */
  points: PositionedQuadrantPoint[]
}

export interface PositionedLabel {
  text: string
  x: number
  y: number
  textAnchor?: 'start' | 'middle' | 'end'
}

export interface PositionedQuadrantPoint {
  name: string
  cx: number
  cy: number
  radius: number
  labelX: number
  labelY: number
  style?: QuadrantPoint['style']
}
