/** So tên bỏ qua hoa/thường, dấu tiếng Việt, khoảng trắng thừa và dấu câu. */
export function normalizeName(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/**
 * Tìm mục đã có cùng loại và cùng tên (sau khi chuẩn hoá).
 * `excludeId` để lúc sửa không tự báo trùng với chính nó.
 */
export function findDuplicateByName<T extends { id: string; type: string; name: string }>(
  items: T[],
  type: string,
  name: string,
  excludeId?: string,
): T | undefined {
  const target = normalizeName(name)
  if (!target) return undefined
  return items.find((item) => item.id !== excludeId && item.type === type && normalizeName(item.name) === target)
}
