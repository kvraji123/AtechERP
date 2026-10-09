import { Download, Mail, RefreshCw, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiMessage } from "../../../api/client";
import { purchaseApi } from "../../../api/purchase.api";
import Pagination, { PAGE_SIZE } from "../../../components/Pagination";
import { useAppFeedback } from "../../../components/AppFeedback";
import { formatDateTime } from "../../../utils/formatDateTime";
import PurchaseModuleTabs from "./components/PurchaseModuleTabs";
import "./PurchaseFlow.css";

type EmailOutboxRow = { emailOutboxId: number; enquiryNumber: string; supplierName: string; recipientEmail: string; subject: string; status: "PENDING" | "PROCESSING" | "SENT" | "FAILED" | "CANCELLED"; attempts: number; createdAt: string; sentAt?: string | null; lastError?: string | null; rfqPdfUrl?: string | null; rfqPdfFileName?: string | null };
const stamp = (value?: string | null) => formatDateTime(value);

export default function RfqEmailOutboxPage() {
  const navigate = useNavigate();
  const { showSuccess } = useAppFeedback();
  const [rows, setRows] = useState<EmailOutboxRow[]>([]);
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retrying, setRetrying] = useState<number | null>(null);
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { const response = await purchaseApi.listRfqEmailOutbox({ page, pageSize: PAGE_SIZE, status }); setRows((response?.data || []) as EmailOutboxRow[]); setTotal(Number(response?.meta?.total || 0)); }
    catch (loadError) { setError(apiMessage(loadError)); setRows([]); }
    finally { setLoading(false); }
  }, [page, status]);
  useEffect(() => { void load(); }, [load]);
  const retry = async (row: EmailOutboxRow) => {
    setRetrying(row.emailOutboxId);
    try { await purchaseApi.retryRfqEmail(row.emailOutboxId); showSuccess(`Email to ${row.supplierName} has been queued for retry.`); await load(); }
    catch (retryError) { setError(apiMessage(retryError)); }
    finally { setRetrying(null); }
  };

  return <div className="purchase-page">
    <header className="purchase-page-header"><div className="purchase-title-group"><span className="purchase-back-button"><Mail size={19} /></span><div><p>Purchase / RFQ Email Outbox</p><h1>RFQ Email Outbox</h1><span>Monitor supplier RFQ email delivery and retry failed messages.</span></div></div></header>
    <PurchaseModuleTabs />
    <section className="purchase-rfq-tracking-list">
      <div className="purchase-rfq-tracking-filters purchase-rfq-outbox-filters app-list-toolbar">
        <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} aria-label="Filter email status"><option value="">All delivery statuses</option><option value="PENDING">Pending</option><option value="PROCESSING">Processing</option><option value="SENT">Sent</option><option value="FAILED">Failed</option></select>
        <button type="button" className="purchase-secondary-button purchase-list-refresh" onClick={() => { void load(); }}><RefreshCw size={14} /> Refresh</button>
        <button type="button" className="purchase-secondary-button purchase-rfq-outbox-tracking" onClick={() => navigate("/purchase/rfqs")}>RFQ Tracking</button>
        <span className="purchase-rfq-outbox-count">{total} records</span>
      
        <Pagination page={page} total={total} onPageChange={setPage} itemLabel="email messages" disabled={loading} />
      </div>
      {loading ? <div className="purchase-rfq-tracking-empty">Loading RFQ email outbox…</div> : error ? <div className="purchase-rfq-tracking-empty">Unable to load RFQ email outbox: {error}</div> : !rows.length ? <div className="purchase-rfq-tracking-empty">No RFQ email messages match the selected status.</div> : <div className="purchase-rfq-tracking-table-wrap"><table className="purchase-rfq-tracking-table"><thead><tr><th>RFQ</th><th>Supplier</th><th>Recipient</th><th>Subject</th><th>Status</th><th>Attempts</th><th>Sent / Queued</th><th>Action</th></tr></thead><tbody>{rows.map((row) => <tr key={row.emailOutboxId}><td><strong>{row.enquiryNumber}</strong></td><td>{row.supplierName}</td><td>{row.recipientEmail}</td><td>{row.subject}</td><td><span className={`purchase-rfq-tracking-status ${row.status.toLowerCase()}`}>{row.status === "SENT" ? "Sent" : row.status === "PROCESSING" ? "Sending" : row.status === "FAILED" ? "Failed" : "Pending"}</span>{row.lastError && <small>{row.lastError}</small>}</td><td>{row.attempts}</td><td>{stamp(row.sentAt || row.createdAt)}</td><td>{row.rfqPdfUrl && <a className="purchase-secondary-button" href={row.rfqPdfUrl} download={row.rfqPdfFileName || true}><Download size={14} /> RFQ PDF</a>}{row.status === "FAILED" && <button type="button" className="purchase-secondary-button" disabled={retrying === row.emailOutboxId} onClick={() => { void retry(row); }}><RotateCcw size={14} /> {retrying === row.emailOutboxId ? "Retrying…" : "Retry"}</button>}</td></tr>)}</tbody></table></div>}
      
    </section>
  </div>;
}
