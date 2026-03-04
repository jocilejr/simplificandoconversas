import { useState, useCallback, useRef, useMemo } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  Panel,
  useNodesState,
  useEdgesState,
  addEdge,
  BackgroundVariant,
  SelectionMode,
  useReactFlow,
  type Connection,
  type NodeTypes,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Save, ArrowLeft, Plus, icons } from "lucide-react";
import { PropertiesPanel } from "@/components/chatbot/PropertiesPanel";
import StepNode from "@/components/chatbot/StepNode";
import GroupNode from "@/components/chatbot/GroupNode";
import {
  type FlowNodeType,
  type FlowNodeData,
  type FlowNode,
  type FlowStepData,
  nodeTypeConfig,
  defaultNodeData,
} from "@/types/chatbot";
import { toast } from "sonner";

const DOCK_THRESHOLD = 80;

const nodeTypes: NodeTypes = {
  step: StepNode,
  groupBlock: GroupNode,
};

interface FlowEditorProps {
  flowId: string;
  flowName: string;
  initialNodes?: any[];
  initialEdges?: any[];
  onBack: () => void;
  onSave?: (name: string, nodes: any[], edges: any[]) => Promise<void>;
}

function FlowEditorInner({ flowId, flowName, initialNodes, initialEdges, onBack, onSave }: FlowEditorProps) {
  const migratedNodes = useMemo(() => {
    const raw = initialNodes || [];
    return raw.map((n: any) => {
      if (n.type === "step" || n.type === "groupBlock") return n;
      // Migrate old "group" type to "groupBlock"
      if (n.type === "group") return { ...n, type: "groupBlock" };
      if (n.type === "block") {
        const data = n.data || {};
        const children = data.children || [];
        if (children.length > 0) {
          const firstChild = children[0];
          return { ...n, type: "step", data: { label: firstChild.label || data.label, type: firstChild.type || data.type, ...firstChild } };
        }
        return { ...n, type: "step" };
      }
      return { ...n, type: "step" };
    });
  }, [initialNodes]);

  const [nodes, setNodes, onNodesChange] = useNodesState(migratedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges || []);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [name, setName] = useState(flowName);
  const [isSaving, setIsSaving] = useState(false);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const reactFlowInstance = useReactFlow();

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId) as FlowNode | null,
    [nodes, selectedNodeId]
  );

  const onConnect = useCallback(
    (params: Connection) =>
      setEdges((eds) =>
        addEdge({ ...params, type: "smoothstep", animated: false, style: { stroke: "hsl(142 70% 45% / 0.5)", strokeWidth: 2 } }, eds)
      ),
    [setEdges]
  );

  const addNode = useCallback(
    (type: FlowNodeType) => {
      if (type === "groupBlock") return;
      const config = nodeTypeConfig[type];
      const center = reactFlowInstance.screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
      const offset = { x: (Math.random() - 0.5) * 100, y: (Math.random() - 0.5) * 100 };
      const newNode: FlowNode = {
        id: crypto.randomUUID(),
        type: "step",
        position: { x: center.x + offset.x, y: center.y + offset.y },
        data: { label: config.label, type, ...defaultNodeData[type] } as FlowNodeData,
      };
      setNodes((nds) => nds.concat(newNode));
      setAddMenuOpen(false);
      toast.success(`${config.label} adicionado`);
    },
    [reactFlowInstance, setNodes]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const type = event.dataTransfer.getData("application/reactflow") as FlowNodeType;
      if (!type || type === "groupBlock") return;
      const config = nodeTypeConfig[type];
      const position = reactFlowInstance.screenToFlowPosition({ x: event.clientX, y: event.clientY });
      const newNode: FlowNode = {
        id: crypto.randomUUID(),
        type: "step",
        position,
        data: { label: config.label, type, ...defaultNodeData[type] } as FlowNodeData,
      };
      setNodes((nds) => nds.concat(newNode));
    },
    [reactFlowInstance, setNodes]
  );

  // ─── Proximity docking logic ───
  const onNodeDrag = useCallback(
    (_: React.MouseEvent, draggedNode: Node) => {
      const draggedData = draggedNode.data as FlowNodeData;
      // Triggers never dock
      if (draggedData.type === "trigger") {
        setDropTarget(null);
        return;
      }

      let closestId: string | null = null;
      let closestDist = Infinity;

      for (const node of nodes) {
        if (node.id === draggedNode.id) continue;
        const nodeData = node.data as FlowNodeData;
        // Can't dock to triggers
        if (nodeData.type === "trigger") continue;

        const dx = (node.position?.x || 0) - (draggedNode.position?.x || 0);
        const dy = (node.position?.y || 0) - (draggedNode.position?.y || 0);
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < DOCK_THRESHOLD && dist < closestDist) {
          closestDist = dist;
          closestId = node.id;
        }
      }

      if (closestId !== dropTarget) {
        // Clear old target indicator
        if (dropTarget) {
          setNodes((nds) =>
            nds.map((n) =>
              n.id === dropTarget ? { ...n, data: { ...n.data, isDockTarget: false } } : n
            )
          );
        }
        // Set new target indicator
        if (closestId) {
          setNodes((nds) =>
            nds.map((n) =>
              n.id === closestId ? { ...n, data: { ...n.data, isDockTarget: true } } : n
            )
          );
        }
        setDropTarget(closestId);
      }
    },
    [nodes, dropTarget, setNodes]
  );

  const onNodeDragStop = useCallback(
    (_: React.MouseEvent, draggedNode: Node) => {
      // Clear all dock indicators
      setNodes((nds) =>
        nds.map((n) => (n.data as any).isDockTarget ? { ...n, data: { ...n.data, isDockTarget: false } } : n)
      );

      if (!dropTarget) return;

      const draggedData = draggedNode.data as FlowNodeData;
      if (draggedData.type === "trigger") {
        setDropTarget(null);
        return;
      }

      const targetNode = nodes.find((n) => n.id === dropTarget);
      if (!targetNode) {
        setDropTarget(null);
        return;
      }

      const targetData = targetNode.data as FlowNodeData;

      // Build the steps for the merged group
      let existingSteps: FlowStepData[] = [];
      let newSteps: FlowStepData[] = [];

      // Target: extract steps
      if (targetNode.type === "groupBlock" && targetData.steps) {
        existingSteps = [...targetData.steps];
      } else {
        existingSteps = [{ id: targetNode.id, data: { ...targetData } }];
      }

      // Dragged: extract steps
      if (draggedNode.type === "groupBlock" && draggedData.steps) {
        newSteps = [...draggedData.steps];
      } else {
        newSteps = [{ id: draggedNode.id, data: { ...draggedData } }];
      }

      const mergedSteps = [...existingSteps, ...newSteps];

      // Transfer edges from dragged node to target
      setEdges((eds) =>
        eds
          .filter((e) => e.source !== draggedNode.id && e.target !== draggedNode.id)
          .map((e) => {
            // If target node was standalone and now becomes group, edges stay
            if (e.source === targetNode.id || e.target === targetNode.id) return e;
            return e;
          })
      );

      // Also transfer edges that connected to dragged node
      setEdges((eds) => {
        const updated = eds.map((e) => {
          if (e.source === draggedNode.id) return { ...e, source: dropTarget };
          if (e.target === draggedNode.id) return { ...e, target: dropTarget };
          return e;
        });
        // Remove self-referencing edges
        return updated.filter((e) => e.source !== e.target);
      });

      setNodes((nds) => {
        // Remove dragged node
        const filtered = nds.filter((n) => n.id !== draggedNode.id);
        // Update target to be group
        return filtered.map((n) => {
          if (n.id !== dropTarget) return n;
          return {
            ...n,
            type: "groupBlock",
            data: {
              label: "Grupo",
              type: "groupBlock" as FlowNodeType,
              steps: mergedSteps,
              isDockTarget: false,
            } as FlowNodeData,
          };
        });
      });

      setDropTarget(null);
      toast.success("Nós agrupados!");
    },
    [dropTarget, nodes, setNodes, setEdges]
  );

  const onNodeClick = useCallback((_: React.MouseEvent, node: any) => {
    setSelectedNodeId(node.id);
    setSelectedStepId(null);
    
    // If clicking a group, check if a specific step was clicked
    if (node.type === "groupBlock") {
      const target = (_ as any).target as HTMLElement;
      const stepEl = target?.closest?.("[data-step-id]");
      if (stepEl) {
        setSelectedStepId(stepEl.getAttribute("data-step-id"));
      }
    }
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
    setSelectedStepId(null);
  }, []);

  const updateNodeData = useCallback(
    (nodeId: string, changes: Partial<FlowNodeData>) => {
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id !== nodeId) return n;
          return { ...n, data: { ...n.data, ...changes } };
        })
      );
    },
    [setNodes]
  );

  const updateStepData = useCallback(
    (nodeId: string, stepId: string, changes: Partial<FlowNodeData>) => {
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id !== nodeId) return n;
          const data = n.data as FlowNodeData;
          if (!data.steps) return n;
          const updatedSteps = data.steps.map((s) =>
            s.id === stepId ? { ...s, data: { ...s.data, ...changes } } : s
          );
          return { ...n, data: { ...data, steps: updatedSteps } };
        })
      );
    },
    [setNodes]
  );

  const deleteNode = useCallback(
    (id: string) => {
      setNodes((nds) => nds.filter((n) => n.id !== id));
      setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
      setSelectedNodeId(null);
      setSelectedStepId(null);
      toast.success("Nó removido");
    },
    [setNodes, setEdges]
  );

  const removeStepFromGroup = useCallback(
    (nodeId: string, stepId: string) => {
      setNodes((nds) => {
        const node = nds.find((n) => n.id === nodeId);
        if (!node) return nds;
        const data = node.data as FlowNodeData;
        if (!data.steps) return nds;
        
        const remainingSteps = data.steps.filter((s) => s.id !== stepId);
        const removedStep = data.steps.find((s) => s.id === stepId);
        
        if (!removedStep) return nds;

        // If only 1 step remains, convert group back to standalone
        if (remainingSteps.length === 1) {
          const lastStep = remainingSteps[0];
          const result = nds.map((n) => {
            if (n.id !== nodeId) return n;
            return { ...n, type: "step", data: { ...lastStep.data } as FlowNodeData };
          });
          // Add removed step as standalone
          const newStepNode: FlowNode = {
            id: removedStep.id,
            type: "step",
            position: { x: (node.position?.x || 0) + 320, y: node.position?.y || 0 },
            data: { ...removedStep.data } as FlowNodeData,
          };
          return [...result, newStepNode];
        }

        // If 0 remaining, remove group and add step as standalone
        if (remainingSteps.length === 0) {
          const result = nds.filter((n) => n.id !== nodeId);
          const newStepNode: FlowNode = {
            id: removedStep.id,
            type: "step",
            position: { x: node.position?.x || 0, y: node.position?.y || 0 },
            data: { ...removedStep.data } as FlowNodeData,
          };
          return [...result, newStepNode];
        }

        // Otherwise update the group
        return nds.map((n) => {
          if (n.id !== nodeId) return n;
          return { ...n, data: { ...data, steps: remainingSteps } };
        });
      });

      setSelectedStepId(null);
      toast.success("Step removido do grupo");
    },
    [setNodes]
  );

  return (
    <div className="flex h-full">
      <div className="flex-1 relative" ref={reactFlowWrapper}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          onNodeDrag={onNodeDrag}
          onNodeDragStop={onNodeDragStop}
          nodeTypes={nodeTypes}
          fitView
          panOnDrag
          selectionMode={SelectionMode.Partial}
          multiSelectionKeyCode="Shift"
          className="bg-background"
          deleteKeyCode={["Backspace", "Delete"]}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} className="!bg-background" />
          <Controls className="!bg-card !border-border !rounded-lg !shadow-lg [&>button]:!bg-card [&>button]:!border-border [&>button]:!text-foreground [&>button:hover]:!bg-secondary" />
          <MiniMap
            className="!bg-card !border-border !rounded-lg"
            nodeColor={() => "hsl(var(--primary))"}
            maskColor="hsl(var(--background) / 0.8)"
          />

          <Panel position="top-left" className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="h-8 w-48 text-sm bg-card border-border" />
          </Panel>

          <Panel position="top-right" className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                disabled={isSaving}
                onClick={async () => {
                  if (onSave) {
                    setIsSaving(true);
                    try {
                      await onSave(name, nodes, edges);
                      toast.success("Fluxo salvo!");
                    } catch {
                      toast.error("Erro ao salvar");
                    } finally {
                      setIsSaving(false);
                    }
                  }
                }}
              >
                <Save className="h-3 w-3 mr-1" /> {isSaving ? "Salvando..." : "Salvar"}
              </Button>
            </div>
            <Popover open={addMenuOpen} onOpenChange={setAddMenuOpen}>
              <PopoverTrigger asChild>
                <Button size="sm" className="h-8 text-xs">
                  <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar Nó
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-64 p-2 space-y-3">
                {[
                  { label: "Gatilhos", types: ["trigger"] as FlowNodeType[] },
                  { label: "Mensagens", types: ["sendText", "sendAudio", "sendVideo", "sendImage"] as FlowNodeType[] },
                  { label: "Lógica", types: ["condition", "randomizer", "waitDelay", "waitForReply"] as FlowNodeType[] },
                  { label: "Ações", types: ["action"] as FlowNodeType[] },
                ].map((cat) => (
                  <div key={cat.label}>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-1">{cat.label}</p>
                    <div className="space-y-0.5">
                      {cat.types.map((type) => {
                        const config = nodeTypeConfig[type];
                        const LucideIcon = icons[config.icon as keyof typeof icons];
                        return (
                          <button
                            key={type}
                            className="flex items-center gap-2 w-full p-2 rounded-lg hover:bg-secondary transition-colors text-left"
                            onClick={() => addNode(type)}
                          >
                            <div className="flex items-center justify-center w-7 h-7 rounded-md" style={{ backgroundColor: config.color + "20", color: config.color }}>
                              {LucideIcon && <LucideIcon className="w-3.5 h-3.5" />}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-medium truncate">{config.label}</p>
                              <p className="text-[10px] text-muted-foreground truncate">{config.description}</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </PopoverContent>
            </Popover>
          </Panel>
        </ReactFlow>
      </div>

      {selectedNode && (
        <PropertiesPanel
          node={selectedNode}
          selectedStepId={selectedStepId}
          onSelectStep={setSelectedStepId}
          onUpdate={updateNodeData}
          onUpdateStep={updateStepData}
          onDelete={deleteNode}
          onRemoveStep={removeStepFromGroup}
          onClose={() => { setSelectedNodeId(null); setSelectedStepId(null); }}
        />
      )}
    </div>
  );
}

export function FlowEditor(props: FlowEditorProps) {
  return (
    <ReactFlowProvider>
      <FlowEditorInner {...props} />
    </ReactFlowProvider>
  );
}
