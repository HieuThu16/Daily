import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { loadLocal, saveLocal, type SaveSource } from '../../lib/persistence'
import type { OccasionCalendar, OccasionKind, Person, PersonGroup, PersonOccasion } from '../../types'

const PEOPLE_KEY = 'daily_people_local'
const OCCASIONS_KEY = 'daily_occasions_local'

export type NewOccasion = {
  person_id: string | null
  kind: OccasionKind
  title: string
  occasion_date: string
  is_yearly: boolean
  calendar?: OccasionCalendar
  is_shared?: boolean
}

/** Thông tin nhập ở form thêm người; sinh nhật lưu thành một dịp BIRTHDAY. */
export type NewPerson = {
  name: string
  group_key?: PersonGroup | null
  birthday?: string
  birthdayCalendar?: OccasionCalendar
}

export type DataSource = SaveSource

/** Nạp người và dịp, có nhánh dự phòng localStorage khi chưa cấu hình Supabase. */
export function usePeopleData() {
  const [people, setPeople] = useState<Person[]>([])
  const [occasions, setOccasions] = useState<PersonOccasion[]>([])
  const [source, setSource] = useState<DataSource>('Local')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      const savedPeople = loadLocal<Person[]>(PEOPLE_KEY, [])
      if (savedPeople.length) setPeople(savedPeople)
      const savedOccasions = loadLocal<PersonOccasion[]>(OCCASIONS_KEY, [])
      if (savedOccasions.length) setOccasions(savedOccasions)

      if (supabase) {
        const [p, o] = await Promise.all([
          supabase.from('people').select('*').is('deleted_at', null).order('name'),
          supabase.from('person_occasions').select('*').is('deleted_at', null).order('occasion_date'),
        ])
        if (p.data) {
          setPeople(p.data as Person[])
          setSource('Supabase')
        }
        if (o.data) setOccasions(o.data as PersonOccasion[])
      }
      setLoading(false)
    })()
  }, [])

  const persistPeople = (next: Person[]) => {
    setPeople(next)
    saveLocal(PEOPLE_KEY, next)
  }

  const persistOccasions = (next: PersonOccasion[]) => {
    setOccasions(next)
    saveLocal(OCCASIONS_KEY, next)
  }

  /** Trả về nguồn đã lưu để trang hiện toast tương ứng. */
  const addPerson = async (input: NewPerson | string): Promise<DataSource> => {
    const raw = typeof input === 'string' ? { name: input } : input
    const name = raw.name.trim()
    if (!name) return source
    const group_key = raw.group_key ?? null
    const local: Person = { id: crypto.randomUUID(), name, group_key }

    const withBirthday = async (personId: string, savedTo: DataSource) => {
      if (!raw.birthday) return savedTo
      await addOccasion({
        person_id: personId,
        kind: 'BIRTHDAY',
        title: '',
        occasion_date: raw.birthday,
        is_yearly: true,
        calendar: raw.birthdayCalendar ?? 'SOLAR',
      })
      return savedTo
    }

    if (!supabase) {
      persistPeople([local, ...people])
      setSource('Local')
      return withBirthday(local.id, 'Local')
    }

    const { data, error } = await supabase.from('people').insert({ name, group_key }).select().single()
    if (error || !data) {
      persistPeople([local, ...people])
      setSource('Local')
      return withBirthday(local.id, 'Local')
    }
    setPeople((prev) => [data as Person, ...prev])
    setSource('Supabase')
    return withBirthday((data as Person).id, 'Supabase')
  }

  /** Sửa tên/nhóm của một người. */
  const updatePerson = async (id: string, patch: Pick<Person, 'name' | 'group_key' | 'is_partner'>): Promise<DataSource> => {
    const name = patch.name.trim()
    if (!name) return source
    const is_partner = patch.is_partner ?? false
    const next = people.map((p) => (p.id === id ? { ...p, name, group_key: patch.group_key ?? null, is_partner } : p))

    if (!supabase) {
      persistPeople(next)
      setSource('Local')
      return 'Local'
    }

    const { error } = await supabase.from('people').update({ name, group_key: patch.group_key ?? null, is_partner }).eq('id', id)
    setPeople(next)
    if (error) {
      saveLocal(PEOPLE_KEY, next)
      setSource('Local')
      return 'Local'
    }
    setSource('Supabase')
    return 'Supabase'
  }

  const addOccasion = async (input: NewOccasion): Promise<DataSource> => {
    const is_shared = input.is_shared ?? true
    const local: PersonOccasion = { id: crypto.randomUUID(), ...input, is_shared, title: input.title.trim() }

    if (!supabase) {
      persistOccasions([...occasions, local])
      setSource('Local')
      return 'Local'
    }

    const { data, error } = await supabase
      .from('person_occasions')
      .insert({ ...input, is_shared, title: input.title.trim() })
      .select()
      .single()

    if (error || !data) {
      persistOccasions([...occasions, local])
      setSource('Local')
      return 'Local'
    }
    setOccasions((prev) => [...prev, data as PersonOccasion])
    setSource('Supabase')
    return 'Supabase'
  }

  const removeOccasion = async (id: string) => {
    const next = occasions.filter((o) => o.id !== id)
    if (!supabase) {
      persistOccasions(next)
      return
    }
    setOccasions(next)
    await supabase.from('person_occasions').update({ deleted_at: new Date().toISOString() }).eq('id', id)
  }

  return { people, occasions, source, loading, addPerson, updatePerson, addOccasion, removeOccasion }
}
