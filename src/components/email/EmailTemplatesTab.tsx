import { useState, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useEmailTemplates } from "@/hooks/useEmailTemplates";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2, Pencil, Eye, Loader2, X, Copy, Send, Monitor, Smartphone, Code, Type, Image, Minus, Square, AlignLeft } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

const SNIPPETS = [
  { label: "Botão CTA", icon: Square, code: `<table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:20px auto;"><tr><td style="background-color:#2563eb;border-radius:6px;padding:12px 24px;"><a href="https://seulink.com" style="color:#ffffff;text-decoration:none;font-weight:bold;font-size:16px;">Clique Aqui</a></td></tr></table>` },
  { label: "Imagem", icon: Image, code: `<img src="https://via.placeholder.com/600x200" alt="Imagem" style="max-width:100%;height:auto;display:block;margin:10px auto;" />` },
  { label: "Divisor", icon: Minus, code: `<hr style="border:0;border-top:1px solid #e5e7eb;margin:20px 0;" />` },
  { label: "Espaçador", icon: AlignLeft, code: `<div style="height:30px;"></div>` },
  { label: "Rodapé", icon: Type, code: `<div style="margin-top:30px;padding-top:20px;border-top:1px solid #e5e7eb;text-align:center;color:#9ca3af;font-size:12px;"><p>{{nome}}, obrigado por nos acompanhar!</p><p style="margin-top:8px;">© ${new Date().getFullYear()} Sua Empresa</p></div>` },
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
      const baseUrl = import.meta.env.VITE_SUPABASE_URL || "";
      const resp = await fetch(`${baseUrl}/functions/v1/email/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, subject, html: htmlBody }),
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || "Erro ao enviar preview");
      toast({ title: "Preview enviado para seu e-mail!" });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setSendingPreview(false);
    }
  };

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      {!showForm && (
        <Button onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4 mr-2" /> Novo Template
        </Button>
      )}

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{editingId ? "Editar Template" : "Novo Template"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Nome</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Boas-vindas" />
              </div>
              <div className="space-y-1.5">
                <Label>Assunto</Label>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Ex: Bem-vindo, {{nome}}!" />
              </div>
            </div>

            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-1 p-2 rounded-md bg-muted/50 border">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 text-xs">
                    <Code className="h-3 w-3 mr-1" /> Snippets
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {SNIPPETS.map((s) => (
                    <DropdownMenuItem key={s.label} onClick={() => insertAtCursor(s.code)}>
                      <s.icon className="h-4 w-4 mr-2" /> {s.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <div className="h-4 w-px bg-border mx-1" />

              {VARIABLES.map((v) => (
                <Button key={v.value} variant="ghost" size="sm" className="h-7 text-xs" onClick={() => insertAtCursor(v.value)}>
                  {v.label}
                </Button>
              ))}

              <div className="flex-1" />

              <Button
                variant="ghost" size="sm" className="h-7 text-xs"
                onClick={() => setPreviewMode(previewMode === "desktop" ? "mobile" : "desktop")}
              >
                {previewMode === "desktop" ? <Smartphone className="h-3 w-3 mr-1" /> : <Monitor className="h-3 w-3 mr-1" />}
                {previewMode === "desktop" ? "Mobile" : "Desktop"}
              </Button>
            </div>

            {/* Side-by-side editor */}
            <div className="grid grid-cols-2 gap-3 min-h-[350px]">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Código HTML</Label>
                <Textarea
                  ref={textareaRef}
                  value={htmlBody}
                  onChange={(e) => setHtmlBody(e.target.value)}
                  placeholder="<h1>Olá {{nome}}!</h1><p>Seu conteúdo aqui...</p>"
                  className="min-h-[320px] font-mono text-xs resize-none flex-1"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Preview {previewMode === "mobile" ? "(Mobile)" : "(Desktop)"}</Label>
                <div className={`border rounded-md bg-white overflow-auto ${previewMode === "mobile" ? "max-w-[375px] mx-auto" : ""}`} style={{ minHeight: 320 }}>
                  <iframe
                    srcDoc={htmlBody || "<p style='color:#999;padding:20px;'>Preview aparecerá aqui...</p>"}
                    className="w-full h-full border-0"
                    style={{ minHeight: 320 }}
                    sandbox="allow-same-origin"
                    title="Email Preview"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-2 flex-wrap">
              <Button onClick={handleSave} disabled={addTemplate.isPending || updateTemplate.isPending}>
                {(addTemplate.isPending || updateTemplate.isPending) && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                Salvar
              </Button>
              <Button variant="outline" onClick={handleSendPreview} disabled={sendingPreview || !htmlBody.trim()}>
                {sendingPreview ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
                Enviar Preview
              </Button>
              <Button variant="ghost" onClick={resetForm}>
                <X className="h-4 w-4 mr-1" /> Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {templates.length === 0 && !showForm && (
        <p className="text-sm text-muted-foreground">Nenhum template criado ainda.</p>
      )}

      <div className="grid gap-3">
        {templates.map((t: any) => (
          <Card key={t.id} className="bg-card">
            <CardContent className="flex items-center justify-between p-4">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm">{t.name}</p>
                <p className="text-xs text-muted-foreground truncate">Assunto: {t.subject}</p>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setPreviewDialogHtml(t.html_body); setShowPreviewDialog(true); }}>
                  <Eye className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDuplicate(t)}>
                  <Copy className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(t)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteTemplate.mutate(t.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>Preview do Template</DialogTitle>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => setPreviewMode("desktop")}>
                  <Monitor className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setPreviewMode("mobile")}>
                  <Smartphone className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </DialogHeader>
          <div className={`border rounded-lg overflow-auto bg-white ${previewMode === "mobile" ? "max-w-[375px] mx-auto" : ""}`} style={{ maxHeight: "60vh" }}>
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
