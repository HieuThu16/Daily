import '@testing-library/jest-dom/vitest'

// jsdom 29 không cấp Storage thật: `localStorage` là object rỗng nên gọi getItem là ném lỗi.
// Dựng bản tối giản để component nào đọc/ghi localStorage vẫn chạy được trong test.
function memoryStorage(): Storage {
  const map = new Map<string, string>()
  return {
    get length() { return map.size },
    key: (index: number) => [...map.keys()][index] ?? null,
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, String(value)),
    removeItem: (key: string) => void map.delete(key),
    clear: () => map.clear(),
  }
}

for (const name of ['localStorage', 'sessionStorage'] as const) {
  if (typeof globalThis[name]?.getItem !== 'function') {
    Object.defineProperty(globalThis, name, { value: memoryStorage(), configurable: true, writable: true })
  }
}
