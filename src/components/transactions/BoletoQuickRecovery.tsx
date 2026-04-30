import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import {
  Copy,
  Check,
  FileText,
  Image as ImageIcon,
  User,
  Phone,
  Download,
  Loader2,
  DollarSign,
  Calendar,
  MessageCircle,
} from "lucide-react";
import { toast } from "sonner";
import { pdfToImage } from "@/lib/pdfToImage";
import { useWhatsAppExtension } from "@/hooks/useWhatsAppExtension";
import { useWorkspace } from "@/hooks/useWorkspace";
import { apiUrl } from "@/lib/api";
import type { Transaction } from "@/hooks/useTransactions";
import { normalizePhone } from "@/lib/normalizePhone";
import { useRecoveryClicks } from "@/hooks/useRecoveryClicks";

interface BoletoQuickRecoveryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: Transaction | null;
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

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

export function BoletoQuickRecovery({ open, onOpenChange, transaction }: BoletoQuickRecoveryProps) {
  const [template, setTemplate] = useState<RecoveryTemplate | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  const [imageBlobUrl, setImageBlobUrl] = useState<string | null>(null);
  const [isLoadingImage, setIsLoadingImage] = useState(false);

  const { openChat, fallbackOpenWhatsApp, isConnected: isExtensionConnected } = useWhatsAppExtension();
  const txIds = transaction ? [transaction.id] : [];
  const { addClick } = useRecoveryClicks(txIds);
  const { workspace } = useWorkspace();

  useEffect(() => {
    if (open && transaction && workspace) {
      fetchDefaultTemplate();
      loadPdf();
    } else if (!open) {
      if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl);
      if (imageBlobUrl) URL.revokeObjectURL(imageBlobUrl);
      setPdfBlobUrl(null);
      setImageBlobUrl(null);
    }
  }, [open, transaction]);

  const fetchDefaultTemplate = async () => {
    if (!workspace) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("boleto_recovery_templates" as any)
        .select("*")
        .eq("workspace_id", workspace.id)
        .eq("is_default", true)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setTemplate({
          id: (data as any).id,
          name: (data as any).name,
          is_default: (data as any).is_default,
          blocks: Array.isArray((data as any).blocks) ? ((data as any).blocks as RecoveryBlock[]) : [],
        });
      } else {
        // Fallback to first template
        const { data: anyTemplate } = await supabase
          .from("boleto_recovery_templates" as any)
          .select("*")
          .eq("workspace_id", workspace.id)
          .limit(1)
          .maybeSingle();

        if (anyTemplate) {
          setTemplate({
            id: (anyTemplate as any).id,
            name: (anyTemplate as any).name,
            is_default: (anyTemplate as any).is_default,
            blocks: Array.isArray((anyTemplate as any).blocks) ? ((anyTemplate as any).blocks as RecoveryBlock[]) : [],
          });
        }
      }
    } catch (error) {
      console.error("Error fetching template:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadPdf = async () => {
    if (!transaction) return;

    setIsLoadingPdf(true);
    try {
      // Use the backend endpoint that handles both cached and on-demand PDF fetch
      const { data: { session } } = await supabase.auth.getSession();
      const pdfEndpoint = apiUrl(`payment/boleto-pdf/${transaction.id}`);
      
      const response = await fetch(pdfEndpoint, {
        headers: session?.access_token
          ? { Authorization: `Bearer ${session.access_token}` }
          : {},
      });

      if (!response.ok) {
        console.warn(`[BoletoQuickRecovery] PDF endpoint returned ${response.status}`);
        return;
      }

      const arrayBuffer = await response.arrayBuffer();
      const blob = new Blob([arrayBuffer], { type: "application/pdf" });
      const pdfUrl = URL.createObjectURL(blob);
      setPdfBlobUrl(pdfUrl);

      // Generate image from PDF
      generateImageFromPdf(arrayBuffer);
    } catch (error) {
      console.error("Error loading PDF:", error);
    } finally {
      setIsLoadingPdf(false);
    }
  };

  const generateImageFromPdf = async (arrayBuffer: ArrayBuffer) => {
    setIsLoadingImage(true);
    try {
      const blob = await pdfToImage(arrayBuffer, 2);
      const imageUrl = URL.createObjectURL(blob);
      setImageBlobUrl(imageUrl);
    } catch (error) {
      console.error("Error generating image:", error);
    } finally {
      setIsLoadingImage(false);
    }
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const replaceVariables = (text: string): string => {
    if (!transaction) return text;
    const fullName = transaction.customer_name || "Cliente";
    const firstName = fullName.split(" ")[0];

    return text
      .replace(/{saudação}/g, getGreeting())
      .replace(/{saudacao}/g, getGreeting())
      .replace(/{nome}/g, fullName)
      .replace(/{primeiro_nome}/g, firstName)
      .replace(/{valor}/g, formatCurrency(Number(transaction.amount)));
  };

  const handleCopy = async (text: string, blockId: string) => {
    const processedText = replaceVariables(text);
    await navigator.clipboard.writeText(processedText);
    setCopiedId(blockId);
    toast.success("Copiado!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyField = async (value: string, fieldId: string) => {
    await navigator.clipboard.writeText(value);
    setCopiedId(fieldId);
    toast.success("Copiado!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (!transaction) return null;

  const renderBlock = (block: RecoveryBlock) => {
    if (block.type === "text") {
      const processedText = replaceVariables(block.content);
      return (
        <div key={block.id} className="flex items-start gap-2 p-3 rounded-lg bg-card border border-border hover:border-primary/30 transition-colors">
          <p className="text-sm whitespace-pre-wrap leading-relaxed text-foreground/90 flex-1">{processedText}</p>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 shrink-0"
            onClick={() => handleCopy(block.content, block.id)}
          >
            {copiedId === block.id ? (
              <Check className="h-4 w-4 text-green-500" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
        </div>
      );
    }

    if (block.type === "pdf") {
      return (
        <div key={block.id}>
          {isLoadingPdf ? (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/30 border border-border">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="text-xs text-muted-foreground">Carregando PDF...</span>
            </div>
          ) : pdfBlobUrl ? (
            <a
              href={pdfBlobUrl}
              download={`boleto-${transaction?.customer_name?.split(" ")[0] || "cliente"}.pdf`}
              className="flex items-center gap-3 p-3 rounded-lg bg-destructive/5 border border-destructive/20 hover:border-destructive/40 transition-all no-underline"
            >
              <div className="w-10 h-12 bg-background rounded shadow-sm flex items-center justify-center border shrink-0">
                <FileText className="h-5 w-5 text-destructive" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  boleto-{transaction?.customer_name?.split(" ")[0] || "cliente"}.pdf
                </p>
                <p className="text-xs text-muted-foreground">Clique para baixar</p>
              </div>
              <Download className="h-4 w-4 text-muted-foreground shrink-0" />
            </a>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-2">PDF não disponível</p>
          )}
        </div>
      );
    }

    if (block.type === "image") {
      return (
        <div key={block.id}>
          {isLoadingImage ? (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/30 border border-border">
              <Loader2 className="h-4 w-4 animate-spin text-green-500" />
              <span className="text-xs text-muted-foreground">Gerando imagem...</span>
            </div>
          ) : imageBlobUrl ? (
            <a
              href={imageBlobUrl}
              download={`boleto-${transaction?.customer_name?.split(" ")[0] || "cliente"}.jpg`}
              className="flex items-center gap-3 p-3 rounded-lg bg-green-500/5 border border-green-500/20 hover:border-green-500/40 transition-all no-underline"
            >
              <div className="w-10 h-12 bg-background rounded shadow-sm flex items-center justify-center border shrink-0 overflow-hidden">
                <img
                  src={imageBlobUrl}
                  alt="Boleto"
                  className="w-full h-full object-cover"
                  draggable="false"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  boleto-{transaction?.customer_name?.split(" ")[0] || "cliente"}.jpg
                </p>
                <p className="text-xs text-muted-foreground">Clique para baixar</p>
              </div>
              <Download className="h-4 w-4 text-muted-foreground shrink-0" />
            </a>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-2">
              {isLoadingPdf ? "Aguardando PDF..." : "Imagem não disponível"}
            </p>
          )}
        </div>
      );
    }

    return null;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[85vh] p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b bg-muted/30">
          <DialogTitle className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <span className="text-lg">Recuperação de Boleto</span>
              <p className="text-sm font-normal text-muted-foreground">Copie as mensagens para enviar ao cliente</p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] min-h-0">
          {/* Left side - Boleto Info */}
          <div className="p-6 bg-muted/20 border-b lg:border-b-0 lg:border-r border-border/50">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
              Dados do Cliente
            </h4>

            <div className="space-y-3">
              {/* Cliente */}
              <div className="p-3 rounded-lg bg-card border border-border">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                  <User className="h-3.5 w-3.5" />
                  <span>Nome do Cliente</span>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{transaction.customer_name || "-"}</p>
                  {transaction.customer_name && (
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleCopyField(transaction.customer_name!, "name")}>
                      {copiedId === "name" ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                    </Button>
                  )}
                </div>
              </div>

              {/* Telefone */}
              <div className="p-3 rounded-lg bg-card border border-border">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                  <Phone className="h-3.5 w-3.5" />
                  <span>Telefone</span>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium font-mono">{normalizePhone(transaction.customer_phone)}</p>
                  {transaction.customer_phone && (
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleCopyField(transaction.customer_phone!, "phone")}>
                      {copiedId === "phone" ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                    </Button>
                  )}
                </div>
              </div>

              {/* CPF/Documento */}
              {transaction.customer_document && (
                <div className="p-3 rounded-lg bg-card border border-border">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                    <FileText className="h-3.5 w-3.5" />
                    <span>CPF</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium font-mono">{transaction.customer_document}</p>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleCopyField(transaction.customer_document!, "document")}>
                      {copiedId === "document" ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>
              )}

              {/* Valor */}
              <div className="p-3 rounded-lg bg-primary/10 border border-primary/30">
                <div className="flex items-center gap-2 text-xs text-primary/70 mb-1">
                  <DollarSign className="h-3.5 w-3.5" />
                  <span>Valor do Boleto</span>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-lg font-bold text-primary">{formatCurrency(Number(transaction.amount))}</p>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleCopyField(formatCurrency(Number(transaction.amount)), "value")}>
                    {copiedId === "value" ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>

              {/* Data */}
              <div className="p-3 rounded-lg bg-card border border-border">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>Data de criação</span>
                </div>
                <p className="text-sm font-medium">
                  {new Date(transaction.created_at).toLocaleDateString("pt-BR")}
                </p>
              </div>

              {/* Botão WhatsApp */}
              {transaction.customer_phone && (
                <Button
                  className="w-full gap-2 h-11 mt-4 bg-green-600 hover:bg-green-700 text-white font-medium shadow-lg"
                  onClick={async () => {
                    addClick.mutate({ transactionId: transaction!.id, recoveryType: "boleto" });
                    if (isExtensionConnected) {
                      openChat(transaction!.customer_phone!);
                      toast.success("Chat aberto! Cole a mensagem com Ctrl+V");
                    } else {
                      fallbackOpenWhatsApp(transaction!.customer_phone!);
                      toast.success("Abrindo WhatsApp...");
                    }
                  }}
                >
                  <MessageCircle className="h-5 w-5" />
                  Abrir conversa no WhatsApp
                </Button>
              )}
            </div>
          </div>

          {/* Right side - Recovery messages */}
          <div className="p-6 overflow-y-auto max-h-[calc(85vh-80px)]">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
              Mensagens de Recuperação
            </h4>

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="ml-3 text-muted-foreground">Carregando template...</span>
              </div>
            ) : !template || template.blocks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed border-border rounded-xl">
                <FileText className="h-10 w-10 text-muted-foreground/50 mb-3" />
                <p className="text-sm font-medium text-muted-foreground">Nenhum template configurado</p>
                <p className="text-xs text-muted-foreground/70 mt-1">Configure templates clicando na ⚙️ ao lado da aba</p>
              </div>
            ) : (
              <div className="space-y-3">
                {template.blocks
                  .sort((a, b) => a.order - b.order)
                  .map((block) => renderBlock(block))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
