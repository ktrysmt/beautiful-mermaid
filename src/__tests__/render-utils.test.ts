import { describe, it, expect } from 'bun:test'
import { f } from '../render-utils'

describe('f – tagged template float rounding', () => {
  it('rounds floats to 2 decimal places', () => {
    expect(f`${3.14159}`).toBe('3.14')
  })

  it('handles floating-point arithmetic', () => {
    expect(f`${0.1 + 0.2}`).toBe('0.3')
  })

  it('strips unnecessary trailing decimals', () => {
    expect(f`${1.1}`).toBe('1.1')
    expect(f`${2.0}`).toBe('2')
  })

  it('preserves integers', () => {
    expect(f`${42}`).toBe('42')
  })

  it('passes non-numeric values unchanged', () => {
    expect(f`${'hello'}`).toBe('hello')
    expect(f`${true}`).toBe('true')
    expect(f`${null}`).toBe('null')
    expect(f`${undefined}`).toBe('undefined')
  })

  it('handles mixed SVG path-like templates', () => {
    expect(f`M ${'A'} ${3.14159} L ${10.5} ${-20.999}`).toBe('M A 3.14 L 10.5 -21')
  })
})
