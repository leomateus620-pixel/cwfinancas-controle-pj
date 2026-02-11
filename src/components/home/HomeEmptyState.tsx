import { useNavigate } from "react-router-dom";
import { FileSpreadsheet, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

export function HomeEmptyState() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-6 animate-float">
        <FileSpreadsheet className="w-8 h-8 text-white/30" />
      </div>
      <h2 className="text-white/80 text-lg font-semibold mb-2">
        Seus indicadores financeiros aparecerão aqui
      </h2>
      <p className="text-white/40 text-sm max-w-md mb-8">
        Assim que os dados forem importados, você verá seu resumo financeiro diário com KPIs, alertas e insights automáticos.
      </p>
      <div className="flex gap-3">
        <Button
          onClick={() => navigate("/google-sheets")}
          className="bg-white/10 hover:bg-white/15 text-white border border-white/10 hover:border-white/20"
        >
          <FileSpreadsheet className="w-4 h-4 mr-2" />
          Conectar Planilha
        </Button>
        <Button
          variant="ghost"
          onClick={() => navigate("/upload")}
          className="text-white/50 hover:text-white/80 hover:bg-white/5"
        >
          <Upload className="w-4 h-4 mr-2" />
          Importar Arquivo
        </Button>
      </div>
    </div>
  );
}
