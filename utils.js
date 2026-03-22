const axios = require("axios");

let cachedToken = null;
let tokenExpiresAt = 0;
const nowMs = () => Date.now();

async function fetchToken() {
  const res = await axios.post(
    process.env.CRM_TOKEN_URL,
    { username: process.env.CRM_USERNAME, password: process.env.CRM_PASSWORD },
    { headers: { "Content-Type": "application/json" }, timeout: 15000 }
  );

  const data = res.data;

  // Ajuste fino se necessário (depende do formato real do CRM):
  const accessToken =
    data.access_token ||
    data.token ||
    data?.data?.access_token ||
    data?.data?.token;

  // Se o CRM não retornar expires, assumimos 10 min
  const expiresInSec = data.expires_in || data?.data?.expires_in || 600;

  if (!accessToken) {
    throw new Error("CRM token response não contém access_token (ajuste o parser em src/crm.js).");
  }

  cachedToken = accessToken;
  tokenExpiresAt = nowMs() + (Number(expiresInSec) * 1000) - 30000; // renova 30s antes
  return cachedToken;
}

async function getValidToken() {
  if (cachedToken && nowMs() < tokenExpiresAt) return cachedToken;
  return fetchToken();
}

async function crmRequest(config) {
  const token = await getValidToken();
  try {
    return await axios({
      ...config,
      headers: {
        ...(config.headers || {}),
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      timeout: 20000
    });
  } catch (err) {
    if (err?.response?.status === 401) {
      await fetchToken();
      const token2 = await getValidToken();
      return axios({
        ...config,
        headers: {
          ...(config.headers || {}),
          Authorization: `Bearer ${token2}`,
          "Content-Type": "application/json"
        },
        timeout: 20000
      });
    }
    throw err;
  }
}

function tpl(urlTemplate, vars) {
  return urlTemplate.replace(/\{(\w+)\}/g, (_, k) => vars[k]);
}

async function sendToCrmUploadFromUrl({ ticketId, name, protocol, type, url }) {
  const endpoint = tpl(process.env.CRM_UPLOAD_FROM_URL_TEMPLATE, { ticketId });
  return crmRequest({
    method: "POST",
    url: endpoint,
    headers: {
      name: String(name ?? ""),
      protocol: String(protocol ?? ""),
      type: String(type ?? ""),
      url: String(url ?? "")
    },
    // Mantemos também no body por compatibilidade (alguns backends leem de lá)
    data: { url }
  });
}


async function sendToCrmUpdateFromUrl({ ticketId, attachmentId, name, protocol, type, url }) {
  const endpoint = tpl(process.env.CRM_UPDATE_FROM_URL_TEMPLATE, { ticketId, attachmentId });
  return crmRequest({
    method: "PUT",
    url: endpoint,
    headers: {
      name: String(name ?? ""),
      protocol: String(protocol ?? ""),
      type: String(type ?? ""),
      url: String(url ?? "")
    },
    data: { url }
  });
}


module.exports = { sendToCrmUploadFromUrl, sendToCrmUpdateFromUrl };
