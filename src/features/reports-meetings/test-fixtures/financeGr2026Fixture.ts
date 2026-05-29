import type { WorkbookSnapshot } from "../lib/financialWorkbook";

export const financeGr2026WorkbookFixture: WorkbookSnapshot = {
  sourceName: "Financeiro GR - 2026 (1).xlsx",
  provider: "fixture",
  fetchedAt: "2026-05-29T00:00:00.000Z",
  audit: [
    "Fixture de teste criada a partir da planilha Financeiro GR - 2026 (1).xlsx.",
    "Contem multiplas abas mensais e um recorte DRE-Caixa para validar o contrato da integracao real.",
  ],
  sheets: [
    {
      name: "Jan2026",
      rows: [
        ["Data", "Conta", "Categoria", "Descricao", "NF", "Valor", "Observacao"],
        ["2-Jan", "Sicredi", "Receitas", "RECEBIMENTO PIX Vera Lucia", "383", "R$ 2,348.00", null],
        ["2-Jan", "Sicredi", "RPAs", "PAGAMENTO PIX Bruna Belinaso", null, "-R$ 3,560.00", null],
        ["2-Jan", "Sicredi", "Pro-labore Giovanni", "PAGAMENTO PIX Giovanni", null, "-R$ 3,377.55", null],
        ["2-Jan", "Sicredi", "Distribuicao mensal Giovanni", "PAGAMENTO PIX Giovanni", null, "-R$ 4,000.00", null],
        ["5-Jan", "Sicredi", "Receitas", "JOSE HERMES", "384", "R$ 4,107.00", null],
      ],
    },
    {
      name: "Fev2026",
      rows: [
        ["Data", "Conta", "Categoria", "Descricao", "NF", "Valor", "Observacao"],
        ["2-Feb", "Sicredi", "Receitas", "Amanda Santos Pereira", "395", "R$ 2,000.00", null],
        ["2-Feb", "Sicredi", "Receitas", "Amanda Santos Pereira", "395", "R$ 2,606.60", "atrasada de janeiro"],
        ["3-Feb", "Sicredi", "RPAs", "PAGAMENTO PIX Bruna Belinaso", null, "-R$ 3,560.00", null],
        ["3-Feb", "Sicredi", "Pro-labore Amanda", "PAGAMENTO PIX Amanda", null, "-R$ 3,606.76", null],
        ["7-Feb", "Sicredi", "Receitas", "JOSE HERMES", "396", "R$ 4,107.00", null],
      ],
    },
    {
      name: "Mar2026",
      rows: [
        ["Data", "Conta", "Categoria", "Descricao", "NF", "Valor", "Observacao"],
        ["2-Mar", "Sicredi", "Receita RT", "RECEBIMENTO PIX INES MARIA", "409", "R$ 577.54", null],
        ["2-Mar", "Sicredi", "Material de escritorio", "PAGAMENTO PIX BELA CASA", null, "-R$ 376.00", "vasos decor"],
        ["2-Mar", "Sicredi", "RPAs", "PAGAMENTO PIX Bruna Belinaso", null, "-R$ 3,801.73", "RPA"],
        ["2-Mar", "Sicredi", "Social Media", "PAGAMENTO PIX agencia social", null, "-R$ 650.00", "social midia"],
        ["10-Mar", "Sicredi", "Receitas", "Fabio e Camila", "417", "R$ 6,000.00", null],
      ],
    },
    {
      name: "Abr2026",
      rows: [
        ["Data", "Conta", "Categoria", "Descricao", "NF", "Valor", "Observacao"],
        ["1-Apr", "Sicredi", "Pro-labore Amanda", "PAGAMENTO PIX Amanda", null, "-R$ 3,606.73", "pro labore"],
        ["1-Apr", "Sicredi", "Distribuicao mensal Giovanni", "PAGAMENTO PIX Giovanni", null, "-R$ 3,606.73", "Distribuicao mensal"],
        ["2-Apr", "Sicredi", "Receitas", "JOSE HERMES", "428", "R$ 4,107.00", "428"],
        ["9-Apr", "Sicredi", "Receitas", "Fabio e Camila", "431", "R$ 6,000.00", null],
        ["18-Apr", "Sicredi", "Simples Nacional", "DAS simples", null, "-R$ 6,099.20", null],
      ],
    },
    {
      name: "Mai2026",
      rows: [
        ["Data", "Conta", "Categoria", "Descricao", "NF", "Valor", "Observacao"],
        ["4-May", "Sicredi", "Material de escritorio", "PAGAMENTO PIX PAGGO SOLUCOES", null, "-R$ 295.40", null],
        ["4-May", "Sicredi", "Consultorias", "PAGAMENTO PIX Eduardo Vianna", null, "-R$ 950.00", "Consultoria GR Estudio pt1"],
        ["4-May", "Sicredi", "Pro-labore Giovanni", "PAGAMENTO PIX Giovanni", null, "-R$ 3,606.73", null],
        ["4-May", "Sicredi", "RPAs", "PAGAMENTO PIX Bruna Belinaso", null, "-R$ 3,801.73", null],
        ["4-May", "Sicredi", "RPAs", "PAGAMENTO PIX Liara Santos", null, "-R$ 3,255.23", null],
        ["4-May", "Sicredi", "Distribuicao mensal Giovanni", "PAGAMENTO PIX Giovanni", null, "-R$ 4,000.00", null],
        ["8-May", "Sicredi", "Receitas", "Fabio e Camila", "445", "R$ 6,000.00", null],
        ["12-May", "Sicredi", "Receitas", "JOSE HERMES", "446", "R$ 4,107.00", null],
        ["16-May", "Sicredi", "Receitas", "Alberto Wachter", "447", "R$ 5,270.00", null],
        ["20-May", "Sicredi", "Receitas", "Casarin", "448", "R$ 5,370.00", null],
        ["24-May", "Sicredi", "Distribuicao Giovanni apos lucro", "Transferencia socios", null, "-R$ 12,000.00", null],
        ["27-May", "Sicredi", "Transferencia interna", "Reserva operacional", null, "-R$ 5,000.00", null],
      ],
    },
    {
      name: "DRE-Caixa",
      rows: [
        [null, "Jan-26", "Feb-26", "Mar-26", "Apr-26", "May-26", "TOTAL"],
        ["FATURAMENTO", "R$ 30,729.00", "R$ 57,058.40", "R$ 63,511.80", "R$ 33,405.45", "R$ -", "R$ 184,704.65"],
        ["Receitas", "R$ 30,729.00", "R$ 57,058.40", "R$ 63,511.80", "R$ 33,405.45", "R$ -", "R$ 184,704.65"],
        ["DEDUCOES", "-R$ 3,829.50", "-R$ 2,773.04", "-R$ 4,856.38", "-R$ 6,099.20", "R$ -", "-R$ 17,558.12"],
        ["CUSTOS VARIAVEIS", "-R$ 8,308.25", "-R$ 6,608.25", "-R$ 7,056.96", "-R$ 7,056.96", "R$ -", "-R$ 29,030.42"],
        ["RESULTADO", "-R$ 18,486.32", "R$ 15,327.34", "-R$ 2,510.46", "-R$ 30,939.56", "R$ -", "-R$ 36,608.99"],
      ],
    },
  ],
};
