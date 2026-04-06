import { useState, useRef, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useEmailTemplates } from "@/hooks/useEmailTemplates";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Plus, Trash2, Pencil, Eye, Loader2, X, Copy, Send,
  Monitor, Smartphone, Code, Type, Image, Minus, Square, AlignLeft,
  FileText, ArrowLeft, Save,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format } from "date-fns";

const SNIPPETS = [
  { label: "Botão CTA", icon: Square, code: `<table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:20px auto;"><tr><td style="background-color:#2563eb;border-radius:6px;padding:12px 24px;"><a href="https://seulink.com" style="color:#ffffff;text-decoration:none;font-weight:bold;font-size:16px;">Clique Aqui</a></td></tr></table>` },
  { label: "Imagem", icon: Image, code: `<img src="https://via.placeholder.com/600x200" alt="Imagem" style="max-width:100%;height:auto;display:block;margin:10px auto;" />` },
  { label: "Divisor", icon: Minus, code: `<hr style="border:0;border-top:1px solid #e5e7eb;margin:20px 0;" />` },
  { label: "Espaçador", icon: AlignLeft, code: `<div style="height:30px;"></div>` },
  { label: "Rodapé", icon: Type, code: `<div style="margin-top:30px;padding-top:20px;border-top:1px solid #e5e7eb;text-align:center;color:#9ca3af;font-size:12px;"><p>{{nome}}, obrigado por nos acompanhar!</p><p style="margin-top:8px;">\u00a9 ${new Date().getFullYear()} Sua Empresa</p></div>` },
];

const VARIABLES = [
  { label: "Nome", value: "{{nome}}" },
  { label: "E-mail", value: "{{email}}" },
  { label: "Telefone", value: "{{telefone}}" },
];

export function EmailTemplatesTab() {
  const { templates, isLoading, addTemplate, updateTemplate, deleteTemplate } = useEmailTemplates();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [htmlBody, setHtmlBody] = useState("");
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [previewDialogHtml, setPreviewDialogHtml] = useState("");
  const [sendingPreview, setSendingPreview] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const resetForm = () => {
    setName(""); setSubject(""); setHtmlBody("");
    setEditingId(null); setShowForm(false);
  };

  const handleEdit = (t: any) => {
    setEditingId(t.id); setName(t.name); setSubject(t.subject); setHtmlBody(t.html_body);
    setShowForm(true);
  };

  const handleDuplicate = (t: any) => {
    setEditingId(null);
    setName(`${t.name} (cópia)`);
    setSubject(t.subject);
    setHtmlBody(t.html_body);
    setShowForm(true);
  };

  const handleSave = () => {
    if (!name.trim() || !subject.trim()) return;
    if (editingId) {
      updateTemplate.mutate({ id: editingId, name, subject, html_body: htmlBody }, { onSuccess: resetForm });
    } else {
      addTemplate.mutate({ name, subject, html_body: htmlBody }, { onSuccess: resetForm });
    }
  };

  const insertAtCursor = useCallback((text: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setHtmlBody((prev) => prev + text);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newValue = htmlBody.substring(0, start) + text + htmlBody.substring(end);
    setHtmlBody(newValue);
    setTimeout(() => {
      textarea.selectionStart = textarea.selectionEnd = start + text.length;
      textarea.focus();
    }, 0);
  }, [htmlBody]);

  const handleSendPreview = async () => {
    setSendingPreview(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const { apiUrl, safeJsonResponse } = await import("@/lib/api");
      const resp = await fetch(apiUrl("email/preview"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, subject, html: htmlBody }),
      });
      const json = await safeJsonResponse(resp);
      if (!resp.ok) throw new Error(json.error || "Erro ao enviar preview");
      toast({ title: "Preview enviado para seu e-mail!" });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setSendingPreview(false);
    }
  };

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  // Editor view
  if (showForm) {
    return (
      <div className="space-y-4">
        {/* Editor header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={resetForm}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h2 className="text-lg font-semibold text-foreground">
              {editingId ? "Editar Template" : "Novo Template"}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleSendPreview} disabled={sendingPreview || !htmlBody.trim()}>
              {sendingPreview ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Send className="h-3.5 w-3.5 mr-1.5" />}
              Enviar Preview
            </Button>
            <Button size="sm" onClick={handleSave} disabled={addTemplate.isPending || updateTemplate.isPending || !name.trim() || !subject.trim()}>
              {(addTemplate.isPending || updateTemplate.isPending) ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
              Salvar
            </Button>
          </div>
        </div>

        {/* Name & Subject */}
        <div className="grid grid-cols-2 gap-3">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome do template"
            className="bg-card border-border"
          />
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Assunto do e-mail (ex: Bem-vindo, {{nome}}!)"
            className="bg-card border-border"
          />
        </div>

        {/* Toolbar */}
        <TooltipProvider delayDuration={200}>
          <div className="flex flex-wrap items-center gap-1 p-2 rounded-lg bg-muted/50 border border-border">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5">
                  <Code className="h-3.5 w-3.5" /> Snippets
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {SNIPPETS.map((s) => (
                  <DropdownMenuItem key={s.label} onClick={() => insertAtCursor(s.code)} className="gap-2">
                    <s.icon className="h-4 w-4 text-muted-foreground" /> {s.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="h-5 w-px bg-border mx-1" />

            {VARIABLES.map((v) => (
              <Tooltip key={v.value}>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => insertAtCursor(v.value)}>
                    {v.label}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p className="text-xs font-mono">{v.value}</p>
                </TooltipContent>
              </Tooltip>
            ))}

            <div className="flex-1" />

            <div className="flex items-center gap-0.5 p-0.5 rounded-md bg-background border border-border">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={previewMode === "desktop" ? "secondary" : "ghost"}
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setPreviewMode("desktop")}
                  >
                    <Monitor className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom"><p className="text-xs">Desktop</p></TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={previewMode === "mobile" ? "secondary" : "ghost"}
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setPreviewMode("mobile")}
                  >
                    <Smartphone className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom"><p className="text-xs">Mobile</p></TooltipContent>
              </Tooltip>
            </div>
          </div>
        </TooltipProvider>

        {/* Side-by-side editor + preview */}
        <div className="grid grid-cols-2 gap-4" style={{ minHeight: 420 }}>
          {/* Code editor */}
          <div className="flex flex-col rounded-lg border border-border overflow-hidden">
            <div className="px-3 py-1.5 bg-muted/50 border-b border-border flex items-center gap-2">
              <Code className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground font-medium">HTML</span>
            </div>
            <Textarea
              ref={textareaRef}
              value={htmlBody}
              onChange={(e) => setHtmlBody(e.target.value)}
              placeholder="<h1>Olá {{nome}}!</h1>&#10;<p>Seu conteúdo aqui...</p>"
              className="flex-1 min-h-0 font-mono text-xs resize-none border-0 rounded-none bg-[hsl(var(--card))] focus-visible:ring-0 focus-visible:ring-offset-0"
            />
          </div>

          {/* Preview */}
          <div className="flex flex-col rounded-lg border border-border overflow-hidden">
            <div className="px-3 py-1.5 bg-muted/50 border-b border-border flex items-center gap-2">
              <Eye className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground font-medium">
                Preview {previewMode === "mobile" ? "(375px)" : "(Desktop)"}
              </span>
            </div>
            <div className="flex-1 bg-white overflow-auto flex justify-center">
              <div className={`w-full ${previewMode === "mobile" ? "max-w-[375px]" : ""}`} style={{ minHeight: 380 }}>
                <iframe
                  srcDoc={htmlBody || `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#999;font-family:sans-serif;padding:40px;text-align:center;"><p>O preview do seu e-mail aparecerá aqui</p></div>`}
                  className="w-full h-full border-0"
                  style={{ minHeight: 380 }}
                  sandbox="allow-same-origin"
                  title="Email Preview"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Template list view
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {templates.length} template{templates.length !== 1 ? "s" : ""} criado{templates.length !== 1 ? "s" : ""}
        </p>
        <Button onClick={() => setShowForm(true)} size="sm" className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Novo Template
        </Button>
      </div>

      {templates.length === 0 && (
        <div className="text-center py-16">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground mb-1">Nenhum template criado ainda</p>
          <p className="text-xs text-muted-foreground">Crie seu primeiro template para começar a enviar e-mails</p>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {templates.map((t: any) => (
          <Card key={t.id} className="group border-border bg-card hover:shadow-md transition-all overflow-hidden">
            {/* Mini preview thumbnail */}
            <div className="h-32 bg-white border-b border-border overflow-hidden relative">
              <iframe
                srcDoc={t.html_body || "<div style='padding:20px;color:#ccc;font-size:12px;'>Sem conteúdo</div>"}
                className="w-full h-full border-0 pointer-events-none"
                sandbox="allow-same-origin"
                title={`Preview ${t.name}`}
                style={{ transform: "scale(0.5)", transformOrigin: "top left", width: "200%", height: "200%" }}
              />
              <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background/10" />
            </div>

            <CardContent className="p-3 space-y-2">
              <div>
                <p className="font-medium text-sm text-foreground truncate">{t.name}</p>
                <p className="text-xs text-muted-foreground truncate">{t.subject}</p>
              </div>

              <div className="flex items-center justify-between">
                <p className="text-[10px] text-muted-foreground">
                  {format(new Date(t.created_at), "dd/MM/yyyy")}
                </p>
                <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setPreviewDialogHtml(t.html_body); setShowPreviewDialog(true); }}>
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent><p className="text-xs">Preview</p></TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDuplicate(t)}>
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent><p className="text-xs">Duplicar</p></TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(t)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent><p className="text-xs">Editar</p></TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteTemplate.mutate(t.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent><p className="text-xs">Excluir</p></TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Preview Dialog */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>Preview do Template</DialogTitle>
              <div className="flex items-center gap-0.5 p-0.5 rounded-md bg-muted border border-border">
                <Button variant={previewMode === "desktop" ? "secondary" : "ghost"} size="icon" className="h-7 w-7" onClick={() => setPreviewMode("desktop")}>
                  <Monitor className="h-3.5 w-3.5" />
                </Button>
                <Button variant={previewMode === "mobile" ? "secondary" : "ghost"} size="icon" className="h-7 w-7" onClick={() => setPreviewMode("mobile")}>
                  <Smartphone className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </DialogHeader>
          <div className={`border border-border rounded-lg overflow-auto bg-white ${previewMode === "mobile" ? "max-w-[375px] mx-auto" : ""}`} style={{ maxHeight: "60vh" }}>
            <iframe
              srcDoc={previewDialogHtml}
              className="w-full border-0"
              style={{ minHeight: 400 }}
              sandbox="allow-same-origin"
              title="Email Preview"
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
