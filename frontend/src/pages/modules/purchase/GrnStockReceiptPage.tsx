import { ArrowLeft, PackageCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiMessage } from "../../../api/client";
import { purchaseApi } from "../../../api/purchase.api";
import { useAppFeedback } from "../../../components/AppFeedback";
import { todayInAppTimeZone } from "../../../utils/formatDateTime";
import GrnStockReceiptForm from "./components/GrnStockReceiptForm";
import GrnWorkflowStepper from "./components/GrnWorkflowStepper";
import PurchaseModuleTabs from "./components/PurchaseModuleTabs";
import type { GrnItem, GrnRecord } from "./grnData";
import { mapGrn } from "./purchaseReceiptMappers";
import "./PurchaseFlow.css";

export default function GrnStockReceiptPage() {
  const navigate = useNavigate();
  const { grnId } = useParams();
  const { showSuccess } = useAppFeedback();
  const [value, setValue] = useState<GrnRecord | null>(null);
  const [error, setError] = useState("");
  const [approving, setApproving] = useState(false);

  useEffect(() => {
    let active = true;
    void purchaseApi.getGrn(grnId || "").then((response) => {
      if (!active) return;
      const receipt = mapGrn(response.data);
      setValue((receipt.stockPostingDate || receipt.status === "STOCK_POSTED") ? receipt : { ...receipt, stockPostingDate: todayInAppTimeZone() });
    }).catch((reason) => active && setError(apiMessage(reason)));
    return () => { active = false; };
  }, [grnId]);

  const approvePurchase = async () => {
    if (!value || approving) return;
    setApproving(true);
    setError("");
    try {
      const response = await purchaseApi.approveGrnPurchase(value.id);
      setValue((current) => current ? { ...current, purchaseApprovedBy: response.data.purchase_approved_by } : current);
      showSuccess("Open purchase approved for stock posting.");
    } catch (reason) {
      setError(apiMessage(reason));
    } finally {
      setApproving(false);
    }
  };

  const patchItem = (itemId: number, patch: Partial<GrnItem>) => setValue((current) => current ? { ...current, items: current.items.map((item) => item.id === itemId ? { ...item, ...patch } : item) } : current);
  const post = async () => {
    if (!value) return;
    const acceptedItems = value.items.filter((item) => item.acceptedQuantity > 0);
    if (!acceptedItems.length) { setError("Accepted material is required for stock posting."); return; }
    if (!value.stockPostingDate || !value.receivedBy.trim() || acceptedItems.some((item) => !item.warehouse.trim() || !item.binLocation.trim())) { setError("Enter stock posting date, received by, warehouse and bin location for every accepted item."); return; }
    try {
      const response = await purchaseApi.postGrn(value.id, { stockPostingDate: value.stockPostingDate, receivedBy: value.receivedBy, items: acceptedItems.map((item) => ({ grnItemId: item.id, warehouseCode: item.warehouse, binLocation: item.binLocation, batchSerialNumber: item.batchSerialNumber })) });
      if (Number(response?.data?.gaugeRegistrationItemCount || 0) > 0) {
        showSuccess(`${value.grnNumber} posted to inventory. Register each physical gauge before issue.`);
        navigate("/masters/gauges/register", { replace: true });
        return;
      }
      showSuccess(`${value.grnNumber} posted to inventory.`);
      navigate("/purchase/grn", { replace: true });
    } catch (reason) {
      setError(apiMessage(reason));
    }
  };

  if (!value) return <div className="purchase-page"><div className="purchase-grn-empty">{error || "Loading GRN…"}</div></div>;
  const needsApproval = value.receiptType === "OPEN_PURCHASE" && !value.purchaseApprovedBy && value.status !== "STOCK_POSTED";

  return <div className="purchase-page">
    <header className="purchase-page-header"><div className="purchase-title-group"><button type="button" className="purchase-back-button" onClick={() => navigate("/purchase/grn")}><ArrowLeft size={19} /></button><span className="purchase-page-module-icon"><PackageCheck size={19} /></span><div><p>Purchase / GRN</p><h1>Stock Receipt</h1><span>Post accepted GRN quantities to warehouse inventory</span></div></div></header>
    <PurchaseModuleTabs />
    <div className="purchase-grn-page">
      <GrnWorkflowStepper stage="STOCK" />
      {value.receiptType === "OPEN_PURCHASE" && <section className="purchase-grn-ownership purchase-open-purchase-approval"><div><strong>{value.purchaseApprovedBy ? `Purchase approved by ${value.purchaseApprovedBy}` : "Purchase manager approval required"}</strong><span>Order No.: {value.gateEntryReferenceNumber || "Recorded on Gate Entry"}</span></div>{needsApproval && <button type="button" className="purchase-primary-button" disabled={approving} onClick={() => { void approvePurchase(); }}>{approving ? "Approving…" : "Approve purchase"}</button>}</section>}
      <GrnStockReceiptForm value={value} error={error} readOnly={value.status === "STOCK_POSTED"} onChange={(patch) => { setValue({ ...value, ...patch }); setError(""); }} onItemChange={(itemId, patch) => { patchItem(itemId, patch); setError(""); }} onBack={() => navigate("/purchase/grn")} onPost={() => { void post(); }} />
    </div>
  </div>;
}
