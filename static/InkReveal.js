/**
 * InkReveal.js
 * High-performance interactive scratch-off effect using HTML5 Canvas
 * with destination-out compositing, stamp-based aging, and wobbled circles.
 */

class InkReveal {
  constructor(canvas, options = {}) {
    if (!canvas) {
      console.error("InkReveal: Canvas element is required");
      return;
    }

    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");

    // Default configuration matching the React component design specs
    this.options = {
      maskColor: options.maskColor || [241, 233, 210], // RGB of #F1E9D2 parchment
      brushSize: options.brushSize || 75,
      lifetime: options.lifetime || 1500,
      rStart: options.rStart || 15,
      rVary: options.rVary || 0.25,
      stampStep: options.stampStep || 12,
      maxStamps: options.maxStamps || 200,
      segments: options.segments || 64,
      wobble: options.wobble || [0.08, 0.04, 0.02],
      gradientInnerRadius: options.gradientInnerRadius || 0.15,
      gradientStops: options.gradientStops || [1.0, 0.4, 0.0],
      ...options
    };

    this.stamps = [];
    this.lastX = null;
    this.lastY = null;
    this.isDrawing = false;

    this.init();
  }

  init() {
    this.resizeCanvas();
    window.addEventListener("resize", () => this.resizeCanvas());

    // Start the animation loop
    this.tick = this.tick.bind(this);
    requestAnimationFrame(this.tick);
  }

  resizeCanvas() {
    const rect = this.canvas.getBoundingClientRect();
    // Use devicePixelRatio for high-DPI/Retina screens to maintain premium crispness
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.scale(dpr, dpr);
  }

  // Clear tracking when pointer leaves or stops drawing
  resetPointer() {
    this.lastX = null;
    this.lastY = null;
  }

  // Draw a single stamp along the pointer path
  addPointerMove(x, y) {
    if (this.lastX === null || this.lastY === null) {
      this.addStamp(x, y);
      this.lastX = x;
      this.lastY = y;
      return;
    }

    const dx = x - this.lastX;
    const dy = y - this.lastY;
    const distance = Math.hypot(dx, dy);

    if (distance >= this.options.stampStep) {
      const steps = Math.floor(distance / this.options.stampStep);
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const ix = this.lastX + dx * t;
        const iy = this.lastY + dy * t;
        this.addStamp(ix, iy);
      }
      this.lastX = x;
      this.lastY = y;
    }
  }

  addStamp(x, y) {
    // Prune oldest stamps if exceeding max limit to prevent memory leakage
    if (this.stamps.length >= this.options.maxStamps) {
      this.stamps.shift();
    }

    // Generate random phases for the 3-tier sine wobble circle
    const phases = [
      Math.random() * Math.PI * 2,
      Math.random() * Math.PI * 2,
      Math.random() * Math.PI * 2
    ];

    // Introduce brush size random variation
    const targetRadius = this.options.brushSize * (1 + (Math.random() * 2 - 1) * this.options.rVary);

    this.stamps.push({
      x,
      y,
      createdAt: performance.now(),
      targetRadius,
      phases
    });
  }

  // Animation frame loop
  tick(now) {
    this.updateStamps(now);
    this.draw();
    requestAnimationFrame(this.tick);
  }

  updateStamps(now) {
    // Filter out expired stamps based on lifetime
    this.stamps = this.stamps.filter(stamp => {
      return now - stamp.createdAt < this.options.lifetime;
    });
  }

  draw() {
    const ctx = this.ctx;
    const width = this.canvas.width / (window.devicePixelRatio || 1);
    const height = this.canvas.height / (window.devicePixelRatio || 1);

    // 1. Draw the base mask layer
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    const rgb = this.options.maskColor;
    ctx.fillStyle = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
    ctx.fillRect(0, 0, width, height);

    // 2. Perform destination-out compositing to scratch away mask
    ctx.globalCompositeOperation = "destination-out";

    const now = performance.now();
    const { lifetime, rStart, segments, wobble, gradientInnerRadius, gradientStops } = this.options;

    for (let i = 0; i < this.stamps.length; i++) {
      const stamp = this.stamps[i];
      const age = now - stamp.createdAt;
      const progress = age / lifetime; // 0 to 1

      // Easing calculation for dynamic expansion and smooth fade out
      // Expand quickly at first, then settle
      const radiusProgress = 1 - Math.pow(1 - progress, 3);
      const currentRadius = rStart + (stamp.targetRadius - rStart) * radiusProgress;

      // Opacity starts at 1.0 and fades slowly towards the end of lifetime
      const opacity = 1 - Math.pow(progress, 2);

      // Generate radial gradient for feathered edges
      const grad = ctx.createRadialGradient(
        stamp.x, stamp.y, currentRadius * gradientInnerRadius,
        stamp.x, stamp.y, currentRadius
      );

      grad.addColorStop(0, `rgba(0, 0, 0, ${gradientStops[0] * opacity})`);
      grad.addColorStop(0.5, `rgba(0, 0, 0, ${gradientStops[1] * opacity})`);
      grad.addColorStop(1, `rgba(0, 0, 0, ${gradientStops[2] * opacity})`);

      ctx.fillStyle = grad;

      // Draw wobbled-circle path
      ctx.beginPath();
      const freqs = [5, 8, 13]; // Prime frequencies for natural harmonic wobble

      for (let s = 0; s <= segments; s++) {
        const theta = (s / segments) * Math.PI * 2;
        let wobbleSum = 0;

        for (let w = 0; w < wobble.length; w++) {
          wobbleSum += wobble[w] * Math.sin(freqs[w] * theta + stamp.phases[w]);
        }

        const r = currentRadius * (1 + wobbleSum);
        const px = stamp.x + r * Math.cos(theta);
        const py = stamp.y + r * Math.sin(theta);

        if (s === 0) {
          ctx.moveTo(px, py);
        } else {
          ctx.lineTo(px, py);
        }
      }

      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }
}

// Export to global scope
window.InkReveal = InkReveal;
