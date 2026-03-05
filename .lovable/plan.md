

## Plan: Refine Audio Player to Match WhatsApp Reference

Based on images 81 and 82, the changes needed are:

### Changes to `src/components/conversations/WhatsAppAudioPlayer.tsx`

1. **Add playback speed control**: When audio is playing, show a speed button (1x → 1.5x → 2x) on the right side (replacing/beside the avatar area), matching image 82
2. **Reduce internal padding**: Remove excess vertical space — tighter `py-0` or minimal padding, reduce gap between waveform and time label
3. **Make the player wider**: Increase `max-w` to `~370px` so it fills more of the chat bubble
4. **Waveform adjustments**: Make bars slightly taller to fill vertical space better, matching the denser look in image 81
5. **Time layout**: Show duration on the left and message timestamp on the right below the waveform, matching image 81 layout
6. **Speed button**: Small rounded button showing "1x" / "1,5x" / "2x" that cycles on click, positioned to the right of the waveform area when playing (as in image 82)

### Files
1. `src/components/conversations/WhatsAppAudioPlayer.tsx` — all UI and logic changes

