# ATECH Marketing Backend

## Setup

```bash
copy .env.example .env
npm install
npm run migrate:app-user-auth
npm run dev
```

Before the first `npm run dev`, set the database settings and
`INITIAL_ADMIN_PASSWORD` in `.env`. For local development and production, use
`AUTH_MODE=accounts`. The first start after applying the account migration
creates the configured initial accounts.

Default URL:

```text
http://localhost:4100
```

Health check:

```text
GET /health
```

API base:

```text
/api/v1
```

## Application accounts

Apply the account migration before starting the backend:

```bash
npm run migrate:app-user-auth
```

For the first start only, set `INITIAL_ADMIN_USERNAME`,
`INITIAL_ADMIN_NAME`, and a unique `INITIAL_ADMIN_PASSWORD` of at least 12
characters in the server `.env`. You can also set the optional
`INITIAL_STANDARD_USERNAME`, `INITIAL_STANDARD_NAME`, and
`INITIAL_STANDARD_PASSWORD` values to create the first Standard User account.
The bootstrap values are used only when there are no application accounts, so
remove the passwords from the production environment after the first successful
start. Signed-in Administrators can create further accounts from **Users** in
the application header.

Passwords are hashed with Node's scrypt function. Authentication uses an
HTTP-only, same-site session cookie stored server-side. `GET /api/v1/auth/me`
returns the signed-in user; `POST /api/v1/auth/logout` closes their session.
Administrators can permanently delete only inactive Customer, Supplier, and
Enquiry records. Standard Users can work in Marketing but cannot permanently
delete records.

Set `CORS_ORIGINS` to the exact frontend URL in production, for example
`https://erp.example.com`, when browser and API are deployed separately.

## Tool List editor (ONLYOFFICE)

Tool Lists can be edited inside the Part Master through a self-hosted
ONLYOFFICE Document Server. The editor is optional: while it is not configured,
users can still download and upload the `.xlsx` file manually.

For a local Docker setup, set these values in `backend/.env` (use the same
long random value for both JWT secrets):

```text
ONLYOFFICE_DOCUMENT_SERVER_URL=http://localhost:8080
ONLYOFFICE_PUBLIC_API_URL=http://host.docker.internal:4100
ONLYOFFICE_JWT_SECRET=replace-with-a-long-random-secret
ONLYOFFICE_EDITOR_SESSION_MINUTES=480
```

When a Docker Document Server must call a backend running on this PC, ensure
the backend listens beyond loopback (`HOST=0.0.0.0`) and that the firewall
allows Docker Desktop to reach port `4100`. Then start the editor:

```bash
docker compose -f docker-compose.onlyoffice.yml up -d
```

For a shared or production deployment, use HTTPS URLs reachable by both the
user's browser and the Document Server. `ONLYOFFICE_PUBLIC_API_URL` is the
backend URL the Document Server uses to retrieve and save a Tool List; it is
not the frontend URL. Do not expose either service publicly without HTTPS and
network controls.

## Main routes

### Authentication

- POST `/api/v1/auth/login`
- POST `/api/v1/auth/logout`
- GET `/api/v1/auth/me`
- POST `/api/v1/auth/change-password`

### Customer

- GET `/api/v1/customers`
- GET `/api/v1/customers/:customerId`
- POST `/api/v1/customers`
- PUT `/api/v1/customers/:customerId`
- PATCH `/api/v1/customers/:customerId/status`
- DELETE `/api/v1/customers/:customerId` (administrator only; inactive records only)

### Supplier

- GET `/api/v1/suppliers`
- GET `/api/v1/suppliers/:supplierId`
- POST `/api/v1/suppliers`
- PUT `/api/v1/suppliers/:supplierId`
- PATCH `/api/v1/suppliers/:supplierId/status`
- DELETE `/api/v1/suppliers/:supplierId` (administrator only; inactive records only)

### Part

- GET `/api/v1/parts`
- GET `/api/v1/parts/:partId`
- POST `/api/v1/parts`
- PUT `/api/v1/parts/:partId`
- PATCH `/api/v1/parts/:partId/status`

### Enquiry

- GET `/api/v1/marketing/enquiries`
- GET `/api/v1/marketing/enquiries/:enquiryId`
- POST `/api/v1/marketing/enquiries`
- PUT `/api/v1/marketing/enquiries/:enquiryId`
- DELETE `/api/v1/marketing/enquiries/:enquiryId` (administrator soft delete)
- DELETE `/api/v1/marketing/enquiries/:enquiryId/hard` (administrator; inactive records only)
- POST `/api/v1/marketing/enquiries/:enquiryId/submit`
- GET `/api/v1/marketing/enquiries/:enquiryId/quotation-eligible-parts`

### Feasibility

- GET `/api/v1/marketing/enquiry-parts/:enquiryPartId/feasibility`
- PUT `/api/v1/marketing/enquiry-parts/:enquiryPartId/feasibility`
- POST `/api/v1/marketing/enquiry-parts/:enquiryPartId/feasibility/submit`

### Workout

- GET `/api/v1/marketing/enquiry-parts/:enquiryPartId/workout`
- PUT `/api/v1/marketing/enquiry-parts/:enquiryPartId/workout`
- POST `/api/v1/marketing/enquiry-parts/:enquiryPartId/workout/submit`

### Quotation

- GET `/api/v1/marketing/enquiries/:enquiryId/quotation`
- PUT `/api/v1/marketing/enquiries/:enquiryId/quotation`
- POST `/api/v1/marketing/enquiries/:enquiryId/quotation/submit`

### Purchase module

Apply the additive schema migration after the existing master and purchase schemas:

```bash
npm run migrate:purchase-module
```

The first purchase slice is available under `/api/v1`:

- Purchase requisitions: `/purchase-requisitions`
- PR approval queue: `/purchase-approvals`
- Supplier assignment: `/purchase-supplier-assignments`
- Purchase orders: `/purchase-orders`
- PO approval queue: `/purchase-order-approvals`
- RFQ tracking: `/purchase-rfqs`
- Supplier quotations: `/purchase-supplier-quotations`
- Quote comparison and supplier selection: `/purchase-quote-comparisons`
- GRN / inward and inspection: `/purchase-grns`

The workflow is enforced with action endpoints rather than client-supplied status updates:

```text
PR DRAFT -> SUBMITTED -> line-level APPROVED / NOT_APPROVED / CLARIFICATION
RFQ DRAFT -> SENT -> QUOTED -> supplier selection
PO DRAFT -> SUBMITTED -> APPROVED -> PARTIALLY_RECEIVED -> COMPLETED
GRN DRAFT -> INWARD -> INSPECTION_PENDING -> ACCEPTED/PARTIALLY_ACCEPTED -> POSTED
```

PO generation accepts either pre-RFQ assignments (`purchaseRequestItemIds`) or a
completed comparison (`purchaseEnquiryId`). In the latter case, the persisted
`purchase_supplier_selections` rows are the only source of supplier, quantity and
commercial values.

On an existing database that already has the master tables, run
`npm run migrate:purchase-schema` once, followed by
`npm run migrate:purchase-module`. A clean install should use the complete
schema generated by `scripts/build-production-database.js`.

The migration creates tenant-scoped audit history, approval configuration,
commercial snapshots, partial GRNs and a transactional outbox. RFQ send creates
an `RFQ_EMAIL` outbox job; a worker can claim `PENDING` rows and update delivery
status independently of the API transaction.

Purchase status changes use action endpoints and are validated by the backend. The temporary request context resolves `tenantId` from `USER_TENANT_MAP_JSON` or `DEFAULT_TENANT_ID`; it is never read from request bodies.
