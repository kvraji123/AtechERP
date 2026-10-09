# Separate customer and supplier masters

For an existing installation, stop the application and run `npm run migrate:separate-masters` from the backend directory before starting the updated application. The migration targets the configured database. A timestamped customer-data and schema snapshot is written under `backend/backups` (excluded from Git); retain your normal full database backup as well.

The migration creates `supplier_master`, adds `customer_type`, copies legacy suppliers (including Both records) with their existing IDs and codes, and redirects supplier foreign keys and purchase views. Customer and supplier types start blank for migrated records and must be entered when editing them. Customer types are OEM and Others; supplier types are Manufacturer and Dealer.

Run `npm run migrate:master-commercial-fields` for existing installations to add Payment Terms and Transport Mode to both masters. Both fields are optional text values. The supplier form uses one Address, stored in the existing `delivery_address` column, with legacy billing address fallback when it is blank. Plant Code, Invoice Type, and Billing Address are removed from the supplier form; historical database values are preserved on updates.

Legacy supplier-only customer rows remain hidden and read-only through the customer API for historical compatibility. Both records remain available as customers and receive an independent supplier copy. No changes to either copy propagate to the other. Historical PO and quotation snapshots are preserved. New records use separate CUS and SUP sequences; configure sequence rows for each financial year as with the existing numbering system.

Clean installations use `master-schema.sql`, then `supplier-master-schema.sql`, before the item and purchase schemas. The production SQL generator includes this order. Regenerate deployment SQL with `npm run build:production-sql`; previously exported SQL bundles are not updated automatically.

Verification: `node tests/separate-masters.integration.js` and `npm run test:purchase-calculations`. The integration test creates and removes its own records; generated sequence numbers remain consumed.

Both frontend forms retain the existing master fields and attachment interface. This change does not add attachment persistence, which was not implemented in the original customer save payload.
