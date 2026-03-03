import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface MediaUploadProps {
  label: string;
  value: string;
  accept: string;
  onChange: (url: string) => void;
}

export function MediaUpload({ label, value, accept, onChange }: MediaUploadProps) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${crypto.randomUUID()}.${ext}`;

      const { error } = await supabase.storage
        .from("chatbot-media")
        .upload(path, file);

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from("chatbot-media")
        .getPublicUrl(path);

      onChange(urlData.publicUrl);
      toast.success("Arquivo enviado!");
    } catch (err: any) {
      toast.error("Erro ao enviar: " + err.message);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const isImage = accept.startsWith("image");
  const isVideo = accept.startsWith("video");

  return (
    <div className="space-y-2">
      <Label className="text-xs">{label}</Label>

      {value ? (
        <div className="relative rounded-lg overflow-hidden border border-border bg-muted">
          {isImage && (
            <img src={value} alt="Preview" className="w-full h-24 object-cover" />
          )}
          {isVideo && (
            <video src={value} className="w-full h-24 object-cover" />
          )}
          {!isImage && !isVideo && (
            <div className="px-3 py-2">
              <p className="text-[11px] text-muted-foreground truncate">{value.split("/").pop()}</p>
            </div>
          )}
          <Button
            variant="destructive"
            size="icon"
            className="absolute top-1 right-1 h-5 w-5 rounded-full"
            onClick={() => onChange("")}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      ) : (
        <button
          type="button"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          className="w-full flex flex-col items-center justify-center gap-1.5 py-5 border-2 border-dashed border-border rounded-lg hover:border-primary/40 hover:bg-muted/50 transition-colors cursor-pointer disabled:opacity-50"
        >
          {uploading ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : (
            <Upload className="h-5 w-5 text-muted-foreground" />
          )}
          <span className="text-[11px] text-muted-foreground">
            {uploading ? "Enviando..." : "Clique para selecionar"}
          </span>
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleUpload}
        className="hidden"
      />
    </div>
  );
}
