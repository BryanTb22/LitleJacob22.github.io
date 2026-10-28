/* Partículas rojizas de fondo (igual que la tienda) para la página de rifas */
(function () {
  "use strict";
  var canvas = document.getElementById("emberCanvas");
  if (!canvas || !canvas.getContext) return;
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  var ctx = canvas.getContext("2d"), width, height;
  function medir() { width = canvas.width = window.innerWidth; height = canvas.height = window.innerHeight; }
  medir(); window.addEventListener("resize", medir);
  var particles = Array.from({ length: Math.min(55, Math.floor(width / 25)) }, function () {
    return { x: Math.random() * width, y: Math.random() * height, size: Math.random() * 2.2 + 0.6, speedY: -(Math.random() * 0.45 + 0.12), speedX: (Math.random() - 0.5) * 0.3, alpha: Math.random() * 0.65 + 0.15, hue: Math.random() > 0.3 ? 2 : 16 };
  });
  (function animate() {
    ctx.clearRect(0, 0, width, height);
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      p.y += p.speedY; p.x += p.speedX;
      if (p.y < -10) { p.y = height + 10; p.x = Math.random() * width; }
      if (p.x < -10) p.x = width + 10;
      if (p.x > width + 10) p.x = -10;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = "hsla(" + p.hue + ", 90%, 60%, " + p.alpha + ")";
      ctx.shadowBlur = 8; ctx.shadowColor = "hsla(" + p.hue + ", 95%, 55%, 0.8)";
      ctx.fill();
    }
    requestAnimationFrame(animate);
  })();
})();
