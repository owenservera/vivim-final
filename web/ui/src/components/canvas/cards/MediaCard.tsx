'use client';

/**
 * components/canvas/cards/MediaCard.tsx
 * --------------------------------------------------------------------
 * Video / Audio / Image card. Renders a MediaCard row with native
 * HTML5 controls (the prototype). Production swaps in the VLC bridge
 * via the engineRef for frame-extraction + ASR transcription.
 *
 * The transcript pane shows TranscriptBlocks (from MediaEngine.transcribe).
 */

import { useEffect, useRef, useState } from 'react';
import type { MediaCard as MediaCardRow } from '../../../shared/media';

export interface MediaCardProps {
  media: MediaCardRow;
  onPlay?: (mediaId: string, positionSec: number) => void;
  onPause?: (mediaId: string) => void;
  onSeek?: (mediaId: string, positionSec: number) => void;
  onTranscribe?: (mediaId: string) => void;
}

export function MediaCard({ media, onPlay, onPause, onSeek, onTranscribe }: MediaCardProps) {
  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null);
  const [showTranscript, setShowTranscript] = useState(false);

  useEffect(() => {
    const el = mediaRef.current;
    if (!el) return;
    const onTime = () => {
      // Don't fire onSeek on every frame — only on explicit user seeks.
    };
    el.addEventListener('timeupdate', onTime);
    return () => el.removeEventListener('timeupdate', onTime);
  }, []);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        background: 'white',
      }}
    >
      <header
        style={{
          padding: '6px 10px',
          borderBottom: '1px solid #e5e7eb',
          background: '#f9fafb',
          fontSize: 11,
          color: '#374151',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <strong style={{ fontSize: 12 }}>{media.title}</strong>
          <span
            style={{
              padding: '1px 6px',
              borderRadius: 4,
              background:
                media.engine === 'vlc'
                  ? '#fef3c7'
                  : media.engine === 'html5'
                    ? '#d1fae5'
                    : '#e5e7eb',
              color: '#374151',
              fontSize: 10,
              fontWeight: 600,
            }}
          >
            {media.engine}
          </span>
        </div>
        <div style={{ marginTop: 2, fontSize: 10, color: '#6b7280' }}>
          {media.kind} · {media.mimeType}
          {media.durationSec ? ` · ${Math.round(media.durationSec)}s` : ''}
        </div>
      </header>

      <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
        {media.kind === 'video' && (
          <video
            ref={mediaRef as React.RefObject<HTMLVideoElement>}
            src={media.sourceUrl}
            controls
            style={{ width: '100%', borderRadius: 4, background: '#000' }}
            onPlay={() => onPlay?.(media.id, media.positionSec)}
            onPause={() => onPause?.(media.id)}
            onSeeked={(e) => onSeek?.(media.id, (e.target as HTMLVideoElement).currentTime)}
          />
        )}
        {media.kind === 'audio' && (
          <div style={{ padding: 16, background: '#f3f4f6', borderRadius: 4 }}>
            <div style={{ fontSize: 32, textAlign: 'center', marginBottom: 8 }}>🎧</div>
            <audio
              ref={mediaRef as React.RefObject<HTMLAudioElement>}
              src={media.sourceUrl}
              controls
              style={{ width: '100%' }}
              onPlay={() => onPlay?.(media.id, media.positionSec)}
              onPause={() => onPause?.(media.id)}
              onSeeked={(e) => onSeek?.(media.id, (e.target as HTMLAudioElement).currentTime)}
            />
          </div>
        )}
        {media.kind === 'image' && (
          <img src={media.sourceUrl} alt={media.title} style={{ width: '100%', borderRadius: 4 }} />
        )}
        {media.kind === 'stream' && (
          <div style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📡</div>
            <div>Live stream</div>
            <div style={{ fontSize: 11 }}>{media.sourceUrl}</div>
          </div>
        )}

        {/* Thumbnails (from MediaEngine.extractFrame) */}
        {media.thumbnails.length > 0 && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
              gap: 4,
              marginTop: 8,
            }}
          >
            {media.thumbnails.map((t) => (
              <div key={t.index} style={{ position: 'relative' }}>
                <img
                  src={t.dataUrl}
                  alt={`frame ${t.index}`}
                  style={{ width: '100%', borderRadius: 2, display: 'block' }}
                />
                <span
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    background: 'rgba(0,0,0,0.7)',
                    color: 'white',
                    fontSize: 9,
                    padding: '1px 4px',
                  }}
                >
                  {t.timeSec.toFixed(1)}s
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {showTranscript && media.transcript.length > 0 && (
        <div
          style={{
            maxHeight: 140,
            overflowY: 'auto',
            padding: '6px 10px',
            borderTop: '1px solid #e5e7eb',
            background: '#fefce8',
            fontSize: 11,
            lineHeight: 1.5,
          }}
        >
          {media.transcript.map((b) => (
            <div key={b.index} style={{ marginBottom: 4 }}>
              <span style={{ color: '#6b7280', fontFamily: 'ui-monospace, monospace', marginRight: 6 }}>
                {formatTime(b.startSec)}–{formatTime(b.endSec)}
              </span>
              {b.speaker && <strong style={{ marginRight: 4 }}>{b.speaker}:</strong>}
              {b.text}
            </div>
          ))}
        </div>
      )}

      <footer
        style={{
          padding: '4px 10px',
          borderTop: '1px solid #e5e7eb',
          background: '#f9fafb',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: 10,
          color: '#6b7280',
        }}
      >
        <span>
          engineRef: <code>{media.engineRef}</code>
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          {media.transcript.length > 0 && (
            <button onClick={() => setShowTranscript((s) => !s)} style={btnStyle}>
              {showTranscript ? 'Hide' : 'Show'} transcript ({media.transcript.length})
            </button>
          )}
          {media.transcript.length === 0 && (
            <button onClick={() => onTranscribe?.(media.id)} style={btnStyle}>
              Transcribe
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const btnStyle: React.CSSProperties = {
  padding: '2px 8px',
  border: '1px solid #d1d5db',
  background: 'white',
  borderRadius: 3,
  fontSize: 10,
  cursor: 'pointer',
};
