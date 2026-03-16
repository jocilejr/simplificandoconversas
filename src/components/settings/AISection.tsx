import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { useProfile } from "@/hooks/useProfile";
import { useAIConfig } from "@/hooks/useAIConfig";
import { Loader2, Brain, Ear } from "lucide-react";

export function AISection() {
  const { profile, updateProfile } = useProfile();
  const { config, isLoading: configLoading, updateConfig } = useAIConfig();
  const [openaiKey, setOpenaiKey] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [listenRules, setListenRules] = useState("");
  const [maxContext, setMaxContext] = useState(10);
  const [replyStopContexts, setReplyStopContexts] = useState("");

  useEffect(() => {
    if (profile) setOpenaiKey(profile.openai_api_key || "");
  }, [profile]);

  useEffect(() => {
    if (config) {
      setSystemPrompt(config.reply_system_prompt || "");
      setListenRules(config.listen_rules || "");
      setMaxContext(config.max_context_messages || 10);
      setReplyStopContexts(config.reply_stop_contexts || "");
    }
  }, [config]);

  return (
    <div className="space-y-6">
      {/* OpenAI Key */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-lg">OpenAI</CardTitle>
          <CardDescription>Configure sua API Key da OpenAI para usar IA no sistema</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>API Key</Label>
            <Input
              type="password"
              placeholder="sk-..."
              value={openaiKey}
              onChange={(e) => setOpenaiKey(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Obtenha sua chave em{" "}
              <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="underline">
                platform.openai.com/api-keys
              </a>
            </p>
          </div>
          <Button
            onClick={() => updateProfile.mutate({ openai_api_key: openaiKey })}
            disabled={updateProfile.isPending}
          >
            {updateProfile.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Salvar
          </Button>
        </CardContent>
      </Card>

      {/* AI Auto-Reply Config */}
      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">IA Responde</CardTitle>
          </div>
          <CardDescription>
            Configure o prompt do sistema para quando a IA responder automaticamente. 
            O toggle é ativado por contato na extensão Chrome.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>System Prompt</Label>
            <Textarea
              placeholder="Você é um assistente de vendas profissional..."
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              rows={5}
            />
            <p className="text-xs text-muted-foreground">
              Instruções que definem como a IA deve responder aos contatos
            </p>
          </div>
          <div className="space-y-2">
            <Label>Mensagens de Contexto: {maxContext}</Label>
            <Slider
              value={[maxContext]}
              onValueChange={([v]) => setMaxContext(v)}
              min={1}
              max={30}
              step={1}
            />
            <p className="text-xs text-muted-foreground">
              Quantas mensagens recentes enviar como contexto para a IA (1-30)
            </p>
          </div>
          <Button
            onClick={() => updateConfig.mutate({ reply_system_prompt: systemPrompt, max_context_messages: maxContext })}
            disabled={updateConfig.isPending}
          >
            {updateConfig.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Salvar Configuração
          </Button>
        </CardContent>
      </Card>

      {/* AI Listen Config */}
      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Ear className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">IA Escuta</CardTitle>
          </div>
          <CardDescription>
            Configure as regras para criação automática de lembretes. 
            A IA vai analisar mensagens e criar lembretes apenas quando detectar algo relevante.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Regras de Escuta</Label>
            <Textarea
              placeholder="Detecte menções a pagamentos, datas, prazos, promessas de pagamento..."
              value={listenRules}
              onChange={(e) => setListenRules(e.target.value)}
              rows={5}
            />
            <p className="text-xs text-muted-foreground">
              Defina o que a IA deve monitorar nas conversas para criar lembretes automáticos
            </p>
          </div>
          <Button
            onClick={() => updateConfig.mutate({ listen_rules: listenRules })}
            disabled={updateConfig.isPending}
          >
            {updateConfig.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Salvar Regras
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
