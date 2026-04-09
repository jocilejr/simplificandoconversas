import { Package, Eye } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProductsTab } from "@/components/entrega/ProductsTab";
import { AccessesTab } from "@/components/entrega/AccessesTab";

const EntregaDigital = () => (
  <div className="space-y-6">
    <div>
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <Package className="h-6 w-6" /> Entrega Digital
      </h1>
      <p className="text-muted-foreground text-sm mt-1">
        Gerencie produtos digitais e acompanhe acessos
      </p>
    </div>

    <Tabs defaultValue="produtos" className="space-y-4">
      <TabsList>
        <TabsTrigger value="produtos" className="gap-1.5">
          <Package className="h-4 w-4" /> Produtos
        </TabsTrigger>
        <TabsTrigger value="acessos" className="gap-1.5">
          <Eye className="h-4 w-4" /> Acessos
        </TabsTrigger>
      </TabsList>

      <TabsContent value="produtos">
        <ProductsTab />
      </TabsContent>
      <TabsContent value="acessos">
        <AccessesTab />
      </TabsContent>
    </Tabs>
  </div>
);

export default EntregaDigital;
