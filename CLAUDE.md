# Notion Charts (`~/notion-charts`)

Turns Notion databases into charts and serves embeds for Notion pages.

## Basics
- Stack: Next.js 16 · React 19 · Recharts 3 · `@notionhq/client` · Vercel KV
- Production: https://notion-charts-pied.vercel.app
- GitHub: `Lucian0928/notion-charts`
- Env vars in `.env.local` (git-ignored); refresh with `vercel env pull`. Key ones: `NOTION_CHARTS_TOKEN`, `KV_*`.
- Notion side: a database page must be connected to the "notion chart api" integration, or New Chart cannot find it.

## Structure
- `app/page.tsx`: dashboard (sidebar + chart cards)
- `app/builder/`: chart editor
- `app/embed/route.ts`: embed HTML/JS generated from a template string
- `lib/chartSvg.ts`: SVG chart rendering; `lib/notion*.ts`: Notion reads
- `scripts/verify-embed.mjs`: runs on `prebuild`, checks escaping in the embed script

### Caution
- The script in `app/embed/route.ts` lives inside a template literal, so regex backslashes are fragile. Always run `npm run verify:embed` after editing it (this once dropped the last digit of Y-axis labels).

## Design
Tokens are in `:root` of `app/globals.css`; Tailwind v4 (`@import "tailwindcss"`).

### Color tokens (light theme)
| Token | Value |
|---|---|
| `--bg` | `#f2f2f7` (iOS system gray) |
| `--surface` | `rgba(255,255,255,0.72)` |
| `--border` | `rgba(0,0,0,0.07)` |
| `--accent` | `#6366f1` (indigo) |
| `--accent-glow` | `rgba(99,102,241,0.15)` |
| `--text` / `--muted` | `#111827` / `#6b7280` |
| `--sidebar-w` | `220px` |

- Font: system stack `-apple-system, BlinkMacSystemFont, "Segoe UI"`.

### Components (glass liquid UI)
- `.glass` card: `blur(20px) saturate(160%)`, 72% white, 16px radius, inner white highlight.
- `.btn-primary`: 12% indigo fill + 30% border + glass blur, 10px radius, `scale(0.97)` on press.
- `.btn-ghost`: 55% white glass button.
- Charts:
  - Bar: wide bars, rounded corners, no value labels, tooltip on hover.
  - Pie / doughnut: side labels, swatch legend, no stroke, slice explodes on hover.
  - Line: flat semi-transparent fill (no gradient); axis and grid colors match the line color; X-label font shrinks to fit.
- UI copy is English.

### Safari / WebKit pitfalls
- Card grid children need `min-width: 0`. Otherwise WebKit sizes columns from the SVG's intrinsic width and any hover repaint blows out the layout.
- `backdrop-filter` creates a stacking context. When a card's dropdown is open, raise the card above the click-outside overlay (z-index 40), or Edit/Delete become unclickable.
