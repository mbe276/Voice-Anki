import { useEffect, useRef } from 'react';

interface LevelMeterProps {
  level: number;
}

export function LevelMeter({ level }: LevelMeterProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    const width = canvas.width;
    const height = canvas.height;
    context.clearRect(0, 0, width, height);
    context.fillStyle = '#22d3ee';
    context.fillRect(0, height - height * level, width, height * level);
  }, [level]);

  return <canvas ref={canvasRef} width={120} height={20} aria-label="Input level" />;
}
