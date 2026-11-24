import { ClipboardCheck, LoaderCircle, Printer, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { partApi, type ProcessMasters } from "../../api/part.api";
import { apiMessage } from "../../api/client";

type InspectionCharacteristic = {
  sequenceNumber?: number;
  balloonNumber?: string | null;
  characteristicText?: string | null;
  characteristicName?: string | null;
  characteristicCode?: string | null;
  specifiedDimension?: string | number | null;
  lsl?: string | number | null;
  usl?: string | number | null;
  drawingGrid?: string | null;
  instrumentMasterId?: string | number | null;
  sampleSize?: string | null;
  inspectionFrequency?: string | null;
  patrolInspectionQaRequired?: "Y" | "N" | boolean | null;
  periodicOperatorRequired?: "Y" | "N" | boolean | null;
  finalInspectionRequired?: "Y" | "N" | boolean | null;
  scCcIdentification?: "Y" | "N" | boolean | null;
};

type ProcessOperation = {
  processOperationId?: number;
  operationNumber?: string | number | null;
  operationName?: string | null;
  operationDescription?: string | null;
  inspectionPlan?: {
    measurementUnit?: "MM" | "INCH" | null;
    cmmRequired?: "Y" | "N" | boolean | null;
    characteristics?: InspectionCharacteristic[];
  } | null;
};

type ProcessPlan = {
  processPlanId?: number;
  planCode?: string | null;
  routeName?: string | null;
  isDefault?: "Y" | "N" | boolean | null;
  operations?: ProcessOperation[];
};

type QualityPlanPart = {
  partId?: number;
  part_id?: number;
  partName?: string | null;
  part_name?: string | null;
  drawingCode?: string | null;
  drawing_code?: string | null;
  drawingNumber?: string | null;
  drawing_number?: string | null;
  drawingRevisionNumber?: string | null;
  drawing_revision_number?: string | null;
  customerName?: string | null;
  customer_name?: string | null;
  processPlans?: ProcessPlan[];
};

type PrintType = "SETUP" | "PATROL" | "PERIODIC" | "FINAL";

const printOptions: Array<{
  type: PrintType;
  title: string;
  description: string;
  matches: (row: InspectionCharacteristic) => boolean;
}> = [
  { type: "SETUP", title: "Setup IP", description: "All Inspection Plan characteristics", matches: () => true },
  { type: "PATROL", title: "Patrol Inspection IP", description: "All characteristics selected for Patrol Inspection", matches: (row) => truthy(row.patrolInspectionQaRequired) },
  { type: "PERIODIC", title: "Periodic Inspection IP", description: "Periodic Inspection IP characteristics only", matches: (row) => truthy(row.periodicOperatorRequired) },
  { type: "FINAL", title: "Final Inspection IP", description: "Final Inspection IP characteristics only", matches: (row) => truthy(row.finalInspectionRequired) },
];

const blankMasters: ProcessMasters = {
  operations: [], sources: [], machineTypes: [], characteristics: [], instruments: [],
  toleranceGrades: [], toleranceStandards: [], toleranceStandardBands: [], sampleSizes: [], frequencies: [],
};

function truthy(value: unknown) {
  return value === true || String(value || "").toUpperCase() === "Y";
}

function isCmmInstrument(instrument: ProcessMasters["instruments"][number] | undefined) {
  return /\bCMM\b/i.test(`${instrument?.instrumentCode || ""} ${instrument?.instrumentName || ""}`);
}

function text(value: unknown) {
  return value === null || value === undefined || value === "" ? "—" : String(value);
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function partPlans(part: QualityPlanPart | null) {
  return Array.isArray(part?.processPlans) ? part.processPlans : [];
}

function normalizePartDetail(part: QualityPlanPart): QualityPlanPart {
  return {
    ...part,
    partId: Number(part.partId ?? part.part_id ?? 0),
    partName: part.partName ?? part.part_name ?? null,
    drawingCode: part.drawingCode ?? part.drawing_code ?? null,
    drawingNumber: part.drawingNumber ?? part.drawing_number ?? null,
    drawingRevisionNumber: part.drawingRevisionNumber ?? part.drawing_revision_number ?? null,
    customerName: part.customerName ?? part.customer_name ?? null,
  };
}

function firstInspectableOperation(plan: ProcessPlan | undefined) {
  const operations = plan?.operations || [];
  return operations.find((operation) => (operation.inspectionPlan?.characteristics || []).length > 0) || operations[0];
}

function planLabel(plan: ProcessPlan) {
  return [plan.planCode, plan.routeName].filter(Boolean).join(" · ") || "Process Plan";
}

function operationLabel(operation: ProcessOperation) {
  const name = operation.operationName || operation.operationDescription || "Operation";
  return [operation.operationNumber, name].filter(Boolean).join(" · ");
}

export default function QualityPlanPrintModal({ onClose }: { onClose: () => void }) {
  const [drawingCode, setDrawingCode] = useState("");
  const [part, setPart] = useState<QualityPlanPart | null>(null);
  const [masters, setMasters] = useState<ProcessMasters>(blankMasters);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [selectedOperationId, setSelectedOperationId] = useState("");
  const [batchQuantity, setBatchQuantity] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingMasters, setLoadingMasters] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let current = true;
    void partApi.getProcessMasters()
      .then((response) => { if (current) setMasters({ ...blankMasters, ...response }); })
      .catch(() => { if (current) setMasters(blankMasters); })
      .finally(() => { if (current) setLoadingMasters(false); });
    return () => { current = false; };
  }, []);

  const plans = useMemo(() => partPlans(part), [part]);
  const selectedPlan = plans.find((plan) => String(plan.processPlanId) === selectedPlanId) || null;
  const operations = selectedPlan?.operations || [];
  const selectedOperation = operations.find((operation) => String(operation.processOperationId) === selectedOperationId) || null;

  const loadDrawingCode = async () => {
    const requestedCode = drawingCode.trim();
    if (!requestedCode) {
      setError("Enter a Drawing Code.");
      return;
    }
    try {
      setLoading(true);
      setError("");
      const response = await partApi.list({ search: requestedCode, page: 1, pageSize: 100, includeDraft: true });
      const match = (Array.isArray(response?.data) ? response.data : []).find((entry: { drawingCode?: string | null }) =>
        String(entry.drawingCode || "").trim().toUpperCase() === requestedCode.toUpperCase()
      );
      if (!match) {
        setPart(null);
        setSelectedPlanId("");
        setSelectedOperationId("");
        setError(`No Part Master record was found for Drawing Code ${requestedCode}.`);
        return;
      }
      const detailResponse = await partApi.getById(Number(match.partId)) as { data?: QualityPlanPart } | QualityPlanPart;
      const rawDetail = ("data" in detailResponse ? detailResponse.data : detailResponse) as QualityPlanPart | undefined;
      const detail = rawDetail ? normalizePartDetail(rawDetail) : undefined;
      if (!detail?.partId) {
        throw new Error("The selected Part Master record could not be loaded.");
      }
      const nextPlans = partPlans(detail);
      const defaultPlan = nextPlans.find((plan) => truthy(plan.isDefault)) || nextPlans[0];
      const defaultOperation = firstInspectableOperation(defaultPlan);
      setPart(detail);
      setDrawingCode(String(detail.drawingCode || requestedCode));
      setSelectedPlanId(defaultPlan?.processPlanId ? String(defaultPlan.processPlanId) : "");
      setSelectedOperationId(defaultOperation?.processOperationId ? String(defaultOperation.processOperationId) : "");
      if (!defaultPlan) setError("This Part does not have a Process Plan yet.");
      else if (!defaultOperation?.inspectionPlan) setError("Select an operation with an Inspection Plan to print.");
    } catch (loadError) {
      setPart(null);
      setSelectedPlanId("");
      setSelectedOperationId("");
      setError(apiMessage(loadError));
    } finally {
      setLoading(false);
    }
  };

  const choosePlan = (planId: string) => {
    const nextPlan = plans.find((plan) => String(plan.processPlanId) === planId);
    const nextOperation = firstInspectableOperation(nextPlan);
    setSelectedPlanId(planId);
    setSelectedOperationId(nextOperation?.processOperationId ? String(nextOperation.processOperationId) : "");
    setError("");
  };

  const printQualityPlan = (printType: PrintType) => {
    const option = printOptions.find((entry) => entry.type === printType);
    const inspectionPlan = selectedOperation?.inspectionPlan;
    if (!part || !selectedPlan || !selectedOperation || !inspectionPlan || !option) {
      setError("Load a Part and select an operation with an Inspection Plan first.");
      return;
    }
    const markedCharacteristics = (inspectionPlan.characteristics || []).filter((row) => option.matches(row));
    // Patrol is a QA-defined list: every characteristic marked with the Patrol
    // radio button belongs on the report. It is not reduced by CMM selection,
    // Sample Size or Inspection Frequency.
    const characteristics = printType === "PATROL"
      ? markedCharacteristics
      : markedCharacteristics.filter((row) => truthy(inspectionPlan.cmmRequired) || !isCmmInstrument(
        masters.instruments.find((instrument) => String(instrument.instrumentMasterId) === String(row.instrumentMasterId))
      ));
    if (!characteristics.length) {
      setError(`No printable characteristics are marked for ${option.title}.`);
      return;
    }
    const printWindow = window.open("", "_blank", "width=1280,height=900");
    if (!printWindow) {
      setError("Unable to open the print preview. Allow pop-ups for this site and try again.");
      return;
    }

    const unit = inspectionPlan.measurementUnit === "INCH" ? "in" : "mm";
    const printedDate = new Intl.DateTimeFormat("en-GB", {
      day: "2-digit", month: "2-digit", year: "numeric",
    }).format(new Date());
    const instrumentName = (instrumentMasterId: unknown) => masters.instruments
      .find((instrument) => String(instrument.instrumentMasterId) === String(instrumentMasterId))?.instrumentName || "—";
    const frequency = (row: InspectionCharacteristic) => masters.frequencies
      .find((entry) => entry.value === row.inspectionFrequency)?.label || row.inspectionFrequency || "—";
    const sampleSize = (row: InspectionCharacteristic) => masters.sampleSizes
      .find((entry) => entry.value === row.sampleSize)?.label || row.sampleSize || "—";
    const operationLabel = [selectedOperation.operationNumber, selectedOperation.operationName || selectedOperation.operationDescription]
      .filter(Boolean).join(" & ") || "—";
    const drawingAndRevision = [part.drawingNumber, part.drawingRevisionNumber].filter(Boolean).join(" / ") || "—";
    const openPrintPreview = (documentHtml: string) => {
      printWindow.document.open();
      printWindow.document.write(documentHtml);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
    };

    if (printType === "FINAL") {
      const finalTableRows = characteristics.map((row) => `<tr class="${truthy(row.scCcIdentification) ? "special-characteristic" : ""}">
        <td class="serial">${(inspectionPlan.characteristics || []).indexOf(row) + 1}</td>
        <td class="special-value">${escapeHtml(text(row.characteristicText || row.characteristicName || row.characteristicCode))}</td>
        <td class="special-value">${escapeHtml(text(row.specifiedDimension))}</td>
        <td class="special-value">${escapeHtml(text(row.lsl))}</td>
        <td class="special-value">${escapeHtml(text(row.usl))}</td>
        <td>${escapeHtml(text(row.balloonNumber))}</td>
        <td>${escapeHtml(text(row.drawingGrid))}</td>
        <td>${escapeHtml(instrumentName(row.instrumentMasterId))}</td>
        <td></td><td class="final-observed"></td><td class="final-observed"></td><td class="final-observed"></td>
      </tr>`).join("");

      openPrintPreview(`<!doctype html><html><head><title>Final Inspection IP - ${escapeHtml(String(selectedOperation.operationNumber || ""))}</title><style>
        @page { size: landscape; margin: 10mm; }
        * { box-sizing: border-box; } body { margin: 0; color: #111827; font-family: Arial, sans-serif; }
        .document { border: 1px solid #1f2937; }.company-name { padding: 6px 10px 0; color: #142b65; text-align: center; font-size: 13px; font-weight: 700; text-transform: uppercase; }h1 { margin: 0; padding: 3px 10px 6px; color: #142b65; text-align: center; font-size: 16px; text-transform: uppercase; }
        .final-metadata { display: grid; grid-template-columns: 1.4fr .7fr 1.5fr .8fr 1.2fr; border-top: 1px solid #1f2937; }.final-metadata div { min-height: 31px; padding: 4px 6px; border-right: 1px solid #1f2937; border-bottom: 1px solid #1f2937; }.final-metadata div:nth-child(5n) { border-right: 0; }.final-metadata .operation { grid-column: span 3; }.final-metadata .dispatch { grid-column: span 2; }.final-metadata strong { display: block; margin-bottom: 2px; font-size: 7px; text-transform: uppercase; }.final-metadata span { font-size: 9px; font-weight: 700; }
        table { width: 100%; table-layout: fixed; border-collapse: collapse; font-size: 8px; }th, td { padding: 4px; border: 1px solid #1f2937; text-align: left; vertical-align: top; overflow-wrap: anywhere; }th { background: #f8fafc; font-size: 7px; text-align: center; }thead { display: table-header-group; }tr { break-inside: avoid; }.serial { text-align: center; }.final-observed { height: 25px; }.special-characteristic .special-value { background: #e5e7eb !important; font-weight: 800; }
        .final-note { padding: 5px 6px; border: 1px solid #1f2937; border-top: 0; font-size: 8px; }.final-status { display: grid; grid-template-columns: 1.3fr 1.2fr repeat(3, .65fr); border-left: 1px solid #1f2937; }.final-status div { min-height: 29px; padding: 5px 6px; border-right: 1px solid #1f2937; border-bottom: 1px solid #1f2937; font-size: 8px; font-weight: 700; }.final-status .wide { grid-column: span 2; }.final-status .full { grid-column: span 5; }.final-status .detail { font-weight: 400; }
      </style></head><body><main class="document"><div class="company-name">A Tech Automation</div><h1>Final Inspection Report</h1><section class="final-metadata"><div><strong>Drawing No / Rev No.</strong><span>${escapeHtml(drawingAndRevision)}</span></div><div><strong>PP Route (Kind)</strong><span>${escapeHtml(planLabel(selectedPlan))}</span></div><div><strong>Part Name</strong><span>${escapeHtml(text(part.partName))}</span></div><div><strong>Drg Code</strong><span>${escapeHtml(text(part.drawingCode))}</span></div><div><strong>Customer</strong><span>${escapeHtml(text(part.customerName))}</span></div><div class="operation"><strong>Opn. No & Description</strong><span>${escapeHtml(operationLabel)}</span></div><div class="dispatch"><strong>Batch Qty / Date</strong><span>${escapeHtml(batchQuantity || "—")} / ${escapeHtml(printedDate)}</span></div></section><table><colgroup><col style="width:3%"/><col style="width:16%"/><col style="width:12%"/><col style="width:8%"/><col style="width:8%"/><col style="width:6%"/><col style="width:6%"/><col style="width:12%"/><col style="width:7%"/><col style="width:7.333%"/><col style="width:7.333%"/><col style="width:7.333%"/></colgroup><thead><tr><th rowspan="2">S.No.</th><th rowspan="2">Description</th><th rowspan="2">Specified Dimension (${unit})</th><th colspan="2">Specification (${unit})</th><th rowspan="2">Balloon S.No.</th><th rowspan="2">Drg Grid</th><th rowspan="2">Instrument / Gauge</th><th rowspan="2">Remarks</th><th colspan="3">Observed</th></tr><tr><th>LSL</th><th>USL</th><th>1</th><th>2</th><th>3</th></tr></thead><tbody>${finalTableRows}</tbody></table><div class="final-note">AC - Accepted, RW - Rework, RJ - Rejection, DE - Deviation, CAC - Conditionally Accepted &nbsp;&nbsp; | &nbsp;&nbsp; Grey shaded values are Special Characteristics (SC/CC).</div><section class="final-status"><div class="wide">Component Status</div><div>1</div><div>2</div><div>3</div><div class="wide">Supplied Qty:</div><div class="wide">Accepted Qty:</div><div>Inspected By / Date:</div><div>Inspection status:</div><div>Inspection status:</div><div class="wide">Machining Rej Qty:</div><div class="wide">Material Rej Qty:</div><div>Approved By / Date:</div><div></div><div></div><div class="full">Sampling Plan: <span class="detail">1–100 Nos: 2 samples; 101–500 Nos: 3 samples; above 500 Nos: 5 samples.</span></div><div class="full">Remarks:</div></section></main></body></html>`);
      return;
    }

    if (printType === "PATROL") {
      const patrolRows = characteristics.map((row) => `<tr class="${truthy(row.scCcIdentification) ? "special-characteristic" : ""}">
        <td class="serial">${(inspectionPlan.characteristics || []).indexOf(row) + 1}</td>
        <td class="special-value">${escapeHtml(text(row.characteristicText || row.characteristicName || row.characteristicCode))}</td>
        <td class="special-value">${escapeHtml(text(row.specifiedDimension))}</td>
        <td class="special-value">${escapeHtml(text(row.lsl))}</td>
        <td class="special-value">${escapeHtml(text(row.usl))}</td>
        <td>${escapeHtml(instrumentName(row.instrumentMasterId))}</td>
        <td>${escapeHtml(sampleSize(row))}</td>
        <td>${escapeHtml(frequency(row))}</td>
        <td class="patrol-observed"></td><td class="patrol-observed"></td><td class="patrol-observed"></td>
      </tr>`).join("");
      openPrintPreview(`<!doctype html><html><head><title>Patrol Inspection IP - ${escapeHtml(String(selectedOperation.operationNumber || ""))}</title><style>
        @page { size: landscape; margin: 10mm; }
        * { box-sizing: border-box; } body { margin: 0; color: #111827; font-family: Arial, sans-serif; }
        .document { border: 1px solid #1f2937; }.company-name { padding: 6px 10px 0; color: #142b65; text-align: center; font-size: 13px; font-weight: 700; text-transform: uppercase; }h1 { margin: 0; padding: 3px 10px 6px; color: #142b65; text-align: center; font-size: 16px; text-transform: uppercase; }
        .metadata { display: grid; grid-template-columns: 1.4fr .75fr 1.65fr .85fr; border-top: 1px solid #1f2937; }.metadata div { min-height: 31px; padding: 4px 6px; border-right: 1px solid #1f2937; border-bottom: 1px solid #1f2937; }.metadata div:nth-child(4n) { border-right: 0; }.metadata .wide { grid-column: span 2; }.metadata strong { display: block; margin-bottom: 2px; font-size: 7px; text-transform: uppercase; }.metadata span { font-size: 9px; font-weight: 700; }
        table { width: 100%; table-layout: fixed; border-collapse: collapse; font-size: 8px; }th, td { padding: 4px; border: 1px solid #1f2937; text-align: left; vertical-align: top; overflow-wrap: anywhere; }th { background: #f8fafc; font-size: 7px; text-align: center; }thead { display: table-header-group; }tr { break-inside: avoid; }.serial { text-align: center; }.patrol-observed { height: 27px; }.special-characteristic .special-value { background: #e5e7eb !important; font-weight: 800; }
        .patrol-note { min-height: 35px; padding: 5px 6px; border: 1px solid #1f2937; border-top: 0; font-size: 8px; font-weight: 700; }.patrol-note span { font-weight: 400; }.patrol-sign-off { display: grid; grid-template-columns: 1.5fr 1fr 1fr 1fr; border-left: 1px solid #1f2937; }.patrol-sign-off div { min-height: 28px; padding: 5px 6px; border-right: 1px solid #1f2937; border-bottom: 1px solid #1f2937; font-size: 8px; font-weight: 700; }.patrol-sign-off .wide { grid-column: span 2; }.patrol-sign-off .full { grid-column: span 4; }
      </style></head><body><main class="document"><div class="company-name">A Tech Automation</div><h1>Patrol Inspection Report</h1><section class="metadata"><div><strong>Drawing No / Rev No.</strong><span>${escapeHtml(drawingAndRevision)}</span></div><div><strong>PP Route (Kind)</strong><span>${escapeHtml(planLabel(selectedPlan))}</span></div><div><strong>Part Name</strong><span>${escapeHtml(text(part.partName))}</span></div><div><strong>Drg Code</strong><span>${escapeHtml(text(part.drawingCode))}</span></div><div class="wide"><strong>Opn. No & Description</strong><span>${escapeHtml(operationLabel)}</span></div><div><strong>Customer</strong><span>${escapeHtml(text(part.customerName))}</span></div><div><strong>Batch Qty / Date</strong><span>${escapeHtml(batchQuantity || "—")} / ${escapeHtml(printedDate)}</span></div></section><table><colgroup><col style="width:3%"/><col style="width:17%"/><col style="width:8%"/><col style="width:7%"/><col style="width:7%"/><col style="width:11%"/><col style="width:9%"/><col style="width:10%"/><col style="width:9.333%"/><col style="width:9.333%"/><col style="width:9.333%"/></colgroup><thead><tr><th rowspan="2">S.No.</th><th rowspan="2">Description</th><th rowspan="2">Basic Size (${unit})</th><th colspan="2">Specification (${unit})</th><th rowspan="2">Instrument / Gauge</th><th rowspan="2">Sample Size</th><th rowspan="2">Inspection Frequency</th><th colspan="3">Observed Reading</th></tr><tr><th>LSL</th><th>USL</th><th>1</th><th>2</th><th>3</th></tr></thead><tbody>${patrolRows}</tbody></table><div class="patrol-note">All characteristics selected for Patrol Inspection are printed. <span>Sample Size and Inspection Frequency are shown for reference and do not filter the Patrol characteristic list. Grey shaded values are Special Characteristics (SC/CC).</span></div><section class="patrol-sign-off"><div class="wide">Machine No &amp; Name:</div><div>Shift-1 Details</div><div>Remarks</div><div class="wide">Operator Name:</div><div>Shift-2 Details</div><div>Remarks</div><div class="wide">Part Serial No. Start &amp; End:</div><div>Shift-3 Details</div><div>Remarks</div><div class="wide">Quantity Produced / Accepted:</div><div>QA Verified By:</div><div>Sign:</div><div class="full">Remarks:</div></section></main></body></html>`);
      return;
    }

    if (printType === "PERIODIC") {
      const inspectionStageLabel = "Periodic Inspection";
      const observationCount = (sampleValue: unknown, sampleLabel: string) => {
        const sampleCount = Number(sampleValue) || Number(sampleLabel);
        return Number.isFinite(sampleCount) && sampleCount > 0 ? Math.min(Math.floor(sampleCount), 15) : 15;
      };
      const inspectionInterval = (frequencyValue: unknown, frequencyLabel: string) => {
        const value = `${frequencyValue || ""} ${frequencyLabel}`.toUpperCase();
        if (/EVERY_PART|EVERY\s+PART|100\s*%/.test(value)) return 1;
        const match = value.match(/(?:EVERY[_\s-]*|1\s*\/\s*)(\d+)/);
        return match ? Math.max(Number(match[1]), 1) : 1;
      };
      const groups = new Map<string, {
        rows: InspectionCharacteristic[];
        sampleLabel: string;
        frequencyLabel: string;
        observationCount: number;
        interval: number;
      }>();
      characteristics.forEach((row) => {
        const sampleLabel = sampleSize(row);
        const frequencyLabel = frequency(row);
        const key = `${row.sampleSize || ""}::${row.inspectionFrequency || ""}`;
        const existing = groups.get(key);
        if (existing) {
          existing.rows.push(row);
          return;
        }
        groups.set(key, {
          rows: [row], sampleLabel, frequencyLabel,
          observationCount: observationCount(row.sampleSize, sampleLabel),
          interval: inspectionInterval(row.inspectionFrequency, frequencyLabel),
        });
      });
      const patrolSections = Array.from(groups.values()).map((group) => {
        const observedNumbers = Array.from({ length: group.observationCount }, (_, index) => 1 + (index * group.interval));
        const observedWidth = (47 / group.observationCount).toFixed(3);
        const groupRows = group.rows.map((row) => `<tr class="${truthy(row.scCcIdentification) ? "special-characteristic" : ""}">
          <td class="serial">${(inspectionPlan.characteristics || []).indexOf(row) + 1}</td>
          <td class="special-value">${escapeHtml(text(row.characteristicText || row.characteristicName || row.characteristicCode))}</td>
          <td class="special-value">${escapeHtml(text(row.specifiedDimension))}</td>
          <td class="special-value">${escapeHtml(text(row.lsl))}</td>
          <td class="special-value">${escapeHtml(text(row.usl))}</td>
          <td>${escapeHtml(instrumentName(row.instrumentMasterId))}</td>
          ${observedNumbers.map(() => '<td class="patrol-observed"></td>').join("")}
        </tr>`).join("");
        return `<section class="patrol-section"><header><strong>${inspectionStageLabel}: ${escapeHtml(group.sampleLabel)} / ${escapeHtml(group.frequencyLabel)}</strong><span>Observed Reading</span></header><table class="patrol-table"><colgroup><col style="width:3%"/><col style="width:15%"/><col style="width:9%"/><col style="width:8%"/><col style="width:8%"/><col style="width:10%"/>${observedNumbers.map(() => `<col style="width:${observedWidth}%"/>`).join("")}</colgroup><thead><tr><th>S.No.</th><th>Description</th><th>Basic Size (${unit})</th><th>Tol Min</th><th>Tol Max</th><th>Instrument / Gauge</th>${observedNumbers.map((number) => `<th>${number}</th>`).join("")}</tr></thead><tbody>${groupRows}</tbody></table></section>`;
      }).join("");

      openPrintPreview(`<!doctype html><html><head><title>${escapeHtml(inspectionStageLabel)} IP - ${escapeHtml(String(selectedOperation.operationNumber || ""))}</title><style>
        @page { size: landscape; margin: 10mm; }
        * { box-sizing: border-box; } body { margin: 0; color: #111827; font-family: Arial, sans-serif; }
        .document { border: 1px solid #1f2937; }.company-name { padding: 6px 10px 0; color: #142b65; text-align: center; font-size: 13px; font-weight: 700; text-transform: uppercase; }h1 { margin: 0; padding: 3px 10px 6px; color: #142b65; text-align: center; font-size: 16px; text-transform: uppercase; }
        .metadata { display: grid; grid-template-columns: 1.4fr .75fr 1.65fr .85fr; border-top: 1px solid #1f2937; }.metadata div { min-height: 31px; padding: 4px 6px; border-right: 1px solid #1f2937; border-bottom: 1px solid #1f2937; }.metadata div:nth-child(4n) { border-right: 0; }.metadata .wide { grid-column: span 2; }.metadata strong { display: block; margin-bottom: 2px; font-size: 7px; text-transform: uppercase; }.metadata span { font-size: 9px; font-weight: 700; }
        .patrol-section { margin-top: 8px; break-inside: avoid; }.patrol-section > header { display: flex; justify-content: space-between; padding: 4px 6px; border: 1px solid #1f2937; border-bottom: 0; background: #f1f5f9; font-size: 9px; }.patrol-section > header span { font-weight: 700; }
        table { width: 100%; table-layout: fixed; border-collapse: collapse; font-size: 8px; }th, td { padding: 4px; border: 1px solid #1f2937; text-align: left; vertical-align: top; overflow-wrap: anywhere; }th { background: #f8fafc; font-size: 7px; text-align: center; }thead { display: table-header-group; }tr { break-inside: avoid; }.serial { text-align: center; }.patrol-observed { height: 27px; }.special-characteristic .special-value { background: #e5e7eb !important; font-weight: 800; }
        .patrol-time, .patrol-note { min-height: 25px; padding: 5px 6px; border: 1px solid #1f2937; border-top: 0; font-size: 8px; font-weight: 700; }.patrol-note { min-height: 42px; }.patrol-note span { font-weight: 400; }.patrol-sign-off { display: grid; grid-template-columns: 1.5fr 1fr 1fr 1fr; border-left: 1px solid #1f2937; }.patrol-sign-off div { min-height: 28px; padding: 5px 6px; border-right: 1px solid #1f2937; border-bottom: 1px solid #1f2937; font-size: 8px; font-weight: 700; }.patrol-sign-off .wide { grid-column: span 2; }.patrol-sign-off .full { grid-column: span 4; }
      </style></head><body><main class="document"><div class="company-name">A Tech Automation</div><h1>Operator Inspection Report</h1><section class="metadata"><div><strong>Drawing No / Rev No.</strong><span>${escapeHtml(drawingAndRevision)}</span></div><div><strong>PP Route (Kind)</strong><span>${escapeHtml(planLabel(selectedPlan))}</span></div><div><strong>Part Name</strong><span>${escapeHtml(text(part.partName))}</span></div><div><strong>Drg Code</strong><span>${escapeHtml(text(part.drawingCode))}</span></div><div class="wide"><strong>Opn. No & Description</strong><span>${escapeHtml(operationLabel)}</span></div><div><strong>Customer</strong><span>${escapeHtml(text(part.customerName))}</span></div><div><strong>Batch Qty / Date</strong><span>${escapeHtml(batchQuantity || "—")} / ${escapeHtml(printedDate)}</span></div></section>${patrolSections}<div class="patrol-time">Time:</div><div class="patrol-note">Special Instructions: <span>Grey shaded values are Special Characteristics (SC/CC).</span></div><section class="patrol-sign-off"><div class="wide">Machine No &amp; Name:</div><div>Shift-1 Details</div><div>Remarks</div><div class="wide">Operator Name:</div><div>Shift-2 Details</div><div>Remarks</div><div class="wide">Part Serial No. Start &amp; End:</div><div>Shift-3 Details</div><div>Remarks</div><div class="wide">Quantity Produced / Accepted:</div><div>QA Verified By:</div><div>Sign:</div><div class="full">Remarks:</div></section></main></body></html>`);
      return;
    }
    const tableRows = characteristics.map((row, index) => `<tr class="${truthy(row.scCcIdentification) ? "special" : ""}">
      <td>${index + 1}</td><td>${escapeHtml(frequency(row))}</td><td>${escapeHtml(row.characteristicText || row.characteristicName || row.characteristicCode || "—")}</td>
      <td>${escapeHtml(text(row.specifiedDimension))}</td><td>${escapeHtml(text(row.lsl))}</td><td>${escapeHtml(text(row.usl))}</td>
      <td>${escapeHtml(text(row.balloonNumber))}</td><td>${escapeHtml(text(row.drawingGrid))}</td><td>${escapeHtml(instrumentName(row.instrumentMasterId))}</td>
      <td>${escapeHtml(sampleSize(row))}</td><td></td><td class="observed"></td><td class="observed"></td><td class="observed"></td>
    </tr>`).join("");

    printWindow.document.open();
    printWindow.document.write(`<!doctype html><html><head><title>${escapeHtml(option.title)} - ${escapeHtml(part.drawingCode)}</title><style>
      @page { size: landscape; margin: 10mm 10mm 18mm; }
      * { box-sizing: border-box; } body { margin: 0; color: #15233d; font-family: Arial, sans-serif; }
      .document { border: 1px solid #26364d; }.company { padding: 8px 12px 0; color: #102b66; text-align: center; font-size: 13px; font-weight: 800; text-transform: uppercase; }
      h1 { margin: 0; padding: 3px 12px 8px; color: #102b66; text-align: center; font-size: 17px; }.subtitle { margin: -4px 0 8px; text-align: center; font-size: 10px; font-weight: 700; }
      .metadata { display: grid; grid-template-columns: 1fr 1.5fr 1fr 1.4fr; border-top: 1px solid #26364d; }.metadata div { min-height: 39px; padding: 5px 7px; border-right: 1px solid #26364d; border-bottom: 1px solid #26364d; }.metadata div:nth-child(4n) { border-right: 0; }.metadata .wide { grid-column: span 2; }.metadata strong { display: block; margin-bottom: 3px; font-size: 7px; text-transform: uppercase; }.metadata span { font-size: 10px; font-weight: 700; }
      table { width: 100%; table-layout: fixed; border-collapse: collapse; font-size: 8px; } th, td { padding: 4px; border: 1px solid #26364d; text-align: left; vertical-align: top; overflow-wrap: anywhere; } th { background: #e8eef8; font-size: 7px; text-align: center; } thead { display: table-header-group; } tr { break-inside: avoid; } .special td:nth-child(3), .special td:nth-child(4), .special td:nth-child(5), .special td:nth-child(6) { background: #e5e7eb; font-weight: 800; } .observed { height: 28px; }
      .note { padding: 5px 7px; border-top: 0; font-size: 8px; }.printed-date { position: fixed; right: 0; bottom: 0; left: 0; padding: 3mm 10mm; color: #475467; font-size: 8px; text-align: right; }
    </style></head><body><main class="document"><div class="company">A Tech Automation</div><h1>Quality Plan</h1><p class="subtitle">${escapeHtml(option.title)}</p><section class="metadata">
      <div><strong>Drg Code</strong><span>${escapeHtml(text(part.drawingCode))}</span></div><div><strong>PP Route (Kind)</strong><span>${escapeHtml(planLabel(selectedPlan))}</span></div>
      <div><strong>Part Name</strong><span>${escapeHtml(text(part.partName))}</span></div><div><strong>Drg No.</strong><span>${escapeHtml(text(part.drawingNumber))}</span></div>
      <div><strong>Customer</strong><span>${escapeHtml(text(part.customerName))}</span></div><div><strong>Drg Rev</strong><span>${escapeHtml(text(part.drawingRevisionNumber))}</span></div>
      <div><strong>Operation No.</strong><span>${escapeHtml(text(selectedOperation.operationNumber))}</span></div><div><strong>Operation</strong><span>${escapeHtml(selectedOperation.operationName || selectedOperation.operationDescription || "—")}</span></div>
      <div><strong>Batch Qty</strong><span>${escapeHtml(batchQuantity || "—")}</span></div><div class="wide"><strong>Inspection Type</strong><span>${escapeHtml(option.title)}</span></div>
    </section><table><thead><tr><th>S.No.</th><th>Inspection Frequency</th><th>Characteristic</th><th>Specified Dimension (${unit})</th><th>LSL</th><th>USL</th><th>Balloon No.</th><th>Drg Grid</th><th>Instrument / Gauge</th><th>Sample Size</th><th>Remarks</th><th colspan="3">Observed Value</th></tr></thead><tbody>${tableRows}</tbody></table><div class="note">Grey shaded values are Special Characteristics (SC / CC).</div></main><footer class="printed-date">Current printed date: ${escapeHtml(printedDate)}</footer></body></html>`);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  return <div className="quality-plan-overlay" role="dialog" aria-modal="true" aria-labelledby="quality-plan-title">
    <section className="quality-plan-modal">
      <header>
        <div><ClipboardCheck size={20}/><div><h2 id="quality-plan-title">Print Quality Plan</h2><p>Enter the Drawing Code to load its Part Master and Process Plan details.</p></div></div>
        <button type="button" aria-label="Close Quality Plan" onClick={onClose}><X size={18}/></button>
      </header>
      <main>
        {error && <div className="quality-plan-error" role="alert">{error}</div>}
        <div className="quality-plan-code-row">
          <label><span>Drawing Code</span><input value={drawingCode} onChange={(event) => setDrawingCode(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void loadDrawingCode(); } }} placeholder="Enter unique Drawing Code" autoFocus/></label>
          <button type="button" className="primary-action-button" disabled={loading} onClick={() => void loadDrawingCode()}>{loading ? <LoaderCircle className="spinning" size={16}/> : <Search size={16}/>} {loading ? "Loading..." : "Load"}</button>
        </div>
        <fieldset disabled={!part || loading} className="quality-plan-fieldset">
          <div className="quality-plan-fields">
            <label><span>Part Name</span><input value={part?.partName || ""} readOnly/></label><label><span>Drg No.</span><input value={part?.drawingNumber || ""} readOnly/></label>
            <label><span>Customer</span><input value={part?.customerName || ""} readOnly/></label><label><span>Drg Rev</span><input value={part?.drawingRevisionNumber || ""} readOnly/></label>
            <label><span>PP Route (Kind)</span><select value={selectedPlanId} onChange={(event) => choosePlan(event.target.value)}><option value="">Select Process Plan</option>{plans.map((plan) => <option key={plan.processPlanId} value={plan.processPlanId}>{planLabel(plan)}</option>)}</select></label>
            <label><span>Operation No.</span><select value={selectedOperationId} onChange={(event) => { setSelectedOperationId(event.target.value); setError(""); }}><option value="">Select Operation</option>{operations.map((operation) => <option key={operation.processOperationId} value={operation.processOperationId}>{operationLabel(operation)}</option>)}</select></label>
            <label><span>Operation</span><input value={selectedOperation?.operationName || selectedOperation?.operationDescription || ""} readOnly/></label><label><span>Batch Qty</span><input value={batchQuantity} onChange={(event) => setBatchQuantity(event.target.value)} placeholder="Enter batch quantity"/></label>
          </div>
        </fieldset>
        <div className="quality-plan-print-options" aria-label="Inspection Plan print type">
          {printOptions.map((option) => <button type="button" key={option.type} disabled={!part || !selectedOperation?.inspectionPlan || loadingMasters} onClick={() => printQualityPlan(option.type)}><Printer size={19}/><strong>{option.title}</strong><span>{option.description}</span></button>)}
        </div>
      </main>
      <footer><button type="button" className="secondary-action-button" onClick={onClose}>Close</button></footer>
    </section>
  </div>;
}
