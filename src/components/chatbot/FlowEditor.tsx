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
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Save, Play, Square, ArrowLeft, Plus, icons } from "lucide-react";
import { PropertiesPanel } from "@/components/chatbot/PropertiesPanel";
import StepNode from "@/components/chatbot/StepNode";
import {
  type FlowNodeType,
  type FlowNodeData,
  type FlowNode,
  nodeTypeConfig,
  defaultNodeData,
} from "@/types/chatbot";
import { toast } from "sonner";

const nodeTypes: NodeTypes = {
  step: StepNode,
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
  // Migrate legacy "block" nodes to "step" nodes on load
  const migratedNodes = useMemo(() => {
    const raw = initialNodes || [];
    return raw.map((n: any) => {
      // If it's already a step node, keep it
      if (n.type === "step") return n;
      // Legacy block node: flatten children into separate step nodes handled below
      // For simplicity, just convert the node type
      if (n.type === "block") {
        const data = n.data || {};
        const children = data.children || [];
        if (children.length > 0) {
          // Use the first child's data as the node data (flatten)
          const firstChild = children[0];
          return {
            ...n,
            type: "step",
            data: {
              label: firstChild.label || data.label,
              type: firstChild.type || data.type,
              ...firstChild,
            },
          };
        }
        return { ...n, type: "step" };
      }
      return { ...n, type: "step" };
    });
  }, [initialNodes]);

  const [nodes, setNodes, onNodesChange] = useNodesState(migratedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges || []);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [name, setName] = useState(flowName);
  const [isSaving, setIsSaving] = useState(false);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const reactFlowInstance = useReactFlow();

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId) as FlowNode | null,
    [nodes, selectedNodeId]
  );

  const onConnect = useCallback(
    (params: Connection) =>
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            type: "smoothstep",
            animated: false,
            style: { stroke: "hsl(142 70% 45% / 0.5)", strokeWidth: 2 },
          },
          eds
        )
      ),
    [setEdges]
  );

  const addNode = useCallback(
    (type: FlowNodeType) => {
      const config = nodeTypeConfig[type];
      const center = reactFlowInstance.screenToFlowPosition({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      });
      // Offset randomly so nodes don't stack
      const offset = { x: (Math.random() - 0.5) * 100, y: (Math.random() - 0.5) * 100 };
      const newNode: FlowNode = {
        id: crypto.randomUUID(),
        type: "step",
        position: { x: center.x + offset.x, y: center.y + offset.y },
        data: {
          label: config.label,
          type,
          ...defaultNodeData[type],
        } as FlowNodeData,
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
      if (!type) return;

      const config = nodeTypeConfig[type];
      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      const newNode: FlowNode = {
        id: crypto.randomUUID(),
        type: "step",
        position,
        data: {
          label: config.label,
          type,
          ...defaultNodeData[type],
        } as FlowNodeData,
      };
      setNodes((nds) => nds.concat(newNode));
    },
    [reactFlowInstance, setNodes]
  );

  const onNodeClick = useCallback((_: React.MouseEvent, node: any) => {
    setSelectedNodeId(node.id);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
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

  const deleteNode = useCallback(
    (id: string) => {
      setNodes((nds) => nds.filter((n) => n.id !== id));
      setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
      setSelectedNodeId(null);
      toast.success("Nó removido");
    },
    [setNodes, setEdges]
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
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-8 w-48 text-sm bg-card border-border"
            />
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
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-1">
                      {cat.label}
                    </p>
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
                            <div
                              className="flex items-center justify-center w-7 h-7 rounded-md"
                              style={{ backgroundColor: config.color + "20", color: config.color }}
                            >
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
          onUpdate={updateNodeData}
          onDelete={deleteNode}
          onClose={() => setSelectedNodeId(null)}
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
