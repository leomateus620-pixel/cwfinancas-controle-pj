import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, FileText } from "lucide-react";
import logoFull from "@/assets/logo-full.png";

export function TermsOfUsePage() {
  useEffect(() => {
    document.title = "Termos de Uso – CW Finanças";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) {
      meta.setAttribute("content", "Termos de Uso do CW Finanças. Conheça as regras de uso da plataforma de gestão financeira.");
    }
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-8 md:py-12">
        {/* Header */}
        <div className="flex flex-col items-center mb-8">
          <Link to="/">
            <img src={logoFull} alt="CW Finanças" className="h-14 object-contain mb-4" />
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar ao início
          </Link>
        </div>

        {/* Content */}
        <article className="liquid-glass rounded-2xl p-6 md:p-10 space-y-8">
          <div className="flex items-center gap-3 mb-2">
            <FileText className="w-6 h-6 text-primary shrink-0" />
            <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">
              Termos de Uso
            </h1>
          </div>

          <p className="text-muted-foreground leading-relaxed">
            Ao acessar ou utilizar o CW Finanças, o usuário declara ter lido, compreendido e aceito estes Termos de Uso.
          </p>

          <Section title="1. Objeto">
            <p>
              O CW Finanças é uma plataforma digital destinada ao apoio da gestão financeira, permitindo organização, registro, visualização e acompanhamento de informações financeiras.
            </p>
          </Section>

          <Section title="2. Cadastro e acesso">
            <p>
              O usuário é responsável por fornecer informações corretas, atualizadas e completas, bem como por manter a confidencialidade de suas credenciais de acesso.
            </p>
          </Section>

          <Section title="3. Uso permitido">
            <p className="mb-3">
              O usuário compromete-se a utilizar a plataforma de forma lícita, ética e em conformidade com a legislação vigente, sendo vedado:
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-muted-foreground">
              <li>praticar fraudes;</li>
              <li>tentar acessar áreas restritas sem autorização;</li>
              <li>explorar falhas de segurança;</li>
              <li>copiar, reproduzir ou modificar indevidamente a plataforma;</li>
              <li>utilizar o sistema para fins ilícitos.</li>
            </ul>
          </Section>

          <Section title="4. Responsabilidades do usuário">
            <p>
              O usuário é integralmente responsável pelos dados inseridos na plataforma e pelo uso realizado em sua conta.
            </p>
          </Section>

          <Section title="5. Disponibilidade da plataforma">
            <p>
              O CW Finanças buscará manter a plataforma em funcionamento contínuo, mas poderá realizar atualizações, manutenções e correções que eventualmente causem indisponibilidade temporária.
            </p>
          </Section>

          <Section title="6. Limitação de responsabilidade">
            <p>
              Sem prejuízo do que determina a legislação aplicável, o CW Finanças não se responsabiliza por falhas decorrentes de fatores externos, uso inadequado da plataforma pelo usuário, indisponibilidade de serviços de terceiros ou eventos fora de seu controle razoável.
            </p>
          </Section>

          <Section title="7. Propriedade intelectual">
            <p>
              Todo o conteúdo, estrutura, interface, marca, elementos visuais, textos, funcionalidades e código relacionados à plataforma são protegidos pela legislação aplicável, sendo vedado seu uso sem autorização.
            </p>
          </Section>

          <Section title="8. Privacidade e dados pessoais">
            <p>
              O tratamento de dados pessoais observará a Política de Privacidade da plataforma, disponível em:{" "}
              <Link to="/politica-de-privacidade" className="text-primary hover:underline font-medium">
                https://cwfinancas-controle-pj.lovable.app/politica-de-privacidade
              </Link>
            </p>
          </Section>

          <Section title="9. Suspensão e encerramento">
            <p>
              O acesso do usuário poderá ser suspenso ou encerrado em caso de violação destes Termos, indícios de fraude, uso indevido da plataforma ou necessidade de proteção da operação.
            </p>
          </Section>

          <Section title="10. Legislação aplicável">
            <p>
              Estes Termos serão interpretados conforme a legislação brasileira.
            </p>
          </Section>

          <Section title="11. Foro">
            <p>
              Fica eleito o foro da comarca competente no Brasil, conforme a legislação aplicável, para dirimir eventuais controvérsias.
            </p>
          </Section>

          <div className="pt-4 border-t border-border/50">
            <p className="text-sm text-muted-foreground">
              Última atualização: 19 de março de 2026
            </p>
          </div>
        </article>

        {/* Footer links */}
        <div className="flex items-center justify-center gap-4 mt-8 text-xs text-muted-foreground">
          <Link to="/termos-de-uso" className="hover:text-primary hover:underline font-medium">
            Termos de Uso
          </Link>
          <span>•</span>
          <Link to="/politica-de-privacidade" className="hover:text-primary hover:underline">
            Política de Privacidade
          </Link>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <div className="text-muted-foreground leading-relaxed">{children}</div>
    </section>
  );
}

export default TermsOfUsePage;
