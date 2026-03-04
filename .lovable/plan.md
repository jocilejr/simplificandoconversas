

## Problem Analysis

The step cards inside `GroupNode` use native HTML drag-and-drop with `nopan nodrag` classes, which only handles reordering within the same group. There is no mechanism to:
1. Drag a step **out** of a group to make it standalone
2. Drag a step from one group **into** another group

The `onDragEnd` in `StepRow` only dispatches `group-reorder-step` — it never checks if the drop happened outside the group bounds.

## Solution

### 1. Detect drag-out in `GroupNode.tsx`

In `StepRow`'s `onDragEnd`, check if the mouse position is outside the parent group element's bounding rect. If so, dispatch a new `group-extract-step` CustomEvent with `{ nodeId, stepId, clientX, clientY }` instead of `group-reorder-step`.

Also set a `dataTransfer` type identifier so other groups can accept the drop via `onDragOver`/`onDrop`.

### 2. Handle extraction in `FlowEditor.tsx`

Add a `useEffect` listener for `group-extract-step`:
- Remove the step from its source group (using existing `removeStepFromGroup` logic but without the offset — use the mouse position converted via `screenToFlowPosition`)
- After creating the standalone node, run proximity docking check against all other nodes to see if it should immediately dock into another group

### 3. Enable cross-group docking via drop zones

In `GroupNode.tsx`, add `onDragOver` and `onDrop` handlers on the steps container so it can accept steps dragged from other groups. When a foreign step is dropped, dispatch a `group-receive-step` event with `{ targetNodeId, stepData }`.

In `FlowEditor.tsx`, listen for `group-receive-step` to add the step to the target group and remove it from the source.

### Technical details

- **GroupNode StepRow `onDragEnd`**: Compare `e.clientX/clientY` against `e.currentTarget.closest('.group-drag-handle')?.parentElement?.getBoundingClientRect()`. If outside → extract event.
- **GroupNode container**: Add `onDrop` handler that reads `stepId` and `sourceNodeId` from `dataTransfer`, dispatches `group-receive-step`.
- **FlowEditor**: New event listeners for `group-extract-step` and `group-receive-step` that manipulate `setNodes`.
- Store `sourceNodeId` and `stepId` in `dataTransfer.setData()` during `onDragStart` so cross-group drops work.

