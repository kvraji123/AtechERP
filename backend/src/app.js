import { validateDates } from "./middleware/validateDates.js";
import path from "path";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";

import { env } from "./config/env.js";
import { requestContext } from "./middleware/requestContext.js";
import { notFound } from "./middleware/notFound.js";
import { errorHandler } from "./middleware/errorHandler.js";

import supplierRoutes from "./modules/supplier/supplier.routes.js";
import customerRoutes from "./modules/customer/customer.routes.js";
import partRoutes from "./modules/part/part.routes.js";
import enquiryRoutes from "./modules/enquiry/enquiry.routes.js";
import feasibilityRoutes from "./modules/feasibility/feasibility.routes.js";
import workoutRoutes from "./modules/workout/workout.routes.js";
import quotationRoutes from "./modules/quotation/quotation.routes.js";
import locationRoutes from "./modules/location/location.routes.js";
import itemRoutes from "./modules/item/item.routes.js";
import referenceRoutes from "./modules/reference/reference.routes.js";
import machineRoutes from "./modules/machine/machine.routes.js";
import gaugeRoutes from "./modules/gauge/gauge.routes.js";
import technicalMasterRoutes from "./modules/technicalMaster/technicalMaster.routes.js";
import purchaseRequisitionRoutes from "./modules/purchase-requisition/purchase-requisition.routes.js";
import purchaseApprovalRoutes from "./modules/approval/approval.routes.js";
import supplierAssignmentRoutes from "./modules/supplier-assignment/supplier-assignment.routes.js";
import purchaseOrderRoutes from "./modules/purchase-order/purchase-order.routes.js";
import purchaseOrderApprovalRoutes from "./modules/purchase-order/purchase-order-approval.routes.js";
import rfqRoutes from "./modules/rfq/rfq.routes.js";
import supplierQuotationRoutes from "./modules/supplier-quotation/supplier-quotation.routes.js";
import quoteComparisonRoutes from "./modules/quotation-comparison/quotation-comparison.routes.js";
import grnRoutes from "./modules/grn/grn.routes.js";
import inventoryRoutes from "./modules/inventory/inventory.routes.js";
import gateEntryRoutes from "./modules/gate-entry/gate-entry.routes.js";
import attachmentRoutes from "./modules/attachment/attachment.routes.js";

const app = express();

app.disable("x-powered-by");

function isPrivateIpv4(hostname) {
  const octets = hostname.split(".").map(Number);
  if (
    octets.length !== 4 ||
    octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)
  ) {
    return false;
  }

  return (
    octets[0] === 10 ||
    (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
    (octets[0] === 192 && octets[1] === 168)
  );
}

function isLocalDevelopmentOrigin(origin) {
  if (env.nodeEnv === "production") return false;

  try {
    const url = new URL(origin);
    const isHttp = url.protocol === "http:" || url.protocol === "https:";
    const isLocalHost = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
    return isHttp && (isLocalHost || isPrivateIpv4(url.hostname));
  } catch {
    return false;
  }
}

app.use(
  helmet({
    crossOriginResourcePolicy: {
      policy: "cross-origin",
    },
  })
);

app.use(
  cors({
    origin(origin, callback) {
      if (
        !origin ||
        env.corsOrigins.length === 0 ||
        env.corsOrigins.includes(origin) ||
        isLocalDevelopmentOrigin(origin)
      ) {
        return callback(null, true);
      }

      return callback(new Error("Origin is not allowed by CORS."));
    },
    credentials: true,
  })
);

app.use(morgan(env.nodeEnv === "production" ? "combined" : "dev"));
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(requestContext);
app.use(validateDates);

app.use(
  "/uploads",
  express.static(path.resolve(env.uploadRoot))
);

app.get("/health", (_req, res) => {
  res.json({
    success: true,
    message: "ATECH Marketing API is running.",
  });
});

app.use("/api/v1/customers", customerRoutes);
app.use("/api/v1/suppliers", supplierRoutes);
app.use("/api/v1/parts", partRoutes);
app.use("/api/v1/locations", locationRoutes);
app.use("/api/v1/items", itemRoutes);
app.use("/api/v1/machines", machineRoutes);
app.use("/api/v1/gauges", gaugeRoutes);
app.use("/api/v1/technical-masters", technicalMasterRoutes);
app.use("/api/v1/reference-data", referenceRoutes);
app.use("/api/v1/marketing/enquiries", enquiryRoutes);
app.use("/api/v1/marketing/enquiry-parts", feasibilityRoutes);
app.use("/api/v1/marketing/enquiry-parts", workoutRoutes);
app.use("/api/v1/marketing/enquiries", quotationRoutes);
app.use("/api/v1/purchase-requisitions", purchaseRequisitionRoutes);
app.use("/api/v1/purchase-approvals", purchaseApprovalRoutes);
app.use("/api/v1/purchase-supplier-assignments", supplierAssignmentRoutes);
app.use("/api/v1/purchase-orders", purchaseOrderRoutes);
app.use("/api/v1/purchase-order-approvals", purchaseOrderApprovalRoutes);
app.use("/api/v1/purchase-rfqs", rfqRoutes);
app.use("/api/v1/purchase-supplier-quotations", supplierQuotationRoutes);
app.use("/api/v1/purchase-quote-comparisons", quoteComparisonRoutes);
app.use("/api/v1/purchase-grns", grnRoutes);
app.use("/api/v1/inventory", inventoryRoutes);
app.use("/api/v1/purchase-gate-entries", gateEntryRoutes);
app.use("/api/v1/attachments", attachmentRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
