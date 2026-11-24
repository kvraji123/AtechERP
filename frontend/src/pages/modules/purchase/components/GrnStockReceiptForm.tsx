import { ArrowLeft, ExternalLink, PackageCheck, Paperclip, Trash2, Upload } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { attachmentFileUrl } from "../../../../api/attachment.api";
import { apiMessage } from "../../../../api/client";
import { listAllActiveLocationMasters, type LocationMasterRow } from "../../../../api/locationMaster.api";
import DateInput from "../../../../components/DateInput";
import InventoryBinInput from "../../../../components/InventoryBinInput";
import type { GrnItem, GrnRecord } from "../grnData";

type Props = {
  value: GrnRecord;
  error: string;
  readOnly?: boolean;
  uploadingMtcItemId: number | null;
  onChange: (patch: Partial<GrnRecord>) => void;
  onItemChange: (itemId: number, patch: Partial<GrnItem>) => void;
  onUploadMtcCertificate: (itemId: number, file: File) => void;
  onRemoveMtcCertificate: (itemId: number, attachmentId: number) => void;
  onBack: () => void;
  onPost: () => void;
};

const CUSTOMER_MATERIAL_WAREHOUSE = "Customer Material Stores";
const TOOLING_WAREHOUSE = "Tool Crib";
const TOOLING_BIN = "Tooling";

export default function GrnStockReceiptForm({ value, error, readOnly, uploadingMtcItemId, onChange, onItemChange, onUploadMtcCertificate, onRemoveMtcCertificate, onBack, onPost }: Props) {
  const acceptedItems = value.items.filter((item) => item.acceptedQuantity > 0);
  const missingMtcItems = acceptedItems.filter((item) => item.mtcApplicable && !(item.mtcCertificates || []).length);
  const [locations, setLocations] = useState<LocationMasterRow[]>([]);
  const [locationError, setLocationError] = useState("");
  const [locationsLoading, setLocationsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void listAllActiveLocationMasters()
      .then((rows) => active && setLocations(rows))
      .catch((reason) => active && setLocationError(apiMessage(reason)))
      .finally(() => active && setLocationsLoading(false));
    return () => { active = false; };
  }, []);

  const warehouses = useMemo(() => [...new Set(locations.map((location) => location.warehouseName))], [locations]);

  useEffect(() => {
    if (readOnly || value.receiptType !== "CUSTOMER_SUPPLIED" || !warehouses.includes(CUSTOMER_MATERIAL_WAREHOUSE)) return;
    acceptedItems.forEach((item) => {
      if (!item.warehouse || item.warehouse === "Main Stores" || !item.subinventoryCode) onItemChange(item.id, { warehouse: CUSTOMER_MATERIAL_WAREHOUSE, subinventoryCode: "RM", binLocation: "" });
    });
  }, [acceptedItems, onItemChange, readOnly, value.receiptType, warehouses]);

  useEffect(() => {
    if (readOnly || !warehouses.includes(TOOLING_WAREHOUSE)) return;
    acceptedItems.filter((item) => item.itemGroupCode === "TL").forEach((item) => {
      if (item.warehouse !== TOOLING_WAREHOUSE || item.subinventoryCode !== "TOOLS" || item.binLocation !== TOOLING_BIN) onItemChange(item.id, { warehouse: TOOLING_WAREHOUSE, subinventoryCode: "TOOLS", binLocation: TOOLING_BIN });
    });
  }, [acceptedItems, onItemChange, readOnly, warehouses]);

  return <section className="purchase-grn-form-section">
    <header>
      <div className="purchase-grn-form-title"><span><PackageCheck size={18} /></span><div><h2>GRN Delivery to Stock</h2><p>Attach the MTC certificate for applicable RM items, then assign accepted material to a Location Master entry.</p></div></div>
      <div className="purchase-section-actions">
        <button type="button" className="purchase-secondary-button" onClick={onBack}><ArrowLeft size={15} /> Back</button>
        {!readOnly && <button type="button" className="purchase-primary-button" disabled={(value.receiptType === "OPEN_PURCHASE" && !value.purchaseApprovedBy) || locationsLoading || !locations.length || Boolean(missingMtcItems.length)} onClick={onPost}><PackageCheck size={15} /> Post to Inventory</button>}
      </div>
    </header>
    <div className="purchase-grn-reference-grid">
      <div><small>GRN Number</small><strong>{value.grnNumber}</strong></div>
      <div><small>{value.receiptType === "CUSTOMER_SUPPLIED" ? "Customer / Stock owner" : "Supplier"}</small><strong>{value.receiptType === "CUSTOMER_SUPPLIED" ? value.customerName : value.supplierName}</strong></div>
      <div><small>Accepted Items</small><strong>{acceptedItems.length}</strong></div>
      <div><small>Status</small><strong>{value.status === "STOCK_POSTED" ? "Stock Posted" : "Ready for Stock"}</strong></div>
    </div>
    <div className="purchase-grn-stock-fields">
      <label className="purchase-field"><span>Stock Posting Date <b>*</b></span><DateInput type="date" readOnly={readOnly} value={value.stockPostingDate} onChange={(event) => onChange({ stockPostingDate: event.target.value })} /></label>
      <label className="purchase-field"><span>Received By <b>*</b></span><input readOnly={readOnly} value={value.receivedBy} onChange={(event) => onChange({ receivedBy: event.target.value })} /></label>
    </div>
    <div className="purchase-grn-table-wrap"><table className="purchase-grn-stock-table"><thead><tr><th>Item</th><th>Accepted Quantity</th><th>Batch / Serial</th><th>MTC Certificate</th><th>Warehouse *</th><th>Sub-inventory *</th><th>Bin Location *</th></tr></thead><tbody>
      {acceptedItems.map((item) => {
        const knownWarehouse = warehouses.includes(item.warehouse);
        const isToolingItem = item.itemGroupCode === "TL";
        const subinventories = [...new Map(locations
          .filter((location) => location.warehouseName === item.warehouse)
          .map((location) => [location.subinventoryCode, location.subinventoryCode])).values()];
        const certificates = item.mtcCertificates || [];
        const isUploading = uploadingMtcItemId === item.id;
        return <tr key={item.id}>
          <td><strong>{item.itemName}</strong><small>{item.itemCode} · {item.specification}</small></td>
          <td>{item.acceptedQuantity} {item.uom}</td>
          <td>{item.batchSerialNumber || "—"}</td>
          <td className="purchase-grn-mtc-cell">
            {item.mtcApplicable ? <>
              <strong className={`purchase-grn-mtc-status ${certificates.length ? "attached" : "missing"}`}>{certificates.length ? `${certificates.length} certificate${certificates.length === 1 ? "" : "s"} attached` : "Required before stock posting"}</strong>
              {certificates.map((certificate) => <div className="purchase-grn-mtc-file" key={certificate.attachmentId}>
                <a href={attachmentFileUrl(certificate.fileUrl)} target="_blank" rel="noreferrer" title={certificate.fileName}><Paperclip size={13} /> <span>{certificate.fileName}</span><ExternalLink size={11} /></a>
                {!readOnly && <button type="button" aria-label={`Remove MTC certificate ${certificate.fileName}`} disabled={isUploading} onClick={() => onRemoveMtcCertificate(item.id, certificate.attachmentId)}><Trash2 size={13} /></button>}
              </div>)}
              {!readOnly && <label className="purchase-grn-mtc-upload"><input type="file" accept=".pdf,application/pdf" disabled={isUploading} onChange={(event) => { const file = event.target.files?.[0]; event.currentTarget.value = ""; if (file) onUploadMtcCertificate(item.id, file); }} /><Upload size={13} /> {isUploading ? "Uploading…" : "Attach MTC PDF"}</label>}
            </> : <span className="purchase-grn-mtc-na">Not applicable</span>}
          </td>
          <td><select aria-label="Warehouse" disabled={readOnly || isToolingItem || locationsLoading || !warehouses.length} value={item.warehouse} onChange={(event) => onItemChange(item.id, { warehouse: event.target.value, subinventoryCode: "", binLocation: "" })}>
            <option value="">{locationsLoading ? "Loading warehouses…" : "Select warehouse"}</option>
            {item.warehouse && !knownWarehouse && <option value={item.warehouse}>Existing warehouse: {item.warehouse}</option>}
            {warehouses.map((warehouseName) => <option key={warehouseName} value={warehouseName}>{warehouseName}</option>)}
          </select></td>
          <td><select aria-label="Sub-inventory" disabled={readOnly || isToolingItem || locationsLoading || !item.warehouse || !subinventories.length} value={item.subinventoryCode} onChange={(event) => onItemChange(item.id, { subinventoryCode: event.target.value, binLocation: "" })}>
            <option value="">{!item.warehouse ? "Select warehouse first" : "Select sub-inventory"}</option>
            {item.subinventoryCode && !subinventories.includes(item.subinventoryCode) && <option value={item.subinventoryCode}>Existing: {item.subinventoryCode}</option>}
            {subinventories.map((subinventoryCode) => <option key={subinventoryCode} value={subinventoryCode}>{subinventoryCode.replace(/_/g, " ")}</option>)}
          </select></td>
          <td><InventoryBinInput disabled={readOnly || isToolingItem || locationsLoading} warehouse={item.warehouse} subinventoryCode={item.subinventoryCode} locations={locations} value={item.binLocation} onChange={(binLocation) => onItemChange(item.id, { binLocation })} />{isToolingItem && <small className="purchase-grn-hint">Tool items are received to Tool Crib / TOOLS / Tooling.</small>}</td>
        </tr>;
      })}
    </tbody></table></div>
    {!acceptedItems.length && <div className="purchase-grn-empty">No accepted quantity is available for stock posting.</div>}
    {missingMtcItems.length > 0 && <p className="purchase-grn-error" role="alert">Attach the MTC certificate for {missingMtcItems.map((item) => item.itemCode || item.itemName).join(", ")} before posting to inventory.</p>}
    {locationsLoading && <p className="purchase-grn-hint">Loading approved Warehouse and Location Master values…</p>}
    {locationError && <p className="purchase-grn-error" role="alert">Location Master is unavailable: {locationError}</p>}
    {!locationsLoading && !locationError && !locations.length && <p className="purchase-grn-error" role="alert">Create an active Location Master record before posting stock.</p>}
    {error && <p className="purchase-grn-error" role="alert">{error}</p>}
  </section>;
}
