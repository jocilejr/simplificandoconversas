

## Plan: Adjust Audio Player Box Size and Layout

Based on the reference image (image-83), I need to:

### Changes to `src/components/conversations/WhatsAppAudioPlayer.tsx`

1. **Increase min-width** to `320px` and **max-width** to `420px` — make the box visibly larger
2. **Add timestamp on the right** below the waveform (matching "20:37" position in the reference image) — show duration on left, message time on right
3. **Reduce gap between avatar/speed button and the timestamp row** — tighten the bottom area
4. **Make time row a flex with justify-between** for duration (left) and timestamp (right)

### Changes to `src/components/conversations/ChatPanel.tsx`

1. **Pass the message timestamp** to `WhatsAppAudioPlayer` so it can display "20:37" style time on the right side below the waveform (matching the reference exactly)

### Files
1. `src/components/conversations/WhatsAppAudioPlayer.tsx` — increase dimensions, add timestamp layout
2. `src/components/conversations/ChatPanel.tsx` — pass `timestamp` prop to audio player

