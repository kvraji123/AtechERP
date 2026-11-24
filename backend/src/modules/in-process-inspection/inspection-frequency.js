import { AppError } from "../../utils/AppError.js";

const allFrequencyCodes = new Set(["100%", "100_PERCENT", "ALL", "EVERY"]);
const allSampleCodes = new Set(["100%", "100_PERCENT", "ALL"]);

const text = (value) => String(value ?? "").trim().toUpperCase();

function positiveInteger(value) {
  const normalized = String(value ?? "").trim();
  if (!/^\d+$/.test(normalized)) return null;
  const result = Number(normalized);
  return Number.isSafeInteger(result) && result > 0 ? result : null;
}

/**
 * Converts an approved inspection-frequency master value into the exact
 * piece-counter policy used on the shop floor.  Time based frequencies remain
 * deliberately unsupported here: a shift/calendar scheduler is required for
 * them and guessing would silently skip quality checks.
 */
export function parsePieceFrequency(value) {
  const code = text(value);
  if (allFrequencyCodes.has(code)) return { kind: "EVERY_PIECE", interval: 1, code };

  const interval = positiveInteger(code);
  if (interval) return { kind: "PIECE_INTERVAL", interval, code };

  throw new AppError(
    `Inspection frequency '${String(value ?? "").trim() || "(blank)"}' cannot be used for piece-count in-process inspection. Use 100% or a positive piece interval.`,
    400,
    { code: "IN_PROCESS_FREQUENCY_NOT_COUNT_BASED" }
  );
}

/**
 * A 100% characteristic is recorded against exactly one physical piece every
 * time.  For an interval such as 5, the sample size is the number of distinct
 * pieces the inspector must select from that five-piece window.
 */
export function parseSampleSize(value, frequency) {
  const code = text(value);
  if (frequency.kind === "EVERY_PIECE") {
    if (!code || allSampleCodes.has(code) || code === "1") return 1;
    throw new AppError(
      "A 100% inspection frequency must inspect every individual piece; use sample size 100% or 1.",
      400,
      { code: "INVALID_100_PERCENT_SAMPLE_SIZE" }
    );
  }

  if (allSampleCodes.has(code)) {
    throw new AppError(
      "Sample size 100% can only be used with 100% inspection frequency.",
      400,
      { code: "INVALID_INTERVAL_SAMPLE_SIZE" }
    );
  }

  const sampleSize = positiveInteger(code);
  if (!sampleSize) {
    throw new AppError("A positive numeric sample size is required for an interval inspection frequency.", 400, {
      code: "IN_PROCESS_SAMPLE_SIZE_REQUIRED",
    });
  }
  if (sampleSize > frequency.interval) {
    throw new AppError(
      `Sample size ${sampleSize} cannot exceed the ${frequency.interval}-piece inspection interval.`,
      400,
      { code: "IN_PROCESS_SAMPLE_SIZE_EXCEEDS_INTERVAL" }
    );
  }
  return sampleSize;
}

export function validateCharacteristicSampling({ inspectionFrequency, sampleSize }) {
  const frequency = parsePieceFrequency(inspectionFrequency);
  const requiredSampleSize = parseSampleSize(sampleSize, frequency);
  return { frequency, requiredSampleSize };
}

export function dueAtPieceSequence(frequency, pieceSequence) {
  const sequence = Number(pieceSequence);
  if (!Number.isSafeInteger(sequence) || sequence < 1) {
    throw new AppError("Piece sequence must be a positive whole number.", 400);
  }
  return frequency.kind === "EVERY_PIECE" || sequence % frequency.interval === 0;
}

export function samplingWindow(frequency, pieceSequence) {
  const sequence = Number(pieceSequence);
  if (frequency.kind === "EVERY_PIECE") return { start: sequence, end: sequence };
  return { start: sequence - frequency.interval + 1, end: sequence };
}

/**
 * Samples are deterministic and traceable. A one-piece sample is taken at
 * the frequency trigger. For a multi-piece sample, pick from the beginning
 * of the frequency window at a repeatable cadence: a 2-of-10 rule selects
 * positions 1 and 5; the next 10-piece window selects 11 and 15.
 */
export function automaticSampleSequences(window, requiredSampleSize) {
  const sampleSize = Number(requiredSampleSize);
  if (!Number.isSafeInteger(sampleSize) || sampleSize < 1) {
    throw new AppError("Required sample size must be a positive whole number.", 400);
  }
  const start = Number(window?.start);
  const end = Number(window?.end);
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 1 || end < start) {
    throw new AppError("Sampling window is invalid.", 400);
  }
  const windowSize = end - start + 1;
  if (sampleSize > windowSize) {
    throw new AppError("Required sample size exceeds the sampling window.", 400);
  }
  if (sampleSize === 1) return [end];

  const cadence = Math.max(1, Math.floor((windowSize - 1) / sampleSize));
  return Array.from({ length: sampleSize }, (_, index) => start + index * cadence);
}

/**
 * Builds due events without merging characteristics.  This is important: a
 * part can have Diameter at 100% and Surface Finish at 1 of 5; the fifth
 * piece must therefore expose both independent checks.
 */
export function dueCharacteristicEvents(characteristics, pieceSequence) {
  return characteristics.flatMap((characteristic) => {
    const sampling = validateCharacteristicSampling(characteristic);
    if (!dueAtPieceSequence(sampling.frequency, pieceSequence)) return [];
    return [{
      characteristic,
      frequency: sampling.frequency,
      requiredSampleSize: sampling.requiredSampleSize,
      window: samplingWindow(sampling.frequency, pieceSequence),
    }];
  });
}

