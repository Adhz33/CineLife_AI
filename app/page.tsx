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

type FormState = {
  name: string;
  futureDream: string;
};

type UploadedPhoto = {
  id: string;
  file: File;
  name: string;
  url: string;
};

type PhotoSignal = {
  brightness: number;
  contrast: number;
  warmth: number;
  width: number;
  height: number;
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
};

type MovieResult = {
  title: string;
  genre: string;
  storyline: string;
  trailerNarration: string;
  futureChapter: string;
  posterConcept: string;
  analysis: PhotoAnalysis;
  posterPhoto: UploadedPhoto;
};

type PlaybackState = "idle" | "playing" | "paused" | "ended";

const initialFormState: FormState = {
  name: "",
  futureDream: "",
};

const accents = [
  "from-rose-500 to-amber-300",
  "from-fuchsia-500 to-red-400",
  "from-orange-400 to-yellow-300",
  "from-red-500 to-pink-400",
  "from-cyan-300 to-blue-500",
  "from-violet-400 to-rose-400",
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

  for (let index = 0; index < pixels.length; index += 4) {
    const red = pixels[index];
    const green = pixels[index + 1];
    const blue = pixels[index + 2];
    const brightness = (red + green + blue) / 3;

    totalBrightness += brightness;
    totalWarmth += red - blue;
    contrast += Math.abs(brightness - previousBrightness);
    previousBrightness = brightness;
  }

  const pixelCount = pixels.length / 4;

  return {
    brightness: totalBrightness / pixelCount,
    contrast: contrast / pixelCount,
    warmth: totalWarmth / pixelCount,
    width: image.naturalWidth,
    height: image.naturalHeight,
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
  };
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

function generateMovieResult(
  form: FormState,
  photos: UploadedPhoto[],
  analysis: PhotoAnalysis,
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

  return {
    title,
    genre: detectGenre(analysis, dream),
    storyline: `${name} uploads ${photoLanguage}. As the images flicker from quiet close-ups to wide emotional beats, CineLife AI finds the thread between who they were and the future they are building: ${dream.toLowerCase()}.`,
    trailerNarration: `In every photo, a life is hiding in plain sight. ${photos.length} frames, graded by ${analysis.palette} tones and ${analysis.mood} light. For ${name}, the dream to ${dream.toLowerCase()} becomes more than a wish. It becomes the final scene they were always moving toward.`,
    futureChapter: `Years from now, ${name} returns to these photos after learning how to ${dream.toLowerCase()}. The images feel different then: not proof of what was lost, but evidence that the future had already started.`,
    posterConcept: `A premium streaming poster built from the strongest uploaded frame, graded in ${analysis.palette} tones with a slow-burn ${analysis.mood} finish, film-strip edges, a glowing horizon, and ${name} positioned as the lead of their own life trailer.`,
    analysis,
    posterPhoto,
  };
}

export default function Home() {
  const [form, setForm] = useState<FormState>(initialFormState);
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [movie, setMovie] = useState<MovieResult | null>(null);
  const [activeSlide, setActiveSlide] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [playbackState, setPlaybackState] = useState<PlaybackState>("idle");
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const experienceRef = useRef<HTMLElement>(null);
  const photosRef = useRef<UploadedPhoto[]>([]);
  const narrationRef = useRef<SpeechSynthesisUtterance | null>(null);

  const resultCards = useMemo(() => {
    if (!movie) {
      return [];
    }

    return [
      { label: "Movie Title", value: movie.title, accent: accents[0] },
      { label: "Genre", value: movie.genre, accent: accents[1] },
      { label: "Storyline", value: movie.storyline, accent: accents[2] },
      {
        label: "Trailer Narration",
        value: movie.trailerNarration,
        accent: accents[3],
      },
      {
        label: "Future Chapter",
        value: movie.futureChapter,
        accent: accents[4],
      },
      {
        label: "Poster Concept",
        value: movie.posterConcept,
        accent: accents[5],
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
    return () => {
      window.speechSynthesis?.cancel();
      photosRef.current.forEach((photo) => URL.revokeObjectURL(photo.url));
    };
  }, []);

  const speakNarration = (nextMovie: MovieResult) => {
    if (!("speechSynthesis" in window)) {
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(nextMovie.trailerNarration);
    utterance.rate = 0.88;
    utterance.pitch = 0.82;
    utterance.volume = 0.95;
    narrationRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  const updateField = (field: keyof FormState, value: string) => {
    setForm((currentForm) => ({ ...currentForm, [field]: value }));
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
        setError("CineLife accepts up to 10 photos for one movie.");
      } else {
        setError("");
      }

      return [...currentPhotos, ...nextPhotos];
    });

    setMovie(null);
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
    setMovie(null);
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
      setError("Upload at least 3 photos to generate a movie.");
      return;
    }

    setError("");
    setIsGenerating(true);
    setMovie(null);
    setPlaybackState("idle");
    window.speechSynthesis?.cancel();

    try {
      await new Promise((resolve) => window.setTimeout(resolve, 500));
      const analysis = await analyzePhotos(photos);
      await new Promise((resolve) => window.setTimeout(resolve, 650));
      const nextMovie = generateMovieResult(form, photos, analysis);

      setMovie(nextMovie);
      setActiveSlide(0);
      setPlaybackState("idle");

      window.setTimeout(() => {
        experienceRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 100);
    } catch {
      setError("One of the photos could not be analyzed. Try replacing it.");
    } finally {
      setIsGenerating(false);
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

  return (
    <main className="min-h-screen overflow-hidden bg-[#050307] text-white">
      <section className="relative min-h-screen px-6 py-8 sm:px-10 lg:px-16">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-55"
          style={{ backgroundImage: "url('/cinelife-hero.png')" }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(239,68,68,0.34),transparent_28%),radial-gradient(circle_at_84%_18%,rgba(251,191,36,0.16),transparent_24%),linear-gradient(90deg,rgba(5,3,7,0.96)_0%,rgba(5,3,7,0.72)_45%,rgba(5,3,7,0.48)_100%)]" />
        <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-[#050307] to-transparent" />

        <nav className="relative z-10 mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="h-3 w-3 rounded-full bg-red-500 shadow-[0_0_24px_rgba(239,68,68,0.9)]" />
            <span className="text-sm font-semibold uppercase tracking-[0.38em] text-zinc-200">
              CineLife
            </span>
          </div>
          <a
            href="#movie-builder"
            className="rounded-full border border-white/15 bg-white/8 px-5 py-2 text-sm font-medium text-zinc-100 backdrop-blur transition hover:border-red-300/60 hover:bg-red-500/20"
          >
            Start Reel
          </a>
        </nav>

        <div className="relative z-10 mx-auto grid min-h-[calc(100vh-6rem)] max-w-7xl items-center gap-12 py-16 lg:grid-cols-[1.02fr_0.98fr]">
          <div className="max-w-3xl">
            <div className="mb-6 inline-flex items-center gap-3 rounded-full border border-red-400/25 bg-red-500/10 px-4 py-2 text-sm text-red-100 shadow-[0_0_40px_rgba(239,68,68,0.18)] backdrop-blur">
              <span className="h-2 w-2 rounded-full bg-red-400" />
              Photo-powered memory cinema
            </div>
            <h1 className="max-w-4xl text-6xl font-black leading-[0.92] tracking-normal text-white sm:text-7xl lg:text-8xl">
              CineLife AI
            </h1>
            <p className="mt-6 max-w-2xl text-2xl font-semibold text-zinc-100 sm:text-4xl">
              Turn Your Photos Into A Movie
            </p>
            <p className="mt-6 max-w-2xl text-base leading-8 text-zinc-300 sm:text-lg">
              Upload your favorite images, add a future dream, and CineLife AI
              will shape the photos into a cinematic poster, trailer-style
              narration, storyline, and full-width movie slideshow.
            </p>
            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <a
                href="#movie-builder"
                className="inline-flex h-14 items-center justify-center rounded-full bg-gradient-to-r from-red-600 via-red-500 to-amber-400 px-8 text-base font-bold text-white shadow-[0_18px_60px_rgba(239,68,68,0.38)] transition hover:scale-[1.02] hover:shadow-[0_22px_80px_rgba(239,68,68,0.5)]"
              >
                Create My Movie
              </a>
              <a
                href="#movie-experience"
                className="inline-flex h-14 items-center justify-center rounded-full border border-white/15 bg-white/8 px-8 text-base font-semibold text-zinc-100 backdrop-blur transition hover:border-white/35 hover:bg-white/12"
              >
                Watch Trailer
              </a>
            </div>
          </div>

          <div className="relative hidden lg:block">
            <div className="absolute -inset-8 rounded-[2rem] bg-gradient-to-br from-red-500/25 via-transparent to-amber-300/15 blur-3xl" />
            <div className="relative border border-white/10 bg-black/38 p-4 shadow-2xl backdrop-blur-xl">
              <div className="aspect-[3/4] overflow-hidden bg-[linear-gradient(140deg,rgba(127,29,29,0.95),rgba(10,10,15,0.95)_42%,rgba(234,179,8,0.42)),url('/cinelife-hero.png')] bg-cover bg-center">
                <div className="flex h-full flex-col justify-between p-8">
                  <div className="text-right text-xs font-semibold uppercase tracking-[0.32em] text-amber-100/80">
                    Original AI Film
                  </div>
                  <div>
                    <div className="mb-4 h-1 w-20 rounded-full bg-red-500" />
                    <h2 className="max-w-sm text-5xl font-black leading-none">
                      Your Photos Await
                    </h2>
                    <p className="mt-5 max-w-xs text-sm leading-6 text-zinc-200">
                      Drop in 3 to 10 images and build a trailer from your life.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        id="movie-builder"
        className="relative px-6 py-20 sm:px-10 lg:px-16"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(239,68,68,0.16),transparent_34%)]" />
        <div className="relative mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.78fr_1.22fr]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.36em] text-red-300">
              Movie Builder
            </p>
            <h2 className="mt-4 text-4xl font-black tracking-normal text-white sm:text-5xl">
              Upload the frames. CineLife edits the feeling.
            </h2>
            <p className="mt-5 max-w-xl text-base leading-8 text-zinc-400">
              CineLife reads your photos in the browser, studies light, color,
              contrast, and framing, then turns those signals into a streaming
              trailer experience.
            </p>

            <div className="mt-8 grid grid-cols-3 gap-3 text-center">
              {[
                ["3-10", "Photos"],
                [photos.length.toString(), "Uploaded"],
                [movie ? "Ready" : "Draft", "Status"],
              ].map(([value, label]) => (
                <div
                  className="border border-white/10 bg-white/[0.055] px-3 py-4"
                  key={label}
                >
                  <p className="text-2xl font-black text-white">{value}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.22em] text-zinc-500">
                    {label}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <form
            className="border border-white/10 bg-white/[0.055] p-5 shadow-2xl backdrop-blur-xl sm:p-7"
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
                    Uploaded Gallery
                  </p>
                  <p className="text-sm text-zinc-500">{photos.length}/10</p>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {photos.map((photo, index) => (
                    <figure
                      className="group relative aspect-[4/5] overflow-hidden border border-white/10 bg-black/40"
                      key={photo.id}
                    >
                      <Image
                        alt={`Uploaded movie frame ${index + 1}`}
                        className="object-cover transition duration-500 group-hover:scale-105"
                        fill
                        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                        src={photo.url}
                        unoptimized
                      />
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-3">
                        <p className="truncate text-xs font-semibold text-zinc-100">
                          Frame {index + 1}
                        </p>
                      </div>
                      <button
                        aria-label={`Remove frame ${index + 1}`}
                        className="absolute right-2 top-2 h-8 w-8 rounded-full bg-black/70 text-sm font-bold text-white opacity-0 transition hover:bg-red-600 group-hover:opacity-100"
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
            ) : null}

            <button
              className="mt-6 inline-flex h-14 w-full items-center justify-center rounded-full bg-gradient-to-r from-red-600 via-red-500 to-amber-400 px-6 text-base font-bold text-white shadow-[0_16px_46px_rgba(239,68,68,0.32)] transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:scale-100"
              disabled={isGenerating}
              type="submit"
            >
              {isGenerating ? (
                <span className="flex items-center gap-3">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/35 border-t-white" />
                  Analyzing Your Photos
                </span>
              ) : (
                "Generate My Movie"
              )}
            </button>
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
                Movie Experience
              </p>
              <h2 className="mt-4 text-4xl font-black tracking-normal text-white sm:text-5xl">
                Your photos, cut like a trailer.
              </h2>
            </div>
            <p className="max-w-xl text-base leading-8 text-zinc-400">
              The poster, story, narration, and slideshow are cut from your
              uploaded frames with a premium trailer finish.
            </p>
          </div>

          {isGenerating ? (
            <div className="relative overflow-hidden border border-white/10 bg-white/[0.055] p-8 shadow-2xl">
              <div className="absolute inset-0 animate-pulse bg-[linear-gradient(90deg,transparent,rgba(239,68,68,0.12),transparent)]" />
              <div className="relative grid gap-8 lg:grid-cols-[0.46fr_0.54fr]">
                <div className="aspect-[3/4] animate-pulse bg-zinc-900" />
                <div className="flex flex-col justify-center space-y-5">
                  <div className="h-4 w-36 rounded-full bg-zinc-800" />
                  <div className="h-12 w-10/12 rounded-full bg-zinc-800" />
                  <div className="h-4 w-full rounded-full bg-zinc-800" />
                  <div className="h-4 w-9/12 rounded-full bg-zinc-800" />
                </div>
              </div>
            </div>
          ) : movie ? (
            <>
              <div className="grid gap-8 lg:grid-cols-[0.44fr_0.56fr]">
                <div className="relative aspect-[3/4] overflow-hidden border border-white/10 bg-black shadow-2xl">
                  <Image
                    alt={`${movie.title} hero poster`}
                    className="object-cover"
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
                    className="mt-8 inline-flex h-14 w-full items-center justify-center rounded-full bg-gradient-to-r from-red-600 via-red-500 to-amber-400 px-8 text-base font-bold text-white shadow-[0_18px_60px_rgba(239,68,68,0.38)] transition hover:scale-[1.02] sm:w-fit"
                    onClick={playMovie}
                    type="button"
                  >
                    Play Movie
                  </button>
                  <div className="mt-4 flex flex-wrap gap-3">
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
            </>
          ) : (
            <div className="border border-white/10 bg-white/[0.055] p-8 text-center shadow-xl backdrop-blur">
              <p className="text-lg font-semibold text-zinc-100">
                Your generated movie experience will appear here.
              </p>
              <p className="mt-3 text-sm leading-6 text-zinc-400">
                Upload 3 to 10 photos, add your future dream, and press
                Generate My Movie.
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="px-0 pb-24">
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
                className="cinematic-frame object-cover"
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
                      Play Movie
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
