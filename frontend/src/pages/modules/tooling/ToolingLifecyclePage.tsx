import {
  AlertTriangle, ArrowRight, ClipboardCheck, Factory, History,
  PackageCheck, Plus, RefreshCw, Search, Send, Wrench, X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { apiMessage } from "../../../api/client";
import { toolingApi } from "../../../api/tooling.api";
import { useAppFeedback } from "../../../components/AppFeedback";
import { todayInAppTimeZone } from "../../../utils/formatDateTime";
import "./ToolingLifecyclePage.css";

type ToolItem = {
  itemId: number; itemCode: string; itemDescription: string; specification?: string | null; uomCode?: string | null;
  toolCribQuantity: number | string; issuedQuantity: number | string; holdQuantity: number | string;
  regrindRequiredQuantity: number | string; regrindEventCount: number | string; inspectionPlanDefined: boolean | number;
};
type Location = { locationMasterId: number; warehouseName: string; locationName: string; issuedQuantity?: number | string };
type ToolingMachine = { machineCode: string; machineName: string; locationName?: string; issuedQuantity?: number | string };
type Lookup = { toolCribLocations: Location[]; productionLocations: Location[]; machines: ToolingMachine[]; operations: Array<{ operationCode: string; operationName: string }>; suppliers: Array<{ supplierId: number; supplierCode: string; supplierName: string }>; issuedReturnLocations?: Location[]; issuedReturnMachines?: ToolingMachine[] };
type MeasurementPlan = { itemInspectionCharacteristicId: number; sequenceNumber: number; characteristicName: string; specifiedDimension?: number | null; lsl?: number | null; usl?: number | null; instrumentName?: string | null };
type BatchItem = {
  toolingRegrindBatchItemId: number; itemId: number; itemCode: string; itemDescription: string; specification?: string | null; uomCode?: string | null;
  dispatchedQuantity: number | string; receivedQuantity: number | string; acceptedQuantity: number | string; rejectedQuantity: number | string;
  lineStatus: string; inspectionPlan?: MeasurementPlan[]; measurements?: Array<{ itemInspectionCharacteristicId: number; actualValue: string; remarks?: string | null }>;
};
type RegrindBatch = {
  toolingRegrindBatchId: number; dcNumber: string; dispatchDate: string; supplierName: string; expectedReturnDate?: string | null;
  receiptDate?: string | null; status: "DISPATCHED" | "RECEIVED_PENDING_INSPECTION" | "CLOSED" | "CANCELLED"; itemCount: number | string;
  dispatchedQuantity: number | string; receivedQuantity: number | string; items?: BatchItem[];
};
type Movement = { toolingStockMovementId: number; movementType: string; movementDate: string; quantity: number | string; itemCode: string; itemDescription: string; uomCode?: string | null; fromWarehouseCode?: string | null; fromBinLocation?: string | null; toWarehouseCode?: string | null; toBinLocation?: string | null; referenceNumber?: string | null; machineReference?: string | null; employeeReference?: string | null; operationReference?: string | null };
type IssuedTool = { itemId: number; itemCode: string; itemDescription: string; specification?: string | null; uomCode?: string | null; locationName: string; machineReference: string; issuedQuantity: number | string; lastIssueDate?: string | null; issuedToEmployees?: string | null; issuedForOperations?: string | null; issueReferences?: string | null };
type Dashboard = { toolCribQuantity?: number | string; issuedQuantity?: number | string; holdQuantity?: number | string; regrindRequiredQuantity?: number | string; dispatchedBatchCount?: number | string; awaitingInspectionBatchCount?: number | string };
type Action = "ISSUE" | "RETURN" | "DISPATCH" | "RECEIVE" | "INSPECT";
type DispatchLine = { itemId: string; quantity: string; sourceStockStatus: "AVAILABLE" | "REGRIND_REQUIRED" };
type TransferLine = { itemId: string; quantity: string };
type InspectionInput = { acceptedQuantity: string; rejectedQuantity: string; rejectionAction: string; inspectionRemarks: string; measurements: Record<number, { actualValue: string; remarks: string }> };
type ReturnCondition = "AVAILABLE" | "DAMAGED_REGRIND" | "LOST" | "SCRAP";
type TransferForm = { warehouseCode: string; binLocation: string; machineReference: string; employeeReference: string; operationReference?: string; movementDate: string; referenceNumber: string; remarks: string; returnCondition: ReturnCondition };
type DispatchFormValue = { supplierId: string; dcNumber: string; dispatchDate: string; expectedReturnDate: string; courierVehicleReference: string; remarks: string };

const quantity = (value: number | string | undefined | null) => Number(value || 0);
const fixed = (value: number | string | undefined | null) => quantity(value).toLocaleString("en-IN", { maximumFractionDigits: 3 });
const locationLabel = (warehouse?: string | null, bin?: string | null) => [warehouse, bin].filter(Boolean).join(" / ") || "—";
const humanize = (value: string) => value.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const blankTransfer = (): TransferForm => ({ warehouseCode: "Production Stores", binLocation: "", machineReference: "", employeeReference: "", operationReference: "", movementDate: todayInAppTimeZone(), referenceNumber: "", remarks: "", returnCondition: "AVAILABLE" });
const blankTransferLine = (): TransferLine => ({ itemId: "", quantity: "" });
const blankDispatch = (): DispatchFormValue => ({ supplierId: "", dcNumber: "", dispatchDate: todayInAppTimeZone(), expectedReturnDate: "", courierVehicleReference: "", remarks: "" });

export default function ToolingLifecyclePage() {
  const navigate = useNavigate();
  const { showSuccess } = useAppFeedback();
  const [dashboard, setDashboard] = useState<Dashboard>({});
  const [items, setItems] = useState<ToolItem[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [issuedTools, setIssuedTools] = useState<IssuedTool[]>([]);
  const [batches, setBatches] = useState<RegrindBatch[]>([]);
  const [baseLookup, setBaseLookup] = useState<Lookup>({ toolCribLocations: [], productionLocations: [], machines: [], operations: [], suppliers: [], issuedReturnLocations: [], issuedReturnMachines: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [stockSearch, setStockSearch] = useState("");
  const [stockStatus, setStockStatus] = useState("ALL");
  const [movementSearch, setMovementSearch] = useState("");
  const [movementType, setMovementType] = useState("ALL");
  const [movementFromDate, setMovementFromDate] = useState("");
  const [movementToDate, setMovementToDate] = useState("");
  const [batchSearch, setBatchSearch] = useState("");
  const [batchStatus, setBatchStatus] = useState("ALL");
  const [batchSupplier, setBatchSupplier] = useState("ALL");
  const [batchFromDate, setBatchFromDate] = useState("");
  const [batchToDate, setBatchToDate] = useState("");
  const [issuedSearch, setIssuedSearch] = useState("");
  const [tab, setTab] = useState<"OVERVIEW" | "STOCK" | "ISSUED" | "MOVEMENTS" | "REGRIND">("OVERVIEW");
  const [action, setAction] = useState<Action | null>(null);
  const [selectedBatch, setSelectedBatch] = useState<RegrindBatch | null>(null);
  const [issue, setIssue] = useState<TransferForm>(blankTransfer);
  const [returned, setReturned] = useState<TransferForm>(blankTransfer);
  const [issueLines, setIssueLines] = useState<TransferLine[]>([blankTransferLine()]);
  const [returnLines, setReturnLines] = useState<TransferLine[]>([blankTransferLine()]);
  const [dispatch, setDispatch] = useState<DispatchFormValue>(blankDispatch);
  const [dispatchLines, setDispatchLines] = useState<DispatchLine[]>([{ itemId: "", quantity: "", sourceStockStatus: "AVAILABLE" }]);
  const [receipt, setReceipt] = useState({ receiptDate: todayInAppTimeZone(), receiptReference: "", quantities: {} as Record<number, string> });
  const [inspectionDate, setInspectionDate] = useState(todayInAppTimeZone());
  const [inspection, setInspection] = useState<Record<number, InspectionInput>>({});

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [dashboardResult, itemResult, movementResult, issuedResult, batchResult, lookupResult] = await Promise.all([
        toolingApi.dashboard(), toolingApi.items({ stockOnly: "Y" }), toolingApi.movements({ limit: 100 }), toolingApi.issuedTools(), toolingApi.regrindBatches(), toolingApi.lookups(),
      ]);
      setDashboard(dashboardResult?.data || {});
      setItems(Array.isArray(itemResult?.data) ? itemResult.data : []);
      setMovements(Array.isArray(movementResult?.data) ? movementResult.data : []);
      setIssuedTools(Array.isArray(issuedResult?.data) ? issuedResult.data : []);
      setBatches(Array.isArray(batchResult?.data) ? batchResult.data : []);
      setBaseLookup(lookupResult?.data || { toolCribLocations: [], productionLocations: [], machines: [], operations: [], suppliers: [], issuedReturnLocations: [], issuedReturnMachines: [] });
    } catch (reason) { setError(apiMessage(reason)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filteredItems = useMemo(() => {
    const term = stockSearch.trim().toLowerCase();
    return items.filter((item) => {
      const matchesSearch = !term || `${item.itemCode} ${item.itemDescription} ${item.specification || ""}`.toLowerCase().includes(term);
      const matchesStatus = stockStatus === "ALL"
        || (stockStatus === "AVAILABLE" && quantity(item.toolCribQuantity) > 0)
        || (stockStatus === "ISSUED" && quantity(item.issuedQuantity) > 0)
        || (stockStatus === "REGRIND_REQUIRED" && quantity(item.regrindRequiredQuantity) > 0)
        || (stockStatus === "HOLD" && quantity(item.holdQuantity) > 0);
      return matchesSearch && matchesStatus;
    });
  }, [items, stockSearch, stockStatus]);
  const movementTypes = useMemo(() => [...new Set(movements.map((row) => row.movementType))].sort(), [movements]);
  const filteredMovements = useMemo(() => {
    const term = movementSearch.trim().toLowerCase();
    return movements.filter((row) => {
      const searchable = `${row.itemCode} ${row.itemDescription} ${row.referenceNumber || ""} ${row.machineReference || ""} ${row.employeeReference || ""}`.toLowerCase();
      return (!term || searchable.includes(term))
        && (movementType === "ALL" || row.movementType === movementType)
        && (!movementFromDate || row.movementDate >= movementFromDate)
        && (!movementToDate || row.movementDate <= movementToDate);
    });
  }, [movements, movementSearch, movementType, movementFromDate, movementToDate]);
  const suppliers = useMemo(() => [...new Set(batches.map((batch) => batch.supplierName).filter(Boolean))].sort(), [batches]);
  const filteredBatches = useMemo(() => {
    const term = batchSearch.trim().toLowerCase();
    return batches.filter((batch) => {
      const searchable = `${batch.dcNumber} ${batch.supplierName}`.toLowerCase();
      return (!term || searchable.includes(term))
        && (batchStatus === "ALL" || batch.status === batchStatus)
        && (batchSupplier === "ALL" || batch.supplierName === batchSupplier)
        && (!batchFromDate || batch.dispatchDate >= batchFromDate)
        && (!batchToDate || batch.dispatchDate <= batchToDate);
    });
  }, [batches, batchSearch, batchStatus, batchSupplier, batchFromDate, batchToDate]);
  const issueItems = items.filter((item) => quantity(item.toolCribQuantity) > 0);
  const issuedReturnLocations = useMemo(() => baseLookup.productionLocations
    .filter((location) => issuedTools.some((row) => row.locationName === location.locationName))
    .map((location) => ({ ...location, issuedQuantity: issuedTools.filter((row) => row.locationName === location.locationName).reduce((total, row) => total + quantity(row.issuedQuantity), 0) })), [baseLookup.productionLocations, issuedTools]);
  const issuedReturnMachines = useMemo(() => {
    const codes = [...new Set(issuedTools.filter((row) => row.locationName === returned.binLocation).map((row) => row.machineReference))];
    return codes.map((machineCode) => {
      const configured = baseLookup.machines.find((machine) => machine.machineCode === machineCode);
      return { machineCode, machineName: configured?.machineName || machineCode, locationName: returned.binLocation,
        issuedQuantity: issuedTools.filter((row) => row.locationName === returned.binLocation && row.machineReference === machineCode).reduce((total, row) => total + quantity(row.issuedQuantity), 0) };
    });
  }, [baseLookup.machines, issuedTools, returned.binLocation]);
  const returnItems = useMemo<ToolItem[]>(() => issuedTools
    .filter((row) => row.locationName === returned.binLocation && row.machineReference === returned.machineReference)
    .map((row) => ({ itemId: row.itemId, itemCode: row.itemCode, itemDescription: row.itemDescription, specification: row.specification, uomCode: row.uomCode,
      toolCribQuantity: 0, issuedQuantity: row.issuedQuantity, holdQuantity: 0, regrindRequiredQuantity: 0, regrindEventCount: 0, inspectionPlanDefined: false })), [issuedTools, returned.binLocation, returned.machineReference]);
  const filteredIssuedTools = useMemo(() => {
    const term = issuedSearch.trim().toLowerCase();
    return issuedTools.filter((row) => !term || `${row.itemCode} ${row.itemDescription} ${row.locationName} ${row.machineReference} ${row.issuedToEmployees || ""} ${row.issuedForOperations || ""} ${row.issueReferences || ""}`.toLowerCase().includes(term));
  }, [issuedSearch, issuedTools]);
  const dispatchableItems = items.filter((item) => quantity(item.toolCribQuantity) > 0 || quantity(item.regrindRequiredQuantity) > 0);

  const openRegrindOutward = () => navigate("/material-outward?purpose=TOOL_REGRIND");
  const openToolReturnInward = () => navigate("/grn-inward/new?inwardType=TOOL_RETURN");

  const close = () => { setAction(null); setSelectedBatch(null); setSaving(false); };
  const openAction = (next: Action) => {
    setError("");
    if (next === "ISSUE") { setIssue(blankTransfer()); setIssueLines([blankTransferLine()]); }
    if (next === "RETURN") { setReturned(blankTransfer()); setReturnLines([blankTransferLine()]); }
    setAction(next);
  };
  const openBatch = async (next: "RECEIVE" | "INSPECT", batchId: number) => {
    setError(""); setSaving(true);
    try {
      const result = await toolingApi.regrindBatch(batchId);
      const batch = result?.data as RegrindBatch;
      setSelectedBatch(batch);
      if (next === "RECEIVE") {
        setReceipt({ receiptDate: todayInAppTimeZone(), receiptReference: "", quantities: Object.fromEntries((batch.items || []).map((item) => [item.toolingRegrindBatchItemId, String(item.dispatchedQuantity)])) });
      } else {
        setInspectionDate(todayInAppTimeZone());
        setInspection(Object.fromEntries((batch.items || []).map((item) => {
          const previous = new Map((item.measurements || []).map((entry) => [entry.itemInspectionCharacteristicId, entry]));
          return [item.toolingRegrindBatchItemId, {
            acceptedQuantity: String(item.receivedQuantity), rejectedQuantity: "0", rejectionAction: "", inspectionRemarks: "",
            measurements: Object.fromEntries((item.inspectionPlan || []).map((plan) => [plan.itemInspectionCharacteristicId, { actualValue: previous.get(plan.itemInspectionCharacteristicId)?.actualValue || "", remarks: previous.get(plan.itemInspectionCharacteristicId)?.remarks || "" }])),
          }];
        })));
      }
      setAction(next);
    } catch (reason) { setError(apiMessage(reason)); }
    finally { setSaving(false); }
  };

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!action || saving) return;
    setSaving(true); setError("");
    try {
      if (action === "ISSUE") { await toolingApi.issue({ ...issue, items: issueLines.map((line) => ({ ...line, itemId: Number(line.itemId) })) }); showSuccess(`${issueLines.length} tool item${issueLines.length === 1 ? "" : "s"} issued.`); }
      if (action === "RETURN") { await toolingApi.returnFromProduction({ ...returned, items: returnLines.map((line) => ({ ...line, itemId: Number(line.itemId) })) }); showSuccess(returned.returnCondition === "AVAILABLE" ? "Tool quantities returned to Tool Crib." : returned.returnCondition === "DAMAGED_REGRIND" ? "Damaged tool quantities added for regrinding." : `Tool quantities recorded as ${returned.returnCondition.toLowerCase()}.`); }
      if (action === "DISPATCH") { await toolingApi.dispatchRegrind({ ...dispatch, items: dispatchLines.map((line) => ({ ...line, itemId: Number(line.itemId) })) }); showSuccess("Tool regrinding DC created."); }
      if (action === "RECEIVE" && selectedBatch) { await toolingApi.receiveRegrind(selectedBatch.toolingRegrindBatchId, { receiptDate: receipt.receiptDate, receiptReference: receipt.receiptReference, items: (selectedBatch.items || []).map((item) => ({ batchItemId: item.toolingRegrindBatchItemId, receivedQuantity: receipt.quantities[item.toolingRegrindBatchItemId] })) }); showSuccess("Regrinding DC received and queued for inspection."); }
      if (action === "INSPECT" && selectedBatch) {
        await toolingApi.inspectRegrind(selectedBatch.toolingRegrindBatchId, { inspectionDate, items: (selectedBatch.items || []).map((item) => {
          const row = inspection[item.toolingRegrindBatchItemId];
          return { batchItemId: item.toolingRegrindBatchItemId, acceptedQuantity: row?.acceptedQuantity, rejectedQuantity: row?.rejectedQuantity, rejectionAction: row?.rejectionAction, inspectionRemarks: row?.inspectionRemarks, measurements: (item.inspectionPlan || []).map((plan) => ({ itemInspectionCharacteristicId: plan.itemInspectionCharacteristicId, actualValue: row?.measurements[plan.itemInspectionCharacteristicId]?.actualValue || "", remarks: row?.measurements[plan.itemInspectionCharacteristicId]?.remarks || "" })) };
        }) });
        showSuccess("Regrinding inspection posted and Tool Crib stock updated.");
      }
      close(); await load();
    } catch (reason) { setError(apiMessage(reason)); }
    finally { setSaving(false); }
  }

  function changeInspectionQuantity(batchItem: BatchItem, field: "acceptedQuantity" | "rejectedQuantity", value: string) {
    const row = inspection[batchItem.toolingRegrindBatchItemId]; const received = quantity(batchItem.receivedQuantity); const next = { ...row, [field]: value };
    if (field === "acceptedQuantity" && quantity(value) >= received) { next.acceptedQuantity = String(received); next.rejectedQuantity = "0"; next.rejectionAction = ""; }
    setInspection((current) => ({ ...current, [batchItem.toolingRegrindBatchItemId]: next }));
  }

  return <div className="page-container tooling-page">
    <header className="tooling-hero"><div><p className="tooling-eyebrow"><Wrench size={19} />Tooling Control</p></div><div className="tooling-header-actions"><button type="button" className="tooling-primary" onClick={openRegrindOutward}><Plus size={16} />Create Regrinding DC</button></div></header>
    {error && <section className="tooling-error" role="alert">{error}</section>}
    <section className="process-map" aria-label="Quantity-based tooling flow"><div className="process-map-heading"><div><h2>TOOLING WORKFLOW</h2></div><span>Each transaction tracks one or more tool items, quantities and a shared reference—not individual serials.</span></div><div className="process-lane"><ProcessStage number="01" title="Tool Crib" detail="Posted stock available" tone="green" onClick={() => setTab("STOCK")} /><ArrowRight /><ProcessStage number="02" title="Issued Quantity" detail="Bulk issue and return" tone="indigo" onClick={() => openAction("ISSUE")} /><ArrowRight /><ProcessStage number="03" title="Regrinding DC" detail="Bulk supplier dispatch" tone="orange" onClick={openRegrindOutward} /><ArrowRight /><ProcessStage number="04" title="Receipt & Inspection" detail="Inspect against defined parameters" tone="purple" onClick={() => setTab("REGRIND")} /></div></section>
    <section className="tooling-kpis"><button type="button" onClick={() => setTab("STOCK")}><i className="green"><PackageCheck /></i><span><b>{fixed(dashboard.toolCribQuantity)}</b>Tool Crib available</span></button><button type="button" onClick={() => setTab("ISSUED")}><i className="blue"><Factory /></i><span><b>{fixed(dashboard.issuedQuantity)}</b>Issued quantity</span></button><button type="button" onClick={() => setTab("REGRIND")}><i className="orange"><Send /></i><span><b>{fixed(dashboard.dispatchedBatchCount)}</b>Regrinding DCs dispatched</span></button><button type="button" onClick={() => setTab("REGRIND")}><i className="purple"><ClipboardCheck /></i><span><b>{fixed(dashboard.awaitingInspectionBatchCount)}</b>Awaiting inspection</span></button><button type="button" onClick={() => setTab("STOCK")}><i className="red"><AlertTriangle /></i><span><b>{fixed(quantity(dashboard.holdQuantity) + quantity(dashboard.regrindRequiredQuantity))}</b>Hold / regrind required</span></button></section>
    <nav className="tooling-tabs" aria-label="Tooling views"><button type="button" className={tab === "OVERVIEW" ? "active" : ""} onClick={() => setTab("OVERVIEW")}>Overview</button><button type="button" className={tab === "STOCK" ? "active" : ""} onClick={() => setTab("STOCK")}>Tool Stock</button><button type="button" className={tab === "ISSUED" ? "active" : ""} onClick={() => setTab("ISSUED")}>Issued Tools</button><button type="button" className={tab === "MOVEMENTS" ? "active" : ""} onClick={() => setTab("MOVEMENTS")}>Movement Ledger</button><button type="button" className={tab === "REGRIND" ? "active" : ""} onClick={() => setTab("REGRIND")}>Regrinding DCs</button></nav>
    {loading ? <section className="tooling-card tooling-loading">Loading Tooling lifecycle…</section> : <>
      {tab === "OVERVIEW" && <section className="tooling-overview-grid"><div className="tooling-card span-3"><div className="tooling-card-title"><div><h2>Recent lifecycle activity</h2><p>Recent posted tooling transactions</p></div><History size={20} /></div><MovementTable rows={movements.slice(0, 6)} /></div></section>}
      {tab === "STOCK" && <section className="tooling-card tooling-register"><FilterToolbar search={stockSearch} setSearch={setStockSearch} placeholder="Search tool code, description or specification" count={filteredItems.length} label="tool items" onRefresh={() => void load()}><select aria-label="Filter tool stock status" value={stockStatus} onChange={(event) => setStockStatus(event.target.value)}><option value="ALL">All stock statuses</option><option value="AVAILABLE">Tool Crib available</option><option value="ISSUED">Issued quantity</option><option value="REGRIND_REQUIRED">Regrind required</option><option value="HOLD">On hold</option></select></FilterToolbar><ToolStockTable rows={filteredItems} onIssue={() => openAction("ISSUE")} onReturn={() => openAction("RETURN")} onViewIssued={(item) => { setIssuedSearch(item.itemCode); setTab("ISSUED"); }} onDispatch={openRegrindOutward} /></section>}
      {tab === "ISSUED" && <section className="tooling-card tooling-register"><div className="tooling-card-title"><div><h2>Issued tool register</h2><p>Outstanding tool quantities by production location and machine.</p></div><button type="button" className="tooling-primary" onClick={() => openAction("RETURN")}><Plus size={15} />Bulk Return</button></div><FilterToolbar search={issuedSearch} setSearch={setIssuedSearch} placeholder="Search tool, location, machine, employee or reference" count={filteredIssuedTools.length} label="issued tool rows" onRefresh={() => void load()} /><IssuedToolTable rows={filteredIssuedTools} /></section>}
      {tab === "MOVEMENTS" && <section className="tooling-card tooling-register"><FilterToolbar search={movementSearch} setSearch={setMovementSearch} placeholder="Search item, reference, machine or employee" count={filteredMovements.length} label="movements" onRefresh={() => void load()}><select aria-label="Filter movement type" value={movementType} onChange={(event) => setMovementType(event.target.value)}><option value="ALL">All movement types</option>{movementTypes.map((type) => <option key={type} value={type}>{humanize(type)}</option>)}</select><label className="tooling-date-filter"><span>From</span><input aria-label="Movement date from" type="date" value={movementFromDate} onChange={(event) => setMovementFromDate(event.target.value)} /></label><label className="tooling-date-filter"><span>To</span><input aria-label="Movement date to" type="date" value={movementToDate} onChange={(event) => setMovementToDate(event.target.value)} /></label></FilterToolbar><MovementTable rows={filteredMovements} /></section>}
      {tab === "REGRIND" && <section className="tooling-card tooling-register"><div className="tooling-card-title"><div><h2>Regrinding DC register</h2><p>One DC can contain multiple tool items and quantities.</p></div><button type="button" className="tooling-primary" onClick={openRegrindOutward}><Plus size={15} />Create DC</button></div><FilterToolbar search={batchSearch} setSearch={setBatchSearch} placeholder="Search DC number or supplier" count={filteredBatches.length} label="regrinding DCs" onRefresh={() => void load()}><select aria-label="Filter regrinding DC status" value={batchStatus} onChange={(event) => setBatchStatus(event.target.value)}><option value="ALL">All statuses</option><option value="DISPATCHED">Dispatched</option><option value="RECEIVED_PENDING_INSPECTION">Awaiting inspection</option><option value="CLOSED">Closed</option><option value="CANCELLED">Cancelled</option></select><select aria-label="Filter regrinding supplier" value={batchSupplier} onChange={(event) => setBatchSupplier(event.target.value)}><option value="ALL">All suppliers</option>{suppliers.map((supplier) => <option key={supplier} value={supplier}>{supplier}</option>)}</select><label className="tooling-date-filter"><span>From</span><input aria-label="Dispatch date from" type="date" value={batchFromDate} onChange={(event) => setBatchFromDate(event.target.value)} /></label><label className="tooling-date-filter"><span>To</span><input aria-label="Dispatch date to" type="date" value={batchToDate} onChange={(event) => setBatchToDate(event.target.value)} /></label></FilterToolbar><RegrindBatchTable rows={filteredBatches} onReceive={openToolReturnInward} onInspect={(batchId) => void openBatch("INSPECT", batchId)} onViewDc={(dcNumber) => navigate(`/material-outward?type=TOOL_REGRIND&search=${encodeURIComponent(dcNumber)}`)} /></section>}
    </>}
    {action && <div className="tool-modal-layer" role="dialog" aria-modal="true"><form className="tool-modal tooling-transaction-modal" onSubmit={(event) => void submit(event)}><header><div><p>TOOLING TRANSACTION</p><h2>{action === "ISSUE" ? "Bulk tool issue" : action === "RETURN" ? "Bulk tool return" : action === "DISPATCH" ? "Create Tool Regrinding DC" : action === "RECEIVE" ? "Receive regrinding DC" : "Inspect reground tools"}</h2></div><button type="button" onClick={close} aria-label="Close"><X /></button></header>{action === "ISSUE" && <BulkTransferForm value={issue} setValue={setIssue} lines={issueLines} setLines={setIssueLines} items={issueItems} productionLocations={baseLookup.productionLocations} machines={baseLookup.machines} operations={baseLookup.operations} type="ISSUE" />}{action === "RETURN" && <BulkTransferForm value={returned} setValue={setReturned} lines={returnLines} setLines={setReturnLines} items={returnItems} productionLocations={issuedReturnLocations} machines={issuedReturnMachines} operations={baseLookup.operations} type="RETURN" />}{action === "DISPATCH" && <DispatchForm value={dispatch} setValue={setDispatch} lines={dispatchLines} setLines={setDispatchLines} items={dispatchableItems} suppliers={baseLookup.suppliers} />}{action === "RECEIVE" && selectedBatch && <ReceiveForm batch={selectedBatch} value={receipt} setValue={setReceipt} />}{action === "INSPECT" && selectedBatch && <InspectForm batch={selectedBatch} inspectionDate={inspectionDate} setInspectionDate={setInspectionDate} rows={inspection} setRows={setInspection} changeQuantity={changeInspectionQuantity} />}{error && <div className="modal-notice">{error}</div>}<footer><button type="button" onClick={close}>Cancel</button><button className="tooling-primary" disabled={saving} type="submit">{saving ? "Saving…" : action === "DISPATCH" ? "Create DC" : action === "RECEIVE" ? "Receive DC" : action === "INSPECT" ? "Post inspection" : "Save transaction"}</button></footer></form></div>}
  </div>;
}

function FilterToolbar({ search, setSearch, placeholder, count, label, onRefresh, children }: { search: string; setSearch: (value: string) => void; placeholder: string; count: number; label: string; onRefresh: () => void; children?: ReactNode }) { return <div className="tooling-list-toolbar"><label className="tooling-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={placeholder} /></label>{children}<button type="button" className="tooling-filter-refresh" onClick={onRefresh}><RefreshCw size={14} />Refresh</button><span className="tooling-filter-count">{count} {label}</span></div>; }
function ToolStockTable({ rows, onIssue, onReturn, onViewIssued, onDispatch }: { rows: ToolItem[]; onIssue: () => void; onReturn: () => void; onViewIssued: (item: ToolItem) => void; onDispatch: () => void }) { return <div className="tool-table-wrap"><table className="tool-table"><thead><tr><th>Tool item</th><th>Tool Crib</th><th>Issued quantity</th><th>Regrind required</th><th>On hold</th><th>Regrind events</th><th>Action</th></tr></thead><tbody>{rows.length ? rows.map((item) => <tr key={item.itemId}><td><strong>{item.itemCode}</strong><b>{item.itemDescription}</b><small>{item.specification || "—"} · {item.uomCode || ""}</small></td><td>{fixed(item.toolCribQuantity)}</td><td>{fixed(item.issuedQuantity)}</td><td>{fixed(item.regrindRequiredQuantity)}</td><td>{fixed(item.holdQuantity)}</td><td>{fixed(item.regrindEventCount)}</td><td><div className="tool-inline-actions">{quantity(item.toolCribQuantity) > 0 && <button type="button" className="table-action" onClick={onIssue}>Issue</button>}{quantity(item.issuedQuantity) > 0 && <><button type="button" className="table-action" onClick={onReturn}>Return</button><button type="button" className="table-action" onClick={() => onViewIssued(item)}>View issued</button></>}{(quantity(item.toolCribQuantity) > 0 || quantity(item.regrindRequiredQuantity) > 0) && <button type="button" className="table-action" onClick={onDispatch}>Regrind DC</button>}</div></td></tr>) : <tr><td colSpan={7}><div className="tooling-empty-row">No posted tool stock found.</div></td></tr>}</tbody></table></div>; }
function IssuedToolTable({ rows }: { rows: IssuedTool[] }) { return <div className="tool-table-wrap"><table className="tool-table"><thead><tr><th>Tool item</th><th>Issued quantity</th><th>Issued at</th><th>Machine</th><th>Issued to / operation</th><th>Issue reference</th></tr></thead><tbody>{rows.length ? rows.map((row) => <tr key={`${row.itemId}-${row.locationName}-${row.machineReference}`}><td><strong>{row.itemCode}</strong><b>{row.itemDescription}</b><small>{row.specification || "—"} · {row.uomCode || ""}</small></td><td>{fixed(row.issuedQuantity)} {row.uomCode || ""}</td><td>Production Stores<small>{row.locationName}</small></td><td>{row.machineReference}</td><td>{row.issuedToEmployees || "—"}<small>{row.issuedForOperations || "—"}</small></td><td>{row.issueReferences || "—"}<small>{row.lastIssueDate || ""}</small></td></tr>) : <tr><td colSpan={6}><div className="tooling-empty-row">No tools are currently issued to production.</div></td></tr>}</tbody></table></div>; }
function MovementTable({ rows }: { rows: Movement[] }) { return <div className="tool-table-wrap"><table className="tool-table"><thead><tr><th>Date</th><th>Item</th><th>Movement</th><th>From</th><th>To</th><th>Quantity</th><th>Reference</th></tr></thead><tbody>{rows.length ? rows.map((row) => <tr key={row.toolingStockMovementId}><td>{row.movementDate}</td><td><strong>{row.itemCode}</strong><small>{row.itemDescription}</small></td><td><span className="movement-badge">{row.movementType.replace(/_/g, " ")}</span></td><td>{locationLabel(row.fromWarehouseCode, row.fromBinLocation)}</td><td>{locationLabel(row.toWarehouseCode, row.toBinLocation)}</td><td>{fixed(row.quantity)} {row.uomCode || ""}</td><td>{row.referenceNumber || "—"}<small>{[row.machineReference, row.employeeReference, row.operationReference].filter(Boolean).join(" · ")}</small></td></tr>) : <tr><td colSpan={7}><div className="tooling-empty-row">No Tooling transactions are posted yet.</div></td></tr>}</tbody></table></div>; }
function RegrindBatchTable({ rows, onReceive, onInspect, onViewDc }: { rows: RegrindBatch[]; onReceive: () => void; onInspect: (id: number) => void; onViewDc: (dcNumber: string) => void }) { return <div className="tool-table-wrap"><table className="tool-table"><thead><tr><th>DC number</th><th>Supplier</th><th>Dispatch</th><th>Expected return</th><th>Items / quantity</th><th>Status</th><th>Action</th></tr></thead><tbody>{rows.length ? rows.map((batch) => <tr key={batch.toolingRegrindBatchId}><td><strong>{batch.dcNumber}</strong></td><td>{batch.supplierName}</td><td>{batch.dispatchDate}</td><td>{batch.expectedReturnDate || "—"}</td><td>{fixed(batch.itemCount)} / {fixed(batch.dispatchedQuantity)}</td><td><span className={`tool-status ${batch.status.toLowerCase()}`}>{batch.status.replace(/_/g, " ")}</span></td><td><div className="tool-inline-actions"><button type="button" className="table-action" onClick={() => onViewDc(batch.dcNumber)}>View / Print DC</button>{batch.status === "DISPATCHED" ? <button type="button" className="table-action" onClick={onReceive}>Receive through GRN Inward</button> : batch.status === "RECEIVED_PENDING_INSPECTION" ? <button type="button" className="table-action" onClick={() => onInspect(batch.toolingRegrindBatchId)}>Inspect</button> : null}</div></td></tr>) : <tr><td colSpan={7}><div className="tooling-empty-row">No regrinding DCs are posted.</div></td></tr>}</tbody></table></div>; }
function ProcessStage({ number, title, detail, tone, onClick }: { number: string; title: string; detail: string; tone: string; onClick: () => void }) { return <button type="button" className={`process-stage ${tone}`} onClick={onClick}><span>{number}</span><div><b>{title}</b><small>{detail}</small></div></button>; }
function ToolSelector({ value, onChange, items, label }: { value: string; onChange: (value: string) => void; items: ToolItem[]; label: string }) { return <label><span>{label}<b> *</b></span><select required value={value} onChange={(event) => onChange(event.target.value)}><option value="">Select tool</option>{items.map((item) => <option value={item.itemId} key={item.itemId}>{item.itemCode} — {item.itemDescription}</option>)}</select></label>; }
function LocationSelector({ value, onChange, locations, label = "Production location" }: { value: string; onChange: (value: string) => void; locations: Location[]; label?: string }) { return <label><span>{label}<b> *</b></span><select required value={value} onChange={(event) => onChange(event.target.value)}><option value="">Select location</option>{locations.map((location) => <option key={location.locationMasterId} value={location.locationName}>{location.locationName}{location.issuedQuantity !== undefined ? ` · ${fixed(location.issuedQuantity)} issued` : ""}</option>)}</select></label>; }
function MachineSelector({ value, onChange, machines }: { value: string; onChange: (value: string) => void; machines: Lookup["machines"] }) { return <label><span>Machine<b> *</b></span><select required value={value} onChange={(event) => onChange(event.target.value)}><option value="">Select machine</option>{machines.map((machine) => <option key={machine.machineCode} value={machine.machineCode}>{machine.machineCode}{machine.machineName && machine.machineName !== machine.machineCode ? ` — ${machine.machineName}` : ""}{machine.issuedQuantity !== undefined ? ` · ${fixed(machine.issuedQuantity)} issued` : ""}</option>)}</select></label>; }
function OperationSelector({ value, onChange, operations }: { value: string; onChange: (value: string) => void; operations: Lookup["operations"] }) { return <label><span>Operation<b> *</b></span><select required value={value} onChange={(event) => onChange(event.target.value)}><option value="">Select operation</option>{operations.map((operation) => <option key={operation.operationCode} value={operation.operationCode}>{operation.operationCode} — {operation.operationName}</option>)}</select></label>; }
function BulkTransferForm({ value, setValue, lines, setLines, items, productionLocations, machines, operations, type }: { value: TransferForm; setValue: React.Dispatch<React.SetStateAction<TransferForm>>; lines: TransferLine[]; setLines: React.Dispatch<React.SetStateAction<TransferLine[]>>; items: ToolItem[]; productionLocations: Location[]; machines: ToolingMachine[]; operations: Lookup["operations"]; type: "ISSUE" | "RETURN" }) {
  const update = (patch: Partial<TransferForm>) => setValue((current) => ({ ...current, ...patch }));
  const lostOrScrapped = type === "RETURN" && ["LOST", "SCRAP"].includes(value.returnCondition);
  const availableQuantity = (item: ToolItem) => type === "ISSUE" ? item.toolCribQuantity : item.issuedQuantity;
  const addLine = () => setLines((current) => [...current, blankTransferLine()]);
  const removeLine = (index: number) => setLines((current) => current.length === 1 ? current : current.filter((_, rowIndex) => rowIndex !== index));
  const updateLine = (index: number, patch: Partial<TransferLine>) => setLines((current) => current.map((line, rowIndex) => rowIndex === index ? { ...line, ...patch } : line));
  const resetReturnLines = () => setLines([blankTransferLine()]);
  const returnHint = value.returnCondition === "DAMAGED_REGRIND"
    ? "Damaged quantities return to Tool Crib as regrind-required stock."
    : lostOrScrapped ? "These quantities are removed from issued stock and recorded in the Tooling Movement Ledger."
      : "Available quantities return to Tool Crib / Tooling.";

  return <div className="tool-modal-body">
    <div className="tool-form-grid">
      {type === "RETURN" && <label><span>Return condition<b> *</b></span><select required value={value.returnCondition} onChange={(event) => update({ returnCondition: event.target.value as ReturnCondition })}><option value="AVAILABLE">Available — return to Tool Crib</option><option value="DAMAGED_REGRIND">Damaged — send for regrinding</option><option value="LOST">Lost — remove from issued stock</option><option value="SCRAP">Scrapped — remove from issued stock</option></select></label>}
      <LocationSelector value={value.binLocation} onChange={(binLocation) => { update({ binLocation, machineReference: "" }); if (type === "RETURN") resetReturnLines(); }} locations={productionLocations} label={type === "ISSUE" ? "Issue to production location" : "Return from production location"} />
      <MachineSelector value={value.machineReference} onChange={(machineReference) => { update({ machineReference }); if (type === "RETURN") resetReturnLines(); }} machines={machines} />
      <label><span>{type === "ISSUE" ? "Issue" : "Return"} date<b> *</b></span><input required type="date" value={value.movementDate} onChange={(event) => update({ movementDate: event.target.value })} /></label>
      <label><span>{type === "ISSUE" ? "Issued to" : "Returned by"} employee<b> *</b></span><input required value={value.employeeReference} onChange={(event) => update({ employeeReference: event.target.value })} /></label>
      {type === "ISSUE" && <OperationSelector value={value.operationReference || ""} onChange={(operationReference) => update({ operationReference })} operations={operations} />}
      <label><span>Reference number</span><input value={value.referenceNumber} onChange={(event) => update({ referenceNumber: event.target.value })} placeholder="Auto-generated if blank" /></label>
    </div>
    {type === "RETURN" && <p className="tooling-form-hint">{returnHint}</p>}
    <div className="tooling-line-editor"><div><h3>Tool items and quantities</h3><button type="button" className="table-action" onClick={addLine}><Plus size={13} />Add line</button></div>{lines.map((line, index) => {
      const usedElsewhere = new Set(lines.filter((_, rowIndex) => rowIndex !== index).map((row) => row.itemId));
      const selectedItem = items.find((item) => String(item.itemId) === line.itemId);
      return <div className="tooling-transfer-line" key={`${index}-${line.itemId}`}><select required value={line.itemId} onChange={(event) => updateLine(index, { itemId: event.target.value, quantity: "" })}><option value="">Select tool</option>{items.map((item) => <option disabled={usedElsewhere.has(String(item.itemId))} key={item.itemId} value={item.itemId}>{item.itemCode} — {type === "ISSUE" ? "available" : "issued"} {fixed(availableQuantity(item))} {item.uomCode || ""}</option>)}</select><input required type="number" min="0.001" max={selectedItem ? String(availableQuantity(selectedItem)) : undefined} step="0.001" value={line.quantity} onChange={(event) => updateLine(index, { quantity: event.target.value })} placeholder="Quantity" /><button type="button" className="tooling-icon-button" aria-label="Remove line" onClick={() => removeLine(index)}><X size={15} /></button></div>;
    })}</div>
    <label><span>Remarks{lostOrScrapped && <b> *</b>}</span><textarea required={lostOrScrapped} value={value.remarks} onChange={(event) => update({ remarks: event.target.value })} /></label>
  </div>;
}
function DispatchForm({ value, setValue, lines, setLines, items, suppliers }: { value: DispatchFormValue; setValue: React.Dispatch<React.SetStateAction<DispatchFormValue>>; lines: DispatchLine[]; setLines: React.Dispatch<React.SetStateAction<DispatchLine[]>>; items: ToolItem[]; suppliers: Lookup["suppliers"] }) { const update = (patch: Partial<DispatchFormValue>) => setValue((current) => ({ ...current, ...patch })); const addLine = () => setLines((current) => [...current, { itemId: "", quantity: "", sourceStockStatus: "AVAILABLE" }]); const removeLine = (index: number) => setLines((current) => current.length === 1 ? current : current.filter((_, currentIndex) => currentIndex !== index)); return <div className="tool-modal-body"><div className="tool-form-grid"><label><span>Regrinding supplier<b> *</b></span><select required value={value.supplierId} onChange={(event) => update({ supplierId: event.target.value })}><option value="">Select Supplier</option>{suppliers.map((supplier) => <option key={supplier.supplierId} value={supplier.supplierId}>{supplier.supplierCode ? `${supplier.supplierCode} — ` : ""}{supplier.supplierName}</option>)}</select></label><label><span>DC number</span><input value={value.dcNumber} onChange={(event) => update({ dcNumber: event.target.value })} placeholder="Auto-generated if blank" /></label><label><span>Dispatch date<b> *</b></span><input required type="date" value={value.dispatchDate} onChange={(event) => update({ dispatchDate: event.target.value })} /></label><label><span>Expected return date</span><input type="date" value={value.expectedReturnDate} onChange={(event) => update({ expectedReturnDate: event.target.value })} /></label><label><span>Courier / vehicle reference</span><input value={value.courierVehicleReference} onChange={(event) => update({ courierVehicleReference: event.target.value })} /></label><div className="tooling-readonly-field"><span>Dispatch from</span><b>Tool Crib / Tooling</b></div></div><div className="tooling-line-editor"><div><h3>Tool items and quantities</h3><button type="button" className="table-action" onClick={addLine}><Plus size={13} />Add line</button></div>{lines.map((line, index) => <div className="tooling-dispatch-line" key={`${index}-${line.itemId}`}><select required value={line.itemId} onChange={(event) => setLines((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, itemId: event.target.value } : row))}><option value="">Select tool</option>{items.map((item) => <option key={item.itemId} value={item.itemId}>{item.itemCode} — available {fixed(item.toolCribQuantity)}, regrind required {fixed(item.regrindRequiredQuantity)}</option>)}</select><select value={line.sourceStockStatus} onChange={(event) => setLines((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, sourceStockStatus: event.target.value as DispatchLine["sourceStockStatus"] } : row))}><option value="AVAILABLE">Available Tool Crib stock</option><option value="REGRIND_REQUIRED">Regrind-required quantity</option></select><input required type="number" min="0.001" step="0.001" value={line.quantity} onChange={(event) => setLines((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, quantity: event.target.value } : row))} placeholder="Quantity" /><button type="button" className="tooling-icon-button" aria-label="Remove line" onClick={() => removeLine(index)}><X size={15} /></button></div>)}</div><label><span>Remarks</span><textarea value={value.remarks} onChange={(event) => update({ remarks: event.target.value })} /></label></div>; }
function ReceiveForm({ batch, value, setValue }: { batch: RegrindBatch; value: { receiptDate: string; receiptReference: string; quantities: Record<number, string> }; setValue: React.Dispatch<React.SetStateAction<{ receiptDate: string; receiptReference: string; quantities: Record<number, string> }>> }) { return <div className="tool-modal-body"><div className="tooling-batch-summary"><b>{batch.dcNumber}</b><span>{batch.supplierName} · dispatched {batch.dispatchDate}</span></div><div className="tool-form-grid"><label><span>Receipt date<b> *</b></span><input required type="date" value={value.receiptDate} onChange={(event) => setValue((current) => ({ ...current, receiptDate: event.target.value }))} /></label><label><span>Supplier return reference</span><input value={value.receiptReference} onChange={(event) => setValue((current) => ({ ...current, receiptReference: event.target.value }))} /></label></div><div className="tool-table-wrap"><table className="tool-table"><thead><tr><th>Tool item</th><th>Dispatched</th><th>Received quantity</th></tr></thead><tbody>{(batch.items || []).map((item) => <tr key={item.toolingRegrindBatchItemId}><td><strong>{item.itemCode}</strong><small>{item.itemDescription}</small></td><td>{fixed(item.dispatchedQuantity)} {item.uomCode || ""}</td><td><input required type="number" min="0.001" max={String(item.dispatchedQuantity)} step="0.001" value={value.quantities[item.toolingRegrindBatchItemId] || ""} onChange={(event) => setValue((current) => ({ ...current, quantities: { ...current.quantities, [item.toolingRegrindBatchItemId]: event.target.value } }))} /></td></tr>)}</tbody></table></div></div>; }
function InspectForm({ batch, inspectionDate, setInspectionDate, rows, setRows, changeQuantity }: { batch: RegrindBatch; inspectionDate: string; setInspectionDate: (value: string) => void; rows: Record<number, InspectionInput>; setRows: React.Dispatch<React.SetStateAction<Record<number, InspectionInput>>>; changeQuantity: (item: BatchItem, field: "acceptedQuantity" | "rejectedQuantity", value: string) => void }) { return <div className="tool-modal-body"><div className="tooling-batch-summary"><b>{batch.dcNumber}</b><span>Use the defined inspection parameters before accepting Tool Crib stock.</span></div><label><span>Inspection date<b> *</b></span><input required type="date" value={inspectionDate} onChange={(event) => setInspectionDate(event.target.value)} /></label>{(batch.items || []).map((item) => { const row = rows[item.toolingRegrindBatchItemId]; const received = quantity(item.receivedQuantity); const disableRejected = quantity(row?.acceptedQuantity) >= received; return <section className="tooling-inspection-item" key={item.toolingRegrindBatchItemId}><header><div><h3>{item.itemCode}</h3><span>{item.itemDescription} · Received {fixed(item.receivedQuantity)} {item.uomCode || ""}</span></div></header>{item.inspectionPlan?.length ? <div className="tooling-measurements">{item.inspectionPlan.map((plan) => <label key={plan.itemInspectionCharacteristicId}><span>{plan.characteristicName} <small>{plan.lsl !== null && plan.lsl !== undefined ? `(${plan.lsl} to ${plan.usl})` : ""}</small><b> *</b></span><input required value={row?.measurements[plan.itemInspectionCharacteristicId]?.actualValue || ""} onChange={(event) => setRows((current) => ({ ...current, [item.toolingRegrindBatchItemId]: { ...row, measurements: { ...row.measurements, [plan.itemInspectionCharacteristicId]: { ...row.measurements[plan.itemInspectionCharacteristicId], actualValue: event.target.value } } } }))} placeholder={plan.specifiedDimension?.toString() || "Measured value"} /></label>)}</div> : <div className="modal-notice">Define inspection parameters for this tool before it can be accepted.</div>}<div className="tool-form-grid"><label><span>Accepted quantity<b> *</b></span><input required min="0" max={String(received)} type="number" step="0.001" value={row?.acceptedQuantity || ""} onChange={(event) => changeQuantity(item, "acceptedQuantity", event.target.value)} /></label><label><span>Rejected quantity<b> *</b></span><input required disabled={disableRejected} min="0" max={String(received)} type="number" step="0.001" value={disableRejected ? "0" : row?.rejectedQuantity || ""} onChange={(event) => changeQuantity(item, "rejectedQuantity", event.target.value)} /></label>{!disableRejected && <label><span>Rejected quantity action<b> *</b></span><select required value={row?.rejectionAction || ""} onChange={(event) => setRows((current) => ({ ...current, [item.toolingRegrindBatchItemId]: { ...row, rejectionAction: event.target.value } }))}><option value="">Select action</option><option value="SCRAP">Scrap</option><option value="REGRIND_AGAIN">Regrind again</option><option value="RETURN_TO_TOOL_CRIB">Return to Tool Crib on hold</option></select></label>}</div><label><span>Inspection remarks</span><textarea value={row?.inspectionRemarks || ""} onChange={(event) => setRows((current) => ({ ...current, [item.toolingRegrindBatchItemId]: { ...row, inspectionRemarks: event.target.value } }))} /></label></section>; })}</div>; }
