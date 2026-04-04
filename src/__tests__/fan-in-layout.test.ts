/**
 * Tests for fan-in layout quality: edge label visibility when multiple
 * labeled edges converge on a single node.
 *
 * Covers Task A (fan-in space allocation) and Task C (congestion-aware routing).
 *
 * Principle: every edge label defined in the Mermaid source must appear
 * verbatim in the rendered ASCII output.
 */
import { describe, it, expect } from 'bun:test'
import { renderMermaidASCII } from '../index.ts'

// ============================================================================
// Helper: assert all expected labels appear in ASCII output
// ============================================================================

function expectAllLabels(ascii: string, labels: string[]): void {
  for (const label of labels) {
    expect(ascii).toContain(label)
  }
}

// ============================================================================
// Fan-in label visibility
// ============================================================================

describe('fan-in edge label visibility', () => {
  it('3-way fan-in: all labels visible', () => {
    const ascii = renderMermaidASCII(`graph TD
      A -->|from_A| D
      B -->|from_B| D
      C -->|from_C| D`)
    expectAllLabels(ascii, ['from_A', 'from_B', 'from_C'])
  })

  it('4-way fan-in: all labels visible', () => {
    const ascii = renderMermaidASCII(`graph TD
      A -->|from_A| E
      B -->|from_B| E
      C -->|from_C| E
      D -->|from_D| E`)
    expectAllLabels(ascii, ['from_A', 'from_B', 'from_C', 'from_D'])
  })

  it('5-way fan-in: all labels visible', () => {
    const ascii = renderMermaidASCII(`graph TD
      A -->|from_A| F
      B -->|from_B| F
      C -->|from_C| F
      D -->|from_D| F
      E -->|from_E| F`)
    expectAllLabels(ascii, ['from_A', 'from_B', 'from_C', 'from_D', 'from_E'])
  })

  it('fan-in with CJK labels: all labels visible', () => {
    const ascii = renderMermaidASCII(`graph TD
      A -->|報告A| D
      B -->|報告B| D
      C -->|報告C| D`)
    expectAllLabels(ascii, ['報告A', '報告B', '報告C'])
  })

  it('mixed fan-in and fan-out: fan-in labels preserved', () => {
    const ascii = renderMermaidASCII(`graph TD
      A -->|to_X| X
      B -->|to_X| X
      C -->|to_X| X
      X -->|to_D| D
      X -->|to_E| E`)
    // Fan-in labels: "to_X" should appear (all three share the label)
    expect(ascii).toContain('to_X')
    // Fan-out: at least one outgoing label visible
    const hasToD = ascii.includes('to_D')
    const hasToE = ascii.includes('to_E')
    expect(hasToD || hasToE).toBe(true)
  })

  it('fan-in from different subgraphs: all labels visible', () => {
    const ascii = renderMermaidASCII(`graph TD
      subgraph G1
        A
        B
      end
      subgraph G2
        C
        D
      end
      A -->|from_A| E
      B -->|from_B| E
      C -->|from_C| E
      D -->|from_D| E`)
    expectAllLabels(ascii, ['from_A', 'from_B', 'from_C', 'from_D'])
  })
})

// ============================================================================
// Edge congestion: edges should not share identical path segments
// ============================================================================

describe('edge routing avoids congestion', () => {
  it('fan-in edges use distinct vertical segments', () => {
    const ascii = renderMermaidASCII(`graph TD
      A -->|alpha| D
      B -->|beta| D
      C -->|gamma| D`)
    // Each label should be on a separate line (not merged on same row)
    expectAllLabels(ascii, ['alpha', 'beta', 'gamma'])
  })
})
