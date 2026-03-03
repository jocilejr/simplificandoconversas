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
  type Connection,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Save, Play, Square, ArrowLeft, Group } from "lucide-react";
import { NodePalette } from "@/components/chatbot/NodePalette";
import { PropertiesPanel } from "@/components/chatbot/PropertiesPanel";
import CustomNode from "@/components/chatbot/CustomNode";
import GroupNode from "@/components/chatbot/GroupNode";
import { type FlowNodeType, type FlowNodeData, type FlowNode, nodeTypeConfig } from "@/types/chatbot";
import { toast } from "sonner";

const nodeTypes: NodeTypes = {
  custom: CustomNode,
  group: GroupNode,
};

const defaultNodeData: Record<FlowNodeType, Partial<FlowNodeData>> = {
  trigger: { triggerType: "keyword", triggerKeyword: "" },
  sendText: { textContent: "" },
  sendAudio: { audioUrl: "", simulateRecording: false },
  sendVideo: { mediaUrl: "", caption: "" },
  sendImage: { mediaUrl: "", caption: "" },
  condition: { conditionField: "mensagem", conditionOperator: "contains", conditionValue: "" },
  randomizer: { paths: 2 },
  waitDelay: { delaySeconds: 3, simulateTyping: true },
  waitForReply: { replyVariable: "resposta", replyTimeout: 0, replyFallback: "" },
  action: { actionType: "add_tag", actionValue: "" },
};

interface FlowEditorProps {
  flowName: string;
  onBack: () => void;
}

function FlowEditorInner({ flowName, onBack }: FlowEditorProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [name, setName] = useState(flowName);
  const [isActive, setIsActive] = useState(false);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);
  const idCounter = useRef(1);

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId) as FlowNode | null,
    [nodes, selectedNodeId]
  );

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge({ ...params, animated: true, style: { stroke: "hsl(var(--primary))", strokeWidth: 2 } }, eds)),
    [setEdges]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const type = event.dataTransfer.getData("application/reactflow") as FlowNodeType;
      if (!type || !reactFlowInstance) return;

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const config = nodeTypeConfig[type];
      const newNode: FlowNode = {
        id: `node_${idCounter.current++}`,
        type: "custom",
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
    (id: string, data: Partial<FlowNodeData>) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === id ? { ...n, data: { ...n.data, ...data } } : n
        )
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

  const handleGroupSelected = useCallback(() => {
    const selectedNodes = nodes.filter((n) => n.selected && n.type !== "group");
    if (selectedNodes.length < 2) {
      toast.error("Selecione pelo menos 2 nós para agrupar");
      return;
    }

    // Calculate bounding box
    const padding = 20;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    selectedNodes.forEach((n) => {
      minX = Math.min(minX, n.position.x);
      minY = Math.min(minY, n.position.y);
      maxX = Math.max(maxX, n.position.x + 280);
      maxY = Math.max(maxY, n.position.y + 80);
    });

    const groupId = `group_${idCounter.current++}`;
    const groupNode = {
      id: groupId,
      type: "group" as const,
      position: { x: minX - padding, y: minY - padding - 24 },
      style: {
        width: maxX - minX + padding * 2,
        height: maxY - minY + padding * 2 + 24,
      },
      data: { label: "Grupo" },
    };

    // Set parentId and adjust positions to be relative to group
    setNodes((nds) => {
      const updatedNodes = nds.map((n) => {
        if (selectedNodes.find((s) => s.id === n.id)) {
          return {
            ...n,
            parentId: groupId,
            position: {
              x: n.position.x - (minX - padding),
              y: n.position.y - (minY - padding - 24),
            },
            extent: "parent" as const,
          };
        }
        return n;
      });
      return [groupNode as any, ...updatedNodes];
    });

    toast.success(`${selectedNodes.length} nós agrupados`);
  }, [nodes, setNodes]);

  const handleUngroupSelected = useCallback(() => {
    const selectedGroups = nodes.filter((n) => n.selected && n.type === "group");
    if (selectedGroups.length === 0) {
      toast.error("Selecione um grupo para desagrupar");
      return;
    }

    selectedGroups.forEach((group) => {
      setNodes((nds) => {
        const updated = nds
          .filter((n) => n.id !== group.id)
          .map((n) => {
            if (n.parentId === group.id) {
              return {
                ...n,
                parentId: undefined,
                extent: undefined,
                position: {
                  x: n.position.x + group.position.x,
                  y: n.position.y + group.position.y,
                },
              };
            }
            return n;
          });
        return updated;
      });
    });

    toast.success("Grupo desfeito");
  }, [nodes, setNodes]);

  const handleSave = () => {
    toast.success("Fluxo salvo com sucesso!");
  };

  const handleToggleActive = () => {
    setIsActive(!isActive);
    toast.success(isActive ? "Fluxo desativado" : "Fluxo ativado!");
  };

  return (
    <div className="flex h-full">
      {/* Left palette */}
      <NodePalette onDragStart={() => {}} />

      {/* Canvas */}
      <div className="flex-1 relative" ref={reactFlowWrapper}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onInit={setReactFlowInstance}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
          fitView
          panOnDrag={[1, 2]}
          selectionOnDrag
          selectionMode={SelectionMode.Partial}
          multiSelectionKeyCode="Shift"
          className="bg-background"
          deleteKeyCode={["Backspace", "Delete"]}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} className="!bg-background" />
          <Controls
            className="!bg-card !border-border !rounded-lg !shadow-lg [&>button]:!bg-card [&>button]:!border-border [&>button]:!text-foreground [&>button:hover]:!bg-secondary"
          />
          <MiniMap
            className="!bg-card !border-border !rounded-lg"
            nodeColor={(node) => {
              const d = node.data as FlowNodeData;
              return nodeTypeConfig[d.type]?.color || "#666";
            }}
            maskColor="hsl(var(--background) / 0.8)"
          />

          {/* Top toolbar */}
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

          <Panel position="top-right" className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleGroupSelected} title="Agrupar nós selecionados (selecione com Shift+Drag)">
              <Group className="h-3 w-3 mr-1" /> Agrupar
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleUngroupSelected} title="Desagrupar">
              Desagrupar
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleSave}>
              <Save className="h-3 w-3 mr-1" /> Salvar
            </Button>
            <Button
              size="sm"
              className="h-8 text-xs"
              variant={isActive ? "destructive" : "default"}
              onClick={handleToggleActive}
            >
              {isActive ? (
                <><Square className="h-3 w-3 mr-1" /> Desativar</>
              ) : (
                <><Play className="h-3 w-3 mr-1" /> Ativar</>
              )}
            </Button>
          </Panel>
        </ReactFlow>
      </div>

      {/* Right properties */}
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
