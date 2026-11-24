import DateInput from "../../../components/DateInput";
import { useUnsavedChanges } from "../../../components/UnsavedChanges";
import "./WorkoutPage.css";

import { Fragment, useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Save, Send, Trash2, X } from "lucide-react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { marketingApi } from "../../../api/marketing.api";
import { apiMessage } from "../../../api/client";
import PageHeader from "../../../components/PageHeader";
import StageTabs, { type MarketingStage } from "../../../components/StageTabs";
import Alert from "../../../components/Alert";
import { useAppFeedback } from "../../../components/AppFeedback";
import { useReferenceData } from "../../../hooks/useReferenceData";
import { useAuth } from "../../../context/AuthContext";
import { hasPermission, Permissions } from "../../../utils/permissions";
import { todayInAppTimeZone } from "../../../utils/formatDateTime";

type ProcessLine = {
  processType: string;
  description: string;
  costInr: number | string;
  totalCycleTimeSeconds?: number | string;
  machineCostInr?: number | string;
};
type SubpartProcessColumn = { processType: string };
type SubPartLine = {
  partName: string;
  partDrawingNumber: string;
  materialType: string;
  materialAndGrade: string;
  materialPricePerKg: number | string;
  rmWeightKg: number | string;
  materialCostInr: number | string;
  patternCostInr: number | string;
  fixtureCostInr: number | string;
  specialToolCostInr: number | string;
  gaugeCostInr: number | string;
  trialCostInr: number | string;
  processCosts: ProcessLine[];
};

const SUBPART_MACHINE_COST = "MACHINE_PROCESS_COST";
const CUSTOM_SUBPART_PROCESS_PREFIX = "CUSTOM_";
const MACHINE_RATE_PROCESS_TYPES = new Set(["VMC", "HMC", "TURNING"]);
const isCustomSubpartProcess = (processType: string) => processType.startsWith(CUSTOM_SUBPART_PROCESS_PREFIX);
const isPurchasedSubpart = (materialType: string) => String(materialType || "").toUpperCase() === "PURCHASE";
const normalizedProcessType = (value: unknown) => String(value || "").trim().toUpperCase();
const usesMachineRateCalculation = (processType: unknown) =>
  MACHINE_RATE_PROCESS_TYPES.has(normalizedProcessType(processType));
const subpartUsesMachineRateCalculation = (
  machiningProcesses: any[],
  processType: unknown,
  description: unknown
) => {
  if (usesMachineRateCalculation(processType)) return true;
  const processName = normalizedProcessType(description);
  const matchedProcess = machiningProcesses.find((process: any) =>
    normalizedProcessType(process.value) === processName ||
    normalizedProcessType(process.label) === processName
  );
  return usesMachineRateCalculation(matchedProcess?.value);
};

const today = todayInAppTimeZone;
const initialForm = {
  workoutDate: today(), processPlanId:"", currencyCode: "EUR", currencyRate: "", exchangeRateEffectiveDate: "",
  moq: "", weightKg: "", materialRatePerKg: "", additionalMaterialCostInr: "", actualMaterialCostInr: "",
  assemblyLabourCostInr: "",
  overheadPercent: "", profitCalculationType: "FIXED_AMOUNT", profitValue: "",
  packingForwardingCostInr: "", commissionPercent: "",
  patternCostInr: "", fixtureCostInr: "", specialToolCostInr: "",
  gaugeCostInr: "", trialCostInr: "", sampleCostPercent: "", sampleCostInr: "", paymentTerms: "", developmentTime: "",
  pilotBatchDelivery: "", notesText: "",
  processCosts: [] as ProcessLine[], save_status: "DRAFT",
  subparts: [] as SubPartLine[],
};

const num = (value: unknown) => Number(value || 0);
const blankZero = (value: number | string | null | undefined) => num(value) === 0 ? "" : value ?? "";
const money = (value: number) => Number(value.toFixed(2));
const converted = (value: number, exchangeRate: number) => exchangeRate > 0 ? Number((value / exchangeRate).toFixed(4)) : 0;
const hasEnteredNumber = (value: unknown) => String(value ?? "").trim() !== "";
const configuredMachineCostForProcess = (machiningProcesses: any[], ...values: unknown[]) => {
  const processKeys = values
    .map((value) => String(value || "").trim().toUpperCase())
    .filter(Boolean);
  const process = machiningProcesses.find((item: any) =>
    processKeys.includes(String(item.value || "").trim().toUpperCase()) ||
    processKeys.includes(String(item.label || "").trim().toUpperCase())
  );
  return process && hasEnteredNumber(process.machineCostInr)
    ? num(process.machineCostInr)
    : null;
};
const calculatedMachineProcessCost = (cycleTimeSeconds: unknown, machineCostInr: number | string | null) => (
  !hasEnteredNumber(cycleTimeSeconds) || !hasEnteredNumber(machineCostInr)
    ? ""
    : money(num(cycleTimeSeconds) * num(machineCostInr) / 3600)
);
const calculatedSubpartMaterialCost = (line: SubPartLine) => isPurchasedSubpart(line.materialType)
  ? money(num(line.materialPricePerKg) * num(line.rmWeightKg))
  : money(num(line.materialCostInr));
const emptySubpart = (): SubPartLine => ({
  partName: "",
  partDrawingNumber: "",
  materialType: "",
  materialAndGrade: "",
  materialPricePerKg: "",
  rmWeightKg: "",
  materialCostInr: "",
  patternCostInr: "",
  fixtureCostInr: "",
  specialToolCostInr: "",
  gaugeCostInr: "",
  trialCostInr: "",
  processCosts: [],
});

function Amount({ value, currency = "INR" }: { value: number; currency?: string }) {
  return <output>{currency} {value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</output>;
}

export default function WorkoutPage() {
  const referenceData = useReferenceData(["PROFIT_CALCULATION_TYPE"]);
  const partId = Number(useParams().partId);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { confirmAction, confirmDelete, showSuccess } = useAppFeedback();
  const canEditAllStages = hasPermission(
    user,
    Permissions.editEnquiryAllStages
  );
  const editRequested =
    searchParams.get("mode") === "edit" && canEditAllStages;
  const viewRequested = searchParams.get("mode") === "view";
  const modeSuffix = editRequested
    ? "?mode=edit"
    : searchParams.get("mode") === "view"
      ? "?mode=view"
      : "";
  const [part, setPart] = useState<any>();
  const [items, setItems] = useState<any[]>([]);
  const [processPlans, setProcessPlans] = useState<any[]>([]);
  const [masters, setMasters] = useState<any>({ currencies: [], machiningProcesses: [], subpartMaterialTypes: [] });
  const [workflow, setWorkflow] = useState<any>();
  const [form, setForm] = useState<any>(initialForm);
  const [subpartProcessColumns, setSubpartProcessColumns] = useState<SubpartProcessColumn[]>([{ processType: SUBPART_MACHINE_COST }]);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string }>();
  const [saving, setSaving] = useState<"DRAFT" | "COMPLETE" | null>(null);
  const [hasSavedWorkout, setHasSavedWorkout] = useState(false);
  const [draftEditing, setDraftEditing] = useState(true);
  const isAssembled = Boolean(Number(part?.is_assembled_part ?? part?.isAssembledPart ?? 0));

  const unsaved = useUnsavedChanges({form,subpartProcessColumns}, workflow?.allowedActions?.includes("SAVE_DRAFT") ? async () => (await save(false, true)) === true : undefined);

  useEffect(() => {
    let active = true;
    setMessage(undefined);
    marketingApi.getWorkout(partId).then((response) => {
      if (!active) return;
      const data = response.data;
      setPart(data.part); setItems(data.items || []); setProcessPlans(data.processPlans || []); setMasters(data.masters || {}); setWorkflow(data.workflow);
      const workout = data.workout;
      setHasSavedWorkout(Boolean(workout));
      setDraftEditing(editRequested || (!workout && !viewRequested));
      const defaultCurrency = (data.masters?.currencies || []).find((item: any) => item.value === "EUR") || data.masters?.currencies?.[0];
      if (!workout) {
        setSubpartProcessColumns([{ processType: SUBPART_MACHINE_COST }]);
        setForm({
          ...initialForm,
          processPlanId:String((data.processPlans || []).find((plan:any) => plan.isDefault === "Y")?.processPlanId || data.processPlans?.[0]?.processPlanId || ""),
          currencyCode: defaultCurrency?.value || "EUR",
          currencyRate: defaultCurrency?.exchangeRate || 1,
          exchangeRateEffectiveDate: defaultCurrency?.effectiveDate || "",
          moq: blankZero(data.part.moq),
          paymentTerms: data.part.feasibility_payment_terms || "",
          processCosts: (data.masters?.machiningProcesses || []).filter((item: any) => item.value !== "OTHER").map((item: any) => ({
            processType: item.value,
            description: "",
            totalCycleTimeSeconds: "",
            machineCostInr: usesMachineRateCalculation(item.value)
              ? configuredMachineCostForProcess(data.masters?.machiningProcesses || [], item.value, item.label) ?? ""
              : "",
            costInr: "",
          })),
        });
        return;
      }
      const processLabels = new Map<string, string>((data.masters?.machiningProcesses || []).map((process: any) => [process.value, process.label]));
      const loadedCustomProcessTypes = new Set<string>();
      const loadedSubparts = (workout.subparts || []).map((line: any) => {
        const storedProcessCosts: ProcessLine[] = line.processCosts || [];
        const purchasedSubpart = isPurchasedSubpart(line.materialType);
        const customProcesses = purchasedSubpart ? [] : storedProcessCosts.filter((process) => isCustomSubpartProcess(process.processType));
        customProcesses.forEach((process) => loadedCustomProcessTypes.add(process.processType));
        const genericProcesses = purchasedSubpart ? [] : storedProcessCosts.filter((process) => !isCustomSubpartProcess(process.processType));
        const genericMachiningCost = money(genericProcesses.reduce((sum, process) => sum + num(process.costInr), 0));
        const genericProcessName = genericProcesses
          .map((process) => process.description || processLabels.get(process.processType) || (process.processType === SUBPART_MACHINE_COST ? "" : process.processType))
          .filter(Boolean)
          .join(", ");
        const genericProcess = genericProcesses.length === 1 ? genericProcesses[0] : undefined;
        return {
          partName: line.partName || "",
          partDrawingNumber: line.partDrawingNumber || "",
          materialType: line.materialType || "",
          materialAndGrade: line.materialAndGrade || "",
          materialPricePerKg: blankZero(line.materialPricePerKg),
          rmWeightKg: blankZero(line.rmWeightKg),
          materialCostInr: blankZero(line.materialCostInr ?? money(num(line.materialPricePerKg) * num(line.rmWeightKg))),
          patternCostInr: purchasedSubpart ? "" : blankZero(line.patternCostInr),
          fixtureCostInr: purchasedSubpart ? "" : blankZero(line.fixtureCostInr),
          specialToolCostInr: purchasedSubpart ? "" : blankZero(line.specialToolCostInr),
          gaugeCostInr: purchasedSubpart ? "" : blankZero(line.gaugeCostInr),
          trialCostInr: purchasedSubpart ? "" : blankZero(line.trialCostInr),
          processCosts: [
            ...(genericProcesses.length ? [{
              processType: SUBPART_MACHINE_COST,
              description: genericProcessName,
              totalCycleTimeSeconds: subpartUsesMachineRateCalculation(data.masters?.machiningProcesses || [], genericProcess?.processType, genericProcessName)
                ? blankZero(genericProcess?.totalCycleTimeSeconds)
                : "",
              machineCostInr: subpartUsesMachineRateCalculation(data.masters?.machiningProcesses || [], genericProcess?.processType, genericProcessName)
                ? genericProcess?.machineCostInr ?? configuredMachineCostForProcess(data.masters?.machiningProcesses || [], genericProcess?.description, genericProcess?.processType) ?? ""
                : "",
              costInr: blankZero(genericMachiningCost),
            }] : []),
            ...customProcesses.map((process) => ({
              ...process,
              totalCycleTimeSeconds: subpartUsesMachineRateCalculation(data.masters?.machiningProcesses || [], process.processType, process.description)
                ? blankZero(process.totalCycleTimeSeconds)
                : "",
              machineCostInr: subpartUsesMachineRateCalculation(data.masters?.machiningProcesses || [], process.processType, process.description)
                ? process.machineCostInr ?? configuredMachineCostForProcess(data.masters?.machiningProcesses || [], process.description, process.processType) ?? ""
                : "",
              costInr: blankZero(process.costInr),
            })),
          ],
        };
      });
      setSubpartProcessColumns([
        { processType: SUBPART_MACHINE_COST },
        ...Array.from(loadedCustomProcessTypes, (processType) => ({ processType })),
      ]);
      setForm({
        workoutDate: workout.workout_date || today(), processPlanId:String(workout.process_plan_id || ""), currencyCode: workout.currency_code,
        currencyRate: workout.currency_rate, exchangeRateEffectiveDate: workout.exchange_rate_effective_date || "",
        moq: blankZero(workout.moq), weightKg: blankZero(workout.weight_kg),
        materialRatePerKg: blankZero(workout.material_rate_per_kg), additionalMaterialCostInr: blankZero(workout.additional_material_cost_inr), actualMaterialCostInr: blankZero(workout.actual_material_cost_inr),
        assemblyLabourCostInr: blankZero(workout.assembly_labour_cost_inr),
        overheadPercent: blankZero(workout.overhead_profit_percent),
        profitCalculationType: workout.profit_calculation_type || "FIXED_AMOUNT", profitValue: blankZero(workout.profit_value),
        packingForwardingCostInr: blankZero(workout.packing_forwarding_cost_inr), commissionPercent: blankZero(workout.commission_percent),
        patternCostInr: blankZero(workout.pattern_cost_inr), fixtureCostInr: blankZero(workout.fixture_cost_inr),
        specialToolCostInr: blankZero(workout.special_tool_cost_inr), gaugeCostInr: blankZero(workout.gauge_cost_inr),
        trialCostInr: blankZero(workout.trial_cost_inr), sampleCostPercent: blankZero(workout.sample_cost_percent), sampleCostInr: blankZero(workout.sample_cost_inr), paymentTerms: data.part.feasibility_payment_terms || workout.payment_terms || "",
        developmentTime: workout.development_time || "", pilotBatchDelivery: workout.pilot_batch_delivery || "",
        notesText: (workout.notes || []).map((note: any) => note.noteText).join("\n"),
        processCosts: (workout.processCosts || []).map((process: ProcessLine) => ({
          ...process,
          totalCycleTimeSeconds: usesMachineRateCalculation(process.processType)
            ? blankZero(process.totalCycleTimeSeconds)
            : "",
          machineCostInr: usesMachineRateCalculation(process.processType)
            ? process.machineCostInr ?? configuredMachineCostForProcess(data.masters?.machiningProcesses || [], process.processType, process.description) ?? ""
            : "",
          costInr: blankZero(process.costInr),
        })), save_status: workout.save_status,
        subparts: loadedSubparts,
      });
    }).catch((error) => setMessage({ type: "error", text: apiMessage(error) }));
    return () => { active = false; };
  }, [partId, editRequested, viewRequested]);

  const totals = useMemo(() => {
    const exchangeRate = num(form.currencyRate);
    const subpartMaterialCost = money((form.subparts || []).reduce(
      (sum: number, line: SubPartLine) => sum + calculatedSubpartMaterialCost(line),
      0
    ));
    const subpartMachiningCost = money((form.subparts || []).reduce(
      (sum: number, line: SubPartLine) => sum + (line.processCosts || []).reduce(
        (processSum: number, process: ProcessLine) => processSum + num(process.costInr),
        0
      ),
      0
    ));
    const subpartDevelopmentCost = money((form.subparts || []).reduce(
      (sum: number, line: SubPartLine) => sum + [
        "patternCostInr",
        "fixtureCostInr",
        "specialToolCostInr",
        "gaugeCostInr",
        "trialCostInr",
      ].reduce((lineSum, key) => lineSum + num((line as any)[key]), 0),
      0
    ));
    const subpartDevelopmentBreakdown = {
      pattern: money((form.subparts || []).reduce((sum: number, line: SubPartLine) => sum + num(line.patternCostInr), 0)),
      fixture: money((form.subparts || []).reduce((sum: number, line: SubPartLine) => sum + num(line.fixtureCostInr), 0)),
      specialTool: money((form.subparts || []).reduce((sum: number, line: SubPartLine) => sum + num(line.specialToolCostInr), 0)),
      gauge: money((form.subparts || []).reduce((sum: number, line: SubPartLine) => sum + num(line.gaugeCostInr), 0)),
      trial: money((form.subparts || []).reduce((sum: number, line: SubPartLine) => sum + num(line.trialCostInr), 0)),
    };
    const calculatedMaterialCost = money(
      num(form.weightKg) * num(form.materialRatePerKg) + num(form.additionalMaterialCostInr)
    );
    // A blank editable cost continues to use the rate-and-weight calculation.
    // Once a cost is entered, it is the quoted material cost and must flow through
    // every downstream price total.
    const materialCost = isAssembled
      ? subpartMaterialCost
      : hasEnteredNumber(form.actualMaterialCostInr)
        ? money(num(form.actualMaterialCostInr))
        : calculatedMaterialCost;
    const mainMachiningTotal = money((form.processCosts || []).reduce((sum: number, line: ProcessLine) => sum + num(line.costInr), 0));
    const machiningTotal = isAssembled
      ? money(subpartMachiningCost + num(form.assemblyLabourCostInr))
      : mainMachiningTotal;
    const overheadAmount = money(machiningTotal * num(form.overheadPercent) / 100);
    const withOverhead = machiningTotal + overheadAmount;
    const profitAmount = money(form.profitCalculationType === "PERCENTAGE" ? withOverhead * num(form.profitValue) / 100 : num(form.profitValue));
    const adjustedMachining = money(withOverhead + profitAmount);
    const partPrice = money(materialCost + adjustedMachining + num(form.packingForwardingCostInr));
    const commissionAmount = money(partPrice * num(form.commissionPercent) / 100);
    const finalPartPrice = money(partPrice + commissionAmount);
    const sampleCostInr = money(finalPartPrice * (1 + num(form.sampleCostPercent) / 100));
    const developmentTotal = isAssembled
      ? subpartDevelopmentCost
      : money(["patternCostInr", "fixtureCostInr", "specialToolCostInr", "gaugeCostInr", "trialCostInr"].reduce((sum, key) => sum + num(form[key]), 0));
    return {
      exchangeRate,
      materialCost,
      machiningTotal,
      overheadAmount,
      profitAmount,
      adjustedMachining,
      partPrice,
      commissionAmount,
      finalPartPrice,
      sampleCostInr,
      developmentTotal,
      calculatedMaterialCost,
      subpartMaterialCost,
      subpartMachiningCost,
      subpartDevelopmentCost,
      subpartDevelopmentBreakdown,
    };
  }, [form, isAssembled]);

  const set = (key: string, value: any) => setForm((current: any) => ({ ...current, [key]: value }));
  const updateProcess = (index: number, key: keyof ProcessLine, value: any) => setForm((current: any) => ({
    ...current,
    processCosts: current.processCosts.map((line: ProcessLine, lineIndex: number) => lineIndex === index ? { ...line, [key]: value } : line),
  }));
  const updateMainProcessType = (index: number, processType: string) => setForm((current: any) => ({
    ...current,
    processCosts: current.processCosts.map((line: ProcessLine, lineIndex: number) => {
      if (lineIndex !== index) return line;
      const calculatedByMachineRate = usesMachineRateCalculation(processType);
      const machineCostInr = calculatedByMachineRate
        ? configuredMachineCostForProcess(masters.machiningProcesses || [], processType)
        : "";
      return {
        ...line,
        processType,
        totalCycleTimeSeconds: calculatedByMachineRate ? line.totalCycleTimeSeconds : "",
        machineCostInr: machineCostInr ?? "",
        costInr: calculatedByMachineRate
          ? calculatedMachineProcessCost(line.totalCycleTimeSeconds, machineCostInr)
          : "",
      };
    }),
  }));
  const updateMainProcessCycleTime = (index: number, value: string) => {
    if (value !== "" && !/^\d*(?:\.\d*)?$/.test(value)) return;
    setForm((current: any) => ({
      ...current,
      processCosts: current.processCosts.map((line: ProcessLine, lineIndex: number) => lineIndex === index && usesMachineRateCalculation(line.processType) ? {
        ...line,
        totalCycleTimeSeconds: value,
        costInr: calculatedMachineProcessCost(value, line.machineCostInr ?? null),
      } : line),
    }));
  };
  const updateMainProcessMachineCost = (index: number, value: string) => {
    if (value !== "" && !/^\d*(?:\.\d*)?$/.test(value)) return;
    setForm((current: any) => ({
      ...current,
      processCosts: current.processCosts.map((line: ProcessLine, lineIndex: number) => lineIndex === index && usesMachineRateCalculation(line.processType) ? {
        ...line,
        machineCostInr: value,
        costInr: calculatedMachineProcessCost(line.totalCycleTimeSeconds, value),
      } : line),
    }));
  };
  const updateMainProcessCost = (index: number, value: string) => {
    if (value !== "" && !/^\d*(?:\.\d*)?$/.test(value)) return;
    setForm((current: any) => ({
      ...current,
      processCosts: current.processCosts.map((line: ProcessLine, lineIndex: number) => lineIndex === index && !usesMachineRateCalculation(line.processType) ? {
        ...line,
        costInr: value,
      } : line),
    }));
  };
  const displayCost = (value: number | string) =>
    value === 0 ? "" : value;
  const addProcess = () => setForm((current: any) => ({
    ...current,
    processCosts: [...current.processCosts, { processType: "OTHER", description: "", totalCycleTimeSeconds: "", machineCostInr: "", costInr: "" }],
  }));
  const removeProcess = async (index: number) => {
    const processLabel =
      form.processCosts[index]?.description ||
      form.processCosts[index]?.processType ||
      `Process ${index + 1}`;
    const confirmed = await confirmDelete({
      title: "Delete machining process?",
      message: `${processLabel} and its entered cost will be removed.`,
      confirmLabel: "Delete process",
    });
    if (!confirmed) return;
    setForm((current: any) => ({ ...current, processCosts: current.processCosts.filter((_: any, lineIndex: number) => lineIndex !== index) }));
  };
  const addSubpart = () => setForm((current: any) => ({ ...current, subparts: [...(current.subparts || []), emptySubpart()] }));
  const removeSubpart = async (index: number) => {
    const subpartLabel =
      form.subparts[index]?.partName ||
      form.subparts[index]?.partDrawingNumber ||
      `Sub-part ${index + 1}`;
    const confirmed = await confirmDelete({
      title: "Delete sub-part?",
      message: `${subpartLabel}, its machining costs and development costs will be removed.`,
      confirmLabel: "Delete sub-part",
    });
    if (!confirmed) return;
    setForm((current: any) => ({
      ...current,
      subparts: current.subparts.filter((_: SubPartLine, lineIndex: number) => lineIndex !== index),
    }));
  };
  const updateSubpart = (index: number, key: keyof SubPartLine, value: any) => setForm((current: any) => ({
    ...current,
    subparts: current.subparts.map((line: SubPartLine, lineIndex: number) => lineIndex === index ? { ...line, [key]: value } : line),
  }));
  const updateSubpartMaterialType = (index: number, materialType: string) => setForm((current: any) => ({
    ...current,
    subparts: current.subparts.map((line: SubPartLine, lineIndex: number) => {
      if (lineIndex !== index) return line;
      if (!isPurchasedSubpart(materialType)) return { ...line, materialType };
      return {
        ...line,
        materialType,
        processCosts: [],
        patternCostInr: "",
        fixtureCostInr: "",
        specialToolCostInr: "",
        gaugeCostInr: "",
        trialCostInr: "",
      };
    }),
  }));
  const addSubpartProcessColumn = () => setSubpartProcessColumns((current) => [
    ...current,
    {
      processType: `${CUSTOM_SUBPART_PROCESS_PREFIX}${Date.now().toString(36).toUpperCase()}_${current.length + 1}`,
    },
  ]);
  const subpartProcessName = (line: SubPartLine, processType: string) =>
    line.processCosts.find((process) => process.processType === processType)?.description ?? "";
  const subpartProcessCycleTime = (line: SubPartLine, processType: string) =>
    line.processCosts.find((process) => process.processType === processType)?.totalCycleTimeSeconds ?? "";
  const subpartProcessMachineCost = (line: SubPartLine, processType: string) => {
    const process = line.processCosts.find((item) => item.processType === processType);
    if (!process || !subpartUsesMachineRateCalculation(masters.machiningProcesses || [], process.processType, process.description)) return null;
    return process.machineCostInr ?? configuredMachineCostForProcess(masters.machiningProcesses || [], process.description, process.processType);
  };
  const subpartProcessCost = (line: SubPartLine, processType: string) => {
    const process = line.processCosts.find((item) => item.processType === processType);
    if (!process) return "";
    if (!subpartUsesMachineRateCalculation(masters.machiningProcesses || [], process.processType, process.description)) {
      return process.costInr ?? "";
    }
    const machineCost = subpartProcessMachineCost(line, processType);
    const calculatedCost = calculatedMachineProcessCost(process.totalCycleTimeSeconds, machineCost);
    return calculatedCost === "" ? process.costInr ?? "" : calculatedCost;
  };
  const updateSubpartProcessName = (index: number, processType: string, description: string) => setForm((current: any) => ({
    ...current,
    subparts: current.subparts.map((line: SubPartLine, lineIndex: number) => {
      if (lineIndex !== index) return line;
      const existing = line.processCosts.find((process) => process.processType === processType);
      const calculatedByMachineRate = subpartUsesMachineRateCalculation(masters.machiningProcesses || [], processType, description);
      if (!existing) {
        const machineCostInr = calculatedByMachineRate
          ? configuredMachineCostForProcess(masters.machiningProcesses || [], description)
          : "";
        return description ? {
          ...line,
          processCosts: [...line.processCosts, {
            processType,
            description,
            totalCycleTimeSeconds: "",
            machineCostInr: machineCostInr ?? "",
            costInr: "",
          }],
        } : line;
      }
      if (!description) {
        return { ...line, processCosts: line.processCosts.filter((process) => process.processType !== processType) };
      }
      const machineCostInr = calculatedByMachineRate
        ? configuredMachineCostForProcess(masters.machiningProcesses || [], description)
        : "";
      const costInr = calculatedByMachineRate
        ? calculatedMachineProcessCost(existing.totalCycleTimeSeconds, machineCostInr)
        : "";
      return {
        ...line,
        processCosts: line.processCosts.map((process) => process.processType === processType ? {
          ...process,
          description,
          totalCycleTimeSeconds: calculatedByMachineRate ? process.totalCycleTimeSeconds : "",
          machineCostInr: machineCostInr ?? "",
          costInr: costInr === "" ? "" : costInr,
        } : process),
      };
    }),
  }));
  const updateSubpartProcessCycleTime = (index: number, processType: string, value: string) => {
    if (value !== "" && !/^\d*(?:\.\d*)?$/.test(value)) return;
    setForm((current: any) => ({
      ...current,
      subparts: current.subparts.map((line: SubPartLine, lineIndex: number) => {
        if (lineIndex !== index) return line;
        const existing = line.processCosts.find((process) => process.processType === processType);
        if (!existing || !subpartUsesMachineRateCalculation(masters.machiningProcesses || [], existing.processType, existing.description)) return line;
        const machineCostInr = subpartProcessMachineCost(line, processType);
        return {
          ...line,
          processCosts: line.processCosts.map((process) => process.processType === processType ? {
            ...process,
            totalCycleTimeSeconds: value,
            costInr: calculatedMachineProcessCost(value, machineCostInr),
          } : process),
        };
      }),
    }));
  };
  const updateSubpartProcessMachineCost = (index: number, processType: string, value: string) => {
    if (value !== "" && !/^\d*(?:\.\d*)?$/.test(value)) return;
    setForm((current: any) => ({
      ...current,
      subparts: current.subparts.map((line: SubPartLine, lineIndex: number) => {
        if (lineIndex !== index) return line;
        const existing = line.processCosts.find((process) => process.processType === processType);
        if (!existing || !subpartUsesMachineRateCalculation(masters.machiningProcesses || [], existing.processType, existing.description)) return line;
        return {
          ...line,
          processCosts: line.processCosts.map((process) => process.processType === processType ? {
            ...process,
            machineCostInr: value,
            costInr: calculatedMachineProcessCost(process.totalCycleTimeSeconds, value),
          } : process),
        };
      }),
    }));
  };
  const updateSubpartProcessCost = (index: number, processType: string, value: string) => {
    if (value !== "" && !/^\d*(?:\.\d*)?$/.test(value)) return;
    setForm((current: any) => ({
      ...current,
      subparts: current.subparts.map((line: SubPartLine, lineIndex: number) => {
        if (lineIndex !== index) return line;
        return {
          ...line,
          processCosts: line.processCosts.map((process) => process.processType === processType && !subpartUsesMachineRateCalculation(masters.machiningProcesses || [], process.processType, process.description) ? {
            ...process,
            costInr: value,
          } : process),
        };
      }),
    }));
  };

  const selectCurrency = (code: string) => {
    const currency = masters.currencies.find((item: any) => item.value === code);
    setForm((current: any) => ({ ...current, currencyCode: code, currencyRate: currency?.exchangeRate || current.currencyRate, exchangeRateEffectiveDate: currency?.effectiveDate || "" }));
  };

  const save = async (complete: boolean, stayOnPage = false): Promise<boolean | void> => {
    const savedSnapshot = unsaved.snapshot();

    try {
      setSaving(complete ? "COMPLETE" : "DRAFT"); setMessage(undefined);
      const payload = {
        ...form,
        // Purchased sub-parts display a read-only calculated cost. Include that
        // value in the request so the server stores the same value the user sees.
        subparts: (form.subparts || []).map((line: SubPartLine) => isPurchasedSubpart(line.materialType)
          ? { ...line, materialCostInr: calculatedSubpartMaterialCost(line) }
          : line),
        notes: String(form.notesText || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean),
      };
      const response = await marketingApi.saveWorkout(partId, payload, complete);
      unsaved.markSaved(savedSnapshot);
      if (stayOnPage) return true;

      if (!complete) {
        showSuccess(
          completed
            ? "Completed Workout updated successfully."
            : response.message || "Workout draft saved successfully."
        );
        navigate("/marketing/enquiries");
        return;
      }

      setHasSavedWorkout(true);
      setDraftEditing(false);
      setForm((current: any) => ({ ...current, save_status: response.data.save_status }));
      if (complete) {
        const refreshed = await marketingApi.getWorkout(partId);
        setPart(refreshed.data.part);
        setWorkflow(refreshed.data.workflow);

        const completedPartName =
          part?.product_description || part?.part_number || "Part";
        const completedDrawing = part?.drawing_number || "Not specified";
        const currentIndex = items.findIndex(
          (item) => Number(item.enquiryPartId) === partId
        );
        const orderedRemaining = currentIndex >= 0
          ? [...items.slice(currentIndex + 1), ...items.slice(0, currentIndex)]
          : items;
        const nextItem = orderedRemaining.find(
          (item) => Number(item.enquiryPartId) !== partId &&
            item.partStatus !== "WORKOUT_COMPLETED"
        );

        if (nextItem) {
          const proceed = await confirmAction({
            title: "Workout Completed",
            message: `Completed ${completedPartName} (Drawing: ${completedDrawing}). Proceed with ${nextItem.productDescription || nextItem.partNumber || "the next part"} (Drawing: ${nextItem.drawingNumber || "Not specified"})?`,
            confirmLabel: "Proceed to Next Drawing",
            cancelLabel: "Stay Here",
          });
          if (proceed) {
            navigate(`/marketing/enquiry-parts/${nextItem.enquiryPartId}/workout`);
          }
        } else {
          showSuccess(
            `Workout completed for ${completedPartName} (Drawing: ${completedDrawing}). All eligible drawings are completed.`
          );
        }
      }
      setMessage({
        type: "success",
        text: `Workout completed for ${part?.product_description || part?.part_number || "Part"} (Drawing: ${part?.drawing_number || "Not specified"}).`,
      });
    } catch (error) {
      setMessage({ type: "error", text: apiMessage(error) });
    } finally { setSaving(null); }
  };

  const cancel = () => {
    navigate(`/marketing/enquiries/${part.enquiry_id}`);
  };

  const completed = form.save_status === "COMPLETED";
  const savedDraft =
    hasSavedWorkout &&
    form.save_status === "DRAFT";
  const closed =
    (viewRequested && !draftEditing) ||
    (completed && !draftEditing) ||
    (savedDraft && !draftEditing);
  const actions = (workflow?.allowedActions || []) as string[];
  const foreign = form.currencyCode || "FCY";
  const allowedStages = (workflow?.allowedStages || ["Enquiry", "Feasibility", "Workout"]) as MarketingStage[];
  const completedStages = (workflow?.completedStages || ["Enquiry", "Feasibility"]) as MarketingStage[];
  const subpartProcessOptions = (masters.machiningProcesses || []).filter((process: any) => process.value !== "OTHER");
  const inputNumber = (key: string, label: string, step = "any") => <label><span>{label}</span><input type="number" inputMode="decimal" min="0" step={step} value={form[key]} disabled={closed} onChange={(event) => set(key, event.target.value)} /></label>;

  return <div className="page-container workout-page">
    <PageHeader eyebrow="MARKETING / WORKOUT" title={part ? `Workout - ${part.part_number}` : "Workout"} onClose={actions.includes("CANCEL") ? cancel : undefined} closeDisabled={saving !== null} closeLabel="Close Workout" actions={<>
      {(savedDraft || completed) && !draftEditing && canEditAllStages ? (
        <button type="button" className="primary-action-button" disabled={saving !== null} onClick={() => setDraftEditing(true)}><Pencil size={17}/>{completed ? "Edit Workout" : "Edit Draft"}</button>
      ) : !viewRequested && (!completed || draftEditing) ? <>
        {(savedDraft || completed) && <button type="button" className="workout-cancel" disabled={saving !== null} onClick={() => window.location.reload()}><X size={16}/>Cancel Edit</button>}
        {actions.includes("SAVE_DRAFT") && <button type="button" className="secondary-action-button draft" disabled={saving !== null} onClick={() => save(false)}><Save size={17}/>{saving === "DRAFT" ? "Saving..." : "Save Draft"}</button>}
        {actions.includes("UPDATE_WORKOUT") && <button type="button" className="primary-action-button" disabled={saving !== null} onClick={() => save(false)}><Save size={17}/>{saving === "DRAFT" ? "Updating..." : "Update"}</button>}
        {actions.includes("COMPLETE_WORKOUT") && <button type="button" className="primary-action-button" disabled={saving !== null} onClick={() => save(true)}><Send size={17}/>{saving === "COMPLETE" ? "Completing..." : "Complete Workout"}</button>}
      </> : null}
    </>} />
    {message && <Alert type={message.type} message={message.text}/>} 
    <StageTabs active="Workout" enquiryId={part?.enquiry_id} partId={partId} allowedStages={allowedStages} completedStages={completedStages}/>

    <section className="workout-card workout-header-card">
      <div className="workout-section-title">
        <h2>Item Details</h2>
        <div className="workout-title-actions">
          {isAssembled && <span className="workout-assembled-status">ASSEMBLED PART</span>}
          {completed && <span className="workout-status">COMPLETED</span>}
        </div>
      </div>
      <div className="workout-item-grid">
        <label><span>Drawing / Item</span><select value={partId} disabled={closed} onChange={(event) => navigate(`/marketing/enquiry-parts/${event.target.value}/workout${modeSuffix}`)}>{items.map((item) => <option key={item.enquiryPartId} value={item.enquiryPartId}>{item.drawingNumber} - {item.productDescription}</option>)}</select></label>
        <label><span>Process Plan Variant</span><select value={form.processPlanId || ""} disabled={closed || !processPlans.length} onChange={(event) => set("processPlanId",event.target.value)}><option value="">{processPlans.length ? "Select Process Plan" : "No Process Plan configured"}</option>{processPlans.map((plan:any) => <option key={plan.processPlanId} value={plan.processPlanId}>{plan.planCode} - {plan.routeName} ({plan.productionCapacityPerDay || 0}/day){plan.isDefault === "Y" ? " - Default" : ""}</option>)}</select></label>
        <label><span>Enquiry Reference</span><input value={part?.doc_no || ""} readOnly/></label>
        <label><span>Workout Date *</span><DateInput type="date" value={form.workoutDate} max={today()} disabled={closed} onChange={(event) => set("workoutDate", event.target.value)}/></label>
        <label><span>Customer Reference</span><input value={part?.po_reference || "Not available"} readOnly/></label>
        <label><span>Item Code</span><input value={part?.item_code || "Not Assigned"} readOnly/></label>
        <label><span>Machining Drawing Number</span><input value={part?.drawing_number || ""} readOnly/></label>
        <label><span>Revision</span><input value={part?.drawing_revision_number || ""} readOnly/></label>
        <label className="span-2"><span>Description</span><input value={part?.product_description || ""} readOnly/></label>
        <label><span>Annual Quantity</span><input value={`${part?.annual_quantity || part?.required_quantity || ""} ${part?.unit_of_measurement || ""}`.trim()} readOnly/></label>
        {!isAssembled && <label><span>Material and Grade</span><input value={part?.material_and_grade || ""} readOnly/></label>}
        {inputNumber("moq", "MOQ *", "0.001")}
        {!isAssembled && inputNumber("weightKg", "Weight (Kg) *", "0.001")}
      </div>
    </section>

    <div className="workout-two-column">
      <section className="workout-card">
        <div className="workout-section-title"><h2>{isAssembled ? "Currency & Sub-Part Material Cost" : "Currency & Material Cost"}</h2></div>
        <div className="workout-grid">
          <label><span>Quotation Currency *</span><select value={form.currencyCode} disabled={closed} onChange={(event) => selectCurrency(event.target.value)}>{masters.currencies.map((currency: any) => <option key={currency.value} value={currency.value}>{currency.value} - {currency.label}</option>)}</select></label>
          {inputNumber("currencyRate", `Exchange Rate (1 ${foreign} = INR) *`, "0.0001")}
          <label><span>Rate Effective Date</span><DateInput type="date" value={form.exchangeRateEffectiveDate || ""} max={today()} disabled={closed} onChange={(event) => set("exchangeRateEffectiveDate", event.target.value)}/></label>
          {!isAssembled && inputNumber("materialRatePerKg", "Material Rate / Kg (INR) *")}
          {!isAssembled && inputNumber("additionalMaterialCostInr", "Additional Material Cost (INR)")}
        </div>
        <div className="workout-material-cost-summary">
          <div className="workout-result-row">
            <span>{isAssembled ? "Sub-Part Material Total" : "Material Cost (INR)"}</span>
            {isAssembled ? <Amount value={totals.materialCost}/> : <input
              className="workout-material-cost-input"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.0001"
              value={hasEnteredNumber(form.actualMaterialCostInr) ? form.actualMaterialCostInr : displayCost(totals.calculatedMaterialCost)}
              disabled={closed}
              aria-label="Material Cost in INR"
              onChange={(event) => set("actualMaterialCostInr", event.target.value)}
            />}
            {isAssembled ? <Amount value={converted(totals.materialCost, totals.exchangeRate)} currency={foreign}/> : <label className="workout-foreign-material-cost-input">
              <span>{foreign}</span>
              <input
                className="workout-material-cost-input"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.0001"
                value={converted(totals.materialCost, totals.exchangeRate)}
                disabled={closed || totals.exchangeRate <= 0}
                aria-label={`Material Cost in ${foreign}`}
                onChange={(event) => {
                  const foreignCost = event.target.value;
                  set("actualMaterialCostInr", foreignCost === "" ? "" : String(money(num(foreignCost) * totals.exchangeRate)));
                }}
              />
            </label>}
          </div>
          {!isAssembled && hasEnteredNumber(form.actualMaterialCostInr) && money(num(form.actualMaterialCostInr)) !== totals.calculatedMaterialCost && <p className="workout-material-cost-hint">Rate-based calculation: INR {totals.calculatedMaterialCost.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>}
        </div>
      </section>
      <section className="workout-card">
        <div className="workout-section-title"><h2>{isAssembled ? "Assembly / Labour, Overhead & Profit" : "Overhead & Profit"}</h2></div>
        <div className="workout-grid">
          {isAssembled && inputNumber("assemblyLabourCostInr", "Assembly / Labour Cost (INR) *")}
          {inputNumber("overheadPercent", "Overhead Percentage")}
          <label><span>Profit Calculation</span><select value={form.profitCalculationType} disabled={closed} onChange={(event) => set("profitCalculationType", event.target.value)}>{referenceData.options("PROFIT_CALCULATION_TYPE").map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          {inputNumber("profitValue", form.profitCalculationType === "PERCENTAGE" ? "Profit Percentage" : "Profit Amount (INR)")}
        </div>
        <div className="workout-result-list">
          {isAssembled && <div><span>Sub-Part Machining</span><Amount value={totals.subpartMachiningCost}/></div>}
          {isAssembled && <div><span>Assembly / Labour</span><Amount value={num(form.assemblyLabourCostInr)}/></div>}
          {!isAssembled && <div><span>Machining Total</span><Amount value={totals.machiningTotal}/></div>}
          <div><span>Overhead Amount</span><Amount value={totals.overheadAmount}/></div>
          <div><span>Profit Amount</span><Amount value={totals.profitAmount}/></div>
          <div className="total"><span>{isAssembled ? "Adjusted Operating Cost" : "Adjusted Machining Cost"}</span><Amount value={totals.adjustedMachining}/></div>
        </div>
        {isAssembled && <div className="workout-result-row"><span>Development Cost (Excluded from Operating Cost)</span><Amount value={totals.developmentTotal}/><Amount value={converted(totals.developmentTotal, totals.exchangeRate)} currency={foreign}/></div>}
      </section>
    </div>

    {isAssembled && <section className="workout-card workout-subpart-card">
      <div className="workout-section-title">
        <div>
          <h2>{part?.line_number ? `Part ${part.line_number}` : "Assembled Part"} - {part?.product_description || part?.part_number}</h2>
          <p>{part?.drawing_number || ""} · Assembled Part · Rows remain editable</p>
        </div>
        {!closed && <button type="button" className="workout-add-line" onClick={addSubpart}><Plus size={15}/>Add Sub Part</button>}
      </div>
      <div className="workout-subpart-scroll">
        <table className="workout-subpart-table">
          <thead>
            <tr className="workout-subpart-groups">
              <th colSpan={7}>Sub-Part &amp; Material Details</th>
              <th colSpan={subpartProcessColumns.length * 4}>
                <span className="workout-machine-process-group">
                  <span>Machining Process Cost</span>
                  {!closed && <button type="button" className="workout-machine-process-add" onClick={addSubpartProcessColumn}><Plus size={15}/>Machine Process</button>}
                </span>
              </th>
              <th colSpan={5}>Development Cost</th>
              <th rowSpan={2}>Actions</th>
            </tr>
            <tr>
              <th>Part Name *</th>
              <th>Part / Drawing No. *</th>
              <th>Material Type *</th>
              <th>Material &amp; Grade</th>
              <th>Unit Price</th>
              <th>RM Weight / Nos.</th>
              <th>Material Cost</th>
              {subpartProcessColumns.map((column) => <Fragment key={column.processType}>
                <th>Process Name</th>
                <th>Total Cycle Time (Sec)</th>
                <th>Machine Cost / Hr</th>
                <th>Machining Process Cost</th>
              </Fragment>)}
              <th>Pattern</th>
              <th>Fixture</th>
              <th>Special Tool</th>
              <th>Gauge</th>
              <th>Trial</th>
            </tr>
          </thead>
          <tbody>
            {(form.subparts || []).map((line: SubPartLine, index: number) => {
              const purchasedSubpart = isPurchasedSubpart(line.materialType);
              const processAndDevelopmentDisabled = closed || purchasedSubpart;
              return <tr key={index}>
                <td><input value={line.partName} disabled={closed} onChange={(event) => updateSubpart(index, "partName", event.target.value)}/></td>
                <td><input value={line.partDrawingNumber} disabled={closed} onChange={(event) => updateSubpart(index, "partDrawingNumber", event.target.value)}/></td>
                <td><select value={line.materialType} disabled={closed} onChange={(event) => updateSubpartMaterialType(index, event.target.value)}><option value="">Select</option>{masters.subpartMaterialTypes.map((type: any) => <option key={type.value} value={type.value}>{type.label}</option>)}</select></td>
                <td><input value={line.materialAndGrade} disabled={closed} onChange={(event) => updateSubpart(index, "materialAndGrade", event.target.value)}/></td>
                <td><input type="number" min="0" step="0.01" value={line.materialPricePerKg} disabled={closed} aria-label={`Sub-part ${index + 1} unit price`} onChange={(event) => updateSubpart(index, "materialPricePerKg", event.target.value)}/></td>
                <td><input type="number" min="0" step="0.001" value={line.rmWeightKg} disabled={closed} aria-label={`Sub-part ${index + 1} RM weight or numbers`} onChange={(event) => updateSubpart(index, "rmWeightKg", event.target.value)}/></td>
                <td><input type="number" min="0" step="0.01" value={purchasedSubpart ? displayCost(calculatedSubpartMaterialCost(line)) : line.materialCostInr} disabled={closed} readOnly={purchasedSubpart} aria-label={`Sub-part ${index + 1} material cost`} placeholder={purchasedSubpart ? "Calculated" : "Enter cost"} onChange={(event) => { if (!purchasedSubpart) updateSubpart(index, "materialCostInr", event.target.value); }}/></td>
                {subpartProcessColumns.map((column) => {
                  const selectedProcessName = subpartProcessName(line, column.processType);
                  const cycleTimeSeconds = subpartProcessCycleTime(line, column.processType);
                  const machineCostInr = subpartProcessMachineCost(line, column.processType);
                  const selectedProcess = line.processCosts.find((process) => process.processType === column.processType);
                  const calculatedByMachineRate = selectedProcess
                    ? subpartUsesMachineRateCalculation(masters.machiningProcesses || [], selectedProcess.processType, selectedProcess.description)
                    : false;
                  const hasSavedCustomName = selectedProcessName && !subpartProcessOptions.some((process: any) => process.label === selectedProcessName);
                  return <Fragment key={column.processType}>
                    <td><select value={selectedProcessName} disabled={processAndDevelopmentDisabled} aria-label={`Sub-part ${index + 1} process name`} onChange={(event) => updateSubpartProcessName(index, column.processType, event.target.value)}>
                      <option value="">Select process</option>
                      {hasSavedCustomName && <option value={selectedProcessName}>{selectedProcessName}</option>}
                      {subpartProcessOptions.map((process: any) => <option key={process.value} value={process.label}>{process.label}</option>)}
                    </select></td>
                    <td><input type="number" inputMode="decimal" min="0" step="any" value={cycleTimeSeconds} disabled={processAndDevelopmentDisabled || !selectedProcessName || !calculatedByMachineRate} placeholder="Seconds" aria-label={`Sub-part ${index + 1} total cycle time in seconds`} onChange={(event) => updateSubpartProcessCycleTime(index, column.processType, event.target.value)}/></td>
                    <td><input type="number" inputMode="decimal" min="0" step="any" value={machineCostInr ?? ""} disabled={processAndDevelopmentDisabled || !selectedProcessName || !calculatedByMachineRate} aria-label={`Sub-part ${index + 1} machine cost per hour`} onChange={(event) => updateSubpartProcessMachineCost(index, column.processType, event.target.value)}/></td>
                    <td><input type="number" inputMode="decimal" min="0" step="any" value={displayCost(subpartProcessCost(line, column.processType))} disabled={processAndDevelopmentDisabled || !selectedProcessName} readOnly={calculatedByMachineRate} placeholder={calculatedByMachineRate ? "Calculated" : "Enter cost"} aria-label={`Sub-part ${index + 1} machining process cost`} onChange={(event) => updateSubpartProcessCost(index, column.processType, event.target.value)}/></td>
                  </Fragment>;
                })}
                <td><input type="number" min="0" step="0.01" value={line.patternCostInr} disabled={processAndDevelopmentDisabled} onChange={(event) => updateSubpart(index, "patternCostInr", event.target.value)}/></td>
                <td><input type="number" min="0" step="0.01" value={line.fixtureCostInr} disabled={processAndDevelopmentDisabled} onChange={(event) => updateSubpart(index, "fixtureCostInr", event.target.value)}/></td>
                <td><input type="number" min="0" step="0.01" value={line.specialToolCostInr} disabled={processAndDevelopmentDisabled} onChange={(event) => updateSubpart(index, "specialToolCostInr", event.target.value)}/></td>
                <td><input type="number" min="0" step="0.01" value={line.gaugeCostInr} disabled={processAndDevelopmentDisabled} onChange={(event) => updateSubpart(index, "gaugeCostInr", event.target.value)}/></td>
                <td><input type="number" min="0" step="0.01" value={line.trialCostInr} disabled={processAndDevelopmentDisabled} onChange={(event) => updateSubpart(index, "trialCostInr", event.target.value)}/></td>
                <td><button type="button" className="workout-subpart-delete" aria-label={`Delete sub-part row ${index + 1}`} disabled={closed} onClick={() => removeSubpart(index)}><Trash2 size={15}/></button></td>
              </tr>;
            })}
            {!form.subparts.length && <tr><td className="workout-subpart-empty" colSpan={13 + subpartProcessColumns.length * 4}>No sub-parts added. Select Add Sub Part to create an editable row.</td></tr>}
          </tbody>
          {!!form.subparts.length && <tfoot>
            <tr>
              <th colSpan={6}>Calculated Total</th>
              <th>{totals.subpartMaterialCost.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</th>
              {subpartProcessColumns.map((column) => <Fragment key={column.processType}>
                <th></th><th></th><th></th>
                <th>{money((form.subparts || []).reduce((sum: number, line: SubPartLine) => sum + num(subpartProcessCost(line, column.processType)), 0)).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</th>
              </Fragment>)}
              {["patternCostInr", "fixtureCostInr", "specialToolCostInr", "gaugeCostInr", "trialCostInr"].map((key) => <th key={key}>{money((form.subparts || []).reduce((sum: number, line: SubPartLine) => sum + num((line as any)[key]), 0)).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</th>)}
              <th></th>
            </tr>
          </tfoot>}
        </table>
      </div>
    </section>}

    {!isAssembled && <section className="workout-card">
      <div className="workout-section-title"><h2>Machining Process Costs</h2>{!closed && <button type="button" className="workout-add-line" onClick={addProcess}><Plus size={15}/>Add Process</button>}</div>
      <div className="workout-process-table">
        <div className="process-head"><span>Process</span><span>Description</span><span>Total Cycle Time (Sec)</span><span>Machine Cost / Hr (INR)</span><span>Machining Process Cost (INR)</span><span></span></div>
        {form.processCosts.map((line: ProcessLine, index: number) => {
          const calculatedByMachineRate = usesMachineRateCalculation(line.processType);
          return <div className="process-line" key={`${index}-${line.processType}`}>
            <select value={line.processType} disabled={closed} onChange={(event) => updateMainProcessType(index, event.target.value)}>{masters.machiningProcesses.map((process: any) => <option key={process.value} value={process.value}>{process.label}</option>)}</select>
            <input value={line.description || ""} disabled={closed} placeholder={line.processType === "OTHER" ? "Enter process description" : "Optional description"} onChange={(event) => updateProcess(index, "description", event.target.value)}/>
            <input type="number" inputMode="decimal" min="0" step="any" value={line.totalCycleTimeSeconds ?? ""} disabled={closed || !calculatedByMachineRate} placeholder="Seconds" aria-label={`Process ${index + 1} total cycle time in seconds`} onChange={(event) => updateMainProcessCycleTime(index, event.target.value)}/>
            <input type="number" inputMode="decimal" min="0" step="any" value={line.machineCostInr ?? ""} disabled={closed || !calculatedByMachineRate} placeholder="Enter cost" aria-label={`Process ${index + 1} machine cost per hour`} onChange={(event) => updateMainProcessMachineCost(index, event.target.value)}/>
            <input type="number" inputMode="decimal" min="0" step="any" value={displayCost(line.costInr)} disabled={closed} readOnly={calculatedByMachineRate} placeholder={calculatedByMachineRate ? "Calculated" : "Enter cost"} aria-label={`Process ${index + 1} machining process cost`} onChange={(event) => updateMainProcessCost(index, event.target.value)}/>
            <button type="button" title="Remove process" disabled={closed} onClick={() => removeProcess(index)}><Trash2 size={16}/></button>
          </div>;
        })}
      </div>
    </section>}

    <div className="workout-two-column workout-pricing-section">
      <section className="workout-card">
        <div className="workout-section-title"><h2>Part Pricing - FOB Chennai</h2></div>
        <div className="workout-pricing-layout">
          <div className="workout-pricing-inputs">
            <h3>Pricing Inputs</h3>
            <div className="workout-grid">
              {!isAssembled && inputNumber("packingForwardingCostInr", "Packing Cost (INR)")}
              {inputNumber("commissionPercent", "Commission Percentage")}
              {inputNumber("sampleCostPercent", "Sample Cost (%)")}
              <label><span>Sample Cost ({foreign})</span><input type="number" inputMode="decimal" value={converted(totals.sampleCostInr, totals.exchangeRate)} readOnly/></label>
            </div>
          </div>
          <div className="workout-pricing-details"><h3>Cost Details</h3><div className="workout-price-grid"><span></span><strong>INR</strong><strong>{foreign}</strong><span>Packing Cost</span><Amount value={num(form.packingForwardingCostInr)}/><Amount value={converted(num(form.packingForwardingCostInr), totals.exchangeRate)} currency={foreign}/><span>{isAssembled ? "Assembled Item Price Before Commission" : "Part Price Before Commission"}</span><Amount value={totals.partPrice}/><Amount value={converted(totals.partPrice, totals.exchangeRate)} currency={foreign}/><span>Commission Amount</span><Amount value={totals.commissionAmount}/><Amount value={converted(totals.commissionAmount, totals.exchangeRate)} currency={foreign}/><span className="grand">{isAssembled ? "Final Assembled Item Price" : "Final Part Price"}</span><Amount value={totals.finalPartPrice}/><Amount value={converted(totals.finalPartPrice, totals.exchangeRate)} currency={foreign}/></div></div>
        </div>
      </section>
      {isAssembled ? <section className="workout-card">
        <div className="workout-section-title"><h2>Development Cost</h2></div>
        <div className="workout-grid workout-development-grid">
          <label><span>Pattern Cost</span><input value={totals.subpartDevelopmentBreakdown.pattern.toFixed(2)} readOnly/></label>
          <label><span>Fixture Cost</span><input value={totals.subpartDevelopmentBreakdown.fixture.toFixed(2)} readOnly/></label>
          <label><span>Special Tool Cost</span><input value={totals.subpartDevelopmentBreakdown.specialTool.toFixed(2)} readOnly/></label>
          <label><span>Gauge Cost</span><input value={totals.subpartDevelopmentBreakdown.gauge.toFixed(2)} readOnly/></label>
          <label><span>Trial Cost</span><input value={totals.subpartDevelopmentBreakdown.trial.toFixed(2)} readOnly/></label>
        </div>
        <div className="workout-result-row"><span>Total Development Cost (Excluded from Operating Cost)</span><Amount value={totals.developmentTotal}/><Amount value={converted(totals.developmentTotal, totals.exchangeRate)} currency={foreign}/></div>
      </section> : <section className="workout-card">
        <div className="workout-section-title"><h2>Development Cost</h2></div>
        <div className="workout-grid workout-development-grid">
          {inputNumber("patternCostInr", "Pattern Cost")}
          {inputNumber("fixtureCostInr", "Fixture Cost")}
          {inputNumber("specialToolCostInr", "Special Tool Cost")}
          {inputNumber("gaugeCostInr", "Gauge Cost")}
          {inputNumber("trialCostInr", "Trial Cost")}
        </div>
        <div className="workout-result-row"><span>Total Development Cost</span><Amount value={totals.developmentTotal}/><Amount value={converted(totals.developmentTotal, totals.exchangeRate)} currency={foreign}/></div>
      </section>}
    </div>

    <section className="workout-card workout-notes-card">
      <div className="workout-section-title"><h2>Commercial Notes</h2></div>
      <div className="workout-grid"><label><span>Payment Terms</span><input value={form.paymentTerms} readOnly placeholder="Set in Feasibility"/></label><label><span>Development Time (Days / Months)</span><input value={form.developmentTime} disabled={closed} placeholder="e.g. 30 Days or 2 Months" onChange={(event) => set("developmentTime", event.target.value)}/></label><label><span>Pilot Batch Delivery</span><DateInput type="date" value={form.pilotBatchDelivery} disabled={closed} onChange={(event) => set("pilotBatchDelivery", event.target.value)}/></label><label className="span-2"><span>Notes - one note per line</span><textarea rows={3} value={form.notesText} disabled={closed} onChange={(event) => set("notesText", event.target.value)}/></label></div>
    </section>
  </div>;
}
