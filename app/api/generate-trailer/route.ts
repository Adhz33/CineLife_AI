import OpenAI from "openai";

const TRAILER_STYLES = [
  "Inspirational",
  "Emotional",
  "Thriller",
  "Sci-Fi",
  "Documentary",
  "Motivational",
] as const;

type TrailerStyle = (typeof TRAILER_STYLES)[number];

type TrailerNarration = {
  voiceOverScript: string;
  sceneTimeline: {
    sceneNumber: number;
    startTime: string;
    endTime: string;
    visualCue: string;
    narrationLine: string;
    emotionalIntensity: number;
  }[];
  soundDesignNotes: {
    soundtrackSuggestions: string[];
    transitionSuggestions: string[];
    mixingNotes: string;
  };
};

type GenerateTrailerRequest = {
  name?: unknown;
  futureDream?: unknown;
  trailerStyle?: unknown;
  photoCount?: unknown;
  photoDataUrls?: unknown;
  photoUrls?: unknown;
  photoInsights?: unknown;
  visualStorySequence?: unknown;
};

type PhotoInsight = {
  frameNumber: number;
  fileName: string;
  width?: number;
  height?: number;
  brightness?: number;
  mood?: string;
  classification?: string;
  dominantColors: {
    hex: string;
    label: string;
  }[];
};

type VisualStoryInput = {
  frameNumber: number;
  role: string;
  storyPurpose: string;
  photoReference: string;
};

const trailerSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "movieTitle",
    "tagline",
    "storySynopsis",
    "voiceNarration",
    "sceneTimeline",
    "musicPlan",
    "narration",
    "sceneBreakdown",
    "narrationPreview",
  ],
  properties: {
    movieTitle: {
      type: "string",
    },
    tagline: {
      type: "string",
    },
    storySynopsis: {
      type: "string",
    },
    voiceNarration: {
      type: "string",
    },
    sceneTimeline: {
      type: "array",
      minItems: 7,
      maxItems: 7,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "structure",
          "startTime",
          "endTime",
          "storyBeat",
          "photoReferences",
        ],
        properties: {
          structure: {
            type: "string",
            enum: [
              "HOOK",
              "MEMORIES",
              "STRUGGLE",
              "GROWTH",
              "DREAM",
              "TRANSFORMATION",
              "PROMISE",
            ],
          },
          startTime: {
            type: "string",
          },
          endTime: {
            type: "string",
          },
          storyBeat: {
            type: "string",
          },
          photoReferences: {
            type: "array",
            items: {
              type: "integer",
            },
          },
        },
      },
    },
    musicPlan: {
      type: "object",
      additionalProperties: false,
      required: ["mood", "tempo", "instrumentation", "cues"],
      properties: {
        mood: {
          type: "string",
        },
        tempo: {
          type: "string",
        },
        instrumentation: {
          type: "array",
          minItems: 3,
          maxItems: 6,
          items: {
            type: "string",
          },
        },
        cues: {
          type: "array",
          minItems: 4,
          maxItems: 8,
          items: {
            type: "string",
          },
        },
      },
    },
    narration: {
      type: "string",
    },
    sceneBreakdown: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "sceneNumber",
          "title",
          "visualDirection",
          "narrationBeat",
          "cameraMotion",
          "compositionFocusX",
          "compositionFocusY",
          "photoReferences",
        ],
        properties: {
          sceneNumber: {
            type: "integer",
          },
          title: {
            type: "string",
          },
          visualDirection: {
            type: "string",
          },
          narrationBeat: {
            type: "string",
          },
          cameraMotion: {
            type: "string",
          },
          compositionFocusX: {
            type: "number",
            minimum: 0,
            maximum: 100,
          },
          compositionFocusY: {
            type: "number",
            minimum: 0,
            maximum: 100,
          },
          photoReferences: {
            type: "array",
            items: {
              type: "integer",
            },
          },
        },
      },
    },
    narrationPreview: {
      type: "object",
      additionalProperties: false,
      required: [
        "voiceOverScript",
        "sceneTimeline",
        "soundDesignNotes",
      ],
      properties: {
        voiceOverScript: {
          type: "string",
        },
        sceneTimeline: {
          type: "array",
          minItems: 4,
          maxItems: 7,
          items: {
            type: "object",
            additionalProperties: false,
            required: [
              "sceneNumber",
              "startTime",
              "endTime",
              "visualCue",
              "narrationLine",
              "cameraMotion",
              "compositionFocusX",
              "compositionFocusY",
              "emotionalIntensity",
            ],
            properties: {
              sceneNumber: {
                type: "integer",
              },
              startTime: {
                type: "string",
              },
              endTime: {
                type: "string",
              },
              visualCue: {
                type: "string",
              },
              narrationLine: {
                type: "string",
              },
              cameraMotion: {
                type: "string",
              },
              compositionFocusX: {
                type: "number",
                minimum: 0,
                maximum: 100,
              },
              compositionFocusY: {
                type: "number",
                minimum: 0,
                maximum: 100,
              },
              emotionalIntensity: {
                type: "integer",
                minimum: 1,
                maximum: 10,
              },
            },
          },
        },
        soundDesignNotes: {
          type: "object",
          additionalProperties: false,
          required: [
            "soundtrackSuggestions",
            "transitionSuggestions",
            "mixingNotes",
          ],
          properties: {
            soundtrackSuggestions: {
              type: "array",
              minItems: 3,
              maxItems: 5,
              items: {
                type: "string",
              },
            },
            transitionSuggestions: {
              type: "array",
              minItems: 3,
              maxItems: 6,
              items: {
                type: "string",
              },
            },
            mixingNotes: {
              type: "string",
            },
          },
        },
      },
    },
  },
} as const;

function jsonResponse(body: unknown, status = 200) {
  return Response.json(body, { status });
}

function isTrailerStyle(value: unknown): value is TrailerStyle {
  return (
    typeof value === "string" &&
    TRAILER_STYLES.includes(value as TrailerStyle)
  );
}

function parsePayload(payload: GenerateTrailerRequest) {
  const name = typeof payload.name === "string" ? payload.name.trim() : "";
  const futureDream =
    typeof payload.futureDream === "string" ? payload.futureDream.trim() : "";
  const photoCount = Number(payload.photoCount);

  if (!futureDream) {
    return { error: "futureDream is required." };
  }

  if (!isTrailerStyle(payload.trailerStyle)) {
    return { error: "trailerStyle is invalid." };
  }

  if (!Number.isInteger(photoCount) || photoCount < 3 || photoCount > 10) {
    return { error: "photoCount must be an integer between 3 and 10." };
  }

  return {
    value: {
      name: name || "Your Hero",
      futureDream,
      trailerStyle: payload.trailerStyle,
      photoCount,
      photoDataUrls: sanitizePhotoDataUrls(payload.photoDataUrls, photoCount),
      photoUrls: sanitizePhotoUrls(payload.photoUrls, photoCount),
      photoInsights: sanitizePhotoInsights(payload.photoInsights, photoCount),
      visualStorySequence: sanitizeVisualStorySequence(
        payload.visualStorySequence,
        photoCount,
      ),
    },
  };
}

function sanitizePhotoDataUrls(value: unknown, photoCount: number) {
  if (!Array.isArray(value)) {
    return [] satisfies string[];
  }

  return value
    .filter(
      (item): item is string =>
        typeof item === "string" &&
        item.startsWith("data:image/") &&
        item.includes(";base64,"),
    )
    .slice(0, photoCount);
}

function sanitizePhotoUrls(value: unknown, photoCount: number) {
  if (!Array.isArray(value)) {
    return [] satisfies string[];
  }

  return value
    .filter((item): item is string => {
      if (typeof item !== "string") {
        return false;
      }

      try {
        const url = new URL(item);
        return url.protocol === "https:" || url.protocol === "http:";
      } catch {
        return false;
      }
    })
    .slice(0, photoCount);
}

function sanitizeText(value: unknown, fallback = "") {
  return typeof value === "string"
    ? value.trim().replace(/\s+/g, " ").slice(0, 240)
    : fallback;
}

function sanitizeFrameNumber(value: unknown, photoCount: number) {
  const frameNumber = Number(value);

  if (
    Number.isInteger(frameNumber) &&
    frameNumber >= 1 &&
    frameNumber <= photoCount
  ) {
    return frameNumber;
  }

  return null;
}

function sanitizePhotoInsights(value: unknown, photoCount: number) {
  if (!Array.isArray(value)) {
    return [] satisfies PhotoInsight[];
  }

  return value
    .map((item): PhotoInsight | null => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const source = item as Record<string, unknown>;
      const frameNumber = sanitizeFrameNumber(source.frameNumber, photoCount);

      if (!frameNumber) {
        return null;
      }

      const dominantColors = Array.isArray(source.dominantColors)
        ? source.dominantColors
            .map((color) => {
              if (!color || typeof color !== "object") {
                return null;
              }

              const colorSource = color as Record<string, unknown>;
              return {
                hex: sanitizeText(colorSource.hex).slice(0, 16),
                label: sanitizeText(colorSource.label, "cinematic color"),
              };
            })
            .filter((color): color is { hex: string; label: string } =>
              Boolean(color?.hex && color.label),
            )
            .slice(0, 4)
        : [];

      return {
        frameNumber,
        fileName: sanitizeText(source.fileName, `Frame ${frameNumber}`),
        width:
          typeof source.width === "number" && Number.isFinite(source.width)
            ? Math.round(source.width)
            : undefined,
        height:
          typeof source.height === "number" && Number.isFinite(source.height)
            ? Math.round(source.height)
            : undefined,
        brightness:
          typeof source.brightness === "number" &&
          Number.isFinite(source.brightness)
            ? Math.round(source.brightness)
            : undefined,
        mood: sanitizeText(source.mood),
        classification: sanitizeText(source.classification),
        dominantColors,
      };
    })
    .filter((item): item is PhotoInsight => Boolean(item))
    .slice(0, 10);
}

function sanitizeVisualStorySequence(value: unknown, photoCount: number) {
  if (!Array.isArray(value)) {
    return [] satisfies VisualStoryInput[];
  }

  return value
    .map((item): VisualStoryInput | null => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const source = item as Record<string, unknown>;
      const frameNumber = sanitizeFrameNumber(source.frameNumber, photoCount);

      if (!frameNumber) {
        return null;
      }

      return {
        frameNumber,
        role: sanitizeText(source.role, `Frame ${frameNumber}`),
        storyPurpose: sanitizeText(source.storyPurpose),
        photoReference: sanitizeText(
          source.photoReference,
          `Frame ${frameNumber}`,
        ),
      };
    })
    .filter((item): item is VisualStoryInput => Boolean(item))
    .slice(0, 10);
}

function isGeneratedTrailer(value: unknown) {
  if (!value || typeof value !== "object") {
    return false;
  }

  const trailer = value as {
    movieTitle?: unknown;
    tagline?: unknown;
    storySynopsis?: unknown;
    voiceNarration?: unknown;
    sceneTimeline?: unknown;
    musicPlan?: unknown;
    narration?: unknown;
    sceneBreakdown?: unknown;
    narrationPreview?: unknown;
  };

  return (
    typeof trailer.movieTitle === "string" &&
    typeof trailer.tagline === "string" &&
    typeof trailer.storySynopsis === "string" &&
    typeof trailer.voiceNarration === "string" &&
    Array.isArray(trailer.sceneTimeline) &&
    trailer.sceneTimeline.length === 7 &&
    Boolean(trailer.musicPlan) &&
    typeof trailer.musicPlan === "object" &&
    typeof trailer.narration === "string" &&
    Array.isArray(trailer.sceneBreakdown) &&
    trailer.sceneBreakdown.length >= 1 &&
    trailer.sceneBreakdown.every((scene) => {
      if (!scene || typeof scene !== "object") {
        return false;
      }

      const item = scene as {
        sceneNumber?: unknown;
        title?: unknown;
        visualDirection?: unknown;
        narrationBeat?: unknown;
        photoReferences?: unknown;
      };

      return (
        typeof item.sceneNumber === "number" &&
        Number.isInteger(item.sceneNumber) &&
        typeof item.title === "string" &&
        typeof item.visualDirection === "string" &&
        typeof item.narrationBeat === "string" &&
        typeof (item as { cameraMotion?: unknown }).cameraMotion === "string" &&
        Array.isArray(item.photoReferences) &&
        item.photoReferences.every(
          (photoReference) =>
            typeof photoReference === "number" &&
            Number.isInteger(photoReference),
        )
      );
    }) &&
    isTrailerNarration(trailer.narrationPreview)
  );
}

function isTrailerNarration(value: unknown): value is TrailerNarration {
  if (!value || typeof value !== "object") {
    return false;
  }

  const narration = value as {
    voiceOverScript?: unknown;
    sceneTimeline?: unknown;
    soundDesignNotes?: unknown;
  };

  if (
    typeof narration.voiceOverScript !== "string" ||
    !Array.isArray(narration.sceneTimeline) ||
    narration.sceneTimeline.length < 1 ||
    !narration.sceneTimeline.every((scene) => {
      if (!scene || typeof scene !== "object") {
        return false;
      }

      const item = scene as {
        sceneNumber?: unknown;
        startTime?: unknown;
        endTime?: unknown;
        visualCue?: unknown;
        narrationLine?: unknown;
        emotionalIntensity?: unknown;
      };

      return (
        typeof item.sceneNumber === "number" &&
        Number.isInteger(item.sceneNumber) &&
        typeof item.startTime === "string" &&
        typeof item.endTime === "string" &&
        typeof item.visualCue === "string" &&
        typeof item.narrationLine === "string" &&
        typeof item.emotionalIntensity === "number" &&
        Number.isInteger(item.emotionalIntensity) &&
        item.emotionalIntensity >= 1 &&
        item.emotionalIntensity <= 10
      );
    })
  ) {
    return false;
  }

  const notes = narration.soundDesignNotes as {
    soundtrackSuggestions?: unknown;
    transitionSuggestions?: unknown;
    mixingNotes?: unknown;
  };

  return (
    Boolean(notes) &&
    typeof notes === "object" &&
    Array.isArray(notes.soundtrackSuggestions) &&
    notes.soundtrackSuggestions.every((item) => typeof item === "string") &&
    Array.isArray(notes.transitionSuggestions) &&
    notes.transitionSuggestions.every((item) => typeof item === "string") &&
    typeof notes.mixingNotes === "string"
  );
}

function parseJsonCandidate(candidate: string) {
  try {
    return { value: JSON.parse(candidate) as unknown, recovered: false };
  } catch {
    return null;
  }
}

function looksLikeTrailerRoot(value: unknown) {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as {
    movieTitle?: unknown;
    tagline?: unknown;
    narrationPreview?: unknown;
  };

  return (
    typeof candidate.movieTitle === "string" &&
    typeof candidate.tagline === "string" &&
    Boolean(candidate.narrationPreview) &&
    typeof candidate.narrationPreview === "object"
  );
}

function extractBalancedJsonObject(text: string) {
  for (let start = 0; start < text.length; start += 1) {
    if (text[start] !== "{") {
      continue;
    }

    let depth = 0;
    let isInString = false;
    let isEscaped = false;

    for (let index = start; index < text.length; index += 1) {
      const character = text[index];

      if (isEscaped) {
        isEscaped = false;
        continue;
      }

      if (character === "\\") {
        isEscaped = true;
        continue;
      }

      if (character === '"') {
        isInString = !isInString;
        continue;
      }

      if (isInString) {
        continue;
      }

      if (character === "{") {
        depth += 1;
      }

      if (character === "}") {
        depth -= 1;

        if (depth === 0) {
          return text.slice(start, index + 1);
        }
      }
    }
  }

  return null;
}

function parseTrailerJson(outputText: string) {
  const trimmedText = outputText.trim();
  const directParse = parseJsonCandidate(trimmedText);

  if (directParse) {
    return directParse;
  }

  const fencedJsonBlocks = Array.from(
    trimmedText.matchAll(/```(?:json)?\s*([\s\S]*?)\s*```/gi),
  );

  for (const block of fencedJsonBlocks) {
    const fencedParse = parseJsonCandidate(block[1].trim());

    if (fencedParse) {
      return { ...fencedParse, recovered: true };
    }
  }

  for (let start = 0; start < trimmedText.length; start += 1) {
    if (trimmedText[start] !== "{") {
      continue;
    }

    const balancedJson = extractBalancedJsonObject(trimmedText.slice(start));

    if (!balancedJson) {
      continue;
    }

    const recoveredParse = parseJsonCandidate(balancedJson);

    if (recoveredParse && looksLikeTrailerRoot(recoveredParse.value)) {
      return { ...recoveredParse, recovered: true };
    }
  }

  return {
    error:
      "OpenAI returned trailer text that was not valid JSON after recovery attempts.",
  };
}

function logOpenAITrailerFailure(
  reason: string,
  outputText: string | undefined,
  response: unknown,
  parsedJson?: unknown,
) {
  console.error(`[CineLife] ${reason}`);
  console.error("[CineLife] Exact OpenAI output_text:", outputText ?? "");
  console.error(
    "[CineLife] Exact OpenAI response:",
    JSON.stringify(response, null, 2),
  );

  if (parsedJson !== undefined) {
    console.error(
      "[CineLife] Parsed JSON that failed validation:",
      JSON.stringify(parsedJson, null, 2),
    );
  }
}

export async function POST(request: Request) {
  let body: GenerateTrailerRequest;

  try {
    body = (await request.json()) as GenerateTrailerRequest;
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

  const {
    name,
    futureDream,
    trailerStyle,
    photoCount,
    photoDataUrls,
    photoUrls,
    photoInsights,
    visualStorySequence,
  } = parsed.value;
  const photoImageInputs = [...photoDataUrls, ...photoUrls].slice(0, photoCount);
  const photoContext = photoInsights.length
    ? JSON.stringify(photoInsights, null, 2)
    : "No per-frame metadata was provided.";
  const storyContext = visualStorySequence.length
    ? JSON.stringify(visualStorySequence, null, 2)
    : "No visual story sequence was provided.";
  const openai = new OpenAI({
    apiKey,
    timeout: 120000,
  });

  try {
    const response = await openai.responses.create({
      model: "gpt-5-mini",
      instructions:
        "You write premium cinematic life-trailer copy for CineLife AI. Return only schema-valid JSON. Do not mention APIs, implementation details, voice cloning, video export, or unavailable features.",
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `Create a Netflix-style AI life trailer concept for:
Name: ${name}
Future dream: ${futureDream}
Trailer style: ${trailerStyle}
Uploaded photo count: ${photoCount}
Uploaded photo intelligence:
${photoContext}

Visual story sequence from the uploaded frames:
${storyContext}

You are also receiving the actual uploaded photos as image inputs. Analyze them carefully for people, expressions, visible emotion, lighting, environment, achievements, relationships, milestones, and story moments. The output must feel personal to these images and this user's future dream.

Create a professional Netflix-style narration structure with:
- HOOK
- MEMORIES
- STRUGGLE
- GROWTH
- DREAM
- TRANSFORMATION
- PROMISE

Voice narration rules:
- Never include timestamps in narration, voiceNarration, narration, or narrationPreview.voiceOverScript.
- Use dramatic pauses as natural punctuation and line breaks, not bracketed metadata.
- Do not write generic life advice.
- Tie the story directly to the visible uploaded photos and the future dream.

Style direction:
- Inspirational: hopeful, expansive, luminous, victorious without sounding generic.
- Emotional: intimate, vulnerable, memory-led, restrained but powerful.
- Thriller: urgent, tense, sharp, built around pressure and revelation.
- Sci-Fi: futuristic, awe-filled, signal-driven, precise and cinematic.
- Documentary: grounded, truthful, observational, human and credible.
- Motivational: bold, driving, declarative, focused on momentum and transformation.

The narration should be cinematic, emotionally specific, and suitable for a 30-60 second trailer. The narrationPreview.sceneTimeline must cover roughly 45 seconds total using timecodes like "00:00" to "00:08", include emotionalIntensity from 1-10, and align with the selected trailer style. The scene breakdown must reference uploaded photos by frame number using photoReferences, and the visualDirection/narrationBeat should reflect actual image content, metadata, and story sequence. Provide compositionFocusX and compositionFocusY as 0-100 focus coordinates for intelligent cropping. Do not invent placeholder stock footage.`,
            },
            ...photoImageInputs.map((photoImageInput) => ({
              type: "input_image" as const,
              detail: "auto" as const,
              image_url: photoImageInput,
            })),
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "cinelife_trailer",
          strict: true,
          schema: trailerSchema,
        },
        verbosity: "low",
      },
      reasoning: {
        effort: "minimal",
      },
      max_output_tokens: 6000,
    });

    const outputText = response.output_text;
    const responseStatus = (response as { status?: unknown }).status;

    if (responseStatus === "incomplete") {
      logOpenAITrailerFailure(
        "OpenAI trailer response was incomplete before JSON parsing.",
        outputText,
        response,
      );

      return jsonResponse(
        {
          code: "TRAILER_INCOMPLETE_RESPONSE",
          error:
            "OpenAI started generating the trailer JSON but cut the response short. Please try again.",
        },
        502,
      );
    }

    if (!outputText) {
      logOpenAITrailerFailure(
        "OpenAI returned an empty trailer response.",
        outputText,
        response,
      );

      return jsonResponse(
        {
          code: "TRAILER_EMPTY_RESPONSE",
          error:
            "OpenAI did not return trailer JSON. Please try generating again.",
        },
        502,
      );
    }

    const parseResult = parseTrailerJson(outputText);

    if ("error" in parseResult) {
      logOpenAITrailerFailure(
        "OpenAI trailer JSON parse failed after safe extraction.",
        outputText,
        response,
      );

      return jsonResponse(
        {
          code: "TRAILER_JSON_PARSE_FAILED",
          error:
            "OpenAI returned trailer text that could not be parsed as JSON after recovery. Please try generating again.",
        },
        502,
      );
    }

    if (!isGeneratedTrailer(parseResult.value)) {
      logOpenAITrailerFailure(
        "OpenAI trailer JSON failed schema validation.",
        outputText,
        response,
        parseResult.value,
      );

      return jsonResponse(
        {
          code: "TRAILER_VALIDATION_FAILED",
          error:
            "OpenAI returned trailer JSON, but it did not match the required CineLife trailer structure. Please try generating again.",
        },
        502,
      );
    }

    return jsonResponse(parseResult.value);
  } catch (error) {
    if (error instanceof Error && error.name === "APIConnectionTimeoutError") {
      return jsonResponse({ error: "OpenAI request timed out." }, 504);
    }

    if (error instanceof OpenAI.APIError) {
      return jsonResponse(
        {
          error:
            error.message || "OpenAI failed to generate the trailer concept.",
        },
        error.status ?? 502,
      );
    }

    return jsonResponse(
      { error: "Unable to reach OpenAI. Try again shortly." },
      502,
    );
  }
}
