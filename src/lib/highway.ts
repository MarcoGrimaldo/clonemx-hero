import { LANE_COUNT } from "./chart";

/** Rosa mexicano, naranja, amarillo, verde, turquesa. */
export const LANE_COLORS = ["#e4007c", "#ff7a00", "#ffc400", "#00a86b", "#00b3c7"];

/** Seconds of chart visible between the horizon and the strike line. */
export const LOOKAHEAD = 1.6;

export interface DrawNote {
  t: number;
  lane: number;
  /** Hit notes are not drawn; missed ones are drawn faded. */
  result?: string;
}

export interface Popup {
  lane: number;
  text: string;
  color: string;
  /** performance.now() when it appeared */
  at: number;
}

export interface Frame {
  t: number;
  notes: readonly DrawNote[];
  pressed: readonly boolean[];
  popups?: Popup[];
  hud?: { score: number; combo: number; multiplier: number };
  now: number;
}

const POPUP_MS = 600;

function fitCanvas(canvas: HTMLCanvasElement) {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  const pw = Math.round(w * dpr);
  const ph = Math.round(h * dpr);
  if (canvas.width !== pw || canvas.height !== ph) {
    canvas.width = pw;
    canvas.height = ph;
  }
  const ctx = canvas.getContext("2d")!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w, h };
}

export function drawHighway(canvas: HTMLCanvasElement, frame: Frame) {
  const { ctx, w, h } = fitCanvas(canvas);
  ctx.clearRect(0, 0, w, h);

  const horizonY = h * 0.05;
  const strikeY = h * 0.84;
  const cx = w / 2;
  const bottomW = Math.min(w * 0.94, h * 0.8, 600);
  const topW = bottomW * 0.28;

  // Depth n: 0 at the horizon, 1 at the strike line, >1 below it.
  const yAt = (n: number) => horizonY + (strikeY - horizonY) * n;
  const widthAt = (n: number) => topW + (bottomW - topW) * n;
  // Perspective: equal time steps get closer together toward the horizon.
  const depthOf = (z: number) => (z >= 0 ? (1 / (1 + z * 3) - 0.25) / 0.75 : 1 - 4 * z);
  const laneX = (lane: number, n: number) => cx + (lane - (LANE_COUNT - 1) / 2) * (widthAt(n) / LANE_COUNT);

  // Board
  const nBottom = (h - horizonY) / (strikeY - horizonY);
  const board = ctx.createLinearGradient(0, horizonY, 0, h);
  board.addColorStop(0, "#0c0a14");
  board.addColorStop(1, "#241b33");
  ctx.fillStyle = board;
  ctx.beginPath();
  ctx.moveTo(cx - topW / 2, horizonY);
  ctx.lineTo(cx + topW / 2, horizonY);
  ctx.lineTo(cx + widthAt(nBottom) / 2, h);
  ctx.lineTo(cx - widthAt(nBottom) / 2, h);
  ctx.closePath();
  ctx.fill();

  // Lane dividers
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= LANE_COUNT; i++) {
    const f = i / LANE_COUNT - 0.5;
    ctx.beginPath();
    ctx.moveTo(cx + f * topW, horizonY);
    ctx.lineTo(cx + f * widthAt(nBottom), h);
    ctx.stroke();
  }

  // Time lines every half second, so the board visibly moves
  const step = 0.5;
  for (let lt = Math.ceil(frame.t / step) * step; lt < frame.t + LOOKAHEAD; lt += step) {
    const n = depthOf((lt - frame.t) / LOOKAHEAD);
    const width = widthAt(n);
    ctx.strokeStyle = `rgba(255,255,255,${0.04 + 0.1 * n})`;
    ctx.beginPath();
    ctx.moveTo(cx - width / 2, yAt(n));
    ctx.lineTo(cx + width / 2, yAt(n));
    ctx.stroke();
  }

  // Strike targets
  const strikeLaneW = bottomW / LANE_COUNT;
  for (let lane = 0; lane < LANE_COUNT; lane++) {
    const x = laneX(lane, 1);
    const rx = strikeLaneW * 0.38;
    ctx.beginPath();
    ctx.ellipse(x, strikeY, rx, rx * 0.5, 0, 0, Math.PI * 2);
    ctx.lineWidth = 3;
    ctx.strokeStyle = LANE_COLORS[lane];
    ctx.stroke();
    if (frame.pressed[lane]) {
      ctx.globalAlpha = 0.45;
      ctx.fillStyle = LANE_COLORS[lane];
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  // Notes, far to near so closer ones are drawn on top
  for (let i = frame.notes.length - 1; i >= 0; i--) {
    const note = frame.notes[i];
    if (note.result && note.result !== "miss") continue;
    const z = (note.t - frame.t) / LOOKAHEAD;
    if (z > 1 || z < -0.06) continue;
    const n = depthOf(z);
    const x = laneX(note.lane, n);
    const y = yAt(n);
    const rx = (widthAt(n) / LANE_COUNT) * 0.36;
    const ry = rx * 0.5;
    ctx.globalAlpha = (note.result === "miss" ? 0.3 : 1) * Math.min(1, (1 - z) * 6);
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = LANE_COLORS[note.lane];
    ctx.fill();
    ctx.lineWidth = Math.max(1, rx * 0.12);
    ctx.strokeStyle = "rgba(0,0,0,0.6)";
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(x, y - ry * 0.15, rx * 0.45, ry * 0.4, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Judgment popups
  ctx.textAlign = "center";
  ctx.font = "bold 18px system-ui, sans-serif";
  if (frame.popups) {
    for (let i = frame.popups.length - 1; i >= 0; i--) {
      const popup = frame.popups[i];
      const age = frame.now - popup.at;
      if (age > POPUP_MS) {
        frame.popups.splice(i, 1);
        continue;
      }
      ctx.globalAlpha = 1 - age / POPUP_MS;
      ctx.fillStyle = popup.color;
      ctx.fillText(popup.text, laneX(popup.lane, 1), strikeY - 36 - age * 0.05);
    }
    ctx.globalAlpha = 1;
  }

  // Score
  if (frame.hud) {
    const { score, combo, multiplier } = frame.hud;
    ctx.textAlign = "left";
    ctx.fillStyle = "#fff";
    ctx.font = "bold 28px system-ui, sans-serif";
    ctx.fillText(score.toLocaleString("es-MX"), 16, 40);
    ctx.font = "16px system-ui, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.fillText(`Combo ${combo}`, 16, 64);
    if (multiplier > 1) {
      ctx.fillStyle = LANE_COLORS[multiplier];
      ctx.font = "bold 22px system-ui, sans-serif";
      ctx.fillText(`x${multiplier}`, 16, 92);
    }
  }
}
