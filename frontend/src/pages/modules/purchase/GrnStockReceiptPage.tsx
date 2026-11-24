import { ArrowLeft, PackageCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiMessage } from "../../../api/client";
import { attachmentApi } from "../../../api/attachment.api";
import { purchaseApi } from "../../../api/purchase.api";
import { useAppFeedback } from "../../../components/AppFeedback";
import { todayInAppTimeZone } from "../../../utils/formatDateTime";
import GrnStockReceiptForm from "./components/GrnStockReceiptForm";
import GrnWorkflowStepper from "./components/GrnWorkflowStepper";
import MaterialMovementTabs from "./components/MaterialMovementTabs";
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
  const [uploadingMtcItemId, setUploadingMtcItemId] = useState<number | null>(null);

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
  const refreshAfterMtcChange = async () => {
    const response = await purchaseApi.getGrn(grnId || "");
    const receipt = mapGrn(response.data);
    setValue((current) => current ? {
      ...receipt,
      stockPostingDate: receipt.stockPostingDate || current.stockPostingDate || todayInAppTimeZone(),
      receivedBy: current.receivedBy || receipt.receivedBy,
      items: receipt.items.map((item) => {
        const currentItem = current.items.find((entry) => entry.id === item.id);
        return currentItem ? { ...item, warehouse: currentItem.warehouse, subinventoryCode: currentItem.subinventoryCode, binLocation: currentItem.binLocation, batchSerialNumber: currentItem.batchSerialNumber || item.batchSerialNumber } : item;
      }),
    } : receipt);
  };
  const uploadMtcCertificate = async (itemId: number, file: File) => {
    if (uploadingMtcItemId !== null) return;
    setUploadingMtcItemId(itemId);
    setError("");
    try {
      await attachmentApi.upload("GRN_ITEM", itemId, file, { attachmentType: "MTC_CERTIFICATE", attachmentName: "MTC Certificate" });
      await refreshAfterMtcChange();
      showSuccess("MTC certificate uploaded.");
    } catch (reason) {
      setError(apiMessage(reason));
    } finally {
      setUploadingMtcItemId(null);
    }
  };
  const removeMtcCertificate = async (itemId: number, attachmentId: number) => {
    if (uploadingMtcItemId !== null) return;
    setUploadingMtcItemId(itemId);
    setError("");
    try {
      await attachmentApi.remove("GRN_ITEM", itemId, attachmentId);
      await refreshAfterMtcChange();
      showSuccess("MTC certificate removed.");
    } catch (reason) {
      setError(apiMessage(reason));
    } finally {
      setUploadingMtcItemId(null);
    }
  };
  const post = async () => {
    if (!value) return;
    const acceptedItems = value.items.filter((item) => item.acceptedQuantity > 0);
    if (!acceptedItems.length) { setError("Accepted material is required for stock posting."); return; }
    if (!value.stockPostingDate || !value.receivedBy.trim() || acceptedItems.some((item) => !item.warehouse.trim() || !item.subinventoryCode.trim() || !item.binLocation.trim())) { setError("Enter stock posting date, received by, warehouse, sub-inventory, and bin location for every accepted item."); return; }
    try {
      const response = await purchaseApi.postGrn(value.id, { stockPostingDate: value.stockPostingDate, receivedBy: value.receivedBy, items: acceptedItems.map((item) => ({ grnItemId: item.id, warehouseCode: item.warehouse, subinventoryCode: item.subinventoryCode, binLocation: item.binLocation, batchSerialNumber: item.batchSerialNumber })) });
      if (Number(response?.data?.gaugeRegistrationItemCount || 0) > 0) {
        showSuccess(`${value.grnNumber} posted to inventory. Register each physical gauge before issue.`);
        navigate("/masters/gauges/register", { replace: true });
        return;
      }
      showSuccess(`${value.grnNumber} posted to inventory.`);
      navigate("/grn-inward", { replace: true });
    } catch (reason) {
      setError(apiMessage(reason));
    }
  };

  if (!value) return <div className="purchase-page"><div className="purchase-grn-empty">{error || "Loading GRN…"}</div></div>;
  const needsApproval = value.receiptType === "OPEN_PURCHASE" && !value.purchaseApprovedBy && value.status !== "STOCK_POSTED";

  return <div className="purchase-page">
    <header className="purchase-page-header"><div className="purchase-title-group"><button type="button" className="purchase-back-button" onClick={() => navigate("/grn-inward")}><ArrowLeft size={19} /></button><span className="purchase-page-module-icon"><PackageCheck size={19} /></span><div><p>Material Movement / GRN Inward</p><h1>Stock Receipt</h1><span>Post accepted GRN quantities to warehouse inventory</span></div></div></header>
    <MaterialMovementTabs />
    <div className="purchase-grn-page">
      <GrnWorkflowStepper stage="STOCK" />
      {value.receiptType === "OPEN_PURCHASE" && <section className="purchase-grn-ownership purchase-open-purchase-approval"><div><strong>{value.purchaseApprovedBy ? `Purchase approved by ${value.purchaseApprovedBy}` : "Purchase manager approval required"}</strong><span>Order No.: {value.gateEntryReferenceNumber || "Recorded on Gate Entry"}</span></div>{needsApproval && <button type="button" className="purchase-primary-button" disabled={approving} onClick={() => { void approvePurchase(); }}>{approving ? "Approving…" : "Approve purchase"}</button>}</section>}
      <GrnStockReceiptForm value={value} error={error} readOnly={value.status === "STOCK_POSTED"} onChange={(patch) => { setValue({ ...value, ...patch }); setError(""); }} onItemChange={(itemId, patch) => { patchItem(itemId, patch); setError(""); }} onUploadMtcCertificate={(itemId, file) => { void uploadMtcCertificate(itemId, file); }} onRemoveMtcCertificate={(itemId, attachmentId) => { void removeMtcCertificate(itemId, attachmentId); }} uploadingMtcItemId={uploadingMtcItemId} onBack={() => navigate("/grn-inward")} onPost={() => { void post(); }} />
    </div>
  </div>;
}
