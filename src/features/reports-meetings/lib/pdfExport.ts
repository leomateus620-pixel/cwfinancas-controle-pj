export async function exportElementAsPdf(elementId: string, filename: string) {
  const el = document.getElementById(elementId);
  if (!el) throw new Error("Elemento para exportação não encontrado");
  const title = document.title;
  document.title = filename;
  window.print();
  document.title = title;
}
