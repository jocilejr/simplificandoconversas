

## Plan: Use WhatsApp Doodle Background Image

The current SVG pattern doesn't match the WhatsApp aesthetic. The uploaded image shows the actual WhatsApp-style doodle pattern with animal/nature illustrations (cats, birds, cacti, etc.) in subtle outline style on a dark background.

### Approach
Instead of trying to recreate the pattern with inline SVG (which always looks off), copy the uploaded image directly into the project and use it as a repeating `background-image`.

### Changes

**1. Copy the uploaded image to `public/images/chat-bg-pattern.png`**

**2. `src/index.css`** — Replace the `.chat-bg-pattern` class:
- Dark mode: `background-color: #0B141A` with `background-image: url('/images/chat-bg-pattern.png')` repeating
- Light mode: same image with adjusted brightness/opacity via CSS filter or a separate light variant
- `background-size` tuned to match the natural tile size of the image (~300-400px)

### Files
1. Copy `user-uploads://image-74.png` to `public/images/chat-bg-pattern.png`
2. Edit `src/index.css` — replace `.chat-bg-pattern` CSS with the image-based background

