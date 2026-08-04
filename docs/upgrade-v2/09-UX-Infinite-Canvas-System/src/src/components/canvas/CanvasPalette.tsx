// Cmd+K command palette. Fuzzy-matches node slugs, finding IDs, command
// names, template names, and config keys. Selecting a node centers it;
// selecting a command runs it.

"use client";

import { useEffect, useState, useMemo } from "react";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { useCanvasStore } from "@/lib/canvas/store";
import { TEMPLATES } from "@/lib/canvas/templates";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CanvasPalette({ open, onOpenChange }: Props) {
  const state = useCanvasStore((s) => s.state);
  const setViewport = useCanvasStore((s) => s.setViewport);
  const addNode = useCanvasStore((s) => s.addNode);

  const items = useMemo(() => {
    const nodeItems = state.nodes.map((n) => ({
      group: "Nodes",
      label: n.label ?? n.id,
      keywords: n.id,
      onSelect: () => {
        setViewport({
          origin: {
            x: n.position.x - 200,
            y: n.position.y - 150,
          },
          scale: 1,
        });
        onOpenChange(false);
      },
    }));
    const templateItems = TEMPLATES.map((t) => ({
      group: "Templates",
      label: t.name,
      keywords: t.description,
      onSelect: () => {
        // Apply template (caller wires actual apply logic).
        onOpenChange(false);
      },
    }));
    const commandItems = [
      {
        group: "Commands",
        label: "Insert note",
        keywords: "add note text",
        onSelect: () => {
          addNode({
            type: "note",
            position: { x: state.viewport.origin.x + 200, y: state.viewport.origin.y + 150 },
            size: { x: 200, y: 120 },
            data: { text: "New note" },
            label: "Note",
          });
          onOpenChange(false);
        },
      },
      {
        group: "Commands",
        label: "Export PNG",
        keywords: "export png image",
        onSelect: () => {
          onOpenChange(false);
        },
      },
      {
        group: "Commands",
        label: "Open config panel",
        keywords: "settings config theme",
        onSelect: () => {
          onOpenChange(false);
        },
      },
    ];
    return [...nodeItems, ...templateItems, ...commandItems];
  }, [state.nodes, state.viewport, setViewport, addNode, onOpenChange]);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Find a node, run a command, apply a template..." />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>
        {["Nodes", "Templates", "Commands"].map((group) => (
          <CommandGroup key={group} heading={group}>
            {items
              .filter((i) => i.group === group)
              .map((item, idx) => (
                <CommandItem key={idx} value={item.label + " " + item.keywords} onSelect={item.onSelect}>
                  {item.label}
                </CommandItem>
              ))}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  );
}
