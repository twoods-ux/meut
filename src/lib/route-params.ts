/** Next 14/15 compatible params resolution. */
export async function resolveRouteParams<T extends Record<string, string>>(
  params: T | Promise<T> | undefined
): Promise<T> {
  if (!params) {
    throw new Error("Missing route params");
  }
  return await Promise.resolve(params);
}
