import { jsxDEV as jsxDEV_7x81h0kn, Fragment as Fragment_8vg9x3sq } from "react/jsx-dev-runtime";
"use client";
import { useEffect, useState } from "react";
import { useIO } from "./UnifiedIOProvider";
import { useConversation } from "@/sdk/web/use-conversation";
export function DrawerSystem({ workspaceId, children }) {
  const io = useIO();
  const [config, setConfig] = useState(null);
  const fetchConfig = async () => {
    const res = await io.get(`/api/drawer/get?workspaceId=${encodeURIComponent(workspaceId)}`);
    if (res.ok)
      setConfig(res.data.config);
  };
  useEffect(() => {
    fetchConfig();
  }, [workspaceId]);
  const toggle = async (edge) => {
    if (!config)
      return;
    const updated = { ...config, drawers: { ...config.drawers, [edge]: { ...config.drawers[edge], collapsed: !config.drawers[edge].collapsed } } };
    setConfig(updated);
    await io.post("/api/drawer/toggle", { workspaceId, edge });
  };
  const setActivePanel = async (edge, panelId) => {
    if (!config)
      return;
    const updated = { ...config, drawers: { ...config.drawers, [edge]: { ...config.drawers[edge], activePanelId: panelId } } };
    setConfig(updated);
    await io.post("/api/drawer/set_active_panel", { workspaceId, edge, panelId });
  };
  if (!config)
    return /* @__PURE__ */ jsxDEV_7x81h0kn(Fragment_8vg9x3sq, {
      children
    }, undefined, false, undefined, this);
  const left = config.drawers.left;
  const right = config.drawers.right;
  const bottom = config.drawers.bottom;
  return /* @__PURE__ */ jsxDEV_7x81h0kn("div", {
    style: { position: "absolute", inset: 0, display: "flex", flexDirection: "column" },
    children: [
      /* @__PURE__ */ jsxDEV_7x81h0kn("div", {
        style: { flex: 1, display: "flex", minHeight: 0 },
        children: [
          left.visible && left.panels.length > 0 && /* @__PURE__ */ jsxDEV_7x81h0kn(DrawerContainer, {
            config: left,
            onToggle: () => toggle("left"),
            onPanelClick: (id) => setActivePanel("left", id),
            workspaceId
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsxDEV_7x81h0kn("div", {
            style: { flex: 1, position: "relative", minWidth: 0 },
            children
          }, undefined, false, undefined, this),
          right.visible && right.panels.length > 0 && /* @__PURE__ */ jsxDEV_7x81h0kn(DrawerContainer, {
            config: right,
            onToggle: () => toggle("right"),
            onPanelClick: (id) => setActivePanel("right", id),
            workspaceId
          }, undefined, false, undefined, this)
        ]
      }, undefined, true, undefined, this),
      bottom.visible && bottom.panels.length > 0 && /* @__PURE__ */ jsxDEV_7x81h0kn(BottomDrawer, {
        config: bottom,
        onToggle: () => toggle("bottom"),
        onPanelClick: (id) => setActivePanel("bottom", id),
        workspaceId
      }, undefined, false, undefined, this)
    ]
  }, undefined, true, undefined, this);
}
function DrawerContainer({
  config,
  onToggle,
  onPanelClick,
  workspaceId
}) {
  const isLeft = config.edge === "left";
  if (config.collapsed) {
    return /* @__PURE__ */ jsxDEV_7x81h0kn("div", {
      style: {
        width: 32,
        background: "var(--bg-elevated)",
        borderRight: isLeft ? "1px solid var(--border)" : "none",
        borderLeft: !isLeft ? "1px solid var(--border)" : "none",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        paddingTop: 8,
        gap: 8
      },
      children: [
        /* @__PURE__ */ jsxDEV_7x81h0kn("button", {
          onClick: onToggle,
          style: collapseBtn,
          title: "Expand",
          children: isLeft ? "" : "◀"
        }, undefined, false, undefined, this),
        config.panels.map((p) => /* @__PURE__ */ jsxDEV_7x81h0kn("div", {
          style: { fontSize: 14, cursor: "pointer" },
          title: p.title,
          onClick: onToggle,
          children: [
            p.icon,
            p.badge ? /* @__PURE__ */ jsxDEV_7x81h0kn("span", {
              style: { ...badgeStyle, position: "absolute", transform: "translate(8px, -8px)" },
              children: p.badge
            }, undefined, false, undefined, this) : null
          ]
        }, p.id, true, undefined, this))
      ]
    }, undefined, true, undefined, this);
  }
  return /* @__PURE__ */ jsxDEV_7x81h0kn("div", {
    style: {
      width: config.size,
      background: "var(--bg-elevated)",
      borderRight: isLeft ? "1px solid var(--border)" : "none",
      borderLeft: !isLeft ? "1px solid var(--border)" : "none",
      display: "flex",
      flexDirection: "column",
      flexShrink: 0
    },
    children: [
      /* @__PURE__ */ jsxDEV_7x81h0kn("div", {
        style: { display: "flex", borderBottom: "1px solid var(--border)", background: "var(--bg-subtle)" },
        children: [
          config.panels.map((p) => /* @__PURE__ */ jsxDEV_7x81h0kn("button", {
            onClick: () => onPanelClick(p.id),
            style: {
              flex: 1,
              padding: "6px 4px",
              border: "none",
              borderBottom: config.activePanelId === p.id ? "2px solid var(--accent)" : "2px solid transparent",
              background: "transparent",
              color: config.activePanelId === p.id ? "var(--text)" : "var(--text-muted)",
              cursor: "pointer",
              fontSize: 10,
              fontFamily: "inherit",
              position: "relative"
            },
            children: [
              p.icon,
              " ",
              p.title,
              p.badge ? /* @__PURE__ */ jsxDEV_7x81h0kn("span", {
                style: badgeStyle,
                children: p.badge
              }, undefined, false, undefined, this) : null
            ]
          }, p.id, true, undefined, this)),
          /* @__PURE__ */ jsxDEV_7x81h0kn("button", {
            onClick: onToggle,
            style: collapseBtn,
            title: "Collapse",
            children: isLeft ? "◀" : ""
          }, undefined, false, undefined, this)
        ]
      }, undefined, true, undefined, this),
      /* @__PURE__ */ jsxDEV_7x81h0kn("div", {
        style: { flex: 1, overflowY: "auto" },
        children: /* @__PURE__ */ jsxDEV_7x81h0kn(PanelBody, {
          panel: config.panels.find((p) => p.id === config.activePanelId) ?? config.panels[0],
          workspaceId
        }, undefined, false, undefined, this)
      }, undefined, false, undefined, this)
    ]
  }, undefined, true, undefined, this);
}
function BottomDrawer({
  config,
  onToggle,
  onPanelClick,
  workspaceId
}) {
  if (config.collapsed) {
    return /* @__PURE__ */ jsxDEV_7x81h0kn("div", {
      style: {
        height: 28,
        background: "var(--bg-elevated)",
        borderTop: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        fontSize: 11,
        color: "var(--text-muted)",
        cursor: "pointer"
      },
      onClick: onToggle,
      children: [
        config.panels.map((p) => /* @__PURE__ */ jsxDEV_7x81h0kn("span", {
          children: [
            p.icon,
            " ",
            p.title,
            p.badge ? /* @__PURE__ */ jsxDEV_7x81h0kn("span", {
              style: badgeStyle,
              children: p.badge
            }, undefined, false, undefined, this) : null
          ]
        }, p.id, true, undefined, this)),
        /* @__PURE__ */ jsxDEV_7x81h0kn("span", {}, undefined, false, undefined, this)
      ]
    }, undefined, true, undefined, this);
  }
  return /* @__PURE__ */ jsxDEV_7x81h0kn("div", {
    style: { height: config.size, background: "var(--bg-elevated)", borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column" },
    children: [
      /* @__PURE__ */ jsxDEV_7x81h0kn("div", {
        style: { display: "flex", borderBottom: "1px solid var(--border)", background: "var(--bg-subtle)" },
        children: [
          config.panels.map((p) => /* @__PURE__ */ jsxDEV_7x81h0kn("button", {
            onClick: () => onPanelClick(p.id),
            style: {
              flex: 1,
              padding: "4px",
              border: "none",
              borderBottom: config.activePanelId === p.id ? "2px solid var(--accent)" : "2px solid transparent",
              background: "transparent",
              color: config.activePanelId === p.id ? "var(--text)" : "var(--text-muted)",
              cursor: "pointer",
              fontSize: 10,
              fontFamily: "inherit",
              position: "relative"
            },
            children: [
              p.icon,
              " ",
              p.title,
              p.badge ? /* @__PURE__ */ jsxDEV_7x81h0kn("span", {
                style: badgeStyle,
                children: p.badge
              }, undefined, false, undefined, this) : null
            ]
          }, p.id, true, undefined, this)),
          /* @__PURE__ */ jsxDEV_7x81h0kn("button", {
            onClick: onToggle,
            style: collapseBtn,
            title: "Collapse"
          }, undefined, false, undefined, this)
        ]
      }, undefined, true, undefined, this),
      /* @__PURE__ */ jsxDEV_7x81h0kn("div", {
        style: { flex: 1, overflowY: "auto" },
        children: /* @__PURE__ */ jsxDEV_7x81h0kn(PanelBody, {
          panel: config.panels.find((p) => p.id === config.activePanelId) ?? config.panels[0],
          workspaceId
        }, undefined, false, undefined, this)
      }, undefined, false, undefined, this)
    ]
  }, undefined, true, undefined, this);
}
function PanelBody({ panel, workspaceId }) {
  switch (panel.kind) {
    case "conversations":
      return /* @__PURE__ */ jsxDEV_7x81h0kn(ConversationsPanel, {
        workspaceId
      }, undefined, false, undefined, this);
    case "agents":
      return /* @__PURE__ */ jsxDEV_7x81h0kn(AgentsPanel, {
        workspaceId
      }, undefined, false, undefined, this);
    case "todos":
      return /* @__PURE__ */ jsxDEV_7x81h0kn(TodosPanel, {}, undefined, false, undefined, this);
    case "priorities":
      return /* @__PURE__ */ jsxDEV_7x81h0kn(PrioritiesPanel, {}, undefined, false, undefined, this);
    case "hits-tips-tricks":
      return /* @__PURE__ */ jsxDEV_7x81h0kn(HitsTipsPanel, {}, undefined, false, undefined, this);
    case "notifications":
      return /* @__PURE__ */ jsxDEV_7x81h0kn(NotificationsPanel, {}, undefined, false, undefined, this);
    case "presence":
      return /* @__PURE__ */ jsxDEV_7x81h0kn(PresencePanel, {
        workspaceId
      }, undefined, false, undefined, this);
    case "audit":
      return /* @__PURE__ */ jsxDEV_7x81h0kn(AuditPanel, {}, undefined, false, undefined, this);
    case "messenger":
      return /* @__PURE__ */ jsxDEV_7x81h0kn(MessengerPanel, {}, undefined, false, undefined, this);
    default:
      return /* @__PURE__ */ jsxDEV_7x81h0kn("div", {
        style: { padding: 12, fontSize: 11, color: "var(--text-muted)" },
        children: [
          panel.title,
          " panel (custom)"
        ]
      }, undefined, true, undefined, this);
  }
}
function ConversationsPanel({ workspaceId }) {
  const { conversations, loading, error, refresh } = useConversation();
  useEffect(() => {
    refresh();
  }, [workspaceId]);
  return /* @__PURE__ */ jsxDEV_7x81h0kn("div", {
    style: { padding: 8 },
    children: [
      loading && /* @__PURE__ */ jsxDEV_7x81h0kn("div", {
        style: { fontSize: 11, color: "var(--text-muted)", padding: 8 },
        children: "Loading…"
      }, undefined, false, undefined, this),
      error && /* @__PURE__ */ jsxDEV_7x81h0kn("div", {
        style: { fontSize: 11, color: "var(--destructive)", padding: 8 },
        children: error
      }, undefined, false, undefined, this),
      !loading && !error && conversations.length === 0 && /* @__PURE__ */ jsxDEV_7x81h0kn("div", {
        style: { fontSize: 11, color: "var(--text-muted)", padding: 8 },
        children: "No conversations yet."
      }, undefined, false, undefined, this),
      conversations.map((c) => /* @__PURE__ */ jsxDEV_7x81h0kn("div", {
        style: { padding: "6px 8px", borderRadius: 4, fontSize: 11, cursor: "pointer", color: "var(--text)" },
        onMouseEnter: (e) => e.currentTarget.style.background = "var(--accent-subtle)",
        onMouseLeave: (e) => e.currentTarget.style.background = "transparent",
        children: [
          c.title ?? c.id.slice(0, 16),
          c.updatedAt ? ` — ${new Date(c.updatedAt).toLocaleDateString()}` : ""
        ]
      }, c.id, true, undefined, this)),
      /* @__PURE__ */ jsxDEV_7x81h0kn("div", {
        style: { fontSize: 9, color: "var(--text-subtle)", marginTop: 8, padding: "0 8px" },
        children: [
          "workspace: ",
          workspaceId.slice(0, 24)
        ]
      }, undefined, true, undefined, this)
    ]
  }, undefined, true, undefined, this);
}
function AgentsPanel({ workspaceId }) {
  const [agents, setAgents] = useState([]);
  useEffect(() => {
    fetch(`/api/agent/list?workspaceId=${encodeURIComponent(workspaceId)}`).then((r) => r.json()).then((d) => {
      if (d.ok)
        setAgents(d.agents.map((a) => ({ name: a.name, status: a.status, steps: a.steps.length })));
    }).catch(() => {});
  }, [workspaceId]);
  return /* @__PURE__ */ jsxDEV_7x81h0kn("div", {
    style: { padding: 8 },
    children: [
      agents.length === 0 && /* @__PURE__ */ jsxDEV_7x81h0kn("div", {
        style: { fontSize: 11, color: "var(--text-muted)", padding: 8 },
        children: "No agents in this workspace."
      }, undefined, false, undefined, this),
      agents.map((a, i) => /* @__PURE__ */ jsxDEV_7x81h0kn("div", {
        style: { padding: "6px 8px", borderRadius: 4, fontSize: 11, color: "var(--text)" },
        children: [
          a.name,
          " ",
          /* @__PURE__ */ jsxDEV_7x81h0kn("span", {
            style: { color: "var(--text-muted)" },
            children: [
              "· ",
              a.steps,
              " steps · ",
              a.status
            ]
          }, undefined, true, undefined, this)
        ]
      }, i, true, undefined, this))
    ]
  }, undefined, true, undefined, this);
}
function TodosPanel() {
  const todos = [
    { id: 1, text: "Review research plan", done: false },
    { id: 2, text: "Transcribe video clip", done: false },
    { id: 3, text: "Approve agent output", done: true }
  ];
  return /* @__PURE__ */ jsxDEV_7x81h0kn("div", {
    style: { padding: 8 },
    children: todos.map((t) => /* @__PURE__ */ jsxDEV_7x81h0kn("label", {
      style: { display: "flex", gap: 6, padding: "4px 8px", fontSize: 11, color: t.done ? "var(--text-muted)" : "var(--text)", textDecoration: t.done ? "line-through" : "none", cursor: "pointer" },
      children: [
        /* @__PURE__ */ jsxDEV_7x81h0kn("input", {
          type: "checkbox",
          defaultChecked: t.done,
          style: { accentColor: "var(--accent)" }
        }, undefined, false, undefined, this),
        t.text
      ]
    }, t.id, true, undefined, this))
  }, undefined, false, undefined, this);
}
function PrioritiesPanel() {
  const items = [
    { id: 1, label: "P0: Approve HITL gate", color: "#ef4444" },
    { id: 2, label: "P1: Draft blog post", color: "#f59e0b" }
  ];
  return /* @__PURE__ */ jsxDEV_7x81h0kn("div", {
    style: { padding: 8 },
    children: items.map((p) => /* @__PURE__ */ jsxDEV_7x81h0kn("div", {
      style: { padding: "6px 8px", borderLeft: `3px solid ${p.color}`, background: "var(--bg-subtle)", borderRadius: 4, fontSize: 11, color: "var(--text)", marginBottom: 4 },
      children: p.label
    }, p.id, false, undefined, this))
  }, undefined, false, undefined, this);
}
function HitsTipsPanel() {
  const tips = [
    "Press ⌘K to open the command palette.",
    "Right-click anywhere for quick actions.",
    "Switch workspaces to re-resolve the canvas under a new traceId.",
    "Use the Shell tab to run CLI commands from the canvas.",
    "Toggle Z-layers in the panel to focus on one layer at a time."
  ];
  return /* @__PURE__ */ jsxDEV_7x81h0kn("div", {
    style: { padding: 8 },
    children: tips.map((t, i) => /* @__PURE__ */ jsxDEV_7x81h0kn("div", {
      style: { padding: "6px 8px", fontSize: 11, color: "var(--text)", lineHeight: 1.4, borderBottom: i < tips.length - 1 ? "1px solid var(--border)" : "none" },
      children: t
    }, i, false, undefined, this))
  }, undefined, false, undefined, this);
}
function NotificationsPanel() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    fetch("/api/notification/list?userId=user:demo&limit=10").then((r) => r.json()).then((d) => {
      if (d.ok)
        setItems(d.notifications);
    }).catch(() => {});
  }, []);
  return /* @__PURE__ */ jsxDEV_7x81h0kn("div", {
    style: { padding: 8 },
    children: [
      items.length === 0 && /* @__PURE__ */ jsxDEV_7x81h0kn("div", {
        style: { fontSize: 11, color: "var(--text-muted)" },
        children: "No activity."
      }, undefined, false, undefined, this),
      items.map((n, i) => /* @__PURE__ */ jsxDEV_7x81h0kn("div", {
        style: { padding: "4px 8px", fontSize: 10, color: "var(--text)", borderBottom: "1px solid var(--border)" },
        children: n.title
      }, i, false, undefined, this))
    ]
  }, undefined, true, undefined, this);
}
function PresencePanel({ workspaceId }) {
  const [users, setUsers] = useState([]);
  useEffect(() => {
    fetch(`/api/presence/list?workspaceId=${encodeURIComponent(workspaceId)}`).then((r) => r.json()).then((d) => {
      if (d.ok)
        setUsers(d.users);
    }).catch(() => {});
  }, [workspaceId]);
  return /* @__PURE__ */ jsxDEV_7x81h0kn("div", {
    style: { padding: 8 },
    children: users.map((u, i) => /* @__PURE__ */ jsxDEV_7x81h0kn("div", {
      style: { display: "flex", alignItems: "center", gap: 6, padding: "4px 8px", fontSize: 11, color: "var(--text)" },
      children: [
        /* @__PURE__ */ jsxDEV_7x81h0kn("span", {
          style: { width: 20, height: 20, borderRadius: "50%", background: u.avatarColor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11 },
          children: u.avatarEmoji
        }, undefined, false, undefined, this),
        u.displayName
      ]
    }, i, true, undefined, this))
  }, undefined, false, undefined, this);
}
function AuditPanel() {
  const [entries, setEntries] = useState([]);
  useEffect(() => {
    fetch("/api/audit/list?limit=10").then((r) => r.json()).then((d) => {
      if (d.ok)
        setEntries(d.entries);
    }).catch(() => {});
  }, []);
  return /* @__PURE__ */ jsxDEV_7x81h0kn("div", {
    style: { padding: 8 },
    children: [
      entries.length === 0 && /* @__PURE__ */ jsxDEV_7x81h0kn("div", {
        style: { fontSize: 11, color: "var(--text-muted)" },
        children: "No audit events."
      }, undefined, false, undefined, this),
      entries.map((e, i) => /* @__PURE__ */ jsxDEV_7x81h0kn("div", {
        style: { padding: "3px 8px", fontSize: 10, color: "var(--text)", borderLeft: `2px solid ${e.ok ? "#10b981" : "#ef4444"}`, marginBottom: 2 },
        children: [
          e.engine,
          " · ",
          e.method,
          " · ",
          e.durationMs,
          "ms"
        ]
      }, i, true, undefined, this))
    ]
  }, undefined, true, undefined, this);
}
function MessengerPanel() {
  return /* @__PURE__ */ jsxDEV_7x81h0kn("div", {
    style: { padding: 8, fontSize: 11, color: "var(--text-muted)" },
    children: [
      /* @__PURE__ */ jsxDEV_7x81h0kn("div", {
        style: { fontWeight: 600, color: "var(--text)", marginBottom: 4 },
        children: "#general"
      }, undefined, false, undefined, this),
      /* @__PURE__ */ jsxDEV_7x81h0kn("div", {
        style: { padding: 4 },
        children: "Maya: just pushed the new doc layout"
      }, undefined, false, undefined, this),
      /* @__PURE__ */ jsxDEV_7x81h0kn("div", {
        style: { padding: 4 },
        children: "Theo: looks great "
      }, undefined, false, undefined, this),
      /* @__PURE__ */ jsxDEV_7x81h0kn("div", {
        style: { padding: 4 },
        children: "Sage: ship it"
      }, undefined, false, undefined, this)
    ]
  }, undefined, true, undefined, this);
}
const collapseBtn = {
  border: "none",
  background: "transparent",
  color: "var(--text-muted)",
  cursor: "pointer",
  fontSize: 11,
  padding: "4px 8px",
  fontFamily: "inherit"
};
const badgeStyle = {
  display: "inline-block",
  minWidth: 14,
  height: 14,
  padding: "0 3px",
  background: "var(--accent)",
  color: "var(--accent-fg)",
  borderRadius: 7,
  fontSize: 9,
  fontWeight: 700,
  lineHeight: "14px",
  textAlign: "center"
};
