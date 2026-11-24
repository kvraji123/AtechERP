import { sendSuccess } from "../../utils/response.js";
import * as service from "./technicalMaster.service.js";

export async function listSources(req,res) { return sendSuccess(res,{ data:await service.listSources(req.query.includeInactive === "true") }); }
const listResponse = (res, result) => Array.isArray(result) ? sendSuccess(res,{ data:result }) : sendSuccess(res,{ data:result.rows,meta:{ total:result.total,page:result.page,pageSize:result.pageSize } });
export async function listOperations(req,res) { return listResponse(res,await service.listOperations(req.query)); }
export async function createOperation(req,res) { return sendSuccess(res,{ statusCode:201,message:"Operation Name Master created successfully.",data:await service.saveOperation(0,req.body) }); }
export async function updateOperation(req,res) { return sendSuccess(res,{ message:"Operation Name Master updated successfully.",data:await service.saveOperation(req.params.operationMasterId,req.body) }); }
export async function listInstruments(req,res) { return listResponse(res,await service.listInstruments(req.query)); }
export async function createInstrument(req,res) { return sendSuccess(res,{ statusCode:201,message:"Instrument Master created successfully.",data:await service.saveInstrument(0,req.body) }); }
export async function updateInstrument(req,res) { return sendSuccess(res,{ message:"Instrument Master updated successfully.",data:await service.saveInstrument(req.params.instrumentMasterId,req.body) }); }
export async function listDepartments(req,res) { return listResponse(res,await service.listDepartments(req.query)); }
export async function createDepartment(req,res) { return sendSuccess(res,{ statusCode:201,message:"Department Master created successfully.",data:await service.saveDepartment(0,req.body) }); }
export async function updateDepartment(req,res) { return sendSuccess(res,{ message:"Department Master updated successfully.",data:await service.saveDepartment(req.params.departmentId,req.body) }); }
export async function listToleranceGrades(req,res) { return listResponse(res,await service.listToleranceGrades(req.query)); }
export async function createToleranceGrade(req,res) { return sendSuccess(res,{ statusCode:201,message:"Tolerance Grade Master created successfully.",data:await service.saveToleranceGrade(0,req.body) }); }
export async function updateToleranceGrade(req,res) { return sendSuccess(res,{ message:"Tolerance Grade Master updated successfully.",data:await service.saveToleranceGrade(req.params.toleranceGradeId,req.body) }); }
export async function listInspectionCharacteristics(req,res) { return listResponse(res,await service.listInspectionCharacteristics(req.query)); }
export async function createInspectionCharacteristic(req,res) { return sendSuccess(res,{ statusCode:201,message:"Inspection Characteristic LOV created successfully.",data:await service.saveInspectionCharacteristic(0,req.body) }); }
export async function updateInspectionCharacteristic(req,res) { return sendSuccess(res,{ message:"Inspection Characteristic LOV updated successfully.",data:await service.saveInspectionCharacteristic(req.params.characteristicMasterId,req.body) }); }
export async function listInspectionFrequencies(req,res) { return listResponse(res,await service.listInspectionFrequencies(req.query)); }
export async function createInspectionFrequency(req,res) { return sendSuccess(res,{ statusCode:201,message:"Inspection Frequency LOV created successfully.",data:await service.saveInspectionFrequency(0,req.body) }); }
export async function updateInspectionFrequency(req,res) { return sendSuccess(res,{ message:"Inspection Frequency LOV updated successfully.",data:await service.saveInspectionFrequency(req.params.frequencyId,req.body) }); }
export async function listRejectionDispositions(req,res) { return listResponse(res,await service.listRejectionDispositions(req.query)); }
export async function createRejectionDisposition(req,res) { return sendSuccess(res,{ statusCode:201,message:"Rejection Disposition Master created successfully.",data:await service.saveRejectionDisposition(0,req.body) }); }
export async function updateRejectionDisposition(req,res) { return sendSuccess(res,{ message:"Rejection Disposition Master updated successfully.",data:await service.saveRejectionDisposition(req.params.rejectionDispositionId,req.body) }); }
export async function listRejectionReasons(req,res) { return listResponse(res,await service.listRejectionReasons(req.query)); }
export async function createRejectionReason(req,res) { return sendSuccess(res,{ statusCode:201,message:"Rejection Reason Master created successfully.",data:await service.saveRejectionReason(0,req.body) }); }
export async function updateRejectionReason(req,res) { return sendSuccess(res,{ message:"Rejection Reason Master updated successfully.",data:await service.saveRejectionReason(req.params.rejectionReasonId,req.body) }); }
