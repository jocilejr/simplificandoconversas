

## Plan: Redesign Flow Cards — Professional & Refined

### Problems with current design
- Cards look flat and generic — just a plain `bg-card` box with no visual interest
- The full-width "Ativar/Parar" button dominates the card and looks cheap
- Status badge is tiny and disconnected from the flow identity
- No visual distinction between cards — they all look identical
- The left border accent (`border-l-2`) is too subtle to convey status
- Overall layout feels like a basic admin template, not a polished product

### New card design

**Structure per card:**
1. **Top bar** — subtle gradient or colored top border (4px) based on status: green for active, muted for inactive
2. **Icon + Name row** — small `Workflow` icon in a tinted circle + flow name (medium weight, truncated) + dropdown menu (3-dot) on hover
3. **Status** — inline dot indicator (green/gray) with "Ativo"/"Inativo" text, no badge component — cleaner
4. **Metadata row** — node count + last modified, same as now but with slightly better spacing
5. **Footer** — small toggle-style button or subtle text button for activate/deactivate, not a full-width destructive button

**Visual improvements:**
- Cards get `hover:shadow-lg hover:shadow-primary/5` for a subtle glow on hover
- Remove the heavy `border-l-2` in favor of a `border-t-2` colored accent at top
- Better padding and internal spacing (p-6 instead of p-5)
- The "New Flow" card gets a centered `+` icon with hover scale effect

**Header area:**
- Keep title + button as-is (already clean)

### Files to edit
- `src/pages/ChatbotBuilder.tsx` — redesign card markup and classes

