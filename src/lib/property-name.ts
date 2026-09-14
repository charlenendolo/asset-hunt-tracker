export function normalizePropertyName(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("de-DE");
}

export function cleanPropertyName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}
