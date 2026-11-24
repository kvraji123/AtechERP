import DateInput from "../../../components/DateInput";
import { useUnsavedChanges } from "../../../components/UnsavedChanges";
import "./EnquiryFormPage.css";

import {
  useEffect,
  useState,
} from "react";

import {
  ArrowLeft,
  ExternalLink,
  History,
  Paperclip,
  Pencil,
  Plus,
  Save,
  Send,
  Trash2,
  X,
} from "lucide-react";

import {
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";

import { apiMessage } from "../../../api/client";
import {
  attachmentApi,
  attachmentFileUrl,
  type StoredAttachment,
} from "../../../api/attachment.api";
import { customerApi } from "../../../api/customer.api";
import { marketingApi } from "../../../api/marketing.api";
import { partApi } from "../../../api/part.api";

import Alert from "../../../components/Alert";
import { useAppFeedback } from "../../../components/AppFeedback";
import StageTabs from "../../../components/StageTabs";
import { useReferenceData } from "../../../hooks/useReferenceData";
import { useAuth } from "../../../context/AuthContext";
import { hasPermission, Permissions } from "../../../utils/permissions";
import { todayInAppTimeZone } from "../../../utils/formatDateTime";

type MessageState = {
  type: "error" | "success";
  text: string;
};

type EnquiryStatus =
  | "IN_PROGRESS"
  | "QUOTED"
  | "ORDER_RECEIVED";

type CustomerOption = {
  id?: number;
  customerId?: number;
  customer_id?: number;
  customerCode?: string;
  customer_code?: string;
  customerName?: string;
  customer_name?: string;
  customerShortName?: string;
  customer_short_name?: string;
};

type EnquiryPartForm = {
  enquiry_part_id?: number;
  partId: number | null;
  partNumber: string;
  itemCode: string;
  drawingNumber: string;
  drawingRevisionNumber: string;
  drawingRevisionDate: string;
  productDescription: string;
  materialAndGrade: string;
  isAssembledPart: boolean;
  annualQuantity: string;
  moq: string;
  unitOfMeasurement: string;
  drawingAttachments?: StoredAttachment[];
};

type PartOption = {
  partId: number;
  partNumber: string;
  drawingNumber: string;
  drawingRevisionNumber?: string;
  drawingRevisionDate?: string;
  drawingCode?: string;
  partName: string;
  materialSpecification?: string;
  unitOfMeasurement?: string;
  customerCode?: string;
  customerName?: string;
};

type EnquiryFormState = {
  customerId: string;
  customerRepresentativeName: string;
  enquiryMode: string;
  orderType: string;
  requiredDate: string;
  customerEnquiryReference: string;
  customerEnquiryDate: string;
  remarks: string;
  parts: EnquiryPartForm[];
};

type EnquiryRevision = {
  enquiryRevisionId: number;
  revisionSequence: number;
  revisionNumber: string;
  revisionDate: string;
  revisionAction: string;
  saveStatus: "DRAFT" | "SUBMITTED";
  createdBy: string;
  createdOn: string;
};

const createBlankPart = (): EnquiryPartForm => ({
  partId: null,
  partNumber: "",
  itemCode: "",
  drawingNumber: "",
  drawingRevisionNumber: "",
  drawingRevisionDate: "",
  productDescription: "",
  materialAndGrade: "",
  isAssembledPart: false,
  annualQuantity: "",
  moq: "",
  unitOfMeasurement: "Nos",
});

const today = todayInAppTimeZone;

const createInitialForm = (): EnquiryFormState => ({
  customerId: "",
  customerRepresentativeName: "",
  enquiryMode: "MAIL",
  orderType: "SALES",
  requiredDate: "",
  customerEnquiryReference: "",
  customerEnquiryDate: "",
  remarks: "",
  parts: [createBlankPart()],
});

const formatDateForInput = (
  value: unknown
): string => {
  if (!value) {
    return "";
  }

  const text = String(value);

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }

  if (/^\d{4}-\d{2}-\d{2}T/.test(text)) {
    return text.substring(0, 10);
  }

  return text;
};

const enquiryStatusLabel = (status: EnquiryStatus) =>
  ({
    IN_PROGRESS: "In Progress",
    QUOTED: "Quoted",
    ORDER_RECEIVED: "Order Received",
  })[status];

export default function EnquiryFormPage() {
  const referenceData = useReferenceData(["ENQUIRY_MODE", "ORDER_TYPE", "ENQUIRY_STATUS_TRANSITION"]);
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { confirmDelete, showSuccess } = useAppFeedback();
  const canEditAllStages = hasPermission(
    user,
    Permissions.editEnquiryAllStages
  );
  const editRequested =
    searchParams.get("mode") === "edit" && canEditAllStages;

  const enquiryId = Number(id || 0);

  const [customers, setCustomers] =
    useState<CustomerOption[]>([]);

  const [form, setForm] =
    useState<EnquiryFormState>(
      createInitialForm()
    );

  const [message, setMessage] =
    useState<MessageState | null>(null);

  const [loading, setLoading] =
    useState(false);

  const [enquiryStatus, setEnquiryStatus] =
    useState<EnquiryStatus>("IN_PROGRESS");

  const [recordSaveStatus, setRecordSaveStatus] =
    useState<"DRAFT" | "SUBMITTED">("DRAFT");

  const [draftEditing, setDraftEditing] =
    useState(!enquiryId);

  const [statusUpdating, setStatusUpdating] =
    useState(false);

  const [savingAction, setSavingAction] =
    useState<"DRAFT" | "SUBMIT" | null>(
      null
    );

  const [revisionHistoryOpen, setRevisionHistoryOpen] =
    useState(false);

  const [revisionHistoryLoading, setRevisionHistoryLoading] =
    useState(false);

  const [revisionHistory, setRevisionHistory] =
    useState<EnquiryRevision[]>([]);

  const [revisionHistoryError, setRevisionHistoryError] =
    useState("");

  const [partOptions, setPartOptions] =
    useState<PartOption[]>([]);

  const [partsLoading, setPartsLoading] =
    useState(false);

  const [uploadingDrawingPartId, setUploadingDrawingPartId] =
    useState<number | null>(null);

  const [pendingDrawingFiles, setPendingDrawingFiles] =
    useState<Record<number, File[]>>({});

  const firstEnquiryPartId =
    form.parts.find(
      (part) =>
        Number(part.enquiry_part_id) > 0
    )?.enquiry_part_id;

  const unsaved = useUnsavedChanges(form, recordSaveStatus === "DRAFT" ? async () => (await save("DRAFT", true)) === true : undefined);

  useEffect(() => {
    let mounted = true;

    const loadCustomers = async () => {
      try {
        const response =
          await customerApi.list({
            activeFlag: "Y",
            pageSize: 100,
          });

        const rows =
          response?.data?.rows ??
          response?.data ??
          response?.rows ??
          [];

        if (!mounted) {
          return;
        }

        setCustomers(
          Array.isArray(rows) ? rows : []
        );
      } catch (error) {
        if (!mounted) {
          return;
        }

        setMessage({
          type: "error",
          text: apiMessage(error),
        });
      }
    };

    loadCustomers();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    if (!form.customerId) {
      setPartOptions([]);
      return;
    }

    setPartsLoading(true);
    partApi
      .list({
        activeFlag: "Y",
        pageSize: 100,
      })
      .then((response) => {
        if (!mounted) return;
        const rows = response?.data ?? response?.rows ?? [];
        setPartOptions(Array.isArray(rows) ? rows : []);
      })
      .catch((error) => {
        if (mounted) setMessage({ type: "error", text: apiMessage(error) });
      })
      .finally(() => {
        if (mounted) setPartsLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [form.customerId]);

  useEffect(() => {
    if (enquiryId) return;
    const modes = referenceData.options("ENQUIRY_MODE");
    const orderTypes = referenceData.options("ORDER_TYPE");
    if (!modes.length && !orderTypes.length) return;
    const defaultMode = modes.some((option) => option.value === "MAIL") ? "MAIL" : modes[0]?.value || "MAIL";
    const defaultOrderType = orderTypes.some((option) => option.value === "SALES") ? "SALES" : orderTypes[0]?.value || "SALES";
    setForm((current) => {
      const enquiryMode = !modes.length || modes.some((option) => option.value === current.enquiryMode)
        ? current.enquiryMode
        : defaultMode;
      const orderType = !orderTypes.length || orderTypes.some((option) => option.value === current.orderType)
        ? current.orderType
        : defaultOrderType;
      return enquiryMode === current.enquiryMode && orderType === current.orderType
        ? current
        : { ...current, enquiryMode, orderType };
    });
  }, [enquiryId, referenceData.references]);

  useEffect(() => {
    if (!enquiryId) {
      setForm(createInitialForm());
      setEnquiryStatus("IN_PROGRESS");
      setRecordSaveStatus("DRAFT");
      setDraftEditing(true);
      return;
    }

    let mounted = true;

    const loadEnquiry = async () => {
      try {
        setLoading(true);
        setMessage(null);

        const response =
          await marketingApi.get(
            enquiryId
          );

        const data =
          response?.data?.data ??
          response?.data ??
          {};

        if (!mounted) {
          return;
        }

        setEnquiryStatus(
          (data.enquiry_status ??
            data.enquiryStatus ??
            "IN_PROGRESS") as EnquiryStatus
        );
        setRecordSaveStatus(
          (data.save_status ??
            data.saveStatus ??
            "DRAFT") as "DRAFT" | "SUBMITTED"
        );
        setDraftEditing(editRequested);

        const parts =
          Array.isArray(data.parts) &&
          data.parts.length > 0
            ? data.parts.map(
                (
                  part: any
                ): EnquiryPartForm => ({
                  enquiry_part_id:
                    part.enquiry_part_id ??
                    part.enquiryPartId ??
                    undefined,

                  partId:
                    part.part_id ??
                    part.partId ??
                    null,

                  partNumber:
                    part.part_number ??
                    part.partNumber ??
                    "",

                  itemCode:
                    part.item_code ??
                    part.itemCode ??
                    "",

                  drawingNumber:
                    part.drawing_number ??
                    part.drawingNumber ??
                    "",

                  drawingRevisionNumber:
                    part.drawing_revision_number ??
                    part.drawingRevisionNumber ??
                    "",

                  drawingRevisionDate:
                    formatDateForInput(
                      part.drawing_revision_date ??
                        part.drawingRevisionDate
                    ),

                  productDescription:
                    part.product_description ??
                    part.productDescription ??
                    "",

                  materialAndGrade:
                    part.material_and_grade ??
                    part.materialAndGrade ??
                    "",

                  isAssembledPart: Boolean(
                    Number(
                      part.is_assembled_part ??
                        part.isAssembledPart ??
                        0
                    )
                  ),

                  annualQuantity: String(
                    part.annual_quantity ??
                      part.annualQuantity ??
                      ""
                  ),

                  moq: String(
                    part.moq ?? ""
                  ),

                  unitOfMeasurement:
                    part.unit_of_measurement ??
                    part.unitOfMeasurement ??
                    "Nos",

                  drawingAttachments:
                    Array.isArray(part.drawingAttachments)
                      ? part.drawingAttachments
                      : [],

                })
              )
            : [createBlankPart()];

        setForm({
          customerId: String(
            data.customer_id ??
              data.customerId ??
              ""
          ),

          customerRepresentativeName:
            data.customer_representative_name ??
            data.customerRepresentativeName ??
            "",

          enquiryMode:
            data.enquiry_mode ??
            data.enquiryMode ??
            "",

          orderType:
            data.order_type ??
            data.orderType ??
            "",

          requiredDate:
            formatDateForInput(
              data.required_date ??
                data.requiredDate
            ),

          customerEnquiryReference:
            data.customer_enquiry_reference ??
            data.customerEnquiryReference ??
            "",

          customerEnquiryDate:
            formatDateForInput(
              data.customer_enquiry_date ??
                data.customerEnquiryDate
            ),

          remarks:
            data.remarks ?? "",

          parts,
        });
      } catch (error) {
        if (!mounted) {
          return;
        }

        setMessage({
          type: "error",
          text: apiMessage(error),
        });
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadEnquiry();

    return () => {
      mounted = false;
    };
  }, [enquiryId, editRequested]);

  const changeField = <
    K extends keyof EnquiryFormState,
  >(
    key: K,
    value: EnquiryFormState[K]
  ) => {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const changeCustomer = (customerId: string) => {
    setForm((current) => ({
      ...current,
      customerId,
      parts: current.parts.map((part) => ({
        ...part,
        partId: null,
      })),
    }));
    setMessage(null);
  };

  const changePart = <K extends keyof EnquiryPartForm>(
    index: number,
    key: K,
    value: EnquiryPartForm[K]
  ) => {
    setForm((current) => ({
      ...current,
      parts: current.parts.map(
        (part, partIndex) =>
          partIndex === index
            ? {
                ...part,
                [key]: value,
              }
            : part
      ),
    }));
  };

  const patchPart = (
    index: number,
    changes: Partial<EnquiryPartForm>
  ) => {
    setForm((current) => ({
      ...current,
      parts: current.parts.map((part, partIndex) =>
        partIndex === index ? { ...part, ...changes } : part
      ),
    }));
  };

  const uploadDrawingAttachment = async (index: number, file: File) => {
    const part = form.parts[index];
    const enquiryPartId = Number(part?.enquiry_part_id || 0);
    if (!enquiryPartId) {
      setMessage({ type: "error", text: "Save the enquiry draft before attaching a drawing." });
      return;
    }

    try {
      setUploadingDrawingPartId(enquiryPartId);
      setMessage(null);
      const response = await attachmentApi.upload("ENQUIRY_PART", enquiryPartId, file, {
        attachmentType: "DRAWING",
        attachmentName: part.drawingNumber.trim() || file.name,
      });
      const attachment = (response?.data?.data ?? response?.data ?? response) as StoredAttachment;
      setForm((current) => ({
        ...current,
        parts: current.parts.map((currentPart, partIndex) => partIndex === index
          ? { ...currentPart, drawingAttachments: [...(currentPart.drawingAttachments || []), attachment] }
          : currentPart),
      }));
      setMessage({ type: "success", text: "Drawing attached successfully." });
    } catch (error) {
      setMessage({ type: "error", text: apiMessage(error) });
    } finally {
      setUploadingDrawingPartId(null);
    }
  };

  const selectDrawingAttachments = (index: number, files: File[]) => {
    if (!files.length) return;

    if (Number(form.parts[index]?.enquiry_part_id || 0)) {
      void (async () => {
        for (const file of files) {
          await uploadDrawingAttachment(index, file);
        }
      })();
      return;
    }

    setPendingDrawingFiles((current) => ({
      ...current,
      [index]: [...(current[index] || []), ...files],
    }));
    setMessage({
      type: "success",
      text: `${files.length} drawing${files.length === 1 ? "" : "s"} selected. ${files.length === 1 ? "It will" : "They will"} be attached when the enquiry is saved.`,
    });
  };

  const uploadPendingDrawingAttachments = async (savedParts: any[]) => {
    for (const [indexText, files] of Object.entries(pendingDrawingFiles)) {
      const index = Number(indexText);
      const savedPart = savedParts[index] || {};
      const enquiryPartId = Number(savedPart.enquiry_part_id ?? savedPart.enquiryPartId ?? 0);
      if (!enquiryPartId) throw new Error(`The drawing for Part ${index + 1} could not be attached.`);

      for (const file of files) {
        const response = await attachmentApi.upload("ENQUIRY_PART", enquiryPartId, file, {
          attachmentType: "DRAWING",
          attachmentName: form.parts[index]?.drawingNumber.trim() || file.name,
        });
        const attachment = (response?.data?.data ?? response?.data ?? response) as StoredAttachment;
        setForm((current) => ({
          ...current,
          parts: current.parts.map((part, partIndex) => partIndex === index
            ? { ...part, enquiry_part_id: enquiryPartId, drawingAttachments: [...(part.drawingAttachments || []), attachment] }
            : part),
        }));
        setPendingDrawingFiles((current) => {
          const remaining = (current[index] || []).filter((pendingFile) => pendingFile !== file);
          const next = { ...current };
          if (remaining.length) next[index] = remaining;
          else delete next[index];
          return next;
        });
      }
    }
  };

  const removeDrawingAttachment = async (index: number, attachment: StoredAttachment) => {
    const enquiryPartId = Number(form.parts[index]?.enquiry_part_id || 0);
    if (!enquiryPartId) return;

    try {
      setUploadingDrawingPartId(enquiryPartId);
      setMessage(null);
      await attachmentApi.remove("ENQUIRY_PART", enquiryPartId, attachment.attachmentId);
      setForm((current) => ({
        ...current,
        parts: current.parts.map((part, partIndex) => partIndex === index
          ? { ...part, drawingAttachments: (part.drawingAttachments || []).filter((entry) => entry.attachmentId !== attachment.attachmentId) }
          : part),
      }));
      setMessage({ type: "success", text: "Drawing attachment removed." });
    } catch (error) {
      setMessage({ type: "error", text: apiMessage(error) });
    } finally {
      setUploadingDrawingPartId(null);
    }
  };

  const selectMasterPart = (
    index: number,
    master: PartOption
  ) => {
    patchPart(index, {
      partId: Number(master.partId),
      partNumber: master.partNumber || "",
      itemCode: master.drawingCode || "",
      drawingNumber: master.drawingNumber || "",
      drawingRevisionNumber: master.drawingRevisionNumber || "",
      drawingRevisionDate: formatDateForInput(master.drawingRevisionDate),
      productDescription: master.partName || "",
      materialAndGrade: master.materialSpecification || "",
      unitOfMeasurement: master.unitOfMeasurement || "Nos",
    });
    setMessage({
      type: "success",
      text: `Drawing ${master.drawingNumber} loaded from Part Master.`,
    });
  };

  const changeDrawingNumber = (
    index: number,
    value: string
  ) => {
    const current = form.parts[index];
    const keepsMaster =
      Boolean(current.partId) &&
      current.drawingNumber.trim().toUpperCase() === value.trim().toUpperCase();
    patchPart(index, {
      drawingNumber: value,
      partId: keepsMaster ? current.partId : null,
      ...(!keepsMaster && current.partId
        ? {
            partNumber: "",
            itemCode: "",
            drawingRevisionNumber: "",
            drawingRevisionDate: "",
            productDescription: "",
            materialAndGrade: "",
            unitOfMeasurement: "Nos",
          }
        : {}),
    });
  };

  const resolveDrawingNumber = (index: number) => {
    const part = form.parts[index];
    const drawing = part.drawingNumber.trim();
    if (!drawing) return;
    if (!form.customerId) {
      setMessage({ type: "error", text: "Select Customer before entering Drawing Number." });
      return;
    }

    const existing = partOptions.find(
      (option) =>
        String(option.drawingNumber || "").trim().toUpperCase() === drawing.toUpperCase()
    );
    if (existing) {
      selectMasterPart(index, existing);
      return;
    }
  };

  const addPart = () => {
    changeField("parts", [
      ...form.parts,
      createBlankPart(),
    ]);
  };

  const removePart = async (index: number) => {
    if (form.parts.length === 1) {
      return;
    }

    const partLabel =
      form.parts[index]?.partNumber?.trim() ||
      form.parts[index]?.drawingNumber?.trim() ||
      `Part ${index + 1}`;
    const confirmed = await confirmDelete({
      title: "Delete enquiry part?",
      message: `${partLabel} and its entered details will be removed from this enquiry.`,
      confirmLabel: "Delete part",
    });
    if (!confirmed) return;

    setPendingDrawingFiles((current) => {
      const next: Record<number, File[]> = {};
      Object.entries(current).forEach(([partIndexText, files]) => {
        const partIndex = Number(partIndexText);
        if (partIndex !== index) next[partIndex > index ? partIndex - 1 : partIndex] = files;
      });
      return next;
    });

    changeField(
      "parts",
      form.parts.filter(
        (_, partIndex) =>
          partIndex !== index
      )
    );
  };

  const validate = (
    action: "DRAFT" | "SUBMIT"
  ) => {
    if (action === "DRAFT") {
      return true;
    }

    if (!form.customerId) {
      setMessage({
        type: "error",
        text: "Please select Customer Name.",
      });

      return false;
    }

    if (!form.enquiryMode) {
      setMessage({
        type: "error",
        text: "Please select Enquiry Mode.",
      });

      return false;
    }

    if (!form.orderType) {
      setMessage({
        type: "error",
        text: "Please select Order Type.",
      });

      return false;
    }

    for (
      let index = 0;
      index < form.parts.length;
      index += 1
    ) {
      const part = form.parts[index];

      if (!part.partNumber.trim()) {
        setMessage({
          type: "error",
          text: `Part No. / Item Code is required for Part ${
            index + 1
          }.`,
        });

        return false;
      }

      if (!part.drawingNumber.trim()) {
        setMessage({
          type: "error",
          text: `Drawing Number is required for Part ${
            index + 1
          }.`,
        });

        return false;
      }

      if (
        part.drawingRevisionNumber &&
        !/^[A-Za-z0-9]+$/.test(part.drawingRevisionNumber)
      ) {
        setMessage({
          type: "error",
          text: `Drawing Revision Number must be alphanumeric for Part ${index + 1}.`,
        });
        return false;
      }

      if (
        !part.productDescription.trim()
      ) {
        setMessage({
          type: "error",
          text: `Product Description is required for Part ${
            index + 1
          }.`,
        });

        return false;
      }

    }

    return true;
  };

  const buildPayload = (
    action: "DRAFT" | "SUBMIT"
  ) => ({
    customerId: form.customerId
      ? Number(form.customerId)
      : null,

    customerRepresentativeName:
      form.customerRepresentativeName.trim() || null,

    enquiryMode:
      form.enquiryMode || null,

    orderType:
      form.orderType || null,

    requiredDate:
      form.requiredDate || null,

    customerEnquiryReference:
      form.customerEnquiryReference.trim() || null,

    customerEnquiryDate:
      form.customerEnquiryDate || null,

    remarks:
      form.remarks.trim() || null,

    action,
    parts: form.parts.map(
      (part) => ({
        enquiryPartId:
          part.enquiry_part_id ?? null,

        partId:
          part.partId ?? null,

        partNumber:
          part.partNumber.trim(),

        itemCode:
          part.itemCode.trim() ||
          part.partNumber.trim() ||
          null,

        drawingNumber:
          part.drawingNumber.trim(),

        drawingRevisionNumber:
          part.drawingRevisionNumber.trim() ||
          null,

        drawingRevisionDate:
          part.drawingRevisionDate ||
          null,

        productDescription:
          part.productDescription.trim(),

        materialAndGrade:
          part.materialAndGrade.trim() || null,

        isAssembledPart:
          part.isAssembledPart,

        annualQuantity:
          part.annualQuantity
            ? Number(
                part.annualQuantity
              )
            : null,

        moq: part.moq
          ? Number(part.moq)
          : null,

        unitOfMeasurement:
          part.unitOfMeasurement.trim() ||
          "Nos",
      })
    ),
  });

  const save = async (
    action: "DRAFT" | "SUBMIT", stayOnPage = false
  ): Promise<boolean | void> => {
    if (uploadingDrawingPartId) {
      setMessage({ type: "error", text: "Wait for the drawing attachment to finish before saving the enquiry." });
      return;
    }

    if (!validate(action)) {
      return;
    }

    try {
      setSavingAction(action);
      setMessage(null);

      const payload =
        buildPayload(action);

      const response = enquiryId
        ? await marketingApi.update(
            enquiryId,
            payload
          )
        : await marketingApi.create(
            payload
          );

      const responseData =
        response?.data?.data ??
        response?.data ??
        {};

      const savedEnquiryId = Number(
        responseData.enquiry_id ??
          responseData.enquiryId ??
          enquiryId ??
          0
      );

      const responseParts =
        responseData.parts ??
        responseData.enquiryParts ??
        [];

      setForm((current) => ({
        ...current,
        parts: current.parts.map((part, index) => {
          const responsePart = responseParts[index] || {};
          const enquiryPartId = Number(responsePart.enquiry_part_id ?? responsePart.enquiryPartId ?? 0);
          return enquiryPartId ? { ...part, enquiry_part_id: enquiryPartId } : part;
        }),
      }));

      await uploadPendingDrawingAttachments(responseParts);

      const savedPartId = Number(
        responseParts?.[0]
          ?.enquiry_part_id ??
          responseParts?.[0]
            ?.enquiryPartId ??
          responseData.enquiry_part_id ??
          responseData.enquiryPartId ??
          firstEnquiryPartId ??
          0
      );

      setEnquiryStatus(
        (responseData.enquiry_status ??
          responseData.enquiryStatus ??
          (action === "SUBMIT"
            ? "IN_PROGRESS"
            : enquiryStatus)) as EnquiryStatus
      );
      setRecordSaveStatus(
        (responseData.save_status ??
          responseData.saveStatus ??
          (action === "SUBMIT" ? "SUBMITTED" : recordSaveStatus)) as "DRAFT" | "SUBMITTED"
      );
      // Saving can hydrate the form with server-generated part IDs and
      // attachment metadata. Acknowledge the form as it exists now, rather
      // than the pre-save snapshot, so that this internal update is not
      // treated as a user edit when moving to Feasibility.
      unsaved.markSaved();
      setDraftEditing(action === "DRAFT");

      showSuccess(
        response?.message ??
          response?.data?.message ??
          (action === "DRAFT"
            ? "Enquiry draft saved successfully."
            : "Enquiry submitted successfully.")
      );

      // A newly created draft must immediately move to its ID-based route.
      // This makes every later draft save use PUT /:enquiryId instead of
      // creating another enquiry and consuming another document number.
      if (action === "DRAFT" && !enquiryId && savedEnquiryId > 0) {
        navigate(`/marketing/enquiries/${savedEnquiryId}?mode=edit`, {
          replace: true,
        });
      }

      if (stayOnPage) return true;
      if (action === "DRAFT") {
        // Keep the draft open after saving so the user can continue editing it.
        return;
      }

      if (
        action === "SUBMIT" &&
        savedPartId > 0
      ) {
        navigate(
          `/marketing/enquiry-parts/${savedPartId}/feasibility`
        );

        return;
      }

      if (
        !enquiryId &&
        savedEnquiryId > 0
      ) {
        navigate(
          `/marketing/enquiries/${savedEnquiryId}`,
          {
            replace: true,
          }
        );
      }
    } catch (error) {
      setMessage({
        type: "error",
        text: apiMessage(error),
      });
    } finally {
      setSavingAction(null);
    }
  };

  const formLocked = savingAction !== null || (Boolean(enquiryId) && !draftEditing);

  const openRevisionHistory = async () => {
    if (!enquiryId) {
      return;
    }

    setRevisionHistoryOpen(true);
    setRevisionHistoryLoading(true);
    setRevisionHistoryError("");

    try {
      const response =
        await marketingApi.getEnquiryRevisions(enquiryId);

      setRevisionHistory(
        Array.isArray(response?.data)
          ? response.data
          : []
      );
    } catch (error) {
      setRevisionHistoryError(apiMessage(error));
    } finally {
      setRevisionHistoryLoading(false);
    }
  };

  const changeToOrderReceived = async () => {
    if (!enquiryId || enquiryStatus !== "QUOTED") {
      return;
    }

    try {
      setStatusUpdating(true);
      setMessage(null);

      const response =
        await marketingApi.changeEnquiryStatus(
          enquiryId,
          "ORDER_RECEIVED"
        );

      const responseData =
        response?.data?.data ??
        response?.data ??
        {};

      setEnquiryStatus(
        (responseData.enquiry_status ??
          responseData.enquiryStatus ??
          "ORDER_RECEIVED") as EnquiryStatus
      );

      setMessage({
        type: "success",
        text:
          response?.message ??
          "Enquiry status changed to Order Received.",
      });
    } catch (error) {
      setMessage({
        type: "error",
        text: apiMessage(error),
      });
    } finally {
      setStatusUpdating(false);
    }
  };

  return (
    <div className="enquiry-page">
      <header className="enquiry-page-header">
        <div className="enquiry-heading-left">
          <button
            type="button"
            className="enquiry-back-button"
            aria-label="Go back"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft size={18} />
          </button>

          <div>
            <p className="enquiry-page-eyebrow">
              MARKETING / ENQUIRY
            </p>

            <h1>
              {enquiryId
                ? "Edit Enquiry"
                : "New Enquiry"}
            </h1>
          </div>
        </div>

        <div className="enquiry-header-actions">
          {Boolean(enquiryId) && (
            <button
              type="button"
              className="enquiry-revision-history-button"
              disabled={loading}
              onClick={() => void openRevisionHistory()}
            >
              <History size={16} />
              Revision History
            </button>
          )}

          {Boolean(enquiryId) && !draftEditing && canEditAllStages ? (
            <button
              type="button"
              className="enquiry-submit-button"
              disabled={loading}
              onClick={() => setDraftEditing(true)}
            >
              <Pencil size={16} />
              {recordSaveStatus === "SUBMITTED" ? "Edit Enquiry" : "Edit Draft"}
            </button>
          ) : draftEditing ? (
            <>
              {Boolean(enquiryId) && (
                <button
                  type="button"
                  className="enquiry-save-draft-button"
                  disabled={savingAction !== null}
                  onClick={() => window.location.reload()}
                >
                  <X size={16} />
                  Cancel Edit
                </button>
              )}
              <button
                type="button"
                className="enquiry-save-draft-button"
                disabled={loading || savingAction !== null}
                onClick={() => save("DRAFT")}
              >
                <Save size={16} />
                {savingAction === "DRAFT"
                  ? "Saving..."
                  : recordSaveStatus === "SUBMITTED"
                    ? "Save Changes"
                    : "Save Draft"}
              </button>
              {recordSaveStatus === "DRAFT" && (
                <button
                  type="button"
                  className="enquiry-submit-button"
                  disabled={loading || savingAction !== null}
                  onClick={() => save("SUBMIT")}
                >
                  <Send size={16} />
                  {savingAction === "SUBMIT"
                    ? "Submitting..."
                    : "Submit & Continue"}
                </button>
              )}
            </>
          ) : null}

          <button
            type="button"
            className="enquiry-close-button"
            aria-label="Close enquiry"
            title="Close enquiry"
            disabled={loading || savingAction !== null}
            onClick={() =>
              unsaved.requestLeave(() => navigate("/marketing/enquiries"))
            }
          >
            <X size={18} />
          </button>
        </div>
      </header>

      {message && (
        <Alert
          type={message.type}
          message={message.text}
        />
      )}

      <StageTabs
        active="Enquiry"
        enquiryId={
          enquiryId || undefined
        }
        partId={firstEnquiryPartId}
      />

      <section className="enquiry-form-card">
        <div className="enquiry-section-header">
          <div>
            <h2>Enquiry Details</h2>
            <p>
              Customer and commercial
              requirement details
            </p>
          </div>
        </div>

        <div className="enquiry-form-grid">
          <label className="enquiry-field">
            <span>Enquiry No.</span>

            <input
              type="text"
              value={
                enquiryId
                  ? String(enquiryId)
                  : "Auto Generated"
              }
              disabled
            />
          </label>

          <label className="enquiry-field">
            <span>Customer Name *</span>

            <select
              value={form.customerId}
              disabled={loading || formLocked}
              onChange={(event) => changeCustomer(event.target.value)}
            >
              <option value="">Select customer</option>
              {customers.map((customer) => {
                const idValue = customer.customerId ?? customer.customer_id ?? customer.id;
                const name = customer.customerName ?? customer.customer_name ?? "";
                if (!idValue) return null;
                return <option key={idValue} value={idValue}>{name}</option>;
              })}
            </select>
          </label>

          <label className="enquiry-field">
            <span>Customer Representative Name</span>

            <input
              type="text"
              maxLength={150}
              value={form.customerRepresentativeName}
              disabled={loading || formLocked}
              onChange={(event) =>
                changeField(
                  "customerRepresentativeName",
                  event.target.value
                )
              }
            />
          </label>

          <label className="enquiry-field">
            <span>Enquiry Mode *</span>

            <select
              value={form.enquiryMode}
              disabled={loading || formLocked}
              onChange={(event) =>
                changeField(
                  "enquiryMode",
                  event.target.value
                )
              }
            >
              <option value="">
                Select mode
              </option>
              {referenceData.options("ENQUIRY_MODE").map((option) =>
                <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>

          <label className="enquiry-field">
            <span>Order Type *</span>

            <select
              value={form.orderType}
              disabled={loading || formLocked}
              onChange={(event) =>
                changeField(
                  "orderType",
                  event.target.value
                )
              }
            >
              <option value="">
                Select order type
              </option>
              {referenceData.options("ORDER_TYPE").map((option) =>
                <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>

          <label className="enquiry-field">
            <span>Required Date</span>

            <DateInput
              type="date"
              value={form.requiredDate}
              min={today()}
              disabled={loading || formLocked}
              onChange={(event) =>
                changeField(
                  "requiredDate",
                  event.target.value
                )
              }
            />
          </label>

          <label className="enquiry-field">
            <span>Enquiry Status</span>

            {enquiryStatus === "QUOTED" ? (
              <select
                value={enquiryStatus}
                disabled={loading || statusUpdating}
                onChange={(event) => {
                  if (event.target.value === "ORDER_RECEIVED") {
                    void changeToOrderReceived();
                  }
                }}
              >
                {referenceData.options("ENQUIRY_STATUS_TRANSITION").map((option) =>
                  <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            ) : (
              <input
                type="text"
                value={enquiryStatusLabel(enquiryStatus)}
                disabled
              />
            )}
          </label>

          <label className="enquiry-field">
            <span>Customer Enquiry / Request No.</span>

            <input
              type="text"
              maxLength={100}
              value={form.customerEnquiryReference}
              disabled={loading || formLocked}
              onChange={(event) =>
                changeField(
                  "customerEnquiryReference",
                  event.target.value
                )
              }
            />
          </label>

          <label className="enquiry-field">
            <span>Customer Enquiry / Request Date</span>

            <DateInput
              type="date"
              value={form.customerEnquiryDate}
              max={today()}
              disabled={loading || formLocked}
              onChange={(event) =>
                changeField(
                  "customerEnquiryDate",
                  event.target.value
                )
              }
            />
          </label>

          <label className="enquiry-field">
            <span>Remarks</span>

            <textarea
              rows={2}
              value={form.remarks}
              disabled={loading || formLocked}
              onChange={(event) =>
                changeField(
                  "remarks",
                  event.target.value
                )
              }
            />
          </label>
        </div>

        <div className="enquiry-section-divider" />

        <div className="enquiry-section-header enquiry-parts-header">
          <div>
            <h2>Enquiry Parts</h2>
            <p>
              Product, drawing and quantity
              details
            </p>
          </div>

          <button
            type="button"
            className="enquiry-add-part-button"
            disabled={
              loading ||
              formLocked ||
              recordSaveStatus === "SUBMITTED" ||
              savingAction !== null
            }
            onClick={addPart}
          >
            <Plus size={15} />
            Add Part
          </button>
        </div>

        <div className="enquiry-parts-list">
          {form.parts.map(
            (part, index) => (
              <article
                className="enquiry-part-card"
                key={
                  part.enquiry_part_id ??
                  index
                }
              >
                <div className="enquiry-part-title-row">
                  <h3>
                    Part {index + 1}
                  </h3>

                  <button
                    type="button"
                    className="enquiry-delete-part-button"
                    aria-label={`Remove Part ${
                      index + 1
                    }`}
                    disabled={
                      form.parts.length ===
                        1 ||
                      loading ||
                      formLocked ||
                      recordSaveStatus === "SUBMITTED" ||
                      savingAction !== null
                    }
                    onClick={() =>
                      removePart(index)
                    }
                  >
                    <Trash2 size={15} />
                  </button>
                </div>

                <div className="enquiry-form-grid">
                  <label className="enquiry-field">
                    <span>
                      Part No. / Item Code *
                    </span>

                    <input
                      type="text"
                      value={
                        part.partNumber
                      }
                      disabled={loading || formLocked || Boolean(part.partId)}
                      onChange={(event) =>
                        changePart(
                          index,
                          "partNumber",
                          event.target.value
                        )
                      }
                    />
                  </label>

                  <div className="enquiry-field enquiry-span-3">
                    <span>
                      Drawing Number *
                    </span>

                    <div className="enquiry-drawing-input-row">
                      <input
                        type="text"
                        list={`drawing-options-${index}`}
                        value={
                          part.drawingNumber
                        }
                        disabled={loading || formLocked || partsLoading}
                        onChange={(event) =>
                          changeDrawingNumber(index, event.target.value)
                        }
                        onBlur={() => resolveDrawingNumber(index)}
                      />
                      {!formLocked && <label className={`enquiry-attach-drawing-button ${uploadingDrawingPartId === part.enquiry_part_id || savingAction !== null ? "disabled" : ""}`} title={part.enquiry_part_id ? "Attach one or more drawings" : "Select drawings to attach when the enquiry is saved"}>
                        <Paperclip size={14}/><span>{uploadingDrawingPartId === part.enquiry_part_id ? "Attaching..." : "Attach drawings"}</span>
                        <input type="file" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.dwg,.dxf,.step,.stp" disabled={uploadingDrawingPartId === part.enquiry_part_id || savingAction !== null} onChange={(event) => { const files = Array.from(event.target.files || []); event.currentTarget.value = ""; selectDrawingAttachments(index, files); }}/>
                      </label>}
                      {!!pendingDrawingFiles[index]?.length && <div className="enquiry-pending-drawing">{pendingDrawingFiles[index].map((file) => <div key={`${file.name}-${file.lastModified}-${file.size}`}><Paperclip size={12}/><span title={file.name}>{file.name}</span><small>Will attach on save</small><button type="button" aria-label={`Remove ${file.name}`} onClick={() => setPendingDrawingFiles((current) => { const remaining = (current[index] || []).filter((pendingFile) => pendingFile !== file); const next = { ...current }; if (remaining.length) next[index] = remaining; else delete next[index]; return next; })}><X size={12}/></button></div>)}</div>}
                      {!!part.drawingAttachments?.length && <div className="enquiry-drawing-attachments">
                        {part.drawingAttachments.map((attachment) => <div key={attachment.attachmentId}>
                          <a href={attachmentFileUrl(attachment.fileUrl)} target="_blank" rel="noreferrer" title={attachment.fileName}><ExternalLink size={13}/><span>{attachment.fileName}</span></a>
                          {!formLocked && <button type="button" aria-label={`Remove ${attachment.fileName}`} disabled={uploadingDrawingPartId === part.enquiry_part_id} onClick={() => void removeDrawingAttachment(index, attachment)}><X size={14}/></button>}
                        </div>)}
                      </div>}
                    </div>
                    <datalist id={`drawing-options-${index}`}>
                      {partOptions.map((option) => (
                        <option
                          key={option.partId}
                          value={option.drawingNumber}
                        >
                          {option.partNumber} - {option.partName}
                          {option.customerCode ? ` - ${option.customerCode}` : ""}
                        </option>
                      ))}
                    </datalist>
                    <small className={`enquiry-drawing-status ${part.partId ? "existing" : ""}`}>
                      {part.partId
                        ? `Part Master linked · ID ${part.partId}`
                        : "Not linked to Part Master."}
                    </small>
                    {!part.partId && <div className="enquiry-part-master-action">
                      <button type="button" disabled title="Part Master creation is disabled at the Enquiry stage."><Plus size={13}/>Add Part to Part Master</button>
                      <small>Create it separately from Masters after this stage.</small>
                    </div>}
                  </div>

                  <label className="enquiry-field enquiry-part-product-field">
                    <span>
                      Product Name or
                      Description *
                    </span>

                    <input
                      type="text"
                      value={
                        part.productDescription
                      }
                      disabled={loading || formLocked || Boolean(part.partId)}
                      onChange={(event) =>
                        changePart(
                          index,
                          "productDescription",
                          event.target.value
                        )
                      }
                    />
                  </label>

                  <label className="enquiry-field">
                    <span>
                      Drawing Revision No.
                    </span>

                    <input
                      type="text"
                      value={
                        part.drawingRevisionNumber
                      }
                      disabled={loading || formLocked || Boolean(part.partId)}
                      pattern="[A-Za-z0-9]*"
                      onChange={(event) =>
                        changePart(
                          index,
                          "drawingRevisionNumber",
                          event.target.value
                        )
                      }
                    />
                  </label>

                  <label className="enquiry-field">
                    <span>
                      Drawing Revision Date
                    </span>

                    <DateInput
                      type="date"
                      value={
                        part.drawingRevisionDate
                      }
                      max={today()}
                      disabled={loading || formLocked || Boolean(part.partId)}
                      onChange={(event) =>
                        changePart(
                          index,
                          "drawingRevisionDate",
                          event.target.value
                        )
                      }
                    />
                  </label>

                  <label className="enquiry-field">
                    <span>Annual Qty</span>

                    <input
                      type="number"
                      min="0"
                      value={
                        part.annualQuantity
                      }
                      disabled={loading || formLocked}
                      onChange={(event) =>
                        changePart(
                          index,
                          "annualQuantity",
                          event.target.value
                        )
                      }
                    />
                  </label>

                  <label className="enquiry-field">
                    <span>MOQ</span>

                    <input
                      type="number"
                      min="0"
                      value={part.moq}
                      disabled={loading || formLocked}
                      onChange={(event) =>
                        changePart(
                          index,
                          "moq",
                          event.target.value
                        )
                      }
                    />
                  </label>

                  <label className="enquiry-field">
                    <span>UOM</span>

                    <input
                      type="text"
                      value={
                        part.unitOfMeasurement
                      }
                      disabled={loading || formLocked}
                      onChange={(event) =>
                        changePart(
                          index,
                          "unitOfMeasurement",
                          event.target.value
                        )
                      }
                    />
                  </label>

                  <label className="enquiry-assembled-field">
                    <input
                      type="checkbox"
                      checked={part.isAssembledPart}
                      disabled={loading || formLocked}
                      onChange={(event) =>
                        changePart(
                          index,
                          "isAssembledPart",
                          event.target.checked
                        )
                      }
                    />
                    <span>Is it Assembled Part</span>
                  </label>

                </div>
              </article>
            )
          )}
        </div>
      </section>

      {revisionHistoryOpen && (
        <div
          className="enquiry-revision-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setRevisionHistoryOpen(false);
            }
          }}
        >
          <section
            className="enquiry-revision-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="enquiry-revision-history-title"
          >
            <header>
              <div>
                <h2 id="enquiry-revision-history-title">
                  Revision History
                </h2>
                <p>
                  Backend-generated enquiry revision number and date.
                </p>
              </div>

              <button
                type="button"
                aria-label="Close revision history"
                onClick={() => setRevisionHistoryOpen(false)}
              >
                <X size={18} />
              </button>
            </header>

            <div className="enquiry-revision-modal-body">
              {revisionHistoryLoading && (
                <div className="enquiry-revision-empty">
                  Loading revision history...
                </div>
              )}

              {!revisionHistoryLoading &&
                revisionHistoryError && (
                  <div className="enquiry-revision-error">
                    {revisionHistoryError}
                  </div>
                )}

              {!revisionHistoryLoading &&
                !revisionHistoryError &&
                revisionHistory.length === 0 && (
                  <div className="enquiry-revision-empty">
                    No revision history is available.
                  </div>
                )}

              {!revisionHistoryLoading &&
                !revisionHistoryError &&
                revisionHistory.length > 0 && (
                  <div className="enquiry-revision-table-wrap">
                    <table className="enquiry-revision-table">
                      <thead>
                        <tr>
                          <th>Revision</th>
                          <th>Date</th>
                          <th>Action</th>
                          <th>Status</th>
                          <th>Updated By</th>
                        </tr>
                      </thead>
                      <tbody>
                        {revisionHistory.map((revision) => (
                          <tr key={revision.enquiryRevisionId}>
                            <td>
                              <strong>
                                {revision.revisionNumber}
                              </strong>
                            </td>
                            <td>{revision.revisionDate}</td>
                            <td>{String(revision.revisionAction || "-").split("_").join(" ")}</td>
                            <td>{revision.saveStatus}</td>
                            <td>{revision.createdBy || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
            </div>
          </section>
        </div>
      )}

    </div>
  );
}
