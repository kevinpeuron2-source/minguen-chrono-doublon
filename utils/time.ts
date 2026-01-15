
export const formatDuration = (ms: number): string => {
  if (isNaN(ms) || ms < 0) return "--:--:--";
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const milliseconds = Math.floor((ms % 1000) / 10);

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(milliseconds).padStart(2, '0')}`;
};

export const getSpeed = (distanceKm: number, timeMs: number): string => {
  if (timeMs <= 0) return "0.00";
  const hours = timeMs / 3600000;
  return (distanceKm / hours).toFixed(2);
};
