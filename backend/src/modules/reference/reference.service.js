import * as repository from "./reference.repository.js";

export function getReferenceData(query = {}) {
  const types = String(query.types || "").split(",");
  return repository.getReferenceData(types);
}
