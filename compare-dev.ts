import { watch } from 'fs'
import { join } from 'path'

const PORT = 3567
const ROOT = import.meta.dir

let building = false
let debounce: Timer | null = null
const sseClients = new Set<ReadableStreamDefaultController>()

async function rebuild(): Promise<void> {
  if (building) return
  building = true

  console.log('\x1b[36m[compare-dev]\x1b[0m Rebuilding compare page...')
  const t0 = performance.now()

  const proc = Bun.spawn(['bun', 'run', join(ROOT, 'compare-index.ts')], {
    cwd: ROOT,
    stdout: 'inherit',
    stderr: 'inherit',
  })

  await proc.exited

  const ms = (performance.now() - t0).toFixed(0)
  if (proc.exitCode === 0) {
    console.log(`\x1b[32m[compare-dev]\x1b[0m Rebuilt in ${ms}ms`)
    for (const client of sseClients) {
      try {
        client.enqueue('data: reload\n\n')
      } catch {
        sseClients.delete(client)
      }
    }
  } else {
    console.error(`\x1b[31m[compare-dev]\x1b[0m Build failed (exit ${proc.exitCode})`)
  }

  building = false
}

function shouldIgnore(filename: string | null): boolean {
  if (!filename) return false

  // Bun's fs.watch can emit relative paths (".cache/x") or absolute paths.
  // Normalize checks to catch both forms.
  if (filename === 'compare.html' || filename.endsWith('/compare.html')) return true
  if (filename.includes('.git/')) return true
  if (filename.includes('node_modules/')) return true
  if (filename === '.cache' || filename.startsWith('.cache/') || filename.includes('/.cache/')) return true

  return false
}

function onFileChange(_event: string, filename: string | null): void {
  if (shouldIgnore(filename)) return
  if (debounce) clearTimeout(debounce)
  debounce = setTimeout(() => {
    console.log(`\x1b[90m[compare-dev]\x1b[0m Change detected${filename ? `: ${filename}` : ''}`)
    rebuild()
  }, 180)
}

watch(ROOT, { recursive: true }, onFileChange)

await rebuild()

console.log(`\x1b[36m[compare-dev]\x1b[0m Server running at \x1b[1mhttp://localhost:${PORT}\x1b[0m`)
console.log(`\x1b[36m[compare-dev]\x1b[0m Watching for changes...\n`)

Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url)

    if (url.pathname === '/__dev_events') {
      let controller!: ReadableStreamDefaultController
      const stream = new ReadableStream({
        start(c) {
          controller = c
          sseClients.add(controller)
        },
        cancel() {
          sseClients.delete(controller)
        },
      })

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      })
    }

    const file = Bun.file(join(ROOT, 'compare.html'))
    if (!(await file.exists())) {
      return new Response('compare.html not found — run bun run compare-index.ts', { status: 404 })
    }

    let html = await file.text()
    html = html.replace(
      '</body>',
      `  <script>
    ;(function() {
      function connect() {
        var es = new EventSource('/__dev_events');
        es.onmessage = function(e) {
          if (e.data === 'reload') location.reload();
        };
        es.onerror = function() {
          es.close();
          setTimeout(connect, 500);
        };
      }
      connect();
    })();
  </script>\n</body>`,
    )

    return new Response(html, {
      headers: { 'Content-Type': 'text/html' },
    })
  },
})
