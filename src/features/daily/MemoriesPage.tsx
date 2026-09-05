import { useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Heart, Users, CalendarHeart, ChevronDown } from 'lucide-react'
import { usePeopleData } from '../people/usePeopleData'
import { SharedEventsView } from './SharedEventsView'
import { useHideHeader } from '../HeaderAction'
import type { Person } from '../../types'
import './memories-page.css'

export function MemoriesPage() {
  // Ẩn Header mặc định của App Shell để dùng Header riêng có nút Back
  useHideHeader(true)

  const { personId } = useParams<{ personId?: string }>()
  const navigate = useNavigate()
  const { people } = usePeopleData()

  const [personPickerOpen, setPersonPickerOpen] = useState(false)

  // Tìm người theo personId hoặc ưu tiên partner / người yêu
  const activePerson = useMemo<Person>(() => {
    if (personId && people.length > 0) {
      const found = people.find((p) => p.id === personId)
      if (found) return found
    }

    // Nếu không có personId hoặc không tìm thấy: ưu tiên người yêu / partner
    const partner = people.find(
      (p) =>
        p.is_partner ||
        p.name.trim().toLowerCase() === 'kim ý' ||
        p.name.trim().toLowerCase() === 'kim y' ||
        p.name.trim().toLowerCase() === 'vợ' ||
        p.name.trim().toLowerCase() === 'vo'
    )
    if (partner) return partner

    // Mặc định người đầu tiên hoặc fallback mặc định
    if (people.length > 0) return people[0]

    return {
      id: personId || 'partner',
      name: 'Kim Ý',
      is_partner: true,
      room_code: 'HIEU-Y-2026',
    }
  }, [personId, people])

  const isPartner = useMemo(() => {
    return (
      Boolean(activePerson.is_partner) ||
      activePerson.name.trim().toLowerCase() === 'kim ý' ||
      activePerson.name.trim().toLowerCase() === 'kim y' ||
      activePerson.name.trim().toLowerCase() === 'vợ' ||
      activePerson.name.trim().toLowerCase() === 'vo'
    )
  }, [activePerson])

  const handleBack = () => {
    // Nếu có lịch sử duyệt thì lùi lại, nếu mở trực tiếp thì về trang People
    if (window.history.length > 1) {
      navigate(-1)
    } else {
      navigate('/people')
    }
  }

  return (
    <div className="memories-page-wrapper">
      {/* ── THANH TOP BAR TRANG KỶ NIỆM VỚI NÚT BACK QUAY VỀ ── */}
      <header className="memories-page-topbar">
        <div className="memories-topbar-left">
          <button
            type="button"
            className="memories-page-back-btn"
            onClick={handleBack}
            aria-label="Quay lại"
            title="Quay lại"
          >
            <ArrowLeft size={18} />
            <span className="back-btn-label">Quay lại</span>
          </button>
        </div>

        <div className="memories-topbar-center">
          <div className="memories-title-badge">
            {isPartner ? (
              <Heart size={15} style={{ color: '#e11d48', fill: '#e11d48' }} />
            ) : (
              <CalendarHeart size={15} style={{ color: '#d97706' }} />
            )}
            <h1 className="memories-page-heading">
              {isPartner ? 'Kỷ Niệm Chung' : `Kỷ Niệm · ${activePerson.name}`}
            </h1>
          </div>
          <span className="memories-page-subheading">
            {isPartner ? `Hành trình yêu thương cùng ${activePerson.name}` : `Dấu ấn đáng nhớ cùng ${activePerson.name}`}
          </span>
        </div>

        <div className="memories-topbar-right">
          {people.length > 1 && (
            <div className="memories-person-switcher-wrap">
              <button
                type="button"
                className="memories-switcher-btn"
                onClick={() => setPersonPickerOpen((v) => !v)}
                title="Đổi người thân"
              >
                <Users size={15} />
                <span className="switcher-name">{activePerson.name}</span>
                <ChevronDown size={13} style={{ opacity: 0.7 }} />
              </button>

              {personPickerOpen && (
                <>
                  <div
                    className="memories-picker-backdrop"
                    onClick={() => setPersonPickerOpen(false)}
                  />
                  <div className="memories-person-dropdown">
                    <div className="dropdown-title">Chọn người xem kỷ niệm</div>
                    {people.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className={`dropdown-person-item ${p.id === activePerson.id ? 'active' : ''}`}
                        onClick={() => {
                          setPersonPickerOpen(false)
                          navigate(`/memories/${p.id}`)
                        }}
                      >
                        <span className="dp-name">{p.name}</span>
                        {p.is_partner && <span className="dp-badge">❤️ Người yêu</span>}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </header>

      {/* ── NỘI DUNG CHÍNH: KHÔNG GỘP CHUNG, CHIẾM TRỌN MÀN HÌNH ĐỘC LẬP ── */}
      <main className="memories-page-body">
        <SharedEventsView
          personId={activePerson.id}
          personName={activePerson.name}
          isPartner={isPartner}
          roomCode={isPartner ? (activePerson.room_code || 'HIEU-Y-2026') : null}
        />
      </main>
    </div>
  )
}
