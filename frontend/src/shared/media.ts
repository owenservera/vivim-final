/**
 * shared/media.ts
 * --------------------------------------------------------------------
 * Video / Audio card types. The MediaEngine wraps libvlc / vlc behind a
 * contract (never blocks the event loop). Transcripts feed the existing
 * ConversationMessage / StreamBlock store.
 *
 * The native VLC bridge lives behind `MediaBridge` (contract); engines
 * depend only on the contract, never on the native binding. Production
 * swaps in a real libvlc node binding; the in-memory stub returns canned
 * frames + a fake transcript so the canvas renders without a binary.
 */

export type MediaKind = 'video' | 'audio' | 'image' | 'stream';

export type MediaEngine = 'vlc' | 'html5' | 'webcodecs' | 'image';

export interface MediaCard {
  id: string;
  slug: string;
  title: string;
  kind: MediaKind;
  engine: MediaEngine | string;
  sourceUrl: string;
  /** Duration in seconds (0 if unknown). */
  durationSec: number;
  /** Current playback position in seconds. */
  positionSec: number;
  /** Mime type (video/mp4, audio/mpeg, etc.). */
  mimeType: string;
  /** Whether the media is currently playing. */
  isPlaying: boolean;
  /** Volume 0..1. */
  volume: number;
  /** Playback rate (1 = normal). */
  rate: number;
  /** Transcript blocks (from ASR via MediaEngine.transcribe). */
  transcript: TranscriptBlock[];
  /** Frame thumbnails (extracted via MediaEngine.extractFrame). */
  thumbnails: FrameThumb[];
  /** Workspace this media belongs to. */
  workspaceId: string | null;
  /** Engine reference — plugins can hot-swap. */
  engineRef: string; // e.g. 'engine:media:vlc'
  capabilities: string[];
  annotations: string[];
  createdAt: number;
  updatedAt: number;
}

export interface TranscriptBlock {
  index: number;
  startSec: number;
  endSec: number;
  text: string;
  /** Confidence 0..1 (from ASR). */
  confidence?: number;
  /** Optional speaker label (diarization). */
  speaker?: string;
}

export interface FrameThumb {
  index: number;
  timeSec: number;
  dataUrl: string; // base64 PNG/JPEG
  width: number;
  height: number;
}

export interface MediaPlayInput {
  mediaId: string;
  positionSec?: number;
  rate?: number;
  volume?: number;
}

export interface MediaSeekInput {
  mediaId: string;
  positionSec: number;
}

export interface MediaExtractFrameInput {
  mediaId: string;
  timeSec: number;
  width?: number;
  height?: number;
}

export interface MediaTranscribeInput {
  mediaId: string;
  language?: string;
  /** Diarize speakers when true. */
  diarize?: boolean;
}

export interface MediaTranscribeOutput {
  mediaId: string;
  blocks: TranscriptBlock[];
  /** StreamBlock ids created in the ConversationMessage store. */
  streamBlockIds: string[];
}
