import { useMemo } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, ExternalLink, FileText, Image as ImageIcon, Link as LinkIcon, Lock, PlayCircle, Smartphone, Volume2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiUrl, safeJsonResponse } from "@/lib/api";
import { normalizePhone } from "@/lib/normalizePhone";

interface MemberAccessMaterial {
  id: string;
  product_id: string;
  category_id: string | null;
  title: string;
  description: string | null;
  content_type: string;
  content_url: string | null;
  content_text: string | null;
  button_label: string | null;
  sort_order: number;
}

interface MemberAccessCategory {
  id: string;
  product_id: string;
  name: string;
  icon: string | null;
  description: string | null;
  sort_order: number;
}

interface MemberAccessProduct {
  id: string;
  name: string;
  slug: string;
  member_cover_image: string | null;
  member_description: string | null;
  page_logo: string | null;
  categories: MemberAccessCategory[];
  materials: MemberAccessMaterial[];
}

interface MemberAccessResponse {
  phone: string;
  settings: {
    title: string;
    logo_url: string | null;
    welcome_message: string | null;
  } | null;
  products: MemberAccessProduct[];
}

const materialMeta: Record<string, { icon: typeof FileText; label: string }> = {
  text: { icon: FileText, label: "Texto" },
  pdf: { icon: FileText, label: "PDF" },
  video: { icon: PlayCircle, label: "Vídeo" },
  image: { icon: ImageIcon, label: "Imagem" },
  audio: { icon: Volume2, label: "Áudio" },
};

function MaterialCard({ material }: { material: MemberAccessMaterial }) {
  const meta = materialMeta[material.content_type] || { icon: LinkIcon, label: material.content_type };
  const Icon = meta.icon;

  return (
    <Card className="border-border/60 shadow-none">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <Icon className="h-4 w-4 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">{material.title}</CardTitle>
                <p className="text-xs text-muted-foreground">{meta.label}</p>
              </div>
            </div>
            {material.description && <p className="text-sm text-muted-foreground">{material.description}</p>}
          </div>
          <Badge variant="outline">{meta.label}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {material.content_type === "text" && material.content_text && (
          <div className="rounded-xl border border-border/60 bg-muted/30 p-4 text-sm whitespace-pre-wrap leading-relaxed text-foreground">
            {material.content_text}
          </div>
        )}

        {material.content_type === "image" && material.content_url && (
          <img
            src={material.content_url}
            alt={material.title}
            className="w-full rounded-xl border border-border/60 object-cover"
            loading="lazy"
          />
        )}

        {material.content_type === "audio" && material.content_url && (
          <audio controls className="w-full">
            <source src={material.content_url} />
          </audio>
        )}

        {material.content_url && material.content_type !== "image" && material.content_type !== "audio" && (
          <Button asChild className="w-full sm:w-auto">
            <a href={material.content_url} target="_blank" rel="noreferrer noopener">
              <ExternalLink className="mr-2 h-4 w-4" />
              {material.button_label || "Abrir conteúdo"}
            </a>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export default function MemberAccess() {
  const { phone } = useParams<{ phone: string }>();
  const normalizedPhone = useMemo(() => normalizePhone(phone), [phone]);

  const { data, isLoading, error } = useQuery<MemberAccessResponse>({
    queryKey: ["member-access-public", normalizedPhone],
    enabled: normalizedPhone !== "-",
    queryFn: async () => {
      const response = await fetch(apiUrl(`member-access/${normalizedPhone}`));
      const payload = await safeJsonResponse(response);
      if (!response.ok) {
        throw new Error(payload?.error || "Não foi possível carregar o acesso");
      }
      return payload as MemberAccessResponse;
    },
  });

  if (normalizedPhone === "-") {
    return (
      <div className="min-h-screen bg-background px-4 py-16">
        <div className="mx-auto max-w-xl">
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <Lock className="h-8 w-8 text-muted-foreground" />
              <div>
                <h1 className="text-xl font-semibold">Link inválido</h1>
                <p className="text-sm text-muted-foreground">O telefone informado não é válido.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background px-4 py-16">
        <div className="mx-auto max-w-3xl space-y-4">
          <div className="h-10 w-48 animate-pulse rounded-lg bg-muted" />
          <div className="h-40 animate-pulse rounded-2xl bg-muted" />
          <div className="h-64 animate-pulse rounded-2xl bg-muted" />
        </div>
      </div>
    );
  }

  if (error || !data?.products?.length) {
    return (
      <div className="min-h-screen bg-background px-4 py-16">
        <div className="mx-auto max-w-xl">
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <Lock className="h-8 w-8 text-muted-foreground" />
              <div>
                <h1 className="text-xl font-semibold">Acesso não encontrado</h1>
                <p className="text-sm text-muted-foreground">{error instanceof Error ? error.message : "Nenhum conteúdo disponível para este telefone."}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-8">
        <section className="overflow-hidden rounded-[2rem] border border-border/60 bg-card shadow-sm">
          <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-end">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                {data.settings?.logo_url ? (
                  <img src={data.settings.logo_url} alt={data.settings.title || "Área de membros"} className="h-12 w-12 rounded-xl border border-border/60 object-cover" loading="lazy" />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                    <BookOpen className="h-5 w-5 text-primary" />
                  </div>
                )}
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Área de membros</p>
                  <h1 className="text-3xl font-semibold tracking-tight">{data.settings?.title || "Seu acesso está liberado"}</h1>
                </div>
              </div>
              <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
                {data.settings?.welcome_message || "Acesse abaixo os produtos e materiais liberados para este número."}
              </p>
            </div>

            <div className="flex items-center gap-2 self-start lg:self-end">
              <Badge variant="outline" className="px-3 py-1 text-xs">
                <Smartphone className="mr-1.5 h-3.5 w-3.5" />
                {data.phone}
              </Badge>
            </div>
          </div>
        </section>

        <section className="space-y-6">
          {data.products.map((product) => {
            const categories = product.categories.length
              ? product.categories
              : [{ id: "uncategorized", product_id: product.id, name: "Conteúdo", icon: "📚", description: null, sort_order: 0 }];

            return (
              <Card key={product.id} className="overflow-hidden border-border/60 shadow-sm">
                {(product.member_cover_image || product.page_logo) && (
                  <div className="relative h-52 overflow-hidden border-b border-border/60 bg-muted/20">
                    <img
                      src={product.member_cover_image || product.page_logo || ""}
                      alt={product.name}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  </div>
                )}

                <CardContent className="space-y-6 p-6 sm:p-8">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge>{product.name}</Badge>
                      {product.slug && <Badge variant="outline">/{product.slug}</Badge>}
                    </div>
                    {product.member_description && (
                      <p className="text-sm leading-relaxed text-muted-foreground">{product.member_description}</p>
                    )}
                  </div>

                  <div className="space-y-6">
                    {categories.map((category) => {
                      const materials = product.materials.filter((material) => material.category_id === category.id || (!material.category_id && category.id === "uncategorized"));
                      if (!materials.length) return null;

                      return (
                        <section key={category.id} className="space-y-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-lg leading-none">{category.icon || "📚"}</span>
                              <h2 className="text-lg font-semibold tracking-tight">{category.name}</h2>
                            </div>
                            {category.description && <p className="text-sm text-muted-foreground">{category.description}</p>}
                          </div>

                          <div className="grid gap-4">
                            {materials.map((material) => (
                              <MaterialCard key={material.id} material={material} />
                            ))}
                          </div>
                        </section>
                      );
                    })}

                    {!product.materials.length && (
                      <div className="rounded-2xl border border-dashed border-border/60 bg-muted/20 p-6 text-sm text-muted-foreground">
                        Este produto ainda não possui materiais publicados.
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </section>
      </div>
    </main>
  );
}