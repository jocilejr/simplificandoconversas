import { supabase } from "@/integrations/supabase/client";

/**
 * Upload a file via the whatsapp-proxy backend (media-upload action).
 * This bypasses Supabase Storage and saves directly to the VPS filesystem,
 * returning a public URL served by Nginx at /media/...
 *
 * Works identically to the chatbot MediaUpload component.
 */
export async function uploadMediaFile(file: File): Promise<string> {
  if (file.size > 20 * 1024 * 1024) {
    throw new Error("Arquivo muito grande (máx 20MB)");
  }

  const fileBase64 = await fileToBase64(file);

  const { data, error } = await supabase.functions.invoke("whatsapp-proxy", {
    body: {
      action: "media-upload",
      fileBase64,
      fileName: file.name,
      mimetype: file.type,
    },
  });

  if (error) throw error;
  if (data?.error) throw new Error(data.error);

  return data.url;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
