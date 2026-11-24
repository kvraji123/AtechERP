import assert from "node:assert/strict";
import { db } from "../src/config/db.js";
import * as repository from "../src/modules/part/part.repository.js";

const connection = await db.getConnection();
try {
  await connection.beginTransaction();
  const [[part]] = await connection.query("SELECT part_id AS partId,drawing_revision_number AS revision FROM part_master ORDER BY part_id LIMIT 1");
  assert.ok(part, "At least one Part Master record is required for this integration test.");
  const masters = await repository.getProcessMasters(connection);
  const operation = masters.operations.find((row) => row.defaultSource === "OUTSOURCE") || masters.operations[0];
  const machineType = masters.machineTypes[0];
  const characteristic = masters.characteristics[0];
  const instrument = masters.instruments[0];
  const toleranceStandard = masters.toleranceStandards[0];
  assert.ok(operation && machineType && characteristic && instrument && toleranceStandard, "Process and Inspection masters must be seeded.");
  await repository.replaceProcessPlan(connection, part.partId, {
    drawingRevisionNumber: part.revision || "TEST",
    productionCapacityPerDay: 100,
    planStatus: "DRAFT",
    operations: [{ operationNumber:10,operationMasterId:operation.operationMasterId,
      operationDescription:"Transactional integration test",sourceType:"INHOUSE",machineTypeId:machineType.machineTypeId,
      cycleTimeSeconds:100,clampingTimeSeconds:200,settingTimeHours:2,
      outsourceCostInr:null,processCostInr:25,inspectionPlan:{ planStatus:"READY",cmmRequired:true,characteristics:[{
        sequenceNumber:1,balloonNumber:"B1",characteristicMasterId:null,characteristicText:"Surface finish - visual",
        specifiedDimension:10,toleranceMode:"MANUAL",toleranceGradeId:null,toleranceGradeText:"CUSTOM-TOL",toleranceMinus:0.1,
        toleranceStandardId:toleranceStandard.toleranceStandardId,tolerancePlus:0.1,lsl:9.9,usl:10.1,drawingGrid:"A1",instrumentMasterId:instrument.instrumentMasterId,
        sampleSize:"1",inspectionFrequency:"EVERY_PART",scCcIdentification:true,
        periodicOperatorRequired:true,finalInspectionRequired:false,
      }]},
    },{ operationNumber:20,operationMasterId:operation.operationMasterId,
      operationDescription:"Sequential operation persistence test",sourceType:"OUTSOURCE",machineTypeId:null,
      cycleTimeSeconds:null,clampingTimeSeconds:null,settingTimeHours:null,
      outsourceCostInr:100,processCostInr:100,inspectionPlan:null,
    }],
  }, "CODEX_TEST");
  const saved = await repository.getProcessPlan(part.partId, connection);
  assert.equal(saved.operations.length, 2);
  assert.equal(Number(saved.operations[0].machineTypeId), Number(machineType.machineTypeId));
  assert.equal(saved.operations[0].inspectionPlan.cmmRequired, "Y");
  assert.equal(saved.operations[0].inspectionPlan.characteristics[0].patrolQaResult, null);
  assert.equal(saved.operations[0].inspectionPlan.characteristics[0].toleranceGradeText, "CUSTOM-TOL");
  assert.equal(Number(saved.operations[0].inspectionPlan.characteristics[0].toleranceStandardId), Number(toleranceStandard.toleranceStandardId));
  assert.equal(saved.operations[0].inspectionPlan.characteristics[0].characteristicText, "Surface finish - visual");
  assert.equal(Number(saved.operations[0].inspectionPlan.characteristics[0].lsl), 9.9);
  const sharedDefinitionId = Number(saved.operations[0].processDefinitionId);
  assert.ok(sharedDefinitionId, "A reusable Process Definition ID must be assigned.");
  const sharedOperation = { operationNumber:10,processDefinitionId:sharedDefinitionId,
    operationMasterId:operation.operationMasterId,operationDescription:"Shared definition update",
    sourceType:"INHOUSE",machineTypeId:machineType.machineTypeId,cycleTimeSeconds:90,
    clampingTimeSeconds:20,settingTimeHours:1,outsourceCostInr:null,processCostInr:25,
    inspectionPlan:{ planStatus:"READY",cmmRequired:true,characteristics:[{
      sequenceNumber:1,balloonNumber:"B1",characteristicMasterId:null,characteristicText:"Surface finish - visual",
      specifiedDimension:10,toleranceMode:"MANUAL",toleranceGradeId:null,toleranceGradeText:"CUSTOM-TOL",
      toleranceStandardId:toleranceStandard.toleranceStandardId,toleranceMinus:0.1,tolerancePlus:0.1,lsl:9.9,usl:10.1,drawingGrid:"A1",
      instrumentMasterId:instrument.instrumentMasterId,sampleSize:"1",inspectionFrequency:"EVERY_PART",
      scCcIdentification:true,periodicOperatorRequired:true,finalInspectionRequired:true,
    }]},
  };
  const clonedDraftOperation = { ...sharedOperation,inspectionPlan:{ ...sharedOperation.inspectionPlan,
    planStatus:"DRAFT",characteristics:sharedOperation.inspectionPlan.characteristics.map((row) => ({ ...row,
      finalInspectionRequired:false,
    })) } };
  await repository.replaceProcessPlans(connection,part.partId,[
    { processPlanId:saved.processPlanId,planCode:saved.planCode,routeName:"With Cutting",
      drawingRevisionNumber:part.revision || "TEST",productionCapacityPerDay:100,
      planStatus:"DRAFT",isDefault:true,activeFlag:"Y",operations:[sharedOperation] },
    { planCode:"PP-SHARED-TEST",routeName:"Without Cutting",
      drawingRevisionNumber:part.revision || "TEST",productionCapacityPerDay:200,
      planStatus:"DRAFT",isDefault:false,activeFlag:"Y",operations:[clonedDraftOperation] },
  ],"CODEX_TEST");
  const variants = await repository.getProcessPlans(part.partId,connection);
  assert.equal(variants.length,2,"Two Process Plan Variants must be stored independently.");
  assert.equal(Number(variants[0].operations[0].processDefinitionId),
    Number(variants[1].operations[0].processDefinitionId),"Variants must share the same Process Definition ID.");
  assert.equal(variants[0].operations[0].operationDescription,"Shared definition update");
  assert.equal(variants[1].operations[0].operationDescription,"Shared definition update");
  assert.equal(variants[0].operations[0].sharedVariantCount,2);
  const originalVariant = variants.find((plan) => plan.routeName === "With Cutting");
  const clonedVariant = variants.find((plan) => plan.routeName === "Without Cutting");
  assert.ok(originalVariant && clonedVariant,"Both named Process Plan Variants must be returned.");
  assert.equal(originalVariant.operations[0].inspectionPlan.planStatus,"READY");
  assert.equal(clonedVariant.operations[0].inspectionPlan.planStatus,"DRAFT",
    "Cloned variants must keep an independent Draft Inspection Plan.");
  await repository.replaceProcessPlans(connection,part.partId,[{
    ...originalVariant,operations:originalVariant.operations,
  }],"CODEX_TEST");
  const afterDraftDelete = await repository.getProcessPlans(part.partId,connection);
  assert.equal(afterDraftDelete.length,1,"A removed Draft Process Plan Variant must be deleted.");
  console.log("Process Plan Variant and shared Process Definition transactional integration test passed.");
  await connection.rollback();
} catch (error) {
  await connection.rollback();
  throw error;
} finally {
  connection.release();
  await db.end();
}
