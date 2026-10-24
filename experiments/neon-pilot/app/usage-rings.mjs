// Visual model for Viaggio's two concentric storage rings.
// The backend currently supplies usage, not individual storage limits.
// Do not invent quota percentages: when limits are unavailable, rings show
// each category's share of the combined measured space.
export function usageRingsModel(data) {
  const number = value => {
    if (value === null || value === undefined || value === '') return NaN;
    const n = Number(value);
    return Number.isFinite(n) && n >= 0 ? n : NaN;
  };
  const database = number(data?.database_bytes);
  const files = number(data?.storage_bytes);
  if (!Number.isFinite(database) || !Number.isFinite(files)) return null;
  const dbLimit = number(data?.database_quota_bytes);
  const fileLimit = number(data?.storage_quota_bytes);
  const hasLimits = Number.isFinite(dbLimit) && dbLimit > 0
    && Number.isFinite(fileLimit) && fileLimit > 0;
  const total = database + files;
  const clamp = ratio => Math.min(100, Math.max(0, ratio * 100));
  return {
    mode: hasLimits ? 'quota' : 'composition',
    database,
    files,
    total,
    databaseLimit: hasLimits ? dbLimit : null,
    filesLimit: hasLimits ? fileLimit : null,
    databasePercent: hasLimits ? clamp(database / dbLimit) : (total ? clamp(database / total) : 0),
    filesPercent: hasLimits ? clamp(files / fileLimit) : (total ? clamp(files / total) : 0)
  };
}

export function applyUsageRing(circle, percent) {
  if (!circle) return;
  const radius = Number(circle.getAttribute('r'));
  if (!Number.isFinite(radius) || radius <= 0) return;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, Number(percent) || 0));
  circle.style.strokeDasharray = String(circumference);
  circle.style.strokeDashoffset = String(circumference * (1 - clamped / 100));
  circle.style.opacity = clamped === 0 ? '0' : '1';
}
