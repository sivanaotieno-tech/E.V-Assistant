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
  const scale = 1 + amplitude * 0.035;

  return (
    <div className={`core-stage core-${state}`}>
      <div className="core-radar radar-a" />
      <div className="core-radar radar-b" />
      <div className="core-ring ring-a" />
      <div className="core-ring ring-b" />

      <div className="ev-core-mark" style={{ transform: `scale(${scale})` }} aria-label={`${label} ${stateText[state]}`}>
        <svg className="ev-core-svg" viewBox="0 0 400 400" aria-hidden="true">
          <defs>
            <radialGradient id="evCoreFill" cx="50%" cy="50%" r="62%">
              <stop offset="0%" stopColor="rgba(0,255,155,.32)" />
              <stop offset="55%" stopColor="rgba(0,220,165,.14)" />
              <stop offset="100%" stopColor="rgba(0,220,165,0)" />
            </radialGradient>
            <filter id="evCoreGlow" x="-80%" y="-80%" width="260%" height="260%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <circle cx="200" cy="200" r="79" fill="url(#evCoreFill)" />
          <path
            className="ev-core-outline"
            filter="url(#evCoreGlow)"
            d="M200 70
               C218 70 222 88 239 84
               C255 80 264 65 276 77
               C288 89 274 104 290 112
               C306 120 326 112 328 129
               C330 146 309 151 317 168
               C325 185 343 190 337 207
               C331 223 310 218 307 237
               C304 255 318 268 306 280
               C294 293 277 281 264 294
               C251 307 254 327 237 330
               C220 333 216 312 198 315
               C180 318 172 337 156 330
               C140 323 150 302 133 294
               C116 286 98 296 91 280
               C84 264 103 252 96 234
               C89 216 68 216 66 199
               C64 182 86 180 91 164
               C96 147 83 133 96 121
               C109 109 125 122 139 110
               C153 98 148 77 164 72
               C180 67 184 87 200 70 Z"
          />
        </svg>
        <div className="ev-core-center" />
      </div>

      <div className="core-waveform" aria-hidden="true">
        {bars.map((_, i) => (
          <i key={i} style={{ ['--amp' as string]: `${8 + amplitude * (18 + (i % 7) * 2)}px`, ['--delay' as string]: `${(i % 9) * -80}ms` }} />
        ))}
      </div>

      <div className="core-caption">
        <span>{label}</span>
        <strong>{stateText[state]}{state === 'listening' ? '...' : ''}</strong>
      </div>
    </div>
  );
}
