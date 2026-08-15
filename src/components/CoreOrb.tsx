import type { CoreState } from '../types';

interface Props {
  state: CoreState;
  amplitude: number;
  label?: string;
}

const stateText: Record<CoreState, string> = {
  idle: 'STANDBY',
  listening: 'LISTENING',
  processing: 'PROCESSING',
  speaking: 'SPEAKING',
  error: 'SYSTEM ERROR',
  offline: 'OFFLINE',
};

export function CoreOrb({ state, amplitude, label = 'E.V.' }: Props) {
  const bars = Array.from({ length: 28 });
  return (
    <div className={`core-stage core-${state}`}>
      <div className="core-radar radar-a" />
      <div className="core-radar radar-b" />
      <div className="core-ring ring-a" />
      <div className="core-ring ring-b" />
      <div className="core-orb" style={{ transform: `scale(${1 + amplitude * 0.045})` }}>
        <div className="core-orb-glow" />
      </div>
      <div className="core-waveform" aria-hidden="true">
        {bars.map((_, i) => (
          <i key={i} style={{ ['--amp' as string]: `${10 + amplitude * (24 + (i % 7) * 3)}px`, ['--delay' as string]: `${(i % 9) * -80}ms` }} />
        ))}
      </div>
      <div className="core-caption">
        <span>{label}</span>
        <strong>{stateText[state]}</strong>
      </div>
    </div>
  );
}
