import { CheckCircle2, ClipboardList, Factory, Plus, Printer, Send, Truck, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { apiMessage } from "../../../api/client";
import { customerApi } from "../../../api/customer.api";
import { gaugeApi } from "../../../api/gauge.api";
import { inventoryApi } from "../../../api/inventory.api";
import { materialOutwardApi, type MaterialOutwardType } from "../../../api/materialOutward.api";
import { supplierApi } from "../../../api/supplier.api";
import { toolingApi } from "../../../api/tooling.api";
import { useAppFeedback } from "../../../components/AppFeedback";
import { todayInAppTimeZone } from "../../../utils/formatDateTime";
import MaterialMovementTabs from "../purchase/components/MaterialMovementTabs";
import "./MaterialOutwardPage.css";

type Row = Record<string, unknown>;
type DraftLine = { stockBalanceId: string; quantity: string };
type ToolRegrindLine = { itemId: string; quantity: string; sourceStockStatus: "AVAILABLE" | "REGRIND_REQUIRED" };
type CalibrationGaugeRow = Row & {
  gaugeMasterId?: number;
  gaugeId?: string;
  instrumentName?: string;
  calibrationAgency?: string | null;
  currentLocation?: string | null;
  storageLocation?: string | null;
};

const blankLine = (): DraftLine => ({ stockBalanceId: "", quantity: "" });
const blankToolRegrindLine = (): ToolRegrindLine => ({ itemId: "", quantity: "", sourceStockStatus: "REGRIND_REQUIRED" });
const text = (value: unknown) => value === null || value === undefined || value === "" ? "—" : String(value);
const amount = (value: unknown) => Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 3 });
const statusLabel = (status: unknown) => text(status).replace(/_/g, " ");
const outwardTypeLabel = (type: unknown) => ({ FINISHED_GOODS: "Finished Goods Delivery", OUTSOURCE_ISSUE: "Outsource Issue", CALIBRATION_DISPATCH: "Calibration Dispatch", TOOL_REGRIND: "Tool Regrinding" }[String(type)] || text(type));
const gaugeMasterId = (gauge: Row) => Number(gauge.gaugeMasterId || gauge.gauge_master_id || 0);
const gaugeAgency = (gauge: Row) => String(gauge.calibrationAgency || gauge.calibration_agency || "").trim();
const gaugeStorageLocation = (gauge: Row) => String(gauge.storageLocation || gauge.storage_location || gauge.currentLocation || gauge.current_location || "").trim();
const normalizedAgency = (agency: string) => agency.toLocaleLowerCase();

export default function MaterialOutwardPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { confirmAction, showSuccess } = useAppFeedback();
  const [documents, setDocuments] = useState<Row[]>([]);
  const [stockRows, setStockRows] = useState<Row[]>([]);
  const [customers, setCustomers] = useState<Row[]>([]);
  const [suppliers, setSuppliers] = useState<Row[]>([]);
  const [outwardType, setOutwardType] = useState<MaterialOutwardType>("FINISHED_GOODS");
  const [outwardDate, setOutwardDate] = useState(todayInAppTimeZone());
  const [partyId, setPartyId] = useState("");
  const [transportMode, setTransportMode] = useState("");
  const [transportReference, setTransportReference] = useState("");
  const [calibrationAgency, setCalibrationAgency] = useState("");
  const [expectedReturnDate, setExpectedReturnDate] = useState("");
  const [dispatchFrom, setDispatchFrom] = useState("Calibration Hold / Dispatch Rack");
  const [calibrationGaugeIds, setCalibrationGaugeIds] = useState<number[]>([]);
  const [calibrationGauges, setCalibrationGauges] = useState<CalibrationGaugeRow[]>([]);
  const [availableCalibrationGauges, setAvailableCalibrationGauges] = useState<CalibrationGaugeRow[]>([]);
  const [gaugePickerOpen, setGaugePickerOpen] = useState(false);
  const [gaugePickerLoading, setGaugePickerLoading] = useState(false);
  const [gaugePickerSearch, setGaugePickerSearch] = useState("");
  const [remarks, setRemarks] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([blankLine()]);
  const [toolRegrindItems, setToolRegrindItems] = useState<Row[]>([]);
  const [toolRegrindLines, setToolRegrindLines] = useState<ToolRegrindLine[]>([blankToolRegrindLine()]);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [challanDocument, setChallanDocument] = useState<Row | null>(null);
  const [challanLoadingId, setChallanLoadingId] = useState<number | null>(null);
  const [search, setSearch] = useState(() => searchParams.get("search") || "");
  const [typeFilter, setTypeFilter] = useState<"" | MaterialOutwardType>(() => {
    const requestedType = searchParams.get("type");
    return requestedType === "TOOL_REGRIND" ? requestedType : "";
  });
  const [statusFilter, setStatusFilter] = useState<"" | "PENDING_APPROVAL" | "APPROVED" | "DISPATCHED">("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const requestedGaugeIds = searchParams.get("calibrationGaugeIds") || "";
  const requestedAgency = searchParams.get("calibrationAgency") || "";
  const requestedDispatchFrom = searchParams.get("dispatchFrom") || "";
  const requestedPurpose = searchParams.get("purpose") || "";

  const applyCalibrationGaugeSelection = (gauges: CalibrationGaugeRow[]) => {
    const selected = gauges.filter((gauge) => gaugeMasterId(gauge) > 0);
    const agencies = selected.map(gaugeAgency).filter(Boolean);
    const agencyKeys = new Set(agencies.map(normalizedAgency));
    const storageLocations = [...new Set(selected.map(gaugeStorageLocation).filter(Boolean))];
    setCalibrationGauges(selected);
    setCalibrationGaugeIds(selected.map(gaugeMasterId));
    setCalibrationAgency(agencyKeys.size === 1 ? agencies[0] : "");
    setDispatchFrom(storageLocations.join("; ").slice(0, 150));
  };

  const loadCalibrationGaugeOptions = async () => {
    try {
      setGaugePickerLoading(true);
      const response = await gaugeApi.list({ lifecycleStatus: "COLLECTED_FOR_CALIBRATION", page: 1, pageSize: 100 });
      setAvailableCalibrationGauges(Array.isArray(response?.data) ? response.data as CalibrationGaugeRow[] : []);
    } catch (reason) {
      setError(apiMessage(reason));
    } finally {
      setGaugePickerLoading(false);
    }
  };

  const searchCalibrationGauges = (value: string) => {
    setGaugePickerSearch(value);
    setGaugePickerOpen(true);
    if (!availableCalibrationGauges.length && !gaugePickerLoading) void loadCalibrationGaugeOptions();
  };

  const toggleCalibrationGauge = (gauge: CalibrationGaugeRow) => {
    const id = gaugeMasterId(gauge);
    if (!id) return;
    const selected = calibrationGauges.some((entry) => gaugeMasterId(entry) === id);
    if (selected) {
      applyCalibrationGaugeSelection(calibrationGauges.filter((entry) => gaugeMasterId(entry) !== id));
      return;
    }
    const agency = gaugeAgency(gauge);
    const currentAgency = calibrationGauges.length ? gaugeAgency(calibrationGauges[0]) : "";
    if (!agency) {
      setError(`Set a Calibration Agency for ${text(gauge.gaugeId)} in Gauge Master before dispatching it.`);
      return;
    }
    if (currentAgency && normalizedAgency(currentAgency) !== normalizedAgency(agency)) {
      setError("One calibration dispatch can contain Gauge IDs for only one Calibration Agency.");
      return;
    }
    setError("");
    applyCalibrationGaugeSelection([...calibrationGauges, gauge]);
    setGaugePickerSearch("");
    setGaugePickerOpen(false);
  };

  const load = useCallback(async () => {
    try {
      setLoading(true); setError("");
      const [documentsResponse, stockResponse, customerResponse, supplierResponse, toolItemsResponse] = await Promise.all([
        materialOutwardApi.list({ search, type: typeFilter, status: statusFilter, pageSize: 100 }),
        inventoryApi.stock({ ownerType: "COMPANY", pageSize: 100 }),
        customerApi.list({ activeFlag: "Y", pageSize: 100 }),
        supplierApi.list({ activeFlag: "Y", pageSize: 100 }),
        toolingApi.items({ stockOnly: "Y" }),
      ]);
      setDocuments(Array.isArray(documentsResponse?.data) ? documentsResponse.data : []);
      setStockRows(Array.isArray(stockResponse?.data) ? stockResponse.data.filter((row: Row) => Number(row.quantityOnHand || 0) > 0) : []);
      setCustomers(Array.isArray(customerResponse?.data) ? customerResponse.data : []);
      setSuppliers(Array.isArray(supplierResponse?.data) ? supplierResponse.data : []);
      setToolRegrindItems(Array.isArray(toolItemsResponse?.data) ? toolItemsResponse.data : []);
    } catch (reason) { setError(apiMessage(reason)); }
    finally { setLoading(false); }
  }, [search, statusFilter, typeFilter]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const gaugeIds = [...new Set(requestedGaugeIds.split(",").map(Number).filter((id) => Number.isSafeInteger(id) && id > 0))];
    if (!gaugeIds.length) return;
    let active = true;
    setOutwardType("CALIBRATION_DISPATCH"); setCalibrationGaugeIds(gaugeIds); setCalibrationAgency(requestedAgency);
    setDispatchFrom(requestedDispatchFrom || "Calibration Hold / Dispatch Rack"); setOutwardDate(todayInAppTimeZone());
    setExpectedReturnDate(""); setTransportReference(""); setShowForm(true);
    Promise.all(gaugeIds.map((gaugeMasterId) => gaugeApi.getById(gaugeMasterId))).then((responses) => {
      if (!active) return;
      const selected = responses.map((response: any) => response?.data || {}).filter((row) => Object.keys(row).length) as CalibrationGaugeRow[];
      applyCalibrationGaugeSelection(selected);
    }).catch((reason) => active && setError(apiMessage(reason)));
    return () => { active = false; };
  }, [requestedAgency, requestedDispatchFrom, requestedGaugeIds]);

  useEffect(() => {
    if (requestedPurpose !== "TOOL_REGRIND") return;
    setOutwardType("TOOL_REGRIND"); setOutwardDate(todayInAppTimeZone()); setPartyId(""); setExpectedReturnDate("");
    setTransportReference(""); setRemarks(""); setToolRegrindLines([blankToolRegrindLine()]); setShowForm(true);
  }, [requestedPurpose]);

  const isCalibrationDispatch = outwardType === "CALIBRATION_DISPATCH";
  const isToolRegrind = outwardType === "TOOL_REGRIND";
  const parties = outwardType === "FINISHED_GOODS" ? customers : suppliers;
  const toolingSuppliers = useMemo(() => suppliers.filter((supplier) => String(supplier.supplierCategory || supplier.supplier_category || "").toUpperCase() === "TOOLING"), [suppliers]);
  const partyLabel = outwardType === "FINISHED_GOODS" ? "Customer" : isToolRegrind ? "Regrinding supplier" : "Outsource supplier";
  const selectedStockIds = useMemo(() => new Set(lines.map((line) => line.stockBalanceId).filter(Boolean)), [lines]);
  const selectedCalibrationAgencyKey = useMemo(() => calibrationGauges.length ? normalizedAgency(gaugeAgency(calibrationGauges[0])) : "", [calibrationGauges]);
  const visibleCalibrationGaugeOptions = useMemo(() => {
    const searchTerm = gaugePickerSearch.trim().toLocaleLowerCase();
    if (searchTerm.length < 2) return [];
    return availableCalibrationGauges.filter((gauge) => [gauge.gaugeId, gauge.instrumentName, gauge.itemCode, gaugeAgency(gauge), gaugeStorageLocation(gauge)]
      .some((value) => String(value || "").toLocaleLowerCase().includes(searchTerm)));
  }, [availableCalibrationGauges, gaugePickerSearch]);

  const resetDraft = () => {
    setOutwardType("FINISHED_GOODS"); setOutwardDate(todayInAppTimeZone()); setPartyId(""); setTransportMode("");
    setTransportReference(""); setCalibrationAgency(""); setExpectedReturnDate(""); setDispatchFrom("Calibration Hold / Dispatch Rack");
    setCalibrationGaugeIds([]); setCalibrationGauges([]); setAvailableCalibrationGauges([]); setGaugePickerOpen(false); setGaugePickerSearch(""); setRemarks(""); setLines([blankLine()]); setToolRegrindLines([blankToolRegrindLine()]); setShowForm(false);
    if (requestedGaugeIds || requestedPurpose) navigate("/material-outward", { replace: true });
  };
  const setLine = (index: number, patch: Partial<DraftLine>) => setLines((current) => current.map((line, lineIndex) => lineIndex === index ? { ...line, ...patch } : line));
  const setToolRegrindLine = (index: number, patch: Partial<ToolRegrindLine>) => setToolRegrindLines((current) => current.map((line, lineIndex) => lineIndex === index ? { ...line, ...patch } : line));

  const submit = async () => {
    if (isCalibrationDispatch) {
      if (!calibrationGaugeIds.length || !calibrationAgency.trim() || !outwardDate || !expectedReturnDate || !dispatchFrom.trim()) {
        setError("Select Gauge IDs and enter the calibration agency, dispatch date, expected return date, and dispatch location.");
        return;
      }
      try {
        setSaving(true); setError("");
        const response = await materialOutwardApi.createCalibrationDispatch({ gaugeMasterIds: calibrationGaugeIds, calibrationAgency: calibrationAgency.trim(), dispatchDate: outwardDate, expectedReturnDate, courierReference: transportReference.trim(), dispatchFrom: dispatchFrom.trim(), remarks: remarks.trim() });
        const challanNumber = response?.data?.challanNumber || response?.data?.outwardNumber;
        showSuccess(`Calibration Dispatch Challan${challanNumber ? ` ${challanNumber}` : ""} created in GRN Outward.`);
        resetDraft(); await load();
      } catch (reason) { setError(apiMessage(reason)); }
      finally { setSaving(false); }
      return;
    }
    if (isToolRegrind) {
      const supplierId = Number(partyId);
      const items = toolRegrindLines.map((line) => ({ itemId: Number(line.itemId), quantity: Number(line.quantity), sourceStockStatus: line.sourceStockStatus }));
      if (!Number.isSafeInteger(supplierId) || supplierId < 1 || !outwardDate || items.some((line) => !Number.isSafeInteger(line.itemId) || line.itemId < 1 || !Number.isFinite(line.quantity) || line.quantity <= 0)) {
        setError("Select the regrinding supplier and enter a positive quantity for every tool line.");
        return;
      }
      try {
        setSaving(true); setError("");
        const response = await materialOutwardApi.createToolRegrindDispatch({ supplierId, dispatchDate: outwardDate, expectedReturnDate: expectedReturnDate || undefined, courierVehicleReference: transportReference.trim(), remarks: remarks.trim(), items });
        const challanNumber = response?.data?.challanNumber || response?.data?.outwardNumber;
        showSuccess(`Tool Regrinding DC${challanNumber ? ` ${challanNumber}` : ""} created in GRN Outward.`);
        resetDraft(); await load();
      } catch (reason) { setError(apiMessage(reason)); }
      finally { setSaving(false); }
      return;
    }
    const parsedPartyId = Number(partyId);
    const items = lines.map((line) => ({ stockBalanceId: Number(line.stockBalanceId), quantity: Number(line.quantity) }));
    if (!Number.isSafeInteger(parsedPartyId) || parsedPartyId < 1 || !outwardDate || !transportMode.trim() || items.some((line) => !line.stockBalanceId || !Number.isFinite(line.quantity) || line.quantity <= 0)) {
      setError("Select the party and stock source, then enter a positive quantity and transport mode for every line.");
      return;
    }
    try {
      setSaving(true); setError("");
      await materialOutwardApi.create({ outwardType, outwardDate, partyId: parsedPartyId, transportMode: transportMode.trim(), transportReference: transportReference.trim(), remarks: remarks.trim(), items });
      showSuccess("Material Outward submitted for approval. Stock remains unchanged until dispatch.");
      resetDraft(); await load();
    } catch (reason) { setError(apiMessage(reason)); }
    finally { setSaving(false); }
  };

  const approve = async (document: Row) => {
    const documentId = Number(document.materialOutwardDocumentId);
    if (!await confirmAction({ title: "Approve Material Outward?", message: `${text(document.outwardNumber)} will become ready for gate dispatch. Stock will still remain unchanged until dispatch.`, confirmLabel: "Approve" })) return;
    try { setError(""); await materialOutwardApi.approve(documentId); showSuccess("Material Outward approved. Record the gate exit to reduce stock."); await load(); }
    catch (reason) { setError(apiMessage(reason)); }
  };

  const viewChallan = async (document: Row) => {
    const documentId = Number(document.materialOutwardDocumentId);
    try {
      setChallanLoadingId(documentId);
      setError("");
      const response = await materialOutwardApi.get(documentId);
      setChallanDocument(response?.data || null);
    } catch (reason) {
      setError(apiMessage(reason));
    } finally {
      setChallanLoadingId(null);
    }
  };

  return <main className="material-outward-page">
    <header className="material-outward-header">
      <div>
        <p>GRN Outward</p>
        <h1>Material Outward</h1>
        <span>Create customer deliveries, supplier issues, calibration dispatches, or controlled returns.</span>
      </div>
      <div className="material-outward-header-actions">
        <nav className="material-outward-return-actions" aria-label="Controlled return actions">
          <Link to="/inventory/rejection-inventory" className="material-outward-return-link">Vendor Return</Link>
          <Link to="/inventory/return-to-customer" className="material-outward-return-link">Customer Return</Link>
        </nav>
        <button type="button" className="material-outward-primary" onClick={() => setShowForm(true)}><Plus size={17} /> New Material Outward</button>
      </div>
    </header>
    <MaterialMovementTabs />
    <section className="material-outward-flow" aria-label="Available outward workflows"><div><Truck size={21}/><strong>Finished goods</strong><span>Stock → Customer Delivery</span></div><div><Factory size={21}/><strong>Outsource issue</strong><span>Stock → Supplier WIP → GRN</span></div><div><CheckCircle2 size={21}/><strong>Calibration dispatch</strong><span>Gauge IDs → Agency → Return GRN</span></div><div><Send size={21}/><strong>Tool regrinding</strong><span>Tool Crib → Supplier → Tool Return GRN</span></div></section>
    {error && <div className="material-outward-error">{error}</div>}
    {showForm && (
      <section className="material-outward-form">
        <header><div><h2>{isCalibrationDispatch ? "Create Calibration Dispatch Challan" : isToolRegrind ? "Create Tool Regrinding DC" : "New Material Outward"}</h2><p>{isCalibrationDispatch ? "Select the Gauge IDs required for calibration. This GRN Outward record becomes their dispatch challan." : isToolRegrind ? "Dispatch tools from Tool Crib to the regrinding supplier. The DC can be viewed and printed from this register." : "Create the request first. Approval and gate dispatch are separate actions."}</p></div><button type="button" aria-label="Close Material Outward form" onClick={resetDraft}><X size={18}/></button></header>
        <div className={`material-outward-form-grid${isCalibrationDispatch ? " material-outward-calibration-grid" : ""}`}>
          <label>Outward purpose<select value={outwardType} onChange={(event) => { const nextType = event.target.value as MaterialOutwardType; setOutwardType(nextType); setPartyId(""); if (nextType !== "CALIBRATION_DISPATCH") { setCalibrationGaugeIds([]); setCalibrationGauges([]); setCalibrationAgency(""); setDispatchFrom("Calibration Hold / Dispatch Rack"); setGaugePickerOpen(false); } if (nextType !== "TOOL_REGRIND") setToolRegrindLines([blankToolRegrindLine()]); setError(""); }}><option value="FINISHED_GOODS">Finished Goods Delivery</option><option value="OUTSOURCE_ISSUE">Outsource Issue</option><option value="CALIBRATION_DISPATCH">Calibration Dispatch</option><option value="TOOL_REGRIND">Tool Regrinding</option></select></label>
          {isCalibrationDispatch ? <>
            <div className="material-outward-gauge-search-picker">
              <label><span>Search Gauge ID</span><input value={gaugePickerSearch} onFocus={() => { if (!availableCalibrationGauges.length && !gaugePickerLoading) void loadCalibrationGaugeOptions(); }} onChange={(event) => searchCalibrationGauges(event.target.value)} placeholder="Gauge ID, instrument, or storage location (2+ letters)" autoComplete="off" /></label>
              {gaugePickerOpen && <div className="material-outward-gauge-search-results">
                {gaugePickerSearch.trim().length < 2 ? <p>Type at least 2 letters to search the collected Gauge IDs.</p> : gaugePickerLoading ? <p>Loading collected Gauge IDs…</p> : visibleCalibrationGaugeOptions.length ? visibleCalibrationGaugeOptions.map((gauge) => { const id = gaugeMasterId(gauge); const selected = calibrationGaugeIds.includes(id); const agency = gaugeAgency(gauge); const unavailable = !agency || Boolean(selectedCalibrationAgencyKey && normalizedAgency(agency) !== selectedCalibrationAgencyKey); return <button key={id} type="button" disabled={selected || unavailable} title={!agency ? "Set the Calibration Agency in Gauge Master first" : unavailable ? "Choose Gauge IDs for the same Calibration Agency" : "Add Gauge ID"} onClick={() => toggleCalibrationGauge(gauge)}><span><strong>{text(gauge.gaugeId)}</strong><small>{text(gauge.instrumentName)} · {text(gauge.itemCode)}</small></span><em>{agency || "Agency not configured"}</em><small>{gaugeStorageLocation(gauge) || "Storage location unavailable"}</small>{selected ? <b>Added</b> : <b>Add</b>}</button>; }) : <p>No collected Gauge IDs match this search.</p>}
              </div>}
            </div>
            <label>Calibration Agency<input value={calibrationAgency} readOnly placeholder="Auto-filled from selected Gauge IDs" /></label>
            <label className="material-outward-date-field">Dispatch Date<input type="date" value={outwardDate} onChange={(event) => setOutwardDate(event.target.value)} /></label>
            <label className="material-outward-date-field">Expected Return Date<input type="date" min={outwardDate} value={expectedReturnDate} onChange={(event) => setExpectedReturnDate(event.target.value)} /></label>
            <label className="material-outward-courier-field">Courier / Vehicle Reference<input value={transportReference} onChange={(event) => setTransportReference(event.target.value)} placeholder="Courier name, docket or vehicle number" /></label>
            <label className="material-outward-dispatch-location">Storage Location / Dispatch From<input value={dispatchFrom} readOnly placeholder="Auto-filled from selected Gauge IDs" /></label>
          </> : isToolRegrind ? <>
            <label>Regrinding supplier<select value={partyId} onChange={(event) => setPartyId(event.target.value)}><option value="">Select regrinding supplier</option>{toolingSuppliers.map((supplier) => <option key={Number(supplier.supplierId)} value={Number(supplier.supplierId)}>{text(supplier.supplierCode)} · {text(supplier.supplierName)}</option>)}</select></label>
            <label>Dispatch date<input type="date" value={outwardDate} onChange={(event) => setOutwardDate(event.target.value)} /></label>
            <label>Expected return date<input type="date" min={outwardDate} value={expectedReturnDate} onChange={(event) => setExpectedReturnDate(event.target.value)} /></label>
            <label>Courier / vehicle reference<input value={transportReference} onChange={(event) => setTransportReference(event.target.value)} placeholder="Courier name, docket or vehicle number" /></label>
          </> : <>
            <label>Outward date<input type="date" value={outwardDate} onChange={(event) => setOutwardDate(event.target.value)} /></label>
            <label>{partyLabel}<select value={partyId} onChange={(event) => setPartyId(event.target.value)}><option value="">Select {partyLabel.toLowerCase()}</option>{parties.map((party) => { const id = Number(outwardType === "FINISHED_GOODS" ? party.customerId : party.supplierId); const name = outwardType === "FINISHED_GOODS" ? party.customerName : party.supplierName; const code = outwardType === "FINISHED_GOODS" ? party.customerCode : party.supplierCode; return <option key={id} value={id}>{text(code)} · {text(name)}</option>; })}</select></label>
            <label>Transport mode<input value={transportMode} onChange={(event) => setTransportMode(event.target.value)} placeholder="e.g. Road / Courier" /></label>
            <label>Transport / challan reference<input value={transportReference} onChange={(event) => setTransportReference(event.target.value)} placeholder="Optional until gate exit" /></label>
          </>}
          <label className={isCalibrationDispatch ? "material-outward-remarks" : "material-outward-wide"}>Remarks<textarea value={remarks} onChange={(event) => setRemarks(event.target.value)} placeholder={isCalibrationDispatch || isToolRegrind ? "Optional dispatch instructions" : "Purpose, customer/supplier instructions or handling notes"} /></label>
        </div>
        {isCalibrationDispatch ? <section className="material-outward-calibration-gauges">
          <header><div><h3>Selected Gauge IDs</h3><p>Agency and storage location are filled automatically.</p></div></header>
          <div className="material-outward-calibration-selected">
            {calibrationGauges.length ? calibrationGauges.map((gauge) => <span key={String(gaugeMasterId(gauge))}><button type="button" title={`Remove ${text(gauge.gaugeId)}`} aria-label={`Remove ${text(gauge.gaugeId)}`} onClick={() => { applyCalibrationGaugeSelection(calibrationGauges.filter((entry) => gaugeMasterId(entry) !== gaugeMasterId(gauge))); setError(""); }}><X size={14}/></button><strong>{text(gauge.gaugeId)}</strong><em>{text(gauge.instrumentName)}</em><small>{gaugeStorageLocation(gauge) || "Storage location unavailable"}</small></span>) : <p>No Gauge IDs selected. Search above and add the gauges that must be sent for calibration.</p>}
          </div>
        </section> : isToolRegrind ? <section className="material-outward-lines"><header><div><h3>Tools to send for regrinding</h3><p>Select Tool Crib stock. Regrind-required stock is selected by default.</p></div><button type="button" onClick={() => setToolRegrindLines((current) => [...current, blankToolRegrindLine()])}><Plus size={15}/> Add line</button></header>{toolRegrindLines.map((line, index) => { const selectedItemIds = new Set(toolRegrindLines.map((entry) => entry.itemId).filter(Boolean)); return <div className="material-outward-line" key={index}><label>Tool item<select value={line.itemId} onChange={(event) => setToolRegrindLine(index, { itemId: event.target.value })}><option value="">Select tool item</option>{toolRegrindItems.map((item) => { const itemId = String(item.itemId); const disabled = selectedItemIds.has(itemId) && line.itemId !== itemId; const available = Number(item.toolCribQuantity || 0); const regrind = Number(item.regrindRequiredQuantity || 0); return <option key={itemId} value={itemId} disabled={disabled}>{text(item.itemCode)} · {text(item.itemDescription)} · Available {amount(available)} · Regrind required {amount(regrind)} {text(item.uomCode)}</option>; })}</select></label><label>Source status<select value={line.sourceStockStatus} onChange={(event) => setToolRegrindLine(index, { sourceStockStatus: event.target.value as ToolRegrindLine["sourceStockStatus"] })}><option value="REGRIND_REQUIRED">Regrind required</option><option value="AVAILABLE">Available</option></select></label><label>Quantity<input type="number" min="0.001" step="0.001" value={line.quantity} onChange={(event) => setToolRegrindLine(index, { quantity: event.target.value })} placeholder="0.000" /></label>{toolRegrindLines.length > 1 && <button type="button" className="material-outward-line-remove" aria-label="Remove tool line" onClick={() => setToolRegrindLines((current) => current.filter((_, lineIndex) => lineIndex !== index))}><X size={17}/></button>}</div>; })}</section> : <div className="material-outward-lines"><header><div><h3>Company stock to move</h3><p>Select only company-owned available stock. The balance is checked again on dispatch.</p></div><button type="button" onClick={() => setLines((current) => [...current, blankLine()])}><Plus size={15}/> Add line</button></header>{lines.map((line, index) => <div className="material-outward-line" key={index}><label>Available stock<select value={line.stockBalanceId} onChange={(event) => setLine(index, { stockBalanceId: event.target.value })}><option value="">Select stock location</option>{stockRows.map((stock) => { const stockId = String(stock.inventoryStockBalanceId); const disabled = selectedStockIds.has(stockId) && line.stockBalanceId !== stockId; return <option key={stockId} value={stockId} disabled={disabled}>{text(stock.itemCode)} · {text(stock.itemDescription)} · {amount(stock.quantityOnHand)} {text(stock.uomCode)} · {text(stock.warehouseCode)} / {text(stock.binLocation)}</option>; })}</select></label><label>Quantity<input type="number" min="0.001" step="0.001" value={line.quantity} onChange={(event) => setLine(index, { quantity: event.target.value })} placeholder="0.000" /></label>{lines.length > 1 && <button type="button" className="material-outward-line-remove" aria-label="Remove stock line" onClick={() => setLines((current) => current.filter((_, lineIndex) => lineIndex !== index))}><X size={17}/></button>}</div>)}</div>}
        <footer><button type="button" className="material-outward-secondary" onClick={resetDraft}>Cancel</button><button type="button" className="material-outward-primary" disabled={saving} onClick={() => { void submit(); }}><Send size={16}/>{saving ? "Creating…" : isCalibrationDispatch ? "Create Challan and Dispatch" : isToolRegrind ? "Create Regrinding DC" : "Submit for Approval"}</button></footer>
      </section>
    )}
    <section className="material-outward-list"><header><div><ClipboardList size={19}/><div><h2>Material Outward Register</h2><p>{documents.length} document(s) shown. Approve a stock issue first, then record its physical dispatch in Gate Exit.</p></div></div><div className="material-outward-filters"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search outward no., party or item" /><select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as "" | MaterialOutwardType)}><option value="">All purposes</option><option value="FINISHED_GOODS">Finished goods</option><option value="OUTSOURCE_ISSUE">Outsource issue</option><option value="CALIBRATION_DISPATCH">Calibration dispatch</option><option value="TOOL_REGRIND">Tool regrinding</option></select><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "" | "PENDING_APPROVAL" | "APPROVED" | "DISPATCHED")}><option value="">All statuses</option><option value="PENDING_APPROVAL">Pending approval</option><option value="APPROVED">Approved</option><option value="DISPATCHED">Dispatched</option></select></div></header><div className="material-outward-table"><table><thead><tr><th>Outward</th><th>Purpose / party</th><th>Items</th><th>Transport</th><th>Status</th><th>Action</th></tr></thead><tbody>{loading ? <tr><td colSpan={6}>Loading Material Outward register…</td></tr> : documents.length ? documents.map((document) => { const id = Number(document.materialOutwardDocumentId); const calibrationDispatch = document.outwardType === "CALIBRATION_DISPATCH"; return <tr key={id}><td><strong>{text(document.outwardNumber)}</strong><small>{text(document.outwardDate)}</small></td><td><strong>{outwardTypeLabel(document.outwardType)}</strong><small>{calibrationDispatch ? text(document.calibrationAgency || document.partyName) : `${text(document.partyCode)} · ${text(document.partyName)}`}</small></td><td>{calibrationDispatch ? <><strong>{text(document.gaugeIds)}</strong><small>{amount(document.calibrationGaugeCount)} Gauge ID(s) · Return due {text(document.expectedReturnDate)}</small></> : <>{text(document.itemSummary)}<small>{amount(document.totalQuantity)} units across {text(document.itemCount)} line(s)</small></>}</td><td>{calibrationDispatch ? text(document.courierReference || document.transportReference) : text(document.transportMode)}<small>{calibrationDispatch ? `From: ${text(document.dispatchFrom)}` : text(document.transportReference)}</small></td><td><span className={`material-outward-status ${String(document.documentStatus || "").toLowerCase()}`}>{statusLabel(document.documentStatus)}</span>{document.gateExitReference && <small>Gate exit: {text(document.gateExitReference)}</small>}</td><td>{!calibrationDispatch && document.documentStatus === "DISPATCHED" && <button type="button" onClick={() => { void viewChallan(document); }} disabled={challanLoadingId === id}>{challanLoadingId === id ? "Loading…" : "View"}</button>}{document.documentStatus === "PENDING_APPROVAL" && <button type="button" onClick={() => { void approve(document); }}>Approve</button>}{document.documentStatus === "APPROVED" && <button type="button" onClick={() => navigate(`/gate-exit?materialOutwardDocumentId=${id}`)}>Gate Exit</button>}{document.documentStatus === "DISPATCHED" && <small>Dispatched</small>}</td></tr>; }) : <tr><td colSpan={6}>No Material Outward documents match the selected filters.</td></tr>}</tbody></table></div></section>
    {challanDocument && <div className="material-outward-challan-overlay" role="dialog" aria-modal="true" aria-label="Delivery challan">
      <section className="material-outward-challan-modal">
        <header>
          <div><p>GRN Outward</p><h2>{challanDocument.outwardType === "TOOL_REGRIND" ? "Tool Regrinding DC" : challanDocument.outwardType === "OUTSOURCE_ISSUE" ? "Outsource Delivery Challan" : "Delivery Challan"}</h2><span>{text(challanDocument.outwardNumber)}</span></div>
          <button type="button" className="material-outward-challan-close" aria-label="Close delivery challan" onClick={() => setChallanDocument(null)}><X size={19}/></button>
        </header>
        <div className="material-outward-challan-details">
          <dl>
            <div><dt>Challan No.</dt><dd>{text(challanDocument.outwardNumber)}</dd></div>
            <div><dt>Outward Date</dt><dd>{text(challanDocument.outwardDate)}</dd></div>
            <div><dt>Purpose</dt><dd>{outwardTypeLabel(challanDocument.outwardType)}</dd></div>
            <div><dt>{["OUTSOURCE_ISSUE", "TOOL_REGRIND"].includes(String(challanDocument.outwardType)) ? "Supplier" : "Customer"}</dt><dd>{challanDocument.partyCode ? <>{text(challanDocument.partyCode)}{challanDocument.partyName ? " · " : ""}</> : null}{text(challanDocument.partyName)}</dd></div>
            <div><dt>Transport Mode</dt><dd>{text(challanDocument.transportMode)}</dd></div>
            <div><dt>Transport Reference</dt><dd>{text(challanDocument.transportReference)}</dd></div>
            <div><dt>Gate Exit Reference</dt><dd>{text(challanDocument.gateExitReference)}</dd></div>
          </dl>
          {challanDocument.remarks && <div className="material-outward-challan-remarks"><strong>Remarks</strong><p>{text(challanDocument.remarks)}</p></div>}
          <section className="material-outward-challan-items"><h3>Material Details</h3><div><table><thead><tr><th>#</th><th>Item Code</th><th>Description</th><th>Source Location</th><th>Batch / Serial</th><th>Quantity</th></tr></thead><tbody>{Array.isArray(challanDocument.items) && challanDocument.items.length ? challanDocument.items.map((item: Row, index: number) => <tr key={String(item.materialOutwardDocumentItemId || index)}><td>{index + 1}</td><td>{text(item.itemCode)}</td><td>{text(item.itemDescription)}</td><td>{text(item.warehouseCode)} / {text(item.binLocation)}</td><td>{text(item.batchSerialNumber)}</td><td>{amount(item.quantity)} {text(item.uomCode)}</td></tr>) : <tr><td colSpan={6}>No material lines found.</td></tr>}</tbody></table></div></section>
        </div>
        <footer className="material-outward-challan-actions"><button type="button" className="material-outward-secondary" onClick={() => setChallanDocument(null)}>Close</button><button type="button" className="material-outward-primary" onClick={() => window.print()}><Printer size={16}/> Print</button></footer>
      </section>
    </div>}
  </main>;
}
