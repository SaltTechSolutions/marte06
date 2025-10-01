// src/utils/colorHelpers.ts
// Generate consistent colors for members

export const memberGradient = (id: string): React.CSSProperties => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h << 5) - h + id.charCodeAt(i);
  const hue = Math.abs(h) % 360;
  const bg = `hsl(${hue}, 70%, 80%)`;
  return { backgroundColor: bg };
};

export const generatePastelColor = (seed: string): string => {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 70%, 85%)`;
};
