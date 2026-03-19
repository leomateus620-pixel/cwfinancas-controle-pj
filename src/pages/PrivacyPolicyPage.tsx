import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Shield } from "lucide-react";
import logoFull from "@/assets/logo-full.png";

export function PrivacyPolicyPage() {
  useEffect(() => {
    document.title = "Política de Privacidade – CW Finanças";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) {
      meta.setAttribute("content", "Política de Privacidade do CW Finanças. Saiba como seus dados são coletados, utilizados e protegidos em conformidade com a LGPD.");
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
            <Shield className="w-6 h-6 text-primary shrink-0" />
            <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">
              Política de Privacidade
            </h1>
          </div>

          <p className="text-muted-foreground leading-relaxed">
            O CW Finanças respeita a sua privacidade e se compromete com a proteção dos dados pessoais tratados em sua plataforma. Esta Política de Privacidade explica, de forma clara e transparente, como os dados são coletados, utilizados, armazenados e protegidos.
          </p>

          <Section title="1. Quem somos">
            <p>
              O CW Finanças é uma plataforma de gestão financeira desenvolvida para auxiliar usuários no controle e organização de receitas, despesas, contas, cartões e demais informações financeiras.
            </p>
          </Section>

          <Section title="2. Quais dados podemos coletar">
            <p>
              Podemos coletar dados fornecidos diretamente pelo usuário, como nome, e-mail, telefone, informações de cadastro e dados financeiros inseridos na plataforma. Também poderemos coletar dados técnicos e de navegação, como endereço IP, dispositivo utilizado, logs de acesso, cookies e informações de uso da aplicação, quando aplicável.
            </p>
          </Section>

          <Section title="3. Para que utilizamos os dados">
            <p className="mb-3">Os dados são utilizados para:</p>
            <ul className="list-disc list-inside space-y-1.5 text-muted-foreground">
              <li>permitir acesso seguro à conta;</li>
              <li>disponibilizar as funcionalidades da plataforma;</li>
              <li>processar e organizar informações financeiras cadastradas pelo usuário;</li>
              <li>prestar suporte;</li>
              <li>melhorar desempenho, segurança e experiência de uso;</li>
              <li>prevenir fraudes e incidentes;</li>
              <li>cumprir obrigações legais e regulatórias.</li>
            </ul>
          </Section>

          <Section title="4. Compartilhamento de dados">
            <p>
              Os dados poderão ser compartilhados com provedores e operadores necessários à execução da plataforma, como serviços de autenticação, infraestrutura, banco de dados, hospedagem e ferramentas essenciais ao funcionamento do sistema, além de autoridades públicas quando houver obrigação legal.
            </p>
          </Section>

          <Section title="5. Armazenamento e segurança">
            <p>
              Adotamos medidas técnicas e organizacionais razoáveis para proteger os dados pessoais contra acessos não autorizados, perda, alteração ou destruição indevida.
            </p>
          </Section>

          <Section title="6. Direitos do titular">
            <p>
              Nos termos da legislação aplicável, o titular poderá solicitar confirmação de tratamento, acesso, correção, anonimização quando cabível, portabilidade, eliminação de dados tratados com consentimento, informações sobre compartilhamento e revisão de decisões automatizadas, quando aplicável.
            </p>
          </Section>

          <Section title="7. Retenção dos dados">
            <p>
              Os dados serão armazenados pelo tempo necessário para cumprir as finalidades informadas, obrigações legais, regulatórias e exercício regular de direitos.
            </p>
          </Section>

          <Section title="8. Atualizações desta política">
            <p>
              Esta Política de Privacidade poderá ser alterada a qualquer momento para refletir melhorias da plataforma ou exigências legais. A versão atualizada ficará sempre disponível nesta página.
            </p>
          </Section>

          <Section title="9. Contato">
            <p>
              Para demandas relacionadas à privacidade e proteção de dados, entre em contato pelo e-mail:{" "}
              <a href="mailto:privacidade@cwfinancas.com.br" className="text-primary hover:underline font-medium">
                privacidade@cwfinancas.com.br
              </a>
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
          <Link to="/termos-de-uso" className="hover:text-primary hover:underline">
            Termos de Uso
          </Link>
          <span>•</span>
          <Link to="/politica-de-privacidade" className="hover:text-primary hover:underline font-medium">
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

export default PrivacyPolicyPage;
