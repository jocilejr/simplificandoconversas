

## Problem

The time and unread count elements exist in the DOM (confirmed via browser inspection: "15:44" and "6"), but they are invisible — pushed off-screen and clipped by the `ScrollArea`'s `overflow: hidden`. The `flex` layout lets the content column (name + instance badge) expand too much, pushing the right column beyond the card's visible width.

## Root Cause

The `ScrollArea` component sets `overflow-x: hidden` on its viewport. The content div (`flex-1 min-w-0`) combined with the instance badge (`shrink-0`) isn't shrinking enough to leave room for the right column, which gets clipped.

## Solution

Replace the `flex` layout of the card with a `CSS grid` layout using fixed column sizes to guarantee space for each section:

**`src/components/conversations/ConversationList.tsx`** — Change the card button from flex to grid:

```tsx
<button
  className={cn(
    "w-full text-left px-3 py-3 transition-all duration-150 grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-xl",
    ...
  )}
>
  <ContactAvatar ... />
  
  <div className="min-w-0 overflow-hidden">
    <div className="flex items-center gap-2 min-w-0">
      <span className="truncate ...">{name}</span>
      {instance badge - remove shrink-0}
    </div>
    <p className="truncate ...">{last_message}</p>
  </div>
  
  <div className="flex flex-col items-end gap-1">
    <span>{time}</span>
    {badge}
  </div>
</button>
```

Key changes:
1. Button: `flex items-center` → `grid grid-cols-[auto_1fr_auto] items-center` — this guarantees the rightmost column always gets its natural width
2. Content div: add `overflow-hidden` to ensure long names don't push content out
3. Instance badge: remove `shrink-0` so it can shrink with the content column
4. Right column: remove `shrink-0` (not needed with grid `auto`)
5. Remove `relative` from button (no longer needed)

