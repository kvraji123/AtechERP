import { withTransaction } from "../../config/db.js";
import { AppError } from "../../utils/AppError.js";
import * as repository from "./location-master.repository.js";

const clean = (value) => String(value ?? "").trim().replace(/\s+/g, " ");

function activeFlag(value) {
  return String(value || "Y").toUpperCase() === "N" ? "N" : "Y";
}

function validId(value) {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1) {
    throw new AppError("Invalid Location Master record.");
  }
  return id;
}

function normalize(data) {
  const warehouseName = clean(data.warehouseName);
  const subinventoryCode = clean(data.subinventoryCode || "GENERAL").toUpperCase();
  const locationName = clean(data.locationName);
  if (!warehouseName) {
    throw new AppError("Warehouse is required.");
  }
  if (!locationName) {
    throw new AppError("Location Name is required.");
  }
  if (!/^[A-Z0-9_]+$/.test(subinventoryCode) || subinventoryCode.length > 40) {
    throw new AppError("Select a valid sub-inventory.");
  }
  if (warehouseName.length > 80) {
    throw new AppError("Warehouse must be at most 80 characters.");
  }
  if (locationName.length > 100) {
    throw new AppError("Location Name must be at most 100 characters.");
  }
  return { warehouseName, subinventoryCode, locationName, activeFlag: activeFlag(data.activeFlag) };
}

function paged(rows, query) {
  const page = Math.max(Number(query.page || 1), 1);
  const pageSize = Math.min(Math.max(Number(query.pageSize || 20), 1), 100);
  return {
    rows: rows.slice((page - 1) * pageSize, page * pageSize),
    total: rows.length,
    page,
    pageSize,
  };
}

export async function listLocations(query, user) {
  const status = ["Y", "N"].includes(String(query.status || "").toUpperCase())
    ? String(query.status).toUpperCase()
    : "";
  const rows = await repository.listLocations({
    tenantId: user.tenantId,
    search: clean(query.search),
    status,
  });
  return paged(rows, query);
}

export async function listWarehouseNames(user) {
  return repository.listWarehouseNames(user.tenantId);
}

export async function listSubinventories(user) {
  return repository.listSubinventories(user.tenantId);
}

export async function saveLocation(locationMasterId, data, user) {
  const row = normalize(data);
  return withTransaction(async (connection) => {
    const id = locationMasterId ? validId(locationMasterId) : 0;
    const previous = id ? await repository.getLocation(connection, { tenantId: user.tenantId, locationMasterId: id }) : null;
    if (id && !previous) throw new AppError("Location Master record not found.", 404);
    if (await repository.findConflict(connection, {
      tenantId: user.tenantId,
      locationMasterId: id,
      warehouseName: row.warehouseName,
      locationName: row.locationName,
    })) {
      throw new AppError("This Warehouse and Location combination already exists.", 409);
    }
    const activeSubinventories = await repository.listSubinventories(user.tenantId, connection);
    if (!activeSubinventories.some((entry) => entry.subinventoryCode === row.subinventoryCode)) {
      throw new AppError("Select an active sub-inventory.", 409);
    }

    if (id) {
      const updated = await repository.updateLocation(connection, {
        tenantId: user.tenantId,
        locationMasterId: id,
        ...row,
        userCode: user.userCode,
      });
      if (!updated) throw new AppError("Location Master record not found.", 404);
      await repository.syncInventoryLocation(connection, { tenantId: user.tenantId, ...row, previous });
      return { locationMasterId: id, ...row };
    }

    const createdId = await repository.insertLocation(connection, {
      tenantId: user.tenantId,
      ...row,
      userCode: user.userCode,
    });
    await repository.syncInventoryLocation(connection, { tenantId: user.tenantId, ...row });
    return { locationMasterId: createdId, ...row };
  });
}
