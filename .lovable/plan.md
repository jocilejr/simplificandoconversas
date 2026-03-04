

## Problem

The unread count badge IS in the code and the data shows `unread_count: 4` for the first conversation. The badge is likely being clipped or hidden due to layout overflow. The parent container uses `flex items-center justify-between` but the instance name badge and the time+count badge compete for the limited horizontal space, potentially pushing the count badge off-screen or truncating it.

## Solution

1. **Restructure the card layout** to place the unread badge and timestamp in a dedicated right column that won't be squeezed:
   - Move the time and unread count to a **separate right-aligned column** outside the main content flex, ensuring they always have space to render
   - Use a 3-column layout: avatar | content | time+badge

2. **Make the unread badge more prominent**:
   - Place it below the timestamp in a vertical stack on the right side
   - Use `min-w-fit` to prevent shrinking

## Changes

**`src/components/conversations/ConversationList.tsx`** — Restructure the card layout:
- Change from `avatar + content(name+time row)` to `avatar + content(name+instance) + right-column(time+badge)`
- The right column will be a flex-col with shrink-0, ensuring it never gets clipped
- Instance badge stays next to the name
- Time and unread count stack vertically on the right side, always visible

```tsx
<button className={cn("w-full text-left px-3 py-3 ... flex items-center gap-3 ...")}>
  <ContactAvatar ... />
  
  {/* Center: name + last message */}
  <div className="flex-1 min-w-0">
    <div className="flex items-center gap-2 min-w-0">
      <span className="truncate ...">{name}</span>
      {instance badge}
    </div>
    <p className="truncate ...">{last_message}</p>
  </div>
  
  {/* Right column: time + unread badge - ALWAYS visible */}
  <div className="flex flex-col items-end gap-1 shrink-0">
    <span className="text-[10px] ...">{time}</span>
    {hasUnread && (
      <span className="h-[18px] min-w-[18px] rounded-full bg-primary ...">
        {count}
      </span>
    )}
  </div>
</button>
```

This ensures the badge is in its own non-shrinkable column and will always be visible regardless of content width.

