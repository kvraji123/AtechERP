import { api } from "./client";

export type ReferenceOption = { value: string; label: string; numericValue?: number };
export type ReferenceData = {
  references: Array<ReferenceOption & { referenceType: string }>;
  materials: Array<{ materialId: number; materialName: string }>;
  uoms: Array<{ uomId: number; uomCode: string; uomName: string }>;
  grades: Array<{ materialGradeId: number; materialId: number; gradeCode: string; gradeName: string }>;
  departments: Array<{ departmentId: number; departmentCode: string; departmentName: string; displayOrder: number }>;
};

export const referenceApi = {
  get: (types: string[] = []) => api.get("/reference-data", {
    params: { types: types.join(",") },
  }).then((response) => response.data),
};
