/** Quita los "/" finales sin regex (evita backtracking super-lineal, Sonar S8786). */
export function stripTrailingSlashes(value: string): string {
  let end = value.length;
  while (end > 0 && value[end - 1] === '/') end--;
  return value.slice(0, end);
}
