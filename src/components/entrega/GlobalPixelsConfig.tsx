import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

const PLATFORMS = [
  { value: "meta", label: "Meta (Facebook)" },
  { value: "tiktok", label: "TikTok" },
  { value: "google", label: "Google Ads" },
  { value: "pinterest", label: "Pinterest" },
  { value: "taboola", label: "Taboola" },
];

export function GlobalPixelsConfig() {
  const { workspaceId } = useWorkspace();
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ platform: "meta", pixel_id: "", access_token: "", event_name: "Purchase" });

  const { data: pixels, isLoading } = useQuery({
    queryKey: ["global-delivery-pixels", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("global_delivery_pixels")
        .select("*")
        .eq("workspace_id", workspaceId!)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const addMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("global_delivery_pixels").insert({
        workspace_id: workspaceId!,
        ...form,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["global-delivery-pixels"] });
      setAdding(false);
      setForm({ platform: "meta", pixel_id: "", access_token: "", event_name: "Purchase" });
      toast.success("Pixel adicionado");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleMut = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("global_delivery_pixels").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["global-delivery-pixels"] }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("global_delivery_pixels").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["global-delivery-pixels"] });
      toast.success("Pixel removido");
    },
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Pixels Globais</CardTitle>
        <Button size="sm" onClick={() => setAdding(!adding)}>
          <Plus className="h-4 w-4 mr-1" /> Adicionar
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {adding && (
          <div className="border rounded-md p-4 space-y-3 bg-muted/30">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Plataforma</Label>
                <Select value={form.platform} onValueChange={(v) => setForm({ ...form, platform: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PLATFORMS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Evento</Label>
                <Input value={form.event_name} onChange={(e) => setForm({ ...form, event_name: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Pixel ID</Label>
              <Input value={form.pixel_id} onChange={(e) => setForm({ ...form, pixel_id: e.target.value })} placeholder="123456789" />
            </div>
            <div>
              <Label>Access Token (opcional)</Label>
              <Input value={form.access_token} onChange={(e) => setForm({ ...form, access_token: e.target.value })} placeholder="EAA..." />
            </div>
            <Button onClick={() => addMut.mutate()} disabled={!form.pixel_id || addMut.isPending} className="w-full">
              {addMut.isPending ? "Salvando..." : "Salvar Pixel"}
            </Button>
          </div>
        )}

        {isLoading ? (
          <div className="space-y-2">{[1, 2].map((i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
        ) : (pixels || []).length === 0 ? (
          <p className="text-center text-muted-foreground py-8">Nenhum pixel global configurado</p>
        ) : (
          <div className="space-y-2">
            {(pixels || []).map((px) => (
              <div key={px.id} className="flex items-center justify-between p-3 border rounded-md">
                <div className="flex items-center gap-3">
                  <Switch
                    checked={px.is_active}
                    onCheckedChange={(v) => toggleMut.mutate({ id: px.id, is_active: v })}
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{PLATFORMS.find((p) => p.value === px.platform)?.label || px.platform}</Badge>
                      <span className="text-sm font-mono">{px.pixel_id}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">Evento: {px.event_name}</span>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => deleteMut.mutate(px.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
