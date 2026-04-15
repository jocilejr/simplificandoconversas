import { useState } from "react";
import { Copy, MoreVertical, Pencil, Trash2, Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

interface QuickReplyCardProps {
  id: string;
  title: string;
  content: string;
  category: string;
  onUpdate: (data: { id: string; title: string; content: string; category: string }) => void;
  onDelete: (id: string) => void;
}

export function QuickReplyCard({ id, title, content, category, onUpdate, onDelete }: QuickReplyCardProps) {
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(title);
  const [editContent, setEditContent] = useState(content);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    toast.success("Copiado!");
    setTimeout(() => setCopied(false), 1500);
  };

  const handleSave = () => {
    if (!editTitle.trim() || !editContent.trim()) return;
    onUpdate({ id, title: editTitle.trim(), content: editContent.trim(), category });
    setEditing(false);
  };

  const handleCancel = () => {
    setEditTitle(title);
    setEditContent(content);
    setEditing(false);
  };

  if (editing) {
    return (
      <Card className="border-primary/40 bg-card">
        <CardContent className="p-4 space-y-3">
          <Input
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            placeholder="Título"
            className="h-8 text-sm"
          />
          <Textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            placeholder="Conteúdo da resposta"
            className="min-h-[80px] text-sm resize-none"
          />
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="ghost" onClick={handleCancel} className="h-7 text-xs">
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSave} className="h-7 text-xs">
              Salvar
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="group border-border/60 bg-card hover:border-primary/30 transition-colors">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="text-sm font-semibold text-foreground truncate flex-1">{title}</h3>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={handleCopy}
            >
              {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <MoreVertical className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setEditing(true)}>
                  <Pencil className="h-3.5 w-3.5 mr-2" /> Editar
                </DropdownMenuItem>
                <DropdownMenuItem className="text-destructive" onClick={() => onDelete(id)}>
                  <Trash2 className="h-3.5 w-3.5 mr-2" /> Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <p className="text-xs text-muted-foreground line-clamp-3 whitespace-pre-wrap">{content}</p>
      </CardContent>
    </Card>
  );
}
