const axios = require("axios");
const mime = require("mime-types");
const { v4: uuidv4 } = require("uuid");

function sanitizeProtocol(protocol) {
  if (!protocol || typeof protocol !== "string") throw new Error("protocol obrigatório");
  const p = protocol.trim().replace(/^\/+|\/+$/g, "");
  if (!p || p.includes("..") || p.includes("\\") || p.includes("%")) throw new Error("protocol inválido");
  return p;
}

function parseProtocols(input) {
  const raw = Array.isArray(input) ? input : [input];
  const parts = raw
    .flatMap((value) => String(value || "").split(","))
    .map((value) => value.trim())
    .filter(Boolean);

  const unique = [...new Set(parts)];
  if (!unique.length) throw new Error("protocol obrigatório");

  return unique.map(sanitizeProtocol);
}

function guessFilenameFromUrl(urlStr) {
  try {
    const u = new URL(urlStr);
    const last = u.pathname.split("/").filter(Boolean).pop();
    return last || null;
  } catch {
    return null;
  }
}

function safeExtFromContentType(contentType) {
  const ext = mime.extension(contentType || "");
  return ext ? `.${ext}` : "";
}

/**
 * CRM espera type como extensão: jpg|png|pdf...
 * Normaliza alguns casos comuns.
 */
function normalizeTypeExt(ext) {
  if (!ext) return "bin";
  const e = String(ext).trim().toLowerCase().replace(/^\./, "");
  if (e === "jpeg") return "jpg";
  return e;
}

async function materializeInputFile({ fileUrl, uploadedFile, maxMb }) {
  if (uploadedFile) {
    const buffer = Buffer.isBuffer(uploadedFile.buffer)
      ? uploadedFile.buffer
      : Buffer.from(uploadedFile.buffer || []);

    const maxBytes = Number(maxMb) * 1024 * 1024;
    if (buffer.length > maxBytes) {
      throw new Error(`Arquivo maior que ${maxMb}MB`);
    }

    return {
      buffer,
      contentType: uploadedFile.mimetype || "application/octet-stream",
      contentLength: buffer.length,
      originalName: uploadedFile.originalname || null,
      source: "upload"
    };
  }

  if (!fileUrl) {
    throw new Error("fileUrl ou file são obrigatórios");
  }

  const downloaded = await downloadAsBuffer(fileUrl, maxMb);
  return {
    ...downloaded,
    originalName: guessFilenameFromUrl(fileUrl),
    source: "url"
  };
}

/**
 * Baixa o arquivo como Buffer (arraybuffer) para garantir ContentLength conhecido.
 * Isso evita erros do AWS SDK/S3 ao enviar streams sem Content-Length.
 */
async function downloadAsBuffer(fileUrl, maxMb) {
  const allowed = (process.env.ALLOWED_URL_PROTOCOLS || "https,http")
    .split(",").map(s => s.trim());

  const u = new URL(fileUrl);
  if (!allowed.includes(u.protocol.replace(":", ""))) throw new Error("URL com protocolo não permitido");

  // Proteções SSRF básicas (recomendado: allowlist/denylist de IPs em produção)
  if (["localhost", "127.0.0.1", "::1"].includes(u.hostname)) {
    throw new Error("Hostname não permitido");
  }

  const res = await axios.get(fileUrl, {
    responseType: "arraybuffer",
    timeout: 30000,
    maxRedirects: 3,
    validateStatus: s => s >= 200 && s < 300
  });

  const contentType = res.headers["content-type"] || "application/octet-stream";
  const buffer = Buffer.from(res.data);

  const maxBytes = Number(maxMb) * 1024 * 1024;
  if (buffer.length > maxBytes) {
    throw new Error(`Arquivo maior que ${maxMb}MB`);
  }

  return { buffer, contentType, contentLength: buffer.length };
}

function makeObjectKey({ protocol, originalName, contentType }) {
  const base = (originalName || uuidv4()).replace(/[^\w.\-()]/g, "_");
  const hasExt = /\.[A-Za-z0-9]{1,8}$/.test(base);
  const ext = hasExt ? "" : safeExtFromContentType(contentType);
  return `${protocol}/${base}${ext}`;
}

module.exports = {
  sanitizeProtocol,
  parseProtocols,
  guessFilenameFromUrl,
  downloadAsBuffer,
  materializeInputFile,
  makeObjectKey,
  normalizeTypeExt
};
