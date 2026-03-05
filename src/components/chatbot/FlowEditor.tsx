import { useState, useCallback, useRef, useMemo, useEffect } from "react";
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
import { ArrowLeft, Plus, History, Check, Loader2, icons } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { useFlowHistory, type FlowHistoryEntry } from "@/hooks/useFlowHistory";
import { FlowHistoryPanel } from "@/components/chatbot/FlowHistoryPanel";

const DOCK_THRESHOLD = 80;
const FINALIZER_TYPES: FlowNodeType[] = ["waitForReply", "waitForClick"];
const isFinalizer = (type: string) => FINALIZER_TYPES.includes(type as FlowNodeType);

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
      if (n.type === "step") return n;
      if (n.type === "groupBlock") return { ...n, dragHandle: ".group-drag-handle" };
      // Migrate old "group" type to "groupBlock"
      if (n.type === "group") return { ...n, type: "groupBlock", dragHandle: ".group-drag-handle" };
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
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const historyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInitialMount = useRef(true);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [deleteGroupId, setDeleteGroupId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; flowPos: { x: number; y: number } } | null>(null);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const reactFlowInstance = useReactFlow();
  const { saveSnapshot } = useFlowHistory(flowId);

  // Autosave with debounce
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    if (!onSave) return;

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    setSaveStatus("saving");

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await onSave(name, nodes, edges);
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2000);
      } catch {
        toast.error("Erro ao salvar");
        setSaveStatus("idle");
      }
    }, 1500);

    // Save history snapshot every 30s max
    if (!historyTimeoutRef.current) {
      historyTimeoutRef.current = setTimeout(() => {
        saveSnapshot.mutate({ name, nodes, edges });
        historyTimeoutRef.current = null;
      }, 30000);
    }

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [nodes, edges, name]);

  const handleRestore = useCallback((entry: FlowHistoryEntry) => {
    setNodes(entry.nodes as any[]);
    setEdges(entry.edges as any[]);
    setName(entry.name);
    toast.success("Versão restaurada!");
  }, [setNodes, setEdges]);

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId) as FlowNode | null,
    [nodes, selectedNodeId]
  );

  const onConnect = useCallback(
    (params: Connection) =>
      setEdges((eds) =>
        addEdge({
          ...params,
          type: "default",
          animated: true,
          style: {
            stroke: params.sourceHandle === "output-1"
              ? "hsl(25 95% 53% / 0.6)"
              : "hsl(142 70% 45% / 0.45)",
            strokeWidth: 2,
            strokeDasharray: "6 4",
          },
        }, eds)
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

  const addNodeAtPosition = useCallback(
    (type: FlowNodeType, flowPos: { x: number; y: number }) => {
      if (type === "groupBlock") return;
      const config = nodeTypeConfig[type];
      const newNode: FlowNode = {
        id: crypto.randomUUID(),
        type: "step",
        position: flowPos,
        data: { label: config.label, type, ...defaultNodeData[type] } as FlowNodeData,
      };
      setNodes((nds) => nds.concat(newNode));
      setContextMenu(null);
      toast.success(`${config.label} adicionado`);
    },
    [setNodes]
  );

  const onPaneContextMenu = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      const flowPos = reactFlowInstance.screenToFlowPosition({ x: event.clientX, y: event.clientY });
      setContextMenu({ x: event.clientX, y: event.clientY, flowPos });
    },
    [reactFlowInstance]
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

  const dropTargetRef = useRef<string | null>(null);

  // ─── Proximity docking logic ───
  const onNodeDrag = useCallback(
    (_: React.MouseEvent, draggedNode: Node) => {
      const draggedData = draggedNode.data as FlowNodeData;
      if (draggedData.type === "trigger") {
        if (dropTargetRef.current) {
          setNodes((nds) =>
            nds.map((n) =>
              n.id === dropTargetRef.current ? { ...n, data: { ...n.data, isDockTarget: false } } : n
            )
          );
          dropTargetRef.current = null;
          setDropTarget(null);
        }
        return;
      }

      // Use getNodes() to avoid stale closure
      const currentNodes = reactFlowInstance.getNodes();
      let closestId: string | null = null;
      let closestDist = Infinity;

      for (const node of currentNodes) {
        if (node.id === draggedNode.id) continue;
        const nodeData = node.data as FlowNodeData;
        if (nodeData.type === "trigger") continue;

        const dx = (node.position?.x || 0) - (draggedNode.position?.x || 0);
        const dy = (node.position?.y || 0) - (draggedNode.position?.y || 0);
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < DOCK_THRESHOLD && dist < closestDist) {
          closestDist = dist;
          closestId = node.id;
        }
      }

      const prevTarget = dropTargetRef.current;
      if (closestId !== prevTarget) {
        if (prevTarget) {
          setNodes((nds) =>
            nds.map((n) =>
              n.id === prevTarget ? { ...n, data: { ...n.data, isDockTarget: false } } : n
            )
          );
        }
        if (closestId) {
          setNodes((nds) =>
            nds.map((n) =>
              n.id === closestId ? { ...n, data: { ...n.data, isDockTarget: true } } : n
            )
          );
        }
        dropTargetRef.current = closestId;
        setDropTarget(closestId);
      }
    },
    [reactFlowInstance, setNodes]
  );

  const onNodeDragStop = useCallback(
    (_: React.MouseEvent, draggedNode: Node) => {
      // Clear all dock indicators
      setNodes((nds) =>
        nds.map((n) => (n.data as any).isDockTarget ? { ...n, data: { ...n.data, isDockTarget: false } } : n)
      );

      const currentDropTarget = dropTargetRef.current;
      dropTargetRef.current = null;
      setDropTarget(null);

      if (!currentDropTarget) return;

      const draggedData = draggedNode.data as FlowNodeData;
      if (draggedData.type === "trigger") return;

      // Use fresh nodes from ReactFlow instance
      const currentNodes = reactFlowInstance.getNodes();
      const targetNode = currentNodes.find((n) => n.id === currentDropTarget);
      if (!targetNode) return;

      const targetData = targetNode.data as FlowNodeData;

      // Build the steps for the merged group
      let existingSteps: FlowStepData[] = [];
      let newSteps: FlowStepData[] = [];

      if (targetNode.type === "groupBlock" && targetData.steps) {
        existingSteps = [...targetData.steps];
      } else {
        existingSteps = [{ id: targetNode.id, data: { ...targetData } }];
      }

      if (draggedNode.type === "groupBlock" && draggedData.steps) {
        newSteps = [...draggedData.steps];
      } else {
        newSteps = [{ id: draggedNode.id, data: { ...draggedData } }];
      }

      // Validate finalizer conflicts
      const existingHasFinalizer = existingSteps.some((s) => isFinalizer(s.data.type));
      const newHasFinalizer = newSteps.some((s) => isFinalizer(s.data.type));
      if (existingHasFinalizer && newHasFinalizer) {
        toast.error("Só é permitido um step de aguardar por grupo");
        // Clear dock indicators
        setNodes((nds) => nds.map((n) => ({ ...n, data: { ...n.data, isDockTarget: false } })));
        return;
      }

      // Merge and ensure finalizer is last
      let mergedSteps = [...existingSteps, ...newSteps];
      const finalizerIndex = mergedSteps.findIndex((s) => isFinalizer(s.data.type));
      if (finalizerIndex !== -1 && finalizerIndex !== mergedSteps.length - 1) {
        const [fin] = mergedSteps.splice(finalizerIndex, 1);
        mergedSteps.push(fin);
      }

      // Transfer edges from dragged node to target
      setEdges((eds) => {
        const updated = eds.map((e) => {
          if (e.source === draggedNode.id) return { ...e, source: currentDropTarget };
          if (e.target === draggedNode.id) return { ...e, target: currentDropTarget };
          return e;
        });
        return updated.filter((e) => e.source !== e.target);
      });

      setNodes((nds) => {
        const filtered = nds.filter((n) => n.id !== draggedNode.id);
        return filtered.map((n) => {
          if (n.id !== currentDropTarget) return n;
          return {
            ...n,
            type: "groupBlock",
            dragHandle: ".group-drag-handle",
            data: {
              label: "Grupo",
              type: "groupBlock" as FlowNodeType,
              steps: mergedSteps,
              isDockTarget: false,
            } as FlowNodeData,
          };
        });
      });

      toast.success("Nós agrupados!");
    },
    [reactFlowInstance, setNodes, setEdges]
  );

  const onNodeClick = useCallback((_: React.MouseEvent, node: any) => {
    // For groups: only open properties if a step was clicked
    if (node.type === "groupBlock") {
      const target = (_ as any).target as HTMLElement;
      const stepEl = target?.closest?.("[data-step-id]");
      if (stepEl) {
        setSelectedNodeId(node.id);
        setSelectedStepId(stepEl.getAttribute("data-step-id"));
      } else {
        // Clicked on group container/header — don't select
        setSelectedNodeId(null);
        setSelectedStepId(null);
      }
      return;
    }
    setSelectedNodeId(node.id);
    setSelectedStepId(null);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
    setSelectedStepId(null);
    setContextMenu(null);
  }, []);

  const onEdgeContextMenu = useCallback(
    (event: React.MouseEvent, edge: any) => {
      event.preventDefault();
      setEdges((eds) => eds.filter((e) => e.id !== edge.id));
      toast.success("Conexão removida");
    },
    [setEdges]
  );

  const reorderStepByIndex = useCallback(
    (nodeId: string, fromIndex: number, toIndex: number) => {
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id !== nodeId) return n;
          const data = n.data as FlowNodeData;
          if (!data.steps) return n;
          const newSteps = [...data.steps];
          const [moved] = newSteps.splice(fromIndex, 1);
          newSteps.splice(toIndex, 0, moved);
          return { ...n, data: { ...data, steps: newSteps } };
        })
      );
    },
    [setNodes]
  );

  // Listen for drag-and-drop reorder events from GroupNode
  useEffect(() => {
    const handler = (e: Event) => {
      const { nodeId, fromIndex, toIndex } = (e as CustomEvent).detail;
      
      // Block reorder if it would move a finalizer away from last position
      setNodes((nds) => {
        const node = nds.find((n) => n.id === nodeId);
        if (!node) return nds;
        const data = node.data as FlowNodeData;
        if (!data.steps) return nds;
        
        const steps = [...data.steps];
        const [moved] = steps.splice(fromIndex, 1);
        steps.splice(toIndex, 0, moved);
        
        // Check if finalizer ended up not at the end
        const finIdx = steps.findIndex((s) => isFinalizer(s.data.type));
        if (finIdx !== -1 && finIdx !== steps.length - 1) {
          toast.error("O step de aguardar deve ser o último do grupo");
          return nds;
        }
        
        return nds.map((n) => n.id === nodeId ? { ...n, data: { ...data, steps } } : n);
      });
    };
    document.addEventListener("group-reorder-step", handler);
    return () => document.removeEventListener("group-reorder-step", handler);
  }, [setNodes]);

  // Listen for add-step events from GroupNode
  useEffect(() => {
    const handler = (e: Event) => {
      const { nodeId, stepType } = (e as CustomEvent).detail as { nodeId: string; stepType: FlowNodeType };
      const config = nodeTypeConfig[stepType];
      
      setNodes((nds) => {
        const node = nds.find((n) => n.id === nodeId);
        if (!node) return nds;
        const data = node.data as FlowNodeData;
        const steps = data.steps || [];
        
        // Block if group already has a finalizer and we're adding another
        if (isFinalizer(stepType) && steps.some((s) => isFinalizer(s.data.type))) {
          toast.error("Só é permitido um step de aguardar por grupo");
          return nds;
        }
        
        // Block adding any step after a finalizer (finalizer must be last)
        if (!isFinalizer(stepType) && steps.length > 0 && isFinalizer(steps[steps.length - 1].data.type)) {
          toast.error("Não é possível adicionar ações após o step de aguardar");
          return nds;
        }
        
        const newStep: FlowStepData = {
          id: crypto.randomUUID(),
          data: { label: config.label, type: stepType, ...defaultNodeData[stepType] } as FlowNodeData,
        };
        
        return nds.map((n) => n.id === nodeId ? { ...n, data: { ...data, steps: [...steps, newStep] } } : n);
      });
      toast.success(`${config.label} adicionado ao grupo`);
    };
    document.addEventListener("group-add-step", handler);
    return () => document.removeEventListener("group-add-step", handler);
  }, [setNodes]);

  // Listen for extract-step events (drag step out of group)
  useEffect(() => {
    const handler = (e: Event) => {
      const { nodeId, stepId, clientX, clientY } = (e as CustomEvent).detail as {
        nodeId: string; stepId: string; clientX: number; clientY: number;
      };
      const position = reactFlowInstance.screenToFlowPosition({ x: clientX, y: clientY });
      
      setNodes((nds) => {
        const node = nds.find((n) => n.id === nodeId);
        if (!node) return nds;
        const data = node.data as FlowNodeData;
        if (!data.steps) return nds;

        const removedStep = data.steps.find((s) => s.id === stepId);
        if (!removedStep) return nds;
        const remainingSteps = data.steps.filter((s) => s.id !== stepId);

        const newNodeId = `step-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const newStepNode: FlowNode = {
          id: newNodeId,
          type: "step",
          position,
          data: { ...removedStep.data } as FlowNodeData,
        };

        if (remainingSteps.length === 0) {
          // Remove empty group, transfer its edges to the new node
          const updatedNodes = nds.filter((n) => n.id !== nodeId);
          setEdges((eds) =>
            eds.map((e) => {
              if (e.source === nodeId) return { ...e, source: newNodeId };
              if (e.target === nodeId) return { ...e, target: newNodeId };
              return e;
            })
          );
          return [...updatedNodes, newStepNode];
        }
        // Keep group with remaining steps — deep copy to force re-render
        return [
          ...nds.map((n) => {
            if (n.id !== nodeId) return n;
            return { ...n, data: { ...data, steps: [...remainingSteps] } };
          }),
          newStepNode,
        ];
      });
      toast.success("Step extraído do grupo");
    };
    document.addEventListener("group-extract-step", handler);
    return () => document.removeEventListener("group-extract-step", handler);
  }, [setNodes, setEdges, reactFlowInstance]);

  // Listen for receive-step events (drop step into another group)
  useEffect(() => {
    const handler = (e: Event) => {
      const { targetNodeId, sourceNodeId, stepId } = (e as CustomEvent).detail as {
        targetNodeId: string; sourceNodeId: string; stepId: string;
      };

      setNodes((nds) => {
        // Find the step in source
        const sourceNode = nds.find((n) => n.id === sourceNodeId);
        if (!sourceNode) return nds;
        const sourceData = sourceNode.data as FlowNodeData;
        if (!sourceData.steps) return nds;

        const movedStep = sourceData.steps.find((s) => s.id === stepId);
        if (!movedStep) return nds;
        
        // Validate: target already has finalizer and moved step is also finalizer
        const targetNode = nds.find((n) => n.id === targetNodeId);
        if (!targetNode) return nds;
        const targetData = targetNode.data as FlowNodeData;
        const targetSteps = targetData.steps || [];
        
        const targetHasFinalizer = targetSteps.some((s) => isFinalizer(s.data.type));
        const movedIsFinalizer = isFinalizer(movedStep.data.type);
        
        if (targetHasFinalizer && movedIsFinalizer) {
          toast.error("Só é permitido um step de aguardar por grupo");
          return nds;
        }
        
        // Block if target has finalizer and we're adding a non-finalizer (it would go after)
        if (targetHasFinalizer && !movedIsFinalizer) {
          // Insert before the finalizer
          const finIdx = targetSteps.findIndex((s) => isFinalizer(s.data.type));
          const newTargetSteps = [...targetSteps];
          newTargetSteps.splice(finIdx, 0, movedStep);
          
          const remainingSteps = sourceData.steps.filter((s) => s.id !== stepId);
          let result = nds;
          
          if (remainingSteps.length === 0) {
            result = result.filter((n) => n.id !== sourceNodeId);
          } else if (remainingSteps.length === 1) {
            const lastStep = remainingSteps[0];
            result = result.map((n) => n.id === sourceNodeId ? { ...n, type: "step", data: { ...lastStep.data } as FlowNodeData } : n);
          } else {
            result = result.map((n) => n.id === sourceNodeId ? { ...n, data: { ...sourceData, steps: remainingSteps } } : n);
          }
          
          result = result.map((n) => n.id === targetNodeId ? { ...n, data: { ...targetData, steps: newTargetSteps } } : n);
          toast.success("Step movido para o grupo");
          return result;
        }

        const remainingSteps = sourceData.steps.filter((s) => s.id !== stepId);

        let result = nds;

        // Update source group
        if (remainingSteps.length === 0) {
          result = result.filter((n) => n.id !== sourceNodeId);
        } else if (remainingSteps.length === 1) {
          const lastStep = remainingSteps[0];
          result = result.map((n) => n.id === sourceNodeId ? { ...n, type: "step", data: { ...lastStep.data } as FlowNodeData } : n);
        } else {
          result = result.map((n) => n.id === sourceNodeId ? { ...n, data: { ...sourceData, steps: remainingSteps } } : n);
        }

        // Add step to target group (finalizer goes to end automatically)
        result = result.map((n) => {
          if (n.id !== targetNodeId) return n;
          const tData = n.data as FlowNodeData;
          const tSteps = tData.steps || [];
          return { ...n, data: { ...tData, steps: [...tSteps, movedStep] } };
        });

        toast.success("Step movido para o grupo");
        return result;
      });
    };
    document.addEventListener("group-receive-step", handler);
    return () => document.removeEventListener("group-receive-step", handler);
  }, [setNodes]);

  // Listen for group-delete events from GroupNode
  useEffect(() => {
    const handler = (e: Event) => {
      const { nodeId } = (e as CustomEvent).detail;
      setDeleteGroupId(nodeId);
    };
    document.addEventListener("group-delete", handler);
    return () => document.removeEventListener("group-delete", handler);
  }, []);

  // Listen for node-duplicate events (standalone nodes and groups)
  useEffect(() => {
    const handler = (e: Event) => {
      const { nodeId } = (e as CustomEvent).detail;
      setNodes((nds) => {
        const original = nds.find((n) => n.id === nodeId);
        if (!original) return nds;
        const newId = crypto.randomUUID();
        const clonedData = JSON.parse(JSON.stringify(original.data));
        // For groups, assign new IDs to all steps
        if (clonedData.steps) {
          clonedData.steps = clonedData.steps.map((s: any) => ({ ...s, id: crypto.randomUUID() }));
        }
        const cloned: FlowNode = {
          ...original,
          id: newId,
          position: { x: (original.position?.x || 0) + 40, y: (original.position?.y || 0) + 40 },
          data: clonedData,
          selected: false,
        };
        return [...nds, cloned];
      });
      toast.success("Nó duplicado!");
    };
    document.addEventListener("node-duplicate", handler);
    return () => document.removeEventListener("node-duplicate", handler);
  }, [setNodes]);

  // Listen for group-duplicate-step events (duplicate a step within a group)
  useEffect(() => {
    const handler = (e: Event) => {
      const { nodeId, stepId } = (e as CustomEvent).detail;
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id !== nodeId) return n;
          const data = n.data as FlowNodeData;
          if (!data.steps) return n;
          const stepIndex = data.steps.findIndex((s) => s.id === stepId);
          if (stepIndex === -1) return n;
          const original = data.steps[stepIndex];
          // Don't duplicate finalizer if one already exists
          if (isFinalizer(original.data.type)) {
            toast.error("Só é permitido um step de aguardar por grupo");
            return n;
          }
          const cloned: FlowStepData = {
            id: crypto.randomUUID(),
            data: JSON.parse(JSON.stringify(original.data)),
          };
          const newSteps = [...data.steps];
          newSteps.splice(stepIndex + 1, 0, cloned);
          return { ...n, data: { ...data, steps: newSteps } };
        })
      );
      toast.success("Step duplicado!");
    };
    document.addEventListener("group-duplicate-step", handler);
    return () => document.removeEventListener("group-duplicate-step", handler);
  }, [setNodes]);

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

  // Listen for node-delete events from StepNode toolbar
  useEffect(() => {
    const handler = (e: Event) => {
      const { nodeId } = (e as CustomEvent).detail;
      deleteNode(nodeId);
    };
    document.addEventListener("node-delete", handler);
    return () => document.removeEventListener("node-delete", handler);
  }, [deleteNode]);

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

        // Otherwise update the group and create standalone node for removed step
        const newStepNode: FlowNode = {
          id: removedStep.id,
          type: "step",
          position: { x: (node.position?.x || 0) + 320, y: (node.position?.y || 0) + (data.steps.indexOf(removedStep) * 80) },
          data: { ...removedStep.data } as FlowNodeData,
        };
        const updated = nds.map((n) => {
          if (n.id !== nodeId) return n;
          return { ...n, data: { ...data, steps: remainingSteps } };
        });
        return [...updated, newStepNode];
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
          onEdgeContextMenu={onEdgeContextMenu}
          onPaneContextMenu={onPaneContextMenu}
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

          <Panel position="top-right" className="flex items-center gap-2">
              {saveStatus === "saving" && (
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> Salvando...
                </span>
              )}
              {saveStatus === "saved" && (
                <span className="flex items-center gap-1 text-[11px] text-primary">
                  <Check className="h-3 w-3" /> Salvo
                </span>
              )}
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setHistoryOpen(true)}>
                <History className="h-3 w-3 mr-1" /> Histórico
              </Button>
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
                    { label: "Lógica", types: ["condition", "randomizer", "waitDelay", "waitForReply", "waitForClick"] as FlowNodeType[] },
                    { label: "Ações", types: ["action"] as FlowNodeType[] },
                    { label: "Inteligência Artificial", types: ["aiAgent"] as FlowNodeType[] },
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

      <FlowHistoryPanel
        flowId={flowId}
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        onRestore={handleRestore}
      />

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

      <AlertDialog open={!!deleteGroupId} onOpenChange={(open) => { if (!open) setDeleteGroupId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar grupo</AlertDialogTitle>
            <AlertDialogDescription>
              Você tem certeza que deseja apagar o grupo? Todos os steps dentro dele serão removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteGroupId) {
                  deleteNode(deleteGroupId);
                }
                setDeleteGroupId(null);
              }}
            >
              Apagar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Right-click context menu */}
      {contextMenu && (<>
        <div className="fixed inset-0 z-[99]" onClick={() => setContextMenu(null)} onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }} />
        <div
          className="fixed z-[100] w-64 max-h-[70vh] overflow-y-auto bg-card border border-border rounded-xl shadow-2xl p-2 space-y-3 animate-in fade-in-0 zoom-in-95"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          {[
            { label: "Gatilhos", types: ["trigger"] as FlowNodeType[] },
            { label: "Mensagens", types: ["sendText", "sendAudio", "sendVideo", "sendImage"] as FlowNodeType[] },
            { label: "Lógica", types: ["condition", "randomizer", "waitDelay", "waitForReply", "waitForClick"] as FlowNodeType[] },
            { label: "Ações", types: ["action"] as FlowNodeType[] },
            { label: "Inteligência Artificial", types: ["aiAgent"] as FlowNodeType[] },
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
                      onClick={() => addNodeAtPosition(type, contextMenu.flowPos)}
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
        </div>
      </>)}
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
