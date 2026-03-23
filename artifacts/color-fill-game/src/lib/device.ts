let _android: boolean | null = null;

export function isAndroid(): boolean {
  if (_android !== null) return _android;
  try {
    _android = /android/i.test(navigator.userAgent);
  } catch {
    _android = false;
  }
  return _android;
}

// Low-end = Android OR very few CPU cores
export function isLowEnd(): boolean {
  try {
    return isAndroid() || (navigator.hardwareConcurrency != null && navigator.hardwareConcurrency <= 2);
  } catch {
    return false;
  }
}
