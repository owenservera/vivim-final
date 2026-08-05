import { jsxDEV as jsxDEV_7x81h0kn } from "react/jsx-dev-runtime";
"use client";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useResolvedNodes } from "./use-resolved-nodes";
import { useCanvasEvents } from "./use-canvas-events";
const Ctx = createContext(null);
export function LiveConfigProvider(props) {
  const [workspaceId, setWorkspace] = useState(props.initialWorkspaceId ?? "ws:default");
  const [providerIds, setProviderIds] = useState(props.initialProviderIds ?? []);
  const [accounts, setAccounts] = useState(props.initialAccounts ?? []);
  const [variant, setVariant] = useState(props.initialVariant);
  const userId = props.initialUserId ?? "user:1";
  const slotIds = props.initialSlotIds ?? [
    "chat.header",
    "chat.sidebar",
    "chat.thread",
    "chat.composer",
    "chat.send",
    "chat.attach",
    "chat.streaming",
    "chat.result",
    "chat.actionBar"
  ];
  const resolveReq = useMemo(() => ({ workspaceId, userId, providerIds, accounts, slotIds, variant }), [workspaceId, userId, providerIds, accounts, slotIds, variant]);
  const { data, isLoading, error } = useResolvedNodes(resolveReq);
  useCanvasEvents(workspaceId);
  const patchDefinition = useCallback(async (id, patch) => {
    await fetch(`/api/canvas/definition/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch)
    });
  }, []);
  const value = useMemo(() => ({
    surface: data,
    isLoading,
    error,
    workspaceId,
    setWorkspace,
    providerIds,
    setProviderIds,
    accounts,
    setAccounts,
    variant,
    setVariant,
    patchDefinition
  }), [data, isLoading, error, workspaceId, providerIds, accounts, variant, patchDefinition]);
  return /* @__PURE__ */ jsxDEV_7x81h0kn(Ctx.Provider, {
    value,
    children: props.children
  }, undefined, false, undefined, this);
}
export function useLiveConfig() {
  const v = useContext(Ctx);
  if (!v)
    throw new Error("useLiveConfig must be used inside <LiveConfigProvider>");
  return v;
}
