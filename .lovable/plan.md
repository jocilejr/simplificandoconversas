

## Fix: Group node showing only 1 output handle instead of 2

### Root Cause

The card div has `overflow-hidden` (line 362 in GroupNode.tsx), and the React Flow Handle components positioned with custom `top` styles are being clipped or obscured. While the footer labels ("Continuou ✓" / "Se não clicou ⏱") render correctly inside the card, the actual connection handles on the right edge are not both visible.

The `top: "calc(100% - 52px)"` and `top: "calc(100% - 24px)"` positioning relies on the outer wrapper's height, but React Flow's internal node wrapper may interfere with handle visibility when they overlap with the card boundary.

### Fix in `src/components/chatbot/GroupNode.tsx`

**Remove `overflow-hidden` from the card div** (line 362) and replace with `overflow-visible` so handles can extend beyond the card boundary. Also add explicit `clip-path` or adjust the rounding only on inner content to keep the visual rounded corners without clipping the handles.

Alternatively (simpler approach): Keep the footer section OUTSIDE the card div, alongside the handles, so both the labels and handles are in the outer `relative` div and not subject to `overflow-hidden`. This way the handles and their corresponding labels are guaranteed to be visible and properly aligned.

### Specific changes

1. **Move the finalizer footer (`"Continuou ✓"` / `"Se não clicou ⏱"`) outside the card div** — place it after the closing `</div>` of the card (line 488), before the handles, so it's a sibling of the handles in the outer `relative` wrapper.

2. **Adjust footer positioning** to visually align with the handles on the right edge, using `absolute` or relative positioning that matches the handle `top` values.

3. **Keep `overflow-hidden` on the card** for clean rounded corners on the card content, but ensure handles and footer labels are outside it.

### File changed
- `src/components/chatbot/GroupNode.tsx`

