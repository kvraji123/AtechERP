import { AlertTriangle, ArrowRightLeft, ClipboardCheck, Factory, RefreshCw, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { apiMessage } from "../../../api/client";
import { inventoryControlApi } from "../../../api/inventoryControl.api";
import { todayInAppTimeZone } from "../../../utils/formatDateTime";
import "./InventoryControlPage.css";

type Row = Record<string, unknown>;
type Mode = "TRANSFER" | "ISSUE" | "RETURN" | "QUALITY_RELEASE" | "COMPLETE" | "REJECTION";

const text = (value: unknown) => value === null || value === undefined || value === "" ? "—" : String(value);
const quantity = (value: unknown) => Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 3 });

const initialDestination = { warehouseCode: "", subinventoryCode: "", binLocation: "", stockStatus: "AVAILABLE" };

export default function InventoryControlPage() {
  const [lookups, setLookups] = useState<{ locations: Row[]; subinventories: Row[]; statuses: Row[]; items: Row[] }>({ locations: [], subinventories: [], statuses: [], items: [] });
  const [balances, setBalances] = useState<Row[]>([]);
  const [rejections, setRejections] = useState<Row[]>([]);
  const [mode, setMode] = useState<Mode>("TRANSFER");
  const [sourceBalanceId, setSourceBalanceId] = useState("");
  const [movementDate, setMovementDate] = useState(todayInAppTimeZone());
  const [movementQuantity, setMovementQuantity] = useState("");
  const [workOrderReference, setWorkOrderReference] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [remarks, setRemarks] = useState("");
  const [destination, setDestination] = useState(initialDestination);
  const [returnType, setReturnType] = useState<"MTR" | "PRR">("MTR");
  const [rejectionType, setRejectionType] = useState<"MATERIAL" | "PROCESS">("MATERIAL");
  const [operationReference, setOperationReference] = useState("");
  const [machineReference, setMachineReference] = useState("");
  const [processCardReference, setProcessCardReference] = useState("");
  const [rejectionReportReference, setRejectionReportReference] = useState("");
  const [finishedGoodItemId, setFinishedGoodItemId] = useState("");
  const [finishedGoodQuantity, setFinishedGoodQuantity] = useState("");
  const [finishedGoodBatch, setFinishedGoodBatch] = useState("");
  const [completionInputs, setCompletionInputs] = useState([{ sourceBalanceId: "", quantity: "" }]);
  const [selectedRejection, setSelectedRejection] = useState<Row | null>(null);
  const [resolveDisposition, setResolveDisposition] = useState("REWORK");
  const [resolveQuantity, setResolveQuantity] = useState("");
  const [resolveRemarks, setResolveRemarks] = useState("");
  const [resolveDestination, setResolveDestination] = useState(initialDestination);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const locations = lookups.locations;
  const warehouses = useMemo(() => [...new Set(locations.map((row) => text(row.warehouseCode)).filter((value) => value !== "—"))], [locations]);
  const bins = (warehouseCode: string) => locations.filter((row) => text(row.warehouseCode) === warehouseCode);
  const selectedSource = balances.find((row) => Number(row.id) === Number(sourceBalanceId)) || null;
  const eligibleSourceBalances = useMemo(() => balances.filter((row) => {
    const subinventory = text(row.subinventoryCode);
    const status = text(row.stockStatus);
    if (mode === "COMPLETE") return subinventory === "WIP" && ["ISSUED", "REWORK"].includes(status);
    if (mode === "RETURN") return subinventory === "WIP" && ["ISSUED", "REWORK"].includes(status);
    if (mode === "QUALITY_RELEASE") return ["MTR", "PRR", "WIP"].includes(subinventory) && ["HOLD", "REWORK"].includes(status);
    if (mode === "TRANSFER" || mode === "ISSUE") return status === "AVAILABLE";
    return ["AVAILABLE", "ISSUED", "HOLD", "REWORK"].includes(status);
  }), [balances, mode]);
  const selectedCompletionBalance = (balanceId: string) => balances.find((row) => Number(row.id) === Number(balanceId)) || null;

  const load = async (searchValue = search) => {
    try {
      setLoading(true); setError("");
      const [lookupResponse, balanceResponse, rejectionResponse] = await Promise.all([
        inventoryControlApi.lookups(), inventoryControlApi.balances({ search: searchValue, limit: 300 }), inventoryControlApi.rejections({ limit: 100 }),
      ]);
      setLookups(lookupResponse.data || { locations: [], subinventories: [], statuses: [], items: [] });
      setBalances(balanceResponse.data || []);
      setRejections(rejectionResponse.data || []);
    } catch (reason) { setError(apiMessage(reason)); }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(""); }, []);

  useEffect(() => {
    if (mode === "ISSUE") setDestination((current) => ({ ...current, subinventoryCode: "WIP", stockStatus: "ISSUED" }));
    if (mode === "RETURN") setDestination((current) => ({ ...current, subinventoryCode: returnType, stockStatus: "HOLD" }));
    if (mode === "QUALITY_RELEASE") setDestination((current) => ({ ...current, stockStatus: "AVAILABLE" }));
    if (mode === "COMPLETE") setDestination((current) => ({ ...current, subinventoryCode: "FG", stockStatus: "AVAILABLE" }));
    if (mode === "REJECTION") setDestination({ warehouseCode: "Rejection Yard", subinventoryCode: `${rejectionType}_REJECTION`, binLocation: rejectionType === "MATERIAL" ? "Material Quarantine" : "Process Quarantine", stockStatus: "QUARANTINE" });
  }, [mode, returnType, rejectionType]);

  const updateDestination = (changes: Partial<typeof destination>) => setDestination((current) => ({ ...current, ...changes }));
  const updateResolveDestination = (changes: Partial<typeof destination>) => setResolveDestination((current) => ({ ...current, ...changes }));

  const resetForm = () => {
    setSourceBalanceId(""); setMovementQuantity(""); setWorkOrderReference(""); setReferenceNumber(""); setRemarks("");
    setOperationReference(""); setMachineReference(""); setProcessCardReference(""); setRejectionReportReference(""); setDestination(initialDestination);
    setFinishedGoodItemId(""); setFinishedGoodQuantity(""); setFinishedGoodBatch(""); setCompletionInputs([{ sourceBalanceId: "", quantity: "" }]);
  };

  const updateCompletionInput = (index: number, changes: Partial<{ sourceBalanceId: string; quantity: string }>) => {
    setCompletionInputs((current) => current.map((line, lineIndex) => lineIndex === index ? { ...line, ...changes } : line));
  };

  const submit = async () => {
    const sourceBalance = Number(sourceBalanceId); const quantityValue = Number(movementQuantity);
    const normalizedCompletionInputs = completionInputs.map((line) => ({ sourceBalanceId: Number(line.sourceBalanceId), quantity: Number(line.quantity) }));
    const validCompletion = normalizedCompletionInputs.length > 0
      && normalizedCompletionInputs.every((line) => Number.isInteger(line.sourceBalanceId) && line.sourceBalanceId > 0 && Number.isFinite(line.quantity) && line.quantity > 0)
      && new Set(normalizedCompletionInputs.map((line) => line.sourceBalanceId)).size === normalizedCompletionInputs.length
      && Number(finishedGoodItemId) > 0 && Number(finishedGoodQuantity) > 0;
    if ((!remarks.trim()) || (mode === "COMPLETE" ? !validCompletion : !sourceBalance || !Number.isFinite(quantityValue) || quantityValue <= 0)) {
      setError(mode === "COMPLETE" ? "Add valid WIP consumption lines, finished-good details, and remarks." : "Select source stock, enter a positive quantity, and enter remarks."); return;
    }
    const destinationBody = {
      destinationWarehouseCode: destination.warehouseCode, destinationSubinventoryCode: destination.subinventoryCode,
      destinationBinLocation: destination.binLocation, destinationStockStatus: destination.stockStatus,
    };
    try {
      setSaving(true); setError(""); setNotice("");
      const basic = { sourceBalanceId: sourceBalance, quantity: quantityValue, movementDate, referenceNumber, remarks, ...destinationBody };
      const response = mode === "TRANSFER" ? await inventoryControlApi.transfer(basic)
        : mode === "ISSUE" ? await inventoryControlApi.issueToProduction({ ...basic, workOrderReference })
          : mode === "RETURN" ? await inventoryControlApi.returnFromProduction({ ...basic, returnType, workOrderReference })
            : mode === "QUALITY_RELEASE" ? await inventoryControlApi.releaseQualityHold(basic)
              : mode === "COMPLETE" ? await inventoryControlApi.completeProduction({ movementDate, workOrderReference, referenceNumber, remarks, inputLines: normalizedCompletionInputs, finishedGood: { itemId: Number(finishedGoodItemId), quantity: Number(finishedGoodQuantity), batchSerialNumber: finishedGoodBatch, warehouseCode: destination.warehouseCode, subinventoryCode: destination.subinventoryCode, binLocation: destination.binLocation, stockStatus: destination.stockStatus } })
                : await inventoryControlApi.reportRejection({ ...basic, rejectionType, sourceType: "WORK_ORDER", workOrderReference, operationReference, machineReference, processCardReference, rejectionReportReference });
      setNotice(response.message || "Inventory movement posted."); resetForm(); await load();
    } catch (reason) { setError(apiMessage(reason)); }
    finally { setSaving(false); }
  };

  const openResolve = (row: Row) => {
    setSelectedRejection(row); setResolveDisposition("REWORK"); setResolveQuantity(String(row.quantityOpen || "")); setResolveRemarks("");
    setResolveDestination({ warehouseCode: "Production Stores", subinventoryCode: "WIP", binLocation: "WIP", stockStatus: "REWORK" });
  };

  const submitResolution = async () => {
    if (!selectedRejection) return;
    const quantityValue = Number(resolveQuantity);
    if (!Number.isFinite(quantityValue) || quantityValue <= 0 || !resolveRemarks.trim()) { setError("Enter a valid disposition quantity and remarks."); return; }
    try {
      setSaving(true); setError(""); setNotice("");
      const response = await inventoryControlApi.resolveRejection(Number(selectedRejection.caseId), {
        lineId: Number(selectedRejection.lineId), disposition: resolveDisposition, quantity: quantityValue, movementDate,
        remarks: resolveRemarks, destinationWarehouseCode: resolveDestination.warehouseCode,
        destinationSubinventoryCode: resolveDestination.subinventoryCode, destinationBinLocation: resolveDestination.binLocation,
        destinationStockStatus: resolveDestination.stockStatus,
      });
      setNotice(response.message || "Rejection disposition posted."); setSelectedRejection(null); await load();
    } catch (reason) { setError(apiMessage(reason)); }
    finally { setSaving(false); }
  };

  return <main className="inventory-control-page">
    <header className="inventory-control-header"><div><span>CONTROLLED INVENTORY OPERATIONS</span><h1>Production inventory control</h1><p>Transfer stock, issue to work orders, record MTR/PRR, and quarantine production rejection with traceable disposition.</p></div><button type="button" onClick={() => void load()} disabled={loading}><RefreshCw size={16}/>Refresh</button></header>
    {error && <div className="inventory-control-message error" role="alert">{error}</div>}
    {notice && <div className="inventory-control-message success">{notice}</div>}

    <section className="inventory-control-tabs" aria-label="Inventory operation"><button className={mode === "TRANSFER" ? "active" : ""} type="button" onClick={() => setMode("TRANSFER")}><ArrowRightLeft size={16}/>Internal transfer</button><button className={mode === "ISSUE" ? "active" : ""} type="button" onClick={() => setMode("ISSUE")}><Factory size={16}/>Issue to work order</button><button className={mode === "RETURN" ? "active" : ""} type="button" onClick={() => setMode("RETURN")}><RotateCcw size={16}/>MTR / PRR</button><button className={mode === "QUALITY_RELEASE" ? "active" : ""} type="button" onClick={() => setMode("QUALITY_RELEASE")}><ClipboardCheck size={16}/>Quality release</button><button className={mode === "COMPLETE" ? "active" : ""} type="button" onClick={() => setMode("COMPLETE")}><Factory size={16}/>Complete to FG</button><button className={mode === "REJECTION" ? "active" : ""} type="button" onClick={() => setMode("REJECTION")}><AlertTriangle size={16}/>Production rejection</button></section>

    <section className="inventory-control-card"><header><div><h2>{mode === "TRANSFER" ? "Move available stock" : mode === "ISSUE" ? "Issue material to work order" : mode === "RETURN" ? "Record controlled production return" : mode === "QUALITY_RELEASE" ? "Release inspected return stock" : mode === "COMPLETE" ? "Complete work order to finished goods" : "Quarantine production rejection"}</h2><p>{mode === "REJECTION" ? "Quarantine first. Rework, return, release, and scrap are controlled in the rejection queue." : mode === "COMPLETE" ? "Consume one or more WIP lines through the API and post an auditable FG receipt." : "Source and destination are written as paired, immutable ledger entries."}</p></div></header><div className="inventory-control-form">
      {mode === "COMPLETE" ? <div className="completion-inputs wide"><strong>WIP consumption lines *</strong>{completionInputs.map((line, index) => { const lineSource = selectedCompletionBalance(line.sourceBalanceId); const selectedIds = new Set(completionInputs.filter((_, lineIndex) => lineIndex !== index).map((input) => input.sourceBalanceId)); return <div className="completion-input-row" key={index}><label>WIP source<select value={line.sourceBalanceId} onChange={(event) => updateCompletionInput(index, { sourceBalanceId: event.target.value })}><option value="">Select WIP stock</option>{eligibleSourceBalances.filter((row) => !selectedIds.has(String(row.id))).map((row) => <option key={String(row.id)} value={String(row.id)}>{text(row.itemCode)} · {quantity(row.quantityAvailable)} {text(row.uomCode)} · {text(row.binLocation)}</option>)}</select></label><label>Available<input readOnly value={lineSource ? `${quantity(lineSource.quantityAvailable)} ${text(lineSource.uomCode)}` : "Select source"}/></label><label>Consumed quantity<input type="number" min="0.001" step="0.001" max={lineSource ? Number(lineSource.quantityAvailable || 0) : undefined} value={line.quantity} onChange={(event) => updateCompletionInput(index, { quantity: event.target.value })}/></label>{completionInputs.length > 1 && <button type="button" onClick={() => setCompletionInputs((current) => current.filter((_, lineIndex) => lineIndex !== index))}>Remove</button>}</div>; })}<button type="button" className="completion-add" onClick={() => setCompletionInputs((current) => [...current, { sourceBalanceId: "", quantity: "" }])}>Add WIP component</button></div> : <><label>Source stock balance *<select value={sourceBalanceId} onChange={(event) => setSourceBalanceId(event.target.value)}><option value="">Select source stock</option>{eligibleSourceBalances.map((row) => <option key={String(row.id)} value={String(row.id)}>{text(row.itemCode)} · {quantity(row.quantityAvailable)} {text(row.uomCode)} · {text(row.warehouseCode)} / {text(row.subinventoryCode)} / {text(row.binLocation)} {text(row.workOrderReference) !== "—" ? `· WO ${text(row.workOrderReference)}` : ""}</option>)}</select></label><label>Available at source<input readOnly value={selectedSource ? `${quantity(selectedSource.quantityAvailable)} ${text(selectedSource.uomCode)} · ${text(selectedSource.stockStatus)}` : "Select stock"}/></label><label>Quantity *<input type="number" min="0.001" step="0.001" max={selectedSource ? Number(selectedSource.quantityAvailable || 0) : undefined} value={movementQuantity} onChange={(event) => setMovementQuantity(event.target.value)}/></label></>}
      <label>Movement date *<input type="date" value={movementDate} onChange={(event) => setMovementDate(event.target.value)}/></label>
      {(mode === "ISSUE" || mode === "RETURN" || mode === "REJECTION" || mode === "COMPLETE") && <label>Work order / job card {mode !== "REJECTION" || rejectionType === "PROCESS" ? "*" : ""}<input value={workOrderReference} onChange={(event) => setWorkOrderReference(event.target.value)} placeholder="Work order or job card"/></label>}
      {mode === "RETURN" && <label>Return type *<select value={returnType} onChange={(event) => setReturnType(event.target.value as "MTR" | "PRR")}><option value="MTR">MTR - Material Return</option><option value="PRR">PRR - Production Return</option></select></label>}
      {mode === "REJECTION" && <><label>Rejection type *<select value={rejectionType} onChange={(event) => setRejectionType(event.target.value as "MATERIAL" | "PROCESS")}><option value="MATERIAL">Material rejection</option><option value="PROCESS">Process rejection</option></select></label><label>Operation reference<input value={operationReference} onChange={(event) => setOperationReference(event.target.value)} placeholder="Operation / process"/></label><label>Machine reference<input value={machineReference} onChange={(event) => setMachineReference(event.target.value)} placeholder="Machine code"/></label><label>Process card reference<input value={processCardReference} onChange={(event) => setProcessCardReference(event.target.value)} placeholder="Process card"/></label><label>Rejection report reference<input value={rejectionReportReference} onChange={(event) => setRejectionReportReference(event.target.value)} placeholder="Quality report"/></label></>}
      {mode === "COMPLETE" && <><label>Finished-good item *<select value={finishedGoodItemId} onChange={(event) => setFinishedGoodItemId(event.target.value)}><option value="">Select finished-good item</option>{lookups.items.map((row) => <option key={String(row.itemId)} value={String(row.itemId)}>{text(row.itemCode)} · {text(row.itemDescription)}</option>)}</select></label><label>Finished-good quantity *<input type="number" min="0.001" step="0.001" value={finishedGoodQuantity} onChange={(event) => setFinishedGoodQuantity(event.target.value)}/></label><label>FG batch / serial<input value={finishedGoodBatch} onChange={(event) => setFinishedGoodBatch(event.target.value)} placeholder="Lot, batch or serial"/></label></>}
      <DestinationFields destination={destination} warehouses={warehouses} bins={bins(destination.warehouseCode)} subinventories={lookups.subinventories} statuses={lookups.statuses} locked={mode === "REJECTION"} onChange={updateDestination}/>
      <label>Reference number<input value={referenceNumber} onChange={(event) => setReferenceNumber(event.target.value)} placeholder="Issue slip, transfer or return reference"/></label>
      <label className="wide">Remarks *<textarea value={remarks} onChange={(event) => setRemarks(event.target.value)} placeholder="State the reason, condition, and receiver / operation"/></label>
    </div><footer><button type="button" onClick={resetForm}>Clear</button><button type="button" className="primary" disabled={saving || loading} onClick={() => void submit()}>{saving ? "Posting…" : mode === "REJECTION" ? "Quarantine rejection" : mode === "COMPLETE" ? "Post production completion" : mode === "QUALITY_RELEASE" ? "Post quality release" : "Post inventory movement"}</button></footer></section>

    <section className="inventory-control-card"><header><div><h2>Production rejection queue</h2><p>Only Quality-authorised disposition should move stock out of quarantine.</p></div></header><div className="inventory-control-table"><table><thead><tr><th>Case</th><th>Type</th><th>Item / lot</th><th>Work order</th><th>Open quantity</th><th>Status</th><th>Action</th></tr></thead><tbody>{loading ? <tr><td colSpan={7}>Loading controlled rejection cases…</td></tr> : rejections.length ? rejections.map((row) => <tr key={`${row.caseId}-${row.lineId}`}><td><strong>{text(row.rejectionNumber)}</strong><small>{text(row.reportedDate)}</small></td><td>{text(row.rejectionType)}<small>{text(row.sourceType)}</small></td><td><strong>{text(row.itemCode)}</strong><small>{text(row.batchSerialNumber)}</small></td><td>{text(row.workOrderReference)}</td><td>{quantity(row.quantityOpen)} {text(row.uomCode)}</td><td><span className="inventory-control-status">{text(row.caseStatus).replace(/_/g, " ")}</span></td><td>{Number(row.quantityOpen || 0) > 0 ? <button type="button" onClick={() => openResolve(row)}>Disposition</button> : "—"}</td></tr>) : <tr><td colSpan={7}>No production rejection cases found.</td></tr>}</tbody></table></div></section>

    {selectedRejection && <section className="inventory-control-card resolution"><header><div><h2>Disposition {text(selectedRejection.rejectionNumber)}</h2><p>{text(selectedRejection.itemCode)} · {quantity(selectedRejection.quantityOpen)} {text(selectedRejection.uomCode)} remains in quarantine.</p></div><button type="button" onClick={() => setSelectedRejection(null)}>Close</button></header><div className="inventory-control-form"><label>Disposition *<select value={resolveDisposition} onChange={(event) => { const value = event.target.value; setResolveDisposition(value); if (value === "REWORK") setResolveDestination({ warehouseCode: "Production Stores", subinventoryCode: "WIP", binLocation: "WIP", stockStatus: "REWORK" }); if (value === "RELEASE") setResolveDestination(initialDestination); if (value === "SCRAP") setResolveDestination({ warehouseCode: "Scrap Yard", subinventoryCode: "SCRAP", binLocation: "Scrap", stockStatus: "SCRAP" }); if (value.startsWith("RETURN_")) setResolveDestination({ warehouseCode: "Rejection Yard", subinventoryCode: text(selectedRejection.rejectionType) === "MATERIAL" ? "MATERIAL_REJECTION" : "PROCESS_REJECTION", binLocation: text(selectedRejection.rejectionType) === "MATERIAL" ? "Material Return Pending" : "Process Return Pending", stockStatus: "RETURN_PENDING" }); }}><option value="REWORK">Send to rework</option><option value="RELEASE">Release after authorised deviation</option><option value="SCRAP">Move to scrap yard</option><option value="RETURN_TO_VENDOR">Mark pending return to vendor</option><option value="RETURN_TO_CUSTOMER">Mark pending return to customer</option></select></label><label>Quantity *<input type="number" min="0.001" step="0.001" max={Number(selectedRejection.quantityOpen || 0)} value={resolveQuantity} onChange={(event) => setResolveQuantity(event.target.value)}/></label><DestinationFields destination={resolveDestination} warehouses={warehouses} bins={bins(resolveDestination.warehouseCode)} subinventories={lookups.subinventories} statuses={lookups.statuses} onChange={updateResolveDestination}/><label className="wide">Disposition remarks *<textarea value={resolveRemarks} onChange={(event) => setResolveRemarks(event.target.value)} placeholder="Approval, rework instruction, disposal reference or return instruction"/></label></div><footer><button type="button" onClick={() => setSelectedRejection(null)}>Cancel</button><button type="button" className="primary" disabled={saving} onClick={() => void submitResolution()}>{saving ? "Posting…" : "Post disposition"}</button></footer></section>}
  </main>;
}

function DestinationFields({ destination, warehouses, bins, subinventories, statuses, locked, onChange }: { destination: typeof initialDestination; warehouses: string[]; bins: Row[]; subinventories: Row[]; statuses: Row[]; locked?: boolean; onChange: (changes: Partial<typeof initialDestination>) => void }) {
  const availableSubinventories = subinventories.filter((subinventory) => bins.some((bin) => text(bin.subinventoryCode) === text(subinventory.subinventoryCode)));
  const availableBins = bins.filter((bin) => text(bin.subinventoryCode) === destination.subinventoryCode);
  return <><label>Destination warehouse *<select disabled={locked} value={destination.warehouseCode} onChange={(event) => onChange({ warehouseCode: event.target.value, subinventoryCode: "", binLocation: "" })}><option value="">Select warehouse</option>{warehouses.map((warehouse) => <option key={warehouse} value={warehouse}>{warehouse}</option>)}</select></label><label>Destination sub-inventory *<select disabled={locked} value={destination.subinventoryCode} onChange={(event) => onChange({ subinventoryCode: event.target.value, binLocation: "" })}><option value="">Select sub-inventory</option>{availableSubinventories.map((row) => <option key={text(row.subinventoryCode)} value={text(row.subinventoryCode)}>{text(row.subinventoryName)}</option>)}</select></label><label>Destination bin *<select disabled={locked || !destination.subinventoryCode} value={destination.binLocation} onChange={(event) => onChange({ binLocation: event.target.value })}><option value="">Select bin</option>{availableBins.map((row) => <option key={String(row.locationMasterId)} value={text(row.binLocation)}>{text(row.binLocation)}</option>)}</select></label><label>Destination status *<select disabled={locked} value={destination.stockStatus} onChange={(event) => onChange({ stockStatus: event.target.value })}>{statuses.map((row) => <option key={text(row.stockStatus)} value={text(row.stockStatus)}>{text(row.stockStatusName)}</option>)}</select></label></>;
}
