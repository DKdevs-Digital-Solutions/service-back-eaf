const Redis = require("ioredis");

const redis = new Redis(process.env.REDIS_URL);

function mapKey(ticketId, r2Key) {
  return `attmap:${ticketId}:${r2Key}`;
}

async function saveAttachmentMap({ ticketId, r2Key, attachmentId, publicUrl, protocol, name, type }) {
  const ttlDays = Number(process.env.REDIS_TTL_DAYS || 180);
  const ttlSec = ttlDays * 24 * 60 * 60;

  const key = mapKey(ticketId, r2Key);

  await redis.hset(key, {
    attachmentId,
    publicUrl,
    protocol,
    name,
    type,
    r2Key
  });

  await redis.expire(key, ttlSec);
}

async function getAttachmentMap(ticketId, r2Key) {
  const key = mapKey(ticketId, r2Key);
  const data = await redis.hgetall(key);
  if (!data || Object.keys(data).length === 0) return null;
  return data;
}

module.exports = { redis, saveAttachmentMap, getAttachmentMap };
