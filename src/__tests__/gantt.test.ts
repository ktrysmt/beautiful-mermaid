import { describe, it, expect } from 'bun:test'
import { parseGanttChart } from '../gantt/parser.ts'
import { renderMermaidSVG } from '../index.ts'

// ============================================================================
// Parser tests
// ============================================================================

describe('gantt parser', () => {
  it('parses title', () => {
    const lines = ['gantt', 'title My Project']
    const chart = parseGanttChart(lines)
    expect(chart.title).toBe('My Project')
  })

  it('parses dateFormat', () => {
    const lines = ['gantt', 'dateFormat YYYY-MM-DD']
    const chart = parseGanttChart(lines)
    expect(chart.dateFormat).toBe('YYYY-MM-DD')
  })

  it('parses sections and tasks', () => {
    const lines = [
      'gantt',
      'dateFormat YYYY-MM-DD',
      'section Design',
      'Wireframes : 2024-01-01, 14d',
      'section Dev',
      'Frontend : 2024-01-15, 21d',
    ]
    const chart = parseGanttChart(lines)
    expect(chart.sections).toHaveLength(2)
    expect(chart.sections[0]!.name).toBe('Design')
    expect(chart.sections[0]!.tasks).toHaveLength(1)
    expect(chart.sections[0]!.tasks[0]!.name).toBe('Wireframes')
    expect(chart.sections[1]!.name).toBe('Dev')
    expect(chart.sections[1]!.tasks).toHaveLength(1)
  })

  it('parses task tags (done, active, crit)', () => {
    const lines = [
      'gantt',
      'dateFormat YYYY-MM-DD',
      'section Tasks',
      'Task A : done, 2024-01-01, 5d',
      'Task B : active, crit, 2024-01-06, 3d',
    ]
    const chart = parseGanttChart(lines)
    expect(chart.sections[0]!.tasks[0]!.tags).toContain('done')
    expect(chart.sections[0]!.tasks[1]!.tags).toContain('active')
    expect(chart.sections[0]!.tasks[1]!.tags).toContain('crit')
  })

  it('parses task with ID', () => {
    const lines = [
      'gantt',
      'dateFormat YYYY-MM-DD',
      'section Tasks',
      'Planning : t1, 2024-01-01, 7d',
    ]
    const chart = parseGanttChart(lines)
    expect(chart.sections[0]!.tasks[0]!.id).toBe('t1')
  })

  it('parses after dependencies', () => {
    const lines = [
      'gantt',
      'dateFormat YYYY-MM-DD',
      'section Tasks',
      'Task A : t1, 2024-01-01, 7d',
      'Task B : t2, after t1, 5d',
    ]
    const chart = parseGanttChart(lines)
    const taskB = chart.sections[0]!.tasks[1]!
    expect(taskB.afterId).toBe('t1')
    expect(taskB.startDate).toBeDefined()
    expect(taskB.endDate).toBeDefined()
  })

  it('parses milestone', () => {
    const lines = [
      'gantt',
      'dateFormat YYYY-MM-DD',
      'section Tasks',
      'Release : milestone, 2024-02-01, 0d',
    ]
    const chart = parseGanttChart(lines)
    expect(chart.sections[0]!.tasks[0]!.tags).toContain('milestone')
  })

  it('parses excludes', () => {
    const lines = ['gantt', 'excludes weekends']
    const chart = parseGanttChart(lines)
    expect(chart.excludes).toContain('weekends')
  })

  it('handles empty input', () => {
    const lines = ['gantt']
    const chart = parseGanttChart(lines)
    expect(chart.sections).toHaveLength(0)
  })
})

// ============================================================================
// Integration tests
// ============================================================================

describe('gantt integration', () => {
  it('renders basic gantt chart as SVG', () => {
    const svg = renderMermaidSVG(`gantt
    title Sprint 1
    dateFormat YYYY-MM-DD
    section Tasks
      Planning : 2024-01-01, 7d
      Development : 2024-01-08, 14d
      Testing : 2024-01-22, 7d`)

    expect(svg).toContain('<svg')
    expect(svg).toContain('Sprint 1')
    expect(svg).toContain('Planning')
    expect(svg).toContain('Development')
    expect(svg).toContain('Testing')
  })

  it('renders gantt with milestones', () => {
    const svg = renderMermaidSVG(`gantt
    dateFormat YYYY-MM-DD
    section Launch
      Build : 2024-03-01, 14d
      Release : milestone, 2024-03-15, 0d`)

    expect(svg).toContain('<svg')
    expect(svg).toContain('Release')
    // Milestone should have a diamond path
    expect(svg).toContain('<path')
  })

  it('renders gantt with task tags', () => {
    const svg = renderMermaidSVG(`gantt
    dateFormat YYYY-MM-DD
    section Work
      Done task : done, 2024-01-01, 5d
      Active task : active, 2024-01-06, 5d
      Critical : crit, 2024-01-11, 3d`)

    expect(svg).toContain('<svg')
    expect(svg).toContain('Done task')
    expect(svg).toContain('Active task')
    expect(svg).toContain('Critical')
  })

  it('renders multi-section gantt', () => {
    const svg = renderMermaidSVG(`gantt
    dateFormat YYYY-MM-DD
    section Frontend
      UI : 2024-01-01, 14d
    section Backend
      API : 2024-01-01, 14d
    section QA
      Tests : 2024-01-15, 7d`)

    expect(svg).toContain('<svg')
    expect(svg).toContain('Frontend')
    expect(svg).toContain('Backend')
    expect(svg).toContain('QA')
  })
})
