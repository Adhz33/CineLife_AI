type SoundtrackOptions = {
  durationSeconds: number;
  style: string;
};

const sampleRate = 22050;

function clampSample(value: number) {
  return Math.max(-1, Math.min(1, value));
}

function styleSeed(style: string) {
  return Array.from(style).reduce(
    (seed, character) => seed + character.charCodeAt(0),
    0,
  );
}

function envelope(time: number, duration: number) {
  const fadeIn = Math.min(1, time / 3);
  const fadeOut = Math.min(1, (duration - time) / 4);
  return Math.max(0, Math.min(fadeIn, fadeOut));
}

function writeAscii(buffer: Buffer, offset: number, value: string) {
  buffer.write(value, offset, value.length, "ascii");
}

export function generateCinematicSoundtrack({
  durationSeconds,
  style,
}: SoundtrackOptions) {
  const duration = Math.max(30, Math.min(60, durationSeconds));
  const frames = Math.ceil(duration * sampleRate);
  const dataSize = frames * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  const seed = styleSeed(style);
  const base = 65 + (seed % 18);
  const fifth = base * 1.5;
  const octave = base * 2;
  const styleLower = style.toLowerCase();
  const tension = styleLower.includes("thriller") || styleLower.includes("horror");
  const brightness = styleLower.includes("inspirational") || styleLower.includes("motivational");

  writeAscii(buffer, 0, "RIFF");
  buffer.writeUInt32LE(36 + dataSize, 4);
  writeAscii(buffer, 8, "WAVE");
  writeAscii(buffer, 12, "fmt ");
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  writeAscii(buffer, 36, "data");
  buffer.writeUInt32LE(dataSize, 40);

  for (let index = 0; index < frames; index += 1) {
    const time = index / sampleRate;
    const progress = time / duration;
    const rise = 1 + progress * (tension ? 1.1 : 0.55);
    const pulseGate = Math.pow(Math.sin(time * Math.PI * (tension ? 1.6 : 0.75)), 8);
    const riser = Math.sin(2 * Math.PI * (180 + progress * 950) * time) * progress;
    const pad =
      Math.sin(2 * Math.PI * base * time) * 0.28 +
      Math.sin(2 * Math.PI * fifth * time) * 0.16 +
      Math.sin(2 * Math.PI * octave * time * rise) * 0.08;
    const pianoHit =
      Math.sin(2 * Math.PI * (brightness ? 392 : 220) * time) *
      Math.exp(-((time % 4.8) * 2.4)) *
      0.14;
    const boom =
      Math.sin(2 * Math.PI * 43 * time) *
      Math.exp(-((time % 9.5) * 3.2)) *
      0.42;
    const silenceDip =
      progress > 0.43 && progress < 0.49 ? 0.28 : progress > 0.72 && progress < 0.76 ? 0.38 : 1;
    const sample =
      (pad + pianoHit + boom + riser * 0.045 + pulseGate * 0.08) *
      envelope(time, duration) *
      silenceDip *
      (tension ? 0.82 : 0.9);

    buffer.writeInt16LE(Math.round(clampSample(sample) * 32767), 44 + index * 2);
  }

  return buffer;
}
