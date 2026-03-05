

## Problem

The `.chat-bg-pattern` CSS class has `filter: brightness(0.7)` which applies to the entire messages container, including all child elements. This darkens everything — text, bubbles, timestamps — by 30%. No amount of `!important` or inline styles can override a parent's CSS filter.

## Solution

Remove `filter: brightness(0.7)` from `.chat-bg-pattern` and instead darken only the background by using a darker `background-color` value directly.

**File**: `src/index.css` (line 172-177)

Replace:
```css
.chat-bg-pattern {
  background-color: #080f14;
  background-image: url('/images/chat-bg-pattern.png');
  background-size: 200px;
  background-repeat: repeat;
  filter: brightness(0.7);
}
```

With:
```css
.chat-bg-pattern {
  background-color: #060a0e;
  background-image: url('/images/chat-bg-pattern.png');
  background-size: 200px;
  background-repeat: repeat;
}
```

The darker `background-color` (`#060a0e`) compensates for removing the brightness filter, keeping the background dark while allowing text and bubbles to render at full brightness with true white `#ffffff`.

Also remove the now-unnecessary inline `style={{ color: '#ffffff' }}` from `ChatPanel.tsx` and revert to a simple `text-white` class, since without the filter override it will work correctly.

