import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Plus, Upload, Tag } from "lucide-react";

const Contacts = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Contatos</h1>
          <p className="text-muted-foreground">Gerencie seus contatos e listas</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Upload className="h-4 w-4 mr-1" /> Importar CSV
          </Button>
          <Button size="sm">
            <Plus className="h-4 w-4 mr-1" /> Novo Contato
          </Button>
        </div>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar contatos..." className="pl-9" />
        </div>
        <Button variant="outline" size="icon">
          <Tag className="h-4 w-4" />
        </Button>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-lg">Lista de Contatos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground text-center py-8">
            Nenhum contato cadastrado ainda. Importe um CSV ou adicione manualmente.
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Contacts;
