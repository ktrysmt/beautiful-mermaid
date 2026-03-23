/**
 * Tagged template that rounds all numeric interpolations to 2 decimal places.
 * Keeps SVG output compact and diff-stable.
 *
 * Usage: f`M ${x} ${y} L ${x2} ${y2}`
 */
export function f(
  strings: TemplateStringsArray,
  ...values: unknown[]
): string {
  let result = ''
  for (let i = 0; i < strings.length; i++) {
    result += strings[i]
    if (i < values.length) {
      const v = values[i]
      if (typeof v === 'number') {
        const rounded = Math.round(v * 100) / 100
        result += String(rounded)
      } else {
        result += String(v)
      }
    }
  }
  return result
}
