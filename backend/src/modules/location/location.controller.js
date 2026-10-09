import { sendSuccess } from "../../utils/response.js";
import * as service from "./location.service.js";

export async function searchCities(req, res) {
  const cities = service.searchCities(req.query);

  return sendSuccess(res, {
    data: cities,
    meta: {
      total: cities.length,
      search: String(req.query.search || "").trim(),
    },
  });
}
