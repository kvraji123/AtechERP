import assert from "node:assert/strict";
import { db } from "../src/config/db.js";
import * as service from "../src/modules/technicalMaster/technicalMaster.service.js";

const suffix = `${Date.now()}`.slice(-8);
let operationId = 0;
let instrumentId = 0;
let toleranceId = 0;
let dispositionId = 0;
let reasonId = 0;

try {
  const sources = await service.listSources();
  assert.ok(sources.some((row) => row.sourceCode === "INHOUSE"));
  assert.ok(sources.some((row) => row.sourceCode === "OUTSOURCE"));

  const operation = await service.saveOperation(0, {
    operationCode:`TEST_OP_${suffix}`, operationName:`Test Operation ${suffix}`,
    defaultSource:"INHOUSE", displayOrder:999, activeFlag:"Y",
  });
  operationId = operation.operationMasterId;
  assert.equal(operation.sourceName,"In-house");
  const operations = await service.listOperations({ search:suffix });
  assert.ok(operations.some((row) => row.operationMasterId === operationId));

  const instrument = await service.saveInstrument(0, {
    instrumentCode:`TEST_INS_${suffix}`, instrumentName:`Test Instrument ${suffix}`, activeFlag:"Y",
  });
  instrumentId = instrument.instrumentMasterId;
  const instruments = await service.listInstruments({ search:suffix });
  assert.ok(instruments.some((row) => row.instrumentMasterId === instrumentId));

  const tolerance = await service.saveToleranceGrade(0, {
    gradeCode:`Z${suffix.slice(-3)}`, basicSizeFrom:9000, basicSizeTo:9001,
    lowerDeviationMicrons:0, upperDeviationMicrons:10, activeFlag:"Y",
  });
  toleranceId = tolerance.toleranceGradeId;
  const tolerances = await service.listToleranceGrades({ search:tolerance.gradeCode });
  assert.ok(tolerances.some((row) => row.toleranceGradeId === toleranceId));

  const disposition = await service.saveRejectionDisposition(0, {
    dispositionCode:`TEST_DISP_${suffix}`, dispositionName:`Test disposition ${suffix}`,
    partyAction:"INTERNAL", stockAction:"QUARANTINE", activeFlag:"Y",
  });
  dispositionId = disposition.rejectionDispositionId;
  const dispositions = await service.listRejectionDispositions({ search:suffix });
  assert.ok(dispositions.some((row) => row.rejectionDispositionId === dispositionId));

  const reason = await service.saveRejectionReason(0, {
    reasonCode:`TEST_REASON_${suffix}`, reasonName:`Test rejection reason ${suffix}`,
    reasonCategory:"QUALITY", applicableReceiptTypes:"OPEN_PURCHASE,CUSTOMER_SUPPLIED",
    defaultDispositionId:dispositionId, requireRemarks:"Y", requireAttachment:"N", activeFlag:"Y",
  });
  reasonId = reason.rejectionReasonId;
  const reasons = await service.listRejectionReasons({ search:suffix });
  assert.ok(reasons.some((row) => row.rejectionReasonId === reasonId && row.defaultDispositionId === dispositionId));

  await service.saveOperation(operationId,{ ...operation,operationName:`Updated Operation ${suffix}` });
  await service.saveInstrument(instrumentId,{ ...instrument,instrumentName:`Updated Instrument ${suffix}` });
  await service.saveToleranceGrade(toleranceId,{ ...tolerance,upperDeviationMicrons:12 });
  await service.saveRejectionDisposition(dispositionId,{ ...disposition,dispositionName:`Updated disposition ${suffix}` });
  await service.saveRejectionReason(reasonId,{ ...reason,reasonName:`Updated rejection reason ${suffix}` });
  console.log("Technical master API/service integration test passed.");
} finally {
  if (operationId) await db.execute("DELETE FROM operation_master WHERE operation_master_id=?",[operationId]);
  if (instrumentId) await db.execute("DELETE FROM inspection_instrument_master WHERE instrument_master_id=?",[instrumentId]);
  if (toleranceId) await db.execute("DELETE FROM tolerance_grade_master WHERE tolerance_grade_id=?",[toleranceId]);
  if (reasonId) await db.execute("DELETE FROM rejection_reason_master WHERE rejection_reason_id=?",[reasonId]);
  if (dispositionId) await db.execute("DELETE FROM rejection_disposition_master WHERE rejection_disposition_id=?",[dispositionId]);
  await db.end();
}
