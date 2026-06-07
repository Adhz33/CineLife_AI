import { randomUUID } from "crypto";
import {
  getCineLifeConfigDiagnostics,
  listTrailerAssets,
  saveTrailerAsset,
  updateTrailerJob,
  uploadToCloudinary,
} from "@/lib/providers";
import { cleanNarrationForVoice } from "@/lib/narration";

export const runtime = "nodejs";
export const maxDuration = 300;

type RunTrailerJobRequest = {
  userId?: unknown;
  name?: unknown;
  futureDream?: unknown;
  trailerStyle?: unknown;
  voiceOption?: unknown;
  photoInsights?: unknown;
  visualStorySequence?: unknown;
};

type TrailerAssetRow = {
  id: string;
  asset_type: string;
  secure_url: string;
  metadata: Record<string, unknown> | null;
};

function jsonResponse(body: unknown, status = 200) {
  return Response.json(body, {
    headers: {
      "Cache-Control": "no-store",
    },
    status,
  });
}

function sanitizeText(value: unknown, fallback = "", maxLength = 600) {
  return typeof value === "string" && value.trim()
    ? value.trim().replace(/\s+/g, " ").slice(0, maxLength)
    : fallback;
}

async function fetchJsonOrThrow<T>(url: string, body: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = (await response.json().catch(() => null)) as T & {
    error?: string;
  };

  if (!response.ok) {
    throw new Error(data?.error ?? `Request failed: ${url}`);
  }

  return data as T;
}

async function fetchAudioOrThrow(url: string, body: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;

    throw new Error(data?.error ?? "Voice generation failed.");
  }

  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get("content-type") ?? "audio/mpeg",
  };
}

async function assetUrlToDataUrl(url: string) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("Unable to read uploaded voice sample.");
  }

  const contentType = response.headers.get("content-type") ?? "audio/mpeg";
  const buffer = Buffer.from(await response.arrayBuffer());

  return `data:${contentType};base64,${buffer.toString("base64")}`;
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
  const origin = new URL(request.url).origin;
  let body: RunTrailerJobRequest;

  try {
    body = (await request.json()) as RunTrailerJobRequest;
  } catch {
    return jsonResponse({ error: "Request body must be valid JSON." }, 400);
  }

  const userId = sanitizeText(body.userId, "", 80);
  const futureDream = sanitizeText(body.futureDream, "", 1200);
  const trailerStyle = sanitizeText(body.trailerStyle, "Inspirational", 80);
  const voiceOption = sanitizeText(body.voiceOption, "Cinematic Male", 80);

  if (!userId || !futureDream) {
    return jsonResponse({ error: "userId and futureDream are required." }, 400);
  }

  try {
    await updateTrailerJob(jobId, userId, {
      progress: 30,
      stage: "Vision",
      status: "generating",
      error: null,
    });

    const assets = (await listTrailerAssets(jobId, userId)) as TrailerAssetRow[];
    const photoAssets = assets
      .filter((asset) => asset.asset_type === "photo")
      .sort((left, right) => {
        const leftFrame = Number(left.metadata?.frameNumber ?? 0);
        const rightFrame = Number(right.metadata?.frameNumber ?? 0);
        return leftFrame - rightFrame;
      });

    if (photoAssets.length < 3) {
      throw new Error("At least 3 uploaded photos are required before running the job.");
    }

    await updateTrailerJob(jobId, userId, {
      progress: 45,
      stage: "Story",
      status: "generating",
    });

    const generatedTrailer = await fetchJsonOrThrow<{
      movieTitle: string;
      tagline: string;
      narrationPreview: {
        voiceOverScript: string;
        sceneTimeline: unknown[];
        soundDesignNotes: unknown;
      };
    }>(`${origin}/api/generate-trailer`, {
      name: body.name,
      futureDream,
      trailerStyle,
      photoCount: photoAssets.length,
      photoUrls: photoAssets.map((asset) => asset.secure_url),
      photoInsights: body.photoInsights,
      visualStorySequence: body.visualStorySequence,
    });

    await updateTrailerJob(jobId, userId, {
      progress: 60,
      stage: "Narration",
      status: "generating",
      metadata: {
        movieTitle: generatedTrailer.movieTitle,
        tagline: generatedTrailer.tagline,
      },
    });

    const voiceSample = assets.find((asset) => asset.asset_type === "voice_sample");

    if (voiceOption === "Clone My Voice" && !voiceSample) {
      throw new Error(
        "Clone My Voice requires an uploaded voice sample. Upload a sample or choose a built-in narrator voice.",
      );
    }

    if (
      voiceOption === "Clone My Voice" &&
      voiceSample?.metadata?.consentAccepted !== true
    ) {
      throw new Error(
        "Voice cloning consent was not captured for the uploaded voice sample.",
      );
    }

    const voiceSampleQuality = voiceSample?.metadata?.quality as
      | Record<string, unknown>
      | undefined;

    if (
      voiceOption === "Clone My Voice" &&
      voiceSampleQuality &&
      (voiceSampleQuality.speechDetected !== true ||
        voiceSampleQuality.verdict === "blocked")
    ) {
      throw new Error(
        "The uploaded voice sample did not pass the clone quality precheck.",
      );
    }

    const voiceSampleDataUrl =
      voiceOption === "Clone My Voice" && voiceSample
        ? await assetUrlToDataUrl(voiceSample.secure_url)
        : undefined;
    const narrationScript = cleanNarrationForVoice(
      generatedTrailer.narrationPreview.voiceOverScript,
    );
    const voice = await fetchAudioOrThrow(`${origin}/api/generate-voice`, {
      script: narrationScript,
      voiceOption,
      voiceSampleDataUrl,
      voiceSampleName: voiceSample?.metadata?.name,
      voiceSampleDuration: voiceSample?.metadata?.duration,
      voiceSampleProfile: voiceSample?.metadata?.profile,
      voiceSampleQuality: voiceSample?.metadata?.quality,
      voiceConsentAccepted:
        voiceOption === "Clone My Voice"
          ? voiceSample?.metadata?.consentAccepted === true
          : false,
    });
    const voicePublicId = randomUUID();
    const voiceUpload = await uploadToCloudinary(voice.buffer, {
      folder: `cinelife/users/${userId}/jobs/${jobId}/audio`,
      publicId: "voice-over",
      resourceType: "video",
    });

    await saveTrailerAsset({
      id: voicePublicId,
      jobId,
      userId,
      assetType: "voice_over",
      resourceType: "video",
      publicId: voiceUpload.publicId,
      secureUrl: voiceUpload.secureUrl,
      metadata: {
        contentType: voice.contentType,
        voiceOption,
      },
    });

    await updateTrailerJob(jobId, userId, {
      progress: 70,
      stage: "Render",
      status: "rendering",
    });

    const renderResponse = await fetch(`${origin}/api/render-trailer`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jobId,
        userId,
        title: generatedTrailer.movieTitle,
        tagline: generatedTrailer.tagline,
        trailerStyle,
        narrationScript,
        photos: photoAssets.map((asset) => ({
          src: asset.secure_url,
          name: sanitizeText(asset.metadata?.name, "Uploaded photo", 120),
        })),
        timeline: generatedTrailer.narrationPreview.sceneTimeline,
        musicPlan: generatedTrailer.narrationPreview.soundDesignNotes,
        audioDataUrl: `data:${voice.contentType};base64,${voice.buffer.toString("base64")}`,
      }),
    });

    if (!renderResponse.ok) {
      const data = (await renderResponse.json().catch(() => null)) as {
        error?: string;
      } | null;

      throw new Error(data?.error ?? "Trailer video render failed.");
    }

    const resultVideoUrl = renderResponse.headers.get("X-CineLife-Video-Url");

    if (!resultVideoUrl) {
      throw new Error("Cloudinary did not return a final MP4 URL.");
    }

    const job = await updateTrailerJob(jobId, userId, {
      progress: 100,
      stage: "Complete",
      status: "complete",
      error: null,
      resultVideoUrl,
      downloadUrl: resultVideoUrl,
      metadata: {
        movieTitle: generatedTrailer.movieTitle,
        tagline: generatedTrailer.tagline,
        trailerStyle,
        photoCount: photoAssets.length,
      },
    });

    return jsonResponse({
      jobId,
      status: "complete",
      progress: 100,
      stage: "Complete",
      resultVideoUrl,
      downloadUrl: resultVideoUrl,
      job,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to run trailer job.";

    await updateTrailerJob(jobId, userId, {
      status: "failed",
      error: message,
      metadata: {
        failure: message,
      },
    }).catch((updateError) => {
      console.error("[CineLife] Unable to persist job failure", updateError);
    });

    return jsonResponse({ error: message }, 500);
  }
}
