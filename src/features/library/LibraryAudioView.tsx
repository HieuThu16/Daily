import type { LucideIcon } from 'lucide-react'

export type LibraryCategory = {
  id: string
  label: string
  icon: LucideIcon
  color: string
  bg: string
}

type LibraryCategoryBarProps = {
  selectedType: string
  categories: readonly LibraryCategory[]
  onSelect: (id: string) => void
}

export function LibraryCategoryBar({ selectedType, categories, onSelect }: LibraryCategoryBarProps) {
  return (
    <div className="library-category-bar" role="group" aria-label="Thể loại thư viện">
      {categories.map((category) => {
        const Icon = category.icon
        const selected = selectedType === category.id
        return (
          <button
            key={category.id}
            type="button"
            className={`daily-icon-btn library-category-button${selected ? ' active' : ''}`}
            aria-label={category.label}
            aria-pressed={selected}
            title={category.label}
            onClick={() => onSelect(category.id)}
          >
            <span className="icon-box icon-box-sm" style={{ background: category.bg, color: category.color }}>
              <Icon size={14} />
            </span>
          </button>
        )
      })}
    </div>
  )
}
