const clamp = n => Math.max(0, Math.min(1, n));
const smooth = (a, b, value) => { const t = clamp((value - a) / (b - a)); return t * t * (3 - 2 * t); };
export const THREAD_PITCH = 0.065;
export function assemblyState(value) {
  const progress = clamp(value);
  const nuts = Array.from({length:4}, (_, i) => {
    const delay = i * 0.018;
    const appearance = smooth(0.07 + delay, 0.16 + delay, progress);
    const approach = smooth(0.15 + delay, 0.30 + delay, progress);
    const tightening = smooth(0.32 + delay, 0.86 + delay, progress);
    const threadTravel = (0.94 - 0.395) * tightening;
    return {
      opacity:appearance,
      y:1.50 - 0.56 * approach - threadTravel,
      angle:-threadTravel / THREAD_PITCH * Math.PI * 2,
      turns:threadTravel / THREAD_PITCH
    };
  });
  const phase = progress < 0.13 ? 0 : progress < 0.36 ? 1 : progress < 0.93 ? 2 : 3;
  return {progress, nuts, phase, label:['ПОДГОТОВКА УЗЛА','УСТАНОВКА ГАЕК','ЗАТЯЖКА ПО РЕЗЬБЕ','УЗЕЛ СОБРАН'][phase]};
}
