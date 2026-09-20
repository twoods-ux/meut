/** Next 14/15 compatible params resolution. */
export async function resolveRouteParams<T extends Record<string, string>>(
  params: T | Promise<T> | undefined
): Promise<T> {
  if (!params) {
    throw new Error("Missing route params");
  }
  return await Promise.resolve(params);
}

/** Next 14/15 compatible searchParams resolution (may be a Promise on newer Next). */
export async function resolveSearchParams<T extends Record<string, string | string[] | undefined>>(
  searchParams: T | Promise<T> | undefined
): Promise<T> {
  if (!searchParams) {
    return {} as T;
  }
  return await Promise.resolve(searchParams);
}

/** Normalize a single search param value (ignore arrays / empties). */
export function oneParam(
  value: string | string[] | undefined
): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}
