'use client';

/**
 * components/builder/BuilderSurface.tsx
 * --------------------------------------------------------------------
 * Phase 6 of ROADMAP-REPROGRAMMABLE-CANVAS.md — Visual Builder (node-graph).
 *
 * A full-screen node-graph canvas. Surfaces are nodes, mutations are edges,
 * capabilities are ports. Drag-connect a capability port to a surface port
 * → generates a SurfaceMutation (rebind op). Save the graph as a
 * WorkspaceTemplate.
 *
 * Rendering: pure SVG + DOM. No reactflow dependency. The graph is small
 * (capped at 200 nodes per the roadmap), so a custom renderer is sufficient
 * and keeps the bundle small.
 *
 * The graph itself is a `ReprogrammableSurface` (meta-circular — see Phase 6
 * Risks). Mutations that target the graph itself are tagged
 * `provenance: 'system'` and require explicit confirmation (Phase 7).
 *
 * CONTRACT_VERSION: 1
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useIO } from '@/sdk/web';
import { useAsyncOperation } from '@/hooks/useAsyncOperation';
import { Icon } from '@/components/canvas/Icon';
import {
  SurfaceNode,
  type SurfaceNodeData,
} from './SurfaceNode';
import {
  CapabilityNode,
  type CapabilityNodeData,
} from './CapabilityNode';
import { MutationEdge, type MutationEdgeData } from './MutationEdge';
import { Toolbar } from './Toolbar';
import type {
  SurfaceMutation,
  SurfaceMutationPlan,
} from '@backend/reprogrammability/mutation-schema';
import type { SurfaceSpec } from '@backend/reprogrammability/schema/spec';

// ── Graph data model ────────────────────────────────────────────────────────

export interface BuilderGraph {
  nodes: Array<SurfaceNodeData | CapabilityNodeData>;
  edges: MutationEdgeData[];
}

export interface BuilderSurfaceProps {
  /** Called when the user closes the builder. */
  onClose?: () => void;
  /** Initial graph (e.g. loaded from a saved template). */
  initialGraph?: BuilderGraph;
}

// ── Default seed graph ──────────────────────────────────────────────────────

const SEED_GRAPH: BuilderGraph = {
  nodes: [
    {
      type: 'surface',
      id: 'node:panel:conversations',
      surfaceId: 'panel:conversations',
      label: 'Conversations',
      x: 80,
      y: 80,
      ports: [
        { id: 'in:conversation', label: 'conversation', direction: 'in' },
        { id: 'out:selected', label: 'selected', direction: 'out' },
      ],
    },
    {
      type: 'surface',
      id: 'node:panel:providers',
      surfaceId: 'panel:providers',
      label: 'Providers',
      x: 80,
      y: 280,
      ports: [
        { id: 'in:provider', label: 'provider', direction: 'in' },
        { id: 'out:active', label: 'active', direction: 'out' },
      ],
    },
    {
      type: 'capability',
      id: 'node:cap:chat:send',
      capabilityId: 'cap:chat:send',
      label: 'chat.send',
      x: 480,
      y: 80,
      ports: [
        { id: 'in:message', label: 'message', direction: 'in' },
        { id: 'out:response', label: 'response', direction: 'out' },
      ],
    },
    {
      type: 'capability',
      id: 'node:cap:document:read',
      capabilityId: 'cap:document:read',
      label: 'document.read',
      x: 480,
      y: 280,
      ports: [
        { id: 'in:url', label: 'url', direction: 'in' },
        { id: 'out:content', label: 'content', direction: 'out' },
      ],
    },
  ],
  edges: [
    {
      id: 'edge:conv-to-chat',
      from: { nodeId: 'node:panel:conversations', portId: 'out:selected' },
      to: { nodeId: 'node:cap:chat:send', portId: 'in:message' },
      op: 'rebind',
      target: 'panel:conversations',
    },
  ],
};

// ── Component ───────────────────────────────────────────────────────────────

export function BuilderSurface({
  onClose,
  initialGraph,
}: BuilderSurfaceProps) {
  const io = useIO();
  const [graph, setGraph] = useState<BuilderGraph>(initialGraph ?? SEED_GRAPH);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [pendingEdge, setPendingEdge] = useState<{
    from: { nodeId: string; portId: string; x: number; y: number };
    to?: { x: number; y: number };
  } | null>(null);
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const { error, setError, run } = useAsyncOperation();

  const svgRef = useRef<SVGSVGElement | null>(null);

  // ── Drag a node ─────────────────────────────────────────────────────────
  const onNodeDragStart = useCallback(
    (nodeId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setDraggingNodeId(nodeId);
      setSelectedNodeId(nodeId);
    },
    [],
  );

  useEffect(() => {
    if (!draggingNodeId) return;
    const onMove = (e: MouseEvent) => {
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setGraph((g) => ({
        ...g,
        nodes: g.nodes.map((n) =>
          n.id === draggingNodeId ? { ...n, x, y } : n,
        ),
      }));
    };
    const onUp = () => setDraggingNodeId(null);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [draggingNodeId]);

  // ── Connect ports ────────────────────────────────────────────────────────
  const onPortMouseDown = useCallback(
    (nodeId: string, portId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return;
      setPendingEdge({
        from: {
          nodeId,
          portId,
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        },
      });
    },
    [],
  );

  useEffect(() => {
    if (!pendingEdge) return;
    const onMove = (e: MouseEvent) => {
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return;
      setPendingEdge((pe) =>
        pe ? { ...pe, to: { x: e.clientX - rect.left, y: e.clientY - rect.top } } : null,
      );
    };
    const onUp = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const portEl = target.closest('[data-port-id]') as HTMLElement | null;
      if (portEl) {
        const toNodeId = portEl.dataset.nodeId!;
        const toPortId = portEl.dataset.portId!;
        if (toNodeId && toPortId && toNodeId !== pendingEdge.from.nodeId) {
          // Add an edge.
          setGraph((g) => {
            const fromNode = g.nodes.find((n) => n.id === pendingEdge.from.nodeId);
            const toNode = g.nodes.find((n) => n.id === toNodeId);
            if (!fromNode || !toNode) return g;
            // The surface is the FROM side of the binding (capability → surface).
            // Determine which side is the surface.
            const surfaceNode =
              fromNode.type === 'surface'
                ? fromNode
                : toNode.type === 'surface'
                  ? toNode
                  : null;
            if (!surfaceNode) {
              setError('One end of an edge must be a surface node.');
              return g;
            }
            const newEdge: MutationEdgeData = {
              id: `edge:${pendingEdge.from.nodeId}:${toNodeId}:${Date.now()}`,
              from: { nodeId: pendingEdge.from.nodeId, portId: pendingEdge.from.portId },
              to: { nodeId: toNodeId, portId: toPortId },
              op: 'rebind',
              target: (surfaceNode as SurfaceNodeData).surfaceId,
            };
            // Avoid duplicate edges.
            const exists = g.edges.some(
              (ed) =>
                ed.from.nodeId === newEdge.from.nodeId &&
                ed.from.portId === newEdge.from.portId &&
                ed.to.nodeId === newEdge.to.nodeId &&
                ed.to.portId === newEdge.to.portId,
            );
            if (exists) return g;
            return { ...g, edges: [...g.edges, newEdge] };
          });
        }
      }
      setPendingEdge(null);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [pendingEdge]);

  // ── Add a surface node ───────────────────────────────────────────────────
  const addSurfaceNode = useCallback(
    async (surfaceId: string) => {
      // Fetch the surface summary to get the label.
      let label = surfaceId;
      try {
        const res = await io.get<{ ok: boolean; surface?: { label: string } }>(
          `/api/surface/${encodeURIComponent(surfaceId)}/summary`,
        );
        if (res.data?.ok && res.data.surface?.label) {
          label = res.data.surface.label;
        }
      } catch {
        // Fall back to id.
      }
      setGraph((g) => ({
        ...g,
        nodes: [
          ...g.nodes,
          {
            type: 'surface',
            id: `node:${surfaceId}`,
            surfaceId,
            label,
            x: 200 + Math.random() * 200,
            y: 200 + Math.random() * 200,
            ports: [
              { id: 'in:default', label: 'in', direction: 'in' },
              { id: 'out:default', label: 'out', direction: 'out' },
            ],
          },
        ],
      }));
    },
    [io],
  );

  // ── Add a capability node ────────────────────────────────────────────────
  const addCapabilityNode = useCallback((capabilityId: string) => {
    setGraph((g) => ({
      ...g,
      nodes: [
        ...g.nodes,
        {
          type: 'capability',
          id: `node:cap:${capabilityId}:${Date.now()}`,
          capabilityId,
          label: capabilityId,
          x: 400 + Math.random() * 200,
          y: 200 + Math.random() * 200,
          ports: [
            { id: 'in:default', label: 'in', direction: 'in' },
            { id: 'out:default', label: 'out', direction: 'out' },
          ],
        },
      ],
    }));
  }, []);

  // ── Delete selected node + its edges ─────────────────────────────────────
  const deleteSelected = useCallback(() => {
    if (!selectedNodeId) return;
    setGraph((g) => ({
      nodes: g.nodes.filter((n) => n.id !== selectedNodeId),
      edges: g.edges.filter(
        (e) => e.from.nodeId !== selectedNodeId && e.to.nodeId !== selectedNodeId,
      ),
    }));
    setSelectedNodeId(null);
  }, [selectedNodeId]);

  // ── Save as WorkspaceTemplate ────────────────────────────────────────────
  const saveAsTemplate = useCallback(
    async (name: string, description?: string) => {
      setSaving(true);
      setError(null);
      setSaveStatus(null);
      const res = await run(() => io.post<{
        ok: boolean;
        template?: { id: string };
        error?: string;
      }>('/api/template/from-graph', {
        name,
        description,
        graphJson: graph,
      }));
      if (!res?.data?.ok || !res.data.template) {
        setError(res?.data?.error ?? 'Failed to save template');
        setSaving(false);
        return;
      }
      setSaveStatus(`Saved as template: ${res.data.template.id}`);
      setSaving(false);
    },
    [io, graph, run, setError],
  );

  // ── Run the graph: emit a mutation plan from the edges ───────────────────
  const runGraph = useCallback(async (): Promise<void> => {
    setError(null);
    // Each edge that has op 'rebind' and a valid surface target becomes a
    // rebind mutation in the plan.
    const mutations: SurfaceMutation[] = graph.edges
      .filter((e) => e.op === 'rebind' && e.target)
      .map((e) => {
        // Find the capability id on the other end of the edge.
        const fromNode = graph.nodes.find((n) => n.id === e.from.nodeId);
        const toNode = graph.nodes.find((n) => n.id === e.to.nodeId);
        const capNode =
          fromNode?.type === 'capability'
            ? fromNode
            : toNode?.type === 'capability'
              ? toNode
              : null;
        const capId = capNode?.capabilityId ?? 'unknown';
        return {
          op: 'rebind' as const,
          target: e.target,
          provenance: 'manual' as const,
          payload: {
            capabilityId: capId,
            action: 'bind' as const,
          },
          reason: `Visual Builder: bind ${capId} to ${e.target}`,
          idempotencyKey: `builder-${e.id}-${Date.now()}`,
        };
      });

    if (mutations.length === 0) {
      setError('No rebind edges in graph — nothing to apply.');
      return;
    }

    const plan: SurfaceMutationPlan = {
      id: `builder-plan-${Date.now()}`,
      mutations,
      provenance: 'manual',
      description: `Visual Builder plan: ${mutations.length} binding(s)`,
    };

    const res = await run(() => io.post<{ ok: boolean; error?: string }>(
      '/api/mutation/apply',
      { plan },
    ));
    if (!res?.data?.ok) {
      setError(res?.data?.error ?? 'Apply failed');
      return;
    }
    setSaveStatus(`Applied ${mutations.length} binding(s).`);
  }, [io, graph, run, setError]);

  // ── Export as JSON ────────────────────────────────────────────────────────
  const exportJson = useCallback(() => {
    const blob = new Blob([JSON.stringify(graph, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vivim-builder-graph-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [graph]);

  // ── Render ─────────────────────────────────────────────────────────────────
  const nodesById = useMemo(() => {
    const m = new Map<string, SurfaceNodeData | CapabilityNodeData>();
    for (const n of graph.nodes) m.set(n.id, n);
    return m;
  }, [graph.nodes]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--bg-canvas, #0f172a)',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        color: 'var(--text-primary, #e2e8f0)',
      }}
    >
      {/* Toolbar */}
      <Toolbar
        onClose={onClose}
        onAddSurface={(id) => void addSurfaceNode(id)}
        onAddCapability={(id) => addCapabilityNode(id)}
        onDeleteSelected={selectedNodeId ? deleteSelected : undefined}
        onSaveAsTemplate={(name, desc) => void saveAsTemplate(name, desc)}
        onRun={() => void runGraph()}
        onExport={exportJson}
        saving={saving}
        status={saveStatus}
        error={error}
      />

      {/* Canvas */}
      <div
        style={{
          flex: 1,
          position: 'relative',
          overflow: 'hidden',
          backgroundImage:
            'radial-gradient(circle, var(--border-subtle, #1e293b) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) setSelectedNodeId(null);
        }}
      >
        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          style={{ position: 'absolute', inset: 0 }}
        >
          {/* Edges */}
          {graph.edges.map((edge) => {
            const from = nodesById.get(edge.from.nodeId);
            const to = nodesById.get(edge.to.nodeId);
            if (!from || !to) return null;
            const fromPort = from.ports.find((p) => p.id === edge.from.portId);
            const toPort = to.ports.find((p) => p.id === edge.to.portId);
            if (!fromPort || !toPort) return null;
            const x1 = from.x + (fromPort.direction === 'out' ? 200 : 0);
            const y1 = from.y + 24 + from.ports.indexOf(fromPort) * 18;
            const x2 = to.x + (toPort.direction === 'in' ? 0 : 200);
            const y2 = to.y + 24 + to.ports.indexOf(toPort) * 18;
            return (
              <MutationEdge
                key={edge.id}
                edge={edge}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
              />
            );
          })}

          {/* Pending edge (drag) */}
          {pendingEdge?.to && (
            <line
              x1={pendingEdge.from.x}
              y1={pendingEdge.from.y}
              x2={pendingEdge.to.x}
              y2={pendingEdge.to.y}
              stroke="var(--accent, #3b82f6)"
              strokeWidth={2}
              strokeDasharray="4 4"
            />
          )}
        </svg>

        {/* Nodes (DOM overlay) */}
        {graph.nodes.map((node) =>
          node.type === 'surface' ? (
            <SurfaceNode
              key={node.id}
              node={node}
              selected={node.id === selectedNodeId}
              onMouseDown={(e) => onNodeDragStart(node.id, e)}
              onPortMouseDown={onPortMouseDown}
            />
          ) : (
            <CapabilityNode
              key={node.id}
              node={node}
              selected={node.id === selectedNodeId}
              onMouseDown={(e) => onNodeDragStart(node.id, e)}
              onPortMouseDown={onPortMouseDown}
            />
          ),
        )}

        {/* Footer hint */}
        <div
          style={{
            position: 'absolute',
            bottom: 16,
            left: 16,
            padding: '8px 12px',
            background: 'var(--bg-elevated, #1e293b)',
            border: '1px solid var(--border-subtle, #334155)',
            borderRadius: 6,
            fontSize: 12,
            color: 'var(--text-muted, #94a3b8)',
            pointerEvents: 'none',
          }}
        >
          Drag nodes to move. Drag from a port to another port to create a binding edge.
          Selected node: <code style={{ color: 'var(--accent, #3b82f6)' }}>{selectedNodeId ?? 'none'}</code>
        </div>
      </div>
    </div>
  );
}
