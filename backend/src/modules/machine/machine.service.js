import { withTransaction } from "../../config/db.js";
import { AppError } from "../../utils/AppError.js";
import * as repository from "./machine.repository.js";

const clean = (value) => value === null || value === undefined ? null : String(value).trim() || null;
const machineStatuses = ["ACTIVE", "INACTIVE"];
const unitStatuses = ["ACTIVE", "UNDER_MAINTENANCE", "BREAKDOWN", "IDLE", "DECOMMISSIONED"];

function normalizeMachine(data) {
  const submittedUnits = Array.isArray(data.units) ? data.units
    : Array.isArray(data.machineUnits) ? data.machineUnits : [];
  const units = submittedUnits.map((row) => ({
    machineUnitId: Number(row.machineUnitId || 0),
    machineCode: clean(row.machineCode ?? row.machineId ?? row.machine_code),
    serialNumber: clean(row.serialNumber),
    installationDate: clean(row.installationDate),
    plantLocation: clean(row.plantLocation),
    departmentName: clean(row.departmentName),
    unitStatus: String(row.unitStatus || "ACTIVE").toUpperCase(),
    remarks: clean(row.remarks),
  }));
  const machine = {
    itemId: Number(data.itemId),
    numberOfMachines: Number(data.numberOfMachines),
    hourlyCostInr: Number(data.hourlyCostInr || 0),
    otherSpecification: clean(data.otherSpecification),
    machineStatus: String(data.machineStatus || "ACTIVE").toUpperCase(),
    units,
  };
  if (!machine.itemId) throw new AppError("Select a machine from Item Master.");
  if (!Number.isInteger(machine.numberOfMachines) || machine.numberOfMachines < 1) {
    throw new AppError("No. of Machines must be at least 1.");
  }
  if (machine.numberOfMachines !== units.length) {
    throw new AppError("No. of Machines must match the Machine Unit rows.");
  }
  if (!machineStatuses.includes(machine.machineStatus)) throw new AppError("Invalid Machine Master status.");
  const missingMachineIdIndex = units.findIndex((row) => !row.machineCode);
  if (missingMachineIdIndex >= 0) {
    throw new AppError(`Machine ID is required for machine unit row ${missingMachineIdIndex + 1}.`);
  }
  const normalizedCodes = units.map((row) => row.machineCode.toUpperCase());
  if (new Set(normalizedCodes).size !== normalizedCodes.length) throw new AppError("Duplicate Machine IDs are not allowed.");
  if (units.some((row) => !unitStatuses.includes(row.unitStatus))) throw new AppError("Invalid machine unit status.");
  if (!Number.isFinite(machine.hourlyCostInr) || machine.hourlyCostInr < 0) {
    throw new AppError("Machine Type hourly cost must be zero or greater.");
  }
  if (units.some((row) => row.installationDate && !/^\d{4}-\d{2}-\d{2}$/.test(row.installationDate))) {
    throw new AppError("Enter a valid Installation Date.");
  }
  return machine;
}

async function validateSourceItem(connection, itemId) {
  const item = await repository.getSourceItem(connection, itemId);
  if (!item) throw new AppError("Select an active CA / Machines & Equipment Item Master record.");
  if (!item.machineTypeId || !item.machineTypeName || !item.makeName || !item.modelName || !item.machineCapacity) {
    throw new AppError("Complete Machine Type, Make, Model and Capacity in Item Master before linking it.");
  }
  return item;
}

async function validateUnitCodes(connection, data, excludeMachineMasterId = 0) {
  const conflicts = await repository.findConflictingUnitCodes(connection,
    data.units.map((row) => row.machineCode), excludeMachineMasterId);
  if (conflicts.length) throw new AppError(`Machine ID already exists: ${conflicts.map((row) => row.machineCode).join(", ")}`);
}

export async function listMachines(query = {}) {
  const page = Math.max(Number(query.page || 1), 1);
  const pageSize = Math.min(Math.max(Number(query.pageSize || 20), 1), 100);
  return repository.listMachines({ ...query, limit: pageSize, offset: (page - 1) * pageSize });
}

export async function getLookups() {
  return { items: await repository.getEligibleItems(), unitStatuses: unitStatuses.map((value) => ({
    value,label: value.toLowerCase().replace(/(^|_)\w/g, (text) => text.replace("_", " ").toUpperCase()),
  })) };
}

export async function getMachine(machineMasterId) {
  const machine = await repository.getMachineById(Number(machineMasterId));
  if (!machine) throw new AppError("Machine Master record not found.", 404);
  return machine;
}

export async function createMachine(data, userCode) {
  const machine = normalizeMachine(data);
  return withTransaction(async (connection) => {
    const sourceItem = await validateSourceItem(connection, machine.itemId);
    if (await repository.findByItemId(connection, machine.itemId)) {
      throw new AppError("The selected Item Master machine is already linked to Machine Master.");
    }
    await validateUnitCodes(connection, machine);
    const machineMasterId = await repository.insertMachine(connection, machine, userCode);
    await repository.updateMachineTypeHourlyCost(connection, sourceItem.machineTypeId, machine.hourlyCostInr, userCode);
    await repository.replaceUnits(connection, machineMasterId, machine.units, userCode);
    return repository.getMachineById(machineMasterId, connection);
  });
}

export async function updateMachine(machineMasterId, data, userCode) {
  const machine = normalizeMachine(data);
  return withTransaction(async (connection) => {
    const existing = await repository.getMachineById(Number(machineMasterId), connection);
    if (!existing) throw new AppError("Machine Master record not found.", 404);
    if (Number(existing.itemId) !== machine.itemId) throw new AppError("Item Master machine cannot be changed after creation.");
    const sourceItem = await validateSourceItem(connection, machine.itemId);
    await validateUnitCodes(connection, machine, Number(machineMasterId));
    await repository.updateMachine(connection, Number(machineMasterId), machine, userCode);
    await repository.updateMachineTypeHourlyCost(connection, sourceItem.machineTypeId, machine.hourlyCostInr, userCode);
    await repository.replaceUnits(connection, Number(machineMasterId), machine.units, userCode);
    return repository.getMachineById(Number(machineMasterId), connection);
  });
}

export async function deleteMachine(machineMasterId) {
  await getMachine(machineMasterId);
  await repository.deleteMachine(Number(machineMasterId));
}
