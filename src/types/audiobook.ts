export type AudiobookTrack = {
  id: string
  title: string
  url: string
  duration?: number
  durationFormatted?: string
}

export type Audiobook = {
  id: string
  title: string
  author: string
  genre: string
  cover: string
  description: string
  tracks: AudiobookTrack[]
  totalDuration?: number
  durationFormatted?: string
  dilibUrl?: string
  hasPdf?: boolean
  readbookUrl?: string
  pdfUrl?: string
  isDraft?: boolean
  status?: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'DRAFT'
  created_at?: string
  updated_at?: string
}

export type AudiobookProgress = {
  bookId: string
  trackIndex: number
  trackTitle: string
  currentSeconds: number
  durationSeconds: number
  percent: number
  updatedAt: string
  completed: boolean
}

export type DilibCategory = {
  id: string
  name: string
  icon: string
  url: string
  keywords: string[]
}
