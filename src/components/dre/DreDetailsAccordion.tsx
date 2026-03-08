import { useState } from "react";
import { ChevronDown, ChevronRight, Search, Eye, EyeOff, Building2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { formatCurrencyBR } from "@/lib/currency";
import { getSimpleLabel, getTooltip } from "./DreLabels";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { DRELine } from "@/hooks/useDRE";

interface DreDetailsAccordionProps {
  lines: DRELine[];
  viewMode?: "consolidated" | "by_nucleo";
  nucleos?: string[];
}

function formatBRL(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return formatCurrencyBR(value);
}

interface GroupedSection {
  label: string;
  simpleLabel: string;
  tooltip: string | null;
  isGroup: boolean;
  lines: DRELine[];
}

function groupLines(lines: DRELine[]): GroupedSection[] {
  const sections: GroupedSection[] = [];
  let currentSection: GroupedSection | null = null;

  for (const line of lines) {
    if (line.is_group) {
      currentSection = {
        label: line.line_label,
        simpleLabel: getSimpleLabel(line.line_label),
        tooltip: getTooltip(line.line_label),
        isGroup: true,
        lines: [],
      };
      sections.push(currentSection);
    } else if (currentSection) {
      currentSection.lines.push(line);
    } else {
      sections.push({
        label: line.line_label,
        simpleLabel: getSimpleLabel(line.line_label),
        tooltip: getTooltip(line.line_label),
        isGroup: false,
        lines: [line],
      });
    }
  }

  return sections;
}

function SectionRow({ section, searchTerm }: { section: GroupedSection; searchTerm: string }) {
  const [isOpen, setIsOpen] = useState(false);

  const filteredLines = searchTerm
    ? section.lines.filter(l =>
        l.line_label.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : section.lines;

  if (!section.isGroup) {
    const line = section.lines[0];
    if (!line) return null;
    if (searchTerm && !line.line_label.toLowerCase().includes(searchTerm.toLowerCase())) return null;

    return (
      <div className={`flex items-center justify-between py-2.5 px-4 ${line.is_subtotal ? "bg-muted/30 font-semibold" : ""}`}>
        <TooltipProvider>
          <div className="flex items-center gap-2">
            <span className={`text-sm ${line.is_subtotal ? "text-foreground" : "text-foreground/80"}`}>
              {getSimpleLabel(line.line_label)}
            </span>
            {section.tooltip && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-muted-foreground/40 text-xs cursor-help">ⓘ</span>
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-[200px] text-xs">
                  {section.tooltip}
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </TooltipProvider>
        <span className={`text-sm tabular-nums ${line.value < 0 ? "text-destructive" : ""} ${line.is_subtotal ? "font-semibold" : ""}`}>
          {formatBRL(line.value)}
        </span>
      </div>
    );
  }

  if (searchTerm && filteredLines.length === 0) return null;

  return (
    <div className="border-b border-border/30 last:border-b-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between py-3 px-4 hover:bg-muted/20 transition-colors"
      >
        <div className="flex items-center gap-2">
          {isOpen ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="text-xs font-bold text-foreground uppercase tracking-wider">
            {section.simpleLabel}
          </span>
        </div>
        {section.lines.some(l => l.is_subtotal) && (
          <span className="text-xs font-semibold tabular-nums text-muted-foreground">
            {formatBRL(section.lines.find(l => l.is_subtotal)?.value)}
          </span>
        )}
      </button>
      {isOpen && (
        <div className="pb-2 animate-fade-in-up">
          {filteredLines.map((line) => (
            <div
              key={line.id}
              className={`flex items-center justify-between py-2 px-4 pl-10 ${line.is_subtotal ? "bg-muted/20 font-semibold border-t border-border/20" : ""}`}
            >
              <span className={`text-sm ${line.is_subtotal ? "text-foreground" : "text-foreground/70"}`}>
                {getSimpleLabel(line.line_label)}
              </span>
              <span className={`text-sm tabular-nums ${line.value < 0 ? "text-destructive" : ""} ${line.is_subtotal ? "font-semibold" : ""}`}>
                {formatBRL(line.value)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function NucleoBlock({ nucleo, lines, searchTerm }: { nucleo: string; lines: DRELine[]; searchTerm: string }) {
  const [isOpen, setIsOpen] = useState(true);
  const sections = groupLines(lines);

  return (
    <div className="border border-border/30 rounded-xl overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between py-3 px-5 bg-primary/5 hover:bg-primary/10 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-primary" />
          <span className="text-sm font-bold text-foreground uppercase tracking-wider">
            {nucleo}
          </span>
          <span className="text-xs text-muted-foreground">
            ({lines.length} linhas)
          </span>
        </div>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? "" : "-rotate-90"}`} />
      </button>
      {isOpen && (
        <div className="animate-fade-in-up">
          {sections.map((section, idx) => (
            <SectionRow key={`${section.label}-${idx}`} section={section} searchTerm={searchTerm} />
          ))}
        </div>
      )}
    </div>
  );
}

export function DreDetailsAccordion({ lines, viewMode = "consolidated", nucleos = [] }: DreDetailsAccordionProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const isByNucleo = viewMode === "by_nucleo" && nucleos.length > 0;

  return (
    <div className="liquid-glass overflow-hidden">
      <button
        onClick={() => setIsVisible(!isVisible)}
        className="w-full flex items-center justify-between p-5 hover:bg-muted/10 transition-colors"
      >
        <div className="flex items-center gap-2">
          {isVisible ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
          <span className="text-sm font-semibold text-foreground">
            {isVisible ? "Ocultar detalhamento" : "Ver detalhamento completo"}
          </span>
        </div>
        <span className="text-xs text-muted-foreground">
          {lines.length} linhas{isByNucleo ? ` · ${nucleos.length} núcleos` : ""}
        </span>
      </button>

      {isVisible && (
        <div className="border-t border-border/20 animate-fade-in-up">
          <div className="p-4 pb-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar na DRE..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9 text-sm bg-background/50"
              />
            </div>
          </div>

          {isByNucleo ? (
            <div className="p-4 pt-2 space-y-4 max-h-[600px] overflow-y-auto">
              {nucleos.map((nucleo) => {
                const nucleoLines = lines.filter(l => l.nucleo === nucleo);
                if (nucleoLines.length === 0) return null;
                return (
                  <NucleoBlock
                    key={nucleo}
                    nucleo={nucleo}
                    lines={nucleoLines}
                    searchTerm={searchTerm}
                  />
                );
              })}
            </div>
          ) : (
            <div className="max-h-[500px] overflow-y-auto">
              {groupLines(lines).map((section, idx) => (
                <SectionRow key={`${section.label}-${idx}`} section={section} searchTerm={searchTerm} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
