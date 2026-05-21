import { useRef, useState } from "react";
import { DemandTypeIcon } from "@/components/demands/ui/DemandTypeIcon";
import { QuickDemandForm, type QuickDemandState } from "@/components/demands/new/QuickDemandForm";
import { DemandSuccessExperience } from "@/components/demands/new/success/DemandSuccessExperience";
import { EMPTY_FORM, type DemandFormState } from "@/components/demands/new/SmartDemandForm";
import { interpretDemand } from "@/lib/demands/interpretFreeText";

export default function NewDemandPage() {
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [submittedForm, setSubmittedForm] = useState<DemandFormState>(EMPTY_FORM);
  const topRef = useRef<HTMLDivElement | null>(null);

  const scrollToTop = () => {
    requestAnimationFrame(() => {
      topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  };

  const handleCreated = (id: string, state: QuickDemandState) => {
    const interp = interpretDemand(state.description);
    setSubmittedForm({
      ...EMPTY_FORM,
      requester_name: state.requester_name,
      requester_company: state.requester_company,
      description: state.description,
      demand_type: interp.detected_type,
      priority: interp.detected_urgency,
    });
    setCreatedId(id);
    scrollToTop();
  };

  if (createdId) {
    return (
      <DemandSuccessExperience
        demandId={createdId}
        form={submittedForm}
        onNew={() => {
          setCreatedId(null);
          setSubmittedForm(EMPTY_FORM);
          scrollToTop();
        }}
      />
    );
  }

  return (
    <div
      ref={topRef}
      className="p-4 md:p-6 max-w-3xl mx-auto space-y-5 md:space-y-6 animate-fade-in"
    >
      <header className="flex items-center gap-3">
        <DemandTypeIcon kind="outro" size="lg" />
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
            Criar demanda inteligente
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Preencha seus dados e descreva sua solicitação. A equipe da CW analisará e dará andamento.
          </p>
        </div>
      </header>

      <QuickDemandForm onCreated={handleCreated} />
    </div>
  );
}
