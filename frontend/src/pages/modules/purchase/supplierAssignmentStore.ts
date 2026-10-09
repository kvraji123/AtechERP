import { initialEnquiryLines } from "./purchaseData";
import { loadApprovedPrLines } from "./purchaseRfqRequests";
import type { PurchaseEnquiryLine } from "./types";

const STORAGE_KEY = "atech.purchase.supplier-assignments.v1";

const lineKey = (line: Pick<PurchaseEnquiryLine, "prNumber" | "itemCode">) => `${line.prNumber}::${line.itemCode}`;

export const loadSupplierAssignmentLines = (prNumbers: string[]): PurchaseEnquiryLine[] => {
  const storedApprovedLines = loadApprovedPrLines(prNumbers);
  const storedPrNumbers = new Set(storedApprovedLines.map((line) => line.prNumber));
  const baseLines: PurchaseEnquiryLine[] = [
    ...initialEnquiryLines.filter((line) => !storedPrNumbers.has(line.prNumber)),
    ...storedApprovedLines.map((line, index) => ({ ...line, id: 9000 + index, enquiryRequired: true, selected: true, selectedSupplierIds: [], enquiryStatus: "Ready" as const, quotes: [] })),
  ].filter((line) => !prNumbers.length || prNumbers.includes(line.prNumber));

  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]") as PurchaseEnquiryLine[];
    const savedByKey = new Map(saved.map((line) => [lineKey(line), line]));
    return baseLines.map((line) => savedByKey.has(lineKey(line)) ? { ...line, ...savedByKey.get(lineKey(line)), id: line.id } : line);
  } catch {
    return baseLines;
  }
};

export const saveSupplierAssignmentLines = (lines: PurchaseEnquiryLine[]) => {
  let current: PurchaseEnquiryLine[] = [];
  try { current = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]") as PurchaseEnquiryLine[]; } catch { current = []; }
  const changedKeys = new Set(lines.map(lineKey));
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...current.filter((line) => !changedKeys.has(lineKey(line))), ...lines]));
};
