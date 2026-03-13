import { randomBytes } from "crypto";
import { v2 as cloudinary } from "cloudinary";
import { z } from "zod";

const cloudinaryResponseSchema = z.object({
  secure_url: z.string().url(),
  public_id: z.string(),
  bytes: z.number().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  format: z.string().optional(),
  error: z
    .object({
      message: z.string(),
    })
    .optional(),
});

type CloudinaryConfig = {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
  folder: string;
};

function getCloudinaryConfig() {
  return {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
    folder: process.env.CLOUDINARY_UPLOAD_FOLDER || "rivox",
  };
}

export function isCloudinaryConfigured(): boolean {
  const config = getCloudinaryConfig();
  return Boolean(config.cloudName && config.apiKey && config.apiSecret);
}

function getRequiredCloudinaryConfig(): CloudinaryConfig {
  const config = getCloudinaryConfig();

  if (!config.cloudName || !config.apiKey || !config.apiSecret) {
    throw new Error(
      "Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.",
    );
  }

  return {
    cloudName: config.cloudName,
    apiKey: config.apiKey,
    apiSecret: config.apiSecret,
    folder: config.folder,
  };
}

function configureCloudinary(config: CloudinaryConfig): void {
  cloudinary.config({
    cloud_name: config.cloudName,
    api_key: config.apiKey,
    api_secret: config.apiSecret,
    secure: true,
  });
}

function normalizeImagePayload(fileData: string): string {
  const trimmed = fileData.trim();

  if (trimmed.startsWith("data:image/")) {
    return trimmed;
  }

  if (/^[A-Za-z0-9+/=\r\n]+$/.test(trimmed)) {
    const normalized = trimmed.replace(/\s+/g, "");
    return `data:image/png;base64,${normalized}`;
  }

  throw new Error("Invalid image payload. Provide a base64 data URL or base64 string.");
}

function buildPublicId(prefix: string): string {
  return `${prefix}-${Date.now()}-${randomBytes(4).toString("hex")}`;
}

export type UploadedImageResult = {
  url: string;
  publicId: string;
  bytes?: number;
  width?: number;
  height?: number;
  format?: string;
};

export async function uploadImageFromUrl(
  imageUrl: string,
  options?: { publicIdPrefix?: string; folder?: string },
): Promise<UploadedImageResult> {
  const config = getRequiredCloudinaryConfig();
  configureCloudinary(config);
  const folder = options?.folder || config.folder;
  const publicId = buildPublicId(options?.publicIdPrefix || "rivox");

  const payload = await cloudinary.uploader.upload(imageUrl, {
    folder,
    public_id: publicId,
    resource_type: "image",
    overwrite: false,
  });

  const parsed = cloudinaryResponseSchema.safeParse(payload);
  if (!parsed.success) throw new Error("Unexpected Cloudinary response format.");

  return {
    url: parsed.data.secure_url,
    publicId: parsed.data.public_id,
    bytes: parsed.data.bytes,
    width: parsed.data.width,
    height: parsed.data.height,
    format: parsed.data.format,
  };
}

export async function uploadImageToCloudinary(
  fileData: string,
  options?: { publicIdPrefix?: string; folder?: string },
): Promise<UploadedImageResult> {
  const config = getRequiredCloudinaryConfig();
  configureCloudinary(config);
  const normalizedFile = normalizeImagePayload(fileData);
  const folder = options?.folder || config.folder;
  const publicId = buildPublicId(options?.publicIdPrefix || "rivox");

  const payload = await cloudinary.uploader.upload(normalizedFile, {
    folder,
    public_id: publicId,
    resource_type: "image",
    overwrite: false,
  });

  const parsed = cloudinaryResponseSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error("Unexpected Cloudinary response format.");
  }

  return {
    url: parsed.data.secure_url,
    publicId: parsed.data.public_id,
    bytes: parsed.data.bytes,
    width: parsed.data.width,
    height: parsed.data.height,
    format: parsed.data.format,
  };
}
