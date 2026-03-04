

## Plan: WhatsApp-style Chat Layout with Patterned Background

### What changes

**1. `src/index.css`** — Add a WhatsApp-style doodle/pattern background using a CSS SVG pattern (dark theme compatible). This creates the iconic subtle icon pattern seen in WhatsApp's chat area.

```css
.chat-bg-pattern {
  background-color: hsl(225 35% 4%);
  background-image: url("data:image/svg+xml,..."); /* SVG pattern with subtle chat icons */
  background-size: 300px;
  background-repeat: repeat;
}
```

**2. `src/components/conversations/ChatPanel.tsx`** — Apply WhatsApp-identical styling:

- **Messages area**: Add `chat-bg-pattern` class to the scrollable messages container, replacing the plain `bg-background`
- **Message bubbles**: Refine to match WhatsApp more closely:
  - Outbound (sent): Keep green (`hsl(142,50%,24%)`), use WhatsApp-style rounded corners with a small tail (rounded everywhere except bottom-right)
  - Inbound (received): Use a slightly lighter card color (`bg-[hsl(225,30%,12%)]`) instead of bordered card style, with tail on bottom-left
- **Date separator**: Style as a small rounded pill with semi-transparent dark background (like WhatsApp's "Hoje" pill)
- **Header**: Keep as-is (already looks good)
- **Input area**: Keep as-is with the dark card background

### Files to modify
1. `src/index.css` — Add `.chat-bg-pattern` CSS class with SVG repeating pattern
2. `src/components/conversations/ChatPanel.tsx` — Apply pattern class to messages area, refine bubble styles

