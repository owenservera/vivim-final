/**
 * storage/impl/memory-media-store.ts
 */

import type { MediaCard, TranscriptBlock, FrameThumb } from '../../shared/media';
import type { MediaStore } from '../contracts/media-store';

export class MemoryMediaStore implements MediaStore {
  private rows = new Map<string, MediaCard>();
  private bySlug = new Map<string, string>();

  async get(id: string): Promise<MediaCard | null> {
    return this.rows.get(id) ?? null;
  }

  async getBySlug(slug: string): Promise<MediaCard | null> {
    const id = this.bySlug.get(slug);
    return id ? (this.rows.get(id) ?? null) : null;
  }

  async list(filter?: { workspaceId?: string; kind?: string }): Promise<MediaCard[]> {
    const all = [...this.rows.values()];
    return all.filter((r) => {
      if (filter?.workspaceId && r.workspaceId !== filter.workspaceId) return false;
      if (filter?.kind && r.kind !== filter.kind) return false;
      return true;
    });
  }

  async open(input: {
    title: string;
    kind: MediaCard['kind'];
    sourceUrl: string;
    mimeType: string;
    durationSec?: number;
    workspaceId?: string;
  }): Promise<MediaCard> {
    const now = Date.now();
    const slug = input.title.toLowerCase().replace(/\s+/g, '-').slice(0, 64);
    const id = `media:${slug}:${now.toString(36)}`;
    const engine: MediaCard['engine'] =
      input.kind === 'image' ? 'image' : input.kind === 'audio' ? 'html5' : 'vlc';
    const card: MediaCard = {
      id,
      slug,
      title: input.title,
      kind: input.kind,
      engine,
      sourceUrl: input.sourceUrl,
      durationSec: input.durationSec ?? 0,
      positionSec: 0,
      mimeType: input.mimeType,
      isPlaying: false,
      volume: 0.8,
      rate: 1.0,
      transcript: [],
      thumbnails: [],
      workspaceId: input.workspaceId ?? null,
      engineRef: `engine:media:${engine}`,
      capabilities: ['cap:media:play', 'cap:media:pause', 'cap:media:seek', 'cap:media:extract_frame', 'cap:media:transcribe'],
      annotations: [],
      createdAt: now,
      updatedAt: now,
    };
    this.rows.set(id, card);
    this.bySlug.set(slug, id);
    return card;
  }

  async update(id: string, patch: Partial<MediaCard>): Promise<MediaCard> {
    const existing = this.rows.get(id);
    if (!existing) throw new Error(`Media not found: ${id}`);
    const updated: MediaCard = {
      ...existing,
      ...patch,
      id: existing.id,
      updatedAt: Date.now(),
    };
    this.rows.set(id, updated);
    return updated;
  }

  async setTranscript(id: string, blocks: TranscriptBlock[]): Promise<void> {
    const existing = this.rows.get(id);
    if (!existing) return;
    existing.transcript = blocks;
    existing.updatedAt = Date.now();
  }

  async addThumbnail(id: string, thumb: FrameThumb): Promise<void> {
    const existing = this.rows.get(id);
    if (!existing) return;
    existing.thumbnails.push(thumb);
    existing.updatedAt = Date.now();
  }

  async addAnnotation(id: string, annotationId: string): Promise<void> {
    const existing = this.rows.get(id);
    if (!existing) return;
    if (!existing.annotations.includes(annotationId)) {
      existing.annotations.push(annotationId);
      existing.updatedAt = Date.now();
    }
  }

  async remove(id: string): Promise<boolean> {
    const row = this.rows.get(id);
    if (!row) return false;
    this.bySlug.delete(row.slug);
    return this.rows.delete(id);
  }
}
