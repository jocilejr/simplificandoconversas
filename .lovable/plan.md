

## Plan: Optimize Chat Appearance

### Issues to fix
1. **Images too large** — No max dimensions on images, they fill 70% of viewport width
2. **Background pattern** — Current SVG pattern is barely visible, needs to match WhatsApp's doodle style (image-72 reference)
3. **Message bubbles** — Need better contrast and readability, closer to WhatsApp reference (image-73)

### Changes

**1. `src/components/conversations/ChatPanel.tsx`**
- Limit images: add `max-h-[280px] max-w-[280px] w-auto object-cover` to constrain image size
- Limit video: `max-h-[280px] max-w-[280px]`
- Limit audio: keep as-is (already compact)
- Reduce bubble max-width from `max-w-[70%]` to `max-w-[65%]` for tighter bubbles
- Add slight padding adjustments for better text readability
- Inbound bubble: use `bg-[hsl(225,30%,12%)]` instead of `bg-card` for more contrast against the patterned background

**2. `src/index.css`**
- Replace the current complex SVG pattern with the actual WhatsApp-style doodle pattern (matching image-72): a darker, more visible pattern with recognizable icons (phones, hearts, clocks, cameras, etc.)
- Increase opacity from 0.03/0.04 to 0.06/0.07 so the pattern is actually visible like in the reference images

