/**
 * storage/contracts/media-store.ts
 * --------------------------------------------------------------------
 * MediaCard store. Transcripts + thumbnails persist alongside the card.
 */

import type {
  MediaCard,
  TranscriptBlock,
  FrameThumb,
} from '../../shared/media';

export interface MediaStore {
  get(id: string): Promise<MediaCard | null>;
  getBySlug(slug: string): Promise<MediaCard | null>;
  list(filter?: { workspaceId?: string; kind?: string }): Promise<MediaCard[]>;
  open(input: {
    title: string;
    kind: MediaCard['kind'];
    sourceUrl: string;
    mimeType: string;
    durationSec?: number;
    workspaceId?: string;
  }): Promise<MediaCard>;
  update(id: string, patch: Partial<MediaCard>): Promise<MediaCard>;
  /** Replace the transcript blocks (from MediaEngine.transcribe). */
  setTranscript(id: string, blocks: TranscriptBlock[]): Promise<void>;
  /** Append a frame thumbnail (from MediaEngine.extractFrame). */
  addThumbnail(id: string, thumb: FrameThumb): Promise<void>;
  addAnnotation(id: string, annotationId: string): Promise<void>;
  remove(id: string): Promise<boolean>;
}
