/**
 * engines/media-engine.ts
 * --------------------------------------------------------------------
 * Video / Audio engine. Wraps libvlc / vlc behind a contract —
 * `MediaBridge` — so the event loop is NEVER blocked. Production swaps
 * in a real libvlc node binding; the in-memory stub returns canned
 * frames + a fake transcript so the canvas renders without a binary.
 *
 * Transcripts feed the existing ConversationMessage / StreamBlock
 * store (Phase 2 §1).
 *
 * Capabilities:
 *   - cap:media:play
 *   - cap:media:pause
 *   - cap:media:seek
 *   - cap:media:extract_frame
 *   - cap:media:transcribe
 */

import type { CapabilityEventBus } from './capability-event-bus';
import type { StructuredLogger } from './structured-logger';
import type {
  MediaCard,
  TranscriptBlock,
  FrameThumb,
  MediaPlayInput,
  MediaSeekInput,
  MediaExtractFrameInput,
  MediaTranscribeInput,
  MediaTranscribeOutput,
} from '../shared/media';
import type { MediaStore } from '../storage/contracts/media-store';
import type { MediaBridge } from './media-bridge';

export interface MediaEngineDeps {
  mediaStore: MediaStore;
  eventBus: CapabilityEventBus;
  logger: StructuredLogger;
  bridge: MediaBridge;
}

export class MediaEngine {
  constructor(private deps: MediaEngineDeps) {}

  /** Open a new media card. */
  async open(input: {
    title: string;
    kind: MediaCard['kind'];
    sourceUrl: string;
    mimeType: string;
    durationSec?: number;
    workspaceId?: string;
  }): Promise<MediaCard> {
    const card = await this.deps.mediaStore.open(input);
    this.deps.eventBus.emit({
      type: 'media:opened',
      mediaId: card.id,
      title: card.title,
      kind: card.kind,
      engineRef: card.engineRef,
    });
    return card;
  }

  async play(input: MediaPlayInput): Promise<MediaCard | null> {
    const card = await this.deps.mediaStore.get(input.mediaId);
    if (!card) return null;
    const positionSec = input.positionSec ?? card.positionSec;
    const rate = input.rate ?? card.rate;
    const volume = input.volume ?? card.volume;
    await this.deps.bridge.play(card.sourceUrl, { positionSec, rate, volume });
    const updated = await this.deps.mediaStore.update(input.mediaId, {
      isPlaying: true,
      positionSec,
      rate,
      volume,
    });
    this.deps.eventBus.emit({ type: 'media:played', mediaId: input.mediaId, positionSec });
    return updated;
  }

  async pause(mediaId: string): Promise<MediaCard | null> {
    const card = await this.deps.mediaStore.get(mediaId);
    if (!card) return null;
    await this.deps.bridge.pause(card.sourceUrl);
    const updated = await this.deps.mediaStore.update(mediaId, { isPlaying: false });
    this.deps.eventBus.emit({ type: 'media:paused', mediaId });
    return updated;
  }

  async seek(input: MediaSeekInput): Promise<MediaCard | null> {
    const card = await this.deps.mediaStore.get(input.mediaId);
    if (!card) return null;
    await this.deps.bridge.seek(card.sourceUrl, input.positionSec);
    const updated = await this.deps.mediaStore.update(input.mediaId, {
      positionSec: input.positionSec,
    });
    this.deps.eventBus.emit({
      type: 'media:seeked',
      mediaId: input.mediaId,
      positionSec: input.positionSec,
    });
    return updated;
  }

  async extractFrame(input: MediaExtractFrameInput): Promise<FrameThumb | null> {
    const card = await this.deps.mediaStore.get(input.mediaId);
    if (!card) return null;
    const thumb = await this.deps.bridge.extractFrame(card.sourceUrl, input.timeSec, {
      width: input.width,
      height: input.height,
    });
    await this.deps.mediaStore.addThumbnail(input.mediaId, thumb);
    this.deps.eventBus.emit({
      type: 'media:frame_extracted',
      mediaId: input.mediaId,
      timeSec: input.timeSec,
    });
    return thumb;
  }

  /**
   * Transcribe the media's audio track. Returns TranscriptBlocks and
   * creates StreamBlock rows in the ConversationMessage store (the
   * caller wires the ConversationManager; here we just return blocks).
   */
  async transcribe(input: MediaTranscribeInput): Promise<MediaTranscribeOutput> {
    const card = await this.deps.mediaStore.get(input.mediaId);
    if (!card) throw new Error(`Media not found: ${input.mediaId}`);
    const blocks = await this.deps.bridge.transcribe(card.sourceUrl, {
      language: input.language,
      diarize: input.diarize,
    });
    await this.deps.mediaStore.setTranscript(input.mediaId, blocks);
    this.deps.eventBus.emit({
      type: 'media:transcribed',
      mediaId: input.mediaId,
      blockCount: blocks.length,
    });
    return {
      mediaId: input.mediaId,
      blocks,
      streamBlockIds: [], // caller (ConversationManager) creates the StreamBlock rows
    };
  }

  /** Capability dispatcher. */
  async dispatch(
    capabilityId: string,
    input: Record<string, unknown>,
  ): Promise<unknown> {
    switch (capabilityId) {
      case 'cap:media:play':
        return this.play({
          mediaId: String(input.mediaId),
          positionSec: typeof input.positionSec === 'number' ? input.positionSec : undefined,
          rate: typeof input.rate === 'number' ? input.rate : undefined,
          volume: typeof input.volume === 'number' ? input.volume : undefined,
        });
      case 'cap:media:pause':
        return this.pause(String(input.mediaId));
      case 'cap:media:seek':
        return this.seek({ mediaId: String(input.mediaId), positionSec: Number(input.positionSec) });
      case 'cap:media:extract_frame':
        return this.extractFrame({
          mediaId: String(input.mediaId),
          timeSec: Number(input.timeSec),
          width: typeof input.width === 'number' ? input.width : undefined,
          height: typeof input.height === 'number' ? input.height : undefined,
        });
      case 'cap:media:transcribe':
        return this.transcribe({
          mediaId: String(input.mediaId),
          language: input.language ? String(input.language) : undefined,
          diarize: input.diarize === true,
        });
      default:
        throw new Error(`media-engine: unknown capability ${capabilityId}`);
    }
  }

  static capabilities(): string[] {
    return [
      'cap:media:play',
      'cap:media:pause',
      'cap:media:seek',
      'cap:media:extract_frame',
      'cap:media:transcribe',
    ];
  }
}

export type { TranscriptBlock };
