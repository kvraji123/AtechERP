import { ArrowLeft, ScanSearch } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiMessage } from "../../../api/client";
import { purchaseApi } from "../../../api/purchase.api";
import { technicalMasterApi } from "../../../api/technicalMaster.api";
import { useAppFeedback } from "../../../components/AppFeedback";
import GrnInspectionForm, { type RejectionDispositionOption, type RejectionReasonOption } from "./components/GrnInspectionForm";
import GrnWorkflowStepper from "./components/GrnWorkflowStepper";
import PurchaseModuleTabs from "./components/PurchaseModuleTabs";
import type { GrnInspectionCharacteristic, GrnItem, GrnRecord } from "./grnData";
import { mapGrn } from "./purchaseReceiptMappers";
import "./PurchaseFlow.css";

export default function GrnInspectionPage() {
  const navigate = useNavigate();
  const { grnId } = useParams();
  const { showSuccess } = useAppFeedback();
  const [value,setValue] = useState<GrnRecord | null>(null);
  const [rejectionReasons,setRejectionReasons] = useState<RejectionReasonOption[]>([]);
  const [rejectionDispositions,setRejectionDispositions] = useState<RejectionDispositionOption[]>([]);
  const [error,setError] = useState("");
  const [uploadingAttachmentItemId,setUploadingAttachmentItemId] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    void Promise.all([
      purchaseApi.getGrn(grnId || ""),
      technicalMasterApi.list("rejection-reasons",{status:"Y"}),
      technicalMasterApi.list("rejection-dispositions",{status:"Y"}),
    ]).then(([grnResponse,reasonsResponse,dispositionsResponse]) => {
      if (!active) return;
      setValue(mapGrn(grnResponse.data));
      setRejectionReasons(reasonsResponse?.data || []);
      setRejectionDispositions(dispositionsResponse?.data || []);
    }).catch((reason) => active && setError(apiMessage(reason)));
    return () => { active = false; };
  },[grnId]);

  const patchItem = (itemId:number,patch:Partial<GrnItem>) => setValue((current) => current ? { ...current,items:current.items.map((item) => item.id === itemId ? {...item,...patch} : item) } : current);
  const patchCharacteristic = (itemId:number,characteristicId:number,patch:Partial<GrnInspectionCharacteristic>) => setValue((current) => current ? { ...current,items:current.items.map((item) => {
    if (item.id !== itemId) return item;
    const inspectionCharacteristics = (item.inspectionCharacteristics || []).map((row) => row.id === characteristicId ? {...row,...patch} : row);
    const hasFailure = inspectionCharacteristics.some((row) => row.inspectionResult === "FAIL");
    const complete = inspectionCharacteristics.length > 0 && inspectionCharacteristics.every((row) => row.inspectionResult !== "PENDING");
    return hasFailure ? { ...item,inspectionCharacteristics,inspectionResult:"ON_HOLD",inspectionDisposition:item.inspectionDisposition === "PENDING" || !item.inspectionDisposition ? "HOLD" : item.inspectionDisposition,acceptedQuantity:0,rejectedQuantity:0,onHoldQuantity:item.currentReceivedQuantity } : complete ? { ...item,inspectionCharacteristics,inspectionResult:"ACCEPTED",acceptedQuantity:item.currentReceivedQuantity,rejectedQuantity:0,onHoldQuantity:0 } : {...item,inspectionCharacteristics};
  }) } : current);

  const uploadAttachment = async (itemId:number,file:File) => {
    if (!value) return;
    try {
      setUploadingAttachmentItemId(itemId); setError("");
      const response = await purchaseApi.uploadGrnRejectionAttachment(value.id,itemId,file);
      const attachment = response.data;
      setValue((current) => current ? { ...current,items:current.items.map((item) => item.id === itemId ? { ...item,rejectionAttachments:[...(item.rejectionAttachments || []),attachment] } : item) } : current);
      showSuccess("Rejection evidence uploaded.");
    } catch (reason) { setError(apiMessage(reason)); }
    finally { setUploadingAttachmentItemId(null); }
  };

  const removeAttachment = async (itemId:number,attachmentId:number) => {
    if (!value) return;
    try {
      setError("");
      await purchaseApi.deleteGrnRejectionAttachment(value.id,itemId,attachmentId);
      setValue((current) => current ? { ...current,items:current.items.map((item) => item.id === itemId ? { ...item,rejectionAttachments:(item.rejectionAttachments || []).filter((attachment) => attachment.rejectionAttachmentId !== attachmentId) } : item) } : current);
      showSuccess("Rejection evidence removed.");
    } catch (reason) { setError(apiMessage(reason)); }
  };

  const complete = async () => {
    if (!value) return;
    const invalid = value.items.find((item) => {
      const characteristics = item.inspectionCharacteristics || [];
      const reason = rejectionReasons.find((entry) => entry.rejectionReasonId === item.rejectionReasonId);
      return (characteristics.length > 0 && characteristics.some((row) => row.inspectionResult === "PENDING")) || item.acceptedQuantity + item.rejectedQuantity + item.onHoldQuantity !== item.currentReceivedQuantity || (item.rejectedQuantity > 0 && (!item.rejectionReasonId || !item.rejectionDispositionId || (reason?.requireAttachment === "Y" && !(item.rejectionAttachments || []).length)));
    });
    if (invalid) { setError(`Complete the inspection results, quantity allocation, rejection reason and follow-up action for ${invalid.itemName}.`); return; }
    try {
      const response = await purchaseApi.inspectGrn(value.id,{ items:value.items.map((item) => ({
        grnItemId:item.id,acceptedQuantity:item.acceptedQuantity,rejectedQuantity:item.rejectedQuantity,onHoldQuantity:item.onHoldQuantity,
        inspectionDisposition:item.inspectionDisposition || "PENDING",rejectionReasonId:item.rejectionReasonId,
        rejectionDispositionId:item.rejectionDispositionId,rejectionReason:item.rejectionReason,
        qualityRemarks:item.qualityRemarks,
        inspectionCharacteristics:(item.inspectionCharacteristics || []).map((row) => ({ grnInspectionCharacteristicId:row.id,actualValue:row.actualValue,inspectionResult:row.inspectionResult,remarks:row.remarks })),
      })) });
      const saved = mapGrn(response.data);
      if (saved.status === "INSPECTION_HOLD") { showSuccess("Failed sample recorded. This lot is on Quality hold and cannot be posted to stock."); setValue(saved); return; }
      showSuccess(saved.status === "REJECTED" ? "Inspection completed with all material rejected." : "Inspection completed. Accepted quantity is ready for stock.");
      navigate(saved.status === "REJECTED" ? "/purchase/grn" : `/purchase/grn/${saved.id}/stock-receipt`,{replace:true});
    } catch (reason) { setError(apiMessage(reason)); }
  };

  if (!value) return <div className="purchase-page"><div className="purchase-grn-empty">{error || "Loading GRN…"}</div></div>;
  const readOnly = value.status === "REJECTED" || value.status === "STOCK_POSTED";
  return <div className="purchase-page"><header className="purchase-page-header"><div className="purchase-title-group"><button type="button" className="purchase-back-button" onClick={() => navigate("/purchase/grn")}><ArrowLeft size={19}/></button><span className="purchase-page-module-icon"><ScanSearch size={19}/></span><div><p>Purchase / GRN</p><h1>Material Inspection</h1><span>Record quality disposition for received material</span></div></div></header><PurchaseModuleTabs/><div className="purchase-grn-page"><GrnWorkflowStepper stage="INSPECTION"/><GrnInspectionForm value={value} error={error} readOnly={readOnly} rejectionReasons={rejectionReasons} rejectionDispositions={rejectionDispositions} onItemChange={(itemId,patch) => { patchItem(itemId,patch); setError(""); }} onCharacteristicChange={(itemId,characteristicId,patch) => { patchCharacteristic(itemId,characteristicId,patch); setError(""); }} onUploadAttachment={(itemId,file) => { void uploadAttachment(itemId,file); }} onRemoveAttachment={(itemId,attachmentId) => { void removeAttachment(itemId,attachmentId); }} uploadingAttachmentItemId={uploadingAttachmentItemId} onBack={() => navigate("/purchase/grn")} onComplete={() => { void complete(); }}/></div></div>;
}
