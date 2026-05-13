import { useEffect, useRef } from 'react';

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  life: number; maxLife: number;
  color: string;
  size: number;
}

const COLORS = ['#FF6B35', '#FFD700', '#FF4136', '#F012BE', '#7FDBFF', '#01FF70', '#FF851B', '#E040FB'];

export default function Fireworks({ onDone }: { onDone: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles: Particle[] = [];
    let frame = 0;
    let animId: number;
    const startTime = Date.now();
    const DURATION = 3000;

    function createBurst(x: number, y: number, color: string) {
      const count = 30 + Math.floor(Math.random() * 20);
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.3;
        const speed = 3 + Math.random() * 6;
        particles.push({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1,
          maxLife: 0.6 + Math.random() * 0.8,
          color,
          size: 2 + Math.random() * 3,
        });
      }
    }

    function launch() {
      const x = canvas!.width * 0.2 + Math.random() * canvas!.width * 0.6;
      const targetY = canvas!.height * 0.1 + Math.random() * canvas!.height * 0.4;
      createBurst(x, targetY, COLORS[Math.floor(Math.random() * COLORS.length)]);
    }

    function animate() {
      if (Date.now() - startTime > DURATION) {
        cancelAnimationFrame(animId);
        onDone();
        return;
      }

      ctx!.globalCompositeOperation = 'destination-out';
      ctx!.fillStyle = 'rgba(0, 0, 0, 0.08)';
      ctx!.fillRect(0, 0, canvas!.width, canvas!.height);
      ctx!.globalCompositeOperation = 'lighter';

      // Launch fireworks periodically
      if (frame % 12 === 0) launch();
      if (frame % 20 === 0 && Math.random() > 0.3) launch();

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.04; // gravity
        p.life -= 0.008;

        if (p.life <= 0) {
          particles.splice(i, 1);
          continue;
        }

        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
        ctx!.fillStyle = p.color;
        ctx!.globalAlpha = p.life;
        ctx!.fill();
      }
      ctx!.globalAlpha = 1;

      frame++;
      animId = requestAnimationFrame(animate);
    }

    // Initial burst of launches
    for (let i = 0; i < 5; i++) setTimeout(launch, i * 100);

    animId = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animId);
  }, [onDone]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed', inset: 0, zIndex: 3000,
        pointerEvents: 'none',
        background: 'rgba(0,0,0,0.3)',
      }}
    />
  );
}
