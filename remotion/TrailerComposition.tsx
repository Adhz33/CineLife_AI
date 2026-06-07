import { Audio } from "@remotion/media";
import {
  AbsoluteFill,
  Img,
  interpolate,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { TrailerRenderProps, TrailerTimelineScene } from "./trailerTypes";

const clamp = {
  extrapolateLeft: "clamp" as const,
  extrapolateRight: "clamp" as const,
};

const toSeconds = (timecode: string) => {
  const parts = timecode.split(":").map(Number);

  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }

  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }

  return 0;
};

const splitNarration = (script: string) => {
  return script
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 4);
};

const resolveAsset = (src: string) => {
  if (/^(data:|https?:|blob:)/.test(src)) {
    return src;
  }

  return staticFile(src);
};

const SceneFrame = ({
  scene,
  photoSrc,
  durationInFrames,
}: {
  scene: TrailerTimelineScene;
  photoSrc: string;
  durationInFrames: number;
}) => {
  const frame = useCurrentFrame();
  const fadeIn = interpolate(frame, [0, 14], [0, 1], clamp);
  const fadeOut = interpolate(
    frame,
    [durationInFrames - 18, durationInFrames],
    [1, 0],
    clamp,
  );
  const opacity = Math.min(fadeIn, fadeOut);
  const zoom = interpolate(frame, [0, durationInFrames], [1.02, 1.12], clamp);
  const foregroundZoom = interpolate(
    frame,
    [0, durationInFrames],
    [0.985, 1.03],
    clamp,
  );
  const textY = interpolate(frame, [8, 34], [26, 0], clamp);
  const revealBlur = interpolate(
    frame,
    [0, 10, durationInFrames - 12, durationInFrames],
    [10, 0, 0, 8],
    clamp,
  );
  const parallaxX = interpolate(frame, [0, durationInFrames], [-32, 32], clamp);
  const parallaxY = interpolate(frame, [0, durationInFrames], [18, -18], clamp);
  const intensityWidth = `${Math.max(12, scene.emotionalIntensity * 10)}%`;
  const source = resolveAsset(photoSrc);
  const focusX = Math.max(0, Math.min(100, scene.compositionFocusX ?? 50));
  const focusY = Math.max(0, Math.min(100, scene.compositionFocusY ?? 42));

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#050307",
        opacity,
      }}
    >
      <AbsoluteFill>
        <Img
          src={source}
          style={{
            filter: "blur(26px) saturate(1.35) brightness(0.54)",
            height: "118%",
            left: "-9%",
            objectFit: "cover",
            position: "absolute",
            top: "-9%",
            transform: `translate(${parallaxX * -0.5}px, ${parallaxY * -0.5}px) scale(${zoom})`,
            width: "118%",
          }}
        />
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(circle at 20% 12%, rgba(239,68,68,0.32), transparent 28%), linear-gradient(90deg, rgba(5,3,7,0.88), rgba(5,3,7,0.28), rgba(5,3,7,0.9))",
        }}
      />
      <AbsoluteFill
        style={{
          alignItems: "center",
          display: "flex",
          justifyContent: "center",
          padding: 58,
        }}
      >
        <div
          style={{
            alignItems: "center",
            display: "flex",
            height: "100%",
            justifyContent: "center",
            position: "relative",
            transform: `translate(${parallaxX}px, ${parallaxY}px) scale(${foregroundZoom})`,
            width: "100%",
          }}
        >
          <Img
            src={source}
            style={{
              boxShadow: "0 30px 100px rgba(0,0,0,0.65)",
              filter: `blur(${revealBlur}px)`,
              height: "100%",
              objectFit: "cover",
              objectPosition: `${focusX}% ${focusY}%`,
              width: "100%",
            }}
          />
        </div>
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.08), transparent 34%, rgba(0,0,0,0.82))",
        }}
      />
      <div
        style={{
          bottom: 54,
          left: 66,
          position: "absolute",
          transform: `translateY(${textY}px)`,
          width: 720,
        }}
      >
        <div
          style={{
            color: "#fecaca",
            fontFamily: "Arial, sans-serif",
            fontSize: 18,
            fontWeight: 800,
            letterSpacing: 7,
            textTransform: "uppercase",
          }}
        >
          Scene {scene.sceneNumber} / {scene.startTime} - {scene.endTime}
        </div>
        <div
          style={{
            background: "rgba(255,255,255,0.16)",
            height: 5,
            marginTop: 16,
            overflow: "hidden",
            width: 240,
          }}
        >
          <div
            style={{
              background:
                "linear-gradient(90deg, #dc2626 0%, #fb7185 48%, #fbbf24 100%)",
              height: "100%",
              width: intensityWidth,
            }}
          />
        </div>
        <p
          style={{
            color: "white",
            fontFamily: "Arial, sans-serif",
            fontSize: 42,
            fontWeight: 900,
            lineHeight: 1.12,
            margin: "18px 0 0",
            textShadow: "0 10px 34px rgba(0,0,0,0.7)",
          }}
        >
          {scene.narrationLine}
        </p>
      </div>
    </AbsoluteFill>
  );
};

const TitleCard = ({
  title,
  tagline,
  trailerStyle,
}: {
  title: string;
  tagline: string;
  trailerStyle: string;
}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 18], [0, 1], clamp);
  const y = interpolate(frame, [0, 34], [26, 0], clamp);

  return (
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(circle at 22% 18%, rgba(239,68,68,0.34), transparent 28%), radial-gradient(circle at 80% 15%, rgba(251,191,36,0.2), transparent 28%), #050307",
        color: "white",
        justifyContent: "center",
        opacity,
        padding: 72,
      }}
    >
      <div style={{ transform: `translateY(${y}px)` }}>
        <p
          style={{
            color: "#fca5a5",
            fontFamily: "Arial, sans-serif",
            fontSize: 18,
            fontWeight: 900,
            letterSpacing: 8,
            textTransform: "uppercase",
          }}
        >
          CineLife Original / {trailerStyle}
        </p>
        <h1
          style={{
            fontFamily: "Arial, sans-serif",
            fontSize: 92,
            fontWeight: 950,
            lineHeight: 0.92,
            margin: "24px 0 0",
            maxWidth: 980,
          }}
        >
          {title}
        </h1>
        <p
          style={{
            color: "#d4d4d8",
            fontFamily: "Arial, sans-serif",
            fontSize: 30,
            fontWeight: 700,
            lineHeight: 1.3,
            marginTop: 30,
            maxWidth: 860,
          }}
        >
          {tagline}
        </p>
      </div>
    </AbsoluteFill>
  );
};

const CreditsCard = ({
  title,
  narrationLines,
}: {
  title: string;
  narrationLines: string[];
}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 20], [0, 1], clamp);

  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        background:
          "linear-gradient(135deg, #050307 0%, #1f080b 54%, #09090b 100%)",
        color: "white",
        display: "flex",
        justifyContent: "center",
        opacity,
        padding: 80,
        textAlign: "center",
      }}
    >
      <div>
        <p
          style={{
            color: "#fca5a5",
            fontFamily: "Arial, sans-serif",
            fontSize: 18,
            fontWeight: 900,
            letterSpacing: 8,
            textTransform: "uppercase",
          }}
        >
          Created with CineLife AI
        </p>
        <h2
          style={{
            fontFamily: "Arial, sans-serif",
            fontSize: 74,
            fontWeight: 950,
            lineHeight: 1,
            margin: "24px 0 0",
          }}
        >
          {title}
        </h2>
        {narrationLines.map((line) => (
          <p
            key={line}
            style={{
              color: "#d4d4d8",
              fontFamily: "Arial, sans-serif",
              fontSize: 24,
              fontWeight: 700,
              lineHeight: 1.35,
              margin: "18px auto 0",
              maxWidth: 840,
            }}
          >
            {line}
          </p>
        ))}
      </div>
    </AbsoluteFill>
  );
};

export const TrailerComposition = ({
  title,
  tagline,
  trailerStyle,
  photos,
  timeline,
  narrationScript,
  audioSrc,
  soundtrackSrc,
}: TrailerRenderProps) => {
  const { fps, durationInFrames } = useVideoConfig();
  const titleDuration = Math.round(3.4 * fps);
  const creditsDuration = Math.round(4.4 * fps);
  const transitionFrames = Math.round(0.55 * fps);
  const narrationLines = splitNarration(narrationScript);
  const timelineScenes = timeline.length ? timeline : [];
  const sceneStarts = timelineScenes.map((scene, index) => {
    if (index === 0) {
      return titleDuration - transitionFrames;
    }

    return Math.max(0, Math.round(toSeconds(scene.startTime) * fps));
  });

  return (
    <AbsoluteFill style={{ backgroundColor: "#050307" }}>
      {soundtrackSrc ? (
        <Audio
          loop
          src={resolveAsset(soundtrackSrc)}
          volume={(frame) =>
            interpolate(
              frame,
              [0, Math.round(2 * fps), durationInFrames - Math.round(5 * fps), durationInFrames],
              [0, audioSrc ? 0.18 : 0.42, audioSrc ? 0.14 : 0.36, 0],
              clamp,
            )
          }
        />
      ) : null}
      {audioSrc ? (
        <Audio src={resolveAsset(audioSrc)} volume={0.96} />
      ) : null}
      <Sequence durationInFrames={titleDuration} from={0} premountFor={fps}>
        <TitleCard
          tagline={tagline}
          title={title}
          trailerStyle={trailerStyle}
        />
      </Sequence>
      {timelineScenes.map((scene, index) => {
        const sceneStart = sceneStarts[index];
        const nextStart = sceneStarts[index + 1];
        const fallbackDuration = Math.max(
          Math.round((toSeconds(scene.endTime) - toSeconds(scene.startTime)) * fps),
          Math.round(3 * fps),
        );
        const duration = nextStart
          ? Math.max(Math.round(2.4 * fps), nextStart - sceneStart + transitionFrames)
          : Math.max(
              Math.round(3.2 * fps),
              durationInFrames - creditsDuration - sceneStart,
              fallbackDuration,
            );
        const photo = photos[index % Math.max(1, photos.length)] ?? photos[0];

        if (!photo) {
          return null;
        }

        return (
          <Sequence
            durationInFrames={duration}
            from={sceneStart}
            key={`${scene.sceneNumber}-${scene.startTime}`}
            premountFor={fps}
          >
            <SceneFrame
              durationInFrames={duration}
              photoSrc={photo.src}
              scene={scene}
            />
          </Sequence>
        );
      })}
      <Sequence
        durationInFrames={creditsDuration}
        from={Math.max(0, durationInFrames - creditsDuration)}
        premountFor={fps}
      >
        <CreditsCard narrationLines={narrationLines} title={title} />
      </Sequence>
    </AbsoluteFill>
  );
};
