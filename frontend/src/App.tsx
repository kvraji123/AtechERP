import { lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import AppLayout from "./layout/AppLayout";

// Load functional areas when their route is opened, rather than in the first page load.
const DashboardPage = lazy(() => import("./pages/modules/dashboard/DashboardPage"));
const SupplierPage = lazy(() => import("./pages/masters/SupplierPage"));
const SupplierFormPage = lazy(() => import("./pages/masters/SupplierFormPage"));
const CustomerPage = lazy(() => import("./pages/masters/CustomerPage"));
const CustomerFormPage = lazy(() => import("./pages/masters/CustomerFormPage"));
const PartPage = lazy(() => import("./pages/masters/PartPage"));
const PartFormPage = lazy(() => import("./pages/masters/PartFormPage"));
const ItemPage = lazy(() => import("./pages/masters/ItemPage"));
const ItemFormPage = lazy(() => import("./pages/masters/ItemFormPage"));
const MachinePage = lazy(() => import("./pages/masters/MachinePage"));
const MachineFormPage = lazy(() => import("./pages/masters/MachineFormPage"));
const GaugeMasterPage = lazy(() => import("./pages/masters/GaugeMasterPage"));
const GaugeCalibrationWorkflowPage = lazy(() => import("./pages/masters/GaugeCalibrationWorkflowPage"));
const GaugeRegistrationPage = lazy(() => import("./pages/masters/GaugeRegistrationPage"));
const GaugeDetailPage = lazy(() => import("./pages/masters/GaugeDetailPage"));
const TechnicalMasterPage = lazy(() => import("./pages/masters/TechnicalMasterPage"));
const LocationMasterPage = lazy(() => import("./pages/masters/LocationMasterPage"));
const MarketingListPage = lazy(() => import("./pages/modules/marketing/MarketingListPage"));
const EnquiryFormPage = lazy(() => import("./pages/modules/marketing/EnquiryFormPage"));
const FeasibilityPage = lazy(() => import("./pages/modules/marketing/FeasibilityPage"));
const WorkoutPage = lazy(() => import("./pages/modules/marketing/WorkoutPage"));
const QuotationPage = lazy(() => import("./pages/modules/marketing/QuotationPage"));
const CreatePurchaseRequestPage = lazy(() => import("./pages/modules/purchase/CreatePurchaseRequestPage"));
const PurchaseRequestListPage = lazy(() => import("./pages/modules/purchase/PurchaseRequestListPage"));
const CreatePurchaseEnquiryPage = lazy(() => import("./pages/modules/purchase/CreatePurchaseEnquiryPage"));
const CreateRfqQueuePage = lazy(() => import("./pages/modules/purchase/CreateRfqQueuePage"));
const PurchaseApprovalQueuePage = lazy(() => import("./pages/modules/purchase/PurchaseApprovalQueuePage"));
const PurchaseApprovalPage = lazy(() => import("./pages/modules/purchase/PurchaseApprovalPage"));
const QuotationComparisonPage = lazy(() => import("./pages/modules/purchase/QuotationComparisonPage"));
const CreatePurchaseOrderPage = lazy(() => import("./pages/modules/purchase/CreatePurchaseOrderPage"));
const PurchaseOrderListPage = lazy(() => import("./pages/modules/purchase/PurchaseOrderListPage"));
const PurchaseOrderApprovalPage = lazy(() => import("./pages/modules/purchase/PurchaseOrderApprovalPage"));
const PurchaseOrderApprovalQueuePage = lazy(() => import("./pages/modules/purchase/PurchaseOrderApprovalQueuePage"));
const RfqTrackingPage = lazy(() => import("./pages/modules/purchase/RfqTrackingPage"));
const RfqEmailOutboxPage = lazy(() => import("./pages/modules/purchase/RfqEmailOutboxPage"));
const GateEntryListPage = lazy(() => import("./pages/modules/purchase/GateEntryListPage"));
const CreateGateEntryPage = lazy(() => import("./pages/modules/purchase/CreateGateEntryPage"));
const SupplierAssignmentPage = lazy(() => import("./pages/modules/purchase/SupplierAssignmentPage"));
const GrnListPage = lazy(() => import("./pages/modules/purchase/GrnListPage"));
const CreateGrnInwardPage = lazy(() => import("./pages/modules/purchase/CreateGrnInwardPage"));
const GrnInspectionPage = lazy(() => import("./pages/modules/purchase/GrnInspectionPage"));
const GrnStockReceiptPage = lazy(() => import("./pages/modules/purchase/GrnStockReceiptPage"));
const InventoryPage = lazy(() => import("./pages/modules/inventory/InventoryPage"));
const InventoryControlPage = lazy(() => import("./pages/modules/inventory/InventoryControlPage"));
const CustomerMaterialControlPage = lazy(() => import("./pages/modules/inventory/CustomerMaterialControlPage"));
const OutsourcingWipPage = lazy(() => import("./pages/modules/inventory/OutsourcingWipPage"));
const MaterialOutwardPage = lazy(() => import("./pages/modules/inventory/MaterialOutwardPage"));
const GateExitPage = lazy(() => import("./pages/modules/inventory/GateExitPage"));
const ToolingLifecyclePage = lazy(() => import("./pages/modules/tooling/ToolingLifecyclePage"));
const InProcessInspectionPage = lazy(() => import("./pages/modules/operations/InProcessInspectionPage"));
const UserAccountsPage = lazy(() => import("./pages/admin/UserAccountsPage"));

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route
          index
          element={<Navigate to="/dashboard" replace />}
        />

        <Route path="/dashboard" element={<DashboardPage />} />

        <Route
          path="/masters/customers"
          element={<CustomerPage />}
        />

        <Route
          path="/masters/customers/new"
          element={<CustomerFormPage />}
        />

        <Route
          path="/masters/customers/:id"
          element={<CustomerFormPage />}
        />

        <Route
          path="/masters/suppliers"
          element={<SupplierPage />}
        />

        <Route
          path="/masters/suppliers/new"
          element={<SupplierFormPage />}
        />

        <Route
          path="/masters/suppliers/:id"
          element={<SupplierFormPage />}
        />

        <Route
          path="/masters/parts"
          element={<PartPage />}
        />

        <Route
          path="/masters/parts/new"
          element={<PartFormPage />}
        />

        <Route
          path="/masters/parts/:id"
          element={<PartFormPage />}
        />

        <Route
          path="/masters/items"
          element={<ItemPage />}
        />

        <Route
          path="/masters/items/new"
          element={<ItemFormPage />}
        />

        <Route
          path="/masters/items/:id"
          element={<ItemFormPage />}
        />

        <Route path="/masters/machines" element={<MachinePage />} />
        <Route path="/masters/machines/new" element={<MachineFormPage />} />
        <Route path="/masters/machines/:id" element={<MachineFormPage />} />
        <Route path="/masters/gauges" element={<GaugeMasterPage />} />
        <Route path="/masters/gauges/workflow" element={<GaugeCalibrationWorkflowPage />} />
        <Route path="/masters/gauges/register" element={<GaugeRegistrationPage />} />
        <Route path="/masters/gauges/:gaugeMasterId" element={<GaugeDetailPage />} />
        <Route path="/masters/locations" element={<LocationMasterPage />} />
        <Route path="/masters/operations" element={<TechnicalMasterPage kind="operations" />} />
        <Route path="/masters/instruments" element={<TechnicalMasterPage kind="instruments" />} />
        <Route path="/masters/departments" element={<TechnicalMasterPage kind="departments" />} />
        <Route path="/masters/tolerance-grades" element={<TechnicalMasterPage kind="tolerance-grades" />} />
        <Route path="/masters/inspection-characteristics" element={<TechnicalMasterPage kind="inspection-characteristics" />} />
        <Route path="/masters/inspection-frequencies" element={<TechnicalMasterPage kind="inspection-frequencies" />} />
        <Route path="/masters/rejection-reasons" element={<TechnicalMasterPage kind="rejection-reasons" />} />
        <Route path="/masters/rejection-dispositions" element={<TechnicalMasterPage kind="rejection-dispositions" />} />

        <Route
          path="/marketing/enquiries"
          element={<MarketingListPage />}
        />

        <Route
          path="/marketing/enquiries/new"
          element={<EnquiryFormPage />}
        />

        <Route
          path="/marketing/enquiries/:id"
          element={<EnquiryFormPage />}
        />

        <Route
          path="/marketing/enquiry-parts/:partId/feasibility"
          element={<FeasibilityPage />}
        />

        <Route
          path="/marketing/enquiry-parts/:partId/workout"
          element={<WorkoutPage />}
        />

        <Route
          path="/marketing/enquiries/:id/quotation"
          element={<QuotationPage />}
        />

        <Route
          path="/purchase"
          element={<Navigate to="/purchase/requests" replace />}
        />

        <Route
          path="/purchase/requests"
          element={<PurchaseRequestListPage />}
        />

        <Route
          path="/purchase/requests/new"
          element={<CreatePurchaseRequestPage />}
        />

        <Route
          path="/purchase/enquiries/new"
          element={<CreateRfqQueuePage />}
        />

        <Route
          path="/purchase/enquiries/new/create"
          element={<CreatePurchaseEnquiryPage />}
        />

        <Route
          path="/purchase/enquiries/supplier-assignment"
          element={<SupplierAssignmentPage />}
        />

        <Route
          path="/purchase/approvals"
          element={<PurchaseApprovalQueuePage />}
        />

        <Route
          path="/purchase/approvals/:requestId"
          element={<PurchaseApprovalPage />}
        />

        <Route
          path="/purchase/rfqs"
          element={<RfqTrackingPage />}
        />

        <Route
          path="/purchase/rfqs/email-outbox"
          element={<RfqEmailOutboxPage />}
        />

        <Route
          path="/purchase/quotation-comparison"
          element={<QuotationComparisonPage />}
        />

        <Route
          path="/purchase/orders"
          element={<PurchaseOrderListPage />}
        />

        <Route
          path="/purchase/orders/new"
          element={<CreatePurchaseOrderPage />}
        />

        <Route
          path="/purchase/orders/approval"
          element={<PurchaseOrderApprovalQueuePage />}
        />

        <Route
          path="/purchase/orders/approval/:poId"
          element={<PurchaseOrderApprovalPage />}
        />

        <Route
          path="/purchase/gate-entries"
          element={<GateEntryListPage />}
        />

        <Route
          path="/purchase/gate-entries/new"
          element={<CreateGateEntryPage />}
        />

        <Route path="/purchase/grn" element={<GrnListPage />} />
        <Route path="/purchase/grn/new" element={<CreateGrnInwardPage />} />
        <Route path="/purchase/grn/:grnId/inward" element={<CreateGrnInwardPage />} />
        <Route path="/purchase/grn/:grnId/inspection" element={<GrnInspectionPage />} />
        <Route path="/purchase/grn/:grnId/stock-receipt" element={<GrnStockReceiptPage />} />

        <Route path="/gate-entry" element={<GateEntryListPage />} />
        <Route path="/gate-entry/new" element={<CreateGateEntryPage />} />
        <Route path="/grn-inward" element={<GrnListPage />} />
        <Route path="/grn-inward/new" element={<CreateGrnInwardPage />} />
        <Route path="/grn-inward/:grnId/inward" element={<CreateGrnInwardPage />} />
        <Route path="/grn-inward/:grnId/inspection" element={<GrnInspectionPage />} />
        <Route path="/grn-inward/:grnId/stock-receipt" element={<GrnStockReceiptPage />} />
        <Route path="/material-outward" element={<MaterialOutwardPage />} />
        <Route path="/gate-exit" element={<GateExitPage />} />

        <Route path="/inventory" element={<InventoryPage />} />
        <Route path="/inventory/stock" element={<InventoryPage />} />
        <Route path="/inventory/transactions" element={<InventoryPage />} />
        <Route path="/inventory/quality-hold" element={<InventoryPage />} />
        <Route path="/inventory/rejection-inventory" element={<InventoryPage />} />
        <Route path="/inventory/reorder-alerts" element={<InventoryPage />} />
        <Route path="/inventory/customer-material" element={<CustomerMaterialControlPage />} />
        <Route path="/inventory/return-to-customer" element={<CustomerMaterialControlPage />} />
        <Route path="/inventory/outsourcing-wip" element={<OutsourcingWipPage />} />
        <Route path="/inventory/control" element={<InventoryControlPage />} />

        <Route path="/tooling" element={<ToolingLifecyclePage />} />
        <Route path="/masters/tools" element={<ToolingLifecyclePage />} />
        <Route path="/operations/work-order-inspection" element={<InProcessInspectionPage />} />
        <Route path="/operations/work-order-inspection/create" element={<InProcessInspectionPage />} />
        <Route path="/operations/work-order-inspection/inspect" element={<InProcessInspectionPage />} />
        <Route path="/operations/in-process-inspection" element={<Navigate to="/operations/work-order-inspection" replace />} />
        <Route path="/tooling/items/*" element={<Navigate to="/masters/items" replace />} />
        <Route path="/admin/users" element={<UserAccountsPage />} />
      </Route>
    </Routes>
  );
}
