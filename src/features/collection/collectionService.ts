import { supabase } from '../../lib/supabase'
import { loadLocal, saveLocal } from '../../lib/persistence'

export type CollectionItemType = 'DIARY' | 'BOOK' | 'TRUYEN_H' | 'MANGA' | 'YOUTUBE' | 'MUSIC'

export interface CollectionItem {
  id: string
  user_id?: string
  item_type: CollectionItemType
  item_id: string
  title: string
  subtitle?: string | null
  image_url?: string | null
  url?: string | null
  category?: string | null
  metadata?: Record<string, any> | null
  is_favorite?: boolean
  created_at: string
}

const LOCAL_STORAGE_KEY = 'user_collections_local'

// Lấy danh sách local
export function getLocalCollections(): CollectionItem[] {
  return loadLocal<CollectionItem[]>(LOCAL_STORAGE_KEY, [])
}

// Lưu danh sách local
export function saveLocalCollections(items: CollectionItem[]) {
  saveLocal(LOCAL_STORAGE_KEY, items)
  window.dispatchEvent(new CustomEvent('user_collections_updated', { detail: items }))
}

// Kiểm tra xem 1 item đã được sưu tầm chưa
export function isItemInCollection(itemType: CollectionItemType, itemId: string): boolean {
  const list = getLocalCollections()
  return list.some((i) => i.item_type === itemType && String(i.item_id) === String(itemId))
}

// Tải toàn bộ danh sách sưu tầm từ Supabase + Local
export async function fetchAllCollections(): Promise<CollectionItem[]> {
  const localList = getLocalCollections()
  if (!supabase) return localList

  try {
    const { data, error } = await supabase
      .from('user_collections')
      .select('*')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    if (!error && Array.isArray(data)) {
      // Gộp với local
      const map = new Map<string, CollectionItem>()
      localList.forEach((item) => map.set(`${item.item_type}:${item.item_id}`, item))
      data.forEach((item) => map.set(`${item.item_type}:${item.item_id}`, item as CollectionItem))

      const merged = Array.from(map.values()).sort((a, b) => b.created_at.localeCompare(a.created_at))
      saveLocalCollections(merged)
      return merged
    }
  } catch (err) {
    console.warn('Lỗi tải collections từ Supabase:', err)
  }

  return localList
}

// Thêm một item vào bộ sưu tập
export async function toggleSaveToCollection(payload: {
  item_type: CollectionItemType
  item_id: string
  title: string
  subtitle?: string | null
  image_url?: string | null
  url?: string | null
  category?: string | null
  metadata?: Record<string, any> | null
}): Promise<{ added: boolean; item?: CollectionItem }> {
  const localList = getLocalCollections()
  const exists = localList.find((i) => i.item_type === payload.item_type && String(i.item_id) === String(payload.item_id))

  if (exists) {
    // Đã có -> Bỏ sưu tầm
    const next = localList.filter((i) => !(i.item_type === payload.item_type && String(i.item_id) === String(payload.item_id)))
    saveLocalCollections(next)

    if (supabase) {
      void supabase
        .from('user_collections')
        .update({ deleted_at: new Date().toISOString() })
        .eq('item_type', payload.item_type)
        .eq('item_id', payload.item_id)
    }

    return { added: false }
  }

  // Chưa có -> Thêm mới
  const newItem: CollectionItem = {
    id: `col-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    item_type: payload.item_type,
    item_id: payload.item_id,
    title: payload.title || 'Mục sưu tầm',
    subtitle: payload.subtitle || null,
    image_url: payload.image_url || null,
    url: payload.url || null,
    category: payload.category || null,
    metadata: payload.metadata || {},
    is_favorite: false,
    created_at: new Date().toISOString(),
  }

  const next = [newItem, ...localList]
  saveLocalCollections(next)

  if (supabase) {
    void (async () => {
      try {
        const { data } = await supabase
          .from('user_collections')
          .upsert({
            item_type: payload.item_type,
            item_id: payload.item_id,
            title: payload.title,
            subtitle: payload.subtitle || null,
            image_url: payload.image_url || null,
            url: payload.url || null,
            category: payload.category || null,
            metadata: payload.metadata || {},
            deleted_at: null,
          }, { onConflict: 'user_id,item_type,item_id' })
          .select()

        if (data && data.length > 0) {
          const syncedItem = data[0] as CollectionItem
          const updated = next.map((i) => (i.id === newItem.id ? syncedItem : i))
          saveLocalCollections(updated)
        }
      } catch (err) {
        console.warn('Lỗi sync collection lên Supabase:', err)
      }
    })()
  }

  return { added: true, item: newItem }
}

// Xóa hẳn khỏi bộ sưu tập
export async function removeCollectionItem(id: string, itemType?: CollectionItemType, itemId?: string) {
  const localList = getLocalCollections()
  const next = localList.filter((i) => i.id !== id && !(itemType && itemId && i.item_type === itemType && String(i.item_id) === String(itemId)))
  saveLocalCollections(next)

  if (supabase) {
    if (id && !id.startsWith('col-')) {
      void supabase.from('user_collections').update({ deleted_at: new Date().toISOString() }).eq('id', id)
    } else if (itemType && itemId) {
      void supabase
        .from('user_collections')
        .update({ deleted_at: new Date().toISOString() })
        .eq('item_type', itemType)
        .eq('item_id', itemId)
    }
  }
}

// Toggle yêu thích một item trong bộ sưu tập
export async function toggleCollectionFavorite(id: string) {
  const localList = getLocalCollections()
  const item = localList.find((i) => i.id === id)
  if (!item) return

  const nextFav = !item.is_favorite
  const next = localList.map((i) => (i.id === id ? { ...i, is_favorite: nextFav } : i))
  saveLocalCollections(next)

  if (supabase && !id.startsWith('col-')) {
    void supabase.from('user_collections').update({ is_favorite: nextFav }).eq('id', id)
  }
}
