import * as XLSX from "xlsx";
import type {
  ReportsMeetingsPackage,
  WorkbookDreUpdateResult,
  WorkbookSheet,
  WorkbookSnapshot,
} from "./financialWorkbook";

const workbookMimeType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export function buildUpdatedWorkbookBlob(reportPackage: ReportsMeetingsPackage) {
  const workbook = buildUpdatedWorkbook(reportPackage.sourceWorkbook, reportPackage.dreUpdate.dreSheetName, reportPackage.dreUpdate.rows);
  const arrayBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  return new Blob([arrayBuffer], { type: workbookMimeType });
}

export function buildUpdatedWorkbook(
  sourceWorkbook: WorkbookSnapshot,
  dreSheetName: string,
  dreRows: (string | number | boolean | null)[][],
) {
  const workbook = XLSX.utils.book_new();
  const sourceSheets = mergeUpdatedDreSheet(sourceWorkbook, dreSheetName, dreRows);

  for (const sheet of sourceSheets) {
    const worksheet = XLSX.utils.aoa_to_sheet(sheet.rows);
    worksheet["!cols"] = inferColumnWidths(sheet.rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, safeSheetName(sheet.name));
  }

  return workbook;
}

export function applyDreUpdateToXlsxWorkbook(workbook: XLSX.WorkBook, dreUpdate: WorkbookDreUpdateResult) {
  const worksheet = workbook.Sheets[dreUpdate.dreSheetName];
  if (!worksheet) {
    const dreWorksheet = XLSX.utils.aoa_to_sheet(dreUpdate.rows);
    XLSX.utils.book_append_sheet(workbook, dreWorksheet, safeSheetName(dreUpdate.dreSheetName));
    return workbook;
  }

  for (const update of dreUpdate.cellUpdates) {
    const address = XLSX.utils.encode_cell({ r: update.rowIndex, c: update.columnIndex });
    worksheet[address] = {
      ...(worksheet[address] ?? {}),
      t: "n",
      v: update.value,
    };
  }

  const fallbackRange = {
    s: { r: 0, c: 0 },
    e: { r: dreUpdate.rows.length - 1, c: dreUpdate.currentMonthColumnIndex },
  };
  const range = worksheet["!ref"] ? XLSX.utils.decode_range(worksheet["!ref"]) : fallbackRange;
  for (const update of dreUpdate.cellUpdates) {
    range.e.r = Math.max(range.e.r, update.rowIndex);
    range.e.c = Math.max(range.e.c, update.columnIndex);
  }
  worksheet["!ref"] = XLSX.utils.encode_range(range);
  return workbook;
}

export function downloadUpdatedWorkbook(reportPackage: ReportsMeetingsPackage) {
  const blob = buildUpdatedWorkbookBlob(reportPackage);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = reportPackage.dreUpdate.fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function mergeUpdatedDreSheet(
  sourceWorkbook: WorkbookSnapshot,
  dreSheetName: string,
  dreRows: (string | number | boolean | null)[][],
): WorkbookSheet[] {
  let replaced = false;
  const sheets = sourceWorkbook.sheets.map((sheet) => {
    if (sheet.name !== dreSheetName) return sheet;
    replaced = true;
    return { name: sheet.name, rows: dreRows };
  });

  if (!replaced) sheets.push({ name: dreSheetName, rows: dreRows });
  return sheets;
}

function inferColumnWidths(rows: (string | number | boolean | null | undefined)[][]) {
  const maxColumns = Math.max(1, ...rows.map((row) => row.length));
  return Array.from({ length: maxColumns }, (_, columnIndex) => {
    const maxLength = rows.reduce((max, row) => Math.max(max, String(row[columnIndex] ?? "").length), 0);
    return { wch: Math.min(Math.max(maxLength + 2, columnIndex === 0 ? 18 : 10), 42) };
  });
}

function safeSheetName(name: string) {
  return name.replace(/[:\\/?*[\]]/g, " ").slice(0, 31) || "Planilha";
}
