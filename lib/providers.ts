import { v2 as cloudinary } from "cloudinary";
import { createClient } from "@supabase/supabase-js";

type UploadOptions = {
  folder: string;
  publicId: string;
  resourceType: "image" | "video" | "raw";
};

export type TrailerJobStatus =
  | "created"
  | "uploading"
  | "generating"
  | "rendering"
  | "complete"
  | "failed";

export type TrailerJobStage =
  | "Session"
  | "Upload"
  | "Vision"
  | "Story"
  | "Narration"
  | "Render"
  | "Upload MP4"
  | "Complete";

type TrailerJobInput = {
  id: string;
  userId: string;
  name: string;
  futureDream: string;
  trailerStyle: string;
  voiceOption: string;
};

type TrailerJobUpdate = {
  status?: TrailerJobStatus;
  progress?: number;
  stage?: TrailerJobStage;
  error?: string | null;
  resultVideoUrl?: string | null;
  downloadUrl?: string | null;
  metadata?: Record<string, unknown>;
};

type TrailerAssetRecord = {
  id: string;
  jobId: string;
  userId: string;
  assetType: "photo" | "voice_sample" | "voice_over" | "final_video";
  resourceType: "image" | "video" | "raw";
  publicId: string;
  secureUrl: string;
  metadata?: Record<string, unknown>;
};

type TrailerRecord = {
  id: string;
  title: string;
  tagline: string;
  trailerStyle: string;
  videoUrl?: string;
  cloudinaryPublicId?: string;
  metadata: Record<string, unknown>;
};

type ProviderDiagnostic = {
  status: "ready" | "missing" | "invalid";
  message: string;
  missingEnv?: string[];
};

type ProviderDiagnostics = {
  openai: ProviderDiagnostic;
  cloudinary: ProviderDiagnostic;
  supabaseServer: ProviderDiagnostic;
  supabaseBrowser: ProviderDiagnostic;
};

export function hasCloudinaryConfig() {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET,
  );
}

export function hasSupabaseConfig() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function hasSupabaseBrowserConfig() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export function getCineLifeConfigStatus() {
  const checks = {
    openai: Boolean(process.env.OPENAI_API_KEY),
    cloudinary: hasCloudinaryConfig(),
    supabaseServer: hasSupabaseConfig(),
    supabaseBrowser: hasSupabaseBrowserConfig(),
  };
  const missing = Object.entries(checks)
    .filter(([, isReady]) => !isReady)
    .map(([key]) => key);

  return {
    checks,
    isProductionReady: missing.length === 0,
    missing,
  };
}

function missingEnv(keys: string[]) {
  return keys.filter((key) => !process.env[key]);
}

function ready(message: string): ProviderDiagnostic {
  return {
    status: "ready",
    message,
  };
}

function missingDiagnostic(message: string, keys: string[]): ProviderDiagnostic {
  return {
    status: "missing",
    message,
    missingEnv: missingEnv(keys),
  };
}

function invalid(message: string): ProviderDiagnostic {
  return {
    status: "invalid",
    message,
  };
}

async function getCloudinaryDiagnostic(): Promise<ProviderDiagnostic> {
  const requiredKeys = [
    "CLOUDINARY_CLOUD_NAME",
    "CLOUDINARY_API_KEY",
    "CLOUDINARY_API_SECRET",
  ];

  if (!hasCloudinaryConfig()) {
    return missingDiagnostic(
      "Cloudinary media delivery is missing required server environment variables.",
      requiredKeys,
    );
  }

  try {
    configureCloudinary();
    await cloudinary.api.ping();
    return ready("Cloudinary credentials are valid.");
  } catch {
    return invalid(
      "Cloudinary rejected the configured credentials. Check CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.",
    );
  }
}

async function getSupabaseServerDiagnostic(): Promise<ProviderDiagnostic> {
  const requiredKeys = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];

  if (!hasSupabaseConfig()) {
    return missingDiagnostic(
      "Supabase server access is missing required environment variables.",
      requiredKeys,
    );
  }

  try {
    const supabase = getSupabaseServiceClient();
    const { error } = await supabase
      .from("trailer_jobs")
      .select("id", { count: "exact", head: true });

    if (error) {
      return invalid(
        `Supabase server access failed. Apply the CineLife migration and verify SUPABASE_SERVICE_ROLE_KEY. ${error.message}`,
      );
    }

    return ready("Supabase service role can access CineLife trailer jobs.");
  } catch (error) {
    return invalid(
      error instanceof Error
        ? error.message
        : "Supabase server access could not be verified.",
    );
  }
}

function getSupabaseBrowserDiagnostic(): ProviderDiagnostic {
  const requiredKeys = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  ];

  if (!hasSupabaseBrowserConfig()) {
    return missingDiagnostic(
      "Supabase anonymous browser auth is missing required public environment variables.",
      requiredKeys,
    );
  }

  return ready(
    "Supabase browser keys are present. CineLife tries hosted anonymous auth first and falls back to a persistent local anonymous job owner if the hosted toggle is disabled.",
  );
}

export async function getCineLifeConfigDiagnostics() {
  const diagnostics: ProviderDiagnostics = {
    openai: process.env.OPENAI_API_KEY
      ? ready("OpenAI server key is configured.")
      : missingDiagnostic("OpenAI generation is missing OPENAI_API_KEY.", [
          "OPENAI_API_KEY",
        ]),
    cloudinary: await getCloudinaryDiagnostic(),
    supabaseServer: await getSupabaseServerDiagnostic(),
    supabaseBrowser: getSupabaseBrowserDiagnostic(),
  };
  const checks = {
    openai: diagnostics.openai.status === "ready",
    cloudinary: diagnostics.cloudinary.status === "ready",
    supabaseServer: diagnostics.supabaseServer.status === "ready",
    supabaseBrowser: diagnostics.supabaseBrowser.status === "ready",
  };
  const missing = Object.entries(checks)
    .filter(([, isReady]) => !isReady)
    .map(([key]) => key);

  return {
    checks,
    diagnostics,
    isProductionReady: missing.length === 0,
    missing,
  };
}

function configureCloudinary() {
  if (!hasCloudinaryConfig()) {
    throw new Error("Cloudinary is not configured.");
  }

  cloudinary.config({
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    secure: true,
  });
}

export async function uploadToCloudinary(
  buffer: Buffer,
  { folder, publicId, resourceType }: UploadOptions,
) {
  configureCloudinary();

  return new Promise<{ secureUrl: string; publicId: string }>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: publicId,
        resource_type: resourceType,
        overwrite: true,
      },
      (error, result) => {
        if (error || !result) {
          reject(error ?? new Error("Cloudinary upload failed."));
          return;
        }

        resolve({
          publicId: result.public_id,
          secureUrl: result.secure_url,
        });
      },
    );

    stream.end(buffer);
  });
}

export function getSupabaseServiceClient() {
  if (!hasSupabaseConfig()) {
    throw new Error("Supabase is not configured.");
  }

  return createClient(
    process.env.SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string,
    {
      auth: {
        persistSession: false,
      },
    },
  );
}

export async function createTrailerJob(job: TrailerJobInput) {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("trailer_jobs")
    .insert({
      id: job.id,
      user_id: job.userId,
      name: job.name,
      future_dream: job.futureDream,
      trailer_style: job.trailerStyle,
      voice_option: job.voiceOption,
      status: "created",
      progress: 0,
      stage: "Session",
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Supabase job creation failed: ${error.message}`);
  }

  return data;
}

export async function getTrailerJob(jobId: string, userId: string) {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("trailer_jobs")
    .select("*")
    .eq("id", jobId)
    .eq("user_id", userId)
    .single();

  if (error) {
    throw new Error(`Supabase job lookup failed: ${error.message}`);
  }

  return data;
}

export async function updateTrailerJob(
  jobId: string,
  userId: string,
  update: TrailerJobUpdate,
) {
  const supabase = getSupabaseServiceClient();
  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (update.status) {
    payload.status = update.status;
  }

  if (typeof update.progress === "number") {
    payload.progress = Math.max(0, Math.min(100, Math.round(update.progress)));
  }

  if (update.stage) {
    payload.stage = update.stage;
  }

  if (update.error !== undefined) {
    payload.error = update.error;
  }

  if (update.resultVideoUrl !== undefined) {
    payload.result_video_url = update.resultVideoUrl;
  }

  if (update.downloadUrl !== undefined) {
    payload.download_url = update.downloadUrl;
  }

  if (update.metadata !== undefined) {
    payload.metadata = update.metadata;
  }

  const { data, error } = await supabase
    .from("trailer_jobs")
    .update(payload)
    .eq("id", jobId)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Supabase job update failed: ${error.message}`);
  }

  await supabase.from("trailer_events").insert({
    job_id: jobId,
    user_id: userId,
    status: update.status,
    stage: update.stage,
    progress: payload.progress,
    message: update.error ?? null,
    metadata: update.metadata ?? {},
  });

  return data;
}

export async function saveTrailerAsset(asset: TrailerAssetRecord) {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("trailer_assets")
    .insert({
      id: asset.id,
      job_id: asset.jobId,
      user_id: asset.userId,
      asset_type: asset.assetType,
      resource_type: asset.resourceType,
      public_id: asset.publicId,
      secure_url: asset.secureUrl,
      metadata: asset.metadata ?? {},
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Supabase asset persistence failed: ${error.message}`);
  }

  return data;
}

export async function listTrailerAssets(jobId: string, userId: string) {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("trailer_assets")
    .select("*")
    .eq("job_id", jobId)
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Supabase asset lookup failed: ${error.message}`);
  }

  return data ?? [];
}

export async function saveTrailerRecord(record: TrailerRecord) {
  if (!hasSupabaseConfig()) {
    return null;
  }

  const supabase = createClient(
    process.env.SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string,
    {
      auth: {
        persistSession: false,
      },
    },
  );
  const { data, error } = await supabase
    .from("trailers")
    .insert({
      id: record.id,
      title: record.title,
      tagline: record.tagline,
      trailer_style: record.trailerStyle,
      video_url: record.videoUrl,
      cloudinary_public_id: record.cloudinaryPublicId,
      metadata: record.metadata,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`Supabase trailer persistence failed: ${error.message}`);
  }

  return data;
}
