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
import { Save, Play, Square, ArrowLeft } from "lucide-react";
import { NodePalette } from "@/components/chatbot/NodePalette";
import { PropertiesPanel } from "@/components/chatbot/PropertiesPanel";
import BlockNode from "@/components/chatbot/BlockNode";
import { type FlowNodeType, type FlowNodeData, type FlowNode, nodeTypeConfig } from "@/types/chatbot";
import { toast } from "sonner";

const nodeTypes: NodeTypes = {
  block: BlockNode,
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

let childIdCounter = 1;

function createChildData(type: FlowNodeType): FlowNodeData {
  const config = nodeTypeConfig[type];
  return {
    label: config.label,
    type,
    childId: `child_${childIdCounter++}`,
    ...defaultNodeData[type],
  } as FlowNodeData;
}

interface FlowEditorProps {
  flowName: string;
  onBack: () => void;
}

function FlowEditorInner({ flowName, onBack }: FlowEditorProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedChildIndex, setSelectedChildIndex] = useState<number | null>(null);
  const [name, setName] = useState(flowName);
  const [isActive, setIsActive] = useState(false);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const reactFlowInstance = useReactFlow();
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

  // Find block node ID under cursor using DOM only (no stale closure)
  const findBlockIdUnderCursor = (clientX: number, clientY: number): string | null => {
    const flowNodes = document.querySelectorAll(".react-flow__node");
    for (const el of flowNodes) {
      const rect = el.getBoundingClientRect();
      if (
        clientX >= rect.left &&
        clientX <= rect.right &&
        clientY >= rect.top &&
        clientY <= rect.bottom
      ) {
        return el.getAttribute("data-id");
      }
    }
    return null;
  };

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const type = event.dataTransfer.getData("application/reactflow") as FlowNodeType;
      if (!type) return;

      const targetNodeId = findBlockIdUnderCursor(event.clientX, event.clientY);

      if (targetNodeId) {
        // Add as child to existing block — use setNodes callback to get fresh state
        const newChild = createChildData(type);
        let found = false;
        setNodes((nds) =>
          nds.map((n) => {
            if (n.id !== targetNodeId || n.type !== "block") return n;
            found = true;
            const data = n.data as FlowNodeData;
            const children = [...(data.children || []), newChild];
            return { ...n, data: { ...data, children } };
          })
        );
        // Toast after state update
        setTimeout(() => {
          toast.success(`${nodeTypeConfig[type].label} adicionado ao bloco`);
        }, 0);
      } else {
        const position = reactFlowInstance.screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        });
        const child = createChildData(type);
        const config = nodeTypeConfig[type];
        const newNode: FlowNode = {
          id: `node_${idCounter.current++}`,
          type: "block",
          position,
          data: {
            label: config.label,
            type,
            children: [child],
          } as FlowNodeData,
        };
        setNodes((nds) => nds.concat(newNode));
      }
    },
    [reactFlowInstance, setNodes]
  );

  const onNodeClick = useCallback((_: React.MouseEvent, node: any) => {
    setSelectedNodeId(node.id);
    const target = _.target as HTMLElement;
    const childEl = target.closest("[data-child-index]");
    if (childEl) {
      setSelectedChildIndex(parseInt(childEl.getAttribute("data-child-index") || "0"));
    } else {
      setSelectedChildIndex(0);
    }

    // Handle remove child button
    const removeBtn = target.closest("[data-remove-child]");
    if (removeBtn) {
      const removeIndex = parseInt(removeBtn.getAttribute("data-remove-child") || "-1");
      if (removeIndex >= 0) {
        setNodes((nds) =>
          nds.map((n) => {
            if (n.id !== node.id) return n;
            const data = n.data as FlowNodeData;
            const children = (data.children || []).filter((_, i) => i !== removeIndex);
            if (children.length === 0) return null as any;
            return { ...n, data: { ...data, children } };
          }).filter(Boolean)
        );
        setSelectedNodeId(null);
        setSelectedChildIndex(null);
        toast.success("Item removido");
      }
    }
  }, [setNodes]);

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
    setSelectedChildIndex(null);
  }, []);

  const updateChildData = useCallback(
    (nodeId: string, childIndex: number, changes: Partial<FlowNodeData>) => {
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id !== nodeId) return n;
          const data = n.data as FlowNodeData;
          const children = [...(data.children || [])];
          if (children[childIndex]) {
            children[childIndex] = { ...children[childIndex], ...changes };
          }
          return { ...n, data: { ...data, children } };
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
      setSelectedChildIndex(null);
      toast.success("Bloco removido");
    },
    [setNodes, setEdges]
  );

  return (
    <div className="flex h-full">
      <NodePalette onDragStart={() => {}} />

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
          panOnDrag={[1, 2]}
          selectionOnDrag
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
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => toast.success("Fluxo salvo!")}>
              <Save className="h-3 w-3 mr-1" /> Salvar
            </Button>
            <Button size="sm" className="h-8 text-xs" variant={isActive ? "destructive" : "default"} onClick={() => { setIsActive(!isActive); toast.success(isActive ? "Desativado" : "Ativado!"); }}>
              {isActive ? <><Square className="h-3 w-3 mr-1" /> Desativar</> : <><Play className="h-3 w-3 mr-1" /> Ativar</>}
            </Button>
          </Panel>
        </ReactFlow>
      </div>

      {selectedNode && selectedChildIndex !== null && (
        <PropertiesPanel
          node={selectedNode}
          childIndex={selectedChildIndex}
          onUpdateChild={updateChildData}
          onDelete={deleteNode}
          onClose={() => { setSelectedNodeId(null); setSelectedChildIndex(null); }}
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
