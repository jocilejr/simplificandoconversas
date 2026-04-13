import { useState, useEffect } from "react";
import { Link2, Copy, RefreshCw, Users, MousePointerClick, CheckCircle2, XCircle, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useGroupSmartLinks, type GroupLink } from "@/hooks/useGroupSmartLinks";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  campaign: any;
}

export default function GroupSmartLinkDialog({ open, onOpenChange, campaign }: Props) {
  const { toast } = useToast();
  const campaignId = campaign?.id;
  const { smartLink, isLoading, stats, createSmartLink, updateSmartLink, deleteSmartLink, syncInviteLinks } = useGroupSmartLinks(campaignId);

  const [slug, setSlug] = useState("");
  const [maxMembers, setMaxMembers] = useState(200);

  useEffect(() => {
    if (smartLink) {
      setSlug(smartLink.slug);
      setMaxMembers(smartLink.max_members_per_group);
    } else if (campaign) {
      setSlug(campaign.name?.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "");
      setMaxMembers(200);
    }
  }, [smartLink, campaign]);

  if (!campaign) return null;

  const baseUrl = window.location.origin;
  const publicUrl = `${baseUrl}/r/${slug}`;

  const handleSave = () => {
    if (!slug.trim()) {
      toast({ title: "Slug é obrigatório", variant: "destructive" });
      return;
    }
    if (smartLink) {
      updateSmartLink.mutate({ id: smartLink.id, slug, maxMembersPerGroup: maxMembers });
    } else {
      createSmartLink.mutate({ slug, maxMembersPerGroup: maxMembers, campaignId });
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(publicUrl);
    toast({ title: "URL copiada!" });
  };

  const groupLinks: GroupLink[] = smartLink?.group_links || [];
  const totalClicks = stats?.totalClicks || 0;
  const byGroup: Record<string, number> = stats?.byGroup || {};

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Smart Link — {campaign.name}
          </DialogTitle>
          <DialogDescription>
            Link inteligente que distribui automaticamente entre os grupos da campanha.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Config */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Slug</Label>
              <Input value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} placeholder="meu-link" />
            </div>
            <div className="space-y-1.5">
              <Label>Máx. membros/grupo</Label>
              <Input type="number" value={maxMembers} onChange={(e) => setMaxMembers(Number(e.target.value))} min={1} />
            </div>
          </div>

          {/* Public URL */}
          {smartLink && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border">
              <Link2 className="h-4 w-4 text-muted-foreground shrink-0" />
              <code className="text-sm flex-1 truncate">{publicUrl}</code>
              <Button size="sm" variant="outline" onClick={handleCopy} className="shrink-0">
                <Copy className="h-3.5 w-3.5 mr-1" /> Copiar
              </Button>
            </div>
          )}

          {/* Stats */}
          {smartLink && (
            <div className="grid grid-cols-2 gap-3">
              <Card>
                <CardContent className="p-3 flex items-center gap-3">
                  <MousePointerClick className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-lg font-bold">{totalClicks}</p>
                    <p className="text-xs text-muted-foreground">Cliques totais</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 flex items-center gap-3">
                  <Users className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-lg font-bold">{groupLinks.length}</p>
                    <p className="text-xs text-muted-foreground">Grupos vinculados</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Groups Table */}
          {smartLink && groupLinks.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Grupos</Label>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => syncInviteLinks.mutate(smartLink.id)}
                  disabled={syncInviteLinks.isPending}
                  className="text-xs"
                >
                  <RefreshCw className={`h-3.5 w-3.5 mr-1 ${syncInviteLinks.isPending ? "animate-spin" : ""}`} />
                  Sincronizar URLs
                </Button>
              </div>
              <div className="rounded-md border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Grupo</TableHead>
                      <TableHead className="text-center w-20">Membros</TableHead>
                      <TableHead className="text-center w-20">Cliques</TableHead>
                      <TableHead className="text-center w-16">URL</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groupLinks.map((gl) => (
                      <TableRow key={gl.group_jid}>
                        <TableCell className="text-sm truncate max-w-[200px]">{gl.group_name || gl.group_jid}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant={(gl.member_count || 0) >= maxMembers ? "destructive" : "secondary"} className="text-xs">
                            {gl.member_count || 0}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center text-sm">{byGroup[gl.group_jid] || 0}</TableCell>
                        <TableCell className="text-center">
                          {gl.invite_url ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" />
                          ) : (
                            <XCircle className="h-4 w-4 text-muted-foreground mx-auto" />
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-2">
            {smartLink ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-destructive">
                    <Trash2 className="h-3.5 w-3.5 mr-1" /> Excluir
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir Smart Link?</AlertDialogTitle>
                    <AlertDialogDescription>O link público parará de funcionar imediatamente.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => { deleteSmartLink.mutate(smartLink.id); onOpenChange(false); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : (
              <div />
            )}
            <Button onClick={handleSave} disabled={createSmartLink.isPending || updateSmartLink.isPending}>
              {smartLink ? "Salvar alterações" : "Criar Smart Link"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
