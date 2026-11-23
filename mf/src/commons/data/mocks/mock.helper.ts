export function mockResponse<T>(data: T, delay = 250): Promise<T> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(structuredClone(data)), delay);
  });
}
