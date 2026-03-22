const { S3Client, PutObjectCommand, ListObjectsV2Command, HeadObjectCommand } = require("@aws-sdk/client-s3");

function makeR2Client() {
  return new S3Client({
    region: process.env.R2_REGION || "auto",
    endpoint: process.env.R2_S3_ENDPOINT,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
    }
  });
}

async function putObject({ client, bucket, key, body, contentType, contentLength }) {
  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: contentType,
    ContentLength: contentLength
  }));
  return key;
}


async function headObject({ client, bucket, key }) {
  return client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
}

async function listByPrefix({ client, bucket, prefix }) {
  const out = [];
  let ContinuationToken = undefined;

  do {
    const res = await client.send(new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
      ContinuationToken
    }));

    (res.Contents || []).forEach(obj => out.push({
      key: obj.Key,
      size: obj.Size,
      lastModified: obj.LastModified
    }));

    ContinuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (ContinuationToken);

  return out;
}

function publicUrlForKey(key) {
  const base = process.env.R2_PUBLIC_BASE_URL.replace(/\/+$/, "");
  // preserva / (path) e encode somente o necessário
  return `${base}/${encodeURIComponent(key).replaceAll("%2F", "/")}`;
}

module.exports = { makeR2Client, putObject, listByPrefix, publicUrlForKey, headObject };
