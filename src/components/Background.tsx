import { useEffect, useRef } from "react";
import { usePrefs } from "../lib/prefs";

/*
  Fundo: ondas finas de luz na parte de baixo da tela (canvas) e uma listra
  diagonal translúcida com um brilho que corre em loop (CSS).
  Pausa com a aba oculta e desliga com a opção "Efeitos de fundo".
*/

const LINES = 9;
const DOT_STEP = 16;

export function Background() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { prefs, resolvedTheme } = usePrefs();

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const styles = getComputedStyle(document.documentElement);
    const accent = styles.getPropertyValue("--accent").trim() || "#ff6fb5";
    const accent2 = styles.getPropertyValue("--accent-2").trim() || "#b69cff";
    const strength = Number(styles.getPropertyValue("--wave-opacity")) || 1;

    let w = 0;
    let h = 0;
    let raf = 0;
    let last = 0;
    let t = Math.random() * 100;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = Math.round(Math.max(260, window.innerHeight * 0.5));
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw();
    };

    const waveY = (x: number, i: number) => {
      const base = h * 0.58 + i * 7;
      return (
        base +
        Math.sin(x * 0.0042 + t * 0.35 + i * 0.45) * (h * 0.14) +
        Math.sin(x * 0.0098 - t * 0.22 + i * 0.9) * (h * 0.05) +
        Math.sin(x * 0.0017 + t * 0.12) * (h * 0.08)
      );
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      const fade = ctx.createLinearGradient(0, 0, w, 0);
      fade.addColorStop(0, "transparent");
      fade.addColorStop(0.2, accent);
      fade.addColorStop(0.65, accent2);
      fade.addColorStop(1, "transparent");

      ctx.lineWidth = 1;
      ctx.strokeStyle = fade;
      ctx.shadowColor = accent;
      ctx.shadowBlur = 10;
      for (let i = 0; i < LINES; i++) {
        ctx.globalAlpha = (0.12 + (i / LINES) * 0.32) * strength;
        ctx.beginPath();
        for (let x = 0; x <= w; x += 8) {
          const y = waveY(x, i);
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      // partículas que brilham ao longo de duas ondas
      ctx.shadowBlur = 6;
      ctx.fillStyle = fade;
      for (const i of [1, LINES - 1]) {
        for (let x = 0; x <= w; x += DOT_STEP) {
          const twinkle = 0.5 + 0.5 * Math.sin(x * 0.05 + t * 1.6 + i);
          ctx.globalAlpha = twinkle * 0.55 * strength;
          ctx.beginPath();
          ctx.arc(x, waveY(x, i) - 6 * Math.sin(x * 0.02 + t), 1.1, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
    };

    const frame = (now: number) => {
      const dt = last ? Math.min(64, now - last) : 16;
      last = now;
      t += dt * 0.0006;
      draw();
      raf = requestAnimationFrame(frame);
    };

    const start = () => {
      if (raf || document.hidden) return;
      last = 0;
      raf = requestAnimationFrame(frame);
    };
    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };
    const onVisibility = () => (document.hidden ? stop() : start());

    if (prefs.fx === "off") {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    resize();
    start();
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [prefs.fx, prefs.accent, resolvedTheme]);

  return (
    <div className="bg" aria-hidden="true">
      <div className="bg-stripe" />
      <canvas ref={canvasRef} className="bg-waves" />
    </div>
  );
}
