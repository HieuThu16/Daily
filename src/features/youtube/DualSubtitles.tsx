import { useEffect, useState } from 'react'
import { Languages, Loader2 } from 'lucide-react'
import { fetchDualSubs, useCurrentCue, type SubCue } from '../../lib/dualSubs'

/**
 * Phụ đề song ngữ đè lên trình phát: dòng trên tiếng Anh, dòng dưới tiếng Việt,
 * đổi theo từng câu đang nói. Học theo cách Language Reactor / Trancy làm.
 */
export function DualSubtitles({ player, videoId }: { player: any; videoId: string | null }) {
  const [on, setOn] = useState(false)
  const [cues, setCues] = useState<SubCue[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setCues([])
    setError('')
  }, [videoId])

  useEffect(() => {
    if (!on || !videoId || cues.length > 0 || loading) return
    setLoading(true)
    fetchDualSubs(videoId)
      .then(setCues)
      .catch((err) => setError(err?.message || 'Không lấy được phụ đề'))
      .finally(() => setLoading(false))
  }, [on, videoId, cues.length, loading])

  const cue = useCurrentCue(player, cues, on)

  return (
    <>
      <button
        type="button"
        onClick={() => setOn((v) => !v)}
        title="Phụ đề Anh - Việt"
        style={{
          position: 'absolute',
          top: 10,
          right: 10,
          zIndex: 2,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 10px',
          borderRadius: 10,
          border: 'none',
          background: on ? 'var(--primary)' : 'rgba(0,0,0,0.6)',
          color: '#fff',
          fontSize: '0.74rem',
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        {loading ? <Loader2 size={14} className="spin" /> : <Languages size={14} />} Anh - Việt
      </button>

      {on && (error || cue) && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 56,
            zIndex: 2,
            padding: '0 6%',
            textAlign: 'center',
            pointerEvents: 'none',
            textShadow: '0 2px 6px rgba(0,0,0,0.9)',
          }}
        >
          {error ? (
            <span style={{ color: '#ffb4b4', fontSize: '0.8rem' }}>{error}</span>
          ) : (
            <>
              <div style={{ color: '#fff', fontSize: 'clamp(0.85rem, 2.1vw, 1.25rem)', fontWeight: 600, lineHeight: 1.35 }}>
                {cue!.text}
              </div>
              {cue!.vi && (
                <div style={{ color: '#ffe08a', fontSize: 'clamp(0.8rem, 1.9vw, 1.1rem)', fontWeight: 600, lineHeight: 1.35 }}>
                  {cue!.vi}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </>
  )
}
