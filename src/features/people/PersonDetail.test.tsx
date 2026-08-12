import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Person, PersonOccasion } from '../../types'
import { PersonDetail } from './PersonDetail'

vi.mock('../../lib/supabase', () => ({ supabase: null }))
vi.mock('../ToastContext', () => ({ useToast: () => ({ showToast: vi.fn() }) }))

const person: Person = { id: 'p1', name: 'Cha', group_key: 'FAMILY' }
const occasions: PersonOccasion[] = [
  { id: 'o1', person_id: 'p1', kind: 'BIRTHDAY', title: '', occasion_date: '1970-03-02', is_yearly: true },
]

const renderDetail = (onUpdatePerson = vi.fn()) => {
  render(
    <PersonDetail
      person={person}
      occasions={occasions}
      people={[person]}
      onBack={vi.fn()}
      onAddOccasion={vi.fn()}
      onRemoveOccasion={vi.fn()}
      onUpdatePerson={onUpdatePerson}
    />,
  )
  return onUpdatePerson
}

afterEach(cleanup)

describe('PersonDetail', () => {
  it('hiện tên, nhóm và sinh nhật sắp tới', () => {
    renderDetail()
    expect(screen.getByText('Cha')).toBeInTheDocument()
    expect(screen.getByText('Gia đình')).toBeInTheDocument()
    expect(screen.getByText(/Sinh nhật 2\/3/)).toBeInTheDocument()
  })

  it('mở tab Nhật ký và tab Dịp', async () => {
    renderDetail()
    expect(screen.getByLabelText('Thêm sở thích')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('tab', { name: 'Nhật ký' }))
    expect(screen.getByLabelText('Ngày nhật ký')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('tab', { name: 'Dịp' }))
    expect(screen.getByText('Dịp quan trọng')).toBeInTheDocument()
  })

  it('lưu tên mới qua form sửa', async () => {
    const onUpdate = renderDetail()
    await userEvent.click(screen.getByLabelText('Sửa thông tin'))
    const input = screen.getByLabelText('Tên người')
    await userEvent.clear(input)
    await userEvent.type(input, 'Bố')
    await userEvent.click(screen.getByRole('button', { name: 'Lưu' }))
    expect(onUpdate).toHaveBeenCalledWith('p1', { name: 'Bố', group_key: 'FAMILY' })
  })
})
