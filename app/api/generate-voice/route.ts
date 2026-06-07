import { execFile } from "child_process";
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import os from "os";
import path from "path";
import { promisify } from "util";
import OpenAI, { toFile } from "openai";
import { cleanNarrationForVoice } from "@/lib/narration";

export const runtime = "nodejs";
export const maxDuration = 900;

const execFileAsync = promisify(execFile);

const VOICE_OPTIONS = [
  "Cinematic Male",
  "Cinematic Female",
  "Documentary",
  "Motivational",
  "Clone My Voice",
] as const;

type VoiceOption = (typeof VOICE_OPTIONS)[number];

type GenerateVoiceRequest = {
  script?: unknown;
  voiceOption?: unknown;
  voiceSampleDataUrl?: unknown;
  voiceSampleName?: unknown;
  voiceSampleDuration?: unknown;
  voiceSampleProfile?: unknown;
};

type VoiceSampleProfile = {
  averageRms?: number;
  peakRms?: number;
  zeroCrossingRate?: number;
  estimatedPitchHz?: number | null;
  voiceFamily?: "lower" | "neutral" | "higher";
  energy?: "soft" | "balanced" | "strong";
  brightness?: "warm" | "balanced" | "bright";
};

type ParsedClonePayload = {
  script: string;
  voiceOption: "Clone My Voice";
  voiceSampleDataUrl: string;
  voiceSampleName: string;
  voiceSampleProfile?: VoiceSampleProfile;
};

const voiceProfiles = {
  "Cinematic Male": {
    voice: "onyx",
    instructions:
      "Speak like a premium movie-trailer narrator: deep, controlled, cinematic, emotionally grounded, with dramatic pauses and a confident final lift. Clearly disclose through tone that this is an AI-generated narration, not a human celebrity impression.",
    speed: 0.92,
  },
  "Cinematic Female": {
    voice: "nova",
    instructions:
      "Speak with a cinematic female trailer voice: warm, intimate, powerful, emotionally precise, with elegant pacing and a luminous final rise. Clearly disclose through tone that this is an AI-generated narration, not a human celebrity impression.",
    speed: 0.95,
  },
  Documentary: {
    voice: "sage",
    instructions:
      "Speak like a thoughtful documentary narrator: natural, credible, observant, restrained, human, and clear. Avoid exaggerated trailer hype while keeping a premium streaming tone.",
    speed: 0.98,
  },
  Motivational: {
    voice: "verse",
    instructions:
      "Speak with motivational trailer energy: bold, driving, clear, inspiring, and forward-moving, with strong cadence and uplifting emphasis on the closing line.",
    speed: 1,
  },
} satisfies Record<
  Exclude<VoiceOption, "Clone My Voice">,
  {
    voice: "onyx" | "nova" | "sage" | "verse";
    instructions: string;
    speed: number;
  }
>;

function jsonResponse(body: unknown, status = 200) {
  return Response.json(body, { status });
}

function isVoiceOption(value: unknown): value is VoiceOption {
  return (
    typeof value === "string" && VOICE_OPTIONS.includes(value as VoiceOption)
  );
}

function parsePayload(payload: GenerateVoiceRequest) {
  const script =
    typeof payload.script === "string"
      ? cleanNarrationForVoice(payload.script)
      : "";

  if (!script) {
    return { error: "script must contain readable narration text." };
  }

  if (script.length > 4096) {
    return { error: "script must be 4096 characters or fewer." };
  }

  const voiceOption = payload.voiceOption;

  if (!isVoiceOption(voiceOption)) {
    return { error: "voiceOption is invalid." };
  }

  if (voiceOption === "Clone My Voice") {
    const duration = Number(payload.voiceSampleDuration);
    const voiceSampleDataUrl =
      typeof payload.voiceSampleDataUrl === "string"
        ? payload.voiceSampleDataUrl
        : "";

    if (!voiceSampleDataUrl.startsWith("data:audio/")) {
      return { error: "A valid uploaded voice sample is required for cloning." };
    }

    if (!Number.isFinite(duration) || duration < 15 || duration > 60) {
      return { error: "Voice sample must be between 15 and 60 seconds." };
    }

    return {
      value: {
        script,
        voiceOption,
        voiceSampleDataUrl,
        voiceSampleName:
          typeof payload.voiceSampleName === "string"
            ? payload.voiceSampleName.slice(0, 160)
            : "voice-sample",
        voiceSampleProfile: parseVoiceSampleProfile(payload.voiceSampleProfile),
      },
    };
  }

  return {
    value: {
      script,
      voiceOption,
    },
  };
}

function parseVoiceSampleProfile(value: unknown): VoiceSampleProfile | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const source = value as Record<string, unknown>;
  const voiceFamily =
    source.voiceFamily === "lower" ||
    source.voiceFamily === "neutral" ||
    source.voiceFamily === "higher"
      ? source.voiceFamily
      : undefined;
  const energy =
    source.energy === "soft" ||
    source.energy === "balanced" ||
    source.energy === "strong"
      ? source.energy
      : undefined;
  const brightness =
    source.brightness === "warm" ||
    source.brightness === "balanced" ||
    source.brightness === "bright"
      ? source.brightness
      : undefined;

  return {
    averageRms: clampNumber(source.averageRms, 0, 1),
    peakRms: clampNumber(source.peakRms, 0, 1),
    zeroCrossingRate: clampNumber(source.zeroCrossingRate, 0, 0.5),
    estimatedPitchHz: clampNullableNumber(source.estimatedPitchHz, 60, 400),
    voiceFamily,
    energy,
    brightness,
  };
}

function clampNumber(value: unknown, min: number, max: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }

  return Math.min(max, Math.max(min, value));
}

function clampNullableNumber(value: unknown, min: number, max: number) {
  if (value === null) {
    return null;
  }

  return clampNumber(value, min, max);
}

function extensionFromMime(mimeType: string) {
  if (mimeType.includes("wav")) {
    return "wav";
  }

  if (mimeType.includes("mp4") || mimeType.includes("m4a")) {
    return "m4a";
  }

  if (mimeType.includes("mpeg") || mimeType.includes("mp3")) {
    return "mp3";
  }

  return "wav";
}

function decodeDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);

  if (!match) {
    throw new Error("Invalid voice sample data URL.");
  }

  return {
    buffer: Buffer.from(match[2], "base64"),
    extension: extensionFromMime(match[1]),
    mimeType: match[1],
  };
}

function splitF5Script(script: string) {
  const chunkCharacters = Number(process.env.F5_TTS_CHUNK_CHARS || 420);
  const sentences = script
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  const chunks: string[] = [];
  let currentChunk: string[] = [];
  let totalCharacters = 0;

  for (const sentence of sentences) {
    if (totalCharacters + sentence.length > chunkCharacters && currentChunk.length) {
      chunks.push(currentChunk.join(" "));
      currentChunk = [];
      totalCharacters = 0;
    }

    currentChunk.push(sentence);
    totalCharacters += sentence.length + 1;
  }

  if (currentChunk.length) {
    chunks.push(currentChunk.join(" "));
  }

  return chunks.length ? chunks : [script.slice(0, chunkCharacters).trim()];
}

async function transcribeReferenceAudio({
  apiKey,
  buffer,
  fileName,
  mimeType,
}: {
  apiKey: string;
  buffer: Buffer;
  fileName: string;
  mimeType: string;
}) {
  const openai = new OpenAI({
    apiKey,
    timeout: 60000,
  });

  const transcript = await openai.audio.transcriptions.create({
    file: await toFile(buffer, fileName, { type: mimeType }),
    model: "gpt-4o-mini-transcribe",
    response_format: "text",
  });

  return typeof transcript === "string" ? transcript.trim() : "";
}

async function synthesizeWithLocalF5({
  apiKey,
  clonePayload,
}: {
  apiKey: string;
  clonePayload: ParsedClonePayload;
}) {
  const decoded = decodeDataUrl(clonePayload.voiceSampleDataUrl);
  const tempDirectory = await mkdtemp(path.join(os.tmpdir(), "cinelife-f5-"));
  const referencePath = path.join(
    tempDirectory,
    `reference.${decoded.extension}`,
  );
  const outputFile = "cinelife-f5-cloned-voice.wav";
  const outputPath = path.join(tempDirectory, outputFile);

  try {
    await writeFile(referencePath, decoded.buffer);

    const refText = await transcribeReferenceAudio({
      apiKey,
      buffer: decoded.buffer,
      fileName: clonePayload.voiceSampleName || `reference.${decoded.extension}`,
      mimeType: decoded.mimeType,
    });

    if (refText.length < 8) {
      throw new Error(
        "F5-TTS needs a spoken voice sample with clear words. The uploaded reference audio could not be transcribed.",
      );
    }

    const command = process.env.F5_TTS_CLI_PATH || "f5-tts_infer-cli";
    const chunks = splitF5Script(clonePayload.script);
    const chunkPaths: string[] = [];

    for (const [index, chunk] of chunks.entries()) {
      const chunkOutputFile = `chunk-${String(index + 1).padStart(2, "0")}.wav`;
      const args = [
        "--model",
        process.env.F5_TTS_MODEL || "F5TTS_v1_Base",
        "--ref_audio",
        referencePath,
        "--ref_text",
        refText,
        "--gen_text",
        chunk,
        "--output_dir",
        tempDirectory,
        "--output_file",
        chunkOutputFile,
        "--speed",
        process.env.F5_TTS_SPEED || "0.82",
      ];

      if (process.env.F5_TTS_DEVICE) {
        args.push("--device", process.env.F5_TTS_DEVICE);
      }

      await execFileAsync(command, args, {
        timeout: Number(process.env.F5_TTS_TIMEOUT_MS || 300000),
        maxBuffer: 1024 * 1024 * 4,
      });
      chunkPaths.push(path.join(tempDirectory, chunkOutputFile));
    }

    if (chunkPaths.length === 1) {
      return await readFile(chunkPaths[0]);
    }

    const concatListPath = path.join(tempDirectory, "concat.txt");
    await writeFile(
      concatListPath,
      chunkPaths.map((chunkPath) => `file '${chunkPath}'`).join("\n"),
    );
    await execFileAsync("ffmpeg", [
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      concatListPath,
      "-acodec",
      "pcm_s16le",
      outputPath,
    ]);

    return await readFile(outputPath);
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      throw new Error(
        "F5-TTS is not installed. Install it with Python 3.11 and set F5_TTS_CLI_PATH to the f5-tts_infer-cli executable.",
      );
    }

    if (
      error &&
      typeof error === "object" &&
      "killed" in error &&
      error.killed
    ) {
      throw new Error(
        "F5-TTS timed out while generating the cloned narration.",
      );
    }

    if (error instanceof Error) {
      const stderr =
        "stderr" in error && typeof error.stderr === "string"
          ? error.stderr.slice(0, 1200)
          : "";
      const stdout =
        "stdout" in error && typeof error.stdout === "string"
          ? error.stdout.slice(0, 1200)
          : "";
      const details = [stderr, stdout].filter(Boolean).join("\n").trim();

      throw new Error(
        details
          ? `F5-TTS failed to generate cloned narration audio. ${details}`
          : error.message,
      );
    }

    throw error;
  } finally {
    await rm(tempDirectory, { force: true, recursive: true });
  }
}

function createLocalCloneProfile(profile?: VoiceSampleProfile) {
  const family = profile?.voiceFamily ?? "neutral";
  const energy = profile?.energy ?? "balanced";
  const brightness = profile?.brightness ?? "balanced";
  const estimatedPitch =
    typeof profile?.estimatedPitchHz === "number"
      ? Math.round(profile.estimatedPitchHz)
      : null;
  const voice =
    family === "lower"
      ? "onyx"
      : family === "higher"
        ? "nova"
        : energy === "strong"
          ? "verse"
          : "sage";
  const speed =
    energy === "soft" ? 0.9 : energy === "strong" ? 1 : 0.94;
  const profileLine = [
    `reference voice family: ${family}`,
    `energy: ${energy}`,
    `brightness: ${brightness}`,
    estimatedPitch ? `estimated pitch: ${estimatedPitch}Hz` : null,
  ]
    .filter(Boolean)
    .join(", ");

  return {
    voice,
    speed,
    instructions: `Create a cinematic narration guided by the user's locally analyzed voice sample profile (${profileLine}). Match the sample's general pacing, warmth, and intensity as a respectful approximation, while avoiding any claim of perfect biometric voice cloning. Keep the delivery premium, emotional, natural, and trailer-ready with dramatic pauses and clean articulation.`,
  } satisfies {
    voice: "onyx" | "nova" | "sage" | "verse";
    speed: number;
    instructions: string;
  };
}

async function synthesizeWithOpenAi({
  apiKey,
  script,
  voice,
  instructions,
  speed,
  fileName,
  voiceOption,
  voiceMode,
}: {
  apiKey: string;
  script: string;
  voice: "onyx" | "nova" | "sage" | "verse";
  instructions: string;
  speed: number;
  fileName: string;
  voiceOption: VoiceOption;
  voiceMode: string;
}) {
  const openai = new OpenAI({
    apiKey,
    timeout: 45000,
  });

  const speech = await openai.audio.speech.create({
    model: "gpt-4o-mini-tts",
    voice,
    input: script,
    instructions,
    response_format: "mp3",
    speed,
  });
  const audioBuffer = await speech.arrayBuffer();

  return new Response(audioBuffer, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Content-Type": "audio/mpeg",
      "X-CineLife-Voice": voiceOption,
      "X-CineLife-Voice-Mode": voiceMode,
    },
  });
}

export async function POST(request: Request) {
  let body: GenerateVoiceRequest;

  try {
    body = (await request.json()) as GenerateVoiceRequest;
  } catch {
    return jsonResponse({ error: "Request body must be valid JSON." }, 400);
  }

  const parsed = parsePayload(body);

  if ("error" in parsed) {
    return jsonResponse({ error: parsed.error }, 400);
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return jsonResponse(
      { error: "OPENAI_API_KEY is not configured on the server." },
      500,
    );
  }

  const { script, voiceOption } = parsed.value;

  if (voiceOption === "Clone My Voice") {
    const cloneEndpoint = process.env.VOICE_CLONING_API_URL;
    const clonePayload = parsed.value as ParsedClonePayload;

    if (cloneEndpoint) {
      try {
        const cloneResponse = await fetch(cloneEndpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(process.env.VOICE_CLONING_API_KEY
              ? { Authorization: `Bearer ${process.env.VOICE_CLONING_API_KEY}` }
              : {}),
          },
          body: JSON.stringify({
            script,
            voiceSampleDataUrl: clonePayload.voiceSampleDataUrl,
            voiceSampleName: clonePayload.voiceSampleName,
            voiceSampleProfile: clonePayload.voiceSampleProfile,
          }),
        });

        if (!cloneResponse.ok) {
          const errorText = await cloneResponse.text();
          return jsonResponse(
            {
              error:
                errorText ||
                "Voice cloning service failed to generate narration audio.",
            },
            cloneResponse.status,
          );
        }

        const audioBuffer = await cloneResponse.arrayBuffer();

        return new Response(audioBuffer, {
          headers: {
            "Cache-Control": "no-store",
            "Content-Disposition":
              'attachment; filename="cinelife-cloned-voice-over.mp3"',
            "Content-Type":
              cloneResponse.headers.get("content-type") ?? "audio/mpeg",
            "X-CineLife-Voice": voiceOption,
            "X-CineLife-Voice-Mode": "external-clone-service",
          },
        });
      } catch (error) {
        return jsonResponse(
          {
            error:
              error instanceof Error
                ? error.message
                : "Unable to reach the voice cloning service.",
          },
          502,
        );
      }
    }

    if (process.env.F5_TTS_ENABLED === "true" || process.env.F5_TTS_CLI_PATH) {
      try {
        const clonedAudio = await synthesizeWithLocalF5({
          apiKey,
          clonePayload,
        });

        return new Response(clonedAudio, {
          headers: {
            "Cache-Control": "no-store",
            "Content-Disposition":
              'attachment; filename="cinelife-f5-cloned-voice.wav"',
            "Content-Type": "audio/wav",
            "X-CineLife-Voice": voiceOption,
            "X-CineLife-Voice-Mode": "f5-tts-local",
          },
        });
      } catch (error) {
        return jsonResponse(
          {
            error:
              error instanceof Error
                ? error.message
                : "F5-TTS failed to generate cloned narration audio.",
          },
          502,
        );
      }
    }

    const localCloneProfile = createLocalCloneProfile(
      clonePayload.voiceSampleProfile,
    );

    try {
      return await synthesizeWithOpenAi({
        apiKey,
        script,
        voiceOption,
        voiceMode: "local-reference-tts",
        fileName: "cinelife-reference-guided-voice-over.mp3",
        ...localCloneProfile,
      });
    } catch (error) {
      if (error instanceof Error && error.name === "APIConnectionTimeoutError") {
        return jsonResponse({ error: "OpenAI voice generation timed out." }, 504);
      }

      if (error instanceof OpenAI.APIError) {
        return jsonResponse(
          {
            error:
              error.message || "OpenAI failed to generate the voice over.",
          },
          error.status ?? 502,
        );
      }

      return jsonResponse(
        { error: "Unable to generate reference-guided voice over." },
        502,
      );
    }
  }

  const profile = voiceProfiles[voiceOption];

  try {
    return await synthesizeWithOpenAi({
      apiKey,
      script,
      voiceOption,
      voiceMode: "openai-tts",
      fileName: "cinelife-voice-over.mp3",
      ...profile,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "APIConnectionTimeoutError") {
      return jsonResponse({ error: "OpenAI voice generation timed out." }, 504);
    }

    if (error instanceof OpenAI.APIError) {
      return jsonResponse(
        {
          error:
            error.message || "OpenAI failed to generate the voice over.",
        },
        error.status ?? 502,
      );
    }

    return jsonResponse(
      { error: "Unable to generate voice over. Try again shortly." },
      502,
    );
  }
}
