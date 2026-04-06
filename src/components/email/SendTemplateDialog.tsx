import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Send } from "lucide-react";

interface Props {
  template: { id: string; name: string; subject: string; html_body: string } | null;
  onClose: () => void;
}

export function SendTemplateDialog({ template, onClose }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [sending, setSending] = useState(false);
  const [suggestions, setSuggestions] = useState<{ email: string; name: string | null }[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    if (!template) { setEmail(""); setRecipientName(""); setSuggestions([]); }
  }, [template]);

  useEffect(() => {
    if (email.length < 2) { setSuggestions([]); return; }
    const timeout = setTimeout(async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("email_contacts")
        .select("email, name")
        .eq("user_id", user.id)
        .ilike("email", `%${email}%`)
        .limit(5);
      setSuggestions(data || []);
      setShowSuggestions((data || []).length > 0);
    }, 300);
    return () => clearTimeout(timeout);
  }, [email]);

  const handleSend = async () => {
    if (!template || !email.trim()) return;
    setSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      let html = template.html_body;
      let subj = template.subject;
      const vars: Record<string, string> = {
        "{{nome}}": recipientName || "",
        "{{email}}": email,
        "{{telefone}}": "",
      };
      for (const [key, val] of Object.entries(vars)) {
      html = html.split(key).join(val);
        subj = subj.split(key).join(val);
      }

      const { apiUrl, safeJsonResponse } = await import("@/lib/api");
      const resp = await fetch(apiUrl("email/send"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          to: email,
          subject: subj,
          html,
          templateId: template.id,
          recipientName: recipientName || undefined,
        }),
      });
      const json = await safeJsonResponse(resp);
      if (!resp.ok) throw new Error(json.error || "Erro ao enviar");

      toast({ title: "E-mail enviado com sucesso!" });
      qc.invalidateQueries({ queryKey: ["email-template-stats"] });
      onClose();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={!!template} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Enviar Template</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Enviando: <span className="font-medium text-foreground">{template?.name}</span>
        </p>
        <div className="space-y-3">
          <div className="relative">
            <Input
              placeholder="E-mail do destinatário"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              className="bg-card border-border"
            />
            {showSuggestions && (
              <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-md overflow-hidden">
                {suggestions.map((s) => (
                  <button
                    key={s.email}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors"
                    onMouseDown={() => {
                      setEmail(s.email);
                      if (s.name) setRecipientName(s.name);
                      setShowSuggestions(false);
                    }}
                  >
                    <span className="text-foreground">{s.email}</span>
                    {s.name && <span className="text-muted-foreground ml-2">— {s.name}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
          <Input
            placeholder="Nome do destinatário (opcional)"
            value={recipientName}
            onChange={(e) => setRecipientName(e.target.value)}
            className="bg-card border-border"
          />
          <Button className="w-full gap-2" onClick={handleSend} disabled={sending || !email.trim()}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Enviar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
