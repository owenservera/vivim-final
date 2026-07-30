'use client';

/**
 * components/chat/SurfaceContent.tsx
 * --------------------------------------------------------------------
 * Renders the content for each surface type.
 * Extracted from page.tsx to reduce monolith complexity.
 */

import { useEffect, useState } from 'react';
import {
  DrawerSystem,
  ChatSurface,
  DocCard,
  MediaCard,
  AutomationCard,
  AgentCard,
  ShellCard,
  DocEditor,
  ZLayerPanel,
  AuditDashboard,
  RbacManager,
  TemplatesGallery,
} from '@/components/canvas';
import { CapabilityCatalog } from '@/components/chat/CapabilityCatalog';
import { HealthDashboard } from '@/components/chat/HealthDashboard';
import { MemoryBrowser } from '@/components/memory/MemoryBrowser';
import type { DocumentCard as DocumentCardRow } from '@/shared/document';
import type { MediaCard as MediaCardRow } from '@/shared/media';
import type { AutomationDefinition } from '@/shared/automation';
import type { AgentDefinition } from '@/shared/agent';
import { useIO } from '@/components/canvas/UnifiedIOProvider';

// Local card components (previously in page.tsx)
function CardGrid({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        padding: 16,
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
        gap: 16,
        overflowY: 'auto',
      }}
    >
      {children}
    </div>
  );
}

function CardFrame({
  title,
  badge,
  children,
}: {
  title: string;
  badge: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: 320,
        borderRadius: 8,
        border: '1px solid var(--border)',
        background: 'var(--bg-elevated)',
        boxShadow: 'var(--shadow)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '6px 10px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg-subtle)',
          fontSize: 11,
          color: 'var(--text-muted)',
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        <strong style={{ color: 'var(--text)' }}>{title}</strong>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10 }}>{badge}</span>
      </div>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}

function EmptyCard({ label }: { label: string }) {
  return (
    <div
      style={{
        gridColumn: '1 / -1',
        padding: 48,
        textAlign: 'center',
        color: 'var(--text-subtle)',
        fontSize: 13,
      }}
    >
      {label}
    </div>
  );
}

interface SurfaceContentProps {
  activeSurface: string;
  workspaceId: string;
  providerIds: string[];
  setWorkspace: (id: string) => void;
  setActiveSurface: (surface: string) => void;
}

export function SurfaceContent({
  activeSurface,
  workspaceId,
  providerIds,
  setWorkspace,
  setActiveSurface,
}: SurfaceContentProps) {
  const [docs, setDocs] = useState<DocumentCardRow[]>([]);
  const [medias, setMedias] = useState<MediaCardRow[]>([]);
  const [automations, setAutomations] = useState<AutomationDefinition[]>([]);
  const [agents, setAgents] = useState<AgentDefinition[]>([]);
  const io = useIO();

  // Fetch documents
  useEffect(() => {
    if (activeSurface !== 'docs' && activeSurface !== 'editor') return;
    let cancelled = false;
    io.get<{ ok: boolean; documents: DocumentCardRow[] }>('/api/documents')
      .then((res) => {
        if (!cancelled && res.data?.ok) setDocs(res.data.documents);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [activeSurface, io]);

  // Fetch media
  useEffect(() => {
    if (activeSurface !== 'media') return;
    let cancelled = false;
    io.get<{ ok: boolean; media: MediaCardRow[] }>('/api/media')
      .then((res) => {
        if (!cancelled && res.data?.ok) setMedias(res.data.media);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [activeSurface, io]);

  // Fetch automations
  useEffect(() => {
    if (activeSurface !== 'automation') return;
    let cancelled = false;
    io.get<{ ok: boolean; automations: AutomationDefinition[] }>('/api/automation/list')
      .then((res) => {
        if (!cancelled && res.data?.ok) setAutomations(res.data.automations);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [activeSurface, io]);

  // Fetch agents
  useEffect(() => {
    if (activeSurface !== 'agents') return;
    let cancelled = false;
    io.get<{ ok: boolean; agents: AgentDefinition[] }>('/api/agent/list')
      .then((res) => {
        if (!cancelled && res.data?.ok) setAgents(res.data.agents);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [activeSurface, io]);

  return (
    <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
      <DrawerSystem workspaceId={workspaceId}>
        {activeSurface === 'chat' && (
          <ChatSurface defaultProviderId={providerIds[0]} />
        )}
        {activeSurface === 'docs' && (
          <CardGrid>
            {docs.map((doc) => (
              <CardFrame key={doc.id} title={doc.title} badge={doc.engine}>
                <DocCard document={doc} />
              </CardFrame>
            ))}
            {docs.length === 0 && <EmptyCard label="No documents open" />}
          </CardGrid>
        )}
        {activeSurface === 'media' && (
          <CardGrid>
            {medias.map((m) => (
              <CardFrame key={m.id} title={m.title} badge={m.engine}>
                <MediaCard media={m} />
              </CardFrame>
            ))}
            {medias.length === 0 && <EmptyCard label="No media open" />}
          </CardGrid>
        )}
        {activeSurface === 'automation' && (
          <CardGrid>
            {automations.map((a) => (
              <CardFrame key={a.id} title={a.name} badge={`auto · ${a.trigger.kind}`}>
                <AutomationCard
                  automation={a}
                  onExecute={async (id) => {
                    await io.post('/api/automation/execute', { automationId: id });
                  }}
                />
              </CardFrame>
            ))}
            {automations.length === 0 && <EmptyCard label="No automations" />}
          </CardGrid>
        )}
        {activeSurface === 'agents' && (
          <CardGrid>
            {agents.map((a) => (
              <CardFrame key={a.id} title={a.name} badge="agent">
                <AgentCard
                  agent={a}
                  onInvoke={async (id) => {
                    await io.post('/api/agent/invoke', { agentId: id });
                  }}
                />
              </CardFrame>
            ))}
            {agents.length === 0 && <EmptyCard label="No agents" />}
          </CardGrid>
        )}
        {activeSurface === 'shell' && (
          <div style={{ position: 'absolute', inset: 16 }}>
            <ShellCard workspaceId={workspaceId} />
          </div>
        )}
        {activeSurface === 'audit' && <AuditDashboard workspaceId={workspaceId} />}
        {activeSurface === 'rbac' && <RbacManager workspaceId={workspaceId} />}
        {activeSurface === 'templates' && (
          <TemplatesGallery
            onCreated={(wsId) => {
              setWorkspace(wsId);
              setActiveSurface('chat');
            }}
          />
        )}
        {activeSurface === 'editor' && (
          <div style={{ position: 'absolute', inset: 16, display: 'flex', gap: 16 }}>
            {docs.length > 0 && (
              <div style={{ flex: 1, borderRadius: 8, border: '1px solid var(--border)', overflow: 'hidden', background: 'var(--bg-elevated)' }}>
                <DocEditor document={docs[0]!} />
              </div>
            )}
            {docs.length === 0 && <EmptyCard label="No documents to edit. Open one from the Documents tab." />}
          </div>
        )}
        {activeSurface === 'health' && <HealthDashboard />}
        {activeSurface === 'capabilities' && <CapabilityCatalog />}
        {activeSurface === 'memory' && <MemoryBrowser />}
        {activeSurface === 'zlayers' && (
          <div style={{ padding: 16, overflowY: 'auto' }}>
            <ZLayerPanel workspaceId={workspaceId} />
          </div>
        )}
      </DrawerSystem>
    </div>
  );
}
