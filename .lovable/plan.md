

## Problem

The current dark theme uses a washed-out, low-saturation gray (`222 30% 8%` background, `222 25% 11%` cards) that looks flat and lifeless. The light theme is similarly bland. The overall effect is "dead gray" — no depth, no contrast hierarchy, no premium feel.

## Solution: Deeper, richer dark palette with better contrast layers

### Color System Overhaul (`src/index.css`)

**Dark mode** — shift to a deeper, blue-tinted near-black with more layered contrast:

| Token | Current | New | Rationale |
|---|---|---|---|
| `--background` | `222 30% 8%` | `225 35% 5%` | Deeper, richer black with blue undertone |
| `--foreground` | `210 20% 93%` | `210 15% 95%` | Slightly brighter text |
| `--card` | `222 25% 11%` | `225 30% 8%` | Cards clearly lifted from bg |
| `--popover` | `222 25% 11%` | `225 30% 10%` | Popover layer above cards |
| `--secondary` | `222 20% 16%` | `225 25% 12%` | Better secondary surface |
| `--muted` | `222 20% 16%` | `225 25% 12%` | Consistent with secondary |
| `--muted-foreground` | `215 15% 55%` | `215 15% 50%` | Slightly dimmer for hierarchy |
| `--border` | `222 20% 18%` | `225 20% 14%` | Subtler borders, less visible |
| `--input` | `222 20% 18%` | `225 20% 14%` | Match border |
| `--sidebar-background` | `222 30% 6%` | `225 40% 4%` | Darkest layer |
| `--sidebar-accent` | `222 20% 14%` | `225 25% 10%` | Deeper accent |
| `--sidebar-border` | `222 20% 14%` | `225 20% 8%` | Very subtle sidebar border |

**Light mode** — warmer, less "dead white":

| Token | Current | New |
|---|---|---|
| `--background` | `220 20% 97%` | `220 15% 96%` |
| `--card` | `0 0% 100%` | `0 0% 100%` (keep) |
| `--secondary` | `220 14% 90%` | `220 14% 92%` |
| `--muted` | `220 14% 93%` | `220 12% 94%` |
| `--border` | `220 13% 87%` | `220 10% 89%` |
| `--sidebar-background` | `0 0% 98%` | `220 15% 97%` |

### Files to edit
- `src/index.css` — update CSS custom properties for both light and dark themes

