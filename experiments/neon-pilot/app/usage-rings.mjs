// Independent percentages against measured project limits.
// Missing measurements or limits must never become composition percentages.
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
  if (!hasLimits) return null;
  const total = database + files;
  const percent = ratio => Math.max(0, ratio * 100);
  return {
    mode: 'quota',
    database,
    files,
    total,
    databaseLimit: dbLimit,
    filesLimit: fileLimit,
    databasePercent: percent(database / dbLimit),
    filesPercent: percent(files / fileLimit)
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
