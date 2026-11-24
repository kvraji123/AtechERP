import { api } from "./client";

export const marketingApi = {
  dashboardSummary: () =>
    api.get("/marketing/enquiries/dashboard-summary").then((response) => response.data),
  list: (params: { activeFlag?: "Y" | "N"; search?: string; page?: number; pageSize?: number; filters?: string } = {}) =>
    api
      .get("/marketing/enquiries", { params })
      .then((response) => response.data),

  enquiryFilterOptions: () =>
    api
      .get("/marketing/enquiries/filter-options")
      .then((response) => response.data),

  get: (enquiryId: number) =>
    api
      .get(`/marketing/enquiries/${enquiryId}`)
      .then((response) => response.data),

  getEnquiryRevisions: (enquiryId: number) =>
    api
      .get(`/marketing/enquiries/${enquiryId}/revisions`)
      .then((response) => response.data),

  create: (body: unknown) =>
    api
      .post("/marketing/enquiries", body)
      .then((response) => response.data),

  update: (enquiryId: number, body: unknown) =>
    api
      .put(`/marketing/enquiries/${enquiryId}`, body)
      .then((response) => response.data),

  deleteEnquiry: (enquiryId: number) =>
    api
      .delete(`/marketing/enquiries/${enquiryId}`)
      .then((response) => response.data),

  hardDeleteEnquiry: (enquiryId: number) =>
    api
      .delete(`/marketing/enquiries/${enquiryId}/hard`)
      .then((response) => response.data),


  changeEnquiryStatus: (
    enquiryId: number,
    enquiryStatus: "ORDER_RECEIVED"
  ) =>
    api
      .patch(`/marketing/enquiries/${enquiryId}/status`, {
        enquiryStatus,
      })
      .then((response) => response.data),

  eligible: (enquiryId: number) =>
    api
      .get(
        `/marketing/enquiries/${enquiryId}/quotation-eligible-parts`
      )
      .then((response) => response.data),

  getFeasibility: (enquiryPartId: number) =>
    api
      .get(
        `/marketing/enquiry-parts/${enquiryPartId}/feasibility`
      )
      .then((response) => response.data),

  saveFeasibility: (
    enquiryPartId: number,
    body: unknown,
    submit = false
  ) => {
    const url = submit
      ? `/marketing/enquiry-parts/${enquiryPartId}/feasibility/submit`
      : `/marketing/enquiry-parts/${enquiryPartId}/feasibility`;

    return submit
      ? api.post(url, body).then((response) => response.data)
      : api.put(url, body).then((response) => response.data);
  },

  generateRegretLetter: (enquiryPartId: number) =>
    api
      .post(
        `/marketing/enquiry-parts/${enquiryPartId}/feasibility/regret-letter/generate`
      )
      .then((response) => response.data),

  previewRegretLetter: (enquiryPartId: number) =>
    api
      .get(
        `/marketing/enquiry-parts/${enquiryPartId}/feasibility/regret-letter/preview`
      )
      .then((response) => response.data),

  approveRegretLetter: (enquiryPartId: number) =>
    api
      .post(
        `/marketing/enquiry-parts/${enquiryPartId}/feasibility/regret-letter/approve`
      )
      .then((response) => response.data),

  markRegretLetterSent: (enquiryPartId: number) =>
    api
      .post(
        `/marketing/enquiry-parts/${enquiryPartId}/feasibility/regret-letter/sent`
      )
      .then((response) => response.data),


  getWorkout: (enquiryPartId: number) =>
    api
      .get(`/marketing/enquiry-parts/${enquiryPartId}/workout`)
      .then((response) => response.data),

  saveWorkout: (
    enquiryPartId: number,
    body: unknown,
    submit = false
  ) => {
    const url = submit
      ? `/marketing/enquiry-parts/${enquiryPartId}/workout/submit`
      : `/marketing/enquiry-parts/${enquiryPartId}/workout`;

    return submit
      ? api.post(url, body).then((response) => response.data)
      : api.put(url, body).then((response) => response.data);
  },

  getQuotation: (enquiryId: number) =>
    api
      .get(`/marketing/enquiries/${enquiryId}/quotation`)
      .then((response) => response.data),

  saveQuotation: (
    enquiryId: number,
    body: unknown,
    submit = false
  ) => {
    const url = submit
      ? `/marketing/enquiries/${enquiryId}/quotation/submit`
      : `/marketing/enquiries/${enquiryId}/quotation`;

    return submit
      ? api.post(url, body).then((response) => response.data)
      : api.put(url, body).then((response) => response.data);
  },

  generateQuotationPdf: (enquiryId: number) =>
    api
      .post(`/marketing/enquiries/${enquiryId}/quotation/pdf`)
      .then((response) => response.data),

    sendQuotationEmail: (
    enquiryId: number,
    body: { to: string; subject: string; body: string }
  ) =>
    api
      .post(`/marketing/enquiries/${enquiryId}/quotation/email`, body)
      .then((response) => response.data),

};
