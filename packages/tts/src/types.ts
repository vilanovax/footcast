export interface TtsSynthesizeRequest {
  text: string;
  voiceId?: string;
  language?: string;
  /** Reported episode duration; mock may generate a shorter playable sample. */
  targetDurationSec?: number;
}

export interface TtsSynthesizeResult {
  provider: string;
  model: string;
  voiceId: string;
  mimeType: string;
  /** Actual audio bytes written (playable). */
  audioBuffer: Buffer;
  /** Duration of the generated audio file. */
  durationSec: number;
  /** Logical duration for the episode (from script estimate). */
  reportedDurationSec: number;
  sampleRate: number;
}

export interface TtsProvider {
  readonly name: string;
  synthesize(request: TtsSynthesizeRequest): Promise<TtsSynthesizeResult>;
}
