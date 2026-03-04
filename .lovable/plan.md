

## Plan: Autosave with History + Fix Add Node Button

### 1. Autosave with Debounce
- Remove the "Salvar" button and `isSaving` state from `FlowEditor.tsx`
- Add a `useEffect` that watches `nodes`, `edges`, and `name` changes
- Debounce saves with a 1.5s delay using `setTimeout`/`useRef` pattern
- Show a subtle status indicator (e.g., "Salvando..." / "Salvo ✓") in the top panel instead of the save button
- Call `onSave(name, nodes, edges)` automatically on each debounced change

### 2. Modification History
- Create a new database table `chatbot_flow_history` with columns: `id`, `flow_id` (FK), `user_id`, `name`, `nodes` (jsonb), `edges` (jsonb), `created_at`
- Add RLS policies for user access
- Before each autosave, insert a snapshot into `chatbot_flow_history`
- Limit stored snapshots (keep last 50 per flow, or debounce history saves to every ~30s to avoid excessive records)
- Add a "Histórico" button in the top panel that opens a sheet/dialog listing past versions with timestamps
- Each history entry shows a timestamp and allows "Restaurar" to load that version back into the editor

### 3. Fix Add Node Button
- The current "Adicionar Nó" popover button works but may have positioning/interaction issues. Ensure it functions correctly by reviewing its placement and ensuring it doesn't conflict with the canvas. Move it to a more accessible position if needed.

### Technical Details

**New migration:**
```sql
CREATE TABLE public.chatbot_flow_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id uuid NOT NULL,
  user_id uuid NOT NULL,
  name text NOT NULL,
  nodes jsonb NOT NULL DEFAULT '[]',
  edges jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.chatbot_flow_history ENABLE ROW LEVEL SECURITY;
-- RLS: users can view/insert/delete own history
```

**Files to edit:**
- `src/components/chatbot/FlowEditor.tsx` — remove save button, add autosave effect, add history panel trigger, add save status indicator
- New hook `src/hooks/useFlowHistory.ts` — fetch/insert history snapshots
- New component `src/components/chatbot/FlowHistoryPanel.tsx` — sheet listing versions with restore action

