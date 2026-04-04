/**
 * Tests for correct level assignment in layered graph layout.
 *
 * Principle: when node C receives edges from both A (level 0) and B (level 1),
 * C must be placed at level 2 (after ALL predecessors), not level 1.
 * This is the "longest path" layer assignment from the Sugiyama framework.
 */
import { describe, it, expect } from 'bun:test'
import { renderMermaidASCII } from '../index.ts'

describe('level assignment – longest path', () => {
  it('LR: fan-in target placed after all predecessors', () => {
    // A→B, A→C, B→C  ⟹  C must be to the RIGHT of B (not below B)
    const ascii = renderMermaidASCII(`graph LR
      A -->|to_B| B
      A -->|to_C| C
      B -->|to_C| C`)
    const lines = ascii.split('\n')

    // Find the column (first occurrence) of each node label
    const colOf = (label: string) => {
      for (const line of lines) {
        const idx = line.indexOf(label)
        if (idx >= 0) return idx
      }
      return -1
    }

    // C must be strictly to the right of B
    expect(colOf('C')).toBeGreaterThan(colOf('B'))
    // B must be strictly to the right of A
    expect(colOf('B')).toBeGreaterThan(colOf('A'))
    // All labels visible
    expect(ascii).toContain('to_B')
    expect(ascii).toContain('to_C')
  })

  it('TD: fan-in target placed below all predecessors', () => {
    const ascii = renderMermaidASCII(`graph TD
      A -->|down1| B
      A -->|down2| C
      B -->|down3| C`)
    const lines = ascii.split('\n')

    // Find the row (first occurrence) of each node label
    const rowOf = (label: string) => {
      for (let i = 0; i < lines.length; i++) {
        if (lines[i]!.includes(label)) return i
      }
      return -1
    }

    // C must be strictly below B
    expect(rowOf('C')).toBeGreaterThan(rowOf('B'))
    // B must be strictly below A
    expect(rowOf('B')).toBeGreaterThan(rowOf('A'))
  })

  it('LR: diamond pattern A→B, A→C, B→D, C→D', () => {
    const ascii = renderMermaidASCII(`graph LR
      A --> B
      A --> C
      B --> D
      C --> D`)
    const lines = ascii.split('\n')

    const colOf = (label: string) => {
      for (const line of lines) {
        const idx = line.indexOf(label)
        if (idx >= 0) return idx
      }
      return -1
    }

    // D must be to the right of both B and C
    expect(colOf('D')).toBeGreaterThan(colOf('B'))
    expect(colOf('D')).toBeGreaterThan(colOf('C'))
  })

  it('LR: test_lr.md scenario (sector→bundler, sector→tech, bundler→tech)', () => {
    const ascii = renderMermaidASCII(`graph LR
      FI["sector"] -->|"contract"| KT["bundler"]
      FI -->|"contract"| OT["tech"]
      KT -->|"relation/data"| OT`)
    const lines = ascii.split('\n')

    const colOf = (label: string) => {
      for (const line of lines) {
        const idx = line.indexOf(label)
        if (idx >= 0) return idx
      }
      return -1
    }

    // tech must be to the right of bundler
    expect(colOf('tech')).toBeGreaterThan(colOf('bundler'))
    // bundler must be to the right of sector
    expect(colOf('bundler')).toBeGreaterThan(colOf('sector'))
    // All edge labels visible
    expect(ascii).toContain('contract')
    expect(ascii).toContain('relation/data')
  })
})
