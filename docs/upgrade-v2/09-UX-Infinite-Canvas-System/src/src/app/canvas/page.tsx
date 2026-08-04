// /canvas route - the infinite canvas page.
//
// This is the actual interactive canvas. Users land here from the
// "Canvas view" button on the home page. The page mounts the Canvas
// component, the minimap, the config panel, the command palette,
// and a status bar showing the current mode + coordinates.

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Settings, Command as CommandIcon, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Canvas } from "@/components/canvas/Canvas";
import { CanvasMinimap } from "@/components/canvas/CanvasMinimap";
import { CanvasConfigPanel } from "@/components/canvas/CanvasConfigPanel";
import { CanvasPalette } from "@/components/canvas/CanvasPalette";
import { useCanvasStore } from "@/lib/canvas/store";

export default function CanvasPage() {
  const [configOpen, setConfigOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const mode = useCanvasStore((s) => s.mode);
  const state = useCanvasStore((s) => s.state);

  // Cmd+K opens the palette.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div className="h-screen w-screen flex flex-col bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100 overflow-hidden">
      {/* Top bar */}
      <header className="border-b border-stone-200 dark:border-stone-800 bg-white/80 dark:bg-stone-900/80 backdrop-blur px-4 py-3 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Button asChild variant="ghost" size="sm">
            <Link href="/"><ArrowLeft className="w-4 h-4 mr-2" />Back to list</Link>
          </Button>
          <span className="text-sm font-medium truncate">Infinite Canvas</span>
          <Badge variant="outline" className="hidden sm:inline-flex">
            {state.nodes.length} nodes · {state.edges.length} edges
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setPaletteOpen(true)}>
            <CommandIcon className="w-4 h-4 mr-2" />Cmd+K
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setConfigOpen(true)}>
            <Settings className="w-4 h-4 mr-2" />Config
          </Button>
        </div>
      </header>

      {/* Canvas surface */}
      <main className="flex-1 relative">
        <Canvas />
        <CanvasMinimap />
      </main>

      {/* Status bar (bottom) */}
      <footer className="border-t border-stone-200 dark:border-stone-800 bg-white/80 dark:bg-stone-900/80 backdrop-blur px-4 py-2 flex items-center justify-between text-xs font-mono shrink-0">
        <div className="flex items-center gap-4">
          <span className="uppercase tracking-wider text-amber-700 dark:text-amber-400">
            -- {mode} --
          </span>
          <span className="text-stone-500 dark:text-stone-400">
            origin ({state.viewport.origin.x.toFixed(0)}, {state.viewport.origin.y.toFixed(0)}) · scale {(state.viewport.scale * 100).toFixed(0)}%
          </span>
        </div>
        <div className="text-stone-500 dark:text-stone-400 hidden sm:flex items-center gap-2">
          <Eye className="w-3 h-3" />
          <span>Press i to insert a note · dd to delete · c to connect · : for commands</span>
        </div>
      </footer>

      {/* Overlays */}
      <CanvasConfigPanel open={configOpen} onOpenChange={setConfigOpen} />
      <CanvasPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}
