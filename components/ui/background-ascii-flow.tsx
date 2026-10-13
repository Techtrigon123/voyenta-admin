"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Slipstream — an ambient ASCII flow-field background. A 2D value-noise
// potential is sampled on a coarse sub-grid and its CURL (vx = dP/dy,
// vy = -dP/dx) is drawn as a faint direction glyph per cell. Tracer particles
// ride the same time-evolving field, each keeping a short ring buffer of past
// positions redrawn at falling alpha as a trail. The pointer adds a local
// vortex that eases in while hovering and back out on leave.
//
// Colours: particles use the canvas's text colour; the ambient field uses
// --ns-muted (read from the canvas, so a parent can override it locally).
// ---------------------------------------------------------------------------

// Indexed by the velocity angle folded to [0, PI) in 45° steps. Canvas y points
// down, so 45° (moving right and down) is "\" and 135° is "/".
const DIR_CHARS = ["-", "\\", "|", "/"] as const;
const NOISE_FREQ = 0.05; // spatial frequency of the potential field
const FIELD_SPEED = 0.06; // t units/s the potential drifts
const CURL_SCALE = 46; // maps potential gradient to px/s particle speed
const AMBIENT_STEP = 3; // ambient direction glyph sampled every N cells
const AMBIENT_ALPHA_MAX = 0.55;
const AMBIENT_CUTOFF = 0.4; // below this normalized speed, draw nothing — real negative space
const PARTICLE_COUNT_MIN = 60;
const PARTICLE_COUNT_MAX = 130;
const TRAIL_LEN = 4;
const VORTEX_RADIUS = 120; // px
const VORTEX_STRENGTH = 2.4; // px/s per unit falloff, at full ramp
const VORTEX_EASE = 0.06;
const DT_MAX = 0.05;

function hash2(ix: number, iy: number, seed: number): number {
  const s = Math.sin(ix * 127.1 + iy * 311.7 + seed * 74.7) * 43758.5453;
  return s - Math.floor(s);
}

function smooth(t: number) {
  return t * t * (3 - 2 * t);
}

// bilinear value noise, [0, 1)
function noise2D(x: number, y: number, seed: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = smooth(x - x0);
  const ty = smooth(y - y0);
  const a = hash2(x0, y0, seed);
  const b = hash2(x0 + 1, y0, seed);
  const c = hash2(x0, y0 + 1, seed);
  const d = hash2(x0 + 1, y0 + 1, seed);
  const top = a + (b - a) * tx;
  const bot = c + (d - c) * tx;
  return top + (bot - top) * ty;
}

function potential(x: number, y: number, t: number): number {
  const n1 = noise2D(x * NOISE_FREQ, y * NOISE_FREQ + t, 11.3);
  const n2 = noise2D(x * NOISE_FREQ * 2.3 - t * 0.6, y * NOISE_FREQ * 2.3, 47.9);
  return n1 * 0.7 + n2 * 0.3;
}

// curl of the scalar potential field -> divergence-free velocity
function curlVel(x: number, y: number, t: number, eps: number): [number, number] {
  const py1 = potential(x, y + eps, t);
  const py0 = potential(x, y - eps, t);
  const px1 = potential(x + eps, y, t);
  const px0 = potential(x - eps, y, t);
  const vx = ((py1 - py0) / (2 * eps)) * CURL_SCALE;
  const vy = -((px1 - px0) / (2 * eps)) * CURL_SCALE;
  return [vx, vy];
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function dirChar(vx: number, vy: number): string {
  let a = Math.atan2(vy, vx) % Math.PI;
  if (a < 0) a += Math.PI;
  const idx = Math.round(a / (Math.PI / 4)) % 4;
  return DIR_CHARS[idx]!;
}

export interface SlipstreamProps {
  /** grid cell size in px */
  cellSize?: number;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

export function Slipstream({ cellSize = 14, className }: SlipstreamProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let fg = "currentColor";
    let muted = "currentColor";
    let cellW = cellSize;
    let cellH = cellSize;
    let cols = 0;
    let rows = 0;
    let width = 0;
    let height = 0;
    let dpr = 1;
    let sized = false;
    let ready = false;
    let disposed = false;

    let particleCount = 0;
    let px: Float32Array = new Float32Array(0);
    let py: Float32Array = new Float32Array(0);
    // ring buffer of the last TRAIL_LEN positions, flattened [p*TRAIL_LEN + slot]
    let histX: Float32Array = new Float32Array(0);
    let histY: Float32Array = new Float32Array(0);
    let histLive: Int32Array = new Int32Array(0); // how many history slots are filled
    let histHead: Int32Array = new Int32Array(0); // ring write cursor
    let velX: Float32Array = new Float32Array(0);
    let velY: Float32Array = new Float32Array(0);

    const readTokens = () => {
      const style = getComputedStyle(canvas);
      fg = style.color;
      muted = style.getPropertyValue("--ns-muted").trim() || fg;
    };

    const measureCell = (fontFamily: string) => {
      const off = document.createElement("canvas");
      const octx = off.getContext("2d");
      if (!octx) return;
      octx.font = `${cellSize}px ${fontFamily}`;
      cellW = Math.max(4, octx.measureText("MMMMMMMMMM").width / 10);
      cellH = cellSize;
    };

    const seedParticles = () => {
      const rand = mulberry32(0xf1044);
      particleCount = Math.max(PARTICLE_COUNT_MIN, Math.min(PARTICLE_COUNT_MAX, Math.floor(cols * rows * 0.045)));
      px = new Float32Array(particleCount);
      py = new Float32Array(particleCount);
      histX = new Float32Array(particleCount * TRAIL_LEN);
      histY = new Float32Array(particleCount * TRAIL_LEN);
      histLive = new Int32Array(particleCount);
      histHead = new Int32Array(particleCount);
      velX = new Float32Array(particleCount);
      velY = new Float32Array(particleCount);
      for (let i = 0; i < particleCount; i++) {
        const x = rand() * width;
        const y = rand() * height;
        px[i] = x;
        py[i] = y;
        for (let s = 0; s < TRAIL_LEN; s++) {
          histX[i * TRAIL_LEN + s] = x;
          histY[i * TRAIL_LEN + s] = y;
        }
      }
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      if (width < 2 || height < 2) {
        sized = false;
        return;
      }
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const fontFamily = getComputedStyle(canvas).fontFamily;
      measureCell(fontFamily);
      ctx.font = `${cellSize}px ${fontFamily}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      cols = Math.max(4, Math.ceil(width / cellW));
      rows = Math.max(4, Math.ceil(height / cellH));
      seedParticles();
      sized = true;
    };

    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const onResize = () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        resizeTimer = null;
        resize();
        if (reduced) draw(0);
      }, 150);
    };

    // Ambient field glyphs, alpha normalised against this frame's own max speed
    // so slow regions fall below the cutoff into real negative space.
    const drawAmbient = (t: number) => {
      ctx.fillStyle = muted;
      const vxs: number[] = [];
      const vys: number[] = [];
      const speeds: number[] = [];
      let maxSpeed = 1e-6;
      for (let gy = 0; gy < rows; gy += AMBIENT_STEP) {
        for (let gx = 0; gx < cols; gx += AMBIENT_STEP) {
          const [vx, vy] = curlVel(gx * cellW, gy * cellH, t, 1.5);
          const speed = Math.hypot(vx, vy);
          vxs.push(vx);
          vys.push(vy);
          speeds.push(speed);
          if (speed > maxSpeed) maxSpeed = speed;
        }
      }
      let i = 0;
      for (let gy = 0; gy < rows; gy += AMBIENT_STEP) {
        for (let gx = 0; gx < cols; gx += AMBIENT_STEP) {
          const norm = speeds[i]! / maxSpeed;
          if (norm >= AMBIENT_CUTOFF) {
            const shaped = Math.pow((norm - AMBIENT_CUTOFF) / (1 - AMBIENT_CUTOFF), 2.2);
            ctx.globalAlpha = shaped * AMBIENT_ALPHA_MAX;
            ctx.fillText(dirChar(vxs[i]!, vys[i]!), gx * cellW + cellW / 2, gy * cellH + cellH / 2);
          }
          i++;
        }
      }
    };

    const draw = (t: number) => {
      if (!sized) return;
      ctx.clearRect(0, 0, width, height);
      drawAmbient(t);

      ctx.fillStyle = fg;
      for (let i = 0; i < particleCount; i++) {
        const ch = dirChar(velX[i]!, velY[i]!);
        const live = histLive[i]!;
        // Slow particles fade toward the background instead of matching fast ones.
        const speedNorm = Math.min(1, Math.hypot(velX[i]!, velY[i]!) / (CURL_SCALE * 0.6));
        const speedGain = 0.35 + 0.65 * speedNorm;
        for (let s = 0; s < live; s++) {
          const slot = (histHead[i]! - s + TRAIL_LEN * 4) % TRAIL_LEN;
          const alpha = (1 - s / TRAIL_LEN) * speedGain;
          if (alpha <= 0.05) continue;
          ctx.globalAlpha = alpha;
          ctx.fillText(ch, histX[i * TRAIL_LEN + slot]!, histY[i * TRAIL_LEN + slot]!);
        }
      }
      ctx.globalAlpha = 1;
    };

    // -- hot-path state -------------------------------------------------------
    let raf = 0;
    let last = 0;
    let t = 0;
    const vortex = { x: -1e5, y: -1e5, has: false, strength: 0 };

    const step = (dt: number) => {
      t += dt * FIELD_SPEED;
      vortex.strength += ((vortex.has ? 1 : 0) - vortex.strength) * VORTEX_EASE;

      for (let i = 0; i < particleCount; i++) {
        let x = px[i]!;
        let y = py[i]!;
        let [vx, vy] = curlVel(x, y, t, 1.5 * cellW);
        if (vortex.strength > 0.01) {
          const ddx = x - vortex.x;
          const ddy = y - vortex.y;
          const d2 = ddx * ddx + ddy * ddy;
          if (d2 < VORTEX_RADIUS * VORTEX_RADIUS) {
            const dist = Math.sqrt(d2) || 1e-3;
            const falloff = 1 - dist / VORTEX_RADIUS;
            // tangential (perpendicular) push -> a swirl, not a repel
            const mag = falloff * VORTEX_STRENGTH * vortex.strength * 20;
            vx += (-ddy / dist) * mag;
            vy += (ddx / dist) * mag;
          }
        }
        x += vx * dt;
        y += vy * dt;
        if (x < 0) x += width;
        if (x >= width) x -= width;
        if (y < 0) y += height;
        if (y >= height) y -= height;
        px[i] = x;
        py[i] = y;
        velX[i] = vx;
        velY[i] = vy;

        const head = (histHead[i]! + 1) % TRAIL_LEN;
        histHead[i] = head;
        histX[i * TRAIL_LEN + head] = x;
        histY[i * TRAIL_LEN + head] = y;
        if (histLive[i]! < TRAIL_LEN) histLive[i] = histLive[i]! + 1;
      }
    };

    const loop = (now: number) => {
      const dt = last ? Math.min(DT_MAX, (now - last) / 1000) : 1 / 60;
      last = now;
      step(dt);
      draw(t);
      if (!document.hidden) raf = requestAnimationFrame(loop);
    };

    const onPointerMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      vortex.x = e.clientX - rect.left;
      vortex.y = e.clientY - rect.top;
      vortex.has = true;
    };
    const onPointerLeave = () => {
      vortex.has = false;
    };

    const onVis = () => {
      if (!document.hidden && !reduced && ready) {
        cancelAnimationFrame(raf);
        last = 0;
        raf = requestAnimationFrame(loop);
      }
    };
    // Re-read colours when the theme flips (this app uses html[data-theme]).
    const mo = new MutationObserver(() => {
      readTokens();
      if (reduced) draw(t);
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme"] });

    void document.fonts.ready.then(() => {
      if (disposed) return;
      readTokens();
      resize();
      ready = true;
      if (reduced) draw(0);
      else raf = requestAnimationFrame(loop);
    });

    window.addEventListener("resize", onResize);
    if (!reduced) {
      canvas.addEventListener("pointermove", onPointerMove);
      canvas.addEventListener("pointerleave", onPointerLeave);
    }
    document.addEventListener("visibilitychange", onVis);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      if (resizeTimer) clearTimeout(resizeTimer);
      mo.disconnect();
      window.removeEventListener("resize", onResize);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [cellSize]);

  return <canvas ref={canvasRef} aria-hidden className={cn("block h-full w-full font-mono text-foreground", className)} />;
}

export default Slipstream;
