import { sendSuccess } from "../../utils/response.js";
import * as service from "./grn.service.js";
export async function list(req,res){const result=await service.list(req.query,req.user);return sendSuccess(res,{data:result.rows,meta:{total:result.total,page:result.page,pageSize:result.pageSize}});}
export async function summary(req,res){return sendSuccess(res,{data:await service.summary(req.user)});}
export async function listSupplierOptions(req,res){return sendSuccess(res,{data:await service.listSupplierOptions(req.user)});}
export async function get(req,res){return sendSuccess(res,{data:await service.get(req.params.id,req.user)});}
export async function create(req,res){return sendSuccess(res,{statusCode:201,message:"GRN entry saved.",data:await service.create(req.body,req.user)});}
export async function update(req,res){return sendSuccess(res,{message:"GRN entry updated.",data:await service.update(req.params.id,req.body,req.user)});}
export async function inspect(req,res){return sendSuccess(res,{message:"GRN inspection saved.",data:await service.inspect(req.params.id,req.body,req.user)});}
export async function post(req,res){return sendSuccess(res,{message:"GRN stock receipt posted and inventory updated.",data:await service.post(req.params.id,req.body,req.user)});}
export async function approvePurchase(req,res){return sendSuccess(res,{message:"Open purchase approved.",data:await service.approveOpenPurchase(req.params.id,req.user)});}
export async function listRejections(req,res){return sendSuccess(res,{data:await service.listRejections(req.params.id,req.user)});}
export async function uploadRejectionAttachment(req,res){return sendSuccess(res,{statusCode:201,message:"Rejection evidence uploaded.",data:await service.uploadRejectionAttachment(req.params.id,req.params.grnItemId,req.file,req.user)});}
export async function deleteRejectionAttachment(req,res){await service.deleteRejectionAttachment(req.params.id,req.params.grnItemId,req.params.attachmentId,req.user);return sendSuccess(res,{message:"Rejection evidence deleted."});}
