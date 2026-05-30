export const money = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

export const percent = (value: number | null) =>
  value == null ? "—" : new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1 }).format(value);

export function humanizeMonth(label?: string | null) {
  if (!label) return "mês não identificado";
  const compact = label.match(/^([A-Za-zÀ-ÿ]{3,})\s*[/ -]?\s*(20\d{2})$/);
  if (compact) return `${compact[1].charAt(0).toUpperCase()}${compact[1].slice(1)}/${compact[2]}`;
  const key = label.match(/^(20\d{2})-(\d{2})$/);
  if (key) {
    const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    return `${months[Number(key[2]) - 1]}/${key[1]}`;
  }
  return label.replace(/([A-Za-zÀ-ÿ]+)(20\d{2})/, "$1/$2");
}
