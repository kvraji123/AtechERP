import { AppError } from "../../utils/AppError.js";
import fs from "fs/promises";
import { sendSuccess } from "../../utils/response.js";
import * as service from "./supplier-quotation.service.js";

export async function list(req,res){const result=await service.list(req.query,req.user);return sendSuccess(res,{data:result.rows,meta:{page:result.page,pageSize:result.pageSize}});}
export async function create(req,res){return sendSuccess(res,{statusCode:201,message:"Supplier quotation recorded.",data:await service.create(req.body,req.user)});}
export async function get(req,res){return sendSuccess(res,{data:await service.get(req.params.id,req.user)});}
export async function uploadAttachment(req,res){
  if(!req.file) throw new AppError("Select a supplier quotation PDF to upload.");
  let extraction;
  try { extraction=await service.extractQuotationPdf(req.file.path); }
  catch(error) { await fs.unlink(req.file.path).catch(()=>{}); throw error; }
  return sendSuccess(res,{statusCode:201,message:"Quotation PDF uploaded and extracted. Review the populated values before saving.",data:{fileName:req.file.originalname,fileUrl:`/uploads/marketing/purchase-quotations/${req.file.filename}`,extraction}});
}
