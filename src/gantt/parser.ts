import type { GanttChart, GanttSection, GanttTask, GanttTag } from './types.ts'

// ============================================================================
// Gantt chart parser
//
// Line-by-line regex parsing of gantt syntax.
//
// Supported:
//   gantt
//   title <text>
//   dateFormat <format>
//   axisFormat <format>
//   excludes weekends
//   section <name>
//   <taskName> : [tags,] [id,] <start>, <duration|end>
//   <taskName> : [tags,] [id,] after <taskId>, <duration>
// ============================================================================

const TITLE_RE = /^title\s+(.+)$/i
const DATE_FORMAT_RE = /^dateformat\s+(.+)$/i
const AXIS_FORMAT_RE = /^axisformat\s+(.+)$/i
const EXCLUDES_RE = /^excludes\s+(.+)$/i
const SECTION_RE = /^section\s+(.+)$/i
const TASK_RE = /^(.+?)\s*:\s*(.+)$/

const VALID_TAGS = new Set<GanttTag>(['done', 'active', 'crit', 'milestone'])

export function parseGanttChart(lines: string[]): GanttChart {
  const chart: GanttChart = {
    dateFormat: 'YYYY-MM-DD',
    excludes: [],
    sections: [],
  }

  let currentSection: GanttSection = { name: 'Default', tasks: [] }
  // Map of task id → task for dependency resolution
  const taskMap = new Map<string, GanttTask>()

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || /^gantt\s*$/i.test(trimmed) || trimmed.startsWith('%%')) continue

    let m: RegExpMatchArray | null

    if ((m = trimmed.match(TITLE_RE))) {
      chart.title = m[1]!.trim()
      continue
    }

    if ((m = trimmed.match(DATE_FORMAT_RE))) {
      chart.dateFormat = m[1]!.trim()
      continue
    }

    if ((m = trimmed.match(AXIS_FORMAT_RE))) {
      chart.axisFormat = m[1]!.trim()
      continue
    }

    if ((m = trimmed.match(EXCLUDES_RE))) {
      chart.excludes.push(...m[1]!.split(',').map(s => s.trim()))
      continue
    }

    if ((m = trimmed.match(SECTION_RE))) {
      if (currentSection.tasks.length > 0) {
        chart.sections.push(currentSection)
      }
      currentSection = { name: m[1]!.trim(), tasks: [] }
      continue
    }

    if ((m = trimmed.match(TASK_RE))) {
      const task = parseTask(m[1]!.trim(), m[2]!.trim(), chart.dateFormat, taskMap)
      if (task.id) taskMap.set(task.id, task)
      currentSection.tasks.push(task)
    }
  }

  if (currentSection.tasks.length > 0) {
    chart.sections.push(currentSection)
  }

  return chart
}

function parseTask(
  name: string,
  metaStr: string,
  dateFormat: string,
  taskMap: Map<string, GanttTask>,
): GanttTask {
  const parts = metaStr.split(',').map(s => s.trim())
  const task: GanttTask = { name, tags: [] }

  // Consume tags, id, and date/duration parts
  const dateParts: string[] = []
  for (const part of parts) {
    if (VALID_TAGS.has(part as GanttTag)) {
      task.tags.push(part as GanttTag)
    } else if (part.startsWith('after ')) {
      task.afterId = part.slice(6).trim()
      dateParts.push(part)
    } else if (isDateLike(part, dateFormat)) {
      dateParts.push(part)
    } else if (isDuration(part)) {
      dateParts.push(part)
    } else {
      // Assume it's an ID if it's a single word
      if (/^[\w-]+$/.test(part) && !task.id) {
        task.id = part
      } else {
        dateParts.push(part)
      }
    }
  }

  // Resolve dates from the remaining parts
  if (task.afterId) {
    const depTask = taskMap.get(task.afterId)
    if (depTask?.endDate) {
      task.startDate = new Date(depTask.endDate)
    }
    // Find duration in dateParts
    const durPart = dateParts.find(p => isDuration(p) && !p.startsWith('after'))
    if (durPart) {
      task.duration = durPart
      if (task.startDate) {
        task.endDate = addDuration(task.startDate, durPart)
      }
    }
  } else {
    // First date part is start, second is end or duration
    const nonTagParts = dateParts.filter(p => !p.startsWith('after'))
    if (nonTagParts.length >= 2) {
      const startStr = nonTagParts[0]!
      const endStr = nonTagParts[1]!
      task.startDate = parseDate(startStr, dateFormat)
      if (isDuration(endStr)) {
        task.duration = endStr
        if (task.startDate) {
          task.endDate = addDuration(task.startDate, endStr)
        }
      } else {
        task.endDate = parseDate(endStr, dateFormat)
      }
    } else if (nonTagParts.length === 1) {
      const val = nonTagParts[0]!
      if (isDuration(val)) {
        task.duration = val
      } else {
        task.startDate = parseDate(val, dateFormat)
      }
    }
  }

  // Milestones have zero duration
  if (task.tags.includes('milestone') && task.startDate && !task.endDate) {
    task.endDate = new Date(task.startDate)
  }

  return task
}

function isDateLike(s: string, _format: string): boolean {
  // Simple: if it looks like a date (contains digits with separators)
  return /^\d{4}-\d{2}-\d{2}$/.test(s) || /^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(s)
}

function isDuration(s: string): boolean {
  return /^\d+[dhwmDHWM]$/.test(s)
}

function parseDate(s: string, _format: string): Date | undefined {
  const d = new Date(s)
  return isNaN(d.getTime()) ? undefined : d
}

function addDuration(start: Date, dur: string): Date {
  const m = dur.match(/^(\d+)([dhwmDHWM])$/)
  if (!m) return new Date(start)
  const n = parseInt(m[1]!, 10)
  const unit = m[2]!.toLowerCase()
  const result = new Date(start)
  switch (unit) {
    case 'h': result.setHours(result.getHours() + n); break
    case 'd': result.setDate(result.getDate() + n); break
    case 'w': result.setDate(result.getDate() + n * 7); break
    case 'm': result.setMonth(result.getMonth() + n); break
  }
  return result
}
