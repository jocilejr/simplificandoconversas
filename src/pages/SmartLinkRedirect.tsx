import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Loader2, AlertCircle } from "lucide-react";
import { apiUrl } from "@/lib/api";

export default function SmartLinkRedirect() {
  const { slug } = useParams<{ slug: string }>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) { setError("Link inválido"); setLoading(false); return; }

    fetch(apiUrl(`groups/smart-link-redirect?slug=${encodeURIComponent(slug)}`))
      .then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({ error: "Erro desconhecido" }));
          throw new Error(body.error || "Link não encontrado");
        }
        return r.json();
      })
      .then((data) => {
        if (data.redirect_url) {
          window.location.href = data.redirect_url;
        } else {
          setError("Nenhum grupo disponível no momento.");
          setLoading(false);
        }
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [slug]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="text-center space-y-4 max-w-md">
        {loading ? (
          <>
            <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
            <p className="text-muted-foreground">Redirecionando para o grupo...</p>
          </>
        ) : (
          <>
            <AlertCircle className="h-10 w-10 text-destructive mx-auto" />
            <h1 className="text-lg font-semibold">Ops!</h1>
            <p className="text-muted-foreground">{error}</p>
          </>
        )}
      </div>
    </div>
  );
}
