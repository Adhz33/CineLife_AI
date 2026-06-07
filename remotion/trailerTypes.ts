export type TrailerTimelineScene = {
  sceneNumber: number;
  startTime: string;
  endTime: string;
  visualCue: string;
  narrationLine: string;
  cameraMotion?: string;
  compositionFocusX?: number;
  compositionFocusY?: number;
  emotionalIntensity: number;
};

export type TrailerRenderPhoto = {
  src: string;
  name: string;
};

export type TrailerRenderProps = {
  title: string;
  tagline: string;
  trailerStyle: string;
  photos: TrailerRenderPhoto[];
  timeline: TrailerTimelineScene[];
  narrationScript: string;
  audioSrc?: string;
  audioDurationSeconds?: number;
  soundtrackSrc?: string;
  fps: number;
};

export const defaultTrailerRenderProps: TrailerRenderProps = {
  title: "CineLife Trailer",
  tagline: "A life trailer generated from uploaded memories.",
  trailerStyle: "Inspirational",
  photos: [],
  timeline: [
    {
      sceneNumber: 1,
      startTime: "00:00",
      endTime: "00:08",
      visualCue: "Opening frame",
      narrationLine: "Every life begins with a frame worth remembering.",
      emotionalIntensity: 5,
    },
  ],
  narrationScript: "Every life begins with a frame worth remembering.",
  fps: 30,
};
