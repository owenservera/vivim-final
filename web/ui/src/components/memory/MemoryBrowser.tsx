'use client';

/**
 * components/memory/MemoryBrowser.tsx
 * --------------------------------------------------------------------
 * Full memory browser surface with graph visualization, timeline,
 * curation controls, synthesis, and import/export.
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { getApiUrl } from '@/shared/api-config';

interface MemoryFact {
  id: string;
  subject: string;
  predicate: string;
  object: unknown;
  confidence: number;
  source: string;
  timestamp: number;
}

interface MemoryEpisode {
  id: string;
  providerId: string;
  action: string;
  success: boolean;
  durationMs: number;
  timestamp: number;
}

interface MemoryRule {
  id: string;
  name: string;
  condition: string;
  action: string;
  confidence: number;
  successCount: number;
  failureCount: number;
}

interface GraphNode {
  id: string;
  label: string;
  type: 'fact' | 'episode' | 'rule';
}

interface GraphEdge {
  source: string;
  target: string;
  label: string;
  weight: number;
}

interface SynthesisResult {
  text: string;
  sources: string[];
  gaps: string[];
}

export function MemoryBrowser() {
  const [facts, setFacts] = useState<MemoryFact[]>([]);
  const [episodes, setEpisodes] = useState<MemoryEpisode[]>([]);
  const [rules, setRules] = useState<MemoryRule[]>([]);
  const [selectedFact, setSelectedFact] = useState<MemoryFact | null>(null);
  const [synthesisQuery, setSynthesisQuery] = useState('');
  const [synthesisResult, setSynthesisResult] = useState<SynthesisResult | null>(null);
  const [activeTab, setActiveTab] = useState<'graph' | 'timeline' | 'curate' | 'synthesize' | 'io'>('graph');
  const [loading, setLoading] = useState(true);
  const graphRef = useRef<HTMLDivElement>(null);

  // Fetch memory data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [factsRes, episodesRes, rulesRes] = await Promise.all([
          fetch(getApiUrl('/api/memory/facts')),
          fetch(getApiUrl('/api/memory/episodes')),
          fetch(getApiUrl('/api/memory/rules')),
        ]);

        if (factsRes.ok) {
          const data = await factsRes.json();
          setFacts(data.facts ?? []);
        }
        if (episodesRes.ok) {
          const data = await episodesRes.json();
          setEpisodes(data.episodes ?? []);
        }
        if (rulesRes.ok) {
          const data = await rulesRes.json();
          setRules(data.rules ?? []);
        }
      } catch {
        // Silently handle errors
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Build graph data from facts
  const buildGraph = useCallback(() => {
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    const nodeIds = new Set<string>();

    for (const fact of facts) {
      if (!nodeIds.has(fact.subject)) {
        nodes.push({ id: fact.subject, label: fact.subject, type: 'fact' });
        nodeIds.add(fact.subject);
      }
      if (!nodeIds.has(String(fact.object))) {
        nodes.push({ id: String(fact.object), label: String(fact.object), type: 'fact' });
        nodeIds.add(String(fact.object));
      }
      edges.push({
        source: fact.subject,
        target: String(fact.object),
        label: fact.predicate,
        weight: fact.confidence,
      });
    }

    return { nodes, edges };
  }, [facts]);

  // Handle synthesis
  const handleSynthesize = async () => {
    if (!synthesisQuery.trim()) return;

    try {
      const res = await fetch(getApiUrl('/api/knowledge/synthesize'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: synthesisQuery }),
      });

      if (res.ok) {
        const data = await res.json();
        setSynthesisResult(data);
      }
    } catch {
      // Silently handle errors
    }
  };

  // Handle export
  const handleExport = async (format: 'json' | 'markdown') => {
    try {
      const res = await fetch(getApiUrl(`/api/memory/export?format=${format}`));
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `memory-export.${format}`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch {
      // Silently handle errors
    }
  };

  // Handle import
  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const res = await fetch(getApiUrl('/api/memory/import'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ json: text }),
      });

      if (res.ok) {
        // Refresh data
        window.location.reload();
      }
    } catch {
      // Silently handle errors
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
        Loading memory...
      </div>
    );
  }

  const graph = buildGraph();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Tab bar */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--bg-subtle)' }}>
        {(['graph', 'timeline', 'curate', 'synthesize', 'io'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '8px 16px',
              border: 'none',
              background: activeTab === tab ? 'var(--bg-elevated)' : 'transparent',
              color: activeTab === tab ? 'var(--text)' : 'var(--text-muted)',
              cursor: 'pointer',
              borderBottom: activeTab === tab ? '2px solid var(--accent)' : '2px solid transparent',
              fontSize: 13,
              fontWeight: activeTab === tab ? 600 : 400,
            }}
          >
            {tab === 'graph' && 'Graph'}
            {tab === 'timeline' && 'Timeline'}
            {tab === 'curate' && 'Curate'}
            {tab === 'synthesize' && 'Synthesize'}
            {tab === 'io' && 'Import/Export'}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        {activeTab === 'graph' && (
          <div>
            <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600 }}>Knowledge Graph</h3>
            <div
              ref={graphRef}
              style={{
                height: 400,
                border: '1px solid var(--border)',
                borderRadius: 8,
                background: 'var(--bg-elevated)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-muted)',
                fontSize: 13,
              }}
            >
              {graph.nodes.length === 0 ? (
                'No facts to visualize'
              ) : (
                <div style={{ padding: 16, width: '100%' }}>
                  <div style={{ marginBottom: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                    {graph.nodes.length} nodes, {graph.edges.length} edges
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {graph.nodes.slice(0, 20).map((node) => (
                      <div
                        key={node.id}
                        style={{
                          padding: '4px 8px',
                          borderRadius: 4,
                          background: 'var(--bg-subtle)',
                          border: '1px solid var(--border)',
                          fontSize: 12,
                          cursor: 'pointer',
                        }}
                        onClick={() => {
                          const fact = facts.find((f) => f.subject === node.id || String(f.object) === node.id);
                          if (fact) setSelectedFact(fact);
                        }}
                      >
                        {node.label}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'timeline' && (
          <div>
            <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600 }}>Recent Episodes</h3>
            {episodes.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No episodes recorded</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {episodes.slice(0, 50).map((ep) => (
                  <div
                    key={ep.id}
                    style={{
                      padding: 8,
                      borderRadius: 4,
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border)',
                      fontSize: 13,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: 500 }}>{ep.action}</span>
                      <span style={{ color: ep.success ? 'var(--success)' : 'var(--error)', fontSize: 12 }}>
                        {ep.success ? '✓' : '✗'}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                      {ep.providerId} · {new Date(ep.timestamp).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'curate' && (
          <div>
            <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600 }}>Curation</h3>
            {facts.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No facts to curate</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {facts.slice(0, 50).map((fact) => (
                  <div
                    key={fact.id}
                    style={{
                      padding: 8,
                      borderRadius: 4,
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border)',
                      fontSize: 13,
                    }}
                  >
                    <div style={{ fontWeight: 500 }}>
                      {fact.subject} {fact.predicate} {JSON.stringify(fact.object)}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                      Confidence: {(fact.confidence * 100).toFixed(0)}% · {fact.source}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'synthesize' && (
          <div>
            <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600 }}>Synthesis</h3>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <input
                type="text"
                value={synthesisQuery}
                onChange={(e) => setSynthesisQuery(e.target.value)}
                placeholder="Ask a question about your knowledge..."
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: 4,
                  border: '1px solid var(--border)',
                  background: 'var(--bg-elevated)',
                  color: 'var(--text)',
                  fontSize: 13,
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleSynthesize()}
              />
              <button
                onClick={handleSynthesize}
                style={{
                  padding: '8px 16px',
                  borderRadius: 4,
                  border: '1px solid var(--border)',
                  background: 'var(--accent)',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: 13,
                }}
              >
                Synthesize
              </button>
            </div>
            {synthesisResult && (
              <div style={{ padding: 12, borderRadius: 4, background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                <div style={{ marginBottom: 8, fontSize: 13 }}>{synthesisResult.text}</div>
                {synthesisResult.sources.length > 0 && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    Sources: {synthesisResult.sources.join(', ')}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'io' && (
          <div>
            <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600 }}>Import/Export</h3>
            <div style={{ display: 'flex', gap: 16 }}>
              <div style={{ flex: 1 }}>
                <h4 style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 500 }}>Export</h4>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => handleExport('json')}
                    style={{
                      padding: '8px 16px',
                      borderRadius: 4,
                      border: '1px solid var(--border)',
                      background: 'var(--bg-elevated)',
                      cursor: 'pointer',
                      fontSize: 13,
                    }}
                  >
                    Export JSON
                  </button>
                  <button
                    onClick={() => handleExport('markdown')}
                    style={{
                      padding: '8px 16px',
                      borderRadius: 4,
                      border: '1px solid var(--border)',
                      background: 'var(--bg-elevated)',
                      cursor: 'pointer',
                      fontSize: 13,
                    }}
                  >
                    Export Markdown
                  </button>
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <h4 style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 500 }}>Import</h4>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImport}
                  style={{ fontSize: 13 }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Selected fact detail */}
      {selectedFact && (
        <div
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            padding: 16,
            background: 'var(--bg-elevated)',
            borderTop: '1px solid var(--border)',
            boxShadow: '0 -2px 8px rgba(0,0,0,0.1)',
            zIndex: 100,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 500 }}>
                {selectedFact.subject} {selectedFact.predicate} {JSON.stringify(selectedFact.object)}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                Confidence: {(selectedFact.confidence * 100).toFixed(0)}% · Source: {selectedFact.source}
              </div>
            </div>
            <button
              onClick={() => setSelectedFact(null)}
              style={{
                padding: '4px 8px',
                borderRadius: 4,
                border: '1px solid var(--border)',
                background: 'transparent',
                cursor: 'pointer',
                fontSize: 12,
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
