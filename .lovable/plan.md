

## Plan: WhatsApp-Style Audio Player with Contact Avatar

Based on the reference image (image-78), the audio player needs:
1. **Play button** on the left (green triangle, no background circle)
2. **Blue progress dot** sliding over the waveform bar
3. **Time display** below the waveform on the left
4. **Contact avatar** (circular photo) on the right side of the player

### Changes

**1. `src/components/conversations/WhatsAppAudioPlayer.tsx`** — Redesign the component:
- Accept new props: `contactPhoto` and `contactName` for the avatar on the right
- Replace the circular button background with a plain icon (green for inbound, white for outbound)
- Add a **draggable blue dot** (`bg-[#53bdeb]`) overlaid on the waveform at the current progress position
- Waveform bars: thinner (`2px`), more bars (~40) for denser look matching WhatsApp
- Time label positioned below waveform on the left
- Add `ContactAvatar` component on the right side (small, ~34px) for inbound messages

**2. `src/components/conversations/ChatPanel.tsx`** — Pass contact info to audio player:
- Pass `contactPhoto` and `contactName` props when rendering `<WhatsAppAudioPlayer>` for inbound messages
- For outbound, no avatar needed

### Files
1. `src/components/conversations/WhatsAppAudioPlayer.tsx` — rewrite UI layout
2. `src/components/conversations/ChatPanel.tsx` — pass avatar props to audio player

