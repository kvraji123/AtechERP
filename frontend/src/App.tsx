import { Navigate, Route, Routes } from "react-router-dom";

import AppLayout from "./layout/AppLayout";
import DashboardPage from "./pages/modules/dashboard/DashboardPage";

import SupplierPage from "./pages/masters/SupplierPage";
import SupplierFormPage from "./pages/masters/SupplierFormPage";
import CustomerPage from "./pages/masters/CustomerPage";
import CustomerFormPage from "./pages/masters/CustomerFormPage";
import PartPage from "./pages/masters/PartPage";
import PartFormPage from "./pages/masters/PartFormPage";
import ItemPage from "./pages/masters/ItemPage";
import ItemFormPage from "./pages/masters/ItemFormPage";
import MachinePage from "./pages/masters/MachinePage";
import MachineFormPage from "./pages/masters/MachineFormPage";
import GaugeMasterPage from "./pages/masters/GaugeMasterPage";
import GaugeCalibrationWorkflowPage from "./pages/masters/GaugeCalibrationWorkflowPage";
import GaugeRegistrationPage from "./pages/masters/GaugeRegistrationPage";
import GaugeDetailPage from "./pages/masters/GaugeDetailPage";
import TechnicalMasterPage from "./pages/masters/TechnicalMasterPage";

import MarketingListPage from "./pages/modules/marketing/MarketingListPage";
import EnquiryFormPage from "./pages/modules/marketing/EnquiryFormPage";
import FeasibilityPage from "./pages/modules/marketing/FeasibilityPage";
import WorkoutPage from "./pages/modules/marketing/WorkoutPage";
import QuotationPage from "./pages/modules/marketing/QuotationPage";
import CreatePurchaseRequestPage from "./pages/modules/purchase/CreatePurchaseRequestPage";
import PurchaseRequestListPage from "./pages/modules/purchase/PurchaseRequestListPage";
import CreatePurchaseEnquiryPage from "./pages/modules/purchase/CreatePurchaseEnquiryPage";
import CreateRfqQueuePage from "./pages/modules/purchase/CreateRfqQueuePage";
import PurchaseApprovalQueuePage from "./pages/modules/purchase/PurchaseApprovalQueuePage";
import PurchaseApprovalPage from "./pages/modules/purchase/PurchaseApprovalPage";
import QuotationComparisonPage from "./pages/modules/purchase/QuotationComparisonPage";
import CreatePurchaseOrderPage from "./pages/modules/purchase/CreatePurchaseOrderPage";
import PurchaseOrderListPage from "./pages/modules/purchase/PurchaseOrderListPage";
import PurchaseOrderApprovalPage from "./pages/modules/purchase/PurchaseOrderApprovalPage";
import PurchaseOrderApprovalQueuePage from "./pages/modules/purchase/PurchaseOrderApprovalQueuePage";
import PurchaseCommandCenterPage from "./pages/modules/purchase/PurchaseCommandCenterPage";
import RfqTrackingPage from "./pages/modules/purchase/RfqTrackingPage";
import RfqEmailOutboxPage from "./pages/modules/purchase/RfqEmailOutboxPage";
import GateEntryListPage from "./pages/modules/purchase/GateEntryListPage";
import CreateGateEntryPage from "./pages/modules/purchase/CreateGateEntryPage";
import SupplierAssignmentPage from "./pages/modules/purchase/SupplierAssignmentPage";
import GrnListPage from "./pages/modules/purchase/GrnListPage";
import CreateGrnInwardPage from "./pages/modules/purchase/CreateGrnInwardPage";
import GrnInspectionPage from "./pages/modules/purchase/GrnInspectionPage";
import GrnStockReceiptPage from "./pages/modules/purchase/GrnStockReceiptPage";
import InventoryPage from "./pages/modules/inventory/InventoryPage";
import CustomerMaterialControlPage from "./pages/modules/inventory/CustomerMaterialControlPage";
import OutsourcingWipPage from "./pages/modules/inventory/OutsourcingWipPage";

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
        <Route path="/masters/operations" element={<TechnicalMasterPage kind="operations" />} />
        <Route path="/masters/instruments" element={<TechnicalMasterPage kind="instruments" />} />
        <Route path="/masters/tolerance-grades" element={<TechnicalMasterPage kind="tolerance-grades" />} />
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
          element={<PurchaseCommandCenterPage />}
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

        <Route path="/inventory" element={<InventoryPage />} />
        <Route path="/inventory/stock" element={<InventoryPage />} />
        <Route path="/inventory/transactions" element={<InventoryPage />} />
        <Route path="/inventory/quality-hold" element={<InventoryPage />} />
        <Route path="/inventory/rejection-inventory" element={<InventoryPage />} />
        <Route path="/inventory/reorder-alerts" element={<InventoryPage />} />
        <Route path="/inventory/customer-material" element={<CustomerMaterialControlPage />} />
        <Route path="/inventory/return-to-customer" element={<CustomerMaterialControlPage />} />
        <Route path="/inventory/outsourcing-wip" element={<OutsourcingWipPage />} />
      </Route>
    </Routes>
  );
}
