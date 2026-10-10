import crypto from "node:crypto";

const getConfig = () => ({
  cloudName: process.env.CLOUDINARY_CLOUD_NAME,
  apiKey: process.env.CLOUDINARY_API_KEY,
  apiSecret: process.env.CLOUDINARY_API_SECRET,
});

export const isCloudinaryConfigured = () => {
  const { cloudName, apiKey, apiSecret } = getConfig();
  return Boolean(cloudName && apiKey && apiSecret);
};

const requireConfig = () => {
  const config = getConfig();
  if (!config.cloudName || !config.apiKey || !config.apiSecret) {
    const error = new Error("Cloudinary is not configured");
    error.code = "CLOUDINARY_NOT_CONFIGURED";
    throw error;
  }
  return config;
};

const signParams = (params, apiSecret) => {
  const payload = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");

  return crypto.createHash("sha1").update(payload + apiSecret).digest("hex");
};

export const uploadImage = async ({ buffer, mimetype, originalname, publicId }) => {
  const { cloudName, apiKey, apiSecret } = requireConfig();
  const timestamp = Math.floor(Date.now() / 1000);
  const folder = "ems/employee-profiles";
  const params = { folder, public_id: publicId, overwrite: true, timestamp };
  const signature = signParams(params, apiSecret);

  const form = new FormData();
  form.append("file", new Blob([buffer], { type: mimetype }), originalname || "profile-image");
  form.append("api_key", apiKey);
  form.append("timestamp", String(timestamp));
  form.append("folder", folder);
  form.append("public_id", publicId);
  form.append("overwrite", "true");
  form.append("signature", signature);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: "POST",
    body: form,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.secure_url || !data.public_id) {
    const error = new Error(data?.error?.message || "Cloudinary image upload failed");
    error.status = response.status;
    throw error;
  }

  return {
    url: data.secure_url,
    publicId: data.public_id,
    width: data.width,
    height: data.height,
    format: data.format,
    bytes: data.bytes,
  };
};

export const deleteImage = async (publicId) => {
  if (!publicId) return { result: "not found" };
  const { cloudName, apiKey, apiSecret } = requireConfig();
  const timestamp = Math.floor(Date.now() / 1000);
  const params = { public_id: publicId, timestamp };
  const signature = signParams(params, apiSecret);

  const form = new URLSearchParams();
  form.set("public_id", publicId);
  form.set("timestamp", String(timestamp));
  form.set("api_key", apiKey);
  form.set("signature", signature);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data?.error?.message || "Cloudinary image deletion failed");
    error.status = response.status;
    throw error;
  }

  return data;
};
