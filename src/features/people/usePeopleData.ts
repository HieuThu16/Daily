import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { loadLocal, saveLocal, type SaveSource } from '../../lib/persistence'
import type { OccasionCalendar, OccasionKind, PartnerInvitation, Person, PersonGroup, PersonOccasion } from '../../types'

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
  const [invitations, setInvitations] = useState<PartnerInvitation[]>([])
  const [source, setSource] = useState<DataSource>('Local')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      const savedPeople = loadLocal<Person[]>(PEOPLE_KEY, [])
      if (savedPeople.length) setPeople(savedPeople)
      const savedOccasions = loadLocal<PersonOccasion[]>(OCCASIONS_KEY, [])
      if (savedOccasions.length) setOccasions(savedOccasions)

      if (supabase) {
        const [p, o, inv] = await Promise.all([
          supabase.from('people').select('*').is('deleted_at', null).order('name'),
          supabase.from('person_occasions').select('*').is('deleted_at', null).order('occasion_date'),
          supabase.from('partner_invitations').select('*').is('deleted_at', null).order('created_at', { ascending: false }),
        ])
        if (p.data) {
          const rawPeople = p.data as Person[]
          const seen = new Set<string>()
          const unique = rawPeople.filter((item) => {
            const key = item.id || item.name.trim().toLowerCase()
            if (seen.has(key)) return false
            seen.add(key)
            return true
          })
          setPeople(unique)
          setSource('Supabase')
        }
        if (o.data) setOccasions(o.data as PersonOccasion[])
        if (inv.data) setInvitations(inv.data as PartnerInvitation[])
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

  const deletePerson = async (id: string): Promise<DataSource> => {
    const nextPeople = people.filter((p) => p.id !== id)
    const nextOccasions = occasions.filter((o) => o.person_id !== id)

    if (!supabase) {
      persistPeople(nextPeople)
      persistOccasions(nextOccasions)
      setSource('Local')
      return 'Local'
    }

    setPeople(nextPeople)
    setOccasions(nextOccasions)

    const now = new Date().toISOString()
    const { error } = await supabase.from('people').update({ deleted_at: now }).eq('id', id)
    await supabase.from('person_occasions').update({ deleted_at: now }).eq('person_id', id)

    if (error) {
      saveLocal(PEOPLE_KEY, nextPeople)
      saveLocal(OCCASIONS_KEY, nextOccasions)
      setSource('Local')
      return 'Local'
    }
    setSource('Supabase')
    return 'Supabase'
  }

  /** Gửi lời mời kết nối người yêu chung qua email */
  const sendPartnerInvitation = async (receiverEmail: string): Promise<DataSource> => {
    const email = receiverEmail.trim().toLowerCase()
    if (!email) return source
    if (!supabase) return 'Local'

    const { data: userData } = await supabase.auth.getUser()
    const senderEmail = userData.user?.email ?? ''
    const roomCode = `ROOM-${Math.random().toString(36).substring(2, 8).toUpperCase()}`

    // 1. Thêm vào partner_invitations
    const { data, error } = await supabase
      .from('partner_invitations')
      .insert({ sender_email: senderEmail, receiver_email: email, status: 'PENDING', room_code: roomCode })
      .select()
      .single()

    // 2. Tự động thêm shared_partners cho người gửi để cho đối phương xem trước
    if (userData.user?.id) {
      try {
        await supabase
          .from('shared_partners')
          .insert({ user_id: userData.user.id, partner_email: email })
      } catch {
        // Ignored
      }
    }

    if (!error && data) {
      setInvitations((prev) => [data as PartnerInvitation, ...prev])
    }
    return 'Supabase'
  }

  /** Chấp nhận lời mời & đặt tên cho người yêu chung trong danh bạ */
  const acceptPartnerInvitation = async (invitation: PartnerInvitation, partnerCustomName: string): Promise<DataSource> => {
    const customName = partnerCustomName.trim()
    if (!customName || !supabase) return 'Local'

    const { data: userData } = await supabase.auth.getUser()
    const roomCode = invitation.room_code || 'HIEU-Y-2026'

    // 1. Cập nhật trạng thái invitation sang ACCEPTED
    await supabase.from('partner_invitations').update({ status: 'ACCEPTED' }).eq('id', invitation.id)
    setInvitations((prev) => prev.map((inv) => (inv.id === invitation.id ? { ...inv, status: 'ACCEPTED' } : inv)))

    // 2. Thêm shared_partners cho cả 2 chiều
    if (userData.user?.id) {
      try {
        await supabase
          .from('shared_partners')
          .insert({ user_id: userData.user.id, partner_email: invitation.sender_email })
      } catch {
        // Ignored
      }
      try {
        await supabase
          .from('shared_partners')
          .insert({ user_id: invitation.sender_id, partner_email: userData.user.email ?? '' })
      } catch {
        // Ignored
      }
    }

    // 3. Tạo người yêu chung trong danh bạ với tên tùy chỉnh
    const savedTo = await addPerson({
      name: customName,
      group_key: 'FRIEND',
    })

    // 4. Đánh dấu is_partner = true và room_code
    const updatedList = people.map((p) => (p.name === customName ? { ...p, is_partner: true, room_code: roomCode } : p))
    setPeople(updatedList)

    const createdPerson = people.find((p) => p.name === customName)
    if (createdPerson) {
      await updatePerson(createdPerson.id, { name: customName, group_key: 'FRIEND', is_partner: true })
      if (supabase) {
        try {
          await supabase.from('people').update({ is_partner: true, room_code: roomCode }).eq('id', createdPerson.id)
        } catch {
          // Ignored
        }
      }
    }

    return savedTo
  }

  /** Từ chối lời mời */
  const rejectPartnerInvitation = async (invitationId: string): Promise<DataSource> => {
    if (!supabase) return 'Local'
    await supabase.from('partner_invitations').update({ status: 'REJECTED' }).eq('id', invitationId)
    setInvitations((prev) => prev.map((inv) => (inv.id === invitationId ? { ...inv, status: 'REJECTED' } : inv)))
    return 'Supabase'
  }

  return {
    people,
    occasions,
    invitations,
    source,
    loading,
    addPerson,
    updatePerson,
    deletePerson,
    addOccasion,
    removeOccasion,
    sendPartnerInvitation,
    acceptPartnerInvitation,
    rejectPartnerInvitation,
  }
}
