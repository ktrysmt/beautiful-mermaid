/**
 * Generates chart-index.html showcasing Phase 1 chart types:
 * Quadrant, Timeline, and Gantt charts.
 *
 * Usage: bun run chart-index.ts
 *
 * Same layout as index.ts — three-column (source | SVG | ASCII).
 */

import { chartSamples as samples } from './chart-samples-data.ts'
import { THEMES } from './src/theme.ts'
import { createHighlighter } from 'shiki'

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function formatDescription(text: string): string {
  return text.replace(/`([^`]+)`/g, '<code>$1</code>')
}

const THEME_LABELS: Record<string, string> = {
  'zinc-dark': 'Zinc Dark',
  'tokyo-night': 'Tokyo Night',
  'tokyo-night-storm': 'Tokyo Storm',
  'tokyo-night-light': 'Tokyo Light',
  'catppuccin-mocha': 'Catppuccin',
  'catppuccin-latte': 'Latte',
  'nord': 'Nord',
  'nord-light': 'Nord Light',
  'dracula': 'Dracula',
  'github-light': 'GitHub',
  'github-dark': 'GitHub Dark',
  'solarized-light': 'Solarized',
  'solarized-dark': 'Solar Dark',
  'one-dark': 'One Dark',
}

async function generateHtml(): Promise<string> {
  const highlighter = await createHighlighter({
    langs: ['mermaid'],
    themes: ['github-light'],
  })

  // Bundle the mermaid renderer for the browser
  const buildResult = await Bun.build({
    entrypoints: [new URL('./src/browser.ts', import.meta.url).pathname],
    target: 'browser',
    format: 'esm',
    minify: true,
  })
  if (!buildResult.success) {
    console.error('Bundle build failed:', buildResult.logs)
    process.exit(1)
  }
  const bundleJs = await buildResult.outputs[0]!.text()
  console.log(`Browser bundle: ${(bundleJs.length / 1024).toFixed(1)} KB`)

  const samplesJson = JSON.stringify(samples.map(s => ({
    title: s.title,
    description: s.description,
    source: s.source,
    category: s.category ?? 'Other',
    options: s.options ?? {},
  })))

  // Group by category
  const categories = new Map<string, number[]>()
  samples.forEach((sample, i) => {
    const cat = sample.category ?? 'Other'
    if (!categories.has(cat)) categories.set(cat, [])
    categories.get(cat)!.push(i)
  })

  const categoryBadgeColors: Record<string, string> = {
    Quadrant: '#8b5cf6',
    Timeline: '#10b981',
    Gantt: '#f59e0b',
  }

  // TOC
  const tocSections = [...categories.entries()].map(([cat, indices]) => {
    const items = indices.map(i => {
      const title = samples[i]!.title.replace(/^(Quadrant|Timeline|Gantt):\s*/, '')
      return `<li><a href="#sample-${i}"><span class="toc-num">${i + 1}.</span> ${escapeHtml(title)}</a></li>`
    }).join('\n            ')
    return `
        <div class="toc-category">
          <h3>${escapeHtml(cat)} (${indices.length})</h3>
          <ol start="${indices[0]! + 1}">
            ${items}
          </ol>
        </div>`
  }).join('\n')

  // Theme pills
  function buildThemePill(key: string, colors: { bg: string; fg: string }, active = false): string {
    const isDark = parseInt(colors.bg.replace('#', '').slice(0, 2), 16) < 0x80
    const shadow = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)'
    const label = key === '' ? 'Default' : (THEME_LABELS[key] ?? key)
    const activeClass = active ? ' active' : ''
    return `<button class="theme-pill shadow-minimal${activeClass}" data-theme="${key}"><span class="theme-swatch" style="background:${colors.bg};box-shadow:inset 0 0 0 1px ${shadow}"></span>${escapeHtml(label)}</button>`
  }

  const themeEntries = Object.entries(THEMES)
  const allDropdownPills = [
    buildThemePill('', { bg: '#FFFFFF', fg: '#27272A' }, true),
    ...themeEntries.map(([key, colors]) => buildThemePill(key, colors)),
  ]

  // Highlight all sources
  const highlightedSources = samples.map(sample => {
    const fenced = '```mermaid\n' + sample.source.trim() + '\n```'
    const html = highlighter.codeToHtml(fenced, { lang: 'mermaid', theme: 'github-light' })
    return html.replace(
      /(<code>)<span class="line">.*?<\/span>\n/, '$1'
    ).replace(
      /\n<span class="line">.*?<\/span>(<\/code>)/, '$1'
    )
  })

  // Build cards
  const cards = samples.map((sample, i) => {
    const bg = sample.options?.bg ?? ''
    return `
    <section class="sample" id="sample-${i}">
      <div class="sample-header">
        <h2>${escapeHtml(sample.title)}</h2>
        <p class="description">${formatDescription(sample.description)}</p>
      </div>
      <div class="sample-content">
        <div class="source-panel" id="source-panel-${i}">
          ${highlightedSources[i]}
          <button class="edit-btn" data-sample="${i}">Edit</button>
        </div>
        <div class="svg-panel" id="svg-panel-${i}" data-sample-bg="${bg}">
          <div class="svg-container" id="svg-${i}">
            <div class="loading-spinner"></div>
          </div>
        </div>
        <div class="ascii-panel" id="ascii-panel-${i}">
          <pre class="ascii-output"><code id="ascii-${i}">Rendering\u2026</code></pre>
        </div>
      </div>
    </section>`
  }).join('\n')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Beautiful Mermaid — Charts Gallery</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      --t-bg: #FFFFFF;
      --t-fg: #27272A;
      --foreground-rgb: 39, 39, 42;
      --shadow-border-opacity: 0.08;
      --shadow-blur-opacity: 0.06;
      --theme-bar-bg: #f9f9fa;
      font-family: 'Geist', system-ui, -apple-system, sans-serif;
      background: color-mix(in srgb, var(--t-fg) 4%, var(--t-bg));
      color: var(--t-fg);
      line-height: 1.6;
      -webkit-font-smoothing: antialiased;
    }
    .content-wrapper {
      max-width: 1440px;
      margin: 0 auto;
      padding: 2rem;
      padding-top: 0;
    }
    @media (min-width: 1000px) {
      .content-wrapper { padding: 3rem; padding-top: 0; }
    }
    body::before, body::after {
      content: '';
      position: fixed;
      left: 0; right: 0;
      height: 64px;
      pointer-events: none;
      z-index: 1000;
    }
    body::before { top: 0; background: linear-gradient(to bottom, var(--theme-bar-bg) 0%, transparent 100%); }
    body::after { bottom: 0; background: linear-gradient(to top, var(--theme-bar-bg) 0%, transparent 100%); }

    /* Theme bar */
    .theme-bar {
      position: sticky; top: 0; z-index: 1001;
      padding: 0.5rem 2rem;
      display: flex; align-items: center; gap: 0.75rem;
    }
    .theme-label {
      font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em;
      color: color-mix(in srgb, var(--t-fg) 35%, var(--t-bg)); white-space: nowrap;
    }
    .theme-pills {
      display: flex; gap: 0.3rem; margin-left: auto; position: relative; z-index: 2;
    }
    .theme-more-wrapper { position: relative; }
    .theme-more-dropdown {
      display: none; position: absolute; top: calc(100% + 6px); right: 0;
      background: var(--t-bg); border-radius: 12px; padding: 6px;
      flex-direction: column; gap: 2px; min-width: 160px; z-index: 1002;
    }
    .theme-more-dropdown.open { display: flex; }
    .theme-more-dropdown .theme-pill { width: 100%; justify-content: flex-start; background: transparent; box-shadow: none; }
    .theme-more-dropdown .theme-pill:hover { background: color-mix(in srgb, var(--t-bg) 92%, var(--t-fg)); }
    .theme-more-dropdown .theme-pill.active {
      background: var(--t-bg);
      box-shadow: rgba(var(--foreground-rgb), 0.06) 0px 0px 0px 1px, rgba(0, 0, 0, var(--shadow-blur-opacity)) 0px 1px 1px -0.5px, rgba(0, 0, 0, var(--shadow-blur-opacity)) 0px 3px 3px -1.5px;
    }
    .theme-pill {
      display: flex; align-items: center; height: 30px; gap: 8px; padding: 0 14px 0 12px;
      border: none; border-radius: 8px;
      background: color-mix(in srgb, var(--t-bg) 97%, var(--t-fg));
      color: color-mix(in srgb, var(--t-fg) 80%, var(--t-bg));
      font-size: 12px; font-weight: 500; font-family: inherit; cursor: pointer; white-space: nowrap;
      transition: color 0.15s, background 0.15s, box-shadow 0.2s;
    }
    .theme-pill:hover { color: var(--t-fg); background: color-mix(in srgb, var(--t-bg) 92%, var(--t-fg)); }
    .theme-pill.active { color: var(--t-fg); background: var(--t-bg); font-weight: 600; }
    .theme-swatch { display: inline-block; width: 14px; height: 14px; border-radius: 50%; flex-shrink: 0; }
    .shadow-minimal {
      box-shadow: rgba(var(--foreground-rgb), 0.06) 0px 0px 0px 1px, rgba(0, 0, 0, var(--shadow-blur-opacity)) 0px 1px 1px -0.5px, rgba(0, 0, 0, var(--shadow-blur-opacity)) 0px 3px 3px -1.5px;
    }
    .shadow-modal-small {
      box-shadow: rgba(var(--foreground-rgb), 0.06) 0px 0px 0px 1px, rgba(0, 0, 0, var(--shadow-blur-opacity)) 0px 3px 3px 0px, rgba(0, 0, 0, calc(var(--shadow-blur-opacity) * 0.33)) 0px 12px 12px 0px;
    }

    /* Header */
    .page-header {
      max-width: 1440px; margin: 0 auto; padding: 4rem 2rem 1.5rem; text-align: left;
    }
    @media (min-width: 1000px) { .page-header { padding: 4rem 3rem 1.5rem; } }
    .page-title { font-size: 2rem; font-weight: 800; margin: 0 0 0.25rem; }
    .page-tagline { font-size: 1rem; font-weight: 400; color: color-mix(in srgb, var(--t-fg) 50%, var(--t-bg)); margin: 0 0 0.5rem; }
    .page-meta { font-size: 0.85rem; color: color-mix(in srgb, var(--t-fg) 40%, var(--t-bg)); }

    /* Sample cards */
    .sample { background: var(--t-bg); margin-bottom: 2rem; }
    .sample-header {
      padding: 1.25rem 1.5rem; max-width: 48rem;
      border-bottom: 1px solid color-mix(in srgb, var(--t-fg) 5%, var(--t-bg));
    }
    .sample-header h2 { font-size: 1.5rem; font-weight: 500; }
    .description { color: color-mix(in srgb, var(--t-fg) 50%, var(--t-bg)); font-size: 1rem; margin-top: 0.1rem; }
    .description code {
      font-family: 'JetBrains Mono', monospace; font-size: 0.875em;
      color: color-mix(in srgb, var(--t-fg) 85%, var(--t-bg));
      background: color-mix(in srgb, var(--t-fg) 6%, var(--t-bg));
      padding: 0.15rem 0.4rem; border-radius: 3px;
    }
    .sample-content {
      display: grid;
      grid-template-columns: minmax(200px, 1fr) minmax(250px, 2fr) minmax(250px, 2fr);
      min-height: 420px;
    }
    @media (max-width: 900px) {
      .sample-content { grid-template-columns: 1fr; }
      .ascii-panel { border-left: none !important; border-top: 1px solid color-mix(in srgb, var(--t-fg) 5%, var(--t-bg)) !important; }
    }

    /* Source panel */
    .source-panel {
      position: relative; padding: 0.75rem 1.5rem;
      border-right: 1px solid color-mix(in srgb, var(--t-fg) 5%, var(--t-bg));
      min-width: 0; overflow-y: auto;
      background: color-mix(in srgb, var(--t-fg) 1.5%, var(--t-bg));
    }
    .source-panel .shiki {
      background: transparent !important; padding: 0.5rem 0; font-size: 0.8rem; line-height: 1.5;
      overflow-x: auto; white-space: pre-wrap; word-break: break-word; margin: 0;
    }
    .source-panel .shiki code { background: transparent; font-family: 'JetBrains Mono', monospace; }
    .source-panel .shiki, .source-panel .shiki span[style*="#24292e"], .source-panel .shiki span[style*="#24292E"] { color: color-mix(in srgb, var(--t-fg) 70%, var(--t-bg)) !important; }
    .source-panel .shiki span[style*="#D73A49"], .source-panel .shiki span[style*="#d73a49"] { color: color-mix(in srgb, var(--t-fg) 90%, var(--t-bg)) !important; font-weight: 500; }
    .source-panel .shiki span[style*="#6F42C1"], .source-panel .shiki span[style*="#6f42c1"] { color: color-mix(in srgb, var(--t-fg) 65%, var(--t-bg)) !important; }
    .source-panel .shiki span[style*="#E36209"], .source-panel .shiki span[style*="#e36209"] { color: color-mix(in srgb, var(--t-fg) 75%, var(--t-bg)) !important; }
    .source-panel .shiki span[style*="#032F62"], .source-panel .shiki span[style*="#032f62"] { color: color-mix(in srgb, var(--t-fg) 50%, var(--t-bg)) !important; }

    /* Edit button */
    .edit-btn {
      position: absolute; bottom: 0.75rem; left: 1.5rem;
      background: none; border: none; padding: 0;
      font-size: 0.75rem; font-family: 'JetBrains Mono', monospace;
      color: color-mix(in srgb, var(--t-fg) 35%, var(--t-bg)); cursor: pointer;
    }
    .edit-btn:hover { color: var(--t-fg); text-decoration: underline; }

    /* SVG panel */
    .svg-panel {
      padding: 1.25rem 1.5rem; display: flex; flex-direction: column; min-width: 0;
    }
    .svg-container { flex: 1; display: flex; align-items: center; justify-content: center; min-height: 0; }
    .svg-container svg { max-width: 100%; max-height: 100%; height: auto; }

    /* ASCII panel */
    .ascii-panel {
      padding: 1.25rem 1.5rem;
      border-left: 1px solid color-mix(in srgb, var(--t-fg) 5%, var(--t-bg));
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      min-width: 0;
    }
    .ascii-output {
      padding: 1rem; font-size: 0.7rem; line-height: 1.3;
      overflow-x: auto; overflow-y: hidden; white-space: pre;
      flex: 1; max-width: 100%;
      font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace;
    }

    /* Loading + error */
    .loading-spinner {
      width: 24px; height: 24px;
      border: 2px solid color-mix(in srgb, var(--t-fg) 12%, var(--t-bg));
      border-top-color: color-mix(in srgb, var(--t-fg) 35%, var(--t-bg));
      border-radius: 50%; animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .render-error { color: #ef4444; font-size: 0.85rem; font-family: 'JetBrains Mono', monospace; white-space: pre-wrap; }

    /* Edit dialog */
    .edit-overlay { display: none; position: fixed; inset: 0; z-index: 2000; background: rgba(0,0,0,0.4); backdrop-filter: blur(4px); align-items: center; justify-content: center; }
    .edit-overlay.open { display: flex; }
    .edit-dialog { background: var(--t-bg); border-radius: 16px; width: min(680px, calc(100vw - 3rem)); max-height: calc(100vh - 4rem); display: flex; flex-direction: column; overflow: hidden; }
    .edit-dialog-header { display: flex; align-items: center; justify-content: space-between; padding: 1rem 1.25rem; border-bottom: 1px solid color-mix(in srgb, var(--t-fg) 8%, var(--t-bg)); }
    .edit-dialog-title { font-size: 0.95rem; font-weight: 600; }
    .edit-dialog-close { background: none; border: none; font-size: 1.25rem; color: color-mix(in srgb, var(--t-fg) 40%, var(--t-bg)); cursor: pointer; }
    .edit-dialog-textarea { flex: 1; min-height: 300px; max-height: 60vh; padding: 1rem 1.25rem; border: none; outline: none; resize: none; background: color-mix(in srgb, var(--t-fg) 2%, var(--t-bg)); color: var(--t-fg); font-family: 'JetBrains Mono', monospace; font-size: 0.8rem; line-height: 1.5; white-space: pre; tab-size: 2; }
    .edit-dialog-footer { display: flex; justify-content: flex-end; gap: 0.5rem; padding: 0.75rem 1.25rem; border-top: 1px solid color-mix(in srgb, var(--t-fg) 8%, var(--t-bg)); }
    .edit-dialog-btn { padding: 0.5rem 1rem; border-radius: 8px; border: none; font-size: 0.8rem; font-weight: 500; font-family: inherit; cursor: pointer; }
    .edit-dialog-cancel { background: color-mix(in srgb, var(--t-fg) 8%, var(--t-bg)); color: var(--t-fg); }
    .edit-dialog-save { background: var(--t-fg); color: var(--t-bg); }

    .section-title { font-size: 1.5rem; font-weight: 700; padding: 2rem 0 1rem; }
  </style>
</head>
<body>
  <div id="safari-theme-color" style="position:fixed;top:0;left:0;right:0;height:1px;background:var(--theme-bar-bg);z-index:9999;pointer-events:none;"></div>

  <div class="theme-bar">
    <span class="theme-label">Theme</span>
    <div class="theme-pills">
      <div class="theme-more-wrapper">
        <button class="theme-pill shadow-minimal" id="theme-more-btn">${allDropdownPills.length} Themes</button>
        <div class="theme-more-dropdown shadow-modal-small" id="theme-more-dropdown">
          ${allDropdownPills.join('\n        ')}
        </div>
      </div>
    </div>
  </div>

  <header class="page-header">
    <h1 class="page-title">Charts Gallery</h1>
    <p class="page-tagline">Phase 1: Quadrant, Timeline &amp; Gantt charts</p>
    <p class="page-meta" id="total-timing">Rendering ${samples.length * 2} samples (SVG+ASCII)\u2026</p>
  </header>

  <div class="content-wrapper">
${cards}
  </div>

  <script type="module">
${bundleJs}

  var samples = ${samplesJson};
  var THEMES = window.__mermaid.THEMES;
  var renderMermaid = window.__mermaid.renderMermaidSVGAsync;
  var renderMermaidAscii = window.__mermaid.renderMermaidASCII;
  var diagramColorsToAsciiTheme = window.__mermaid.diagramColorsToAsciiTheme;
  var originalSvgStyles = [];

  function hexToRgb(hex) {
    if (!hex || typeof hex !== 'string') return null;
    var value = hex.trim();
    if (value[0] === '#') value = value.slice(1);
    if (value.length === 3) value = value[0]+value[0]+value[1]+value[1]+value[2]+value[2];
    if (value.length !== 6) return null;
    var iv = parseInt(value, 16);
    if (Number.isNaN(iv)) return null;
    return { r: (iv >> 16) & 255, g: (iv >> 8) & 255, b: iv & 255 };
  }

  function setShadowVars(theme) {
    var fg = theme ? theme.fg : '#27272A';
    var bg = theme ? theme.bg : '#FFFFFF';
    var fgRgb = hexToRgb(fg) || { r: 39, g: 39, b: 42 };
    var bgRgb = hexToRgb(bg) || { r: 255, g: 255, b: 255 };
    var brightness = (bgRgb.r * 299 + bgRgb.g * 587 + bgRgb.b * 114) / 1000;
    var darkMode = brightness < 140;
    document.body.style.setProperty('--foreground-rgb', fgRgb.r + ', ' + fgRgb.g + ', ' + fgRgb.b);
    document.body.style.setProperty('--shadow-border-opacity', darkMode ? '0.15' : '0.08');
    document.body.style.setProperty('--shadow-blur-opacity', darkMode ? '0.12' : '0.06');
  }

  function updateThemeColor(fg, bg) {
    var fgRgb = hexToRgb(fg) || { r: 39, g: 39, b: 42 };
    var bgRgb = hexToRgb(bg) || { r: 255, g: 255, b: 255 };
    var r = Math.round(bgRgb.r * 0.96 + fgRgb.r * 0.04);
    var g = Math.round(bgRgb.g * 0.96 + fgRgb.g * 0.04);
    var b = Math.round(bgRgb.b * 0.96 + fgRgb.b * 0.04);
    var hex = '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    document.body.style.setProperty('--theme-bar-bg', hex);
  }

  function applyTheme(themeKey) {
    var theme = themeKey ? THEMES[themeKey] : null;
    var body = document.body;
    if (theme) {
      body.style.setProperty('--t-bg', theme.bg);
      body.style.setProperty('--t-fg', theme.fg);
    } else {
      body.style.setProperty('--t-bg', '#FFFFFF');
      body.style.setProperty('--t-fg', '#27272A');
    }
    setShadowVars(theme);
    updateThemeColor(theme ? theme.fg : '#27272A', theme ? theme.bg : '#FFFFFF');

    var svgs = document.querySelectorAll('.svg-container svg');
    for (var j = 0; j < svgs.length; j++) {
      var svgEl = svgs[j];
      if (theme) {
        svgEl.style.setProperty('--bg', theme.bg);
        svgEl.style.setProperty('--fg', theme.fg);
        var enrichment = ['line', 'accent', 'muted', 'surface', 'border'];
        for (var k = 0; k < enrichment.length; k++) {
          if (theme[enrichment[k]]) svgEl.style.setProperty('--' + enrichment[k], theme[enrichment[k]]);
          else svgEl.style.removeProperty('--' + enrichment[k]);
        }
      } else if (originalSvgStyles[j] !== undefined) {
        svgEl.setAttribute('style', originalSvgStyles[j]);
      }
    }

    for (var j = 0; j < samples.length; j++) {
      var panel = document.getElementById('svg-panel-' + j);
      if (panel) panel.style.background = theme ? theme.bg : (panel.getAttribute('data-sample-bg') || '');
    }

    // Re-render ASCII panels with new theme colors
    var asciiTheme = theme ? diagramColorsToAsciiTheme(theme) : null;
    for (var j = 0; j < samples.length; j++) {
      var asciiEl = document.getElementById('ascii-' + j);
      if (!asciiEl) continue;
      try {
        asciiEl.innerHTML = renderMermaidAscii(samples[j].source, asciiTheme ? { theme: asciiTheme } : {});
      } catch (e) { /* keep existing */ }
    }

    var pills = document.querySelectorAll('.theme-pill');
    for (var j = 0; j < pills.length; j++) {
      var isActive = pills[j].getAttribute('data-theme') === themeKey;
      pills[j].classList.toggle('active', isActive);
    }
  }

  // Theme pill handlers
  document.getElementById('theme-more-dropdown').addEventListener('click', function(e) {
    var pill = e.target.closest('.theme-pill');
    if (pill) { applyTheme(pill.getAttribute('data-theme') || ''); }
  });
  var moreBtn = document.getElementById('theme-more-btn');
  var moreDropdown = document.getElementById('theme-more-dropdown');
  moreBtn.addEventListener('click', function(e) { e.stopPropagation(); moreDropdown.classList.toggle('open'); });
  document.addEventListener('click', function(e) {
    if (moreDropdown.classList.contains('open') && !e.target.closest('.theme-more-wrapper')) moreDropdown.classList.remove('open');
  });

  setShadowVars(null);

  // Render all samples
  var totalStart = performance.now();
  for (var i = 0; i < samples.length; i++) {
    var sample = samples[i];
    var svgContainer = document.getElementById('svg-' + i);
    try {
      var svg = await renderMermaid(sample.source, sample.options);
      svgContainer.innerHTML = svg;
      var svgEl = svgContainer.querySelector('svg');
      if (svgEl) originalSvgStyles.push(svgEl.getAttribute('style') || '');
      else originalSvgStyles.push('');
    } catch (err) {
      svgContainer.innerHTML = '<div class="render-error">' + err + '</div>';
      originalSvgStyles.push('');
    }

    // Render ASCII
    var asciiContainer = document.getElementById('ascii-' + i);
    if (asciiContainer) {
      try {
        asciiContainer.innerHTML = renderMermaidAscii(sample.source, {});
      } catch (e) {
        asciiContainer.textContent = '(ASCII not supported for this diagram type)';
      }
    }
  }
  var totalMs = (performance.now() - totalStart).toFixed(0);
  document.getElementById('total-timing').textContent = (samples.length * 2) + ' samples (SVG+ASCII) rendered in ' + totalMs + ' ms';

  // Edit dialog
  var editOverlay = document.getElementById('edit-overlay');
  var editTextarea = document.getElementById('edit-dialog-textarea');
  var editingSampleIndex = -1;

  function openEditDialog(index) {
    editingSampleIndex = index;
    editTextarea.value = samples[index].source;
    editOverlay.classList.add('open');
    editTextarea.focus();
  }

  function closeEditDialog() {
    editOverlay.classList.remove('open');
    editingSampleIndex = -1;
  }

  async function saveAndRender() {
    var index = editingSampleIndex;
    if (index < 0) return;
    samples[index].source = editTextarea.value;
    closeEditDialog();
    var svgContainer = document.getElementById('svg-' + index);
    try {
      var svg = await renderMermaid(samples[index].source, samples[index].options);
      svgContainer.innerHTML = svg;
    } catch (err) {
      svgContainer.innerHTML = '<div class="render-error">' + err + '</div>';
    }
    // Re-render ASCII
    var asciiContainer = document.getElementById('ascii-' + index);
    if (asciiContainer) {
      try {
        asciiContainer.innerHTML = renderMermaidAscii(samples[index].source, {});
      } catch (e) {
        asciiContainer.textContent = '(ASCII error: ' + e.message + ')';
      }
    }
  }

  document.addEventListener('click', function(e) { var btn = e.target.closest('.edit-btn'); if (btn) openEditDialog(parseInt(btn.dataset.sample, 10)); });
  document.getElementById('edit-dialog-save').addEventListener('click', saveAndRender);
  document.getElementById('edit-dialog-cancel').addEventListener('click', closeEditDialog);
  document.getElementById('edit-dialog-close').addEventListener('click', closeEditDialog);
  editOverlay.addEventListener('click', function(e) { if (e.target === editOverlay) closeEditDialog(); });
  document.addEventListener('keydown', function(e) {
    if (!editOverlay.classList.contains('open')) return;
    if (e.key === 'Escape') closeEditDialog();
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') saveAndRender();
  });
  </script>

  <div class="edit-overlay" id="edit-overlay">
    <div class="edit-dialog shadow-modal-small">
      <div class="edit-dialog-header">
        <span class="edit-dialog-title">Edit Diagram</span>
        <button class="edit-dialog-close" id="edit-dialog-close">&times;</button>
      </div>
      <textarea class="edit-dialog-textarea" id="edit-dialog-textarea" spellcheck="false"></textarea>
      <div class="edit-dialog-footer">
        <button class="edit-dialog-btn edit-dialog-cancel" id="edit-dialog-cancel">Cancel</button>
        <button class="edit-dialog-btn edit-dialog-save" id="edit-dialog-save">Save &amp; Render</button>
      </div>
    </div>
  </div>
</body>
</html>`
}

const html = await generateHtml()
const outPath = new URL('./chart-index.html', import.meta.url).pathname
await Bun.write(outPath, html)
console.log(`Written to ${outPath} (${(html.length / 1024).toFixed(1)} KB)`)
