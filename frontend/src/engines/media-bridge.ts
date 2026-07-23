/**
 * engines/media-bridge.ts
 * --------------------------------------------------------------------
 * MediaBridge — the native VLC bridge contract. Engines depend ONLY
 * on this contract; the impl lives in `storage/impl/*` (or a native
 * addon path) and is swapped in production. The in-memory stub
 * (MemoryMediaBridge) returns canned frames + a fake transcript so
 * the canvas renders without a real libvlc binary.
 *
 * Invariant (Governor Canon): the bridge NEVER touches CDP. It is a
 * media-only contract; ChromeGovernor remains the only CDP touchpoint.
 */

import type { TranscriptBlock } from '../shared/media';

export interface MediaBridgePlayOptions {
  positionSec: number;
  rate: number;
  volume: number;
}

export interface MediaBridgeExtractOptions {
  width?: number;
  height?: number;
}

export interface MediaBridgeTranscribeOptions {
  language?: string;
  diarize?: boolean;
}

export interface FrameThumb {
  index: number;
  timeSec: number;
  dataUrl: string;
  width: number;
  height: number;
}

export interface MediaBridge {
  /** Start playback at the given position. Never blocks the event loop. */
  play(sourceUrl: string, opts: MediaBridgePlayOptions): Promise<void>;
  /** Pause playback. */
  pause(sourceUrl: string): Promise<void>;
  /** Seek to a position in seconds. */
  seek(sourceUrl: string, positionSec: number): Promise<void>;
  /** Extract a single frame as a base64 data URL (PNG). */
  extractFrame(
    sourceUrl: string,
    timeSec: number,
    opts?: MediaBridgeExtractOptions,
  ): Promise<FrameThumb>;
  /** Transcribe the audio track. Returns TranscriptBlocks. */
  transcribe(
    sourceUrl: string,
    opts?: MediaBridgeTranscribeOptions,
  ): Promise<TranscriptBlock[]>;
}

/**
 * MemoryMediaBridge — stub for dev/test. Returns a canned frame and a
 * deterministic fake transcript. Production swaps in `VlcMediaBridge`
 * (a native addon binding to libvlc) with zero engine changes.
 */
export class MemoryMediaBridge implements MediaBridge {
  async play(_sourceUrl: string, _opts: MediaBridgePlayOptions): Promise<void> {
    // no-op in memory
  }

  async pause(_sourceUrl: string): Promise<void> {
    // no-op
  }

  async seek(_sourceUrl: string, _positionSec: number): Promise<void> {
    // no-op
  }

  async extractFrame(
    _sourceUrl: string,
    timeSec: number,
    opts?: MediaBridgeExtractOptions,
  ): Promise<FrameThumb> {
    const w = opts?.width ?? 320;
    const h = opts?.height ?? 180;
    // 1x1 transparent PNG, repeated as a placeholder data URL.
    const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
    return {
      index: Math.floor(timeSec),
      timeSec,
      dataUrl: png,
      width: w,
      height: h,
    };
  }

  async transcribe(
    _sourceUrl: string,
    opts?: MediaBridgeTranscribeOptions,
  ): Promise<TranscriptBlock[]> {
    // Return a deterministic 3-block transcript.
    const blocks: TranscriptBlock[] = [
      { index: 0, startSec: 0, endSec: 3.2, text: '[transcript stub] Welcome to the Vivim media engine.', confidence: 0.92, speaker: opts?.diarize ? 'Speaker 1' : undefined },
      { index: 1, startSec: 3.2, endSec: 7.8, text: '[transcript stub] This transcript was synthesized by MemoryMediaBridge.', confidence: 0.88, speaker: opts?.diarize ? 'Speaker 1' : undefined },
      { index: 2, startSec: 7.8, endSec: 12.0, text: '[transcript stub] Production swaps in a real libvlc bridge.', confidence: 0.85, speaker: opts?.diarize ? 'Speaker 2' : undefined },
    ];
    return blocks;
  }
}
