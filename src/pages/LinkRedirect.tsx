import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const LinkRedirect = () => {
  const { code } = useParams<{ code: string }>();
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!code) return;

    const processRedirect = async () => {
      try {
        // Call the edge function to process the click and get the redirect URL
        const resp = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/link-redirect?code=${code}`,
          { redirect: "manual" }
        );

        // The edge function returns a 302 redirect
        const location = resp.headers.get("location");
        if (location) {
          window.location.href = location;
        } else {
          // Fallback: try to get the URL directly
          const { data } = await supabase
            .from("tracked_links")
            .select("original_url")
            .eq("short_code", code)
            .single();

          if (data?.original_url) {
            window.location.href = data.original_url;
          } else {
            setError(true);
          }
        }
      } catch {
        setError(true);
      }
    };

    processRedirect();
  }, [code]);

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center space-y-2">
          <h1 className="text-xl font-bold">Link não encontrado</h1>
          <p className="text-muted-foreground text-sm">Este link é inválido ou expirou.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center h-screen bg-background">
      <div className="text-center space-y-3">
        <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full mx-auto" />
        <p className="text-sm text-muted-foreground">Redirecionando...</p>
      </div>
    </div>
  );
};

export default LinkRedirect;
