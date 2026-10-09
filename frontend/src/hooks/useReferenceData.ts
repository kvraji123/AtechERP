import { useEffect, useMemo, useState } from "react";
import { apiMessage } from "../api/client";
import { referenceApi, type ReferenceData } from "../api/reference.api";

const empty: ReferenceData = { references: [], materials: [], uoms: [], grades: [] };

export function useReferenceData(types: string[]) {
  const key = types.join(",");
  const [data, setData] = useState<ReferenceData>(empty);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setError("");
    referenceApi.get(types).then((response) => {
      if (!Array.isArray(response?.data?.references)) {
        throw new Error("Dropdown options could not be loaded. Check the API connection and refresh the page.");
      }
      if (active) setData(response.data);
    }).catch((reason) => { if (active) setError(apiMessage(reason)); });
    return () => { active = false; };
  }, [key]);
  const options = useMemo(() => (type: string) =>
    data.references.filter((row) => row.referenceType === type), [data.references]);
  return { ...data, options, error };
}
