// Efeitos visuais do SaveVault: inclinação 3D das capas, parallax da colagem
// e destaque do menu. Não mexe em dados nem no Supabase.
(() => {
  const here = location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".nav a").forEach((link) => {
    if (link.getAttribute("href") === here) link.setAttribute("aria-current", "page");
  });

  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const mouse = matchMedia("(hover: hover) and (pointer: fine)").matches;
  if (reduce || !mouse) return;

  const TILT = ".game-card, .dashboard-game";
  const collage = document.querySelector(".hero-collage");
  let last = null;
  let frame = 0;
  let pointer = null;

  function reset(el) {
    el.style.removeProperty("--rx");
    el.style.removeProperty("--ry");
  }

  function update() {
    frame = 0;
    const e = pointer;
    if (!e) return;

    const el = e.target.closest ? e.target.closest(TILT) : null;
    if (last && last !== el) reset(last);

    if (el) {
      const box = el.getBoundingClientRect();
      const px = (e.clientX - box.left) / box.width;
      const py = (e.clientY - box.top) / box.height;
      el.style.setProperty("--ry", ((px - 0.5) * 16).toFixed(2) + "deg");
      el.style.setProperty("--rx", ((0.5 - py) * 16).toFixed(2) + "deg");
      el.style.setProperty("--gx", (px * 100).toFixed(1) + "%");
      el.style.setProperty("--gy", (py * 100).toFixed(1) + "%");
    }
    last = el;

    if (collage) {
      collage.style.setProperty("--mx", ((e.clientX / innerWidth - 0.5) * 2).toFixed(3));
      collage.style.setProperty("--my", ((e.clientY / innerHeight - 0.5) * 2).toFixed(3));
    }
  }

  document.addEventListener(
    "pointermove",
    (e) => {
      pointer = e;
      if (!frame) frame = requestAnimationFrame(update);
    },
    { passive: true }
  );

  document.addEventListener("pointerleave", () => {
    if (last) reset(last);
    last = null;
    if (collage) {
      collage.style.setProperty("--mx", 0);
      collage.style.setProperty("--my", 0);
    }
  });
})();
