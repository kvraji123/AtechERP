import { useUnsavedChanges } from "../../components/UnsavedChanges";
import {
  ArrowLeft,
  Building2,
  ExternalLink,
  Pencil,
  Plus,
  Save,
  Send,
  Trash2,
} from "lucide-react";

import {
  useEffect,
  useState,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
} from "react";

import {
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { customerApi } from "../../api/customer.api";
import { attachmentApi, type StoredAttachment } from "../../api/attachment.api";
import { apiMessage } from "../../api/client";
import { useReferenceData } from "../../hooks/useReferenceData";
import {
  locationApi,
  type CityLocation,
} from "../../api/location.api";
import Alert from "../../components/Alert";
import { useAppFeedback } from "../../components/AppFeedback";
import { useAuth } from "../../context/AuthContext";
import TransportModeMultiSelect from "../../components/TransportModeMultiSelect";
import "./CustomerFormPage.css";
type CustomerAttachmentType =
  | "NDA"
  | "AGREEMENT"
  | "GST_CERTIFICATE"
  | "PAN_CARD"
  | "OTHER";

type CustomerAttachment = {
  attachmentId?: number;
  attachmentType: CustomerAttachmentType;
  attachmentName: string;
  file: File | null;
  fileName?: string;
  fileUrl?: string;
};

type CustomerFormData = {
  customerCode: string;
  customerName: string;
  plantCode: string;

  billingAddress: string;
  deliveryAddress: string;
  deliveryTerms: string;
  paymentTerms: string;
  transportModes: string[];

  pinCode: string;
  city: string;
  state: string;
  country: string;

  gstNo: string;

  mobileNumber: string;
  phoneNumber: string;
  faxNumber: string;
  email: string;
  website: string;

  invoiceType: string;
  currency: string;

  contactPersonName: string;
  contactPersonMobile: string;
  designation: string;
  department: string;

  accountNumber: string;
  accountName: string;
  bankName: string;
  branchName: string;
  ifscCode: string;
  bankPanTan: string;

  customerStatus: string;
  otherLegalRequirements: string;

  attachments: CustomerAttachment[];
};

function createAttachment(): CustomerAttachment {
  return {
    attachmentType: "NDA",
    attachmentName: "",
    file: null,
  };
}

function storedAttachments(attachments: StoredAttachment[]): CustomerAttachment[] {
  return attachments.length
    ? attachments.map((attachment) => ({
        attachmentId: Number(attachment.attachmentId),
        attachmentType: attachment.attachmentType as CustomerAttachmentType,
        attachmentName: attachment.attachmentName || "",
        file: null,
        fileName: attachment.fileName,
        fileUrl: attachment.fileUrl,
      }))
    : [createAttachment()];
}

const usesIndianPostalCode = (country: string) => {
  const normalizedCountry = country.trim().toUpperCase();
  return !normalizedCountry || normalizedCountry === "INDIA" || normalizedCountry === "IN";
};

const initialForm: CustomerFormData = {
  customerCode: "Auto Generated",
  customerName: "",
  plantCode: "",

  billingAddress: "",
  deliveryAddress: "",
  deliveryTerms: "",
  paymentTerms: "",
  transportModes: [],

  pinCode: "",
  city: "",
  state: "",
  country: "",

  gstNo: "",

  mobileNumber: "",
  phoneNumber: "",
  faxNumber: "",
  email: "",
  website: "",

  invoiceType: "",
  currency: "INR",

  contactPersonName: "",
  contactPersonMobile: "",
  designation: "",
  department: "",

  accountNumber: "",
  accountName: "",
  bankName: "",
  branchName: "",
  ifscCode: "",
  bankPanTan: "",

  customerStatus: "ACTIVE",
  otherLegalRequirements: "",

  attachments: [createAttachment()],
};

export default function CustomerFormPage() {
  const referenceData = useReferenceData([
    "RECORD_STATUS", "INVOICE_TYPE", "CURRENCY", "CUSTOMER_ATTACHMENT_TYPE", "PAYMENT_TERM", "DELIVERY_TERM", "TRANSPORT_MODE",
  ]);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { confirmDelete } = useAppFeedback();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const customerId = Number(id || 0);

  const isEditMode = customerId > 0;
  const isReadOnly = isEditMode && searchParams.get("mode") === "view";
  const isAdministrator = String(user?.roleName || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_") === "ADMINISTRATOR";

  const [form, setForm] =
    useState<CustomerFormData>(initialForm);

  const [saving, setSaving] = useState<
    "DRAFT" | "SUBMIT" | null
  >(null);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [cityOptions, setCityOptions] = useState<CityLocation[]>([]);
  const [cityOptionsOpen, setCityOptionsOpen] = useState(false);
  const [cityLoading, setCityLoading] = useState(false);
  const [cityLookupError, setCityLookupError] = useState("");
  const [citySelected, setCitySelected] = useState(false);
  const [activeCityIndex, setActiveCityIndex] = useState(-1);
  const indianCustomer = usesIndianPostalCode(form.country);
  const postalCodeLabel = indianCustomer ? "Pin Code" : "Postal / ZIP Code";

  const unsaved = useUnsavedChanges(form, undefined, !isReadOnly);

  useEffect(() => {
    if (!customerId) {
      setForm(initialForm);
      return;
    }

    let mounted = true;

    Promise.all([
      customerApi.getById(customerId),
      attachmentApi.list("CUSTOMER", customerId),
    ])
      .then(([response, attachmentResponse]) => {
        if (!mounted) return;
        const data = response?.data ?? {};

        setForm({
          customerCode: data.customer_code ?? data.customerCode ?? "",
          customerName: data.customer_name ?? data.customerName ?? "",
          plantCode: data.plant_code ?? data.plantCode ?? "",
          billingAddress: data.billing_address ?? "",
          deliveryAddress: data.delivery_address ?? "",
          deliveryTerms: data.delivery_terms ?? "",
          paymentTerms: data.payment_terms ?? "",
          transportModes: Array.isArray(data.transportModes) ? data.transportModes : [],
          pinCode: data.pin_code ?? "",
          city: data.city ?? "",
          state: data.state_name ?? data.stateName ?? "",
          country: data.country_name ?? data.countryName ?? "",
          gstNo: data.gst_number ?? "",
          mobileNumber: data.mobile_number ?? "",
          phoneNumber: data.phone_number ?? "",
          faxNumber: data.fax_number ?? "",
          email: data.email_address ?? "",
          website: data.website_url ?? "",
          invoiceType: data.invoice_type ?? "",
          currency: data.currency_code ?? "INR",
          contactPersonName: data.contact_person_name ?? "",
          contactPersonMobile: data.contact_person_mobile ?? "",
          designation: data.contact_person_designation ?? "",
          department: data.contact_person_department ?? "",
          accountNumber: data.account_number ?? "",
          accountName: data.account_name ?? "",
          bankName: data.bank_name ?? "",
          branchName: data.branch_name ?? "",
          ifscCode: data.ifsc_code ?? "",
          bankPanTan: data.pan_number ?? data.pan_tan_number ?? "",
          customerStatus: data.customer_status ?? "ACTIVE",
          otherLegalRequirements: data.other_legal_requirements ?? "",
          attachments: storedAttachments(Array.isArray(attachmentResponse?.data) ? attachmentResponse.data : []),
        });
      })
      .catch((loadError) => {
        if (mounted) setError(apiMessage(loadError));
      });

    return () => {
      mounted = false;
    };
  }, [customerId]);

  useEffect(() => {
    if (citySelected) {
      return;
    }

    const search = form.city.trim();

    if (search.length < 2) {
      setCityOptions([]);
      setCityLookupError("");
      setCityLoading(false);
      return;
    }

    let active = true;
    const timeoutId = window.setTimeout(() => {
      setCityLoading(true);
      setCityLookupError("");

      locationApi
        .searchCities(search)
        .then((response) => {
          if (!active) return;

          const options = Array.isArray(response?.data)
            ? response.data
            : [];

          setCityOptions(options);
          setActiveCityIndex(-1);
          setCityOptionsOpen(true);
        })
        .catch((lookupError) => {
          if (!active) return;
          setCityOptions([]);
          setCityLookupError(apiMessage(lookupError));
        })
        .finally(() => {
          if (active) setCityLoading(false);
        });
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [form.city, citySelected]);

  const handleChange = (
    event: ChangeEvent<
      HTMLInputElement |
      HTMLSelectElement |
      HTMLTextAreaElement
    >
  ) => {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));

    setError("");
    setMessage("");
  };

  const handleCityChange = (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const city = event.target.value;

    setForm((current) => ({
      ...current,
      city,
      state: "",
      country: "",
    }));
    setCitySelected(false);
    setCityOptionsOpen(city.trim().length >= 2);
    setCityLookupError("");
    setError("");
    setMessage("");
  };

  const selectCity = (location: CityLocation) => {
    setForm((current) => ({
      ...current,
      city: location.cityName,
      state: location.stateName,
      country: location.countryName,
    }));
    setCitySelected(true);
    setCityOptions([]);
    setCityOptionsOpen(false);
    setCityLookupError("");
    setActiveCityIndex(-1);
  };

  const handleCityKeyDown = (
    event: KeyboardEvent<HTMLInputElement>
  ) => {
    if (!cityOptionsOpen || cityOptions.length === 0) {
      if (event.key === "ArrowDown" && cityOptions.length > 0) {
        setCityOptionsOpen(true);
      }
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveCityIndex((current) =>
        Math.min(current + 1, cityOptions.length - 1)
      );
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveCityIndex((current) => Math.max(current - 1, 0));
    } else if (event.key === "Enter" && activeCityIndex >= 0) {
      event.preventDefault();
      selectCity(cityOptions[activeCityIndex]);
    } else if (event.key === "Escape") {
      setCityOptionsOpen(false);
      setActiveCityIndex(-1);
    }
  };

  const addAttachment = () => {
    setForm((current) => ({
      ...current,
      attachments: [
        ...current.attachments,
        createAttachment(),
      ],
    }));
  };

  const updateAttachment = (
    index: number,
    field:
      | "attachmentType"
      | "attachmentName"
      | "file",
    value: string | File | null
  ) => {
    setForm((current) => ({
      ...current,
      attachments: current.attachments.map(
        (attachment, attachmentIndex) =>
          attachmentIndex === index
            ? {
                ...attachment,
                [field]: value,
              }
            : attachment
      ),
    }));
  };

  const removeAttachment = async (index: number) => {
    if (form.attachments.length === 1) return;

    const confirmed = await confirmDelete({
      title: "Delete attachment?",
      message:
        "This attachment row and its selected file will be removed from the form.",
      confirmLabel: "Delete attachment",
    });
    if (!confirmed) return;

    const attachment = form.attachments[index];
    if (attachment?.attachmentId) {
      try {
        await attachmentApi.remove("CUSTOMER", customerId, attachment.attachmentId);
      } catch (removeError) {
        setError(apiMessage(removeError));
        return;
      }
    }

    setForm((current) => ({
      ...current,
      attachments:
        current.attachments.length === 1
          ? current.attachments
          : current.attachments.filter(
              (_, attachmentIndex) =>
                attachmentIndex !== index
            ),
    }));
  };

  const validate = (
    action: "DRAFT" | "SUBMIT"
  ) => {
    if (action === "DRAFT") return true;

    if (!form.customerName.trim()) {
      setError("Customer name is required.");
      return false;
    }

    const requiredFields: Array<[string, string]> = [
      [form.billingAddress, "Billing address"],
      [form.deliveryAddress, "Delivery address"],
      [form.pinCode, postalCodeLabel],
      [form.city, "City"],
      [form.state, "State"],
      [form.country, "Country"],
    ];
    if (indianCustomer) requiredFields.splice(6, 0, [form.gstNo, "GST number"]);
    const missingField = requiredFields.find(([value]) => !value.trim());
    if (missingField) {
      setError(`${missingField[1]} is required.`);
      return false;
    }

    if (indianCustomer && form.pinCode && !/^\d{6}$/.test(form.pinCode)) {
      setError("Enter a valid 6 digit pin code.");
      return false;
    }

    if (!indianCustomer && form.pinCode && !/^[A-Za-z0-9]{3,10}$/.test(form.pinCode)) {
      setError("Enter a valid Postal / ZIP code using 3 to 10 letters or numbers.");
      return false;
    }

    if (
      form.email &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        form.email
      )
    ) {
      setError("Enter a valid email address.");
      return false;
    }

    return true;
  };

  const saveCustomer = async (
    action: "DRAFT" | "SUBMIT"
  ) => {
    if (isReadOnly) return;
    if (action === "SUBMIT" && !isAdministrator) {
      setMessage("");
      setError("Only administrators can submit Customer Masters. You can save this record as a draft.");
      return;
    }
    if (!validate(action)) {
      return;
    }

    try {
      setSaving(action);
      setError("");
      setMessage("");

      const payload = {
        action,
        customerCode: isEditMode ? form.customerCode : null,
        customerName: form.customerName.trim(),
        plantCode: form.plantCode.trim() || null,
        billingAddress: form.billingAddress.trim() || null,
        deliveryAddress: form.deliveryAddress.trim() || null,
        deliveryTerms: form.deliveryTerms.trim() || null,
        paymentTerms: form.paymentTerms.trim() || null,
        transportModes: form.transportModes,
        pinCode: form.pinCode.trim() || null,
        city: form.city.trim() || null,
        stateName: form.state.trim() || null,
        countryName: form.country.trim() || null,
        gstNumber: form.gstNo.trim() || null,
        panNumber: form.bankPanTan.trim() || null,
        mobileNumber: form.mobileNumber.trim() || null,
        phoneNumber: form.phoneNumber.trim() || null,
        faxNumber: form.faxNumber.trim() || null,
        emailAddress: form.email.trim() || null,
        websiteUrl: form.website.trim() || null,
        invoiceType: form.invoiceType || null,
        currencyCode: form.currency || "INR",
        contactPersonName: form.contactPersonName.trim() || null,
        contactPersonMobile: form.contactPersonMobile.trim() || null,
        contactPersonDesignation: form.designation.trim() || null,
        contactPersonDepartment: form.department.trim() || null,
        accountNumber: form.accountNumber.trim() || null,
        accountName: form.accountName.trim() || null,
        bankName: form.bankName.trim() || null,
        branchName: form.branchName.trim() || null,
        ifscCode: form.ifscCode.trim() || null,
        panTanNumber: null,
        otherLegalRequirements:
          form.otherLegalRequirements.trim() || null,
      };

      const response = isEditMode
        ? await customerApi.update(customerId, payload)
        : await customerApi.create(payload);

      const savedId = Number(
        response?.data?.customerId ?? customerId
      );

      if (!savedId) throw new Error("Customer was saved but its identifier was not returned.");

      if (action === "SUBMIT" && savedId && (isEditMode || form.customerStatus === "INACTIVE")) {
        await customerApi.changeStatus(
          savedId,
          form.customerStatus as "ACTIVE" | "INACTIVE"
        );
      }

      const savedAttachments = await Promise.all(form.attachments.map(async (attachment) => {
        if (attachment.attachmentId && attachment.file) {
          const uploaded = await attachmentApi.upload("CUSTOMER", savedId, attachment.file, attachment);
          await attachmentApi.remove("CUSTOMER", savedId, attachment.attachmentId);
          return uploaded.data as StoredAttachment;
        }
        if (attachment.attachmentId) {
          const updated = await attachmentApi.update("CUSTOMER", savedId, attachment.attachmentId, attachment);
          return updated.data as StoredAttachment;
        }
        if (attachment.file) {
          const uploaded = await attachmentApi.upload("CUSTOMER", savedId, attachment.file, attachment);
          return uploaded.data as StoredAttachment;
        }
        return null;
      }));
      const nextAttachments = storedAttachments(savedAttachments.filter((attachment): attachment is StoredAttachment => Boolean(attachment)));
      setForm((current) => ({ ...current, attachments: nextAttachments }));

      unsaved.markSaved();
      setMessage(response?.message ?? "Customer saved successfully.");

      if (action === "SUBMIT") {
        window.setTimeout(() => {
          navigate("/masters/customers");
        }, 700);
      } else if (!isEditMode) {
        // Keep subsequent draft saves on this persisted record. Remaining on
        // /new would issue another POST and create a duplicate customer.
        navigate(`/masters/customers/${savedId}`, { replace: true });
      }
    } catch (saveError) {
      setError(apiMessage(saveError));
    } finally {
      setSaving(null);
    }
  };

  const handleSubmit = (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    if (isReadOnly) return;
    if (!isAdministrator) {
      setMessage("");
      setError("Only administrators can submit Customer Masters. You can save this record as a draft.");
      return;
    }
    void saveCustomer("SUBMIT");
  };

  return (
    <div className="page-container master-form-page customer-form-compact">
      <section className="master-form-page-header">
        <div className="master-form-title-group">
          <Building2 size={22} />
          <h1>
            {isReadOnly
              ? "View Customer"
              : isEditMode
              ? "Edit Customer"
              : "Create Customer"}
          </h1>
        </div>

        <div className="master-form-actions">
          <button
            type="button"
            className="customer-cancel-link"
            onClick={() =>
              navigate("/masters/customers")
            }
          >
            <ArrowLeft size={15} />
            {isReadOnly ? "Back" : "Cancel"}
          </button>

          {isReadOnly ? <button
            type="button"
            className="primary-action-button"
            onClick={() => navigate(`/masters/customers/${customerId}?mode=edit`)}
          >
            <Pencil size={17} />
            Edit Customer
          </button> : <><button
            type="button"
            className="secondary-action-button draft"
            disabled={saving !== null}
            onClick={() =>
              void saveCustomer("DRAFT")
            }
          >
            <Save size={17} />

            {saving === "DRAFT"
              ? "Saving..."
              : "Save Draft"}
          </button>

          <button
            type="submit"
            form="customer-master-form"
            className="primary-action-button"
            disabled={saving !== null || !isAdministrator}
            title={isAdministrator ? undefined : "Only administrators can submit Customer Masters"}
          >
            <Send size={17} />

            {saving === "SUBMIT"
              ? "Saving..."
              : !isAdministrator
                ? "Submit (Admin only)"
              : isEditMode
                ? "Update"
                : "Submit"}
          </button>
          </>}
        </div>
      </section>

      {error && (
        <Alert type="error" message={error} />
      )}

      {referenceData.error && <Alert type="error" message={referenceData.error} />}
      {message && (
        <Alert type="success" message={message} />
      )}

      <form
        id="customer-master-form"
        className="master-entry-form"
        onSubmit={handleSubmit}
      >
        <fieldset className="master-read-only-fields" disabled={isReadOnly}>
        <section className="master-form-section">
          <div className="master-section-header">
            <div>
              <h2>Basic Information</h2>
              <p>
                Customer identification.
              </p>
            </div>
          </div>

          <div className="master-form-grid">
            <label className="master-field">
              <span>Customer Code</span>

              <input
                name="customerCode"
                value={form.customerCode}
                readOnly
                className="readonly"
              />
            </label>

            <label className="master-field span-2">
              <span>
                Customer Name
                <b>*</b>
              </span>

              <input
                name="customerName"
                value={form.customerName}
                onChange={handleChange}
                placeholder="Enter company name"
              />
            </label>

            <label className="master-field">
              <span>Plant Code</span>

              <input
                name="plantCode"
                value={form.plantCode}
                onChange={handleChange}
                placeholder="Enter plant code"
              />
            </label>

            <label className="master-field">
              <span>Customer Status</span>

              <select
                name="customerStatus"
                value={form.customerStatus}
                onChange={handleChange}
              >
                {referenceData.options("RECORD_STATUS").map((option) =>
                  <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>

            <label className="master-field">
              <span>Invoice Type</span>

              <select
                name="invoiceType"
                value={form.invoiceType}
                onChange={handleChange}
              >
                <option value="">
                  Select invoice type
                </option>

                {referenceData.options("INVOICE_TYPE").map((option) =>
                  <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>

            <label className="master-field">
              <span>Currency</span>

              <select
                name="currency"
                value={form.currency}
                onChange={handleChange}
              >
                {referenceData.options("CURRENCY").map((option) =>
                  <option key={option.value} value={option.value}>{option.value} - {option.label}</option>)}
              </select>
            </label>
          </div>
        </section>

        <section className="master-form-section">
          <div className="master-section-header">
            <div>
              <h2>Address Details</h2>
              <p>
                Billing, delivery and location
                information.
              </p>
            </div>
          </div>

          <div className="master-form-grid">
            <label className="master-field span-2">
              <span>
                Billing Address
                <b>*</b>
              </span>

              <textarea
                name="billingAddress"
                value={form.billingAddress}
                onChange={handleChange}
                rows={4}
              />
            </label>

            <label className="master-field span-2">
              <span>Delivery Address <b>*</b></span>

              <textarea
                name="deliveryAddress"
                value={form.deliveryAddress}
                onChange={handleChange}
                rows={4}
              />
            </label>

            <label className="master-field span-2">
              <span>Delivery Terms</span>

              <select name="deliveryTerms" value={form.deliveryTerms} onChange={handleChange}>
                <option value="">Select delivery terms</option>
                {form.deliveryTerms && !referenceData.options("DELIVERY_TERM").some((option) => option.value === form.deliveryTerms) && <option value={form.deliveryTerms}>{form.deliveryTerms}</option>}
                {referenceData.options("DELIVERY_TERM").map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
<label className="master-field"><span>Payment Terms</span><select name="paymentTerms" value={form.paymentTerms} onChange={handleChange}><option value="">Select payment terms</option>{form.paymentTerms && !referenceData.options("PAYMENT_TERM").some((option) => option.value === form.paymentTerms) && <option value={form.paymentTerms}>{form.paymentTerms}</option>}{referenceData.options("PAYMENT_TERM").map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
            <label className="master-field"><span>Transport Modes</span><TransportModeMultiSelect options={referenceData.options("TRANSPORT_MODE")} value={form.transportModes} onChange={(transportModes) => setForm((current) => ({ ...current, transportModes }))} /></label>

            <label className="master-field">
              <span>{postalCodeLabel} <b>*</b></span>

              <input
                name="pinCode"
                value={form.pinCode}
                onChange={handleChange}
                maxLength={indianCustomer ? 6 : 10}
                inputMode={indianCustomer ? "numeric" : "text"}
              />
            </label>

            <label className="master-field location-city-field">
              <span>City <b>*</b></span>

              <input
                name="city"
                value={form.city}
                onChange={handleCityChange}
                onKeyDown={handleCityKeyDown}
                onFocus={() => {
                  if (cityOptions.length > 0) {
                    setCityOptionsOpen(true);
                  }
                }}
                onBlur={() => {
                  window.setTimeout(
                    () => setCityOptionsOpen(false),
                    120
                  );
                }}
                placeholder="Type at least 2 characters"
                autoComplete="off"
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={cityOptionsOpen}
                aria-controls="customer-city-options"
              />

              {cityLoading && (
                <small className="location-field-hint">
                  Searching worldwide cities...
                </small>
              )}

              {!cityLoading &&
                !citySelected &&
                form.city.trim().length >= 2 &&
                cityOptionsOpen &&
                cityOptions.length === 0 &&
                !cityLookupError && (
                  <small className="location-field-hint">
                    No matching city. Continue with manual State and Country.
                  </small>
                )}

              {cityLookupError && (
                <small className="location-field-hint error">
                  City search unavailable. Continue with manual entry.
                </small>
              )}

              {citySelected && (
                <small className="location-field-hint success">
                  State and country filled automatically.
                </small>
              )}

              {cityOptionsOpen && cityOptions.length > 0 && (
                <div
                  id="customer-city-options"
                  className="location-city-options"
                  role="listbox"
                >
                  {cityOptions.map((location, index) => (
                    <button
                      key={`${location.cityName}-${location.stateCode}-${location.countryCode}-${index}`}
                      type="button"
                      role="option"
                      aria-selected={index === activeCityIndex}
                      className={
                        index === activeCityIndex ? "active" : ""
                      }
                      onMouseDown={(event) => event.preventDefault()}
                      onMouseEnter={() => setActiveCityIndex(index)}
                      onClick={() => selectCity(location)}
                    >
                      <strong>{location.cityName}</strong>
                      <span>
                        {[location.stateName, location.countryName]
                          .filter(Boolean)
                          .join(", ")}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </label>

            <label className="master-field">
              <span>State <b>*</b></span>

              <input
                name="state"
                value={form.state}
                onChange={handleChange}
                readOnly={citySelected}
                className={citySelected ? "readonly" : ""}
                placeholder="Auto-filled after city selection"
              />
            </label>

            <label className="master-field">
              <span>Country <b>*</b></span>

              <input
                name="country"
                value={form.country}
                onChange={handleChange}
                readOnly={citySelected}
                className={citySelected ? "readonly" : ""}
                placeholder="Auto-filled after city selection"
              />
            </label>
          </div>
        </section>

        <section className="master-form-section">
          <div className="master-section-header">
            <div>
              <h2>Statutory Details</h2>
              <p>
                GST and other legal information.
              </p>
            </div>
          </div>

          <div className="master-form-grid">
            <label className="master-field span-2">
              <span>GST Number {indianCustomer && <b>*</b>}</span>

              <input
                name="gstNo"
                value={form.gstNo}
                onChange={handleChange}
                maxLength={15}
                className="uppercase"
              />
            </label>

            <label className="master-field span-2">
              <span>
                Other Legal Requirements
              </span>

              <textarea
                name="otherLegalRequirements"
                value={form.otherLegalRequirements}
                onChange={handleChange}
                rows={2}
              />
            </label>
          </div>
        </section>

        <section className="master-form-section">
          <div className="master-section-header">
            <div>
              <h2>Contact Details</h2>
              <p>
                Company and primary contact
                information.
              </p>
            </div>
          </div>

          <div className="master-form-grid">
            <label className="master-field">
              <span>Mobile Number</span>

              <input
                name="mobileNumber"
                value={form.mobileNumber}
                onChange={handleChange}
              />
            </label>

            <label className="master-field">
              <span>Phone Number</span>

              <input
                name="phoneNumber"
                value={form.phoneNumber}
                onChange={handleChange}
              />
            </label>

            <label className="master-field">
              <span>Fax Number</span>

              <input
                name="faxNumber"
                value={form.faxNumber}
                onChange={handleChange}
              />
            </label>

            <label className="master-field">
              <span>Email</span>

              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
              />
            </label>

            <label className="master-field span-2">
              <span>Website</span>

              <input
                type="url"
                name="website"
                value={form.website}
                onChange={handleChange}
                placeholder="https://"
              />
            </label>

            <label className="master-field span-2">
              <span>Contact Person Name</span>

              <input
                name="contactPersonName"
                value={form.contactPersonName}
                onChange={handleChange}
              />
            </label>

            <label className="master-field">
              <span>
                Contact Person Mobile
              </span>

              <input
                name="contactPersonMobile"
                value={form.contactPersonMobile}
                onChange={handleChange}
              />
            </label>

            <label className="master-field">
              <span>Designation</span>

              <input
                name="designation"
                value={form.designation}
                onChange={handleChange}
              />
            </label>

            <label className="master-field span-2">
              <span>Department</span>

              <input
                name="department"
                value={form.department}
                onChange={handleChange}
              />
            </label>
          </div>
        </section>

        <section className="master-form-section">
          <div className="master-section-header">
            <div>
              <h2>Bank Details</h2>
              <p>
                Optional payment and account information.
              </p>
            </div>
          </div>

          <div className="master-form-grid">
            <label className="master-field">
              <span>Account Number</span>

              <input
                name="accountNumber"
                value={form.accountNumber}
                onChange={handleChange}
              />
            </label>

            <label className="master-field">
              <span>Account Name</span>

              <input
                name="accountName"
                value={form.accountName}
                onChange={handleChange}
              />
            </label>

            <label className="master-field">
              <span>Bank Name</span>

              <input
                name="bankName"
                value={form.bankName}
                onChange={handleChange}
              />
            </label>

            <label className="master-field">
              <span>Branch Name</span>

              <input
                name="branchName"
                value={form.branchName}
                onChange={handleChange}
              />
            </label>

            <label className="master-field">
              <span>IFSC Code</span>

              <input
                name="ifscCode"
                value={form.ifscCode}
                onChange={handleChange}
                className="uppercase"
              />
            </label>

            <label className="master-field">
              <span>PAN / TAN</span>

              <input
                name="bankPanTan"
                value={form.bankPanTan}
                onChange={handleChange}
                maxLength={10}
                className="uppercase"
              />
            </label>
          </div>
        </section>

        <section className="master-form-section">
          <div className="master-section-header between">
            <div className="master-heading-inline">
              <div>
                <h2>Attachments</h2>

                <p>
                  NDA, agreements and legal documents.
                </p>
              </div>
            </div>

            <button
              type="button"
              className="marketing-add-line-button"
              onClick={addAttachment}
            >
              <Plus size={16} />
              Add Attachment
            </button>
          </div>

          <div className="master-attachment-list">
            {form.attachments.map(
              (attachment, index) => (
                <div
                  className="master-attachment-row"
                  key={`${index}-${attachment.attachmentId ?? "new"}`}
                >
                  <span className="attachment-index">
                    {index + 1}
                  </span>

                  <select
                    value={attachment.attachmentType}
                    onChange={(event) =>
                      updateAttachment(
                        index,
                        "attachmentType",
                        event.target.value
                      )
                    }
                  >
                    {referenceData.options("CUSTOMER_ATTACHMENT_TYPE").map((option) =>
                      <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>

                  <input
                    value={attachment.attachmentName}
                    onChange={(event) =>
                      updateAttachment(
                        index,
                        "attachmentName",
                        event.target.value
                      )
                    }
                    placeholder="Document description"
                  />

                  {attachment.fileUrl && (
                    <a className="master-attachment-link" href={attachment.fileUrl} target="_blank" rel="noreferrer">
                      <ExternalLink size={14} /> {attachment.fileName || "Open file"}
                    </a>
                  )}

                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx"
                    onChange={(event) =>
                      updateAttachment(
                        index,
                        "file",
                        event.target.files?.[0] ??
                          null
                      )
                    }
                  />

                  <button
                    type="button"
                    className="marketing-delete-line-button"
                    disabled={
                      form.attachments.length === 1
                    }
                    onClick={() =>
                      removeAttachment(index)
                    }
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              )
            )}
          </div>
        </section>
        </fieldset>
      </form>
    </div>
  );
}
