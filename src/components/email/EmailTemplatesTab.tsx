import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useEmailTemplates } from "@/hooks/useEmailTemplates";
import { Plus, Trash2, Pencil, Eye, Loader2, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function EmailTemplatesTab() {
  const { templates, isLoading, addTemplate, updateTemplate, deleteTemplate } = useEmailTemplates();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [htmlBody, setHtmlBody] = useState("");
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);

  const resetForm = () => {
    setName(""); setSubject(""); setHtmlBody("");
    setEditingId(null); setShowForm(false);
  };

  const handleEdit = (t: any) => {
    setEditingId(t.id); setName(t.name); setSubject(t.subject); setHtmlBody(t.html_body);
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
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Ex: Bem-vindo!" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Corpo HTML</Label>
              <Textarea
                value={htmlBody}
                onChange={(e) => setHtmlBody(e.target.value)}
                placeholder="<h1>Olá!</h1><p>Seu conteúdo aqui...</p>"
                className="min-h-[200px] font-mono text-xs"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={addTemplate.isPending || updateTemplate.isPending}>
                {(addTemplate.isPending || updateTemplate.isPending) && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                Salvar
              </Button>
              <Button variant="outline" onClick={() => setPreviewHtml(htmlBody)}>
                <Eye className="h-4 w-4 mr-1" /> Preview
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
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setPreviewHtml(t.html_body)}>
                  <Eye className="h-4 w-4" />
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

      <Dialog open={!!previewHtml} onOpenChange={() => setPreviewHtml(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Preview do Template</DialogTitle>
          </DialogHeader>
          <div className="border rounded-lg overflow-auto bg-white p-4 max-h-[60vh]">
            <div dangerouslySetInnerHTML={{ __html: previewHtml || "" }} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
