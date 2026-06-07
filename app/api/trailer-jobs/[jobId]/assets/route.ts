import { randomUUID } from "crypto";
import {
  getCineLifeConfigDiagnostics,
  saveTrailerAsset,
  updateTrailerJob,
  uploadToCloudinary,
} from "@/lib/providers";

export const runtime = "nodejs";
export const maxDuration = 120;

type UploadAssetsRequest = {
  userId?: unknown;
  photos?: unknown;
  voiceSample?: unknown;
};

type BrowserAsset = {
  dataUrl: string;
  name: string;
};

function jsonResponse(body: unknown, status = 200) {
  return Response.json(body, {
    headers: {
      "Cache-Control": "no-store",
    },
    status,
  });
}

function sanitizeText(value: unknown, fallback = "", maxLength = 180) {
  return typeof value === "string" && value.trim()
    ? value.trim().replace(/\s+/g, " ").slice(0, maxLength)
    : fallback;
}

function isDataUrl(value: unknown, prefix: string): value is string {
  return (
    typeof value === "string" &&
    value.startsWith(`data:${prefix}`) &&
    value.includes(";base64,")
  );
}

function decodeDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);

  if (!match) {
    throw new Error("Invalid data URL.");
  }

  return {
    buffer: Buffer.from(match[2], "base64"),
    mimeType: match[1],
  };
}

function parsePhotos(value: unknown) {
  if (!Array.isArray(value)) {
    return [] satisfies BrowserAsset[];
  }

  return value
    .map((photo): BrowserAsset | null => {
      if (!photo || typeof photo !== "object") {
        return null;
      }

      const source = photo as Record<string, unknown>;

      if (!isDataUrl(source.dataUrl, "image/")) {
        return null;
      }

      return {
        dataUrl: source.dataUrl,
        name: sanitizeText(source.name, "Uploaded photo"),
      };
    })
    .filter((photo): photo is BrowserAsset => Boolean(photo))
    .slice(0, 10);
}

function normalizeNumber(value: unknown, min: number, max: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }

  return Math.min(max, Math.max(min, value));
}

function normalizeVoiceSampleProfile(value: unknown) {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const source = value as Record<string, unknown>;
  const voiceFamily =
    source.voiceFamily === "lower" ||
    source.voiceFamily === "neutral" ||
    source.voiceFamily === "higher"
      ? source.voiceFamily
      : "neutral";
  const energy =
    source.energy === "soft" ||
    source.energy === "balanced" ||
    source.energy === "strong"
      ? source.energy
      : "balanced";
  const brightness =
    source.brightness === "warm" ||
    source.brightness === "balanced" ||
    source.brightness === "bright"
      ? source.brightness
      : "balanced";

  return {
    averageRms: normalizeNumber(source.averageRms, 0, 1),
    peakRms: normalizeNumber(source.peakRms, 0, 1),
    zeroCrossingRate: normalizeNumber(source.zeroCrossingRate, 0, 0.5),
    estimatedPitchHz:
      source.estimatedPitchHz === null
        ? null
        : normalizeNumber(source.estimatedPitchHz, 60, 400),
    voiceFamily,
    energy,
    brightness,
  };
}

export async function POST(
  request: Request,
  context: { params: Promise<{ jobId: string }> },
) {
  const config = await getCineLifeConfigDiagnostics();

  if (!config.isProductionReady) {
    return jsonResponse(
      {
        error:
          "CineLife production generation is not configured. Add OpenAI, Cloudinary, and Supabase environment variables.",
        diagnostics: config.diagnostics,
        missing: config.missing,
      },
      503,
    );
  }

  const { jobId } = await context.params;
  let body: UploadAssetsRequest;

  try {
    body = (await request.json()) as UploadAssetsRequest;
  } catch {
    return jsonResponse({ error: "Request body must be valid JSON." }, 400);
  }

  const userId = sanitizeText(body.userId, "", 80);
  const photos = parsePhotos(body.photos);

  if (!userId) {
    return jsonResponse({ error: "A Supabase anonymous userId is required." }, 400);
  }

  if (photos.length < 3 || photos.length > 10) {
    return jsonResponse({ error: "Upload 3 to 10 photos." }, 400);
  }

  await updateTrailerJob(jobId, userId, {
    progress: 10,
    stage: "Upload",
    status: "uploading",
  });

  const uploadedPhotos = await Promise.all(
    photos.map(async (photo, index) => {
      const decoded = decodeDataUrl(photo.dataUrl);
      const upload = await uploadToCloudinary(decoded.buffer, {
        folder: `cinelife/users/${userId}/jobs/${jobId}/photos`,
        publicId: `photo-${index + 1}`,
        resourceType: "image",
      });
      const assetId = randomUUID();

      await saveTrailerAsset({
        id: assetId,
        jobId,
        userId,
        assetType: "photo",
        resourceType: "image",
        publicId: upload.publicId,
        secureUrl: upload.secureUrl,
        metadata: {
          frameNumber: index + 1,
          name: photo.name,
          mimeType: decoded.mimeType,
        },
      });

      return {
        id: assetId,
        frameNumber: index + 1,
        name: photo.name,
        publicId: upload.publicId,
        secureUrl: upload.secureUrl,
      };
    }),
  );

  let uploadedVoiceSample: unknown = null;

  if (
    body.voiceSample &&
    typeof body.voiceSample === "object" &&
    isDataUrl((body.voiceSample as Record<string, unknown>).dataUrl, "audio/")
  ) {
    const source = body.voiceSample as Record<string, unknown>;
    const decoded = decodeDataUrl(source.dataUrl as string);
    const upload = await uploadToCloudinary(decoded.buffer, {
      folder: `cinelife/users/${userId}/jobs/${jobId}/audio`,
      publicId: "voice-sample",
      resourceType: "video",
    });
    const assetId = randomUUID();

    await saveTrailerAsset({
      id: assetId,
      jobId,
      userId,
      assetType: "voice_sample",
      resourceType: "video",
      publicId: upload.publicId,
      secureUrl: upload.secureUrl,
      metadata: {
        name: sanitizeText(source.name, "voice-sample"),
        mimeType: decoded.mimeType,
        duration: source.duration,
        profile: normalizeVoiceSampleProfile(source.profile),
      },
    });

    uploadedVoiceSample = {
      id: assetId,
      publicId: upload.publicId,
      secureUrl: upload.secureUrl,
    };
  }

  await updateTrailerJob(jobId, userId, {
    progress: 15,
    stage: "Upload",
    status: "generating",
    metadata: {
      photoCount: uploadedPhotos.length,
    },
  });

  return jsonResponse({
    photos: uploadedPhotos,
    voiceSample: uploadedVoiceSample,
  });
}
