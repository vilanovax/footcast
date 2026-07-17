import type { TtsProvider, TtsSynthesizeRequest, TtsSynthesizeResult } from './types.js';
import { buildToneWav } from './wav.js';

/** Offline TTS — writes a short playable WAV; reports script duration separately. */
export class MockTtsProvider implements TtsProvider {
  readonly name = 'mock';

  async synthesize(request: TtsSynthesizeRequest): Promise<TtsSynthesizeResult> {
    const reportedDurationSec = Math.max(
      30,
      Math.round(request.targetDurationSec ?? estimateFromText(request.text)),
    );
    // Keep mock files small but playable (3–12s).
    const playableSec = Math.min(12, Math.max(3, Math.round(reportedDurationSec / 60)));
    const audioBuffer = buildToneWav({ durationSec: playableSec, frequencyHz: 392 });

    return {
      provider: this.name,
      model: 'mock-tone-v1',
      voiceId: request.voiceId ?? 'mock-fa-host',
      mimeType: 'audio/wav',
      audioBuffer,
      durationSec: playableSec,
      reportedDurationSec,
      sampleRate: 22050,
    };
  }
}

function estimateFromText(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.round((words / 145) * 60);
}
