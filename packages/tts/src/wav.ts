/** Build a mono 16-bit PCM WAV buffer with a soft tone + silence. */
export function buildToneWav(options: {
  durationSec: number;
  sampleRate?: number;
  frequencyHz?: number;
}): Buffer {
  const sampleRate = options.sampleRate ?? 22050;
  const frequencyHz = options.frequencyHz ?? 440;
  const durationSec = Math.max(0.4, Math.min(options.durationSec, 45));
  const numSamples = Math.floor(sampleRate * durationSec);
  const dataSize = numSamples * 2;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // mono
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < numSamples; i += 1) {
    const t = i / sampleRate;
    // Soft beep bursts every ~1.2s so the file is audibly "alive" in players.
    const burst = Math.floor(t * 0.85) % 2 === 0 ? 1 : 0.08;
    const envelope = Math.min(1, t * 4) * Math.min(1, (durationSec - t) * 4);
    const sample = Math.sin(2 * Math.PI * frequencyHz * t) * 0.25 * burst * envelope;
    const intSample = Math.max(-32767, Math.min(32767, Math.floor(sample * 32767)));
    buffer.writeInt16LE(intSample, 44 + i * 2);
  }

  return buffer;
}
