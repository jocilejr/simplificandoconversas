import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Tag, Trash2, Hash } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

export function EmailTagsTab() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: tagsWithCount = [], isLoading } = useQuery({
    queryKey: ["email-tags-with-count"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data } = await supabase
        .from("email_contacts")
        .select("tags")
        .eq("user_id", user.id);
      if (!data) return [];

      const countMap: Record<string, number> = {};
      for (const contact of data) {
        for (const tag of (contact.tags || [])) {
          countMap[tag] = (countMap[tag] || 0) + 1;
        }
      }
      return Object.entries(countMap)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => a.name.localeCompare(b.name));
    },
  });

  const deleteTag = useMutation({
    mutationFn: async (tagName: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      // Fetch all contacts that have this tag
      const { data: contacts, error: fetchErr } = await supabase
        .from("email_contacts")
        .select("id, tags")
        .eq("user_id", user.id)
        .contains("tags", [tagName]);

      if (fetchErr) throw fetchErr;
      if (!contacts || contacts.length === 0) return;

      // Update each contact removing the tag
      for (const contact of contacts) {
        const newTags = (contact.tags || []).filter((t: string) => t !== tagName);
        await supabase
          .from("email_contacts")
          .update({ tags: newTags })
          .eq("id", contact.id);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["email-tags-with-count"] });
      qc.invalidateQueries({ queryKey: ["email-contact-tags"] });
      qc.invalidateQueries({ queryKey: ["email-contacts"] });
      toast({ title: "Tag removida de todos os contatos!" });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {tagsWithCount.length} tag{tagsWithCount.length !== 1 ? "s" : ""}
        </p>
      </div>

      {tagsWithCount.length === 0 && (
        <div className="text-center py-16">
          <Tag className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground mb-1">Nenhuma tag encontrada</p>
          <p className="text-xs text-muted-foreground">Tags são criadas automaticamente ao importar ou cadastrar contatos</p>
        </div>
      )}

      <div className="grid gap-2">
        {tagsWithCount.map((tag) => (
          <Card key={tag.name} className="border-border bg-card">
            <CardContent className="p-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-1.5 rounded-md bg-primary/10">
                  <Hash className="h-3.5 w-3.5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{tag.name}</p>
                  <p className="text-xs text-muted-foreground">{tag.count} contato{tag.count !== 1 ? "s" : ""}</p>
                </div>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remover tag "{tag.name}"?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta tag será removida de {tag.count} contato{tag.count !== 1 ? "s" : ""}. Os contatos não serão apagados, apenas a tag será removida deles.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={() => deleteTag.mutate(tag.name)}
                    >
                      {deleteTag.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Remover"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
