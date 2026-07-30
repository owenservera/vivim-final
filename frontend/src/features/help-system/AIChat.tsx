/**
 * AIChat.tsx
 * ---------------------------------------------------------------------------
 * Streaming AI chat component for the help system.
 *
 * All I/O routed through UnifiedIO → /api/interpret (same path as main chat).
 *
 * Features:
 *   - Streaming responses (SSE via io.subscribeSSE)
 *   - Markdown rendering (bold, code, links)
 *   - Citations as clickable chips
 *   - Suggested actions as buttons
 *   - Typing indicator
 *   - Message history (session-scoped)
 */

'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { UnifiedIO } from '@/components/canvas/UnifiedIOProvider';
import { dispatchBehavior } from '@/shared/dispatch-behavior';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Citation {
  source: string;
  line?: number;
  snippet: string;
}

export interface SuggestedAction {
  label: string;
  command?: string;
  mode?: 'explain' | 'guide' | 'execute';
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  actions?: SuggestedAction[];
  timestamp: number;
}

interface AIChatProps {
  io: UnifiedIO;
  initialMessage?: string;
  screenContext?: Record<string, unknown>;
  onExecute?: (capability: string, params: unknown) => void;
  onAction?: (command: string) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function renderMarkdown(text: string): string {
  return text
    // Bold
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code style="background:#f3f4f6;padding:2px 4px;border-radius:3px;font-size:12px">$1</code>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" style="color:#3b82f6;text-decoration:underline">$1</a>')
    // Line breaks
    .replace(/\n/g, '<br />');
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AIChat({ io, initialMessage, screenContext, onExecute, onAction }: AIChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Send initial message if provided
  useEffect(() => {
    if (initialMessage && messages.length === 0) {
      handleSend(initialMessage);
    }
  }, []);

  const handleSend = useCallback(
    async (content: string) => {
      if (!content.trim() || isStreaming) return;

      const userMessage: ChatMessage = {
        id: generateId(),
        role: 'user',
        content: content.trim(),
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setInput('');
      setIsStreaming(true);

      try {
        // Route through dispatchBehavior → UnifiedIO → /api/interpret
        const result = await dispatchBehavior('help', content, null, io);
        const response = result.data as {
          ok?: boolean;
          capabilityId?: string;
          output?: unknown;
          text?: string;
          error?: string;
          clarification?: { prompt: string; options?: string[] };
          confirmation?: { token: string; prompt: string };
        } | undefined;

        if (!result.ok) {
          throw new Error(result.error || 'Help classification failed');
        }

        if (!response?.ok) {
          // Handle clarification
          if (response?.clarification) {
            const clarifyMsg: ChatMessage = {
              id: generateId(),
              role: 'assistant',
              content: response.clarification.prompt +
                (response.clarification.options
                  ? '\n\nOptions: ' + response.clarification.options.join(', ')
                  : ''),
              citations: [],
              actions: [{ label: 'Try again', mode: 'guide' }],
              timestamp: Date.now(),
            };
            setMessages((prev) => [...prev, clarifyMsg]);
            return;
          }

          // Handle confirmation needed
          if (response?.confirmation) {
            const confirmMsg: ChatMessage = {
              id: generateId(),
              role: 'assistant',
              content: response.confirmation.prompt,
              citations: [],
              actions: [
                { label: 'Confirm', mode: 'execute', command: `confirm:${response.confirmation.token}` },
                { label: 'Cancel', mode: 'explain' },
              ],
              timestamp: Date.now(),
            };
            setMessages((prev) => [...prev, confirmMsg]);
            return;
          }

          throw new Error(response?.error || 'Interpret failed');
        }

        // Build assistant message from response
        const assistantContent = response?.text ||
          (response?.capabilityId
            ? `Executed **${response.capabilityId}** successfully.`
            : 'Done.');

        const assistantMessage: ChatMessage = {
          id: generateId(),
          role: 'assistant',
          content: assistantContent,
          citations: response?.capabilityId ? [{
            source: 'capability',
            snippet: response.capabilityId,
          }] : [],
          actions: [
            { label: 'Do it again', mode: 'execute', command: content },
            { label: 'Explain this', mode: 'explain' },
          ],
          timestamp: Date.now(),
        };

        setMessages((prev) => [...prev, assistantMessage]);
      } catch (error) {
        // Fallback: provide helpful error message
        const errorMessage: ChatMessage = {
          id: generateId(),
          role: 'assistant',
          content: `I couldn't process your request right now. Please try again.\n\nYou can also:\n- Use the search tab to find capabilities\n- Use the actions tab for quick workflows\n- Press Ctrl+K to open the command palette`,
          citations: [],
          actions: [
            { label: 'Try again', command: 'retry' },
            { label: 'Search instead', mode: 'explain' },
          ],
          timestamp: Date.now(),
        };

        setMessages((prev) => [...prev, errorMessage]);
      } finally {
        setIsStreaming(false);
      }
    },
    [io, messages, isStreaming]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(input);
    }
  };

  return (
    <div style={styles.container}>
      {/* Messages */}
      <div style={styles.messages}>
        {messages.length === 0 && (
          <div style={styles.empty}>
            <p style={styles.emptyTitle}>Ask me anything about Vivim</p>
            <p style={styles.emptyHint}>
              I can explain features, walk you through workflows, or execute tasks.
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              ...styles.message,
              ...(msg.role === 'user' ? styles.userMessage : styles.assistantMessage),
            }}
          >
            {msg.role === 'assistant' && (
              <div style={styles.avatar}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={styles.avatarIcon}>
                  <circle cx={12} cy={12} r={10} />
                  <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                  <path d="M12 17h.01" />
                </svg>
              </div>
            )}
            <div style={styles.messageContent}>
              <div
                style={styles.messageText}
                dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
              />

              {/* Citations */}
              {msg.citations && msg.citations.length > 0 && (
                <div style={styles.citations}>
                  {msg.citations.map((cite, idx) => (
                    <button
                      key={idx}
                      style={styles.citationChip}
                      onClick={() => onAction?.(`navigate:${cite.source}:${cite.line ?? ''}`)}
                    >
                      {cite.source.split('/').pop()}
                    </button>
                  ))}
                </div>
              )}

              {/* Suggested actions */}
              {msg.actions && msg.actions.length > 0 && (
                <div style={styles.actions}>
                  {msg.actions.map((action, idx) => (
                    <button
                      key={idx}
                      style={styles.actionButton}
                      onClick={() => {
                        if (action.mode === 'execute' && action.command) {
                          onExecute?.(action.command, {});
                        } else if (action.command) {
                          onAction?.(action.command);
                        } else {
                          handleSend(action.label);
                        }
                      }}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {isStreaming && (
          <div style={{ ...styles.message, ...styles.assistantMessage }}>
            <div style={styles.avatar}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={styles.avatarIcon}>
                <circle cx={12} cy={12} r={10} />
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                <path d="M12 17h.01" />
              </svg>
            </div>
            <div style={styles.typingIndicator}>
              <span style={styles.typingDot} />
              <span style={{ ...styles.typingDot, animationDelay: '0.2s' }} />
              <span style={{ ...styles.typingDot, animationDelay: '0.4s' }} />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={styles.inputWrapper}>
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask a question..."
          style={styles.input}
          rows={1}
          aria-label="Chat message input"
        />
        <button
          onClick={() => handleSend(input)}
          disabled={!input.trim() || isStreaming}
          style={{
            ...styles.sendButton,
            opacity: !input.trim() || isStreaming ? 0.5 : 1,
          }}
          aria-label="Send message"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={styles.sendIcon}>
            <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflow: 'hidden',
  },
  messages: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px 0',
  },
  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: '#6b7280',
    textAlign: 'center',
    padding: 20,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: 600,
    color: 'var(--text, #111827)',
    margin: '0 0 8px 0',
  },
  emptyHint: {
    fontSize: 13,
    margin: 0,
  },
  message: {
    display: 'flex',
    gap: 10,
    padding: '8px 16px',
    marginBottom: 8,
  },
  userMessage: {
    justifyContent: 'flex-end',
  },
  assistantMessage: {
    justifyContent: 'flex-start',
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: '50%',
    backgroundColor: '#eff6ff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarIcon: {
    width: 16,
    height: 16,
    color: '#3b82f6',
  },
  messageContent: {
    maxWidth: '80%',
  },
  messageText: {
    fontSize: 14,
    lineHeight: 1.6,
    color: 'var(--text, #111827)',
    padding: '10px 14px',
    borderRadius: 12,
    backgroundColor: 'var(--bg-alt, #f3f4f6)',
  },
  citations: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 6,
  },
  citationChip: {
    fontSize: 11,
    padding: '2px 8px',
    borderRadius: 4,
    backgroundColor: '#eff6ff',
    color: '#3b82f6',
    border: 'none',
    cursor: 'pointer',
  },
  actions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  actionButton: {
    fontSize: 12,
    padding: '6px 12px',
    borderRadius: 6,
    backgroundColor: '#ffffff',
    color: '#374151',
    border: '1px solid #e5e7eb',
    cursor: 'pointer',
    transition: 'all 100ms',
  },
  typingIndicator: {
    display: 'flex',
    gap: 4,
    padding: '12px 16px',
    backgroundColor: 'var(--bg-alt, #f3f4f6)',
    borderRadius: 12,
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    backgroundColor: '#9ca3af',
    animation: 'typing 1.4s infinite ease-in-out',
  },
  inputWrapper: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: 8,
    padding: '12px 16px',
    borderTop: '1px solid var(--border, #e5e7eb)',
    backgroundColor: 'var(--bg, #ffffff)',
  },
  input: {
    flex: 1,
    padding: '10px 12px',
    fontSize: 14,
    fontFamily: 'inherit',
    border: '1px solid var(--border, #e5e7eb)',
    borderRadius: 8,
    outline: 'none',
    resize: 'none',
    minHeight: 40,
    maxHeight: 120,
    backgroundColor: 'var(--bg, #ffffff)',
    color: 'var(--text, #111827)',
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#3b82f6',
    color: '#ffffff',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  sendIcon: {
    width: 18,
    height: 18,
  },
};
