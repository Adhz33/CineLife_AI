import { Composition, CalculateMetadataFunction } from "remotion";
import {
  defaultTrailerRenderProps,
  TrailerRenderProps,
} from "./trailerTypes";
import { TrailerComposition } from "./TrailerComposition";

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

const calculateMetadata: CalculateMetadataFunction<TrailerRenderProps> = ({
  props,
}) => {
  const lastTimelineSecond = props.timeline.reduce((latestTime, scene) => {
    return Math.max(latestTime, toSeconds(scene.endTime));
  }, 0);
  const durationInSeconds = Math.max(
    30,
    Math.min(
      60,
      Math.max(lastTimelineSecond + 7, (props.audioDurationSeconds ?? 0) + 3),
    ),
  );

  return {
    durationInFrames: Math.ceil(durationInSeconds * props.fps),
    fps: props.fps,
    width: 1920,
    height: 1080,
    props,
  };
};

export const RemotionRoot = () => {
  return (
    <Composition
      calculateMetadata={calculateMetadata}
      component={TrailerComposition}
      defaultProps={defaultTrailerRenderProps}
      durationInFrames={900}
      fps={30}
      height={1080}
      id="CineLifeTrailer"
      width={1920}
    />
  );
};
