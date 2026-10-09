import { sendSuccess } from "../../utils/response.js";
import * as service from "./gate-entry.service.js";
export async function list(req,res){const result=await service.list(req.query,req.user);return sendSuccess(res,{data:result.rows,meta:{total:result.total,page:result.page,pageSize:result.pageSize}});}
export async function summary(req,res){return sendSuccess(res,{data:await service.summary(req.user)});}
export async function listSupplierOptions(req,res){return sendSuccess(res,{data:await service.listSupplierOptions(req.user)});}
export async function get(req,res){return sendSuccess(res,{data:await service.get(req.params.id,req.user)});}
export async function eligibleOrders(req,res){return sendSuccess(res,{data:await service.eligibleOrders(req.user)});}
export async function create(req,res){return sendSuccess(res,{statusCode:201,message:"Gate entry saved.",data:await service.create(req.body,req.user)});}
export async function update(req,res){return sendSuccess(res,{message:"Gate entry updated.",data:await service.update(req.params.id,req.body,req.user)});}
