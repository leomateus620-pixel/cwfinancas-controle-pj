import * as XLSX from "xlsx";
import type { OfflineDreResult } from "./financialWorkbook";

export function buildOfflineDreWorkbookBlob(dre: OfflineDreResult) {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet(dre.rows);
  worksheet["!cols"] = [{ wch: 32 }, { wch: 16 }, { wch: 44 }, { wch: 24 }];
  XLSX.utils.book_append_sheet(workbook, worksheet, "DRE Offline");
  const arrayBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  return new Blob([arrayBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

export function downloadOfflineDre(dre: OfflineDreResult) {
  const blob = buildOfflineDreWorkbookBlob(dre);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = dre.fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
