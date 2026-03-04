

## Plan: Rename to "Fluxos Automáticos" + Redesign Flow Cards

### Changes

**1. Rename everywhere**
- `ChatbotBuilder.tsx`: Title "Chatbot Builder" → "Fluxos Automáticos", subtitle updated
- `AppSidebar.tsx`: Menu item "Chatbot Builder" → "Fluxos"
- Empty state text updated to match

**2. Redesign the flow listing page (`ChatbotBuilder.tsx`)**

Current design is basic cards with small text. New design:

- **Header**: Clean layout with "Fluxos Automáticos" title (no subtitle paragraph — keep it minimal) and a refined "Novo Fluxo" button
- **Flow cards**: Taller cards with better visual hierarchy:
  - Top section: flow name in medium font, status dot with label ("Ativo" / "Inativo") as a subtle badge
  - Middle: node count and last modified date with icons (not just raw text)
  - Bottom: action buttons (Ativar/Parar) with better spacing, and the dropdown menu integrated more cleanly
  - Subtle left border accent color (green for active, muted for inactive) instead of the tiny 2px dot
- **Empty state**: Replace the Bot icon with a more relevant `Workflow` or `GitBranch` icon from Lucide, cleaner copy
- **"New flow" card**: Refined dashed card with better hover state

**3. Sidebar label**
- Change icon from `Bot` to `Workflow` (or `GitBranch`) to match the new naming
- Label: "Fluxos" (short, professional)

### Files to edit
- `src/pages/ChatbotBuilder.tsx` — rename + redesign cards
- `src/components/AppSidebar.tsx` — rename menu item + change icon

