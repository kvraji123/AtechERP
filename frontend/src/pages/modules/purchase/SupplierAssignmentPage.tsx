import { useUnsavedChanges } from "../../../components/UnsavedChanges";
import { ArrowLeft, ArrowRight, Save, UsersRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { apiMessage } from "../../../api/client";
import { supplierApi } from "../../../api/supplier.api";
import { purchaseApi, type SupplierAssignmentEligibleItem } from "../../../api/purchase.api";
import { useAppFeedback } from "../../../components/AppFeedback";
import PurchaseModuleTabs from "./components/PurchaseModuleTabs";
import SupplierFirstAssignment from "./components/SupplierFirstAssignment";
import { mapApiRfqPurchaseRequest, type ApiPurchaseRequisitionRow, type RfqPurchaseRequest } from "./purchaseRfqRequests";
import { saveSupplierAssignmentLines } from "./supplierAssignmentStore";
import type { PurchaseEnquiryLine, SupplierOption } from "./types";
import "./PurchaseFlow.css";

type SupplierRow = {
  supplierId: number;
  supplierCode: string;
  supplierName: string;
  partyType: string;
};

const mapEligibleLine = (item: SupplierAssignmentEligibleItem): PurchaseEnquiryLine => ({
  id: Number(item.purchaseRequestItemId),
  prNumber: item.prNumber,
  itemCode: item.itemCode || `ITEM-${item.itemId}`,
  itemName: item.itemDescription,
  itemDescription: item.itemSpecification || "",
  quantity: Number(item.approvedQuantity || 0),
  uom: item.uomCode || "—",
  requisitionType: "New Item",
  enquiryRequired: true,
  selected: true,
  selectedSupplierIds: String(item.assignedSupplierIds || "").split(",").map((id) => id.trim()).filter(Boolean),
  enquiryStatus: "Ready",
  quotes: [],
});

export default function SupplierAssignmentPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { showSuccess } = useAppFeedback();
  const prNumbers = searchParams.getAll("pr");
  const prKey = prNumbers.join("|");
  const [lines, setLines] = useState<PurchaseEnquiryLine[]>([]);
  const [requests, setRequests] = useState<RfqPurchaseRequest[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const unsaved = useUnsavedChanges(lines);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const [eligibleResponse, requestResponse, supplierResponse] = await Promise.all([
          purchaseApi.listSupplierAssignmentEligibleItems(),
          purchaseApi.listRequisitions({ page: 1, pageSize: 100 }),
          supplierApi.list({ page: 1, pageSize: 100, activeFlag: "Y" }),
        ]);
        if (!active) return;
        const eligible = Array.isArray(eligibleResponse?.data) ? eligibleResponse.data as SupplierAssignmentEligibleItem[] : [];
        const requestRows = Array.isArray(requestResponse?.data) ? requestResponse.data as ApiPurchaseRequisitionRow[] : [];
        const supplierRows = Array.isArray(supplierResponse?.data) ? supplierResponse.data as SupplierRow[] : [];
        const prFilter = new Set(prNumbers);
        const pageItems = eligible.filter((item) => !prFilter.size || prFilter.has(item.prNumber));
        setLines(pageItems.map(mapEligibleLine));
        setRequests(requestRows.filter((row) => !prFilter.size || prFilter.has(row.prNumber)).map(mapApiRfqPurchaseRequest));
        setSuppliers(supplierRows
          
          .map((supplier) => ({ id: String(supplier.supplierId), code: supplier.supplierCode, name: supplier.supplierName, rating: 0, leadTime: "Lead time not specified" })));
      } catch (loadError) {
        if (active) {
          setLines([]);
          setRequests([]);
          setSuppliers([]);
          setError(apiMessage(loadError));
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [prKey]);

  const getAssignments = (assignmentLines: PurchaseEnquiryLine[]) => assignmentLines.flatMap((line) => line.selectedSupplierIds.map((supplierId) => ({
    purchaseRequestItemId: line.id,
    supplierId: Number(supplierId),
    assignedQuantity: line.quantity,
  })));
  const assignments = useMemo(() => getAssignments(lines), [lines]);

  const save = async (continueAfterSave = false, assignmentLines = lines) => {
    const savedSnapshot = unsaved.snapshot();

    const assignmentsToSave = getAssignments(assignmentLines);
    if (!assignmentsToSave.length) { setError("Select at least one supplier and item before saving the assignment."); return false; }
    setSaving(true);
    setError("");
    try {
      await purchaseApi.saveSupplierAssignments({ assignments: assignmentsToSave });
      saveSupplierAssignmentLines(assignmentLines);
      unsaved.markSaved(savedSnapshot); showSuccess("Supplier assignments saved to the backend.");
      if (continueAfterSave) {
        const params = new URLSearchParams();
        prNumbers.forEach((pr) => params.append("pr", pr));
        navigate(`/purchase/enquiries/new/create?${params.toString()}`);
      }
      return true;
    } catch (saveError) {
      setError(apiMessage(saveError));
      return false;
    } finally {
      setSaving(false);
    }
  };

  return <div className="purchase-page purchase-supplier-assignment-workspace"><header className="purchase-page-header"><div className="purchase-title-group"><button type="button" className="purchase-back-button" aria-label="Back to approved PR list" onClick={() => navigate("/purchase/enquiries/new")}><ArrowLeft size={19} /></button><span className="purchase-page-module-icon"><UsersRound size={19} /></span><div><p>Purchase / Supplier Enquiry</p><h1>Supplier Assignment</h1><span>Assign approved PR line items to one or more suppliers before creating RFQs</span></div></div></header><PurchaseModuleTabs /><div className="purchase-supplier-assignment-page">{loading ? <section className="purchase-supplier-assignment-page-section"><div className="purchase-supplier-assignment-empty">Loading approved PR items and active suppliers…</div></section> : <SupplierFirstAssignment lines={lines} requests={requests} suppliers={suppliers} onChange={setLines} onAssign={(assignmentLines) => save(false, assignmentLines)} saving={saving} onOpenItemFirst={() => { void save(true); }} />}{error && <p className="purchase-order-list-error" role="alert">{error}</p>}<footer className="purchase-supplier-assignment-page-footer"><button type="button" className="purchase-secondary-button" onClick={() => navigate("/purchase/enquiries/new")}><ArrowLeft size={14} /> Back</button><div><button type="button" className="purchase-secondary-button" disabled={loading || saving} onClick={() => { void save(); }}><Save size={14} /> {saving ? "Saving…" : "Save Assignment"}</button><button type="button" className="purchase-primary-button" disabled={loading || saving || !assignments.length} onClick={() => { void save(true); }}>Continue to Create RFQ <ArrowRight size={14} /></button></div></footer></div></div>;
}
