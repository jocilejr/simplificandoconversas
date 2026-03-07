import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";

export function useContactPhoto(remoteJid: string | null) {
  return useQuery({
    queryKey: ["contact-photo", remoteJid],
    enabled: !!remoteJid,
    staleTime: 1000 * 60 * 60,
    retry: false,
    queryFn: async () => {
      // Try cached first
      const { data: cached } = await supabase
        .from("contact_photos")
        .select("photo_url")
        .eq("remote_jid", remoteJid!)
        .maybeSingle();
      if (cached?.photo_url) return cached.photo_url;

      // Fallback to Baileys API
      const { data, error } = await supabase.functions.invoke("whatsapp-proxy", {
        body: { action: "fetch-profile-picture", remoteJid },
      });
      if (error || !data?.profilePictureUrl) return null;

      // Persist
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("contact_photos").upsert(
          { user_id: user.id, remote_jid: remoteJid!, photo_url: data.profilePictureUrl, updated_at: new Date().toISOString() },
          { onConflict: "user_id,remote_jid" }
        );
      }
      return data.profilePictureUrl as string;
    },
  });
}

// Batch hook for multiple contacts — cache-first with background refresh
export function useContactPhotos(remoteJids: string[]) {
  const queryClient = useQueryClient();
  const key = remoteJids.sort().join(",");

  // Primary query: load from DB cache instantly
  const query = useQuery({
    queryKey: ["contact-photos", key],
    enabled: remoteJids.length > 0,
    staleTime: 1000 * 60 * 60,
    retry: false,
    queryFn: async () => {
      const { data } = await supabase
        .from("contact_photos")
        .select("remote_jid, photo_url")
        .in("remote_jid", remoteJids);

      const map: Record<string, string> = {};
      (data || []).forEach((row) => {
        map[row.remote_jid] = row.photo_url;
      });
      return map;
    },
  });

  // Background refresh from Evolution API
  useEffect(() => {
    if (!remoteJids.length || query.isLoading) return;

    const uncached = remoteJids.filter((jid) => !(query.data || {})[jid]);
    if (uncached.length === 0) return;

    let cancelled = false;

    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("evolution-proxy", {
          body: { action: "fetch-profile-pictures", remoteJids: uncached },
        });
        if (cancelled || error || !data) return;

        const photos = data as Record<string, string>;
        const entries = Object.entries(photos).filter(([, url]) => !!url);
        if (entries.length === 0) return;

        const { data: { user } } = await supabase.auth.getUser();
        if (!user || cancelled) return;

        // Upsert all new photos
        const rows = entries.map(([jid, url]) => ({
          user_id: user.id,
          remote_jid: jid,
          photo_url: url,
          updated_at: new Date().toISOString(),
        }));

        await supabase.from("contact_photos").upsert(rows, { onConflict: "user_id,remote_jid" });

        // Update cache
        queryClient.setQueryData(["contact-photos", key], (old: Record<string, string> | undefined) => ({
          ...(old || {}),
          ...photos,
        }));
      } catch {
        // Silently fail — cached photos remain
      }
    })();

    return () => { cancelled = true; };
  }, [remoteJids.length, query.isLoading]);

  return query;
}
