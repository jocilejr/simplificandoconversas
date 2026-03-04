import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useContactPhoto(remoteJid: string | null) {
  return useQuery({
    queryKey: ["contact-photo", remoteJid],
    enabled: !!remoteJid,
    staleTime: 1000 * 60 * 60, // 1 hour
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("evolution-proxy", {
        body: { action: "fetch-profile-picture", remoteJid },
      });
      if (error || !data?.profilePictureUrl) return null;
      return data.profilePictureUrl as string;
    },
  });
}

// Batch hook for multiple contacts
export function useContactPhotos(remoteJids: string[]) {
  return useQuery({
    queryKey: ["contact-photos", remoteJids.sort().join(",")],
    enabled: remoteJids.length > 0,
    staleTime: 1000 * 60 * 60,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("evolution-proxy", {
        body: { action: "fetch-profile-pictures", remoteJids },
      });
      if (error || !data) return {} as Record<string, string>;
      return data as Record<string, string>;
    },
  });
}
