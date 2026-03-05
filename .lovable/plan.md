

## Problem

The text inside chat bubbles is not pure white. Even though `text-white` is applied, the color appears muted. This is likely because Tailwind's `text-white` is being overridden by the global `body { @apply text-foreground }` rule (which sets color to `hsl(210, 15%, 95%)` — an off-white), and CSS specificity or inheritance is winning.

## Solution

Force pure white text on both inbound and outbound message bubble content using inline style or `!important` via Tailwind's `!` prefix. Specifically in `ChatPanel.tsx`:

1. Change outbound bubble class from `text-[#ffffff]` to `!text-white`
2. Change inbound bubble class from `text-white` to `!text-white`

This ensures the white color overrides any inherited theme values. Both bubble types will render with `rgb(255, 255, 255)` pure white text.

**File**: `src/components/conversations/ChatPanel.tsx` — line ~192-194, update the `cn()` classes for the message bubble `div`.

