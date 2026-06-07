import { randomUUID } from "crypto";
import { execFile } from "child_process";
import { mkdir, readFile, rm, writeFile } from "fs/promises";
import os from "os";
import path from "path";
import { promisify } from "util";
import { generateCinematicSoundtrack } from "@/lib/audio-design";
import {
  hasCloudinaryConfig,
  saveTrailerRecord,
  saveTrailerAsset,
  updateTrailerJob,
  uploadToCloudinary,
} from "@/lib/providers";
import { TrailerRenderProps } from "@/remotion/trailerTypes";

export const runtime = "nodejs";
export const maxDuration = 300;

const execFileAsync = promisify(execFile);

type RenderTrailerRequest = {
  title?: unknown;
  tagline?: unknown;
  trailerStyle?: unknown;
  narrationScript?: unknown;
  photos?: unknown;
  timeline?: unknown;
  musicPlan?: unknown;
  audioDataUrl?: unknown;
  jobId?: unknown;
  userId?: unknown;
};

type DataUrlAsset = {
  dataUrl?: string;
  src?: string;
  name: string;
};

function jsonResponse(body: unknown, status = 200) {
  return Response.json(body, { status });
}

function sanitizeText(value: unknown, fallback: string, maxLength = 600) {
  return typeof value === "string" && value.trim()
    ? value.trim().replace(/\s+/g, " ").slice(0, maxLength)
    : fallback;
}

function isDataUrl(value: unknown, mimePrefix: string): value is string {
  return (
    typeof value === "string" &&
    value.startsWith(`data:${mimePrefix}`) &&
    value.includes(";base64,")
  );
}

function isHttpUrl(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }

  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function extensionFromMime(mimeType: string) {
  if (mimeType.includes("png")) {
    return "png";
  }

  if (mimeType.includes("webp")) {
    return "webp";
  }

  if (mimeType.includes("wav")) {
    return "wav";
  }

  if (mimeType.includes("mp4") || mimeType.includes("m4a")) {
    return "m4a";
  }

  return mimeType.startsWith("audio/") ? "mp3" : "jpg";
}

function decodeDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);

  if (!match) {
    throw new Error("Invalid data URL.");
  }

  return {
    buffer: Buffer.from(match[2], "base64"),
    extension: extensionFromMime(match[1]),
    mimeType: match[1],
  };
}

function parsePhotos(value: unknown) {
  if (!Array.isArray(value)) {
    return [] satisfies DataUrlAsset[];
  }

  return value
    .map((photo): DataUrlAsset | null => {
      if (!photo || typeof photo !== "object") {
        return null;
      }

      const source = photo as Record<string, unknown>;
      const dataUrl = source.dataUrl;
      const src = source.src;

      if (!isDataUrl(dataUrl, "image/") && !isHttpUrl(src)) {
        return null;
      }

      return {
        dataUrl: isDataUrl(dataUrl, "image/") ? dataUrl : undefined,
        src: isHttpUrl(src) ? src : undefined,
        name: sanitizeText(source.name, "Uploaded photo", 120),
      };
    })
    .filter((photo): photo is DataUrlAsset => Boolean(photo))
    .slice(0, 10);
}

function parseTimeline(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((scene) => {
      if (!scene || typeof scene !== "object") {
        return null;
      }

      const source = scene as Record<string, unknown>;
      const sceneNumber = Number(source.sceneNumber);
      const emotionalIntensity = Number(source.emotionalIntensity);

      if (!Number.isInteger(sceneNumber)) {
        return null;
      }

      return {
        sceneNumber,
        startTime: sanitizeText(source.startTime, "00:00", 12),
        endTime: sanitizeText(source.endTime, "00:08", 12),
        visualCue: sanitizeText(source.visualCue, "Cinematic photo movement."),
        narrationLine: sanitizeText(
          source.narrationLine,
          "A life begins to move like a trailer.",
        ),
        cameraMotion: sanitizeText(source.cameraMotion, "Slow cinematic push."),
        compositionFocusX:
          typeof source.compositionFocusX === "number" &&
          Number.isFinite(source.compositionFocusX)
            ? Math.max(0, Math.min(100, source.compositionFocusX))
            : 50,
        compositionFocusY:
          typeof source.compositionFocusY === "number" &&
          Number.isFinite(source.compositionFocusY)
            ? Math.max(0, Math.min(100, source.compositionFocusY))
            : 42,
        emotionalIntensity:
          Number.isInteger(emotionalIntensity) &&
          emotionalIntensity >= 1 &&
          emotionalIntensity <= 10
            ? emotionalIntensity
            : 6,
      };
    })
    .filter((scene): scene is NonNullable<typeof scene> => Boolean(scene))
    .slice(0, 8);
}

async function writeAsset(
  assetDirectory: string,
  renderId: string,
  dataUrl: string,
  fileStem: string,
) {
  const asset = await writeAssetDetails(
    assetDirectory,
    renderId,
    dataUrl,
    fileStem,
  );

  return asset.publicPath;
}

async function writeAssetDetails(
  assetDirectory: string,
  renderId: string,
  dataUrl: string,
  fileStem: string,
) {
  const decodedAsset = decodeDataUrl(dataUrl);
  const fileName = `${fileStem}.${decodedAsset.extension}`;
  const filePath = path.join(assetDirectory, fileName);

  await writeFile(filePath, decodedAsset.buffer);

  return {
    filePath,
    mimeType: decodedAsset.mimeType,
    publicPath: `remotion-renders/${renderId}/${fileName}`,
  };
}

async function getMediaDurationSeconds(filePath: string) {
  try {
    const { stdout } = await execFileAsync("ffprobe", [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      filePath,
    ]);
    const duration = Number(stdout.trim());

    return Number.isFinite(duration) && duration > 0 ? duration : null;
  } catch {
    return null;
  }
}

async function maybeUpdateRenderProgress(
  jobId: string,
  userId: string,
  progress: number,
) {
  if (!jobId || !userId) {
    return;
  }

  await updateTrailerJob(jobId, userId, {
    progress,
    stage: "Render",
    status: "rendering",
  }).catch((error) => {
    console.error("[CineLife] Unable to update render progress", error);
  });
}

export async function POST(request: Request) {
  let body: RenderTrailerRequest;

  try {
    body = (await request.json()) as RenderTrailerRequest;
  } catch {
    return jsonResponse({ error: "Request body must be valid JSON." }, 400);
  }

  const photos = parsePhotos(body.photos);
  const timeline = parseTimeline(body.timeline);
  const jobId = sanitizeText(body.jobId, "", 80);
  const userId = sanitizeText(body.userId, "", 80);

  if (photos.length < 3) {
    return jsonResponse({ error: "At least 3 uploaded photos are required." }, 400);
  }

  if (!timeline.length) {
    return jsonResponse({ error: "A scene timeline is required." }, 400);
  }

  const renderId = randomUUID();
  const publicRenderDirectory = path.join(
    process.cwd(),
    "public",
    "remotion-renders",
    renderId,
  );
  const outputLocation = path.join(os.tmpdir(), `cinelife-${renderId}.mp4`);

  try {
    await mkdir(publicRenderDirectory, { recursive: true });

    const writtenPhotos = await Promise.all(
      photos.map(async (photo, index) => ({
        name: photo.name,
        src:
          photo.src ??
          (photo.dataUrl
            ? await writeAsset(
                publicRenderDirectory,
                renderId,
                photo.dataUrl,
                `photo-${index + 1}`,
              )
            : ""),
      })),
    );
    const writtenAudio = isDataUrl(body.audioDataUrl, "audio/")
      ? await writeAssetDetails(
          publicRenderDirectory,
          renderId,
          body.audioDataUrl,
          "voice-over",
        )
      : undefined;
    const audioSrc = writtenAudio?.publicPath;
    const audioDurationSeconds = writtenAudio
      ? await getMediaDurationSeconds(writtenAudio.filePath)
      : null;
    const lastTimelineSecond = timeline.reduce((latestTime, scene) => {
      const parts = scene.endTime.split(":").map(Number);
      const seconds =
        parts.length === 2
          ? parts[0] * 60 + parts[1]
          : parts.length === 3
            ? parts[0] * 3600 + parts[1] * 60 + parts[2]
            : 45;

      return Math.max(latestTime, seconds);
    }, 0);
    const durationSeconds = Math.max(
      30,
      Math.min(60, Math.max(lastTimelineSecond + 7, (audioDurationSeconds ?? 0) + 3)),
    );
    const soundtrackBuffer = generateCinematicSoundtrack({
      durationSeconds,
      style: sanitizeText(body.trailerStyle, "Inspirational", 80),
    });
    const soundtrackPath = path.join(publicRenderDirectory, "soundtrack.wav");
    await writeFile(soundtrackPath, soundtrackBuffer);
    const inputProps: TrailerRenderProps = {
      title: sanitizeText(body.title, "CineLife Trailer", 120),
      tagline: sanitizeText(
        body.tagline,
        "A cinematic trailer generated from uploaded memories.",
      ),
      trailerStyle: sanitizeText(body.trailerStyle, "Inspirational", 80),
      narrationScript: sanitizeText(
        body.narrationScript,
        "A life becomes a trailer, one frame at a time.",
        1600,
      ),
      photos: writtenPhotos,
      timeline,
      audioSrc,
      audioDurationSeconds: audioDurationSeconds ?? undefined,
      soundtrackSrc: `remotion-renders/${renderId}/soundtrack.wav`,
      fps: 30,
    };
    const [{ bundle }, { renderMedia, selectComposition }] = await Promise.all([
      import("@remotion/bundler"),
      import("@remotion/renderer"),
    ]);
    const serveUrl = await bundle({
      entryPoint: path.join(process.cwd(), "remotion", "index.ts"),
      onProgress: (progress) => {
        void maybeUpdateRenderProgress(
          jobId,
          userId,
          Math.max(70, Math.min(74, 70 + progress * 4)),
        );
      },
    });
    await maybeUpdateRenderProgress(jobId, userId, 70);
    const composition = await selectComposition({
      id: "CineLifeTrailer",
      inputProps,
      serveUrl,
    });

    await renderMedia({
      codec: "h264",
      composition,
      inputProps,
      onProgress: (progress) => {
        void maybeUpdateRenderProgress(
          jobId,
          userId,
          74 + progress.progress * 18,
        );
      },
      outputLocation,
      serveUrl,
    });

    const videoBuffer = await readFile(outputLocation);
    let cloudinaryUrl: string | undefined;
    let cloudinaryPublicId: string | undefined;

    if (hasCloudinaryConfig()) {
      const upload = await uploadToCloudinary(videoBuffer, {
        folder:
          jobId && userId
            ? `cinelife/users/${userId}/jobs/${jobId}/trailers`
            : "cinelife/trailers",
        publicId: renderId,
        resourceType: "video",
      });
      cloudinaryUrl = upload.secureUrl;
      cloudinaryPublicId = upload.publicId;
      if (jobId && userId) {
        await saveTrailerAsset({
          id: renderId,
          jobId,
          userId,
          assetType: "final_video",
          resourceType: "video",
          publicId: cloudinaryPublicId,
          secureUrl: cloudinaryUrl,
          metadata: {
            durationSeconds,
            byteLength: videoBuffer.length,
          },
        });
        await updateTrailerJob(jobId, userId, {
          progress: 96,
          stage: "Upload MP4",
          status: "rendering",
          resultVideoUrl: cloudinaryUrl,
          downloadUrl: cloudinaryUrl,
        });
      }
      if (!jobId) {
        await saveTrailerRecord({
          id: renderId,
          title: inputProps.title,
          tagline: inputProps.tagline,
          trailerStyle: inputProps.trailerStyle,
          videoUrl: cloudinaryUrl,
          cloudinaryPublicId,
          metadata: {
            durationSeconds,
            photoCount: photos.length,
            timeline,
            musicPlan: body.musicPlan,
          },
        });
      }
    }

    return new Response(videoBuffer, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": 'attachment; filename="cinelife-trailer.mp4"',
        "Content-Type": "video/mp4",
        ...(cloudinaryUrl ? { "X-CineLife-Video-Url": cloudinaryUrl } : {}),
        ...(cloudinaryPublicId
          ? { "X-CineLife-Cloudinary-Public-Id": cloudinaryPublicId }
          : {}),
        "X-CineLife-Trailer-Id": renderId,
      },
    });
  } catch (error) {
    console.error("[CineLife] Remotion render failed", error);
    return jsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to render trailer video.",
      },
      500,
    );
  } finally {
    await Promise.allSettled([
      rm(publicRenderDirectory, { force: true, recursive: true }),
      rm(outputLocation, { force: true }),
    ]);
  }
}
