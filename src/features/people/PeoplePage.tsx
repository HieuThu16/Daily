import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarHeart, Check, ChevronRight, HeartHandshake, Mail, MapPin, Plus, Search, SlidersHorizontal, UserRound, Users, X } from 'lucide-react'
import { localDate } from '../../lib/date'
import { countdownLabel, daysUntil, isLunar, nextOccurrence, upcomingOccasions } from '../../lib/occasions'
import { saveSourceLabel } from '../../lib/persistence'
import { supabase } from '../../lib/supabase'
import type { OccasionCalendar, PartnerInvitation, Person, PersonGroup, PersonOccasion } from '../../types'
import { useHeaderAction } from '../HeaderAction'
import { Modal } from '../shared'
import { useToast } from '../ToastContext'
import { avatarStyle, initials } from './avatar'
import { DualCalendarDate } from './DualCalendarDate'
import { GROUPS, groupLabel } from './groups'
import { OccasionsSection } from './OccasionsSection'
import { PersonDetail } from './PersonDetail'
import { WatchTogetherTab } from '../watch/WatchTogetherTab'
import { CoupleLocationTab } from './CoupleLocationTab'
import { usePeopleData, type NewOccasion } from './usePeopleData'


/** Sinh nhật sắp tới của một người, để hiện trên thẻ. */
function birthdayInfo(occasions: PersonOccasion[], personId: string) {
  const found = occasions.find((o) => o.person_id === personId && o.kind === 'BIRTHDAY')
  if (!found) return null
  const next = nextOccurrence(found)
  if (!next) return null
  const days = daysUntil(next)
  return { text: `${next.getDate()}/${next.getMonth() + 1}${isLunar(found) ? ' âm' : ''}`, days, soon: days <= 7 }
}

export function PeoplePage() {
  const { showToast } = useToast()
  const {
    people,
    occasions,
    invitations,
    loading,
    addPerson,
    updatePerson,
    deletePerson,
    addOccasion,
    removeOccasion,
    sendPartnerInvitation,
    acceptPartnerInvitation,
    rejectPartnerInvitation,
  } = usePeopleData()

  const partnerPerson = useMemo(() => people.find((p) => p.is_partner) || null, [people])
  const [mainTab, setMainTab] = useState<'LOCATION' | 'SHARED' | 'OCCASIONS' | 'PEOPLE'>('LOCATION')
  const [selected, setSelected] = useState<Person | null>(null)



  const [search, setSearch] = useState('')
  const [filterOpen, setFilterOpen] = useState(false)
  const [groupFilter, setGroupFilter] = useState<PersonGroup | 'ALL'>('ALL')
  const [currentEmail, setCurrentEmail] = useState<string>('')

  // Modal mời
  const [inviteModalOpen, setInviteModalOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [sendingInvite, setSendingInvite] = useState(false)

  // Modal nhận lời mời & đặt tên
  const [acceptInvitation, setAcceptInvitation] = useState<PartnerInvitation | null>(null)
  const [partnerCustomName, setPartnerCustomName] = useState('')
  const [accepting, setAccepting] = useState(false)

  const [formOpen, setFormOpen] = useState(false)
  const [name, setName] = useState('')
  const [group, setGroup] = useState<PersonGroup>('FAMILY')
  const [withBirthday, setWithBirthday] = useState(false)
  const [birthday, setBirthday] = useState(localDate())
  const [birthdayCalendar, setBirthdayCalendar] = useState<OccasionCalendar>('SOLAR')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (supabase?.auth) {
      supabase.auth.getUser().then(({ data }) => {
        if (data?.user?.email) setCurrentEmail(data.user.email.toLowerCase())
      }).catch(() => null)
    }
  }, [])

  const openForm = useCallback(() => setFormOpen(true), [])
  useHeaderAction(mainTab === 'PEOPLE' ? 'Thêm người' : 'Thêm', openForm)


  const filtered = useMemo(
    () =>
      people.filter(
        (p) =>
          p.name.toLowerCase().includes(search.trim().toLowerCase()) &&
          (groupFilter === 'ALL' || p.group_key === groupFilter),
      ),
    [people, search, groupFilter],
  )

  const upcomingCount = useMemo(
    () => upcomingOccasions(occasions, people, new Date(), { withinDays: 30, limit: 99 }).length,
    [occasions, people],
  )

  // Danh sách lời mời chờ mình nhận
  const pendingReceived = useMemo(() => {
    if (!currentEmail) return invitations.filter((inv) => inv.status === 'PENDING')
    return invitations.filter(
      (inv) => inv.status === 'PENDING' && inv.receiver_email.toLowerCase() === currentEmail.toLowerCase(),
    )
  }, [invitations, currentEmail])

  const handleAddOccasion = async (input: NewOccasion) => {
    const savedTo = await addOccasion(input)
    showToast(saveSourceLabel(savedTo))
  }

  const handleUpdatePerson = async (id: string, patch: Pick<Person, 'name' | 'group_key' | 'is_partner'>) => {
    const savedTo = await updatePerson(id, patch)
    setSelected((prev) => (prev && prev.id === id ? { ...prev, ...patch } : prev))
    showToast(saveSourceLabel(savedTo))
  }

  const handleDeletePerson = async (id: string) => {
    const savedTo = await deletePerson(id)
    setSelected(null)
    showToast(saveSourceLabel(savedTo))
  }

  const handleSendInvite = async () => {
    if (!inviteEmail.trim() || sendingInvite) return
    setSendingInvite(true)
    const savedTo = await sendPartnerInvitation(inviteEmail)
    setSendingInvite(false)
    setInviteModalOpen(false)
    setInviteEmail('')
    showToast(`Đã gửi lời mời đến ${inviteEmail.trim()}! (${saveSourceLabel(savedTo)})`)
  }

  const handleOpenAcceptModal = (inv: PartnerInvitation) => {
    setAcceptInvitation(inv)
    setPartnerCustomName('Chồng')
  }

  const handleConfirmAccept = async () => {
    if (!acceptInvitation || !partnerCustomName.trim() || accepting) return
    setAccepting(true)
    const savedTo = await acceptPartnerInvitation(acceptInvitation, partnerCustomName)
    setAccepting(false)
    setAcceptInvitation(null)
    setPartnerCustomName('')
    showToast(`Đã chấp nhận và kết nối với ${acceptInvitation.sender_email}! (${saveSourceLabel(savedTo)})`)
  }

  const handleRejectInvite = async (invId: string) => {
    await rejectPartnerInvitation(invId)
    showToast('Đã từ chối lời mời.')
  }

  const closeForm = () => {
    setFormOpen(false)
    setName('')
    setGroup('FAMILY')
    setWithBirthday(false)
    setBirthday(localDate())
    setBirthdayCalendar('SOLAR')
  }

  const handleAddPerson = async () => {
    if (!name.trim() || saving) return
    setSaving(true)
    const savedTo = await addPerson({
      name,
      group_key: group,
      birthday: withBirthday ? birthday : undefined,
      birthdayCalendar,
    })
    setSaving(false)
    closeForm()
    showToast(saveSourceLabel(savedTo))
  }

  const handleSendInviteFromDetail = async (person: Person, email: string) => {
    const savedTo = await sendPartnerInvitation(email)
    await updatePerson(person.id, { name: person.name, group_key: person.group_key, is_partner: true })
    showToast(`Đã gửi lời mời đến ${email}! (${saveSourceLabel(savedTo)})`)
  }

  if (selected) {
    return (
      <PersonDetail
        person={selected}
        occasions={occasions}
        people={people}
        onBack={() => setSelected(null)}
        onAddOccasion={handleAddOccasion}
        onRemoveOccasion={removeOccasion}
        onUpdatePerson={handleUpdatePerson}
        onDeletePerson={handleDeletePerson}
        onSendInvite={handleSendInviteFromDetail}
      />
    )
  }

  return (
    <section className="people-page">
      {/* Thanh tab chính: Nếu có đối tác kết nối phòng -> Hiện 4 Tab: Vị trí / Xem chung / Kỷ niệm / Người thân */}
      <div
        className="people-main-nav"
        style={{
          display: 'grid',
          gridTemplateColumns: partnerPerson ? 'repeat(4, 1fr)' : 'repeat(2, 1fr)',
          gap: '6px',
          marginBottom: '18px',
          background: 'var(--card-bg)',
          border: '1px solid var(--border)',
          borderRadius: '16px',
          padding: '4px',
        }}
      >
        {partnerPerson && (
          <button
            type="button"
            onClick={() => setMainTab('LOCATION')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              padding: '9px 8px',
              borderRadius: '12px',
              border: 'none',
              background: mainTab === 'LOCATION' ? 'linear-gradient(135deg, #0284c7, #0369a1)' : 'transparent',
              color: mainTab === 'LOCATION' ? '#ffffff' : 'var(--text-muted)',
              fontWeight: 800,
              fontSize: '0.82rem',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <MapPin size={15} /> Vị trí
          </button>
        )}

        {partnerPerson && (
          <button
            type="button"
            onClick={() => setMainTab('SHARED')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              padding: '9px 8px',
              borderRadius: '12px',
              border: 'none',
              background: mainTab === 'SHARED' ? 'linear-gradient(135deg, #ec4899, #be123c)' : 'transparent',
              color: mainTab === 'SHARED' ? '#ffffff' : 'var(--text-muted)',
              fontWeight: 800,
              fontSize: '0.82rem',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <HeartHandshake size={15} /> Xem chung
          </button>
        )}

        <button
          type="button"
          onClick={() => setMainTab('OCCASIONS')}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
            padding: '9px 8px',
            borderRadius: '12px',
            border: 'none',
            background: (mainTab === 'OCCASIONS' || ((mainTab === 'SHARED' || mainTab === 'LOCATION') && !partnerPerson)) ? 'linear-gradient(135deg, #f43f5e, #be123c)' : 'transparent',
            color: (mainTab === 'OCCASIONS' || ((mainTab === 'SHARED' || mainTab === 'LOCATION') && !partnerPerson)) ? '#ffffff' : 'var(--text-muted)',
            fontWeight: 800,
            fontSize: '0.82rem',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <CalendarHeart size={15} /> Kỷ niệm
          {upcomingCount > 0 && (
            <span
              style={{
                fontSize: '0.68rem',
                padding: '1px 5px',
                borderRadius: '10px',
                background: (mainTab === 'OCCASIONS' || ((mainTab === 'SHARED' || mainTab === 'LOCATION') && !partnerPerson)) ? 'rgba(255,255,255,0.25)' : 'rgba(244,63,94,0.15)',
                color: (mainTab === 'OCCASIONS' || ((mainTab === 'SHARED' || mainTab === 'LOCATION') && !partnerPerson)) ? '#fff' : '#f43f5e',
                fontWeight: 700,
              }}
            >
              {upcomingCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setMainTab('PEOPLE')}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
            padding: '9px 8px',
            borderRadius: '12px',
            border: 'none',
            background: mainTab === 'PEOPLE' ? 'linear-gradient(135deg, #8b5cf6, #7c3aed)' : 'transparent',
            color: mainTab === 'PEOPLE' ? '#ffffff' : 'var(--text-muted)',
            fontWeight: 800,
            fontSize: '0.82rem',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <Users size={15} /> Người thân
          <span
            style={{
              fontSize: '0.68rem',
              padding: '1px 5px',
              borderRadius: '10px',
              background: mainTab === 'PEOPLE' ? 'rgba(255,255,255,0.25)' : 'rgba(139,92,246,0.15)',
              color: mainTab === 'PEOPLE' ? '#fff' : '#8b5cf6',
              fontWeight: 700,
            }}
          >
            {people.length}
          </span>
        </button>
      </div>

      {/* TAB 1: VỊ TRÍ ĐÔI LỨA TRỰC TIẾP */}
      {mainTab === 'LOCATION' && partnerPerson && (
        <CoupleLocationTab partnerPerson={partnerPerson} />
      )}

      {/* TAB 2: XEM CHUNG TRỰC TIẾP (KHI ĐÃ KẾT NỐI PHÒNG CHUNG) */}
      {mainTab === 'SHARED' && <WatchTogetherTab />}

      {/* TAB 3: KỶ NIỆM */}
      {(mainTab === 'OCCASIONS' || (mainTab === 'LOCATION' && !partnerPerson)) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="people-stats" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
            <div className="people-stat rose">
              <CalendarHeart size={22} />
              <strong>{upcomingCount}</strong>
              <span>dịp kỷ niệm sắp tới (30 ngày)</span>
            </div>
            <div className="people-stat cyan">
              <Users size={22} />
              <strong>{people.length}</strong>
              <span>người thân đã lưu ngày sinh</span>
            </div>
          </div>

          <OccasionsSection
            occasions={occasions}
            people={people}
            onAdd={handleAddOccasion}
            onRemove={removeOccasion}
          />
        </div>
      )}

      {/* TAB 3: NGƯỜI THÂN QUEN */}
      {mainTab === 'PEOPLE' && (


        <>
          <div className="people-search">
            <Search size={17} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm theo tên…"
              aria-label="Tìm theo tên"
            />
            <button
              type="button"
              className={'people-filter-toggle' + (groupFilter !== 'ALL' ? ' active' : '')}
              aria-label="Lọc theo nhóm"
              aria-expanded={filterOpen}
              onClick={() => setFilterOpen((v) => !v)}
            >
              <SlidersHorizontal size={17} />
            </button>
          </div>

          <div className="people-filters" role="group" aria-label="Lọc theo nhóm" style={{ marginBottom: 16 }}>
            {(['ALL', ...GROUPS.map((g) => g.key), 'INVITES'] as const).map((key) => {
              const isInvites = key === 'INVITES'
              const labelText = isInvites
                ? `Lời mời nhận được${pendingReceived.length ? ` (${pendingReceived.length})` : ''}`
                : key === 'ALL'
                ? 'Tất cả'
                : groupLabel(key)
              return (
                <button
                  key={key}
                  type="button"
                  className={groupFilter === (key as string) ? 'active' : ''}
                  aria-pressed={groupFilter === (key as string)}
                  onClick={() => setGroupFilter(key as typeof groupFilter)}
                  style={isInvites && pendingReceived.length > 0 ? { borderColor: 'var(--primary)', color: 'var(--primary)', fontWeight: 700 } : undefined}
                >
                  {labelText}
                </button>
              )
            })}
          </div>

          {groupFilter === ('INVITES' as unknown) ? (
            <div className="invite-section" style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 16, padding: 16, marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <HeartHandshake size={22} style={{ color: 'var(--primary)' }} />
                <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Danh sách Lời mời đã nhận ({pendingReceived.length})</h3>
              </div>

              {pendingReceived.length === 0 ? (
                <p className="home-card-empty">Không có lời mời kết nối nào đang chờ.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {pendingReceived.map((inv) => (
                    <div key={inv.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, background: 'var(--primary-light)', border: '1px solid var(--primary)', padding: '12px 16px', borderRadius: 12 }}>
                      <span style={{ fontSize: '0.9rem' }}>
                        Tài khoản <strong style={{ color: 'var(--primary)' }}>{inv.sender_email}</strong> vừa gửi cho bạn lời mời kết nối kỷ niệm chung.
                      </span>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          className="primary"
                          style={{ padding: '6px 14px', fontSize: '0.85rem' }}
                          onClick={() => handleOpenAcceptModal(inv)}
                        >
                          <Check size={14} /> Chấp nhận
                        </button>
                        <button
                          style={{ padding: '6px 14px', fontSize: '0.85rem', background: 'var(--card-bg)', border: '1px solid var(--border)' }}
                          onClick={() => handleRejectInvite(inv.id)}
                        >
                          <X size={14} /> Từ chối
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Đang có lời mời chưa chấp nhận -> hiện banner nhắc ở trên */}
              {pendingReceived.length > 0 && (
                <div className="invite-banner" style={{ background: 'var(--primary-light)', border: '1px solid var(--primary)', padding: 14, borderRadius: 16, marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <HeartHandshake size={22} style={{ color: 'var(--primary)' }} />
                    <strong style={{ fontSize: '1rem', color: 'var(--text-main)' }}>Bạn có {pendingReceived.length} lời mời kết nối kỷ niệm</strong>
                  </div>
                  {pendingReceived.map((inv) => (
                    <div key={inv.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, background: 'var(--card-bg)', padding: '10px 14px', borderRadius: 12 }}>
                      <span style={{ fontSize: '0.9rem' }}>
                        Tài khoản <strong style={{ color: 'var(--primary)' }}>{inv.sender_email}</strong> đã gửi lời mời cho bạn.
                      </span>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          className="primary"
                          style={{ padding: '6px 12px', fontSize: '0.82rem' }}
                          onClick={() => handleOpenAcceptModal(inv)}
                        >
                          <Check size={14} /> Chấp nhận
                        </button>
                        <button
                          style={{ padding: '6px 12px', fontSize: '0.82rem', background: 'transparent', border: '1px solid var(--border)' }}
                          onClick={() => handleRejectInvite(inv.id)}
                        >
                          <X size={14} /> Từ chối
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          <div className="people-section-label">
            <h3>Danh bạ người thân</h3>
            <span className="count-pill">{filtered.length}</span>
          </div>

          {loading && people.length === 0 ? (
            <p className="home-card-empty">Đang tải…</p>
          ) : filtered.length === 0 ? (
            <div className="people-empty">
              <div className="icon-box" style={{ background: 'var(--cyan-bg)', color: 'var(--cyan)' }}>
                <UserRound size={22} />
              </div>
              <p>{people.length === 0 ? 'Chưa có ai ở đây cả.' : 'Không tìm thấy ai khớp bộ lọc.'}</p>
              {people.length === 0 && (
                <button className="primary" onClick={openForm}>
                  <Plus size={15} /> Thêm người đầu tiên
                </button>
              )}
            </div>
          ) : (
            <div className="person-grid">
              {filtered.map((person) => {
                const bd = birthdayInfo(occasions, person.id)
                const tag = groupLabel(person.group_key)
                return (
                  <button key={person.id} className="person-tile" onClick={() => setSelected(person)}>
                    {person.avatar_url ? (
                      <img className="person-avatar" src={person.avatar_url} alt={person.name} />
                    ) : (
                      <div className="person-avatar" style={avatarStyle(person.name)}>
                        {initials(person.name)}
                      </div>
                    )}
                    <div className="person-body">
                      <strong>{person.name}</strong>
                      <span className="person-tag">{tag}</span>
                      {bd && (
                        <span className={'person-birthday' + (bd.soon ? ' soon' : '')}>
                          🎂 {bd.text} {countdownLabel(bd.days)}
                        </span>
                      )}
                    </div>
                    <ChevronRight size={16} />
                  </button>
                )
              })}
            </div>
          )}
        </>
      )}

      {formOpen && (

        <Modal title="Thêm người" onClose={closeForm}>
          <div className="person-form">
            <label className="field">
              <span>Tên</span>
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !withBirthday && handleAddPerson()}
                placeholder="VD: Linh"
                aria-label="Tên người mới"
              />
            </label>

            <div className="field">
              <span>Nhóm</span>
              <div className="group-picker" role="group" aria-label="Nhóm">
                {GROUPS.map(({ key, label }) => (
                  <button
                    key={key}
                    type="button"
                    className={group === key ? 'active' : ''}
                    aria-pressed={group === key}
                    onClick={() => setGroup(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <label className="check">
              <input type="checkbox" checked={withBirthday} onChange={(e) => setWithBirthday(e.target.checked)} />
              Thêm sinh nhật
            </label>

            {withBirthday && (
              <DualCalendarDate
                value={birthday}
                onChange={setBirthday}
                calendar={birthdayCalendar}
                onCalendarChange={setBirthdayCalendar}
                label="Ngày sinh"
              />
            )}

            <div className="modal-actions">
              <button onClick={closeForm}>Huỷ</button>
              <button className="primary" onClick={handleAddPerson} disabled={!name.trim() || saving}>
                <Plus size={15} /> {saving ? 'Đang lưu…' : 'Thêm'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal gửi lời mời */}
      {inviteModalOpen && (
        <Modal title="Mời người yêu chung" onClose={() => setInviteModalOpen(false)}>
          <div className="person-form">
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: 12 }}>
              Nhập địa chỉ Gmail của người ấy. Đối phương sẽ nhận được thông báo để chấp nhận và hai người có thể xem kỷ niệm chung của nhau!
            </p>
            <label className="field">
              <span>Email đối phương</span>
              <input
                autoFocus
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendInvite()}
                placeholder="VD: nguyenkimy1302.gr@gmail.com"
                aria-label="Email người muốn mời"
              />
            </label>
            <div className="modal-actions">
              <button onClick={() => setInviteModalOpen(false)}>Huỷ</button>
              <button className="primary" onClick={handleSendInvite} disabled={!inviteEmail.trim() || sendingInvite}>
                <Mail size={15} /> {sendingInvite ? 'Đang gửi…' : 'Gửi lời mời'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal nhận lời mời & Đặt tên */}
      {acceptInvitation && (
        <Modal title="Nhận lời mời & Kết nối" onClose={() => setAcceptInvitation(null)}>
          <div className="person-form">
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: 12 }}>
              Bạn đang chấp nhận lời mời chia sẻ kỷ niệm chung từ tài khoản <strong>{acceptInvitation.sender_email}</strong>.
            </p>
            <label className="field">
              <span>Tên xưng hô trong danh bạ của bạn</span>
              <input
                autoFocus
                value={partnerCustomName}
                onChange={(e) => setPartnerCustomName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleConfirmAccept()}
                placeholder="VD: Chồng, Vợ, Người yêu..."
                aria-label="Đặt tên cho người yêu chung"
              />
            </label>
            <div className="modal-actions">
              <button onClick={() => setAcceptInvitation(null)}>Huỷ</button>
              <button className="primary" onClick={handleConfirmAccept} disabled={!partnerCustomName.trim() || accepting}>
                <Check size={15} /> {accepting ? 'Đang kết nối…' : 'Xác nhận & Kết nối'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </section>
  )
}
