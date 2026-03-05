

## Problem

The `!text-white` Tailwind class sets `color: rgb(255, 255, 255) !important`, but the `antialiased` class on `body` (via `-webkit-font-smoothing: antialiased`) can make white text appear slightly muted on dark backgrounds. Additionally, Tailwind's `!important` modifier may not be winning against inherited styles in all cases.

## Solution

Use inline `style` to set the color directly on the bubble `div`, which has the highest CSS specificity and cannot be overridden by any class-based rule:

**File**: `src/components/conversations/ChatPanel.tsx` (lines 189-196)

Replace the bubble `div` to include `style={{ color: '#ffffff' }}` and remove the `!text-white` class:

```tsx
<div
  className={cn(
    "max-w-[85%] text-sm shadow-sm",
    msg.message_type === "audio" ? "px-2 py-1.5" : "px-4 py-2.5",
    isOutbound
      ? "bg-[#075e54] rounded-2xl rounded-br-sm"
      : "bg-[#1f2c34] rounded-2xl rounded-bl-sm"
  )}
  style={{ color: '#ffffff' }}
>
```

This guarantees pure white `#ffffff` regardless of any theme variable or CSS specificity issue.

