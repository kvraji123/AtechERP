const numeric = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export function calculateProcessCostInr({
  sourceType,
  hourlyCostInr,
  cycleTimeSeconds,
  clampingTimeSeconds,
  outsourceCostInr,
}) {
  if (String(sourceType || "").toUpperCase() === "OUTSOURCE") {
    return Number(numeric(outsourceCostInr).toFixed(2));
  }

  const elapsedHours = (numeric(cycleTimeSeconds) + numeric(clampingTimeSeconds)) / 3600;
  return Number((numeric(hourlyCostInr) * elapsedHours).toFixed(2));
}
