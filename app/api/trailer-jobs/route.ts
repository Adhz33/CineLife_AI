import { randomUUID } from "crypto";
import {
  createTrailerJob,
  getCineLifeConfigDiagnostics,
  updateTrailerJob,
} from "@/lib/providers";

export const runtime = "nodejs";

type CreateTrailerJobRequest = {
  userId?: unknown;
  name?: unknown;
  futureDream?: unknown;
  trailerStyle?: unknown;
  voiceOption?: unknown;
};

function sanitizeText(value: unknown, fallback = "", maxLength = 600) {
  return typeof value === "string" && value.trim()
    ? value.trim().replace(/\s+/g, " ").slice(0, maxLength)
    : fallback;
}

function jsonResponse(body: unknown, status = 200) {
  return Response.json(body, {
    headers: {
      "Cache-Control": "no-store",
    },
    status,
  });
}

export async function POST(request: Request) {
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

  let body: CreateTrailerJobRequest;

  try {
    body = (await request.json()) as CreateTrailerJobRequest;
  } catch {
    return jsonResponse({ error: "Request body must be valid JSON." }, 400);
  }

  const userId = sanitizeText(body.userId, "", 80);
  const futureDream = sanitizeText(body.futureDream, "", 1200);

  if (!userId) {
    return jsonResponse({ error: "A Supabase anonymous userId is required." }, 400);
  }

  if (!futureDream) {
    return jsonResponse({ error: "futureDream is required." }, 400);
  }

  const jobId = randomUUID();
  const job = await createTrailerJob({
    id: jobId,
    userId,
    name: sanitizeText(body.name, "Your Hero", 120),
    futureDream,
    trailerStyle: sanitizeText(body.trailerStyle, "Inspirational", 80),
    voiceOption: sanitizeText(body.voiceOption, "Cinematic Male", 80),
  });

  await updateTrailerJob(jobId, userId, {
    progress: 5,
    stage: "Session",
    status: "created",
    metadata: {
      message: "Anonymous Supabase session verified.",
    },
  });

  return jsonResponse({
    jobId,
    job,
  });
}
