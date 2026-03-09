import type { QuadrantChart, QuadrantPoint } from './types.ts'

// ============================================================================
// Quadrant chart parser
//
// Line-by-line regex parsing of quadrantChart syntax.
//
// Supported:
//   quadrantChart
//   title <text>
//   x-axis <left> --> <right>
//   y-axis <bottom> --> <top>
//   quadrant-1 <text>  (top-right)
//   quadrant-2 <text>  (top-left)
//   quadrant-3 <text>  (bottom-left)
//   quadrant-4 <text>  (bottom-right)
//   <Name>: [x, y]
//   <Name>: [x, y] radius: N, color: #hex, ...
// ============================================================================

const TITLE_RE = /^title\s+(.+)$/i
const X_AXIS_RE = /^x-axis\s+(.+?)(?:\s*-->\s*(.+))?$/i
const Y_AXIS_RE = /^y-axis\s+(.+?)(?:\s*-->\s*(.+))?$/i
const QUADRANT_RE = /^quadrant-([1-4])\s+(.+)$/i
const POINT_RE = /^(.+?):\s*\[\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\](.*)$/
const STYLE_RE = /(\w[\w-]*):\s*([^,]+)/g

export function parseQuadrantChart(lines: string[]): QuadrantChart {
  const chart: QuadrantChart = {
    xAxis: {},
    yAxis: {},
    quadrants: [undefined, undefined, undefined, undefined],
    points: [],
  }

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || /^quadrantchart\s*$/i.test(trimmed) || trimmed.startsWith('%%')) continue

    let m: RegExpMatchArray | null

    if ((m = trimmed.match(TITLE_RE))) {
      chart.title = m[1]!.trim()
      continue
    }

    if ((m = trimmed.match(X_AXIS_RE))) {
      chart.xAxis.left = m[1]!.trim()
      if (m[2]) chart.xAxis.right = m[2].trim()
      continue
    }

    if ((m = trimmed.match(Y_AXIS_RE))) {
      chart.yAxis.bottom = m[1]!.trim()
      if (m[2]) chart.yAxis.top = m[2].trim()
      continue
    }

    if ((m = trimmed.match(QUADRANT_RE))) {
      const idx = parseInt(m[1]!, 10) - 1
      chart.quadrants[idx] = m[2]!.trim()
      continue
    }

    if ((m = trimmed.match(POINT_RE))) {
      const point: QuadrantPoint = {
        name: m[1]!.trim(),
        x: clamp(parseFloat(m[2]!)),
        y: clamp(parseFloat(m[3]!)),
      }

      // Parse inline styles
      const styleStr = m[4]!.trim()
      if (styleStr) {
        const style: QuadrantPoint['style'] = {}
        let sm: RegExpExecArray | null
        STYLE_RE.lastIndex = 0
        while ((sm = STYLE_RE.exec(styleStr))) {
          const key = sm[1]!.trim()
          const val = sm[2]!.trim()
          if (key === 'radius') style.radius = parseFloat(val)
          else if (key === 'color') style.color = val
          else if (key === 'stroke-color') style.strokeColor = val
          else if (key === 'stroke-width') style.strokeWidth = parseFloat(val)
        }
        if (Object.keys(style).length > 0) point.style = style
      }

      chart.points.push(point)
    }
  }

  return chart
}

function clamp(v: number): number {
  return Math.max(0, Math.min(1, v))
}
