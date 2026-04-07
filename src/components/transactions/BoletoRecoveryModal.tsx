import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  FileText,
  Image as ImageIcon,
  Type,
  GripVertical,
  Plus,
  Trash2,
  Save,
  Settings2,
  Star,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/hooks/useWorkspace";

interface BoletoRecoveryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface RecoveryBlock {
  id: string;
  type: "text" | "pdf" | "image";
  content: string;
  order: number;
}

interface RecoveryTemplate {
  id: string;
  name: string;
  blocks: RecoveryBlock[];
  is_default: boolean;
}

const VARIABLE_PLACEHOLDERS: Record<string, { label: string; description: string }> = {
  "{saudação}": { label: "Saudação", description: "Bom dia/Boa tarde/Boa noite" },
  "{nome}": { label: "Nome", description: "Nome completo do cliente" },
  "{primeiro_nome}": { label: "Primeiro Nome", description: "Apenas o primeiro nome" },
  "{valor}": { label: "Valor", description: "Valor do boleto formatado" },
};

export function BoletoRecoveryModal({ open, onOpenChange }: BoletoRecoveryModalProps) {
  const [templates, setTemplates] = useState<RecoveryTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<RecoveryTemplate | null>(null);
  const [blocks, setBlocks] = useState<RecoveryBlock[]>([]);
  const [templateName, setTemplateName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [draggedBlockId, setDraggedBlockId] = useState<string | null>(null);
  const { currentWorkspace } = useWorkspace();

  useEffect(() => {
    if (open && currentWorkspace) {
      fetchTemplates();
    }
  }, [open, currentWorkspace]);

  const fetchTemplates = async () => {
    if (!currentWorkspace) return;
    try {
      const { data, error } = await supabase
        .from("boleto_recovery_templates" as any)
        .select("*")
        .eq("workspace_id", currentWorkspace.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const parsedTemplates = (data || []).map((t: any) => ({
        id: t.id,
        name: t.name,
        is_default: t.is_default,
        blocks: Array.isArray(t.blocks) ? (t.blocks as RecoveryBlock[]) : [],
      }));

      setTemplates(parsedTemplates);

      const defaultTemplate = parsedTemplates.find((t) => t.is_default);
      if (defaultTemplate) {
        setSelectedTemplate(defaultTemplate);
        setBlocks(defaultTemplate.blocks);
        setTemplateName(defaultTemplate.name);
      } else if (parsedTemplates.length > 0) {
        setSelectedTemplate(parsedTemplates[0]);
        setBlocks(parsedTemplates[0].blocks);
        setTemplateName(parsedTemplates[0].name);
      }
    } catch (error) {
      console.error("Error fetching templates:", error);
    }
  };

  const addBlock = (type: "text" | "pdf" | "image") => {
    const newBlock: RecoveryBlock = {
      id: crypto.randomUUID(),
      type,
      content:
        type === "text"
          ? "Olá {nome}! Seu boleto no valor de {valor} está disponível."
          : type === "pdf"
          ? "pdf"
          : "image",
      order: blocks.length,
    };
    setBlocks([...blocks, newBlock]);
  };

  const updateBlockContent = (blockId: string, content: string) => {
    setBlocks(blocks.map((b) => (b.id === blockId ? { ...b, content } : b)));
  };

  const removeBlock = (blockId: string) => {
    setBlocks(blocks.filter((b) => b.id !== blockId));
  };

  const handleDragStart = (blockId: string) => {
    setDraggedBlockId(blockId);
  };

  const handleDragOver = (e: React.DragEvent, targetBlockId: string) => {
    e.preventDefault();
    if (!draggedBlockId || draggedBlockId === targetBlockId) return;

    const draggedIndex = blocks.findIndex((b) => b.id === draggedBlockId);
    const targetIndex = blocks.findIndex((b) => b.id === targetBlockId);

    const newBlocks = [...blocks];
    const [draggedBlock] = newBlocks.splice(draggedIndex, 1);
    newBlocks.splice(targetIndex, 0, draggedBlock);

    setBlocks(newBlocks.map((b, i) => ({ ...b, order: i })));
  };

  const handleDragEnd = () => {
    setDraggedBlockId(null);
  };

  const saveTemplate = async () => {
    if (!templateName.trim()) {
      toast.error("Digite um nome para o template");
      return;
    }
    if (!currentWorkspace) return;

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    setIsLoading(true);
    try {
      const blocksJson = blocks.map((b) => ({
        id: b.id,
        type: b.type,
        content: b.content,
        order: b.order,
      }));

      if (selectedTemplate) {
        const { error } = await supabase
          .from("boleto_recovery_templates" as any)
          .update({ name: templateName, blocks: blocksJson, updated_at: new Date().toISOString() })
          .eq("id", selectedTemplate.id);

        if (error) throw error;
        toast.success("Template atualizado!");
      } else {
        const { error } = await supabase.from("boleto_recovery_templates" as any).insert({
          name: templateName,
          blocks: blocksJson,
          is_default: templates.length === 0,
          user_id: userData.user.id,
          workspace_id: currentWorkspace.id,
        });

        if (error) throw error;
        toast.success("Template salvo!");
      }

      fetchTemplates();
    } catch (error: unknown) {
      toast.error("Erro ao salvar template");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const setAsDefault = async (templateId: string) => {
    if (!currentWorkspace) return;
    try {
      await supabase
        .from("boleto_recovery_templates" as any)
        .update({ is_default: false })
        .eq("workspace_id", currentWorkspace.id)
        .neq("id", templateId);

      const { error } = await supabase
        .from("boleto_recovery_templates" as any)
        .update({ is_default: true })
        .eq("id", templateId);

      if (error) throw error;
      toast.success("Template padrão atualizado!");
      fetchTemplates();
    } catch (error) {
      toast.error("Erro ao definir template padrão");
      console.error(error);
    }
  };

  const deleteTemplate = async (templateId: string) => {
    try {
      const { error } = await supabase
        .from("boleto_recovery_templates" as any)
        .delete()
        .eq("id", templateId);

      if (error) throw error;
      toast.success("Template removido!");

      if (selectedTemplate?.id === templateId) {
        setSelectedTemplate(null);
        setBlocks([]);
        setTemplateName("");
      }

      fetchTemplates();
    } catch (error) {
      toast.error("Erro ao remover template");
      console.error(error);
    }
  };

  const selectTemplate = (template: RecoveryTemplate) => {
    setSelectedTemplate(template);
    setBlocks(template.blocks);
    setTemplateName(template.name);
  };

  const createNewTemplate = () => {
    setSelectedTemplate(null);
    setBlocks([]);
    setTemplateName("");
  };

  const renderBlockContent = (block: RecoveryBlock) => {
    if (block.type === "text") {
      return (
        <div className="flex-1 space-y-2">
          <textarea
            value={block.content}
            onChange={(e) => updateBlockContent(block.id, e.target.value)}
            className="w-full min-h-[80px] p-3 rounded-md bg-secondary/50 border border-border/50 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
            placeholder="Digite sua mensagem..."
          />
          <div className="flex flex-wrap gap-1">
            {Object.entries(VARIABLE_PLACEHOLDERS).map(([variable, { label }]) => (
              <Button
                key={variable}
                variant="outline"
                size="sm"
                className="h-6 text-xs"
                onClick={() => updateBlockContent(block.id, block.content + " " + variable)}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>
      );
    }

    if (block.type === "pdf") {
      return (
        <div className="flex-1 p-4 rounded-md bg-secondary/30 border border-dashed border-border/50 text-center">
          <FileText className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Marcador: PDF do boleto</p>
          <p className="text-xs text-muted-foreground mt-1">
            O PDF será carregado automaticamente na recuperação
          </p>
        </div>
      );
    }

    if (block.type === "image") {
      return (
        <div className="flex-1 p-4 rounded-md bg-secondary/30 border border-dashed border-border/50 text-center">
          <ImageIcon className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Marcador: Imagem do boleto</p>
          <p className="text-xs text-muted-foreground mt-1">
            Converte PDF em JPG para arrastar ao WhatsApp
          </p>
        </div>
      );
    }

    return null;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-primary" />
            Configurar Templates de Recuperação
          </DialogTitle>
        </DialogHeader>

        <div className="flex gap-4 h-[500px]">
          {/* Templates sidebar */}
          <div className="w-52 border-r border-border/30 pr-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium">Templates</p>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={createNewTemplate}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <ScrollArea className="h-[calc(100%-40px)]">
              <div className="space-y-2">
                {templates.map((template) => (
                  <div
                    key={template.id}
                    className={cn(
                      "p-2 rounded-md text-sm transition-colors group",
                      selectedTemplate?.id === template.id
                        ? "bg-primary/10 text-primary border border-primary/30"
                        : "hover:bg-secondary/50"
                    )}
                  >
                    <button
                      onClick={() => selectTemplate(template)}
                      className="w-full text-left"
                    >
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate flex-1">{template.name}</p>
                        {template.is_default && (
                          <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {template.blocks.length} blocos
                      </p>
                    </button>
                    <div className="flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {!template.is_default && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => setAsDefault(template.id)}
                        >
                          <Star className="h-3 w-3" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive hover:text-destructive"
                        onClick={() => deleteTemplate(template.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
                {templates.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    Nenhum template criado
                  </p>
                )}
              </div>
              <div className="mt-3 pt-3 border-t border-border/30">
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  <Star className="h-3 w-3 inline text-yellow-500 fill-yellow-500 mr-1" />
                  O template padrão (★) será usado no envio de recuperação
                </p>
              </div>
            </ScrollArea>
          </div>

          {/* Block editor */}
          <div className="flex-1 flex flex-col">
            <div className="flex items-center gap-3 mb-4">
              <Input
                placeholder="Nome do template"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                className="max-w-[200px]"
              />
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => addBlock("text")}
                  className="gap-1"
                >
                  <Type className="h-3.5 w-3.5" />
                  Texto
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => addBlock("pdf")}
                  className="gap-1"
                >
                  <FileText className="h-3.5 w-3.5" />
                  PDF
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => addBlock("image")}
                  className="gap-1"
                >
                  <ImageIcon className="h-3.5 w-3.5" />
                  Imagem
                </Button>
              </div>
              <Button
                size="sm"
                onClick={saveTemplate}
                disabled={isLoading}
                className="ml-auto gap-1"
              >
                <Save className="h-3.5 w-3.5" />
                Salvar
              </Button>
            </div>

            <ScrollArea className="flex-1 pr-2">
              <div className="space-y-3">
                {blocks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
                    <Settings2 className="h-12 w-12 mb-4 opacity-30" />
                    <p className="text-sm font-medium">Nenhum bloco ainda</p>
                    <p className="text-xs">Adicione blocos de texto, PDF ou imagem acima</p>
                  </div>
                ) : (
                  blocks
                    .sort((a, b) => a.order - b.order)
                    .map((block) => (
                      <div
                        key={block.id}
                        draggable
                        onDragStart={() => handleDragStart(block.id)}
                        onDragOver={(e) => handleDragOver(e, block.id)}
                        onDragEnd={handleDragEnd}
                        className={cn(
                          "flex gap-3 p-3 rounded-lg border border-border/30 bg-card transition-all",
                          draggedBlockId === block.id && "opacity-50 scale-[0.98]"
                        )}
                      >
                        <div className="flex flex-col items-center gap-2">
                          <GripVertical className="h-5 w-5 text-muted-foreground cursor-grab active:cursor-grabbing" />
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px]",
                              block.type === "text" && "bg-blue-500/10 text-blue-500 border-blue-500/30",
                              block.type === "pdf" && "bg-yellow-500/10 text-yellow-600 border-yellow-500/30",
                              block.type === "image" && "bg-green-500/10 text-green-600 border-green-500/30"
                            )}
                          >
                            {block.type === "text" ? "TXT" : block.type === "pdf" ? "PDF" : "IMG"}
                          </Badge>
                        </div>

                        {renderBlockContent(block)}

                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                          onClick={() => removeBlock(block.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))
                )}
              </div>
            </ScrollArea>

            {/* Variables hint */}
            <div className="mt-4 p-3 rounded-lg bg-secondary/30 border border-border/20">
              <p className="text-xs font-medium mb-2">Variáveis disponíveis:</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(VARIABLE_PLACEHOLDERS).map(([variable, { description }]) => (
                  <div key={variable} className="text-xs">
                    <code className="px-1.5 py-0.5 rounded bg-primary/10 text-primary font-mono">
                      {variable}
                    </code>
                    <span className="text-muted-foreground ml-1">{description}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
