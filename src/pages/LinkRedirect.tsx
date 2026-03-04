import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

const LinkRedirect = () => {
  const { code } = useParams<{ code: string }>();
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!code) {
      setError(true);
      return;
    }

    // Redirect to the edge function which handles click processing and redirect
    const edgeFunctionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/link-redirect?code=${code}`;
    window.location.href = edgeFunctionUrl;
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
