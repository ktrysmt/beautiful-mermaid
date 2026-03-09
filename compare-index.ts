import { mkdirSync } from 'fs'
import { join } from 'path'
import { samples } from './samples-data.ts'
import { chartSamples } from './chart-samples-data.ts'
import { compareExtraSamples } from './compare-extra-samples-data.ts'
import { THEMES } from './src/theme.ts'
import { prepareLatestProdPackage } from './scripts/prod-package.ts'

type Sample = {
  title: string
  description: string
  source: string
  category?: string
  options?: Record<string, unknown>
  suite: 'Core' | 'Charts' | 'Stress'
}

type DiagramType =
  | 'flowchart'
  | 'state'
  | 'sequence'
  | 'class'
  | 'er'
  | 'xychart'
  | 'quadrant'
  | 'timeline'
  | 'gantt'
  | 'other'

const ROOT = import.meta.dir

function detectDiagramType(sample: Pick<Sample, 'source' | 'category'>): DiagramType {
  const first = sample.source.trim().split(/\n|;/)[0]?.trim().toLowerCase() ?? ''

  if (/^stateDiagram-v2\b/i.test(first)) return 'state'
  if (/^sequenceDiagram\b/i.test(first)) return 'sequence'
  if (/^classDiagram\b/i.test(first)) return 'class'
  if (/^erDiagram\b/i.test(first)) return 'er'
  if (/^xychart(-beta)?\b/i.test(first)) return 'xychart'
  if (/^quadrantChart\b/i.test(first)) return 'quadrant'
  if (/^timeline\b/i.test(first)) return 'timeline'
  if (/^gantt\b/i.test(first)) return 'gantt'
  if (/^(graph|flowchart)\b/i.test(first)) return 'flowchart'

  const c = (sample.category ?? '').toLowerCase()
  if (c.includes('flowchart')) return 'flowchart'
  if (c.includes('state')) return 'state'
  if (c.includes('sequence')) return 'sequence'
  if (c.includes('class')) return 'class'
  if (c.includes('er')) return 'er'
  if (c.includes('xy')) return 'xychart'
  if (c.includes('quadrant')) return 'quadrant'
  if (c.includes('timeline')) return 'timeline'
  if (c.includes('gantt')) return 'gantt'

  return 'other'
}

const DIAGRAM_TYPE_ORDER: Record<DiagramType, number> = {
  flowchart: 0,
  state: 1,
  sequence: 2,
  class: 3,
  er: 4,
  xychart: 5,
  quadrant: 6,
  timeline: 7,
  gantt: 8,
  other: 9,
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

async function buildBundle(entryPath: string): Promise<string> {
  const result = await Bun.build({
    entrypoints: [entryPath],
    target: 'browser',
    format: 'esm',
    minify: true,
  })

  if (!result.success || result.outputs.length === 0) {
    throw new Error(`Bundle build failed for ${entryPath}:\n${JSON.stringify(result.logs, null, 2)}`)
  }

  return await result.outputs[0]!.text()
}

async function generateCompareHtml(): Promise<string> {
  const mergedSamples: Sample[] = [
    ...samples.map(s => ({ ...s, suite: 'Core' as const })),
    ...chartSamples.map(s => ({ ...s, suite: 'Charts' as const })),
    ...compareExtraSamples.map(s => ({ ...s, suite: 'Stress' as const })),
  ]

  const allSamples: Sample[] = mergedSamples
    .map((sample, originalIndex) => ({
      sample,
      originalIndex,
      type: detectDiagramType(sample),
    }))
    .sort((a, b) => {
      const typeDelta = DIAGRAM_TYPE_ORDER[a.type] - DIAGRAM_TYPE_ORDER[b.type]
      if (typeDelta !== 0) return typeDelta
      return a.originalIndex - b.originalIndex
    })
    .map(x => x.sample)

  const prod = prepareLatestProdPackage(ROOT, {
    refresh: process.env.COMPARE_REFRESH_PROD === '1',
  })

  const generatedDir = join(ROOT, '.cache', 'prod-compare', 'generated')
  mkdirSync(generatedDir, { recursive: true })

  const localEntryPath = join(generatedDir, 'local-browser-entry.ts')
  const prodEntryPath = join(generatedDir, 'prod-browser-entry.ts')

  const localImportPath = join(ROOT, 'src', 'index.ts')
  const prodImportPath = join(prod.packageRoot, 'dist', 'index.js')

  await Bun.write(localEntryPath, `
import { renderMermaidSVGAsync, renderMermaidASCII } from ${JSON.stringify(localImportPath)}

declare const window: any
window.__bmLocal = { renderMermaidSVGAsync, renderMermaidASCII }
`)

  await Bun.write(prodEntryPath, `
import { renderMermaidSVGAsync, renderMermaidASCII } from ${JSON.stringify(prodImportPath)}

declare const window: any
window.__bmProd = { renderMermaidSVGAsync, renderMermaidASCII }
`)

  const [localBundle, prodBundle] = await Promise.all([
    buildBundle(localEntryPath),
    buildBundle(prodEntryPath),
  ])

  const themeKeys = Object.keys(THEMES)
  const sampleCards = allSamples.map((sample, i) => {
    const categoryLabel = sample.category ?? sample.suite
    return `
<section class="sample-card" id="sample-${i}" data-diff-state="pending">
  <div class="sample-head">
    <div>
      <h2>${escapeHtml(sample.title)}</h2>
      <p>${escapeHtml(sample.description)}</p>
    </div>
    <span class="badge">${escapeHtml(categoryLabel)}</span>
  </div>

  <details class="source-wrap">
    <summary>Source</summary>
    <pre><code>${escapeHtml(sample.source.trim())}</code></pre>
  </details>

  <div class="compare-grid" data-compare-grid>
    <div class="panel">
      <div class="panel-title">Local main</div>
      <div class="render-box" id="local-${i}">Rendering…</div>
      <div class="panel-meta" id="meta-local-${i}">Pending</div>
    </div>
    <div class="panel">
      <div class="panel-title">npm prod (v${escapeHtml(prod.packageVersion)})</div>
      <div class="render-box" id="prod-${i}">Rendering…</div>
      <div class="panel-meta" id="meta-prod-${i}">Pending</div>
    </div>
  </div>

  <div class="overlay-wrap hidden" data-overlay-wrap>
    <div class="overlay-header">
      <label>Prod opacity
        <input class="opacity-slider" data-overlay-index="${i}" type="range" min="0" max="100" value="55" />
      </label>
      <span class="overlay-hint">Local (base) + Prod (overlay)</span>
    </div>
    <div class="overlay-stage" id="overlay-stage-${i}">
      <div class="overlay-layer" id="overlay-local-${i}"></div>
      <div class="overlay-layer overlay-prod" id="overlay-prod-${i}"></div>
    </div>
  </div>

  <div class="compare-result" id="compare-result-${i}">Comparing…</div>
</section>`
  }).join('\n')

  const builtAt = new Date().toISOString()

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>beautiful-mermaid — Prod vs Main Compare</title>
  <style>
    :root {
      --bg: #ffffff;
      --fg: #18181b;
      --muted: #6b7280;
      --line: #e5e7eb;
      --panel: #f8fafc;
      --ok: #166534;
      --err: #991b1b;
      --diff: #1d4ed8;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
      color: var(--fg);
      background: var(--bg);
    }
    .wrap { max-width: 1400px; margin: 0 auto; padding: 24px; }
    .topbar {
      position: sticky;
      top: 0;
      z-index: 10;
      background: color-mix(in srgb, var(--bg) 90%, white);
      border-bottom: 1px solid var(--line);
      backdrop-filter: blur(6px);
      display: flex;
      flex-wrap: wrap;
      gap: 12px 20px;
      align-items: center;
      padding: 12px 24px;
    }
    .title { font-weight: 700; font-size: 18px; }
    .meta { color: var(--muted); font-size: 13px; }
    .controls { margin-left: auto; display: flex; gap: 14px; align-items: center; }
    select, input[type="checkbox"] { cursor: pointer; }
    .samples { display: grid; gap: 18px; margin-top: 20px; }
    .sample-card { border: 1px solid var(--line); border-radius: 14px; padding: 14px; background: #fff; }
    .sample-head { display: flex; gap: 8px; justify-content: space-between; align-items: flex-start; }
    .sample-head h2 { margin: 0 0 4px; font-size: 17px; }
    .sample-head p { margin: 0; color: var(--muted); font-size: 13px; }
    .badge { border: 1px solid var(--line); border-radius: 999px; font-size: 11px; padding: 3px 9px; color: #374151; }
    .source-wrap { margin-top: 12px; }
    .source-wrap summary { cursor: pointer; color: #334155; font-size: 13px; }
    .source-wrap pre {
      margin: 8px 0 0;
      background: #0f172a;
      color: #e2e8f0;
      border-radius: 10px;
      padding: 12px;
      overflow: auto;
      font-size: 12px;
      line-height: 1.45;
    }
    .compare-grid { margin-top: 12px; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
    .panel { border: 1px solid var(--line); border-radius: 10px; overflow: hidden; background: #fff; }
    .panel-title { padding: 8px 10px; font-size: 12px; color: #374151; border-bottom: 1px solid var(--line); background: var(--panel); }
    .render-box {
      min-height: 220px;
      display: grid;
      place-items: center;
      padding: 10px;
      background-image:
        linear-gradient(45deg, rgba(0,0,0,0.03) 25%, transparent 25%),
        linear-gradient(-45deg, rgba(0,0,0,0.03) 25%, transparent 25%),
        linear-gradient(45deg, transparent 75%, rgba(0,0,0,0.03) 75%),
        linear-gradient(-45deg, transparent 75%, rgba(0,0,0,0.03) 75%);
      background-size: 16px 16px;
      background-position: 0 0, 0 8px, 8px -8px, -8px 0px;
    }
    .render-box img { max-width: 100%; max-height: 440px; display: block; }
    .panel-meta { border-top: 1px solid var(--line); padding: 7px 10px; font-size: 12px; color: #475569; background: var(--panel); }
    .overlay-wrap { margin-top: 12px; border: 1px solid var(--line); border-radius: 10px; padding: 10px; }
    .overlay-header { display: flex; justify-content: space-between; align-items: center; gap: 8px; font-size: 12px; color: #475569; }
    .overlay-stage {
      margin-top: 8px;
      min-height: 240px;
      position: relative;
      border: 1px solid var(--line);
      border-radius: 8px;
      overflow: hidden;
      background-image:
        linear-gradient(45deg, rgba(0,0,0,0.03) 25%, transparent 25%),
        linear-gradient(-45deg, rgba(0,0,0,0.03) 25%, transparent 25%),
        linear-gradient(45deg, transparent 75%, rgba(0,0,0,0.03) 75%),
        linear-gradient(-45deg, transparent 75%, rgba(0,0,0,0.03) 75%);
      background-size: 16px 16px;
      background-position: 0 0, 0 8px, 8px -8px, -8px 0px;
    }
    .overlay-layer {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      padding: 10px;
    }
    .overlay-layer img { max-width: 100%; max-height: 440px; display: block; }
    .overlay-prod { opacity: 0.55; }
    .compare-result {
      margin-top: 10px;
      font-size: 12px;
      color: #334155;
      padding: 7px 10px;
      border: 1px solid var(--line);
      border-radius: 999px;
      display: inline-block;
      background: #f8fafc;
    }
    .hidden { display: none !important; }
    .sample-card.filtered-out { display: none !important; }
    .ok { color: var(--ok); font-weight: 600; }
    .err { color: var(--err); font-weight: 600; }
    .diff { color: var(--diff); font-weight: 600; }
    .error-box {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      white-space: pre-wrap;
      font-size: 12px;
      line-height: 1.4;
      color: #7f1d1d;
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: 8px;
      padding: 10px;
      width: 100%;
    }
  </style>
</head>
<body>
  <div class="topbar">
    <div>
      <div class="title">Prod vs Main — visual compare</div>
      <div class="meta">Local: working tree • Prod: npm latest v${escapeHtml(prod.packageVersion)} • Built: ${escapeHtml(builtAt)}</div>
    </div>
    <div class="controls">
      <label>Theme
        <select id="themeSelect">
          ${themeKeys.map((key, i) => `<option value="${escapeHtml(key)}"${i === 0 ? ' selected' : ''}>${escapeHtml(key)}</option>`).join('')}
        </select>
      </label>
      <label>
        <input id="overlayToggle" type="checkbox" />
        Overlay mode
      </label>
      <label>
        <input id="diffOnlyToggle" type="checkbox" checked />
        Show only differences
      </label>
      <span id="globalStatus" class="meta">Ready</span>
    </div>
  </div>

  <div class="wrap">
    <div class="samples">
      ${sampleCards}
    </div>
  </div>

  <script type="module">${localBundle.replace(/<\/script>/gi, '<\\/script>')}</script>
  <script type="module">${prodBundle.replace(/<\/script>/gi, '<\\/script>')}</script>

  <script type="module">
    const SAMPLES = ${JSON.stringify(allSamples)};
    const THEMES = ${JSON.stringify(THEMES)};

    const statusEl = document.getElementById('globalStatus');
    const themeSelect = document.getElementById('themeSelect');
    const overlayToggle = document.getElementById('overlayToggle');
    const diffOnlyToggle = document.getElementById('diffOnlyToggle');

    let localApi;
    let prodApi;

    async function waitForRenderApis(timeoutMs = 10000) {
      const start = performance.now();
      while (performance.now() - start < timeoutMs) {
        const local = window.__bmLocal;
        const prod = window.__bmProd;
        if (local && prod) return { local, prod };
        await new Promise(r => setTimeout(r, 25));
      }
      return null;
    }

    function toDataUrl(svg) {
      return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    }

    function hashString(s) {
      let h = 2166136261;
      for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = (h * 16777619) >>> 0;
      }
      return h.toString(16).padStart(8, '0');
    }

    function normalizeSvgForComparison(svg) {
      try {
        const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
        const root = doc.documentElement;
        if (root && root.tagName.toLowerCase() === 'svg') {
          root.removeAttribute('viewBox');
          root.removeAttribute('width');
          root.removeAttribute('height');
        }
        return new XMLSerializer().serializeToString(root);
      } catch {
        return svg;
      }
    }

    function parseSize(svg) {
      try {
        const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
        const root = doc.documentElement;
        let w = parseFloat(root.getAttribute('width') || '');
        let h = parseFloat(root.getAttribute('height') || '');
        if (!Number.isFinite(w) || !Number.isFinite(h)) {
          const vb = (root.getAttribute('viewBox') || '').trim().split(/\s+/).map(Number);
          if (vb.length === 4 && Number.isFinite(vb[2]) && Number.isFinite(vb[3])) {
            w = vb[2];
            h = vb[3];
          }
        }
        if (Number.isFinite(w) && Number.isFinite(h)) {
          return Math.round(w) + '×' + Math.round(h);
        }
      } catch {}
      return '?';
    }

    function setPanelBackground(el, bgColor) {
      if (!el) return;
      if (bgColor && typeof bgColor === 'string') {
        el.style.backgroundColor = bgColor;
      } else {
        el.style.removeProperty('background-color');
      }
    }

    function mountSvg(el, svg) {
      if (!el) return;
      const img = document.createElement('img');
      img.alt = 'Rendered diagram';
      img.src = toDataUrl(svg);
      el.replaceChildren(img);
    }

    function mountError(el, error) {
      if (!el) return;
      const pre = document.createElement('pre');
      pre.className = 'error-box';
      pre.textContent = String(error || 'Unknown render error');
      el.replaceChildren(pre);
    }

    function renderOptionsFor(sample, themeKey) {
      const theme = THEMES[themeKey] || THEMES[Object.keys(THEMES)[0]];
      return { ...theme, ...(sample.options || {}) };
    }

    function hasInvalidSvgNumbers(svg) {
      return /\\bNaN\\b|\\bInfinity\\b/.test(svg);
    }

    async function renderOne(api, source, options) {
      try {
        const svg = await api.renderMermaidSVGAsync(source, options);
        if (hasInvalidSvgNumbers(svg)) {
          return {
            ok: false,
            error: 'Renderer produced invalid non-finite coordinates (NaN/Infinity)',
          };
        }

        const normalized = normalizeSvgForComparison(svg);
        return {
          ok: true,
          svg,
          size: parseSize(svg),
          rawHash: hashString(svg),
          compareHash: hashString(normalized),
        };
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }

    function applyOverlayVisibility(enabled) {
      document.querySelectorAll('[data-compare-grid]').forEach(el => {
        el.classList.toggle('hidden', enabled);
      });
      document.querySelectorAll('[data-overlay-wrap]').forEach(el => {
        el.classList.toggle('hidden', !enabled);
      });
    }

    function updateOverlayOpacity(index, value) {
      const target = document.getElementById('overlay-prod-' + index);
      if (!target) return;
      const v = Number(value);
      target.style.opacity = String(Math.max(0, Math.min(1, v / 100)));
    }

    function applyDiffFilter() {
      const showOnlyDiffs = diffOnlyToggle instanceof HTMLInputElement ? diffOnlyToggle.checked : false;

      let visible = 0;
      let diffs = 0;
      let matches = 0;
      for (let i = 0; i < SAMPLES.length; i++) {
        const card = document.getElementById('sample-' + i);
        if (!card) continue;

        const state = card.getAttribute('data-diff-state') || 'pending';
        const isMatch = state === 'match';
        const shouldShow = !showOnlyDiffs || !isMatch;

        card.classList.toggle('filtered-out', !shouldShow);
        if (shouldShow) visible++;

        if (isMatch) matches++;
        else if (state !== 'pending') diffs++;
      }

      return { visible, diffs, matches, showOnlyDiffs };
    }

    async function renderSample(index, themeKey) {
      const sample = SAMPLES[index];
      const options = renderOptionsFor(sample, themeKey);

      const sampleCard = document.getElementById('sample-' + index);
      const localHost = document.getElementById('local-' + index);
      const prodHost = document.getElementById('prod-' + index);
      const localMeta = document.getElementById('meta-local-' + index);
      const prodMeta = document.getElementById('meta-prod-' + index);
      const compareResult = document.getElementById('compare-result-' + index);
      const overlayLocal = document.getElementById('overlay-local-' + index);
      const overlayProd = document.getElementById('overlay-prod-' + index);

      if (sampleCard) sampleCard.setAttribute('data-diff-state', 'pending');

      setPanelBackground(localHost, options.bg);
      setPanelBackground(prodHost, options.bg);
      setPanelBackground(overlayLocal, options.bg);
      setPanelBackground(overlayProd, options.bg);

      localHost.textContent = 'Rendering…';
      prodHost.textContent = 'Rendering…';
      overlayLocal.textContent = 'Rendering…';
      overlayProd.textContent = 'Rendering…';
      localMeta.textContent = 'Running';
      prodMeta.textContent = 'Running';
      compareResult.textContent = 'Comparing…';

      const [localRes, prodRes] = await Promise.all([
        renderOne(localApi, sample.source, options),
        renderOne(prodApi, sample.source, options),
      ]);

      if (localRes.ok) {
        mountSvg(localHost, localRes.svg);
        mountSvg(overlayLocal, localRes.svg);
        localMeta.innerHTML = '<span class="ok">OK</span> · ' + localRes.size + ' · cmp#' + localRes.compareHash + ' · raw#' + localRes.rawHash;
      } else {
        mountError(localHost, localRes.error);
        mountError(overlayLocal, localRes.error);
        localMeta.innerHTML = '<span class="err">ERROR</span>';
      }

      if (prodRes.ok) {
        mountSvg(prodHost, prodRes.svg);
        mountSvg(overlayProd, prodRes.svg);
        prodMeta.innerHTML = '<span class="ok">OK</span> · ' + prodRes.size + ' · cmp#' + prodRes.compareHash + ' · raw#' + prodRes.rawHash;
      } else {
        mountError(prodHost, prodRes.error);
        mountError(overlayProd, prodRes.error);
        prodMeta.innerHTML = '<span class="err">ERROR</span>';
      }

      let diffState = 'diff';
      if (localRes.ok && prodRes.ok) {
        if (localRes.compareHash === prodRes.compareHash) {
          diffState = 'match';
          compareResult.innerHTML = '<span class="ok">Match</span> · normalized SVG equivalent';
        } else {
          compareResult.innerHTML = '<span class="diff">Different</span> · normalized SVG differs';
        }
      } else {
        compareResult.innerHTML = '<span class="err">Not comparable</span> · One side failed to render';
      }

      if (sampleCard) sampleCard.setAttribute('data-diff-state', diffState);
      applyDiffFilter();
    }

    async function renderAll(themeKey) {
      statusEl.className = 'meta';
      statusEl.textContent = 'Rendering ' + SAMPLES.length + ' samples…';

      for (let i = 0; i < SAMPLES.length; i++) {
        await renderSample(i, themeKey);
        const filter = applyDiffFilter();
        statusEl.textContent =
          'Rendering ' + (i + 1) + '/' + SAMPLES.length + '…' +
          ' · showing ' + filter.visible;
      }

      const filter = applyDiffFilter();
      statusEl.className = 'meta';
      if (filter.showOnlyDiffs) {
        statusEl.textContent =
          'Done · showing ' + filter.visible +
          ' differences/errors (hidden matches: ' + filter.matches + ')';
      } else {
        statusEl.textContent =
          'Done · showing all ' + SAMPLES.length +
          ' samples (differences/errors: ' + filter.diffs + ')';
      }
    }

    themeSelect.addEventListener('change', () => {
      if (!localApi || !prodApi) return;
      renderAll(themeSelect.value);
    });

    overlayToggle.addEventListener('change', () => {
      applyOverlayVisibility(overlayToggle.checked);
    });

    diffOnlyToggle?.addEventListener('change', () => {
      const filter = applyDiffFilter();
      if (!localApi || !prodApi) return;

      statusEl.className = 'meta';
      if (filter.showOnlyDiffs) {
        statusEl.textContent =
          'Showing ' + filter.visible +
          ' differences/errors (hidden matches: ' + filter.matches + ')';
      } else {
        statusEl.textContent =
          'Showing all ' + SAMPLES.length +
          ' samples (differences/errors: ' + filter.diffs + ')';
      }
    });

    document.addEventListener('input', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) return;
      if (!target.classList.contains('opacity-slider')) return;
      const index = Number(target.getAttribute('data-overlay-index'));
      updateOverlayOpacity(index, target.value);
    });

    async function init() {
      statusEl.className = 'meta';
      statusEl.textContent = 'Loading renderer bundles…';

      const apis = await waitForRenderApis();
      if (!apis) {
        statusEl.textContent = 'Failed to initialize renderer bundles';
        statusEl.className = 'err';
        console.error('Missing __bmLocal or __bmProd bundle exports after timeout');
        return;
      }

      localApi = apis.local;
      prodApi = apis.prod;

      applyOverlayVisibility(false);
      await renderAll(themeSelect.value);
    }

    init();
  </script>
</body>
</html>`
}

async function main(): Promise<void> {
  const html = await generateCompareHtml()
  const outPath = join(ROOT, 'compare.html')
  await Bun.write(outPath, html)
  console.log(`Wrote compare page: ${outPath}`)
}

await main()
