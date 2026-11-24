import { ClipboardCheck, Factory, RefreshCw, Search } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiMessage } from "../../../api/client";
import { inventoryApi } from "../../../api/inventory.api";
import { materialOutwardApi } from "../../../api/materialOutward.api";
import Pagination, { PAGE_SIZE } from "../../../components/Pagination";
import { formatDate, formatDateTime } from "../../../utils/formatDateTime";
import "./OutsourcingWipPage.css";

type WipRow = Record<string, unknown>;
const text = (value: unknown) => value === null || value === undefined || value === "" ? "—" : String(value);
const quantity = (value: unknown) => Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 3 });
const date = formatDate;
const dateTime = formatDateTime;

export default function OutsourcingWipPage() {
  const [rows, setRows] = useState<WipRow[]>([]);
  const [issuedRows, setIssuedRows] = useState<WipRow[]>([]);
  const [issuedTotal, setIssuedTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (query = search, requestedPage = page) => {
    try {
      setLoading(true); setError("");
      const [response, issuedResponse] = await Promise.all([
        inventoryApi.outsourcingWip({ search: query, page: requestedPage, pageSize: PAGE_SIZE }),
        materialOutwardApi.outsourceWip({ search: query, page: requestedPage, pageSize: PAGE_SIZE }),
      ]);
      setRows(response.data || []);
      setTotal(Number(response?.meta?.total || 0));
      setIssuedRows(issuedResponse.data || []);
      setIssuedTotal(Number(issuedResponse?.meta?.total || 0));
    } catch (reason) { setError(apiMessage(reason)); }
    finally { setLoading(false); }
  }, [page, search]);

  useEffect(() => { void load(""); }, []);

  return <main className="outsourcing-wip-page">
    <header className="outsourcing-wip-header"><h1>Outsourcing WIP</h1><button type="button" className="outsourcing-wip-refresh" onClick={() => { void load(); }}><RefreshCw size={16}/> Refresh</button></header>
    <nav className="outsourcing-wip-tabs" aria-label="Outsourcing WIP navigation"><Link to="/inventory">Inventory dashboard</Link><Link to="/material-outward">Material Outward</Link><Link to="/grn-inward">GRN Inward</Link><Link to="/inventory/outsourcing-wip" className="active">Outsourcing WIP</Link></nav>
    <section className="outsourcing-wip-guide"><Factory size={22}/><div><strong>Outsource stock flow</strong><span>Material issued through GRN Outward is visible below as supplier WIP. When it returns, record Gate Entry and GRN Inward so the receipt is controlled separately.</span></div></section>
    <form className="outsourcing-wip-search app-list-toolbar" onSubmit={(event) => { event.preventDefault(); setPage(1); void load(search, 1); }}><label><Search size={16}/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search GRN, gate entry, supplier, part or batch" /></label><button type="submit">Search</button>
        <Pagination page={page} total={total} onPageChange={(nextPage) => { setPage(nextPage); void load(search, nextPage); }} itemLabel="WIP lines" disabled={loading}/>
      </form>
    {error && <div className="outsourcing-wip-error">{error}</div>}
    <section className="outsourcing-wip-card outsourcing-wip-issued-card"><header><div><Factory size={18}/><div><h2>Material issued to outsource suppliers</h2><p>{issuedTotal} active issue line(s). Company stock reduced only when the outward document was approved and dispatched.</p></div></div></header><div className="outsourcing-wip-table"><table><thead><tr><th>Outward / gate exit</th><th>Supplier</th><th>Material</th><th>Batch</th><th>Issued / supplier WIP</th><th>Status</th><th className="app-last-updated-column">Last Updated</th></tr></thead><tbody>{loading ? <tr><td colSpan={7}>Loading outbound supplier WIP…</td></tr> : issuedRows.length ? issuedRows.map((row) => <tr key={String(row.outsourcingIssueWipBalanceId)}><td><strong>{text(row.outwardNumber)}</strong><small>{date(row.outwardDate)} · Gate exit: {text(row.gateExitReference)}</small></td><td>{text(row.supplierName)}</td><td><strong>{text(row.itemCode)}</strong><small>{text(row.itemDescription)}</small></td><td>{text(row.batchSerialNumber)}</td><td><strong>{quantity(row.quantityIssued)} {text(row.uomCode)}</strong><small>{quantity(row.quantityInWip)} with supplier</small></td><td><span className="outsourcing-wip-status">{text(row.wipStatus).replace(/_/g, " ")}</span></td><td className="app-last-updated-column">{dateTime(row.lastUpdatedAt)}</td></tr>) : <tr><td colSpan={7}>No dispatched outsource material is currently in supplier WIP.</td></tr>}</tbody></table></div></section>
    <section className="outsourcing-wip-card"><header><div><ClipboardCheck size={18}/><div><h2>Received outsourced parts</h2><p>{total} WIP line(s). Process-plan inspection remains pending until the operation is performed.</p></div></div></header><div className="outsourcing-wip-table"><table><thead><tr><th>GRN / Gate Entry</th><th>Supplier document</th><th>Part</th><th>Batch</th><th>Received / WIP</th><th>Process Plan operation</th><th>Quality point</th><th className="app-last-updated-column">Last Updated</th></tr></thead><tbody>{loading ? <tr><td colSpan={8}>Loading Outsourcing WIP…</td></tr> : rows.length ? rows.map((row) => <tr key={String(row.id)}><td><strong>{text(row.grnNumber)}</strong><small>{text(row.gateEntryNumber)} · {date(row.grnDate)}</small></td><td><strong>{text(row.supplierName)}</strong><small>Invoice: {text(row.supplierInvoiceNumber)} · Challan: {text(row.deliveryChallanNumber)}</small></td><td><strong>{text(row.partNumber)}</strong><small>{text(row.partName)}</small></td><td>{text(row.batchSerialNumber)}</td><td><strong>{quantity(row.receivedQuantity)} {text(row.uomCode)}</strong><small>{quantity(row.quantityInWip)} in WIP</small></td><td><strong>{text(row.processPlanCode || "Approved process plan")}</strong><small>Op {text(row.operationNumber)} · {text(row.operationName)}</small></td><td><span className="outsourcing-wip-status">{text(row.wipStatus).replace(/_/g, " ")}</span><small>{row.inspectionRequired === "Y" ? "Inspection plan required" : "Operation inspection as configured"}</small></td><td className="app-last-updated-column">{dateTime(row.lastUpdatedAt)}</td></tr>) : <tr><td colSpan={8}>No outsourced part receipts are waiting in WIP.</td></tr>}</tbody></table></div></section>
  </main>;
}
