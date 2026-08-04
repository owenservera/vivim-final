// Schema-driven config panel. Renders a form for every field in CanvasConfig
// and writes back to the store on change. Pairs with the "Reset to defaults"
// button. Lives in a right-side Sheet so it doesn't take screen space from
// the canvas.

"use client";

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useCanvasStore } from "@/lib/canvas/store";
import { DEFAULT_CANVAS_CONFIG, type Theme, type GridStyle, type ZoomGesture } from "@/lib/canvas/config";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CanvasConfigPanel({ open, onOpenChange }: Props) {
  const config = useCanvasStore((s) => s.config);
  const setConfig = useCanvasStore((s) => s.setConfig);
  const resetConfig = useCanvasStore((s) => s.resetConfig);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[420px] sm:w-[540px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Canvas configuration</SheetTitle>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          {/* Theme */}
          <section className="space-y-2">
            <Label>Theme</Label>
            <Select value={config.theme} onValueChange={(v) => setConfig({ theme: v as Theme })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="auto">Auto (system)</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </section>

          {/* Grid */}
          <section className="space-y-2">
            <Label>Grid style</Label>
            <Select value={config.grid.style} onValueChange={(v) => setConfig({ grid: { ...config.grid, style: v as GridStyle } })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="dots">Dots</SelectItem>
                <SelectItem value="lines">Lines</SelectItem>
                <SelectItem value="cross">Cross</SelectItem>
              </SelectContent>
            </Select>
            <Label>Grid size: {config.grid.size}px</Label>
            <Slider value={[config.grid.size]} min={8} max={96} step={4}
              onValueChange={([v]) => setConfig({ grid: { ...config.grid, size: v } })} />
          </section>

          {/* Snap */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Snap to grid</Label>
              <Switch checked={config.snap.enabled}
                onCheckedChange={(v) => setConfig({ snap: { ...config.snap, enabled: v } })} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Snap to nodes</Label>
              <Switch checked={config.snap.toNodes}
                onCheckedChange={(v) => setConfig({ snap: { ...config.snap, toNodes: v } })} />
            </div>
          </section>

          {/* Zoom */}
          <section className="space-y-2">
            <Label>Zoom gesture</Label>
            <Select value={config.zoom.wheelMode} onValueChange={(v) => setConfig({ zoom: { ...config.zoom, wheelMode: v as ZoomGesture } })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="wheel">Plain wheel</SelectItem>
                <SelectItem value="cmd-scroll">Cmd/Ctrl + scroll</SelectItem>
                <SelectItem value="pinch">Pinch (trackpad)</SelectItem>
                <SelectItem value="scroll-then-pinch">Scroll pan, pinch zoom</SelectItem>
              </SelectContent>
            </Select>
            <Label>Min zoom: {config.zoom.min.toFixed(2)}x</Label>
            <Slider value={[config.zoom.min]} min={0.01} max={0.5} step={0.01}
              onValueChange={([v]) => setConfig({ zoom: { ...config.zoom, min: v } })} />
            <Label>Max zoom: {config.zoom.max.toFixed(1)}x</Label>
            <Slider value={[config.zoom.max]} min={1} max={20} step={0.5}
              onValueChange={([v]) => setConfig({ zoom: { ...config.zoom, max: v } })} />
          </section>

          {/* Node defaults */}
          <section className="space-y-2">
            <Label>Default node size</Label>
            <Select value={config.nodes.defaultSize}
              onValueChange={(v) => setConfig({ nodes: { ...config.nodes, defaultSize: v as "compact" | "comfortable" | "spacious" } })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="compact">Compact (200x120)</SelectItem>
                <SelectItem value="comfortable">Comfortable (320x200)</SelectItem>
                <SelectItem value="spacious">Spacious (480x280)</SelectItem>
              </SelectContent>
            </Select>
            <Label>Font size: {config.nodes.fontSize}px</Label>
            <Slider value={[config.nodes.fontSize]} min={10} max={24} step={1}
              onValueChange={([v]) => setConfig({ nodes: { ...config.nodes, fontSize: v } })} />
            <Label>Border radius: {config.nodes.borderRadius}px</Label>
            <Slider value={[config.nodes.borderRadius]} min={0} max={24} step={1}
              onValueChange={([v]) => setConfig({ nodes: { ...config.nodes, borderRadius: v } })} />
          </section>

          {/* Persistence */}
          <section className="space-y-2">
            <Label>Autosave delay: {config.persistence.autosaveMs}ms</Label>
            <Slider value={[config.persistence.autosaveMs]} min={100} max={5000} step={100}
              onValueChange={([v]) => setConfig({ persistence: { ...config.persistence, autosaveMs: v } })} />
            <Label>Version history: {config.persistence.versionHistory} versions</Label>
            <Slider value={[config.persistence.versionHistory]} min={0} max={200} step={10}
              onValueChange={([v]) => setConfig({ persistence: { ...config.persistence, versionHistory: v } })} />
          </section>

          {/* Collaboration */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Enable collaboration (Y.js CRDT)</Label>
              <Switch checked={config.collaboration.enabled}
                onCheckedChange={(v) => setConfig({ collaboration: { ...config.collaboration, enabled: v } })} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Show presence avatars</Label>
              <Switch checked={config.collaboration.presence}
                onCheckedChange={(v) => setConfig({ collaboration: { ...config.collaboration, presence: v } })} />
            </div>
          </section>

          {/* Reset */}
          <Button variant="outline" className="w-full" onClick={resetConfig}>
            Reset to defaults
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
