import { describe, it, expect } from 'bun:test'
import { parseQuadrantChart } from '../quadrant/parser.ts'
import { renderMermaidSVG } from '../index.ts'

// ============================================================================
// Parser tests
// ============================================================================

describe('quadrant parser', () => {
  it('parses title', () => {
    const lines = ['quadrantChart', 'title My Matrix']
    const chart = parseQuadrantChart(lines)
    expect(chart.title).toBe('My Matrix')
  })

  it('parses axis labels (both directions)', () => {
    const lines = [
      'quadrantChart',
      'x-axis Low --> High',
      'y-axis Bottom --> Top',
    ]
    const chart = parseQuadrantChart(lines)
    expect(chart.xAxis.left).toBe('Low')
    expect(chart.xAxis.right).toBe('High')
    expect(chart.yAxis.bottom).toBe('Bottom')
    expect(chart.yAxis.top).toBe('Top')
  })

  it('parses single-side axis labels', () => {
    const lines = ['quadrantChart', 'x-axis Effort']
    const chart = parseQuadrantChart(lines)
    expect(chart.xAxis.left).toBe('Effort')
    expect(chart.xAxis.right).toBeUndefined()
  })

  it('parses quadrant labels', () => {
    const lines = [
      'quadrantChart',
      'quadrant-1 Do First',
      'quadrant-2 Schedule',
      'quadrant-3 Delegate',
      'quadrant-4 Eliminate',
    ]
    const chart = parseQuadrantChart(lines)
    expect(chart.quadrants[0]).toBe('Do First')
    expect(chart.quadrants[1]).toBe('Schedule')
    expect(chart.quadrants[2]).toBe('Delegate')
    expect(chart.quadrants[3]).toBe('Eliminate')
  })

  it('parses data points', () => {
    const lines = [
      'quadrantChart',
      'Feature A: [0.8, 0.9]',
      'Feature B: [0.3, 0.4]',
    ]
    const chart = parseQuadrantChart(lines)
    expect(chart.points).toHaveLength(2)
    expect(chart.points[0]!.name).toBe('Feature A')
    expect(chart.points[0]!.x).toBe(0.8)
    expect(chart.points[0]!.y).toBe(0.9)
    expect(chart.points[1]!.name).toBe('Feature B')
  })

  it('clamps point coordinates to [0,1]', () => {
    const lines = ['quadrantChart', 'Out: [1.5, -0.2]']
    const chart = parseQuadrantChart(lines)
    expect(chart.points[0]!.x).toBe(1)
    expect(chart.points[0]!.y).toBe(0)
  })

  it('parses point styles', () => {
    const lines = [
      'quadrantChart',
      'Styled: [0.5, 0.5] radius: 12, color: #ff0000',
    ]
    const chart = parseQuadrantChart(lines)
    expect(chart.points[0]!.style?.radius).toBe(12)
    expect(chart.points[0]!.style?.color).toBe('#ff0000')
  })

  it('ignores comments and empty lines', () => {
    const lines = ['quadrantChart', '%% comment', '', 'Point: [0.5, 0.5]']
    const chart = parseQuadrantChart(lines)
    expect(chart.points).toHaveLength(1)
  })
})

// ============================================================================
// Integration tests (render end-to-end)
// ============================================================================

describe('quadrant integration', () => {
  it('renders basic quadrant chart as SVG', () => {
    const svg = renderMermaidSVG(`quadrantChart
    title Test
    x-axis Low --> High
    y-axis Bottom --> Top
    quadrant-1 Q1
    Point A: [0.7, 0.8]`)

    expect(svg).toContain('<svg')
    expect(svg).toContain('Test')
    expect(svg).toContain('Q1')
    expect(svg).toContain('<circle')
    expect(svg).toContain('Point A')
  })

  it('renders empty quadrant chart without crashing', () => {
    const svg = renderMermaidSVG('quadrantChart')
    expect(svg).toContain('<svg')
  })

  it('renders chart with many points', () => {
    const svg = renderMermaidSVG(`quadrantChart
    A: [0.1, 0.1]
    B: [0.2, 0.2]
    C: [0.3, 0.3]
    D: [0.4, 0.4]
    E: [0.5, 0.5]
    F: [0.6, 0.6]
    G: [0.7, 0.7]
    H: [0.8, 0.8]
    I: [0.9, 0.9]`)

    expect(svg).toContain('<svg')
    // Should have 9 circles
    expect((svg.match(/<circle/g) ?? []).length).toBe(9)
  })
})
