# Form navigation and dates

`UnsavedChangesProvider` uses React Router's data router to guard Back/Forward, links, menus and programmatic navigation. `beforeunload` covers refresh, closing a tab and leaving the site with the browser's standard warning (browsers control its wording and may suppress it).

Entry forms register their editable state with `useUnsavedChanges`. Initial API hydration stays clean; user input, selection, paste and row actions arm comparison against the last saved state. Reverting changes makes the form clean again. Search and filter state is excluded.

Capture `const snapshot = unsaved.snapshot()` before saving and call `unsaved.markSaved(snapshot)` only after all relevant saves succeed. Changes made while the request is running remain dirty. For partial saves, update only the corresponding part of `unsaved.baseline()`; do not clear other records. Use `unsaved.requestLeave(callback)` to protect an editor's local Close/Cancel action.

Save Draft & Leave is offered only by registered draft callbacks. These must return true after persistence, mark the saved snapshot and avoid their own navigation. Failure leaves the dialog/form open. Marketing draft workflows and the existing Gate Entry/GRN draft stores are connected. Master forms do not offer automatic draft saving because their existing Save Draft buttons create active records. PR drafts still require a complete entry and are not automatically invoked. No automatic draft recovery or new browser storage was added.

All date/date-time inputs use `DateInput`: four-digit years in the database-supported range 1000–9999, valid calendar values, native date-picker validation and existing per-field min/max rules. The form boundary blocks malformed dates on save/submit actions, including local receiving workflows. Optional blank values remain allowed; required-field rules stay with the individual workflow. The API's `validateDates` middleware validates nested date fields before any JSON request reaches a module. Add unusual date property names to `extraDates` when introducing new APIs.

Verified manually: Cancel/Stay preserves entries; browser Back/Discard completes navigation; reverting typed text leaves without a warning; a failed enquiry draft save stays on the page; successful incomplete enquiry draft saving completes the original navigation. The browser test draft was removed afterward. Date checks covered oversized-year rejection and correcting the date. Automated calendar and HTTP validation checks: `node tests/date-validation.unit.js` from backend.
