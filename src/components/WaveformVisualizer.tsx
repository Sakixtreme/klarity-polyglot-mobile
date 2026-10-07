import React, { useEffect, useRef } from 'react';

interface WaveformVisualizerProps {
  isRecording: boolean;
  getAudioLevels?: () => number[];
  accentColor?: 'orange' | 'ocean' | 'sky';
}

export const WaveformVisualizer: React.FC<WaveformVisualizerProps> = ({
  isRecording,
  getAudioLevels,
  accentColor = 'orange',
}) => {
  const barsRef = useRef<number[]>([12, 18, 28, 45, 30, 22, 16, 10]);
  const [, setTick] = React.useState(0);

  useEffect(() => {
    if (!isRecording) return;
    const interval = setInterval(() => {
      if (getAudioLevels) {
        barsRef.current = getAudioLevels();
      } else {
        barsRef.current = barsRef.current.map(() => Math.floor(Math.random() * 50) + 10);
      }
      setTick((t) => (t + 1) % 1000);
    }, 80);

    return () => clearInterval(interval);
  }, [isRecording, getAudioLevels]);

  const colorClasses = {
    orange: 'bg-orange',
    ocean: 'bg-ocean',
    sky: 'bg-sky',
  }[accentColor];

  return (
    <div className="flex items-center justify-center gap-1.5 h-8 px-4">
      {barsRef.current.map((height, i) => {
        const normalizedHeight = isRecording
          ? Math.min(30, Math.max(6, Math.round((height / 255) * 30) || 8))
          : 6;
        return (
          <div
            key={i}
            className={`w-1.5 rounded-full transition-all duration-75 ${
              isRecording ? colorClasses : 'bg-navy-border'
            }`}
            style={{ height: `${normalizedHeight}px` }}
          />
        );
      })}
    </div>
  );
};
