import { sendSuccess } from "../../utils/response.js";
import * as service from "./reference.service.js";

export async function getReferenceData(req, res) {
  return sendSuccess(res, { data: await service.getReferenceData(req.query) });
}
