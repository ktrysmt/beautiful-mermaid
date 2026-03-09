import { describe, it, expect } from 'bun:test'
import { parseTimeline } from '../timeline/parser.ts'
import { renderMermaidSVG } from '../index.ts'

// ============================================================================
// Parser tests
// ============================================================================

describe('timeline parser', () => {
  it('parses title', () => {
    const lines = ['timeline', 'title My Timeline']
    const diagram = parseTimeline(lines)
    expect(diagram.title).toBe('My Timeline')
  })

  it('parses periods with events', () => {
    const lines = [
      'timeline',
      '2020 : Event A',
      '2021 : Event B',
    ]
    const diagram = parseTimeline(lines)
    expect(diagram.sections).toHaveLength(1)
    expect(diagram.sections[0]!.periods).toHaveLength(2)
    expect(diagram.sections[0]!.periods[0]!.time).toBe('2020')
    expect(diagram.sections[0]!.periods[0]!.events).toEqual(['Event A'])
    expect(diagram.sections[0]!.periods[1]!.time).toBe('2021')
  })

  it('parses continuation events', () => {
    const lines = [
      'timeline',
      '2020 : First event',
      '     : Second event',
      '     : Third event',
    ]
    const diagram = parseTimeline(lines)
    expect(diagram.sections[0]!.periods).toHaveLength(1)
    expect(diagram.sections[0]!.periods[0]!.events).toEqual([
      'First event', 'Second event', 'Third event',
    ])
  })

  it('parses sections', () => {
    const lines = [
      'timeline',
      'section Early',
      '2010 : Start',
      'section Later',
      '2020 : Middle',
    ]
    const diagram = parseTimeline(lines)
    expect(diagram.sections).toHaveLength(2)
    expect(diagram.sections[0]!.name).toBe('Early')
    expect(diagram.sections[0]!.periods).toHaveLength(1)
    expect(diagram.sections[1]!.name).toBe('Later')
    expect(diagram.sections[1]!.periods).toHaveLength(1)
  })

  it('handles empty input', () => {
    const lines = ['timeline']
    const diagram = parseTimeline(lines)
    expect(diagram.sections).toHaveLength(0)
  })

  it('ignores comments', () => {
    const lines = ['timeline', '%% a comment', '2020 : Event']
    const diagram = parseTimeline(lines)
    expect(diagram.sections[0]!.periods).toHaveLength(1)
  })
})

// ============================================================================
// Integration tests
// ============================================================================

describe('timeline integration', () => {
  it('renders basic timeline as SVG', () => {
    const svg = renderMermaidSVG(`timeline
    title History
    2020 : Pandemic
    2021 : Vaccines
    2022 : Recovery`)

    expect(svg).toContain('<svg')
    expect(svg).toContain('History')
    expect(svg).toContain('2020')
    expect(svg).toContain('Pandemic')
  })

  it('renders timeline with sections', () => {
    const svg = renderMermaidSVG(`timeline
    title Tech
    section Web
      2010 : AngularJS
    section Modern
      2013 : React`)

    expect(svg).toContain('<svg')
    expect(svg).toContain('Web')
    expect(svg).toContain('Modern')
    expect(svg).toContain('React')
  })

  it('renders single-period timeline', () => {
    const svg = renderMermaidSVG(`timeline
    Today : Morning meeting
          : Lunch
          : Afternoon coding`)

    expect(svg).toContain('<svg')
    expect(svg).toContain('Today')
    expect(svg).toContain('Morning meeting')
    expect(svg).toContain('Afternoon coding')
  })
})
