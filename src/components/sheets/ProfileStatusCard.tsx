import { RefreshCw, CheckCircle, AlertTriangle, Settings2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSheetProfile, type SheetProfile } from "@/hooks/useSheetProfile";
import { cn } from "@/lib/utils";

interface ProfileStatusCardProps {
  connectionId: string;
  tabName?: string;
}

export function ProfileStatusCard({ connectionId, tabName }: ProfileStatusCardProps) {
  const { profile, isLoading, revalidate, isRevalidating } = useSheetProfile({
    connectionId,
    tabName,
    enabled: !!connectionId,
  });

  if (isLoading) {
    return (
      <Card className="glass-premium border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-5 w-20" />
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </CardContent>
      </Card>
    );
  }

  if (!profile) {
    return (
      <Card className="glass-premium border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Settings2 className="w-4 h-4 text-muted-foreground" />
              Perfil da Planilha
            </CardTitle>
            <Badge variant="outline" className="text-muted-foreground">
              Não configurado
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">
            O perfil será gerado automaticamente na próxima sincronização.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => revalidate()}
            disabled={isRevalidating}
          >
            {isRevalidating ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Gerar Perfil
          </Button>
        </CardContent>
      </Card>
    );
  }

  const confidencePercent = Math.round(profile.confidence * 100);
  const isHighConfidence = profile.confidence >= 0.85;
  const isMediumConfidence = profile.confidence >= 0.7 && profile.confidence < 0.85;

  const mappedColumns = Object.keys(profile.column_mapping).filter(
    k => profile.column_mapping[k as keyof typeof profile.column_mapping]
  );

  return (
    <Card className="glass-premium border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            {isHighConfidence ? (
              <CheckCircle className="w-4 h-4 text-success" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-warning" />
            )}
            Perfil da Planilha
          </CardTitle>
          <Badge
            className={cn(
              isHighConfidence && "bg-success/10 text-success border-success/30",
              isMediumConfidence && "bg-warning/10 text-warning border-warning/30",
              !isHighConfidence && !isMediumConfidence && "bg-destructive/10 text-destructive border-destructive/30"
            )}
          >
            {confidencePercent}% confiança
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">
              Colunas Mapeadas
            </p>
            <p className="font-medium">{mappedColumns.length} detectadas</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">
              Formato de Data
            </p>
            <p className="font-medium">{profile.parsing_rules.date_format}</p>
          </div>
        </div>

        {mappedColumns.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {mappedColumns.map(col => (
              <Badge key={col} variant="secondary" className="text-xs">
                {col}: {profile.column_mapping[col as keyof typeof profile.column_mapping]}
              </Badge>
            ))}
          </div>
        )}

        {profile.from_cache && (
          <p className="text-xs text-muted-foreground">
            ✓ Usando perfil em cache
          </p>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-border/50">
          <p className="text-xs text-muted-foreground">
            {profile.skip_patterns.length} padrões de skip configurados
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => revalidate()}
            disabled={isRevalidating}
            className="h-7 text-xs"
          >
            {isRevalidating ? (
              <RefreshCw className="w-3 h-3 mr-1.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3 h-3 mr-1.5" />
            )}
            Revalidar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
