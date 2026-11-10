const API_BASE = import.meta.env.VITE_API_URL || "/api";

async function readError(response) {
  try {
    const body = await response.json();
    if (Array.isArray(body.detail)) {
      return body.detail.map((item) => item.msg.replace("Value error, ", "")).join(". ");
    }
    return body.detail || response.statusText;
  } catch {
    return response.statusText;
  }
}

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  return response.json();
}

function queryString(params) {
  const entries = Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== "");
  return entries.length ? `?${new URLSearchParams(entries).toString()}` : "";
}

export const api = {
  getMeta: () => request("/meta"),
  getTanks: (season, view) => request(`/tanks${queryString({ season, view })}`),
  getSummary: (season, view) => request(`/summary${queryString({ season, view })}`),
  getTank: (tankId, season) => request(`/tanks/${encodeURIComponent(tankId)}${queryString({ season })}`),
  forecastTank: (tankId, data) => request(`/tanks/${encodeURIComponent(tankId)}/forecast`, { method: "POST", body: data }),
  getTankHistory: (tankId, start, end) =>
    request(`/tanks/${encodeURIComponent(tankId)}/history${queryString({ start, end })}`),
  getOrganizations: (tankId) => request(`/organizations${queryString({ tank_id: tankId })}`),
  getOrganization: (id) => request(`/organizations/${id}`),
  createOrganization: (data) => request("/organizations", { method: "POST", body: data }),
  updateOrganization: (id, data) => request(`/organizations/${id}`, { method: "PUT", body: data }),
  deleteOrganization: (id) => request(`/organizations/${id}`, { method: "DELETE" }),
  generatePlans: (season) => request(`/plans/generate${queryString({ season })}`, { method: "POST" }),
  getPlans: (season) => request(`/plans${queryString({ season })}`),
  updatePlanText: (id, messageText) => request(`/plans/${id}`, { method: "PUT", body: { message_text: messageText } }),
  deletePlan: (id) => request(`/plans/${id}`, { method: "DELETE" }),
  approvePlan: (id) => request(`/plans/${id}/approve`, { method: "POST" }),
  sendPlan: (id) => request(`/plans/${id}/send`, { method: "POST" }),
  sendApprovedPlans: (season) => request(`/plans/send-approved${queryString({ season })}`, { method: "POST" }),
  resendMessage: (id) => request(`/messages/${id}/resend`, { method: "POST" }),
  deleteMessage: (id) => request(`/messages/${id}`, { method: "DELETE" }),
  getMessages: (direction) => request(`/messages${queryString({ direction })}`),
  simulateReply: (data = {}) => request("/messages/simulate-reply", { method: "POST", body: data }),
  getDrift: () => request("/drift"),
  getDataHealth: () => request("/data-health"),
  getModelPerformance: () => request("/model-performance"),
};
