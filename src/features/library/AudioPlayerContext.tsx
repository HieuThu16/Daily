import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { Media } from '../../types'

export type RepeatMode = 'OFF' | 'ALL' | 'ONE'

export interface AudioPlayerContextType {
  currentTrack: Media | null
  playlist: Media[]
  isPlaying: boolean
  currentTime: number
  duration: number
  volume: number
  isMuted: boolean
  isShuffle: boolean
  repeatMode: RepeatMode
  audioError: boolean
  playTrack: (track: Media, queue?: Media[]) => void
  togglePlay: () => void
  pause: () => void
  resume: () => void
  nextTrack: () => void
  prevTrack: () => void
  seek: (time: number) => void
  setVolume: (val: number) => void
  toggleMute: () => void
  toggleShuffle: () => void
  toggleRepeat: () => void
  setPlaylist: (queue: Media[]) => void
  closePlayer: () => void
}

const AudioPlayerContext = createContext<AudioPlayerContextType | null>(null)

export function useAudioPlayer(): AudioPlayerContextType {
  const context = useContext(AudioPlayerContext)
  if (!context) {
    throw new Error('useAudioPlayer must be used within an AudioPlayerProvider')
  }
  return context
}

export function AudioPlayerProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const [currentTrack, setCurrentTrack] = useState<Media | null>(null)
  const [playlist, setPlaylist] = useState<Media[]>([])
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolumeState] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [isShuffle, setIsShuffle] = useState(false)
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('ALL')
  const [audioError, setAudioError] = useState(false)

  // Phát một bài hát cụ thể và cập nhật playlist nếu được cung cấp
  const playTrack = useCallback((track: Media, queue?: Media[]) => {
    if (!track.audio_url) return
    setCurrentTrack(track)
    setCurrentTime(0)
    setAudioError(false)

    if (queue && queue.length > 0) {
      setPlaylist(queue)
    } else {
      setPlaylist((prev) => (prev.some((t) => t.id === track.id) ? prev : [track, ...prev]))
    }
  }, [])

  // Đồng bộ volume & muted vào element audio mỗi khi track thay đổi (audio remount do key đổi)
  useEffect(() => {
    if (!audioRef.current) return
    audioRef.current.volume = isMuted ? 0 : volume
  }, [currentTrack?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Khi currentTrack thay đổi và có audio_url, tự động phát
  useEffect(() => {
    if (!currentTrack?.audio_url || !audioRef.current) return
    setAudioError(false)
    try {
      audioRef.current.load?.()
      const playPromise = audioRef.current.play?.()
      if (playPromise && typeof playPromise.then === 'function') {
        playPromise
          .then(() => setIsPlaying(true))
          .catch((err) => {
            console.warn('[AutoPlay policy warning]', err)
            setIsPlaying(false)
          })
      } else {
        setIsPlaying(true)
      }
    } catch {
      setIsPlaying(true)
    }
  }, [currentTrack?.id, currentTrack?.audio_url])

  const togglePlay = useCallback(() => {
    if (!audioRef.current) return
    if (isPlaying) {
      audioRef.current.pause?.()
      setIsPlaying(false)
    } else {
      try {
        const p = audioRef.current.play?.()
        if (p && typeof p.then === 'function') {
          p.then(() => setIsPlaying(true)).catch(() => setIsPlaying(false))
        } else {
          setIsPlaying(true)
        }
      } catch {
        setIsPlaying(true)
      }
    }
  }, [isPlaying])

  const pause = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause?.()
      setIsPlaying(false)
    }
  }, [])

  const resume = useCallback(() => {
    if (!audioRef.current) return
    try {
      const p = audioRef.current.play?.()
      if (p && typeof p.then === 'function') {
        p.then(() => setIsPlaying(true)).catch(() => setIsPlaying(false))
      } else {
        setIsPlaying(true)
      }
    } catch {
      setIsPlaying(true)
    }
  }, [])

  const currentIndex = useMemo(() => {
    if (!currentTrack) return -1
    return playlist.findIndex((t) => t.id === currentTrack.id)
  }, [playlist, currentTrack])

  const nextTrack = useCallback(() => {
    if (playlist.length <= 1) {
      if (audioRef.current) {
        audioRef.current.currentTime = 0
        audioRef.current.play?.()
      }
      return
    }

    if (isShuffle) {
      const otherIndices = playlist.map((_, i) => i).filter((i) => i !== currentIndex)
      if (otherIndices.length > 0) {
        const randomIdx = otherIndices[Math.floor(Math.random() * otherIndices.length)]
        setCurrentTrack(playlist[randomIdx])
        return
      }
    }

    if (currentIndex >= 0 && currentIndex < playlist.length - 1) {
      setCurrentTrack(playlist[currentIndex + 1])
    } else if (repeatMode === 'ALL') {
      setCurrentTrack(playlist[0])
    }
  }, [playlist, currentIndex, isShuffle, repeatMode])

  const prevTrack = useCallback(() => {
    if (audioRef.current && audioRef.current.currentTime > 3) {
      audioRef.current.currentTime = 0
      return
    }

    if (playlist.length <= 1) {
      if (audioRef.current) audioRef.current.currentTime = 0
      return
    }

    if (currentIndex > 0) {
      setCurrentTrack(playlist[currentIndex - 1])
    } else if (repeatMode === 'ALL') {
      setCurrentTrack(playlist[playlist.length - 1])
    }
  }, [playlist, currentIndex, repeatMode])

  const seek = useCallback((time: number) => {
    setCurrentTime(time)
    if (audioRef.current) {
      audioRef.current.currentTime = time
    }
  }, [])

  const setVolume = useCallback((val: number) => {
    setVolumeState(val)
    if (audioRef.current) {
      audioRef.current.volume = val
      setIsMuted(val === 0)
    }
  }, [])

  const toggleMute = useCallback(() => {
    if (!audioRef.current) return
    if (isMuted) {
      audioRef.current.volume = volume || 0.5
      setIsMuted(false)
    } else {
      audioRef.current.volume = 0
      setIsMuted(true)
    }
  }, [isMuted, volume])

  const toggleShuffle = useCallback(() => {
    setIsShuffle((prev) => !prev)
  }, [])

  const toggleRepeat = useCallback(() => {
    setRepeatMode((prev) => (prev === 'OFF' ? 'ALL' : prev === 'ALL' ? 'ONE' : 'OFF'))
  }, [])

  const closePlayer = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause?.()
    }
    setIsPlaying(false)
    setCurrentTrack(null)
  }, [])

  const handleEnded = useCallback(() => {
    if (repeatMode === 'ONE') {
      if (audioRef.current) {
        audioRef.current.currentTime = 0
        audioRef.current.play?.()
      }
    } else {
      nextTrack()
    }
  }, [repeatMode, nextTrack])

  const value = useMemo<AudioPlayerContextType>(
    () => ({
      currentTrack,
      playlist,
      isPlaying,
      currentTime,
      duration,
      volume,
      isMuted,
      isShuffle,
      repeatMode,
      audioError,
      playTrack,
      togglePlay,
      pause,
      resume,
      nextTrack,
      prevTrack,
      seek,
      setVolume,
      toggleMute,
      toggleShuffle,
      toggleRepeat,
      setPlaylist,
      closePlayer,
    }),
    [
      currentTrack,
      playlist,
      isPlaying,
      currentTime,
      duration,
      volume,
      isMuted,
      isShuffle,
      repeatMode,
      audioError,
      playTrack,
      togglePlay,
      pause,
      resume,
      nextTrack,
      prevTrack,
      seek,
      setVolume,
      toggleMute,
      toggleShuffle,
      toggleRepeat,
      closePlayer,
    ],
  )

  return (
    <AudioPlayerContext.Provider value={value}>
      {children}
      {/* Vị trí cố định của thẻ HTML5 Audio ở Root ứng dụng */}
      <audio
        ref={audioRef}
        key={currentTrack?.id || 'empty-player'}
        src={currentTrack?.audio_url || undefined}
        preload="auto"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onTimeUpdate={() => {
          if (audioRef.current) setCurrentTime(audioRef.current.currentTime)
        }}
        onLoadedMetadata={() => {
          if (audioRef.current) setDuration(audioRef.current.duration)
        }}
        onEnded={handleEnded}
        onError={() => {
          setAudioError(true)
          setIsPlaying(false)
        }}
      />
    </AudioPlayerContext.Provider>
  )
}
