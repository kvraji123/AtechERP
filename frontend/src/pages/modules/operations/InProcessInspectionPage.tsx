import { AlertTriangle, CheckCircle2, ClipboardCheck, Factory, Plus, RefreshCw, Save } from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { apiMessage } from "../../../api/client";
import { inProcessInspectionApi } from "../../../api/inProcessInspection.api";
import "./InProcessInspectionPage.css";

type Item = Record<string, any>;
type ResultInput = { actualValue: string; inspectionDate: string; inspectionResult: "PASS" | "FAIL"; remarks: string };
type InspectionEntry = { requirement: Item; sample: Item };
type InspectionRow = { key: string; pieceSequence: number; pieceReference: string; requirement: Item; entries: InspectionEntry[] };

const blankProduction = {
  workOrderReference: "",
  batchReference: "",
  partId: "",
  processSelection: "",
  quantity: "1",
};

function numericLimit(value: unknown) {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function rangeLimits(requirement: Item) {
  const lsl = numericLimit(requirement.lsl);
  const usl = numericLimit(requirement.usl);
  return lsl === null || usl === null || lsl > usl ? null : { lsl, usl };
}

function samplingDisplay(requirement: Item) {
  const sampleSize = String(requirement.sampleSize || "").trim();
  const frequency = String(requirement.inspectionFrequency || "").trim();
  const normalizedFrequency = frequency.toUpperCase();
  if (["100_PERCENT", "100%", "EVERY_PART", "EVERY"].includes(normalizedFrequency)) return "100%";
  return [sampleSize, frequency.replace(/^EVERY_(\d+)$/i, "$1").replace(/_/g, " ")].filter(Boolean).join(" / ") || "—";
}

function todayForInput() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateForInput(value: unknown) {
  if (!value) return todayForInput();
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return todayForInput();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function inspectionRowsFor(requirements: Item[]): InspectionRow[] {
  const runs = new Map<string, { runId: number; requirement: Item; sequences: Map<number, { entries: InspectionEntry[] }> }>();
  for (const requirement of requirements) {
    const runId = Number(requirement.runId);
    const runKey = String(runId || requirement.workOrderReference || requirement.requirementId);
    let run = runs.get(runKey);
    if (!run) {
      run = { runId, requirement, sequences: new Map() };
      runs.set(runKey, run);
    }
    for (const sample of requirement.samples || []) {
      if (String(sample.inspectionResult || "PENDING").toUpperCase() !== "PENDING") continue;
      const sequence = Number(sample.pieceSequence || requirement.triggerPieceSequence);
      if (!Number.isSafeInteger(sequence) || sequence < 1) continue;
      const row = run.sequences.get(sequence) || { entries: [] };
      row.entries.push({ requirement, sample });
      run.sequences.set(sequence, row);
    }
  }
  return Array.from(runs.values()).flatMap((run) => Array.from(run.sequences.entries())
    .sort(([left], [right]) => left - right)
    .map(([pieceSequence, row]) => ({
      key: `${run.runId}-${pieceSequence}`,
      pieceSequence,
      pieceReference: row.entries[0]?.sample.pieceReference || run.requirement.triggerPieceReference,
      requirement: row.entries[0]?.requirement || run.requirement,
      entries: row.entries,
    })));
}

export default function InProcessInspectionPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const pageMode = location.pathname.endsWith("/create") ? "CREATE" : location.pathname.endsWith("/inspect") ? "INSPECT" : "STATUS";
  const preferredQueueRunId = Number(new URLSearchParams(location.search).get("runId") || 0);
  const [parts, setParts] = useState<Item[]>([]);
  const [processes, setProcesses] = useState<Item[]>([]);
  const [dashboard, setDashboard] = useState<Item>({ runs: [], samplingQueue: [], inspectionQueue: [] });
  const [production, setProduction] = useState(blankProduction);
  const [resultInputs, setResultInputs] = useState<Record<number, ResultInput>>({});
  const [failureRemarks, setFailureRemarks] = useState<Record<number, string>>({});
  const [selectedQueueRunId, setSelectedQueueRunId] = useState<number | "">("");
  const [queueSearch, setQueueSearch] = useState("");
  const [selectedInspectionPieceKey, setSelectedInspectionPieceKey] = useState("");
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const autoSaveBlockedRequirementIds = useRef(new Set<number>());

  const loadDashboard = useCallback(async (initial = false) => {
    try {
      setError("");
      const response = await inProcessInspectionApi.dashboard();
      const responseDashboard = response.data || { runs: [], samplingQueue: [], inspectionQueue: [] };
      const nextDashboard = {
        ...responseDashboard,
        inspectionQueue: (responseDashboard.inspectionQueue || []).filter((requirement: Item) =>
          requirement.requirementStatus === "PENDING_INSPECTION"),
      };
      setDashboard(nextDashboard);
      setSelectedQueueRunId((current) => {
        const availableRunIds = nextDashboard.inspectionQueue.map((requirement: Item) => Number(requirement.runId));
        if (preferredQueueRunId && availableRunIds.includes(preferredQueueRunId)) return preferredQueueRunId;
        return current && availableRunIds.includes(current) ? current : availableRunIds[0] || "";
      });
      setResultInputs((current) => {
        const next = { ...current };
        for (const requirement of nextDashboard.inspectionQueue || []) {
          for (const sample of requirement.samples || []) {
            const sampleId = Number(sample.sampleId);
            if (!next[sampleId]) {
              next[sampleId] = {
                actualValue: sample.actualValue || "",
                inspectionDate: dateForInput(sample.inspectedAt),
                inspectionResult: sample.inspectionResult === "FAIL" ? "FAIL" : "PASS",
                remarks: sample.remarks || "",
              };
            }
          }
        }
        return next;
      });
    } catch (reason) {
      setError(apiMessage(reason));
    } finally {
      if (initial) setLoading(false);
    }
  }, [preferredQueueRunId]);

  useEffect(() => {
    void (async () => {
      try {
        const response = await inProcessInspectionApi.parts();
        setParts(response.data || []);
      } catch (reason) {
        setError(apiMessage(reason));
      }
      await loadDashboard(true);
    })();
  }, [loadDashboard]);

  const selectedPartId = Number(production.partId || 0);
  useEffect(() => {
    if (!selectedPartId) {
      setProcesses([]);
      return;
    }
    void (async () => {
      try {
        setError("");
        const response = await inProcessInspectionApi.processPlans(selectedPartId);
        setProcesses(response.data || []);
      } catch (reason) {
        setError(apiMessage(reason));
        setProcesses([]);
      }
    })();
  }, [selectedPartId]);

  const selectedProcess = useMemo(() => {
    const [processPlanId, processOperationId] = production.processSelection.split(":").map(Number);
    return { processPlanId, processOperationId };
  }, [production.processSelection]);

  const queueRunOptions = useMemo(() => {
    const byRun = new Map<number, Item>();
    for (const requirement of dashboard.inspectionQueue || []) {
      const runId = Number(requirement.runId);
      if (runId && !byRun.has(runId)) byRun.set(runId, requirement);
    }
    return Array.from(byRun.entries()).map(([runId, requirement]) => ({ runId, requirement }));
  }, [dashboard.inspectionQueue]);

  const selectedInspectionQueue = useMemo(() => (dashboard.inspectionQueue || []).filter((requirement: Item) =>
    Number(requirement.runId) === selectedQueueRunId), [dashboard.inspectionQueue, selectedQueueRunId]);

  const inspectionRows = useMemo(() => inspectionRowsFor(selectedInspectionQueue), [selectedInspectionQueue]);
  const allInspectionRows = useMemo(() => inspectionRowsFor(dashboard.inspectionQueue || []), [dashboard.inspectionQueue]);
  const visibleInspectionRows = useMemo(() => {
    const search = queueSearch.trim().toLowerCase();
    if (!search) return inspectionRows;
    return allInspectionRows.filter((row) => [
      row.pieceReference,
      row.requirement.workOrderReference,
      row.requirement.batchReference,
      row.requirement.partNumber,
      row.requirement.operationNumber,
    ].some((value) => String(value || "").toLowerCase().includes(search)));
  }, [allInspectionRows, inspectionRows, queueSearch]);
  const selectedInspectionRow = useMemo(() => visibleInspectionRows.find((row) => row.key === selectedInspectionPieceKey)
    || visibleInspectionRows[0] || null, [selectedInspectionPieceKey, visibleInspectionRows]);
  const selectedPieceSubmissions = useMemo(() => {
    if (!selectedInspectionRow) return [];
    const submissions = new Map<number, { requirement: Item; samples: Item[] }>();
    for (const entry of selectedInspectionRow.entries) {
      const requirementId = Number(entry.requirement.requirementId);
      const current = submissions.get(requirementId) || { requirement: entry.requirement, samples: [] };
      current.samples.push(entry.sample);
      submissions.set(requirementId, current);
    }
    return Array.from(submissions.values());
  }, [selectedInspectionRow]);

  async function reportProduction(event: FormEvent) {
    event.preventDefault();
    try {
      setSaving(true); setError(""); setMessage("");
      const response = await inProcessInspectionApi.reportProduction({
        workOrderReference: production.workOrderReference,
        batchReference: production.batchReference,
        partId: selectedPartId,
        processPlanId: selectedProcess.processPlanId,
        processOperationId: selectedProcess.processOperationId,
        quantity: Number(production.quantity),
      });
      const result = response.data || {};
      setMessage(`Pieces ${result.fromPieceSequence}–${result.toPieceSequence} recorded. ${result.dueRequirementCount || 0} inspection requirement(s) created.`);
      setProduction((current) => ({ ...current, quantity: "1" }));
      await loadDashboard();
      navigate(`/operations/work-order-inspection/inspect?runId=${encodeURIComponent(String(result.runId || ""))}`);
    } catch (reason) {
      setError(apiMessage(reason));
    } finally {
      setSaving(false);
    }
  }

  function inputFor(sample: Item): ResultInput {
    return resultInputs[Number(sample.sampleId)] || {
      actualValue: "", inspectionDate: dateForInput(sample.inspectedAt), inspectionResult: "PASS", remarks: "",
    };
  }

  function calculatedResult(requirement: Item, actualValue: string): "PASS" | "FAIL" | null {
    const limits = rangeLimits(requirement);
    if (!limits || !actualValue.trim()) return null;
    const observedValue = Number(actualValue);
    if (!Number.isFinite(observedValue)) return "FAIL";
    return observedValue >= limits.lsl && observedValue <= limits.usl ? "PASS" : "FAIL";
  }

  function sampleResult(requirement: Item, sample: Item): "PASS" | "FAIL" {
    const input = inputFor(sample);
    return calculatedResult(requirement, input.actualValue) || input.inspectionResult;
  }

  function updateSample(requirement: Item, sampleId: number, update: Partial<ResultInput>) {
    const requirementId = Number(requirement.requirementId);
    autoSaveBlockedRequirementIds.current.delete(requirementId);
    setResultInputs((current) => ({
      ...current,
      [sampleId]: (() => {
        const next = {
          actualValue: "", inspectionDate: dateForInput(undefined), inspectionResult: "PASS" as const, remarks: "",
          ...current[sampleId], ...update,
        };
        return { ...next, inspectionResult: calculatedResult(requirement, next.actualValue) || next.inspectionResult };
      })(),
    }));
  }

  function updateFailureRemarks(requirementId: number, value: string) {
    autoSaveBlockedRequirementIds.current.delete(requirementId);
    setFailureRemarks((current) => ({ ...current, [requirementId]: value }));
  }

  function requirementHasFailure(requirement: Item, samples = requirement.samples || []) {
    return samples.some((sample: Item) =>
      Boolean(inputFor(sample).actualValue.trim()) && sampleResult(requirement, sample) === "FAIL");
  }

  function validationErrorFor(requirement: Item, samples: Item[]) {
    const inputs = samples.map((sample: Item) => ({ sampleId: Number(sample.sampleId), ...inputFor(sample) }));
    const hasFailure = inputs.some((sample) => sample.inspectionResult === "FAIL");
    const containmentRemarks = failureRemarks[Number(requirement.requirementId)] || "";
    const reference = samples[0]?.pieceReference || requirement.triggerPieceReference || `inspection ${requirement.requirementId}`;

    if (!rangeLimits(requirement)) {
      return `${reference}: configure valid numeric LSL and USL limits in the Inspection Plan`;
    }
    if (inputs.some((sample) => !sample.actualValue.trim())) {
      return `${reference}: enter an observed value for every selected sample`;
    }
    if (inputs.some((sample) => !sample.inspectionDate)) {
      return `${reference}: enter the inspection date`;
    }
    if (inputs.some((sample) => !Number.isFinite(Number(sample.actualValue)))) {
      return `${reference}: enter a numeric observed value between the LSL and USL limits`;
    }
    if (hasFailure && !containmentRemarks.trim()) {
      return `${reference}: enter failure and containment remarks`;
    }
    return "";
  }

  function inspectionPayload(requirement: Item, samples: Item[]) {
    const sampleResults = samples.map((sample: Item) => ({
      sampleId: Number(sample.sampleId), ...inputFor(sample), inspectionResult: sampleResult(requirement, sample),
    }));
    return {
      requirementId: Number(requirement.requirementId),
      samples: sampleResults,
      failureRemarks: failureRemarks[Number(requirement.requirementId)] || "",
    };
  }

  async function saveInspections(submissions: Array<{ requirement: Item; samples: Item[] }>, automatic = false) {
    if (!submissions.length) return;
    const invalid = submissions.map(({ requirement, samples }) => validationErrorFor(requirement, samples)).filter(Boolean);
    if (invalid.length) {
      if (!automatic) setError(`Cannot record this piece inspection. ${invalid.join(". ")}.`);
      return;
    }
    try {
      setSaving(true); setError(""); setMessage("");
      const response = await inProcessInspectionApi.completeInspections({ inspections: submissions.map(({ requirement, samples }) => inspectionPayload(requirement, samples)) });
      const completedCount = Number(response.data?.completedCount || submissions.length);
      const piece = selectedInspectionRow?.pieceReference;
      setMessage(automatic ? `Auto-saved ${completedCount} inspection result(s).` : `${completedCount} inspection result(s) recorded${piece ? ` for ${piece}` : ""}.`);
      setFailureRemarks((current) => {
        const next = { ...current };
        for (const { requirement } of submissions) delete next[Number(requirement.requirementId)];
        return next;
      });
      setResultInputs((current) => {
        const next = { ...current };
        for (const { samples } of submissions) {
          for (const sample of samples) delete next[Number(sample.sampleId)];
        }
        return next;
      });
      setSelectedInspectionPieceKey("");
      await loadDashboard();
    } catch (reason) {
      if (automatic) {
        for (const { requirement } of submissions) autoSaveBlockedRequirementIds.current.add(Number(requirement.requirementId));
      }
      setError(apiMessage(reason));
    } finally {
      setSaving(false);
    }
  }

  async function saveSelectedPieceInspection() {
    if (!selectedPieceSubmissions.length) {
      setMessage("Find and select one pending piece to inspect.");
      return;
    }
    await saveInspections(selectedPieceSubmissions);
  }

  useEffect(() => {
    if (!autoSaveEnabled || saving) return;
    const readySubmissions = selectedPieceSubmissions.filter(({ requirement, samples }) =>
      !autoSaveBlockedRequirementIds.current.has(Number(requirement.requirementId))
      && !validationErrorFor(requirement, samples));
    if (!readySubmissions.length) return;
    const timer = window.setTimeout(() => { void saveInspections(readySubmissions, true); }, 1200);
    return () => window.clearTimeout(timer);
  }, [autoSaveEnabled, saving, resultInputs, failureRemarks, selectedPieceSubmissions]);

  const pageTitle = pageMode === "CREATE"
    ? "Create Work/Batch Order"
    : pageMode === "INSPECT"
      ? "Work Order Inspection"
      : "Work Order Inspection Status";
  const pageSubtitle = pageMode === "CREATE"
    ? "Create a work or batch order and generate its traceable production pieces."
    : pageMode === "INSPECT"
      ? "Find a pending piece and record its inspection results one piece at a time."
      : "Review production, pending inspection and quality status by work order.";

  return <main className="inprocess-page">
    <header className="inprocess-header">
      <div><h1>{pageTitle}</h1><p>{pageSubtitle}</p></div>
      <div className="inprocess-header-actions">{pageMode === "STATUS" ? <button type="button" className="inprocess-primary" disabled={saving} onClick={() => navigate("/operations/work-order-inspection/create")}><Plus size={16}/>Create Work/Batch Order</button> : <button type="button" className="inprocess-secondary" disabled={saving} onClick={() => navigate("/operations/work-order-inspection")}>Work Order Inspection Status</button>}<button type="button" className="inprocess-secondary" disabled={saving} onClick={() => void loadDashboard()}><RefreshCw size={16}/>Refresh</button></div>
    </header>

    <section className="inprocess-guide"><ClipboardCheck size={22}/><div><strong>Counter rule</strong><span>100% creates a check for every produced piece. A 1-of-5 characteristic becomes due at pieces 5, 10, 15… alongside any 100% checks on that same piece.</span></div></section>
    {error && <div className="inprocess-alert error"><AlertTriangle size={17}/>{error}</div>}
    {message && <div className="inprocess-alert success"><CheckCircle2 size={17}/>{message}</div>}

    {pageMode === "STATUS" && <section className="inprocess-card inprocess-runs"><header><Factory size={18}/><div><h2>Work Order Inspection Status</h2><p>Review the production, pending inspection and quality status for each work order first.</p></div></header>
      <div className="inprocess-table-wrap"><table><thead><tr><th>Work order / batch</th><th>Part / operation</th><th>Produced</th><th>Inspection pending</th><th>Status</th><th>Action</th></tr></thead><tbody>{loading ? <tr><td colSpan={6}>Loading work order status…</td></tr> : (dashboard.runs || []).length ? dashboard.runs.map((run: Item) => <tr key={run.runId}><td><strong>{run.workOrderReference}</strong><small>{run.batchReference || "No batch"}</small></td><td><strong>{run.partNumber}</strong><small>Op {run.operationNumber} · {run.operationName}</small></td><td>{Number(run.producedCount || 0).toLocaleString("en-IN")}</td><td>{Number(run.pendingPieceCount || 0).toLocaleString("en-IN")}</td><td><span className={`inprocess-status ${String(run.runStatus).toLowerCase()}`}>{String(run.runStatus).replace(/_/g, " ")}</span>{run.holdReason && <small>{run.holdReason}</small>}</td><td><button type="button" className="inprocess-secondary" disabled={saving || Number(run.pendingPieceCount || 0) < 1 || String(run.runStatus).toUpperCase() !== "ACTIVE"} onClick={() => navigate(`/operations/work-order-inspection/inspect?runId=${encodeURIComponent(String(run.runId))}`)}>Inspect</button></td></tr>) : <tr><td colSpan={6}>No work order production has been reported.</td></tr>}</tbody></table></div>
    </section>}

    {pageMode === "CREATE" && <section className="inprocess-card">
      <header><Factory size={18}/><div><h2>Report production pieces</h2><p>Creates traceable piece references and all inspection requirements due at the reported counts. Transfer to the next operation remains quality-controlled.</p></div></header>
      <form className="inprocess-production-form" onSubmit={reportProduction}>
        <label><span>Work order / Job card <b>*</b></span><input required value={production.workOrderReference} onChange={(event) => setProduction({ ...production, workOrderReference: event.target.value })} placeholder="WO-2026-001" /></label>
        <label><span>Batch / Lot</span><input value={production.batchReference} onChange={(event) => setProduction({ ...production, batchReference: event.target.value })} placeholder="Optional batch" /></label>
        <label><span>Part <b>*</b></span><select required value={production.partId} onChange={(event) => setProduction({ ...production, partId: event.target.value, processSelection: "" })}><option value="">Select approved Part</option>{parts.map((part) => <option key={part.partId} value={part.partId}>{part.partNumber} — {part.partName}</option>)}</select></label>
        <label><span>Process operation <b>*</b></span><select required disabled={!selectedPartId} value={production.processSelection} onChange={(event) => setProduction({ ...production, processSelection: event.target.value })}><option value="">Select ready inspection operation</option>{processes.map((process) => <option key={process.processOperationId} value={`${process.processPlanId}:${process.processOperationId}`}>{process.planCode || "Plan"} · Op {process.operationNumber} — {process.operationName} ({process.characteristicCount} checks)</option>)}</select></label>
        <label><span>Produced quantity <b>*</b></span><input required type="number" min="1" max="500" step="1" value={production.quantity} onChange={(event) => setProduction({ ...production, quantity: event.target.value })} /></label>
        <button type="submit" className="inprocess-primary" disabled={saving || !production.processSelection}>{saving ? "Saving…" : "Report pieces"}</button>
      </form>
    </section>}

    {pageMode === "INSPECT" && <><section className="inprocess-card inprocess-sampling-guide"><header><ClipboardCheck size={18}/><div><h2>Automatic sample selection</h2><p>Samples are selected automatically from each triggered frequency window.</p></div></header>
      <div className="inprocess-queue"><p className="inprocess-empty">For sample size 1 at frequency 5, piece 5 is selected automatically. For sample size 2 at frequency 10, pieces 1 and 5 are selected; the next window selects pieces 11 and 15.</p></div>
    </section>

    <form className="inprocess-card inprocess-workorder-inspection-form" onSubmit={(event) => { event.preventDefault(); void saveSelectedPieceInspection(); }}><header className="inprocess-inspection-header"><div className="inprocess-inspection-title"><ClipboardCheck size={18}/><div><h2>Work Order Inspection</h2><p>Find one pending piece and record its inspection results as a separate inspection form.</p></div></div><div className="inprocess-inspection-actions"><div className="inprocess-inspection-filters"><label className="inprocess-queue-search"><span>Find piece / work order</span><input value={queueSearch} onChange={(event) => { setQueueSearch(event.target.value); setSelectedInspectionPieceKey(""); }} placeholder="Piece no. or work order"/></label><label className="inprocess-queue-operation"><span>Operation queue</span><select value={selectedQueueRunId} disabled={saving || !queueRunOptions.length} onChange={(event) => { setSelectedQueueRunId(Number(event.target.value) || ""); setSelectedInspectionPieceKey(""); }}>{queueRunOptions.map(({ runId, requirement }) => <option key={runId} value={runId}>{requirement.workOrderReference} · {requirement.partNumber} · Op {requirement.operationNumber} — {requirement.operationName}</option>)}</select></label><label className="inprocess-piece-select"><span>Piece to inspect</span><select value={selectedInspectionRow?.key || ""} disabled={saving || !visibleInspectionRows.length} onChange={(event) => setSelectedInspectionPieceKey(event.target.value)}>{visibleInspectionRows.map((row) => <option key={row.key} value={row.key}>{row.pieceReference} · {row.requirement.workOrderReference}</option>)}</select></label></div><div className="inprocess-inspection-submit-row"><label className={`inprocess-autosave-toggle ${autoSaveEnabled ? "enabled" : ""}`}><input type="checkbox" checked={autoSaveEnabled} disabled={saving} onChange={(event) => setAutoSaveEnabled(event.target.checked)}/><span>Auto-save <b>{autoSaveEnabled ? "On" : "Off"}</b></span></label><button type="submit" className="inprocess-primary" disabled={saving || !selectedPieceSubmissions.length}><Save size={15}/>{saving ? "Saving…" : "Record piece inspection"}</button></div></div></header>
      <div className="inprocess-table-wrap"><table className="inprocess-inspection-table" data-app-header-filter-disabled="true">
        <colgroup><col className="inprocess-piece-column"/><col className="inprocess-date-column"/><col className="inprocess-characteristic-column"/><col className="inprocess-sampling-column"/><col className="inprocess-limit-column"/><col className="inprocess-limit-column"/><col className="inprocess-instrument-column"/><col className="inprocess-observed-column"/><col className="inprocess-remarks-column"/><col className="inprocess-containment-column"/></colgroup>
        <thead><tr><th>Piece / Work order</th><th>Inspection date</th><th>Characteristic</th><th>Sample / Frequency</th><th>LSL</th><th>USL</th><th>Instrument / Gauge</th><th>Observed value</th><th>Remarks</th><th>Failure containment</th></tr></thead>
        <tbody>{selectedInspectionRow ? (() => {
          const row = selectedInspectionRow;
          const statuses = row.entries.map((entry) => {
            const input = inputFor(entry.sample);
            return input.actualValue.trim() ? sampleResult(entry.requirement, entry.sample) : null;
          });
          const status = statuses.includes("FAIL") ? "FAIL" : row.entries.length && statuses.every((entry) => entry === "PASS") ? "PASS" : null;
          return <tr key={row.key} className={status === "PASS" ? "inprocess-inspection-pass" : status === "FAIL" ? "inprocess-inspection-fail" : undefined}>
            <td><strong>{row.pieceReference}</strong><small>{row.requirement.workOrderReference} · {row.requirement.partNumber} · Op {row.requirement.operationNumber}</small></td>
            {row.entries.length ? <>
              <td><div className="inprocess-piece-inspection-list">{row.entries.map(({ requirement, sample }) => { const input = inputFor(sample); return <div key={sample.sampleId} className="inprocess-piece-inspection-line"><input required type="date" aria-label={`${sample.pieceReference} inspection date`} value={input.inspectionDate} onChange={(event) => updateSample(requirement, Number(sample.sampleId), { inspectionDate: event.target.value })}/></div>; })}</div></td>
              <td><div className="inprocess-piece-inspection-list">{row.entries.map(({ requirement, sample }) => <div key={sample.sampleId} className="inprocess-piece-inspection-line"><strong>{requirement.characteristicName}</strong><small>{requirement.characteristicCode || "Manual characteristic"}</small></div>)}</div></td>
              <td><div className="inprocess-piece-inspection-list">{row.entries.map(({ requirement, sample }) => <div key={sample.sampleId} className="inprocess-piece-inspection-line"><strong>{samplingDisplay(requirement)}</strong></div>)}</div></td>
              <td><div className="inprocess-piece-inspection-list">{row.entries.map(({ requirement, sample }) => <div key={sample.sampleId} className="inprocess-piece-inspection-line">{requirement.lsl ?? "—"}</div>)}</div></td>
              <td><div className="inprocess-piece-inspection-list">{row.entries.map(({ requirement, sample }) => <div key={sample.sampleId} className="inprocess-piece-inspection-line">{requirement.usl ?? "—"}</div>)}</div></td>
              <td><div className="inprocess-piece-inspection-list">{row.entries.map(({ requirement, sample }) => <div key={sample.sampleId} className="inprocess-piece-inspection-line">{requirement.instrumentName || "—"}</div>)}</div></td>
              <td><div className="inprocess-piece-inspection-list">{row.entries.map(({ requirement, sample }) => { const input = inputFor(sample); return <div key={sample.sampleId} className="inprocess-piece-inspection-line"><input required inputMode="decimal" aria-label={`${sample.pieceReference} observed value`} value={input.actualValue} onChange={(event) => updateSample(requirement, Number(sample.sampleId), { actualValue: event.target.value })} placeholder="Observed value"/></div>; })}</div></td>
              <td><div className="inprocess-piece-inspection-list">{row.entries.map(({ requirement, sample }) => { const input = inputFor(sample); return <div key={sample.sampleId} className="inprocess-piece-inspection-line"><input aria-label={`${sample.pieceReference} remarks`} value={input.remarks} onChange={(event) => updateSample(requirement, Number(sample.sampleId), { remarks: event.target.value })} placeholder="Sample remarks"/></div>; })}</div></td>
              <td><div className="inprocess-piece-inspection-list">{row.entries.map(({ requirement, sample }) => {
                const hasFailure = requirementHasFailure(requirement, [sample]);
                const requirementRemarks = failureRemarks[Number(requirement.requirementId)] || "";
                return <div key={sample.sampleId} className="inprocess-piece-inspection-line">{hasFailure ? <textarea className="inprocess-inline-failure" required value={requirementRemarks} onChange={(event) => updateFailureRemarks(Number(requirement.requirementId), event.target.value)} placeholder="Failure reason and containment action"/> : <span className="inprocess-not-required">Not required</span>}</div>;
              })}</div></td>
            </> : <td colSpan={9}><span className="inprocess-not-required">Not selected for this sampling window.</span></td>}
          </tr>;
        })() : <tr><td colSpan={10}>{queueSearch.trim() ? "No pending piece matches the entered piece number or work order." : "No inspection results are pending."}</td></tr>}</tbody>
      </table></div>
    </form></>}
  </main>;
}
