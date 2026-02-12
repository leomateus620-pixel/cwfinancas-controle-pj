import { useNavigate } from "react-router-dom";
import { FileSpreadsheet, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

export function HomeEmptyState() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 animate-float">
        <FileSpreadsheet className="w-8 h-8 text-primary/50" />
      </div>
      <h2 className="text-foreground/80 text-lg font-semibold mb-2">
        Seus indicadores financeiros aparecerão aqui
      </h2>
      <p className="text-muted-foreground text-sm max-w-md mb-8">
        Assim que os dados forem importados, você verá seu resumo financeiro diário com KPIs, alertas e insights automáticos.
      </p>
      <div className="flex gap-3">
        <Button
          onClick={() => navigate("/google-sheets")}
          className="bg-primary/10 hover:bg-primary/15 text-primary border border-primary/15 hover:border-primary/25"
        >
          <FileSpreadsheet className="w-4 h-4 mr-2" />
          Conectar Planilha
        </Button>
        <Button
          variant="ghost"
          onClick={() => navigate("/upload")}
          className="text-muted-foreground hover:text-foreground hover:bg-foreground/5"
        >
          <Upload className="w-4 h-4 mr-2" />
          Importar Arquivo
        </Button>
      </div>
    </div>
  );
}
