"use client";

import {
  ChangeEvent,
  DragEvent,
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { cleanNarrationForVoice } from "@/lib/narration";
import { ensureAnonymousSupabaseSession } from "@/lib/supabase-browser";

type FormState = {
  name: string;
  futureDream: string;
  trailerStyle: TrailerStyle;
};

type TrailerStyle =
  | "Inspirational"
  | "Emotional"
  | "Thriller"
  | "Sci-Fi"
  | "Documentary"
  | "Motivational";

type VoiceOption =
  | "Cinematic Male"
  | "Cinematic Female"
  | "Documentary"
  | "Motivational"
  | "Clone My Voice";

type UploadedPhoto = {
  id: string;
  file: File;
  name: string;
  url: string;
};

type DominantColor = {
  hex: string;
  label: string;
  rgb: [number, number, number];
};

type PhotoClassification = "portrait" | "group" | "landscape";

type PhotoSignal = {
  brightness: number;
  contrast: number;
  warmth: number;
  width: number;
  height: number;
  dominantColors: DominantColor[];
  mood: string;
  classification: PhotoClassification;
};

type PhotoAnalysis = {
  averageBrightness: number;
  averageContrast: number;
  averageWarmth: number;
  landscapeCount: number;
  portraitCount: number;
  squareCount: number;
  mood: string;
  palette: string;
  format: string;
  dominantColors: DominantColor[];
};

type GeneratedTrailer = {
  movieTitle: string;
  tagline: string;
  storySynopsis?: string;
  voiceNarration?: string;
  musicPlan?: {
    mood: string;
    tempo: string;
    instrumentation: string[];
    cues: string[];
  };
  narration: string;
  sceneBreakdown: {
    sceneNumber: number;
    title: string;
    visualDirection: string;
    narrationBeat: string;
    cameraMotion?: string;
    compositionFocusX?: number;
    compositionFocusY?: number;
    photoReferences?: number[];
  }[];
  narrationPreview: TrailerNarration;
};

type TrailerNarration = {
  voiceOverScript: string;
  sceneTimeline: {
    sceneNumber: number;
    startTime: string;
    endTime: string;
    visualCue: string;
    narrationLine: string;
    cameraMotion?: string;
    compositionFocusX?: number;
    compositionFocusY?: number;
    emotionalIntensity: number;
  }[];
  soundDesignNotes: {
    soundtrackSuggestions: string[];
    transitionSuggestions: string[];
    mixingNotes: string;
  };
};

type VisualStoryBeat = {
  photoId: string;
  frameNumber: number;
  role: string;
  storyPurpose: string;
  photoReference: string;
};

type MovieResult = {
  title: string;
  genre: string;
  storyline: string;
  trailerNarration: string;
  futureChapter: string;
  posterConcept: string;
  tagline: string;
  sceneBreakdown: string[];
  narrationPreview: TrailerNarration;
  analysis: PhotoAnalysis;
  posterPhoto: UploadedPhoto;
};

type PlaybackState = "idle" | "playing" | "paused" | "ended";
type VoicePlaybackState = "idle" | "playing" | "paused" | "ended";

type GeneratedVoice = {
  url: string;
  blob: Blob;
  voiceOption: VoiceOption;
  fileName: string;
};

type RenderedTrailerVideo = {
  url: string;
  blob?: Blob;
  fileName: string;
  shareUrl?: string;
  trailerId?: string;
};

type ConfigStatus = {
  checks: {
    openai: boolean;
    cloudinary: boolean;
    supabaseServer: boolean;
    supabaseBrowser: boolean;
  };
  diagnostics?: Record<
    keyof ConfigStatus["checks"],
    {
      status: "ready" | "missing" | "invalid";
      message: string;
      missingEnv?: string[];
    }
  >;
  isProductionReady: boolean;
  missing: string[];
};

type TrailerJobSnapshot = {
  jobId: string;
  status: "created" | "uploading" | "generating" | "rendering" | "complete" | "failed";
  progress: number;
  stage: string;
  error?: string | null;
  resultVideoUrl?: string | null;
  downloadUrl?: string | null;
  metadata?: Record<string, unknown>;
};

type VoiceSample = {
  file: File;
  url: string;
  duration: number;
  profile?: VoiceSampleProfile;
  quality: VoiceSampleQuality;
};

type VoiceSampleProfile = {
  averageRms: number;
  peakRms: number;
  zeroCrossingRate: number;
  silentRatio: number;
  estimatedPitchHz: number | null;
  voiceFamily: "lower" | "neutral" | "higher";
  energy: "soft" | "balanced" | "strong";
  brightness: "warm" | "balanced" | "bright";
};

type VoiceQualityStatus = "pass" | "warning" | "fail";

type VoiceSampleQuality = {
  speechDetected: boolean;
  durationSeconds: number;
  durationStatus: VoiceQualityStatus;
  volumeStatus: VoiceQualityStatus;
  noiseStatus: VoiceQualityStatus;
  volumeLabel: string;
  noiseLabel: string;
  verdict: "ready" | "needs-improvement" | "blocked";
  notes: string[];
};

const initialFormState: FormState = {
  name: "",
  futureDream: "",
  trailerStyle: "Inspirational",
};

const accents = [
  "from-rose-500 to-amber-300",
  "from-fuchsia-500 to-red-400",
  "from-orange-400 to-yellow-300",
  "from-red-500 to-pink-400",
  "from-cyan-300 to-blue-500",
  "from-violet-400 to-rose-400",
];

const trailerStyles: {
  name: TrailerStyle;
  description: string;
  cue: string;
  accent: string;
  preview: string;
}[] = [
  {
    name: "Inspirational",
    description: "Hopeful arcs, glowing horizons, and a final beat that feels earned.",
    cue: "Golden rise",
    accent: "from-amber-300 via-orange-400 to-red-500",
    preview: "bg-[radial-gradient(circle_at_30%_20%,rgba(251,191,36,0.72),transparent_34%),linear-gradient(135deg,rgba(127,29,29,0.95),rgba(24,24,27,0.94))]",
  },
  {
    name: "Emotional",
    description: "Soft memory cuts, intimate pacing, and narration that sits close to the heart.",
    cue: "Quiet ache",
    accent: "from-rose-300 via-red-400 to-fuchsia-500",
    preview: "bg-[radial-gradient(circle_at_68%_24%,rgba(244,114,182,0.42),transparent_32%),linear-gradient(145deg,rgba(76,5,25,0.96),rgba(24,24,27,0.95))]",
  },
  {
    name: "Thriller",
    description: "High-contrast frames, tense pauses, and a pulse that keeps tightening.",
    cue: "Pressure cut",
    accent: "from-zinc-200 via-red-500 to-zinc-950",
    preview: "bg-[linear-gradient(120deg,rgba(9,9,11,0.98),rgba(127,29,29,0.7)_48%,rgba(3,7,18,0.98)),radial-gradient(circle_at_80%_10%,rgba(255,255,255,0.22),transparent_20%)]",
  },
  {
    name: "Sci-Fi",
    description: "Cool light, future interfaces, and a destiny that feels larger than today.",
    cue: "Signal lock",
    accent: "from-cyan-300 via-blue-500 to-violet-600",
    preview: "bg-[radial-gradient(circle_at_75%_20%,rgba(34,211,238,0.58),transparent_28%),linear-gradient(135deg,rgba(8,47,73,0.96),rgba(24,24,27,0.94))]",
  },
  {
    name: "Documentary",
    description: "Grounded storytelling, archival restraint, and a truthful cinematic voice.",
    cue: "True frame",
    accent: "from-zinc-100 via-stone-400 to-zinc-700",
    preview: "bg-[linear-gradient(135deg,rgba(63,63,70,0.92),rgba(24,24,27,0.96)),repeating-linear-gradient(0deg,rgba(255,255,255,0.07)_0_1px,transparent_1px_12px)]",
  },
  {
    name: "Motivational",
    description: "Bold rhythm, powerful declarations, and a closing shot built to move.",
    cue: "Final push",
    accent: "from-yellow-300 via-red-500 to-pink-600",
    preview: "bg-[radial-gradient(circle_at_22%_18%,rgba(250,204,21,0.64),transparent_30%),linear-gradient(145deg,rgba(127,29,29,0.97),rgba(9,9,11,0.95))]",
  },
];

const voiceOptions: {
  name: VoiceOption;
  description: string;
  accent: string;
}[] = [
  {
    name: "Cinematic Male",
    description: "Deep, controlled, premium trailer cadence.",
    accent: "from-red-500 to-amber-300",
  },
  {
    name: "Cinematic Female",
    description: "Warm, intimate, powerful cinematic delivery.",
    accent: "from-fuchsia-400 to-red-400",
  },
  {
    name: "Documentary",
    description: "Grounded, credible, observant streaming tone.",
    accent: "from-zinc-200 to-stone-500",
  },
  {
    name: "Motivational",
    description: "Bold, driving, energetic final-act voice.",
    accent: "from-yellow-300 to-red-500",
  },
  {
    name: "Clone My Voice",
    description: "Upload a short reference sample for a future cloning phase.",
    accent: "from-cyan-300 to-violet-500",
  },
];

const journeySteps = [
  "Upload Photos",
  "Future Dream",
  "Choose Style",
  "Generate Trailer",
];

const heroFeatureBadges = ["🎬 AI Trailer", "🎤 AI Narration", "🎥 MP4 Export"];

const productionStages = [
  "Session",
  "Upload",
  "Vision",
  "Story",
  "Narration",
  "Render",
  "Upload MP4",
  "Complete",
];

const colorNames = [
  { label: "ruby red", rgb: [185, 28, 28] },
  { label: "ember orange", rgb: [234, 88, 12] },
  { label: "golden amber", rgb: [245, 158, 11] },
  { label: "forest green", rgb: [22, 101, 52] },
  { label: "teal blue", rgb: [13, 148, 136] },
  { label: "cinematic blue", rgb: [37, 99, 235] },
  { label: "violet night", rgb: [124, 58, 237] },
  { label: "soft rose", rgb: [225, 29, 72] },
  { label: "warm skin tone", rgb: [217, 119, 87] },
  { label: "deep shadow", rgb: [24, 24, 27] },
  { label: "silver light", rgb: [212, 212, 216] },
];

const stopWords = new Set([
  "about",
  "after",
  "again",
  "because",
  "before",
  "build",
  "could",
  "dream",
  "every",
  "future",
  "people",
  "their",
  "there",
  "thing",
  "those",
  "through",
  "where",
  "while",
  "would",
]);

function hashText(text: string) {
  return Array.from(text).reduce(
    (hash, character) => (hash * 31 + character.charCodeAt(0)) >>> 0,
    7,
  );
}

function pick<T>(items: T[], seed: number) {
  return items[Math.abs(seed) % items.length];
}

function titleCase(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function cleanSentence(value: string, fallback: string) {
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed) {
    return fallback;
  }

  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function extractKeyword(text: string, fallback: string) {
  const keywords = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 4 && !stopWords.has(word));

  if (!keywords.length) {
    return fallback;
  }

  return titleCase(keywords[hashText(text) % keywords.length]);
}

function toHex(value: number) {
  return Math.round(value).toString(16).padStart(2, "0");
}

function rgbToHex(red: number, green: number, blue: number) {
  return `#${toHex(red)}${toHex(green)}${toHex(blue)}`;
}

function nearestColorName(red: number, green: number, blue: number) {
  return colorNames.reduce(
    (closest, color) => {
      const distance =
        (red - color.rgb[0]) ** 2 +
        (green - color.rgb[1]) ** 2 +
        (blue - color.rgb[2]) ** 2;

      return distance < closest.distance
        ? { label: color.label, distance }
        : closest;
    },
    { label: "cinematic neutral", distance: Number.POSITIVE_INFINITY },
  ).label;
}

function detectPhotoMood(brightness: number, contrast: number, warmth: number) {
  if (brightness > 172 && warmth > 4) {
    return "hopeful";
  }

  if (brightness < 82) {
    return "moody";
  }

  if (contrast > 48) {
    return "dramatic";
  }

  if (warmth > 18) {
    return "nostalgic";
  }

  if (warmth < -14) {
    return "cool and reflective";
  }

  return "intimate";
}

function classifyPhoto(width: number, height: number, contrast: number) {
  if (width > height * 1.16) {
    return "landscape" satisfies PhotoClassification;
  }

  if (height > width * 1.16 && contrast < 58) {
    return "portrait" satisfies PhotoClassification;
  }

  return "group" satisfies PhotoClassification;
}

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not read image."));
    image.src = url;
  });
}

async function analyzePhoto(photo: UploadedPhoto): Promise<PhotoSignal> {
  const image = await loadImage(photo.url);
  const canvas = document.createElement("canvas");
  const size = 72;
  canvas.width = size;
  canvas.height = size;

  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    throw new Error("Canvas analysis is unavailable in this browser.");
  }

  context.drawImage(image, 0, 0, size, size);
  const pixels = context.getImageData(0, 0, size, size).data;
  let totalBrightness = 0;
  let totalWarmth = 0;
  let previousBrightness = 0;
  let contrast = 0;
  const colorBuckets = new Map<string, { count: number; rgb: [number, number, number] }>();

  for (let index = 0; index < pixels.length; index += 4) {
    const red = pixels[index];
    const green = pixels[index + 1];
    const blue = pixels[index + 2];
    const brightness = (red + green + blue) / 3;

    totalBrightness += brightness;
    totalWarmth += red - blue;
    contrast += Math.abs(brightness - previousBrightness);
    previousBrightness = brightness;

    const alpha = pixels[index + 3];
    if (alpha > 12) {
      const bucketRed = Math.round(red / 48) * 48;
      const bucketGreen = Math.round(green / 48) * 48;
      const bucketBlue = Math.round(blue / 48) * 48;
      const key = `${bucketRed}-${bucketGreen}-${bucketBlue}`;
      const currentBucket = colorBuckets.get(key);

      colorBuckets.set(key, {
        count: (currentBucket?.count ?? 0) + 1,
        rgb: [bucketRed, bucketGreen, bucketBlue],
      });
    }
  }

  const pixelCount = pixels.length / 4;
  const brightness = totalBrightness / pixelCount;
  const averageContrast = contrast / pixelCount;
  const warmth = totalWarmth / pixelCount;
  const dominantColors = Array.from(colorBuckets.values())
    .sort((left, right) => right.count - left.count)
    .slice(0, 4)
    .map(({ rgb }) => ({
      hex: rgbToHex(rgb[0], rgb[1], rgb[2]),
      label: nearestColorName(rgb[0], rgb[1], rgb[2]),
      rgb,
    }));

  return {
    brightness,
    contrast: averageContrast,
    warmth,
    width: image.naturalWidth,
    height: image.naturalHeight,
    dominantColors,
    mood: detectPhotoMood(brightness, averageContrast, warmth),
    classification: classifyPhoto(
      image.naturalWidth,
      image.naturalHeight,
      averageContrast,
    ),
  };
}

async function analyzePhotos(photos: UploadedPhoto[]): Promise<PhotoAnalysis> {
  const signals = await Promise.all(photos.map((photo) => analyzePhoto(photo)));
  const average = (key: keyof Pick<PhotoSignal, "brightness" | "contrast" | "warmth">) =>
    signals.reduce((total, signal) => total + signal[key], 0) / signals.length;

  const averageBrightness = average("brightness");
  const averageContrast = average("contrast");
  const averageWarmth = average("warmth");
  const landscapeCount = signals.filter((signal) => signal.width > signal.height * 1.08).length;
  const portraitCount = signals.filter((signal) => signal.height > signal.width * 1.08).length;
  const squareCount = signals.length - landscapeCount - portraitCount;

  const mood =
    averageBrightness > 168
      ? "radiant"
      : averageBrightness < 92
        ? "moody"
        : averageContrast > 46
          ? "dramatic"
          : "nostalgic";

  const palette =
    averageWarmth > 16
      ? "warm amber"
      : averageWarmth < -12
        ? "cool blue"
        : "balanced cinematic";

  const format =
    landscapeCount >= portraitCount && landscapeCount >= squareCount
      ? "wide-screen travelogue"
      : portraitCount > landscapeCount
        ? "intimate portrait film"
        : "memory-collage feature";

  return {
    averageBrightness,
    averageContrast,
    averageWarmth,
    landscapeCount,
    portraitCount,
    squareCount,
    mood,
    palette,
    format,
    dominantColors: combineDominantColors(signals),
  };
}

function combineDominantColors(signals: PhotoSignal[]) {
  const colorMap = new Map<string, DominantColor & { count: number }>();

  signals.flatMap((signal) => signal.dominantColors).forEach((color) => {
    const existingColor = colorMap.get(color.hex);
    colorMap.set(color.hex, {
      ...color,
      count: (existingColor?.count ?? 0) + 1,
    });
  });

  return Array.from(colorMap.values())
    .sort((left, right) => right.count - left.count)
    .slice(0, 5)
    .map((color) => ({
      hex: color.hex,
      label: color.label,
      rgb: color.rgb,
    }));
}

function createVisualStorySequence(
  photos: UploadedPhoto[],
  photoSignals: Record<string, PhotoSignal>,
  dream: string,
  style: TrailerStyle,
) {
  const roles = [
    "Opening memory",
    "Character reveal",
    "Emotional turn",
    "Dream signal",
    "Rising stakes",
    "Final promise",
  ];

  return photos.map((photo, index): VisualStoryBeat => {
    const signal = photoSignals[photo.id];
    const role = roles[Math.min(index, roles.length - 1)];
    const classification = signal?.classification ?? "group";
    const mood = signal?.mood ?? "cinematic";
    const colorLanguage =
      signal?.dominantColors.map((color) => color.label).join(", ") ??
      "balanced cinematic tones";

    return {
      photoId: photo.id,
      frameNumber: index + 1,
      role,
      storyPurpose: `${role} for a ${style} trailer: use this ${classification} frame with ${mood} energy and ${colorLanguage} to connect the present life to ${dream || "the future dream"}.`,
      photoReference: `Frame ${index + 1} (${classification}, ${mood})`,
    };
  });
}

function detectGenre(analysis: PhotoAnalysis, dream: string) {
  const lowerDream = dream.toLowerCase();
  const subject =
    lowerDream.match(/ai|robot|tech|startup|space|future|machine/)
      ? "near-future"
      : lowerDream.match(/travel|city|ocean|mountain|journey|road|world/)
        ? "adventure"
        : lowerDream.match(/music|film|paint|write|studio|artist|camera/)
          ? "creative"
          : lowerDream.match(/family|home|community|teach|heal|help/)
            ? "humanist"
            : "life";

  const moodGenre =
    analysis.mood === "moody"
      ? "noir-tinged"
      : analysis.mood === "radiant"
        ? "uplifting"
        : analysis.mood === "dramatic"
          ? "high-contrast"
          : "nostalgic";

  return `${titleCase(moodGenre)} ${subject} drama told as a ${analysis.format}`;
}

function createFallbackNarrationPreview(
  form: FormState,
  photos: UploadedPhoto[],
  analysis: PhotoAnalysis,
) {
  const name = form.name.trim() || "Your Hero";
  const dream = cleanSentence(
    form.futureDream,
    "create a future worthy of the memories that started it all",
  );
  const styleSound = {
    Inspirational: {
      soundtrack: [
        "Warm piano opening with rising strings",
        "Soft low percussion entering at the midpoint",
        "Wide orchestral lift for the final promise",
      ],
      transitions: [
        "Golden crossfade between early memories",
        "Slow push-in on the brightest frame",
        "White flash into the future-dream title card",
      ],
      mix: "Keep the voice intimate up front, then widen the music bed in the final 12 seconds.",
    },
    Emotional: {
      soundtrack: [
        "Close felt piano with subtle room tone",
        "Breathy string pad under the middle beat",
        "Gentle swell that never overpowers the voice",
      ],
      transitions: [
        "Soft dissolves paced like remembered fragments",
        "Brief silence before the emotional turn",
        "Warm fade into the final uploaded frame",
      ],
      mix: "Let pauses breathe between lines and keep effects low, personal, and textured.",
    },
    Thriller: {
      soundtrack: [
        "Muted pulse with ticking sub-bass",
        "Rising string tremolo beneath the reveal",
        "Hard trailer hit before the final line",
      ],
      transitions: [
        "Abrupt black cuts between high-contrast frames",
        "Quick shutter flickers on key photo details",
        "Bass drop into the title reveal",
      ],
      mix: "Use tight dynamic contrast, with the voice dry and close against a tense low-end bed.",
    },
    "Sci-Fi": {
      soundtrack: [
        "Glass synth pulses with distant cinematic brass",
        "Rising arpeggio as the dream becomes visible",
        "Wide electronic swell for the future signal",
      ],
      transitions: [
        "Signal-scan wipes between uploaded frames",
        "Chromatic light leaks over cool-toned photos",
        "Clean digital snap into the title reveal",
      ],
      mix: "Blend a clear narrator with spacious synths, keeping the final beat bright and expansive.",
    },
    Documentary: {
      soundtrack: [
        "Minimal piano with subtle archival texture",
        "Low strings for reflection, not manipulation",
        "Measured lift under the closing truth",
      ],
      transitions: [
        "Archival fades with restrained pacing",
        "Simple cuts that respect the uploaded photos",
        "Clean title card after the strongest frame",
      ],
      mix: "Keep the narration natural, credible, and lightly supported by music.",
    },
    Motivational: {
      soundtrack: [
        "Driving percussion with bold piano chords",
        "Rising trailer drums beneath the challenge beat",
        "Full anthem lift for the final declaration",
      ],
      transitions: [
        "Rhythmic cuts synced to percussion",
        "Speed-ramp push toward the dream statement",
        "Impact flash into the title reveal",
      ],
      mix: "Put the voice confidently forward and let drums build without masking the words.",
    },
  } satisfies Record<
    TrailerStyle,
    {
      soundtrack: string[];
      transitions: string[];
      mix: string;
    }
  >;
  const sound = styleSound[form.trailerStyle];
  const timelinePhotos = photos.slice(0, 5);
  const timecodes = [
    ["00:00", "00:08"],
    ["00:08", "00:17"],
    ["00:17", "00:27"],
    ["00:27", "00:38"],
    ["00:38", "00:48"],
  ];
  const lines = [
    `They thought these were only memories.`,
    `But in frame ${Math.min(2, photos.length)}, ${name} begins to recognize the pattern.`,
    `Every color, every shadow, every quiet moment points toward one dream.`,
    `To ${dream.toLowerCase()}.`,
    `And this time, the future is ready for its close-up.`,
  ];

  return {
    voiceOverScript: `${lines.join(" ")} ${name}'s life trailer starts with ${photos.length} real photos and builds toward the future they chose.`,
    sceneTimeline: timelinePhotos.map((photo, index) => ({
      sceneNumber: index + 1,
      startTime: timecodes[index][0],
      endTime: timecodes[index][1],
      visualCue: `Use uploaded Frame ${index + 1} (${photo.name}) as the ${form.trailerStyle.toLowerCase()} visual beat.`,
      narrationLine: lines[index],
      emotionalIntensity: Math.min(10, 4 + index + (analysis.mood === "dramatic" ? 1 : 0)),
    })),
    soundDesignNotes: {
      soundtrackSuggestions: sound.soundtrack,
      transitionSuggestions: sound.transitions,
      mixingNotes: sound.mix,
    },
  };
}

function generateMovieResult(
  form: FormState,
  photos: UploadedPhoto[],
  analysis: PhotoAnalysis,
  generatedTrailer?: GeneratedTrailer,
): MovieResult {
  const name = form.name.trim() || "Your Hero";
  const dream = cleanSentence(
    form.futureDream,
    "create a future worthy of the memories that started it all",
  );
  const seed = hashText(
    `${name} ${dream} ${photos.map((photo) => photo.name).join(" ")} ${
      analysis.mood
    } ${analysis.palette}`,
  );
  const dreamKeyword = extractKeyword(dream, "Tomorrow");
  const moodKeyword = titleCase(analysis.mood);
  const title = pick(
    [
      `${name}'s ${dreamKeyword}`,
      `The ${moodKeyword} Years`,
      `Frames Before ${dreamKeyword}`,
      `When ${name} Chased the Light`,
      `${dreamKeyword} in Motion`,
    ],
    seed,
  );
  const posterPhoto = photos[seed % photos.length];
  const photoLanguage = `${photos.length} personal photos with a ${analysis.palette} palette, ${analysis.mood} light, and ${analysis.format} composition`;
  const fallbackStoryline = `${name} uploads ${photoLanguage}. As the images flicker from quiet close-ups to wide emotional beats, CineLife AI finds the thread between who they were and the future they are building: ${dream.toLowerCase()}.`;
  const fallbackNarration = `In every photo, a life is hiding in plain sight. ${photos.length} frames, graded by ${analysis.palette} tones and ${analysis.mood} light. For ${name}, the dream to ${dream.toLowerCase()} becomes more than a wish. It becomes the final scene they were always moving toward.`;
  const fallbackFutureChapter = `Years from now, ${name} returns to these photos after learning how to ${dream.toLowerCase()}. The images feel different then: not proof of what was lost, but evidence that the future had already started.`;
  const fallbackScenes = photos.slice(0, 5).map((photo, index) => {
    const frameNumber = index + 1;

    return `Scene ${frameNumber}: Frame ${frameNumber} from ${photo.name}. This uploaded photo becomes a ${form.trailerStyle.toLowerCase()} story beat, carrying ${analysis.mood} light and ${analysis.palette} color toward the dream to ${dream.toLowerCase()}.`;
  });
  const sceneBreakdown =
    generatedTrailer?.sceneBreakdown.map(
      (scene) => {
        const photoReferenceText = scene.photoReferences?.length
          ? ` Frames ${scene.photoReferences.join(", ")}.`
          : "";

        return `Scene ${scene.sceneNumber}: ${scene.title}.${photoReferenceText} ${scene.visualDirection} ${scene.narrationBeat}`;
      },
    ) ?? [...fallbackScenes, fallbackFutureChapter];
  const narrationPreview =
    generatedTrailer?.narrationPreview ??
    createFallbackNarrationPreview(form, photos, analysis);

  return {
    title: generatedTrailer?.movieTitle ?? title,
    genre: `${form.trailerStyle} ${detectGenre(analysis, dream)}`,
    storyline: generatedTrailer?.tagline ?? fallbackStoryline,
    trailerNarration:
      generatedTrailer?.narration ??
      narrationPreview.voiceOverScript ??
      fallbackNarration,
    futureChapter: sceneBreakdown.join("\n\n"),
    posterConcept: `A premium streaming poster built from the strongest uploaded frame, graded in ${analysis.palette} tones with a slow-burn ${analysis.mood} finish, film-strip edges, a glowing horizon, and ${name} positioned as the lead of their own life trailer.`,
    tagline: generatedTrailer?.tagline ?? fallbackStoryline,
    sceneBreakdown,
    narrationPreview,
    analysis,
    posterPhoto,
  };
}

async function requestGeneratedVoice({
  script,
  voiceOption,
  voiceSample,
  voiceConsentAccepted,
}: {
  script: string;
  voiceOption: VoiceOption;
  voiceSample: VoiceSample | null;
  voiceConsentAccepted: boolean;
}) {
  const voiceSampleDataUrl =
    voiceOption === "Clone My Voice" && voiceSample
      ? await fileToDataUrl(voiceSample.file)
      : undefined;
  const response = await fetch("/api/generate-voice", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      script,
      voiceOption,
      voiceSampleDataUrl,
      voiceSampleName: voiceSample?.file.name,
      voiceSampleDuration: voiceSample?.duration,
      voiceSampleProfile: voiceSample?.profile,
      voiceSampleQuality: voiceSample?.quality,
      voiceConsentAccepted,
    }),
  });

  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;

    throw new Error(data?.error ?? "OpenAI voice generation failed.");
  }

  return response.blob();
}

function fileToDataUrl(file: File | Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Could not read file data."));
      }
    };
    reader.onerror = () => reject(new Error("Could not read file data."));
    reader.readAsDataURL(file);
  });
}

async function requestTrailerVideo({
  movie,
  form,
  photos,
  generatedVoice,
}: {
  movie: MovieResult;
  form: FormState;
  photos: UploadedPhoto[];
  generatedVoice: GeneratedVoice | null;
}) {
  const [photoData, audioDataUrl] = await Promise.all([
    Promise.all(
      photos.map(async (photo) => ({
        dataUrl: await fileToDataUrl(photo.file),
        name: photo.name,
      })),
    ),
    generatedVoice ? fileToDataUrl(generatedVoice.blob) : Promise.resolve(undefined),
  ]);
  const response = await fetch("/api/render-trailer", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title: movie.title,
      tagline: movie.tagline,
      trailerStyle: form.trailerStyle,
      narrationScript: cleanNarrationForVoice(
        movie.narrationPreview.voiceOverScript,
      ),
      photos: photoData,
      timeline: movie.narrationPreview.sceneTimeline,
      musicPlan: movie.narrationPreview.soundDesignNotes,
      audioDataUrl,
    }),
  });

  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;

    throw new Error(data?.error ?? "Trailer video render failed.");
  }

  return {
    blob: await response.blob(),
    shareUrl: response.headers.get("X-CineLife-Video-Url") ?? undefined,
    trailerId: response.headers.get("X-CineLife-Trailer-Id") ?? undefined,
  };
}

async function requestProductionConfig() {
  const response = await fetch("/api/cinelife-config", {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Unable to read CineLife production configuration.");
  }

  return (await response.json()) as ConfigStatus;
}

async function createTrailerJob({
  userId,
  form,
  voiceOption,
}: {
  userId: string;
  form: FormState;
  voiceOption: VoiceOption;
}) {
  const response = await fetch("/api/trailer-jobs", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      userId,
      name: form.name,
      futureDream: form.futureDream,
      trailerStyle: form.trailerStyle,
      voiceOption,
    }),
  });
  const data = (await response.json()) as {
    jobId?: string;
    error?: string;
    missing?: string[];
  };

  if (!response.ok || !data.jobId) {
    throw new Error(
      data.error ??
        `CineLife production config is missing: ${data.missing?.join(", ")}`,
    );
  }

  return data.jobId;
}

async function uploadTrailerJobAssets({
  jobId,
  userId,
  photos,
  voiceSample,
  voiceConsentAccepted,
}: {
  jobId: string;
  userId: string;
  photos: UploadedPhoto[];
  voiceSample: VoiceSample | null;
  voiceConsentAccepted: boolean;
}) {
  const [photoPayload, voiceSamplePayload] = await Promise.all([
    Promise.all(
      photos.map(async (photo) => ({
        dataUrl: await fileToDataUrl(photo.file),
        name: photo.name,
      })),
    ),
    voiceSample
      ? fileToDataUrl(voiceSample.file).then((dataUrl) => ({
          dataUrl,
          duration: voiceSample.duration,
          name: voiceSample.file.name,
          profile: voiceSample.profile,
          quality: voiceSample.quality,
          consentAccepted: voiceConsentAccepted,
        }))
      : Promise.resolve(null),
  ]);
  const response = await fetch(`/api/trailer-jobs/${jobId}/assets`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      userId,
      photos: photoPayload,
      voiceSample: voiceSamplePayload,
    }),
  });
  const data = (await response.json()) as {
    error?: string;
  };

  if (!response.ok) {
    throw new Error(data.error ?? "Cloudinary asset upload failed.");
  }
}

async function getTrailerJobSnapshot(jobId: string, userId: string) {
  const response = await fetch(
    `/api/trailer-jobs/${jobId}?userId=${encodeURIComponent(userId)}`,
    {
      cache: "no-store",
    },
  );
  const data = (await response.json()) as TrailerJobSnapshot & {
    error?: string;
  };

  if (!response.ok) {
    throw new Error(data.error ?? "Unable to poll trailer job.");
  }

  return data;
}

async function runTrailerJob({
  jobId,
  userId,
  form,
  voiceOption,
  photoSignals,
  visualStorySequence,
}: {
  jobId: string;
  userId: string;
  form: FormState;
  voiceOption: VoiceOption;
  photoSignals: Record<string, PhotoSignal>;
  visualStorySequence: VisualStoryBeat[];
}) {
  const response = await fetch(`/api/trailer-jobs/${jobId}/run`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      userId,
      name: form.name,
      futureDream: form.futureDream,
      trailerStyle: form.trailerStyle,
      voiceOption,
      photoInsights: Object.values(photoSignals).map((signal, index) => ({
        frameNumber: index + 1,
        width: signal.width,
        height: signal.height,
        brightness: Math.round(signal.brightness),
        mood: signal.mood,
        classification: signal.classification,
        dominantColors: signal.dominantColors.map((color) => ({
          hex: color.hex,
          label: color.label,
        })),
      })),
      visualStorySequence: visualStorySequence.map((beat) => ({
        frameNumber: beat.frameNumber,
        role: beat.role,
        storyPurpose: beat.storyPurpose,
        photoReference: beat.photoReference,
      })),
    }),
  });
  const data = (await response.json()) as TrailerJobSnapshot & {
    error?: string;
  };

  if (!response.ok) {
    throw new Error(data.error ?? "Trailer job failed.");
  }

  return data;
}

function getAudioDuration(url: string) {
  return new Promise<number>((resolve, reject) => {
    const audio = document.createElement("audio");

    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      resolve(audio.duration);
    };
    audio.onerror = () => {
      reject(new Error("The voice sample could not be read."));
    };
    audio.src = url;
  });
}

async function analyzeVoiceSampleProfile(
  file: File,
): Promise<VoiceSampleProfile | undefined> {
  const AudioContextConstructor =
    window.AudioContext ??
    (
      window as typeof window & {
        webkitAudioContext?: typeof AudioContext;
      }
    ).webkitAudioContext;

  if (!AudioContextConstructor) {
    return undefined;
  }

  const audioContext = new AudioContextConstructor();

  try {
    const audioBuffer = await audioContext.decodeAudioData(
      await file.arrayBuffer(),
    );
    const channel = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;
    const start = Math.floor(Math.min(1, audioBuffer.duration * 0.18) * sampleRate);
    const analysisLength = Math.min(channel.length - start, sampleRate * 6);

    if (analysisLength <= sampleRate * 0.5) {
      return undefined;
    }

    const step = Math.max(1, Math.floor(analysisLength / 12000));
    let sumSquares = 0;
    let peak = 0;
    let crossings = 0;
    let previous = channel[start] ?? 0;
    let silentSamples = 0;
    let count = 0;

    for (let index = start; index < start + analysisLength; index += step) {
      const sample = channel[index] ?? 0;
      sumSquares += sample * sample;
      peak = Math.max(peak, Math.abs(sample));
      if (Math.abs(sample) < 0.012) {
        silentSamples += 1;
      }

      if ((previous >= 0 && sample < 0) || (previous < 0 && sample >= 0)) {
        crossings += 1;
      }

      previous = sample;
      count += 1;
    }

    const averageRms = Math.sqrt(sumSquares / Math.max(1, count));
    const zeroCrossingRate = crossings / Math.max(1, count);
    const silentRatio = silentSamples / Math.max(1, count);
    const estimatedPitchHz = estimatePitchHz(channel, sampleRate, start);
    const voiceFamily =
      estimatedPitchHz === null
        ? "neutral"
        : estimatedPitchHz < 145
          ? "lower"
          : estimatedPitchHz > 205
            ? "higher"
            : "neutral";
    const energy =
      averageRms < 0.045 ? "soft" : averageRms > 0.13 ? "strong" : "balanced";
    const brightness =
      zeroCrossingRate < 0.045
        ? "warm"
        : zeroCrossingRate > 0.11
          ? "bright"
          : "balanced";

    return {
      averageRms: Number(averageRms.toFixed(4)),
      peakRms: Number(peak.toFixed(4)),
      zeroCrossingRate: Number(zeroCrossingRate.toFixed(4)),
      silentRatio: Number(silentRatio.toFixed(4)),
      estimatedPitchHz,
      voiceFamily,
      energy,
      brightness,
    };
  } catch {
    return undefined;
  } finally {
    void audioContext.close();
  }
}

function estimatePitchHz(
  channel: Float32Array,
  sampleRate: number,
  start: number,
) {
  const frameLength = Math.min(channel.length - start, Math.floor(sampleRate * 0.08));

  if (frameLength < 512) {
    return null;
  }

  const minLag = Math.floor(sampleRate / 280);
  const maxLag = Math.floor(sampleRate / 80);
  let bestLag = 0;
  let bestCorrelation = 0;

  for (let lag = minLag; lag <= maxLag; lag += 1) {
    let correlation = 0;

    for (let index = 0; index < frameLength - lag; index += 1) {
      correlation += channel[start + index] * channel[start + index + lag];
    }

    if (correlation > bestCorrelation) {
      bestCorrelation = correlation;
      bestLag = lag;
    }
  }

  if (!bestLag || bestCorrelation <= 0) {
    return null;
  }

  return Number((sampleRate / bestLag).toFixed(1));
}

function getVoiceSampleQuality(
  duration: number,
  profile?: VoiceSampleProfile,
): VoiceSampleQuality {
  const durationStatus: VoiceQualityStatus =
    duration >= 15 && duration <= 60 ? "pass" : "fail";
  const averageVolume = profile?.averageRms ?? 0;
  const peakVolume = profile?.peakRms ?? 0;
  const noiseScore = profile?.zeroCrossingRate ?? 0;
  const silence = profile?.silentRatio ?? 1;
  const speechDetected = Boolean(
    profile &&
      profile.estimatedPitchHz !== null &&
      averageVolume >= 0.025 &&
      peakVolume >= 0.08 &&
      silence < 0.88,
  );
  const volumeStatus: VoiceQualityStatus =
    averageVolume < 0.022 || peakVolume < 0.06 || peakVolume > 0.98
      ? "fail"
      : averageVolume < 0.04 || averageVolume > 0.24
        ? "warning"
        : "pass";
  const noiseStatus: VoiceQualityStatus =
    noiseScore > 0.18 || silence > 0.9
      ? "fail"
      : noiseScore > 0.12 || silence > 0.78
        ? "warning"
        : "pass";
  const notes: string[] = [];

  if (!speechDetected) {
    notes.push("Clear spoken words were not detected in the sample.");
  }

  if (durationStatus === "fail") {
    notes.push("Record 15 to 60 seconds of speech for cloning.");
  }

  if (volumeStatus === "fail") {
    notes.push("The sample is too quiet, clipped, or uneven for cloning.");
  } else if (volumeStatus === "warning") {
    notes.push("Volume is usable, but a steadier recording will improve quality.");
  }

  if (noiseStatus === "fail") {
    notes.push("Background noise or silence is too high.");
  } else if (noiseStatus === "warning") {
    notes.push("Some noise was detected; a quieter room will improve quality.");
  }

  const hasFail =
    durationStatus === "fail" ||
    volumeStatus === "fail" ||
    noiseStatus === "fail" ||
    !speechDetected;
  const hasWarning =
    volumeStatus === "warning" || noiseStatus === "warning";

  return {
    speechDetected,
    durationSeconds: Number(duration.toFixed(1)),
    durationStatus,
    volumeStatus,
    noiseStatus,
    volumeLabel:
      volumeStatus === "pass"
        ? "Balanced"
        : volumeStatus === "warning"
          ? "Usable"
          : "Poor",
    noiseLabel:
      noiseStatus === "pass"
        ? "Clean"
        : noiseStatus === "warning"
          ? "Some noise"
          : "Noisy",
    verdict: hasFail ? "blocked" : hasWarning ? "needs-improvement" : "ready",
    notes: notes.length ? notes : ["Voice sample is ready for cloning."],
  };
}

function getQualityStatusClasses(status: VoiceQualityStatus) {
  if (status === "pass") {
    return "border-emerald-300/25 bg-emerald-400/10 text-emerald-100";
  }

  if (status === "warning") {
    return "border-amber-300/25 bg-amber-400/10 text-amber-100";
  }

  return "border-red-400/25 bg-red-500/10 text-red-100";
}

export default function Home() {
  const [form, setForm] = useState<FormState>(initialFormState);
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [photoSignals, setPhotoSignals] = useState<Record<string, PhotoSignal>>(
    {},
  );
  const [movie, setMovie] = useState<MovieResult | null>(null);
  const [activeSlide, setActiveSlide] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState("");
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationStage, setGenerationStage] = useState("Session");
  const [configStatus, setConfigStatus] = useState<ConfigStatus | null>(null);
  const [sessionUserId, setSessionUserId] = useState("");
  const [productionJob, setProductionJob] = useState<TrailerJobSnapshot | null>(
    null,
  );
  const [selectedVoiceOption, setSelectedVoiceOption] =
    useState<VoiceOption>("Cinematic Male");
  const [isGeneratingVoice, setIsGeneratingVoice] = useState(false);
  const [voiceGenerationStatus, setVoiceGenerationStatus] = useState("");
  const [generatedVoice, setGeneratedVoice] = useState<GeneratedVoice | null>(
    null,
  );
  const [voicePlaybackState, setVoicePlaybackState] =
    useState<VoicePlaybackState>("idle");
  const [voiceError, setVoiceError] = useState("");
  const [renderedTrailerVideo, setRenderedTrailerVideo] =
    useState<RenderedTrailerVideo | null>(null);
  const [isRenderingVideo, setIsRenderingVideo] = useState(false);
  const [videoRenderProgress, setVideoRenderProgress] = useState(0);
  const [videoRenderStatus, setVideoRenderStatus] = useState("");
  const [videoRenderError, setVideoRenderError] = useState("");
  const [voiceSample, setVoiceSample] = useState<VoiceSample | null>(null);
  const [voiceSampleError, setVoiceSampleError] = useState("");
  const [voiceConsentAccepted, setVoiceConsentAccepted] = useState(false);
  const [playbackState, setPlaybackState] = useState<PlaybackState>("idle");
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cloneVoiceInputRef = useRef<HTMLInputElement>(null);
  const experienceRef = useRef<HTMLElement>(null);
  const photosRef = useRef<UploadedPhoto[]>([]);
  const voiceAudioRef = useRef<HTMLAudioElement | null>(null);
  const generatedVoiceRef = useRef<GeneratedVoice | null>(null);
  const renderedTrailerVideoRef = useRef<RenderedTrailerVideo | null>(null);
  const finalVideoElementRef = useRef<HTMLVideoElement | null>(null);
  const voiceSampleRef = useRef<VoiceSample | null>(null);
  const narrationRef = useRef<SpeechSynthesisUtterance | null>(null);

  const resultCards = useMemo(() => {
    if (!movie) {
      return [];
    }

    return [
      { label: "Trailer Title", value: movie.title, accent: accents[0] },
      { label: "Genre", value: movie.genre, accent: accents[1] },
      { label: "Tagline", value: movie.tagline, accent: accents[2] },
      {
        label: "Poster Concept",
        value: movie.posterConcept,
        accent: accents[3],
      },
    ];
  }, [movie]);

  useEffect(() => {
    if (!movie || playbackState !== "playing" || photos.length < 2) {
      return undefined;
    }

    const timeout = window.setTimeout(() => {
      setActiveSlide((currentSlide) => {
        if (currentSlide >= photos.length - 1) {
          setPlaybackState("ended");
          return currentSlide;
        }

        return currentSlide + 1;
      });
    }, 3000);

    return () => window.clearTimeout(timeout);
  }, [activeSlide, movie, photos.length, playbackState]);

  useEffect(() => {
    if (playbackState === "ended") {
      window.speechSynthesis?.cancel();
      narrationRef.current = null;
    }
  }, [playbackState]);

  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  useEffect(() => {
    generatedVoiceRef.current = generatedVoice;
  }, [generatedVoice]);

  useEffect(() => {
    voiceSampleRef.current = voiceSample;
  }, [voiceSample]);

  useEffect(() => {
    renderedTrailerVideoRef.current = renderedTrailerVideo;
  }, [renderedTrailerVideo]);

  useEffect(() => {
    let isMounted = true;
    const unanalyzedPhotos = photos.filter((photo) => !photoSignals[photo.id]);

    unanalyzedPhotos.forEach((photo) => {
      analyzePhoto(photo)
        .then((signal) => {
          if (!isMounted) {
            return;
          }

          setPhotoSignals((currentSignals) => ({
            ...currentSignals,
            [photo.id]: signal,
          }));
        })
        .catch(() => {
          if (!isMounted) {
            return;
          }

          setPhotoSignals((currentSignals) => {
            const nextSignals = { ...currentSignals };
            delete nextSignals[photo.id];
            return nextSignals;
          });
        });
    });

    return () => {
      isMounted = false;
    };
  }, [photoSignals, photos]);

  useEffect(() => {
    return () => {
      window.speechSynthesis?.cancel();
      if (generatedVoiceRef.current) {
        URL.revokeObjectURL(generatedVoiceRef.current.url);
      }
      if (voiceSampleRef.current) {
        URL.revokeObjectURL(voiceSampleRef.current.url);
      }
      if (renderedTrailerVideoRef.current) {
        URL.revokeObjectURL(renderedTrailerVideoRef.current.url);
      }
      photosRef.current.forEach((photo) => URL.revokeObjectURL(photo.url));
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    requestProductionConfig()
      .then((nextConfigStatus) => {
        if (isMounted) {
          setConfigStatus(nextConfigStatus);
        }
      })
      .catch(() => {
        if (isMounted) {
          setConfigStatus({
            checks: {
              openai: false,
              cloudinary: false,
              supabaseServer: false,
              supabaseBrowser: false,
            },
            isProductionReady: false,
            missing: ["config"],
          });
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const speakNarration = (nextMovie: MovieResult) => {
    if (!("speechSynthesis" in window)) {
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(
      cleanNarrationForVoice(nextMovie.narrationPreview.voiceOverScript),
    );
    utterance.rate = 0.88;
    utterance.pitch = 0.82;
    utterance.volume = 0.95;
    narrationRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  const updateField = (field: keyof FormState, value: string) => {
    setForm((currentForm) => ({ ...currentForm, [field]: value }));
  };

  const clearGeneratedVoice = () => {
    voiceAudioRef.current?.pause();
    if (generatedVoiceRef.current) {
      URL.revokeObjectURL(generatedVoiceRef.current.url);
    }
    setGeneratedVoice(null);
    setVoicePlaybackState("idle");
    setVoiceGenerationStatus("");
    setVoiceError("");
  };

  const clearRenderedTrailerVideo = () => {
    if (renderedTrailerVideoRef.current) {
      URL.revokeObjectURL(renderedTrailerVideoRef.current.url);
    }

    setRenderedTrailerVideo(null);
    setVideoRenderProgress(0);
    setVideoRenderStatus("");
    setVideoRenderError("");
  };

  const clearVoiceSample = () => {
    if (voiceSampleRef.current) {
      URL.revokeObjectURL(voiceSampleRef.current.url);
    }

    setVoiceSample(null);
    setVoiceSampleError("");
    setVoiceConsentAccepted(false);
    clearGeneratedVoice();
    clearRenderedTrailerVideo();
  };

  const createGeneratedVoice = async (nextMovie: MovieResult) => {
    if (selectedVoiceOption === "Clone My Voice" && !voiceSample) {
      throw new Error("Upload a 15-60 second voice sample before cloning.");
    }

    if (selectedVoiceOption === "Clone My Voice" && !voiceConsentAccepted) {
      throw new Error(
        "Confirm voice cloning consent before generating cloned narration.",
      );
    }

    if (
      selectedVoiceOption === "Clone My Voice" &&
      voiceSample?.quality.verdict === "blocked"
    ) {
      throw new Error(
        `Voice sample quality check failed: ${voiceSample.quality.notes.join(" ")}`,
      );
    }

    const script = cleanNarrationForVoice(
      nextMovie.narrationPreview.voiceOverScript,
    );

    if (!script) {
      throw new Error(
        "The narration script did not contain readable voice-over text.",
      );
    }

    const audioBlob = await requestGeneratedVoice({
      script,
      voiceOption: selectedVoiceOption,
      voiceSample,
      voiceConsentAccepted,
    });
    const audioUrl = URL.createObjectURL(audioBlob);

    if (generatedVoiceRef.current) {
      URL.revokeObjectURL(generatedVoiceRef.current.url);
    }

    const nextVoice = {
      url: audioUrl,
      blob: audioBlob,
      voiceOption: selectedVoiceOption,
      fileName: `${nextMovie.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "") || "cinelife"}-voice-over.mp3`,
    };

    setGeneratedVoice(nextVoice);
    setVoicePlaybackState("idle");
    setVoiceGenerationStatus("Voice over ready");

    return nextVoice;
  };

  const renderTrailerVideoFromMovie = async (
    nextMovie: MovieResult,
    nextVoice: GeneratedVoice | null,
  ) => {
    setIsRenderingVideo(true);
    setVideoRenderError("");
    setVideoRenderProgress(8);
    setVideoRenderStatus("Preparing uploaded photos");

    const progressTimer = window.setInterval(() => {
      setVideoRenderProgress((currentProgress) =>
        Math.min(92, currentProgress + 4),
      );
    }, 1200);

    try {
      await new Promise((resolve) => window.setTimeout(resolve, 350));
      setVideoRenderStatus("Bundling Remotion trailer");
      setVideoRenderProgress(24);

      const renderedVideo = await requestTrailerVideo({
        movie: nextMovie,
        form,
        photos,
        generatedVoice: nextVoice,
      });
      const videoUrl = URL.createObjectURL(renderedVideo.blob);

      if (renderedTrailerVideoRef.current) {
        URL.revokeObjectURL(renderedTrailerVideoRef.current.url);
      }

      const nextRenderedVideo = {
        url: videoUrl,
        blob: renderedVideo.blob,
        fileName: `${nextMovie.title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "") || "cinelife"}-trailer.mp4`,
        shareUrl: renderedVideo.shareUrl,
        trailerId: renderedVideo.trailerId,
      };

      setRenderedTrailerVideo(nextRenderedVideo);
      setVideoRenderProgress(100);
      setVideoRenderStatus("Trailer video ready");

      return nextRenderedVideo;
    } catch (renderError) {
      setVideoRenderError(
        renderError instanceof Error
          ? renderError.message
          : "Trailer video render failed.",
      );
      setVideoRenderStatus("");
      setVideoRenderProgress(0);
      throw renderError;
    } finally {
      window.clearInterval(progressTimer);
      setIsRenderingVideo(false);
    }
  };

  const handleVoiceSampleChange = async (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    const allowedMimeTypes = new Set([
      "audio/mpeg",
      "audio/mp3",
      "audio/wav",
      "audio/x-wav",
      "audio/mp4",
      "audio/x-m4a",
    ]);
    const hasAllowedExtension = /\.(mp3|wav|m4a)$/i.test(file.name);

    if (!allowedMimeTypes.has(file.type) && !hasAllowedExtension) {
      setVoiceSampleError("Upload an MP3, WAV, or M4A voice sample.");
      return;
    }

    const sampleUrl = URL.createObjectURL(file);

    try {
      const duration = await getAudioDuration(sampleUrl);

      if (!Number.isFinite(duration) || duration <= 0) {
        throw new Error("The voice sample duration could not be detected.");
      }

      if (duration < 15 || duration > 60) {
        URL.revokeObjectURL(sampleUrl);
        setVoiceSampleError("Voice sample must be between 15 and 60 seconds.");
        return;
      }

      if (voiceSampleRef.current) {
        URL.revokeObjectURL(voiceSampleRef.current.url);
      }

      const profile = await analyzeVoiceSampleProfile(file);
      const quality = getVoiceSampleQuality(duration, profile);

      setVoiceSample({
        file,
        url: sampleUrl,
        duration,
        profile,
        quality,
      });
      setVoiceSampleError("");
      setVoiceConsentAccepted(false);
      setSelectedVoiceOption("Clone My Voice");
    } catch (sampleError) {
      URL.revokeObjectURL(sampleUrl);
      setVoiceSampleError(
        sampleError instanceof Error
          ? sampleError.message
          : "The voice sample could not be validated.",
      );
    }
  };

  const addPhotos = (files: FileList | File[]) => {
    const imageFiles = Array.from(files).filter((file) =>
      file.type.startsWith("image/"),
    );

    if (!imageFiles.length) {
      setError("Upload image files only.");
      return;
    }

    setPhotos((currentPhotos) => {
      const remainingSlots = 10 - currentPhotos.length;
      const selectedFiles = imageFiles.slice(0, remainingSlots);
      const nextPhotos = selectedFiles.map((file) => ({
        id: `${file.name}-${file.lastModified}-${crypto.randomUUID()}`,
        file,
        name: file.name,
        url: URL.createObjectURL(file),
      }));

      if (imageFiles.length > remainingSlots) {
        setError("CineLife accepts up to 10 photos for one trailer.");
      } else {
        setError("");
      }

      return [...currentPhotos, ...nextPhotos];
    });

    setMovie(null);
    clearGeneratedVoice();
    clearRenderedTrailerVideo();
    setActiveSlide(0);
    setPlaybackState("idle");
    window.speechSynthesis?.cancel();
  };

  const removePhoto = (photoId: string) => {
    setPhotos((currentPhotos) => {
      const photoToRemove = currentPhotos.find((photo) => photo.id === photoId);
      if (photoToRemove) {
        URL.revokeObjectURL(photoToRemove.url);
      }

      return currentPhotos.filter((photo) => photo.id !== photoId);
    });
    setPhotoSignals((currentSignals) => {
      const nextSignals = { ...currentSignals };
      delete nextSignals[photoId];
      return nextSignals;
    });
    setMovie(null);
    clearGeneratedVoice();
    clearRenderedTrailerVideo();
    setActiveSlide(0);
    setPlaybackState("idle");
    window.speechSynthesis?.cancel();
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    addPhotos(event.dataTransfer.files);
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      addPhotos(event.target.files);
      event.target.value = "";
    }
  };

  const handleGenerate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (photos.length < 3) {
      setError("Upload at least 3 photos to generate a trailer.");
      return;
    }

    if (!configStatus?.isProductionReady) {
      setError(
        `Production generation is not configured yet. Missing: ${
          configStatus?.missing.join(", ") || "configuration"
        }. Add OpenAI, Cloudinary, and Supabase env vars to generate the final MP4 job.`,
      );
      return;
    }

    if (selectedVoiceOption === "Clone My Voice") {
      if (!voiceSample) {
        setError("Upload a 15-60 second voice sample before using Clone My Voice.");
        return;
      }

      if (!voiceConsentAccepted) {
        setError(
          "Confirm you own or have permission to clone the uploaded voice sample.",
        );
        return;
      }

      if (voiceSample.quality.verdict === "blocked") {
        setError(
          `Voice sample quality check failed: ${voiceSample.quality.notes.join(" ")}`,
        );
        return;
      }
    }

    setError("");
    setIsGenerating(true);
    setGenerationProgress(0);
    setGenerationStage("Session");
    setGenerationStatus("Preparing anonymous session");
    setProductionJob(null);
    setMovie(null);
    clearGeneratedVoice();
    clearRenderedTrailerVideo();
    setPlaybackState("idle");
    window.speechSynthesis?.cancel();

    let pollTimer: number | undefined;

    try {
      const user = await ensureAnonymousSupabaseSession();
      setSessionUserId(user.id);
      setGenerationProgress(5);
      setGenerationStage("Session");
      setGenerationStatus("Anonymous Supabase session verified");

      const jobId = await createTrailerJob({
        userId: user.id,
        form,
        voiceOption: selectedVoiceOption,
      });
      setProductionJob({
        jobId,
        status: "created",
        progress: 5,
        stage: "Session",
      });

      setGenerationStatus("Extracting photo intelligence");
      const missingSignals = await Promise.all(
        photos
          .filter((photo) => !photoSignals[photo.id])
          .map(async (photo) => [photo.id, await analyzePhoto(photo)] as const),
      );
      const signalsForGeneration = missingSignals.reduce(
        (currentSignals, [photoId, signal]) => ({
          ...currentSignals,
          [photoId]: signal,
        }),
        photoSignals,
      );
      setPhotoSignals(signalsForGeneration);

      const analysis = await analyzePhotos(photos);
      const storySequenceForGeneration = createVisualStorySequence(
        photos,
        signalsForGeneration,
        form.futureDream,
        form.trailerStyle,
      );
      setGenerationStage("Upload");
      setGenerationProgress(10);
      setGenerationStatus("Uploading media to Cloudinary");
      await uploadTrailerJobAssets({
        jobId,
        userId: user.id,
        photos,
        voiceSample:
          selectedVoiceOption === "Clone My Voice" ? voiceSample : null,
        voiceConsentAccepted,
      });
      setGenerationProgress(15);
      setGenerationStatus("Cloudinary assets ready");

      pollTimer = window.setInterval(() => {
        void getTrailerJobSnapshot(jobId, user.id)
          .then((snapshot) => {
            setProductionJob(snapshot);
            setGenerationProgress(snapshot.progress);
            setGenerationStage(snapshot.stage);
            setGenerationStatus(snapshot.error || snapshot.stage);
          })
          .catch(() => undefined);
      }, 1200);

      setGenerationStage("Vision");
      setGenerationProgress(30);
      setGenerationStatus("Analyzing uploaded photos with OpenAI Vision");
      const finalSnapshot = await runTrailerJob({
        jobId,
        userId: user.id,
        form,
        voiceOption: selectedVoiceOption,
        photoSignals: signalsForGeneration,
        visualStorySequence: storySequenceForGeneration,
      });

      if (!finalSnapshot.resultVideoUrl && !finalSnapshot.downloadUrl) {
        throw new Error("The trailer job completed without a final MP4 URL.");
      }

      const localMovie = generateMovieResult(form, photos, analysis);
      const videoUrl =
        finalSnapshot.resultVideoUrl ?? finalSnapshot.downloadUrl ?? "";

      setMovie({
        ...localMovie,
        title:
          typeof finalSnapshot.metadata?.movieTitle === "string"
            ? finalSnapshot.metadata.movieTitle
            : localMovie.title,
        tagline:
          typeof finalSnapshot.metadata?.tagline === "string"
            ? finalSnapshot.metadata.tagline
            : localMovie.tagline,
      });
      setRenderedTrailerVideo({
        url: videoUrl,
        fileName: `${jobId}-cinelife-trailer.mp4`,
        shareUrl: finalSnapshot.resultVideoUrl ?? undefined,
        trailerId: jobId,
      });
      setProductionJob(finalSnapshot);
      setGenerationProgress(100);
      setGenerationStage("Complete");
      setGenerationStatus("Final MP4 trailer ready");
      setActiveSlide(0);
      setPlaybackState("idle");

      window.setTimeout(() => {
        experienceRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 100);
    } catch (generationError) {
      const errorMessage =
        generationError instanceof Error
          ? generationError.message
          : "Trailer generation failed.";
      setMovie(null);
      setError(
        `${errorMessage} CineLife only shows final videos generated from your uploaded photos, OpenAI narration, and the rendered MP4 pipeline.`,
      );
    } finally {
      if (pollTimer !== undefined) {
        window.clearInterval(pollTimer);
      }
      setIsGenerating(false);
      setIsGeneratingVoice(false);
    }
  };

  const retryProductionStage = async (stage: "voice" | "render") => {
    if (!productionJob) {
      setError("No failed trailer job is available to retry.");
      return;
    }

    const userId = sessionUserId;

    if (!userId) {
      setError("Anonymous session is missing. Start generation again.");
      return;
    }

    setError("");
    setIsGenerating(true);
    setGenerationStage(stage === "voice" ? "Narration" : "Render");
    setGenerationProgress(stage === "voice" ? 60 : 70);
    setGenerationStatus(
      stage === "voice"
        ? "Retrying voice narration from the existing job"
        : "Retrying video render from the existing job",
    );
    clearRenderedTrailerVideo();
    window.speechSynthesis?.cancel();

    let pollTimer: number | undefined;

    try {
      const missingSignals = await Promise.all(
        photos
          .filter((photo) => !photoSignals[photo.id])
          .map(async (photo) => [photo.id, await analyzePhoto(photo)] as const),
      );
      const signalsForGeneration = missingSignals.reduce(
        (currentSignals, [photoId, signal]) => ({
          ...currentSignals,
          [photoId]: signal,
        }),
        photoSignals,
      );
      setPhotoSignals(signalsForGeneration);

      const analysis = await analyzePhotos(photos);
      const storySequenceForGeneration = createVisualStorySequence(
        photos,
        signalsForGeneration,
        form.futureDream,
        form.trailerStyle,
      );

      pollTimer = window.setInterval(() => {
        void getTrailerJobSnapshot(productionJob.jobId, userId)
          .then((snapshot) => {
            setProductionJob(snapshot);
            setGenerationProgress(snapshot.progress);
            setGenerationStage(snapshot.stage);
            setGenerationStatus(snapshot.error || snapshot.stage);
          })
          .catch(() => undefined);
      }, 1200);

      const finalSnapshot = await runTrailerJob({
        jobId: productionJob.jobId,
        userId,
        form,
        voiceOption: selectedVoiceOption,
        photoSignals: signalsForGeneration,
        visualStorySequence: storySequenceForGeneration,
      });

      if (!finalSnapshot.resultVideoUrl && !finalSnapshot.downloadUrl) {
        throw new Error("The trailer job completed without a final MP4 URL.");
      }

      const localMovie = generateMovieResult(form, photos, analysis);
      const videoUrl =
        finalSnapshot.resultVideoUrl ?? finalSnapshot.downloadUrl ?? "";

      setMovie({
        ...localMovie,
        title:
          typeof finalSnapshot.metadata?.movieTitle === "string"
            ? finalSnapshot.metadata.movieTitle
            : localMovie.title,
        tagline:
          typeof finalSnapshot.metadata?.tagline === "string"
            ? finalSnapshot.metadata.tagline
            : localMovie.tagline,
      });
      setRenderedTrailerVideo({
        url: videoUrl,
        fileName: `${productionJob.jobId}-cinelife-trailer.mp4`,
        shareUrl: finalSnapshot.resultVideoUrl ?? undefined,
        trailerId: productionJob.jobId,
      });
      setProductionJob(finalSnapshot);
      setGenerationProgress(100);
      setGenerationStage("Complete");
      setGenerationStatus("Final MP4 trailer ready");
      setActiveSlide(0);
      setPlaybackState("idle");
    } catch (retryError) {
      const errorMessage =
        retryError instanceof Error
          ? retryError.message
          : "Trailer retry failed.";
      setError(
        `${errorMessage} You can retry the failed stage without re-uploading your photos.`,
      );
    } finally {
      if (pollTimer !== undefined) {
        window.clearInterval(pollTimer);
      }
      setIsGenerating(false);
      setIsGeneratingVoice(false);
    }
  };

  const deleteStoredVoiceSample = async () => {
    if (!productionJob || !sessionUserId) {
      clearVoiceSample();
      return;
    }

    setVoiceSampleError("");

    try {
      const response = await fetch(
        `/api/trailer-jobs/${productionJob.jobId}/assets`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            userId: sessionUserId,
            assetType: "voice_sample",
          }),
        },
      );
      const data = (await response.json().catch(() => null)) as {
        error?: string;
        deletedCount?: number;
      } | null;

      if (!response.ok) {
        throw new Error(data?.error ?? "Stored voice sample deletion failed.");
      }

      clearVoiceSample();
      setGenerationStatus(
        data?.deletedCount
          ? "Stored voice sample deleted"
          : "Voice sample removed locally",
      );
    } catch (deleteError) {
      setVoiceSampleError(
        deleteError instanceof Error
          ? deleteError.message
          : "Unable to delete the stored voice sample.",
      );
    }
  };

  const playMovie = () => {
    if (!movie) {
      return;
    }

    setActiveSlide(0);
    setPlaybackState("playing");
    speakNarration(movie);
    experienceRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const generateVoiceOver = async () => {
    if (!movie) {
      return;
    }

    setVoiceError("");
    setIsGeneratingVoice(true);
    setVoiceGenerationStatus(`Generating ${selectedVoiceOption} voice over`);
    voiceAudioRef.current?.pause();
    window.speechSynthesis?.cancel();
    setPlaybackState("idle");
    setVoicePlaybackState("idle");

    try {
      await createGeneratedVoice(movie);
      clearRenderedTrailerVideo();
    } catch (voiceGenerationError) {
      const errorMessage =
        voiceGenerationError instanceof Error
          ? voiceGenerationError.message
          : "OpenAI voice generation failed.";

      setVoiceError(`${errorMessage} Your narration preview is still available.`);
      setVoiceGenerationStatus("");
    } finally {
      setIsGeneratingVoice(false);
    }
  };

  const playVoiceOver = async () => {
    if (!generatedVoice || !voiceAudioRef.current) {
      return;
    }

    try {
      window.speechSynthesis?.cancel();
      setPlaybackState("idle");
      await voiceAudioRef.current.play();
      setVoicePlaybackState("playing");
    } catch {
      setVoiceError("The browser blocked audio playback. Try pressing Play again.");
    }
  };

  const replayVoiceOver = async () => {
    if (!generatedVoice || !voiceAudioRef.current) {
      return;
    }

    voiceAudioRef.current.currentTime = 0;
    await playVoiceOver();
  };

  const pauseVoiceOver = () => {
    voiceAudioRef.current?.pause();
    setVoicePlaybackState("paused");
  };

  const downloadVoiceOver = () => {
    if (!generatedVoice) {
      return;
    }

    const link = document.createElement("a");
    link.href = generatedVoice.url;
    link.download = generatedVoice.fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const generateTrailerVideo = async () => {
    if (!movie) {
      return;
    }

    try {
      await renderTrailerVideoFromMovie(movie, generatedVoice);
    } catch (renderError) {
      console.error(renderError);
    }
  };

  const downloadTrailerVideo = () => {
    if (!renderedTrailerVideo) {
      return;
    }

    const link = document.createElement("a");
    link.href = renderedTrailerVideo.url;
    link.download = renderedTrailerVideo.fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const shareTrailerVideo = async () => {
    if (!renderedTrailerVideo) {
      return;
    }

    const shareTitle = movie?.title ?? "CineLife trailer";

    try {
      if (renderedTrailerVideo.shareUrl && navigator.share) {
        await navigator.share({
          title: shareTitle,
          text: movie?.tagline,
          url: renderedTrailerVideo.shareUrl,
        });
        return;
      }

      if (!renderedTrailerVideo.blob) {
        if (navigator.share && renderedTrailerVideo.url) {
          await navigator.share({
            title: shareTitle,
            text: movie?.tagline,
            url: renderedTrailerVideo.url,
          });
          return;
        }

        await navigator.clipboard.writeText(renderedTrailerVideo.url);
        setVideoRenderStatus("Trailer URL copied");
        return;
      }

      const file = new File(
        [renderedTrailerVideo.blob],
        renderedTrailerVideo.fileName,
        {
          type: "video/mp4",
        },
      );
      const canShareFile =
        navigator.canShare?.({
          files: [file],
        }) ?? false;

      if (navigator.share && canShareFile) {
        await navigator.share({
          files: [file],
          text: movie?.tagline,
          title: shareTitle,
        });
        return;
      }

      if (renderedTrailerVideo.shareUrl) {
        await navigator.clipboard.writeText(renderedTrailerVideo.shareUrl);
        setVideoRenderStatus("Share link copied");
        return;
      }

      setVideoRenderError(
        "Sharing needs a supported browser or Cloudinary storage URL. Download MP4 is ready.",
      );
    } catch (shareError) {
      if (shareError instanceof Error && shareError.name === "AbortError") {
        return;
      }

      setVideoRenderError("The browser could not open the share sheet.");
    }
  };

  const watchTrailerVideo = async () => {
    if (!renderedTrailerVideo || !finalVideoElementRef.current) {
      return;
    }

    try {
      finalVideoElementRef.current.currentTime = 0;
      await finalVideoElementRef.current.play();
      experienceRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    } catch {
      setVideoRenderError("The browser blocked autoplay. Press play in the trailer player.");
    }
  };

  const pauseMovie = () => {
    setPlaybackState("paused");
    window.speechSynthesis?.pause();
  };

  const resumeMovie = () => {
    setPlaybackState("playing");

    if (window.speechSynthesis?.paused) {
      window.speechSynthesis.resume();
    } else if (movie && !window.speechSynthesis?.speaking) {
      speakNarration(movie);
    }
  };

  const replayMovie = () => {
    if (!movie) {
      return;
    }

    setActiveSlide(0);
    setPlaybackState("playing");
    speakNarration(movie);
  };

  const activePhoto = photos[activeSlide] ?? photos[0];
  const selectedTrailerStyle =
    trailerStyles.find((style) => style.name === form.trailerStyle) ??
    trailerStyles[0];
  const visualStorySequence = useMemo(
    () =>
      createVisualStorySequence(
        photos,
        photoSignals,
        form.futureDream,
        form.trailerStyle,
      ),
    [form.futureDream, form.trailerStyle, photoSignals, photos],
  );
  const intelligenceReadyCount = photos.filter(
    (photo) => photoSignals[photo.id],
  ).length;
  const voiceQualityChecks = voiceSample
    ? [
        {
          label: "Speech detected",
          value: voiceSample.quality.speechDetected ? "Yes" : "No",
          status: voiceSample.quality.speechDetected
            ? ("pass" as const)
            : ("fail" as const),
        },
        {
          label: "Duration",
          value: `${voiceSample.quality.durationSeconds.toFixed(1)}s`,
          status: voiceSample.quality.durationStatus,
        },
        {
          label: "Volume",
          value: voiceSample.quality.volumeLabel,
          status: voiceSample.quality.volumeStatus,
        },
        {
          label: "Noise level",
          value: voiceSample.quality.noiseLabel,
          status: voiceSample.quality.noiseStatus,
        },
      ]
    : [];
  const canRetryFailedJob = productionJob?.status === "failed";
  const canRetryVoiceStage =
    canRetryFailedJob && /narration|voice/i.test(productionJob?.stage ?? "");
  const canRetryRenderStage =
    canRetryFailedJob && /render|upload mp4/i.test(productionJob?.stage ?? "");

  return (
    <main className="min-h-screen overflow-hidden bg-[#050307] text-white">
      <section className="relative min-h-[92vh] px-5 py-6 sm:px-10 lg:px-16">
        <div
          className="cinematic-hero-backdrop absolute inset-0 bg-cover bg-center opacity-62"
          style={{ backgroundImage: "url('/cinelife-hero.png')" }}
        />
        <div className="cinematic-gradient absolute inset-0" />
        <div className="spotlight-glow absolute inset-0" />
        <div className="film-grain absolute inset-0" />
        <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-[#050307] to-transparent" />

        <nav className="relative z-10 mx-auto flex max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="h-3 w-3 rounded-full bg-red-500 shadow-[0_0_24px_rgba(239,68,68,0.9)]" />
            <span className="text-sm font-semibold uppercase tracking-[0.38em] text-zinc-200">
              CineLife AI
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full border px-3 py-2 text-xs font-bold uppercase tracking-[0.14em] ${
                sessionUserId
                  ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-100"
                  : "border-white/10 bg-white/8 text-zinc-300"
              }`}
            >
              {sessionUserId ? "Anonymous Session" : "Session Pending"}
            </span>
            <span
              className={`rounded-full border px-3 py-2 text-xs font-bold uppercase tracking-[0.14em] ${
                configStatus?.isProductionReady
                  ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-100"
                  : "border-amber-300/30 bg-amber-400/10 text-amber-100"
              }`}
            >
              {configStatus?.isProductionReady
                ? "Production Ready"
                : `Missing ${configStatus?.missing.length ?? 4}`}
            </span>
            <a
              href="#movie-builder"
              className="rounded-full border border-white/15 bg-white/8 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-zinc-100 backdrop-blur transition hover:border-red-300/60 hover:bg-red-500/20 sm:px-5 sm:text-sm sm:normal-case sm:tracking-normal"
            >
              Start Reel
            </a>
          </div>
        </nav>

        <div className="relative z-10 mx-auto grid min-h-[calc(92vh-5rem)] max-w-7xl items-center gap-10 py-12 lg:grid-cols-[1.12fr_0.88fr] lg:gap-8 lg:py-10 xl:gap-12">
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="max-w-3xl"
            initial={{ opacity: 0, y: 18 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
          >
            <h1 className="max-w-5xl text-[3.25rem] font-black leading-[0.9] tracking-normal text-white drop-shadow-[0_18px_60px_rgba(0,0,0,0.65)] sm:text-7xl lg:text-[4.35rem] xl:text-[5.15rem]">
              Create Your Life Story As A Movie Trailer
            </h1>
            <p className="mt-5 max-w-2xl text-lg font-semibold leading-8 text-zinc-100 sm:text-2xl sm:leading-10 lg:text-xl lg:leading-8 xl:text-2xl xl:leading-10">
              Turn your memories, dreams, photos, and voice into a cinematic
              trailer powered by AI.
            </p>
            <div className="mt-6 flex max-w-3xl flex-wrap gap-3">
              {heroFeatureBadges.map((badge) => (
                <div
                  className="rounded-full border border-white/12 bg-black/42 px-4 py-2 text-sm font-black text-zinc-100 shadow-[0_12px_40px_rgba(0,0,0,0.35)] backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-red-300/50 hover:bg-red-500/16 sm:text-base"
                  key={badge}
                >
                  {badge}
                </div>
              ))}
            </div>
            <div className="hero-cta-glow mt-6 max-w-2xl border border-red-300/20 bg-black/45 p-4 shadow-[0_28px_90px_rgba(239,68,68,0.24)] backdrop-blur-xl sm:p-5">
              <div className="flex flex-col gap-4 sm:flex-row">
                <a
                  href="#movie-builder"
                  className="inline-flex h-14 items-center justify-center rounded-full bg-gradient-to-r from-red-600 via-red-500 to-amber-400 px-8 text-base font-black text-white shadow-[0_18px_60px_rgba(239,68,68,0.42)] transition hover:scale-[1.02] hover:shadow-[0_22px_80px_rgba(239,68,68,0.55)]"
                >
                  Create Trailer
                </a>
                <a
                  href="#movie-experience"
                  className="inline-flex h-14 items-center justify-center rounded-full border border-white/15 bg-white/8 px-8 text-base font-bold text-zinc-100 backdrop-blur transition hover:border-white/35 hover:bg-white/12"
                >
                  Watch Preview
                </a>
              </div>
            </div>

            <section className="mt-8 max-w-3xl border border-white/10 bg-black/38 p-5 shadow-2xl backdrop-blur-xl sm:p-6">
              <input
                accept="audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/mp4,audio/x-m4a,.mp3,.wav,.m4a"
                className="sr-only"
                onChange={handleVoiceSampleChange}
                ref={cloneVoiceInputRef}
                type="file"
              />
              <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.34em] text-red-300">
                    Narrator Voice
                  </p>
                  <p className="mt-2 text-sm leading-6 text-zinc-400">
                    Select the voice direction before creating the trailer.
                  </p>
                </div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-amber-200">
                  {selectedVoiceOption}
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                {voiceOptions.map((voice) => {
                  const isSelected = selectedVoiceOption === voice.name;

                  return (
                    <button
                      aria-pressed={isSelected}
                      className={`min-h-24 border p-3 text-left transition hover:-translate-y-0.5 hover:border-red-300/50 ${
                        isSelected
                          ? "border-red-300/70 bg-red-500/14 ring-2 ring-red-400/25"
                          : "border-white/10 bg-white/[0.045]"
                      }`}
                      key={`hero-${voice.name}`}
                      onClick={() => setSelectedVoiceOption(voice.name)}
                      type="button"
                    >
                      <div
                        className={`mb-3 h-1 w-12 rounded-full bg-gradient-to-r ${voice.accent}`}
                      />
                      <p className="text-sm font-black text-white">
                        {voice.name}
                      </p>
                    </button>
                  );
                })}
              </div>

              {selectedVoiceOption === "Clone My Voice" ? (
                <div className="mt-4 border border-white/10 bg-black/35 p-4">
                  <div className="grid gap-4 lg:grid-cols-[0.78fr_1.22fr]">
                    <div>
                      <button
                        className="inline-flex h-11 w-full items-center justify-center rounded-full border border-white/15 bg-white/8 px-5 text-sm font-semibold text-zinc-100 transition hover:border-red-300/50 hover:bg-red-500/12"
                        onClick={() => cloneVoiceInputRef.current?.click()}
                        type="button"
                      >
                        Upload Voice Sample
                      </button>
                      <p className="mt-3 text-xs leading-5 text-zinc-500">
                        MP3, WAV, or M4A. 15 to 60 seconds.
                      </p>
                      {voiceSampleError ? (
                        <p className="mt-3 border border-amber-300/25 bg-amber-400/10 px-3 py-2 text-xs leading-5 text-amber-100">
                          {voiceSampleError}
                        </p>
                      ) : null}
                      {voiceSample ? (
                        <p className="mt-3 text-sm font-semibold text-amber-200">
                          Voice sample ready for cloning
                        </p>
                      ) : null}
                    </div>
                    <div>
                      <div className="flex h-24 items-center gap-1 overflow-hidden border border-white/10 bg-black/45 px-4">
                        {Array.from({ length: 40 }).map((_, index) => (
                          <span
                            className={`waveform-bar block flex-1 rounded-full bg-gradient-to-t from-cyan-500 via-red-400 to-amber-200 ${
                              voiceSample ? "opacity-90" : "opacity-25"
                            }`}
                            key={`clone-waveform-${index}`}
                            style={{
                              height: `${18 + ((index * 23) % 64)}%`,
                            }}
                          />
                        ))}
                      </div>
                      <div className="mt-3 flex flex-col justify-between gap-1 text-xs text-zinc-500 sm:flex-row">
                        <span className="truncate">
                          {voiceSample?.file.name ?? "No sample uploaded"}
                        </span>
                        <span>
                          {voiceSample
                            ? `${voiceSample.duration.toFixed(1)}s`
                            : "0.0s"}
                        </span>
                      </div>
                      {voiceSample ? (
                        <audio
                          className="mt-3 h-9 w-full"
                          controls
                          src={voiceSample.url}
                        />
                      ) : null}
                      {voiceSample ? (
                        <>
                          <div className="mt-4 grid gap-2 sm:grid-cols-2">
                            {voiceQualityChecks.map((check) => (
                              <div
                                className={`border px-3 py-2 ${getQualityStatusClasses(
                                  check.status,
                                )}`}
                                key={check.label}
                              >
                                <p className="text-[0.62rem] font-black uppercase tracking-[0.18em] opacity-75">
                                  {check.label}
                                </p>
                                <p className="mt-1 text-sm font-bold">
                                  {check.value}
                                </p>
                              </div>
                            ))}
                          </div>
                          <div
                            className={`mt-3 border px-3 py-2 text-xs leading-5 ${
                              voiceSample.quality.verdict === "ready"
                                ? "border-emerald-300/25 bg-emerald-400/10 text-emerald-100"
                                : voiceSample.quality.verdict ===
                                    "needs-improvement"
                                  ? "border-amber-300/25 bg-amber-400/10 text-amber-100"
                                  : "border-red-400/25 bg-red-500/10 text-red-100"
                            }`}
                          >
                            {voiceSample.quality.notes.join(" ")}
                          </div>
                          <label className="mt-4 flex cursor-pointer items-start gap-3 border border-white/10 bg-white/[0.045] p-3 text-sm leading-6 text-zinc-300">
                            <input
                              checked={voiceConsentAccepted}
                              className="mt-1 h-4 w-4 accent-red-500"
                              onChange={(event) =>
                                setVoiceConsentAccepted(event.target.checked)
                              }
                              type="checkbox"
                            />
                            <span>
                              I confirm this is my voice, or I have explicit
                              permission to use this voice sample for cloned
                              narration in this trailer.
                            </span>
                          </label>
                          <button
                            className="mt-3 inline-flex h-10 w-full items-center justify-center rounded-full border border-red-300/30 bg-red-500/10 px-4 text-sm font-semibold text-red-100 transition hover:border-red-200 hover:bg-red-500/20"
                            onClick={() => {
                              void deleteStoredVoiceSample();
                            }}
                            type="button"
                          >
                            Remove Voice Sample
                          </button>
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}
            </section>
          </motion.div>

          <motion.div
            animate={{ opacity: 1, scale: 1 }}
            className="relative"
            initial={{ opacity: 0, scale: 0.97 }}
            transition={{ delay: 0.12, duration: 0.75, ease: "easeOut" }}
          >
            <div className="absolute -inset-8 bg-gradient-to-br from-red-500/25 via-transparent to-amber-300/15 blur-3xl" />
            <div className="relative overflow-hidden border border-white/10 bg-black/42 shadow-2xl backdrop-blur-xl">
              <div className="relative aspect-[16/10] overflow-hidden bg-[linear-gradient(140deg,rgba(127,29,29,0.95),rgba(10,10,15,0.9)_42%,rgba(234,179,8,0.34)),url('/cinelife-hero.png')] bg-cover bg-center sm:aspect-[4/3] lg:aspect-[3/4]">
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.05),rgba(0,0,0,0.88))]" />
                <div className="relative flex h-full flex-col justify-between p-5 sm:p-8">
                  <div className="flex items-center justify-between gap-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-100/80">
                      CineLife Original
                    </div>
                    <div className="rounded-full border border-red-300/40 bg-red-500/20 px-3 py-1 text-[0.68rem] font-bold uppercase tracking-[0.24em] text-red-50">
                      Trailer
                    </div>
                  </div>
                  <div className="max-w-sm">
                    <div className="mb-4 h-1 w-20 rounded-full bg-red-500" />
                    <h2 className="text-4xl font-black leading-none sm:text-5xl">
                      Your Photos Await
                    </h2>
                    <p className="mt-5 text-sm leading-6 text-zinc-200">
                      Drop in 3 to 10 images, choose a cinematic style, and
                      build a preview from your life.
                    </p>
                  </div>
                </div>
              </div>
              <div className="grid border-t border-white/10 bg-[#09070a]/90 sm:grid-cols-3">
                {["3-10 photos", form.trailerStyle, movie ? "Ready" : "Draft"].map(
                  (item, index) => (
                    <div
                      className="border-white/10 px-5 py-4 text-sm font-semibold text-zinc-200 sm:border-r sm:last:border-r-0"
                      key={`${item}-${index}`}
                    >
                      <p className="text-[0.65rem] uppercase tracking-[0.24em] text-zinc-500">
                        {index === 0
                          ? "Input"
                          : index === 1
                            ? "Style"
                            : "Status"}
                      </p>
                      <p className="mt-1">{item}</p>
                    </div>
                  ),
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <section
        id="movie-builder"
        className="relative px-6 py-20 sm:px-10 lg:px-16"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(239,68,68,0.16),transparent_34%)]" />
        <div className="relative mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.78fr_1.22fr]">
          <div className="min-w-0">
            <p className="text-sm font-semibold uppercase tracking-[0.36em] text-red-300">
              Trailer Builder
            </p>
            <h2 className="mt-4 text-4xl font-black tracking-normal text-white sm:text-5xl">
              Build the trailer path from first frame to final scene.
            </h2>
            <p className="mt-5 max-w-xl text-base leading-8 text-zinc-400">
              CineLife reads your photos in the browser, studies light, color,
              contrast, and framing, then turns those signals into a streaming
              trailer experience.
            </p>

            <div className="mt-8 space-y-3">
              {journeySteps.map((step, index) => (
                <div
                  className="group flex items-center gap-4 border border-white/10 bg-white/[0.055] p-4 transition hover:border-red-300/35 hover:bg-white/[0.075]"
                  key={step}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-black/60 text-sm font-black text-red-200 ring-1 ring-white/10 transition group-hover:bg-red-600 group-hover:text-white">
                    {index + 1}
                  </span>
                  <div>
                    <p className="text-base font-bold text-white">{step}</p>
                    <p className="mt-1 text-sm text-zinc-500">
                      {index === 0
                        ? `${photos.length}/10 frames loaded`
                        : index === 1
                          ? form.futureDream || "Add the future you want to see"
                          : index === 2
                            ? selectedTrailerStyle.name
                            : movie
                              ? "Preview ready"
                              : "Awaiting generation"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <form
            className="min-w-0 max-w-full border border-white/10 bg-white/[0.055] p-5 shadow-2xl backdrop-blur-xl sm:p-7"
            onSubmit={handleGenerate}
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-medium text-zinc-300">Name</span>
                <input
                  className="h-12 w-full border border-white/10 bg-black/35 px-4 text-white outline-none transition placeholder:text-zinc-600 focus:border-red-300/70 focus:bg-black/55"
                  onChange={(event) => updateField("name", event.target.value)}
                  placeholder="Maya"
                  type="text"
                  value={form.name}
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium text-zinc-300">
                  Future Dream
                </span>
                <input
                  className="h-12 w-full border border-white/10 bg-black/35 px-4 text-white outline-none transition placeholder:text-zinc-600 focus:border-red-300/70 focus:bg-black/55"
                  onChange={(event) =>
                    updateField("futureDream", event.target.value)
                  }
                  placeholder="Build a film studio for real stories"
                  type="text"
                  value={form.futureDream}
                />
              </label>
            </div>

            <input
              accept="image/*"
              className="sr-only"
              multiple
              onChange={handleFileChange}
              ref={fileInputRef}
              type="file"
            />

            <div
              className={`mt-6 border border-dashed p-7 text-center transition ${
                isDragging
                  ? "border-red-300 bg-red-500/15 shadow-[0_0_60px_rgba(239,68,68,0.22)]"
                  : "border-white/15 bg-black/25 hover:border-red-300/60 hover:bg-black/35"
              }`}
              onClick={() => fileInputRef.current?.click()}
              onDragEnter={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={(event) => {
                event.preventDefault();
                setIsDragging(false);
              }}
              onDragOver={(event) => event.preventDefault()}
              onDrop={handleDrop}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              role="button"
              tabIndex={0}
            >
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-red-600 to-amber-400 text-2xl font-black shadow-[0_16px_48px_rgba(239,68,68,0.28)]">
                +
              </div>
              <p className="mt-5 text-xl font-bold text-white">
                Drag and drop 3 to 10 photos
              </p>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                Click to browse, or drop JPG, PNG, WebP, and other browser
                supported image files here.
              </p>
            </div>

            {error ? (
              <p className="mt-4 border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                {error}
              </p>
            ) : null}

            {photos.length ? (
              <div className="mt-6">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold uppercase tracking-[0.24em] text-zinc-400">
                    Cinematic Film Strip
                  </p>
                  <p className="text-sm text-zinc-500">
                    {intelligenceReadyCount}/{photos.length} analyzed
                  </p>
                </div>
                <div className="max-w-full overflow-x-auto pb-3">
                  <div className="flex gap-4">
                  {photos.map((photo, index) => (
                    <figure
                        className="group relative w-56 shrink-0 overflow-hidden border border-white/10 bg-black/50 shadow-xl sm:w-64"
                      key={photo.id}
                    >
                        <div className="flex h-6 items-center justify-between bg-black px-3">
                          {Array.from({ length: 8 }).map((_, notchIndex) => (
                            <span
                              className="h-2 w-2 rounded-sm bg-zinc-800"
                              key={`${photo.id}-top-${notchIndex}`}
                            />
                          ))}
                        </div>
                        <div className="relative aspect-[4/5] bg-[radial-gradient(circle_at_50%_0%,rgba(239,68,68,0.14),transparent_34%),#050307]">
                          <Image
                            alt={`Uploaded trailer frame ${index + 1}`}
                            className="object-contain p-2 transition duration-500 group-hover:scale-[1.02]"
                            fill
                            sizes="256px"
                            src={photo.url}
                            unoptimized
                          />
                        </div>
                        <div className="flex h-6 items-center justify-between bg-black px-3">
                          {Array.from({ length: 8 }).map((_, notchIndex) => (
                            <span
                              className="h-2 w-2 rounded-sm bg-zinc-800"
                              key={`${photo.id}-bottom-${notchIndex}`}
                            />
                          ))}
                        </div>
                        <figcaption className="border-t border-white/10 p-4">
                          <div className="mb-3 flex items-center justify-between gap-3">
                            <p className="truncate text-sm font-black text-zinc-100">
                              Frame {index + 1}
                            </p>
                            <p className="text-xs font-bold uppercase tracking-[0.2em] text-red-300">
                              {photoSignals[photo.id]?.classification ??
                                "scanning"}
                            </p>
                          </div>
                          {photoSignals[photo.id] ? (
                            <>
                              <div className="mb-3 flex flex-wrap gap-1.5">
                                {photoSignals[photo.id].dominantColors.map(
                                  (color) => (
                                    <span
                                      aria-label={color.label}
                                      className="h-5 w-5 rounded-full border border-white/20"
                                      key={`${photo.id}-${color.hex}`}
                                      style={{ backgroundColor: color.hex }}
                                      title={`${color.label} ${color.hex}`}
                                    />
                                  ),
                                )}
                              </div>
                              <dl className="grid grid-cols-2 gap-2 text-xs text-zinc-400">
                                <div>
                                  <dt className="uppercase tracking-[0.18em] text-zinc-600">
                                    Mood
                                  </dt>
                                  <dd className="mt-1 font-semibold text-zinc-200">
                                    {photoSignals[photo.id].mood}
                                  </dd>
                                </div>
                                <div>
                                  <dt className="uppercase tracking-[0.18em] text-zinc-600">
                                    Light
                                  </dt>
                                  <dd className="mt-1 font-semibold text-zinc-200">
                                    {Math.round(
                                      photoSignals[photo.id].brightness,
                                    )}
                                  </dd>
                                </div>
                              </dl>
                            </>
                          ) : (
                            <div className="space-y-2">
                              <div className="h-2 w-24 animate-pulse rounded-full bg-white/10" />
                              <div className="h-2 w-36 animate-pulse rounded-full bg-white/10" />
                            </div>
                          )}
                        </figcaption>
                      <button
                        aria-label={`Remove frame ${index + 1}`}
                          className="absolute right-2 top-8 h-8 w-8 rounded-full bg-black/70 text-sm font-bold text-white opacity-0 transition hover:bg-red-600 group-hover:opacity-100"
                        onClick={(event) => {
                          event.stopPropagation();
                          removePhoto(photo.id);
                        }}
                        type="button"
                      >
                        x
                      </button>
                    </figure>
                  ))}
                  </div>
                </div>
              </div>
            ) : null}

            {visualStorySequence.length ? (
              <div className="mt-7 border border-white/10 bg-black/30 p-5">
                <div className="mb-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-zinc-400">
                      Visual Story Sequence
                    </p>
                    <p className="mt-2 text-sm leading-6 text-zinc-500">
                      CineLife maps your uploaded frames into a trailer arc.
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-amber-200">
                    {visualStorySequence.length} story beats
                  </p>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {visualStorySequence.map((beat) => (
                    <div
                      className="border border-white/10 bg-white/[0.045] p-4"
                      key={beat.photoId}
                    >
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <p className="text-sm font-black text-white">
                          {beat.role}
                        </p>
                        <p className="text-xs font-bold uppercase tracking-[0.2em] text-red-300">
                          Frame {beat.frameNumber}
                        </p>
                      </div>
                      <p className="text-sm leading-6 text-zinc-400">
                        {beat.storyPurpose}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mt-7">
              <div className="mb-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.24em] text-zinc-400">
                    Choose Style
                  </p>
                  <p className="mt-2 text-sm leading-6 text-zinc-500">
                    Select the emotional direction for your trailer preview.
                  </p>
                </div>
                <p className="text-sm font-semibold text-amber-200">
                  Selected: {selectedTrailerStyle.name}
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {trailerStyles.map((style) => {
                  const isSelected = form.trailerStyle === style.name;

                  return (
                    <button
                      aria-pressed={isSelected}
                      className={`group relative min-h-44 min-w-0 overflow-hidden border p-0 text-left shadow-xl transition duration-300 hover:-translate-y-1 hover:border-red-300/55 hover:shadow-[0_18px_60px_rgba(239,68,68,0.24)] ${
                        isSelected
                          ? "border-red-300/70 bg-red-500/12 ring-2 ring-red-400/35"
                          : "border-white/10 bg-black/35"
                      }`}
                      key={style.name}
                      onClick={() => updateField("trailerStyle", style.name)}
                      type="button"
                    >
                      <div className={`h-20 ${style.preview}`} />
                      <div className="relative p-4">
                        <div
                          className={`absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r ${style.accent}`}
                        />
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-base font-black text-white">
                              {style.name}
                            </p>
                            <p className="mt-1 text-[0.68rem] font-bold uppercase tracking-[0.24em] text-zinc-500">
                              {style.cue}
                            </p>
                          </div>
                          <span
                            className={`mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-black transition ${
                              isSelected
                                ? "border-red-300 bg-red-500 text-white"
                                : "border-white/20 text-transparent group-hover:text-red-200"
                            }`}
                          >
                            {isSelected ? "✓" : ""}
                          </span>
                        </div>
                        <p className="mt-3 break-words text-sm leading-6 text-zinc-400">
                          {style.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              className="mt-6 inline-flex h-14 w-full items-center justify-center rounded-full bg-gradient-to-r from-red-600 via-red-500 to-amber-400 px-6 text-base font-bold text-white shadow-[0_16px_46px_rgba(239,68,68,0.32)] transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:scale-100"
              disabled={isGenerating || !configStatus?.isProductionReady}
              type="submit"
            >
              {isGenerating ? (
                <span className="flex items-center gap-3">
                  <span className="trailer-loader" />
                  {generationProgress}% · {generationStatus || "Cutting Your Trailer"}
                </span>
              ) : (
                "Generate Trailer"
              )}
            </button>
            {!configStatus?.isProductionReady ? (
              <div className="mt-4 border border-amber-300/25 bg-amber-400/10 p-4 text-sm leading-6 text-amber-100">
                <p>
                  Production generation needs OpenAI, Cloudinary, Supabase
                  server, and Supabase anonymous auth configured. Missing:{" "}
                  {configStatus?.missing.join(", ") || "loading config"}.
                </p>
                {configStatus?.diagnostics ? (
                  <div className="mt-4 grid gap-2">
                    {Object.entries(configStatus.diagnostics).map(
                      ([provider, diagnostic]) => (
                        <div
                          className="flex flex-col gap-1 border border-white/10 bg-black/25 px-3 py-2 sm:flex-row sm:items-start sm:justify-between"
                          key={provider}
                        >
                          <span
                            className={`text-xs font-black uppercase tracking-[0.18em] ${
                              diagnostic.status === "ready"
                                ? "text-emerald-200"
                                : diagnostic.status === "invalid"
                                  ? "text-red-200"
                                  : "text-amber-200"
                            }`}
                          >
                            {provider}
                          </span>
                          <span className="text-xs text-zinc-300 sm:max-w-[70%] sm:text-right">
                            {diagnostic.message}
                            {diagnostic.missingEnv?.length
                              ? ` Missing env: ${diagnostic.missingEnv.join(", ")}.`
                              : ""}
                          </span>
                        </div>
                      ),
                    )}
                  </div>
                ) : null}
              </div>
            ) : null}
          </form>
        </div>
      </section>

      <section
        className="scroll-mt-8 px-6 pb-24 pt-8 sm:px-10 lg:px-16"
        id="movie-experience"
        ref={experienceRef}
      >
        <div className="mx-auto max-w-7xl">
          <div className="mb-10 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.36em] text-amber-200">
                Trailer Premiere
              </p>
              <h2 className="mt-4 text-4xl font-black tracking-normal text-white sm:text-5xl">
                Your photos, cut like a trailer.
              </h2>
            </div>
            <p className="max-w-xl text-base leading-8 text-zinc-400">
              The final MP4 is generated from your uploaded Cloudinary assets,
              OpenAI story, AI narration, Remotion timeline, and rendered video.
            </p>
          </div>

          {error && movie ? (
            <p className="mb-6 border border-amber-300/25 bg-amber-400/10 px-4 py-3 text-sm leading-6 text-amber-100">
              {error}
            </p>
          ) : null}

          {canRetryFailedJob && !isGenerating ? (
            <div className="mb-8 overflow-hidden border border-red-400/25 bg-red-500/10 shadow-2xl">
              <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[0.34fr_0.66fr]">
                <div className="relative flex aspect-square max-w-56 items-center justify-center rounded-full border border-white/10 bg-black/45">
                  <div
                    className="absolute inset-3 rounded-full"
                    style={{
                      background: `conic-gradient(#ef4444 ${
                        (productionJob?.progress ?? 0) * 3.6
                      }deg, rgba(255,255,255,0.08) 0deg)`,
                    }}
                  />
                  <div className="absolute inset-7 rounded-full bg-[#09070b]" />
                  <div className="relative text-center">
                    <p className="text-5xl font-black leading-none text-white">
                      {productionJob?.progress ?? generationProgress}%
                    </p>
                    <p className="mt-2 text-xs font-bold uppercase tracking-[0.2em] text-red-200">
                      Failed
                    </p>
                  </div>
                </div>
                <div className="flex flex-col justify-center">
                  <p className="text-sm font-black uppercase tracking-[0.28em] text-red-200">
                    Job retry available
                  </p>
                  <h3 className="mt-3 text-3xl font-black leading-none text-white sm:text-4xl">
                    {productionJob?.stage ?? "Generation"} stopped before the
                    final MP4.
                  </h3>
                  <p className="mt-4 max-w-2xl text-sm leading-6 text-red-50/80">
                    {productionJob?.error ||
                      error ||
                      "CineLife can retry the failed stage using the same uploaded photos and job assets."}
                  </p>
                  <div className="mt-5 flex flex-wrap gap-3">
                    {canRetryVoiceStage ? (
                      <button
                        className="inline-flex h-12 items-center justify-center rounded-full bg-gradient-to-r from-red-600 via-red-500 to-amber-400 px-5 text-sm font-bold text-white shadow-[0_16px_46px_rgba(239,68,68,0.28)] transition hover:scale-[1.01]"
                        onClick={() => {
                          void retryProductionStage("voice");
                        }}
                        type="button"
                      >
                        Retry Voice Stage
                      </button>
                    ) : null}
                    {canRetryRenderStage ? (
                      <button
                        className="inline-flex h-12 items-center justify-center rounded-full bg-gradient-to-r from-red-600 via-red-500 to-amber-400 px-5 text-sm font-bold text-white shadow-[0_16px_46px_rgba(239,68,68,0.28)] transition hover:scale-[1.01]"
                        onClick={() => {
                          void retryProductionStage("render");
                        }}
                        type="button"
                      >
                        Retry Render Stage
                      </button>
                    ) : null}
                    {!canRetryVoiceStage && !canRetryRenderStage ? (
                      <button
                        className="inline-flex h-12 items-center justify-center rounded-full border border-white/15 bg-white/8 px-5 text-sm font-bold text-zinc-100 transition hover:border-white/35 hover:bg-white/12"
                        onClick={() => {
                          void retryProductionStage("render");
                        }}
                        type="button"
                      >
                        Retry Job
                      </button>
                    ) : null}
                    {selectedVoiceOption === "Clone My Voice" ? (
                      <button
                        className="inline-flex h-12 items-center justify-center rounded-full border border-red-300/30 bg-red-500/10 px-5 text-sm font-bold text-red-100 transition hover:border-red-200 hover:bg-red-500/20"
                        onClick={() => {
                          void deleteStoredVoiceSample();
                        }}
                        type="button"
                      >
                        Delete Stored Voice Sample
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {isGenerating ? (
            <div className="relative overflow-hidden border border-white/10 bg-white/[0.055] p-5 shadow-2xl sm:p-8">
              <div className="projector-sweep absolute inset-0" />
              <div className="relative grid gap-8 lg:grid-cols-[0.46fr_0.54fr]">
                <div className="relative aspect-[3/4] overflow-hidden bg-zinc-950">
                  {activePhoto ? (
                    <Image
                      alt="Trailer render preview frame"
                      className="object-contain p-3 opacity-75"
                      fill
                      sizes="(max-width: 1024px) 100vw, 46vw"
                      src={activePhoto.url}
                      unoptimized
                    />
                  ) : null}
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.12),rgba(0,0,0,0.88))]" />
                  <div className="absolute inset-x-0 bottom-0 p-6">
                    <p className="text-xs font-bold uppercase tracking-[0.32em] text-amber-200">
                      Cutting Reel
                    </p>
                    <p className="mt-3 text-3xl font-black leading-none text-white">
                      {selectedTrailerStyle.name}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col justify-center">
                  <p className="text-sm font-bold uppercase tracking-[0.34em] text-red-300">
                    Trailer Engine
                  </p>
                  <h3 className="mt-4 text-4xl font-black leading-none text-white sm:text-5xl">
                    Reading light, rhythm, and memory.
                  </h3>
                  <p className="mt-5 max-w-xl text-base leading-8 text-zinc-400">
                    {generationStatus ||
                      "CineLife is assembling a streaming-style preview."}
                  </p>
                  {productionJob ? (
                    <p className="mt-3 max-w-xl text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                      Job {productionJob.jobId.slice(0, 8)} ·{" "}
                      {productionJob.status}
                    </p>
                  ) : null}
                  <div className="mt-8 grid gap-6 xl:grid-cols-[0.42fr_0.58fr]">
                    <div className="relative flex aspect-square max-w-64 items-center justify-center rounded-full border border-white/10 bg-black/40">
                      <div
                        className="absolute inset-3 rounded-full"
                        style={{
                          background: `conic-gradient(#ef4444 ${generationProgress * 3.6}deg, rgba(255,255,255,0.08) 0deg)`,
                        }}
                      />
                      <div className="absolute inset-7 rounded-full bg-[#09070b]" />
                      <div className="relative text-center">
                        <p className="text-6xl font-black leading-none text-white">
                          {generationProgress}%
                        </p>
                        <p className="mt-2 text-xs font-bold uppercase tracking-[0.22em] text-red-200">
                          {generationStage}
                        </p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {productionStages.map((stage) => {
                        const stageIndex = productionStages.indexOf(stage);
                        const activeIndex = productionStages.indexOf(
                          generationStage,
                        );
                        const isComplete =
                          generationProgress === 100 || stageIndex < activeIndex;
                        const isActive = stage === generationStage;

                        return (
                          <div
                            className={`flex items-center justify-between border px-4 py-3 ${
                              isActive
                                ? "border-red-300/50 bg-red-500/12"
                                : isComplete
                                  ? "border-emerald-300/25 bg-emerald-400/8"
                                  : "border-white/10 bg-white/[0.035]"
                            }`}
                            key={stage}
                          >
                            <span className="text-xs font-bold uppercase tracking-[0.22em] text-zinc-300">
                              {stage}
                            </span>
                            <span
                              className={`text-xs font-black uppercase tracking-[0.18em] ${
                                isActive
                                  ? "text-red-200"
                                  : isComplete
                                    ? "text-emerald-200"
                                    : "text-zinc-600"
                              }`}
                            >
                              {isComplete ? "Done" : isActive ? "Active" : "Queued"}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : movie ? (
            <>
              <div className="grid gap-8 lg:grid-cols-[0.44fr_0.56fr]">
                <div className="relative aspect-[3/4] overflow-hidden border border-white/10 bg-black shadow-2xl">
                  <Image
                    alt={`${movie.title} hero poster`}
                    className="object-contain p-3"
                    fill
                    sizes="(max-width: 1024px) 100vw, 44vw"
                    src={movie.posterPhoto.url}
                    unoptimized
                  />
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.08),rgba(0,0,0,0.28)_45%,rgba(0,0,0,0.9))]" />
                  <div className="absolute inset-x-0 bottom-0 p-7">
                    <p className="text-xs font-bold uppercase tracking-[0.32em] text-amber-200">
                      CineLife Original
                    </p>
                    <h3 className="mt-4 text-4xl font-black leading-none text-white sm:text-5xl">
                      {movie.title}
                    </h3>
                  </div>
                </div>

                <div className="flex flex-col justify-center border border-white/10 bg-white/[0.055] p-7 shadow-2xl backdrop-blur-xl sm:p-10">
                  <p className="text-sm font-semibold uppercase tracking-[0.34em] text-red-300">
                    Now Streaming From Your Camera Roll
                  </p>
                  <h3 className="mt-5 text-5xl font-black leading-none text-white sm:text-6xl">
                    {movie.title}
                  </h3>
                  <p className="mt-5 text-xl font-semibold text-zinc-100">
                    {movie.genre}
                  </p>
                  <p className="mt-6 max-w-2xl text-base leading-8 text-zinc-400">
                    {movie.storyline}
                  </p>
                  <button
                    className="mt-8 inline-flex h-14 w-full items-center justify-center rounded-full bg-gradient-to-r from-red-600 via-red-500 to-amber-400 px-8 text-base font-bold text-white shadow-[0_18px_60px_rgba(239,68,68,0.38)] transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:scale-100 sm:w-fit"
                    disabled={!renderedTrailerVideo}
                    onClick={watchTrailerVideo}
                    type="button"
                  >
                    {renderedTrailerVideo ? "Watch Final Trailer" : "Rendering Final Trailer"}
                  </button>
                  <div className="hidden">
                    <button
                      className="inline-flex h-11 items-center justify-center rounded-full border border-white/15 bg-white/8 px-5 text-sm font-semibold text-zinc-100 backdrop-blur transition hover:border-white/35 hover:bg-white/12 disabled:cursor-not-allowed disabled:opacity-45"
                      disabled={playbackState !== "playing"}
                      onClick={pauseMovie}
                      type="button"
                    >
                      Pause
                    </button>
                    <button
                      className="inline-flex h-11 items-center justify-center rounded-full border border-white/15 bg-white/8 px-5 text-sm font-semibold text-zinc-100 backdrop-blur transition hover:border-white/35 hover:bg-white/12 disabled:cursor-not-allowed disabled:opacity-45"
                      disabled={playbackState !== "paused"}
                      onClick={resumeMovie}
                      type="button"
                    >
                      Resume
                    </button>
                    <button
                      className="inline-flex h-11 items-center justify-center rounded-full border border-white/15 bg-white/8 px-5 text-sm font-semibold text-zinc-100 backdrop-blur transition hover:border-white/35 hover:bg-white/12"
                      onClick={replayMovie}
                      type="button"
                    >
                      Replay
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {resultCards.map((result) => (
                  <article
                    className="group relative min-h-64 overflow-hidden border border-white/10 bg-white/[0.055] p-6 shadow-xl backdrop-blur transition hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.075]"
                    key={result.label}
                  >
                    <div
                      className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${result.accent}`}
                    />
                    <div
                      className={`absolute -right-16 -top-16 h-40 w-40 rounded-full bg-gradient-to-br ${result.accent} opacity-15 blur-3xl transition group-hover:opacity-25`}
                    />
                    <p className="text-xs font-bold uppercase tracking-[0.28em] text-zinc-400">
                      {result.label}
                    </p>
                    <p className="mt-5 text-xl font-semibold leading-8 text-zinc-50">
                      {result.value}
                    </p>
                  </article>
                ))}
              </div>

              <section className="mt-8 overflow-hidden border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.07),rgba(255,255,255,0.035))] shadow-2xl backdrop-blur-xl">
                <div className="relative border-b border-white/10 p-6 sm:p-8">
                  <div className="projector-sweep absolute inset-0 opacity-60" />
                  <div className="relative flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
                    <div>
                      <p className="text-sm font-bold uppercase tracking-[0.34em] text-red-300">
                        Final Trailer
                      </p>
                      <h3 className="mt-4 text-4xl font-black leading-none text-white sm:text-5xl">
                        Your rendered MP4 premiere.
                      </h3>
                    </div>
                    <div className="w-full max-w-sm border border-white/10 bg-black/35 p-4">
                      <p className="text-xs font-bold uppercase tracking-[0.24em] text-zinc-500">
                        Output
                      </p>
                      <p className="mt-2 text-2xl font-black text-white">
                        {renderedTrailerVideo ? "Ready to watch" : "Rendering"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-6 sm:p-8">
                  <div className="grid gap-6 lg:grid-cols-[0.88fr_1.12fr]">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.28em] text-zinc-400">
                        MP4 Trailer
                      </p>
                      <h4 className="mt-3 text-3xl font-black leading-none text-white">
                        Photos, voice, music, and motion in one video.
                      </h4>
                      <p className="mt-4 text-sm leading-6 text-zinc-500">
                        The narration is included inside the rendered trailer
                        audio and is not shown as a separate script on the page.
                      </p>
                      <div className="mt-6 flex flex-wrap gap-2">
                        <button
                          className="inline-flex h-12 items-center justify-center rounded-full bg-gradient-to-r from-red-600 via-red-500 to-amber-400 px-5 text-sm font-bold text-white shadow-[0_16px_46px_rgba(239,68,68,0.28)] transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:scale-100"
                          disabled={!renderedTrailerVideo || isRenderingVideo}
                          onClick={watchTrailerVideo}
                          type="button"
                        >
                          Watch Trailer
                        </button>
                        <button
                          className="inline-flex h-12 items-center justify-center rounded-full border border-white/15 bg-white/8 px-5 text-sm font-bold text-zinc-100 transition hover:border-white/35 hover:bg-white/12 disabled:cursor-not-allowed disabled:opacity-45"
                          disabled={!renderedTrailerVideo || isRenderingVideo}
                          onClick={downloadTrailerVideo}
                          type="button"
                        >
                          Download MP4
                        </button>
                        <button
                          className="inline-flex h-12 items-center justify-center rounded-full border border-white/15 bg-white/8 px-5 text-sm font-bold text-zinc-100 transition hover:border-white/35 hover:bg-white/12 disabled:cursor-not-allowed disabled:opacity-45"
                          disabled={!renderedTrailerVideo || isRenderingVideo}
                          onClick={shareTrailerVideo}
                          type="button"
                        >
                          Share Trailer
                        </button>
                      </div>
                    </div>

                    <div className="relative overflow-hidden border border-white/10 bg-black/35 p-5">
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(239,68,68,0.16),transparent_30%),radial-gradient(circle_at_88%_10%,rgba(251,191,36,0.12),transparent_26%)]" />
                      <div className="relative">
                        <div className="overflow-hidden border border-white/10 bg-black/45">
                          <div className="relative aspect-video">
                            {renderedTrailerVideo ? (
                              <video
                                className="h-full w-full object-contain"
                                controls
                                ref={finalVideoElementRef}
                                src={renderedTrailerVideo.url}
                              />
                            ) : (
                              <div className="flex h-full flex-col items-center justify-center p-6 text-center">
                                <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-white/15 bg-white/8 text-sm font-black text-red-200">
                                  MP4
                                </div>
                                <p className="max-w-sm text-sm leading-6 text-zinc-500">
                                  CineLife is rendering the final trailer file.
                                </p>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="mt-5">
                          <div className="mb-2 flex items-center justify-between text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">
                            <span>
                              {videoRenderStatus ||
                                "Photos + timeline + narration"}
                            </span>
                            <span>{videoRenderProgress}%</span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-white/10">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-red-600 via-red-400 to-amber-300 transition-all duration-500"
                              style={{ width: `${videoRenderProgress}%` }}
                            />
                          </div>
                        </div>

                        {videoRenderError ? (
                          <p className="mt-4 border border-amber-300/25 bg-amber-400/10 px-4 py-3 text-sm leading-6 text-amber-100">
                            {videoRenderError}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <section className="hidden">
                <div className="relative border-b border-white/10 p-6 sm:p-8">
                  <div className="projector-sweep absolute inset-0 opacity-60" />
                  <div className="relative flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
                    <div>
                      <p className="text-sm font-bold uppercase tracking-[0.34em] text-red-300">
                        Narration Preview
                      </p>
                      <h3 className="mt-4 text-4xl font-black leading-none text-white sm:text-5xl">
                        Voice, timing, and sound design.
                      </h3>
                    </div>
                    <div className="w-full max-w-sm border border-white/10 bg-black/35 p-4">
                      <p className="text-xs font-bold uppercase tracking-[0.24em] text-zinc-500">
                        Style Lock
                      </p>
                      <p className="mt-2 text-2xl font-black text-white">
                        {form.trailerStyle}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="border-b border-white/10 p-6 sm:p-8">
                  <audio
                    onEnded={() => setVoicePlaybackState("ended")}
                    onPause={() => {
                      if (voicePlaybackState === "playing") {
                        setVoicePlaybackState("paused");
                      }
                    }}
                    onPlay={() => setVoicePlaybackState("playing")}
                    ref={voiceAudioRef}
                    src={generatedVoice?.url}
                  />
                  <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
                    <div>
                      <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-[0.28em] text-zinc-400">
                            Trailer Voice Generation
                          </p>
                          <p className="mt-2 text-sm leading-6 text-zinc-500">
                            AI-generated narration audio is stored locally in
                            browser memory after generation.
                          </p>
                        </div>
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-200">
                          AI voice
                        </p>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {voiceOptions.map((voice) => {
                          const isSelected =
                            selectedVoiceOption === voice.name;

                          return (
                            <button
                              aria-pressed={isSelected}
                              className={`min-h-28 border p-4 text-left transition hover:-translate-y-0.5 hover:border-red-300/50 ${
                                isSelected
                                  ? "border-red-300/70 bg-red-500/12 ring-2 ring-red-400/25"
                                  : "border-white/10 bg-black/28"
                              }`}
                              disabled={isGeneratingVoice}
                              key={voice.name}
                              onClick={() => setSelectedVoiceOption(voice.name)}
                              type="button"
                            >
                              <div
                                className={`mb-3 h-1 w-16 rounded-full bg-gradient-to-r ${voice.accent}`}
                              />
                              <p className="text-base font-black text-white">
                                {voice.name}
                              </p>
                              <p className="mt-2 text-sm leading-6 text-zinc-500">
                                {voice.description}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="relative overflow-hidden border border-white/10 bg-black/35 p-5">
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_10%,rgba(239,68,68,0.16),transparent_28%),radial-gradient(circle_at_82%_0%,rgba(251,191,36,0.12),transparent_30%)]" />
                      <div className="relative">
                        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                          <div>
                            <p className="text-xs font-bold uppercase tracking-[0.28em] text-red-300">
                              Voice Over
                            </p>
                            <p className="mt-2 text-2xl font-black text-white">
                              {generatedVoice
                                ? generatedVoice.voiceOption
                                : selectedVoiceOption}
                            </p>
                          </div>
                          <button
                            className="inline-flex h-12 items-center justify-center rounded-full bg-gradient-to-r from-red-600 via-red-500 to-amber-400 px-5 text-sm font-bold text-white shadow-[0_16px_46px_rgba(239,68,68,0.28)] transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:scale-100"
                            disabled={isGeneratingVoice}
                            onClick={generateVoiceOver}
                            type="button"
                          >
                            {isGeneratingVoice ? (
                              <span className="flex items-center gap-3">
                                <span className="trailer-loader" />
                                Generating
                              </span>
                            ) : (
                              "Generate Voice Over"
                            )}
                          </button>
                        </div>

                        <div className="mt-6 flex h-28 items-center gap-1 overflow-hidden border border-white/10 bg-black/45 px-4">
                          {Array.from({ length: 56 }).map((_, index) => (
                            <span
                              className={`waveform-bar block flex-1 rounded-full bg-gradient-to-t from-red-600 via-red-400 to-amber-200 ${
                                voicePlaybackState === "playing"
                                  ? "waveform-bar-active"
                                  : ""
                              }`}
                              key={`waveform-${index}`}
                              style={{
                                animationDelay: `${index * 38}ms`,
                                height: `${24 + ((index * 17) % 58)}%`,
                              }}
                            />
                          ))}
                        </div>

                        <div className="mt-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                          <p className="text-sm leading-6 text-zinc-400">
                            {voiceGenerationStatus ||
                              (generatedVoice
                                ? "Voice over stored in browser memory."
                                : "Choose a voice and generate audio from the narration preview.")}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <button
                              className="inline-flex h-10 items-center justify-center rounded-full border border-white/15 bg-white/8 px-4 text-sm font-semibold text-zinc-100 transition hover:border-white/35 hover:bg-white/12 disabled:cursor-not-allowed disabled:opacity-45"
                              disabled={!generatedVoice || isGeneratingVoice}
                              onClick={playVoiceOver}
                              type="button"
                            >
                              Play
                            </button>
                            <button
                              className="inline-flex h-10 items-center justify-center rounded-full border border-white/15 bg-white/8 px-4 text-sm font-semibold text-zinc-100 transition hover:border-white/35 hover:bg-white/12 disabled:cursor-not-allowed disabled:opacity-45"
                              disabled={
                                !generatedVoice ||
                                voicePlaybackState !== "playing"
                              }
                              onClick={pauseVoiceOver}
                              type="button"
                            >
                              Pause
                            </button>
                            <button
                              className="inline-flex h-10 items-center justify-center rounded-full border border-white/15 bg-white/8 px-4 text-sm font-semibold text-zinc-100 transition hover:border-white/35 hover:bg-white/12 disabled:cursor-not-allowed disabled:opacity-45"
                              disabled={!generatedVoice || isGeneratingVoice}
                              onClick={replayVoiceOver}
                              type="button"
                            >
                              Replay
                            </button>
                            <button
                              className="inline-flex h-10 items-center justify-center rounded-full border border-white/15 bg-white/8 px-4 text-sm font-semibold text-zinc-100 transition hover:border-white/35 hover:bg-white/12 disabled:cursor-not-allowed disabled:opacity-45"
                              disabled={!generatedVoice || isGeneratingVoice}
                              onClick={downloadVoiceOver}
                              type="button"
                            >
                              Download
                            </button>
                          </div>
                        </div>

                        {voiceError ? (
                          <p className="mt-4 border border-amber-300/25 bg-amber-400/10 px-4 py-3 text-sm leading-6 text-amber-100">
                            {voiceError}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-b border-white/10 p-6 sm:p-8">
                  <div className="grid gap-6 lg:grid-cols-[0.82fr_1.18fr]">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.28em] text-zinc-400">
                        Trailer Video Export
                      </p>
                      <h4 className="mt-3 text-3xl font-black leading-none text-white">
                        Render a real MP4 trailer.
                      </h4>
                      <p className="mt-4 text-sm leading-6 text-zinc-500">
                        Remotion builds the video from your uploaded photos,
                        title cards, narration timeline, cross fades, and
                        end credits. Voice-over audio is included when a voice
                        track has been generated.
                      </p>
                      {!generatedVoice ? (
                        <p className="mt-4 border border-amber-300/20 bg-amber-400/10 px-4 py-3 text-sm leading-6 text-amber-100">
                          Generate a voice-over first to include spoken
                          narration in the MP4.
                        </p>
                      ) : null}
                    </div>

                    <div className="relative overflow-hidden border border-white/10 bg-black/35 p-5">
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(239,68,68,0.16),transparent_30%),radial-gradient(circle_at_88%_10%,rgba(251,191,36,0.12),transparent_26%)]" />
                      <div className="relative">
                        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                          <div>
                            <p className="text-xs font-bold uppercase tracking-[0.28em] text-red-300">
                              MP4 Render
                            </p>
                            <p className="mt-2 text-2xl font-black text-white">
                              {renderedTrailerVideo
                                ? "Trailer video ready"
                                : "Awaiting render"}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              className="inline-flex h-12 items-center justify-center rounded-full bg-gradient-to-r from-red-600 via-red-500 to-amber-400 px-5 text-sm font-bold text-white shadow-[0_16px_46px_rgba(239,68,68,0.28)] transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:scale-100"
                              disabled={isRenderingVideo}
                              onClick={generateTrailerVideo}
                              type="button"
                            >
                              {isRenderingVideo ? (
                                <span className="flex items-center gap-3">
                                  <span className="trailer-loader" />
                                  Rendering
                                </span>
                              ) : (
                                "Generate Trailer Video"
                              )}
                            </button>
                            <button
                              className="inline-flex h-12 items-center justify-center rounded-full border border-white/15 bg-white/8 px-5 text-sm font-bold text-zinc-100 transition hover:border-white/35 hover:bg-white/12 disabled:cursor-not-allowed disabled:opacity-45"
                              disabled={!renderedTrailerVideo || isRenderingVideo}
                              onClick={downloadTrailerVideo}
                              type="button"
                            >
                              Download MP4
                            </button>
                            <button
                              className="inline-flex h-12 items-center justify-center rounded-full border border-white/15 bg-white/8 px-5 text-sm font-bold text-zinc-100 transition hover:border-white/35 hover:bg-white/12 disabled:cursor-not-allowed disabled:opacity-45"
                              disabled={!renderedTrailerVideo || isRenderingVideo}
                              onClick={shareTrailerVideo}
                              type="button"
                            >
                              Share Trailer
                            </button>
                          </div>
                        </div>

                        <div className="mt-6 overflow-hidden border border-white/10 bg-black/45">
                          <div className="relative aspect-video">
                            {renderedTrailerVideo ? (
                              <video
                                className="h-full w-full object-contain"
                                controls
                                src={renderedTrailerVideo.url}
                              />
                            ) : (
                              <div className="flex h-full flex-col items-center justify-center p-6 text-center">
                                <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-white/15 bg-white/8 text-sm font-black text-red-200">
                                  MP4
                                </div>
                                <p className="max-w-sm text-sm leading-6 text-zinc-500">
                                  Your rendered Remotion trailer preview will
                                  appear here after export.
                                </p>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="mt-5">
                          <div className="mb-2 flex items-center justify-between text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">
                            <span>
                              {videoRenderStatus ||
                                "Photos + timeline + narration"}
                            </span>
                            <span>{videoRenderProgress}%</span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-white/10">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-red-600 via-red-400 to-amber-300 transition-all duration-500"
                              style={{ width: `${videoRenderProgress}%` }}
                            />
                          </div>
                        </div>

                        {videoRenderError ? (
                          <p className="mt-4 border border-amber-300/25 bg-amber-400/10 px-4 py-3 text-sm leading-6 text-amber-100">
                            {videoRenderError}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid gap-0 lg:grid-cols-[0.92fr_1.08fr]">
                  <article className="border-b border-white/10 p-6 sm:p-8 lg:border-b-0 lg:border-r">
                    <p className="text-xs font-bold uppercase tracking-[0.28em] text-amber-200">
                      Voice Over Script
                    </p>
                    <p className="mt-5 text-2xl font-semibold leading-10 text-white sm:text-3xl sm:leading-[1.45]">
                      {movie.narrationPreview.voiceOverScript}
                    </p>
                  </article>

                  <div className="grid gap-0">
                    <article className="border-b border-white/10 p-6 sm:p-8">
                      <div className="mb-5 flex items-center justify-between gap-3">
                        <p className="text-xs font-bold uppercase tracking-[0.28em] text-zinc-400">
                          Scene Timeline
                        </p>
                        <p className="text-sm font-semibold text-red-200">
                          {movie.narrationPreview.sceneTimeline.length} beats
                        </p>
                      </div>
                      <div className="space-y-4">
                        {movie.narrationPreview.sceneTimeline.map((scene) => (
                          <div
                            className="grid gap-4 border border-white/10 bg-black/28 p-4 sm:grid-cols-[5.5rem_1fr]"
                            key={`${scene.sceneNumber}-${scene.startTime}`}
                          >
                            <div>
                              <p className="text-sm font-black text-white">
                                {scene.startTime}
                              </p>
                              <p className="mt-1 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                                {scene.endTime}
                              </p>
                            </div>
                            <div className="min-w-0">
                              <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                                <p className="text-sm font-bold uppercase tracking-[0.2em] text-red-300">
                                  Scene {scene.sceneNumber}
                                </p>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">
                                    Intensity
                                  </span>
                                  <span className="text-sm font-black text-amber-200">
                                    {scene.emotionalIntensity}/10
                                  </span>
                                </div>
                              </div>
                              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                                <div
                                  className="h-full rounded-full bg-gradient-to-r from-red-600 via-red-400 to-amber-300"
                                  style={{
                                    width: `${scene.emotionalIntensity * 10}%`,
                                  }}
                                />
                              </div>
                              <p className="mt-4 text-base font-semibold leading-7 text-zinc-100">
                                {scene.narrationLine}
                              </p>
                              <p className="mt-2 text-sm leading-6 text-zinc-500">
                                {scene.visualCue}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </article>

                    <article className="p-6 sm:p-8">
                      <p className="text-xs font-bold uppercase tracking-[0.28em] text-zinc-400">
                        Sound Design Notes
                      </p>
                      <div className="mt-5 grid gap-5 md:grid-cols-2">
                        <div>
                          <p className="text-sm font-black text-white">
                            Soundtrack Suggestions
                          </p>
                          <ul className="mt-3 space-y-2 text-sm leading-6 text-zinc-400">
                            {movie.narrationPreview.soundDesignNotes.soundtrackSuggestions.map(
                              (suggestion) => (
                                <li
                                  className="border-l border-red-400/50 pl-3"
                                  key={suggestion}
                                >
                                  {suggestion}
                                </li>
                              ),
                            )}
                          </ul>
                        </div>
                        <div>
                          <p className="text-sm font-black text-white">
                            Transition Suggestions
                          </p>
                          <ul className="mt-3 space-y-2 text-sm leading-6 text-zinc-400">
                            {movie.narrationPreview.soundDesignNotes.transitionSuggestions.map(
                              (suggestion) => (
                                <li
                                  className="border-l border-amber-300/60 pl-3"
                                  key={suggestion}
                                >
                                  {suggestion}
                                </li>
                              ),
                            )}
                          </ul>
                        </div>
                      </div>
                      <p className="mt-5 border border-white/10 bg-black/28 p-4 text-sm leading-6 text-zinc-300">
                        {movie.narrationPreview.soundDesignNotes.mixingNotes}
                      </p>
                    </article>
                  </div>
                </div>
              </section>
            </>
          ) : (
            <div className="border border-white/10 bg-white/[0.055] p-8 text-center shadow-xl backdrop-blur">
              <p className="text-lg font-semibold text-zinc-100">
                Your generated trailer experience will appear here.
              </p>
              <p className="mt-3 text-sm leading-6 text-zinc-400">
                Upload 3 to 10 photos, add your future dream, and press
                Generate Trailer.
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="hidden">
        <div className="mx-auto max-w-[1600px]">
          <div className="px-6 pb-6 sm:px-10 lg:px-16">
            <p className="text-sm font-semibold uppercase tracking-[0.36em] text-red-300">
              Cinematic Slideshow
            </p>
            <h2 className="mt-4 max-w-4xl text-4xl font-black tracking-normal text-white sm:text-5xl">
              A full-width trailer built from your uploaded frames.
            </h2>
          </div>

          <div className="relative min-h-[520px] overflow-hidden border-y border-white/10 bg-black sm:min-h-[640px]">
            {activePhoto ? (
              <Image
                alt="Active cinematic slideshow frame"
                className="cinematic-frame object-contain"
                fill
                key={activePhoto.id}
                sizes="100vw"
                src={activePhoto.url}
                unoptimized
              />
            ) : (
              <div
                className="absolute inset-0 bg-cover bg-center opacity-45"
                style={{ backgroundImage: "url('/cinelife-hero.png')" }}
              />
            )}
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.86),rgba(0,0,0,0.28)_48%,rgba(0,0,0,0.82)),linear-gradient(180deg,rgba(0,0,0,0.35),rgba(0,0,0,0.92))]" />
            <div className="relative z-10 flex min-h-[520px] flex-col justify-end px-6 py-10 sm:min-h-[640px] sm:px-10 lg:px-16">
              <div className="max-w-4xl">
                <p className="text-sm font-bold uppercase tracking-[0.36em] text-amber-200">
                  {movie ? "Now Playing" : "Awaiting Premiere"}
                </p>
                <h3 className="mt-4 text-5xl font-black leading-none text-white sm:text-7xl">
                  {movie?.title ?? "Upload Photos To Begin"}
                </h3>
                {movie && photos.length ? (
                  <p className="mt-4 text-sm font-bold uppercase tracking-[0.28em] text-zinc-300">
                    Slide {activeSlide + 1} / {photos.length}
                  </p>
                ) : null}
                <p className="mt-6 max-w-3xl text-lg leading-8 text-zinc-300">
                  {movie?.trailerNarration ??
                    "Your slideshow will fade, zoom, and advance like a movie trailer after generation."}
                </p>
              </div>

              <div className="mt-8 flex flex-col gap-5">
                <div className="flex flex-wrap items-center gap-3">
                  {photos.map((photo, index) => (
                    <button
                      aria-label={`Show slideshow frame ${index + 1}`}
                      className={`h-1.5 rounded-full transition-all ${
                        index === activeSlide
                          ? "w-14 bg-red-500"
                          : "w-8 bg-white/25 hover:bg-white/50"
                      }`}
                      key={photo.id}
                      onClick={() => setActiveSlide(index)}
                      type="button"
                    />
                  ))}
                </div>
                {movie ? (
                  <div className="flex flex-wrap gap-3">
                    <button
                      className="inline-flex h-11 items-center justify-center rounded-full bg-gradient-to-r from-red-600 via-red-500 to-amber-400 px-6 text-sm font-bold text-white shadow-[0_12px_36px_rgba(239,68,68,0.32)] transition hover:scale-[1.02]"
                      onClick={playMovie}
                      type="button"
                    >
                      Play Trailer
                    </button>
                    <button
                      className="inline-flex h-11 items-center justify-center rounded-full border border-white/15 bg-white/8 px-5 text-sm font-semibold text-zinc-100 backdrop-blur transition hover:border-white/35 hover:bg-white/12 disabled:cursor-not-allowed disabled:opacity-45"
                      disabled={playbackState !== "playing"}
                      onClick={pauseMovie}
                      type="button"
                    >
                      Pause
                    </button>
                    <button
                      className="inline-flex h-11 items-center justify-center rounded-full border border-white/15 bg-white/8 px-5 text-sm font-semibold text-zinc-100 backdrop-blur transition hover:border-white/35 hover:bg-white/12 disabled:cursor-not-allowed disabled:opacity-45"
                      disabled={playbackState !== "paused"}
                      onClick={resumeMovie}
                      type="button"
                    >
                      Resume
                    </button>
                    <button
                      className="inline-flex h-11 items-center justify-center rounded-full border border-white/15 bg-white/8 px-5 text-sm font-semibold text-zinc-100 backdrop-blur transition hover:border-white/35 hover:bg-white/12"
                      onClick={replayMovie}
                      type="button"
                    >
                      Replay
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
