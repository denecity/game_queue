import { memo, useEffect, useState } from 'react'
import { requestImageRepair } from '../lib/imageRepair'
import { hashString } from '../lib/utils'

const PALETTES = [
  ['#a78bfa', '#f472b6'], ['#38bdf8', '#a78bfa'], ['#fbbf24', '#fb7185'], ['#a3e635', '#38bdf8'],
  ['#f472b6', '#fbbf24'], ['#34d399', '#a78bfa'], ['#fb7185', '#a78bfa'], ['#22d3ee', '#a3e635'],
]

/** Playful stand-in when no picture exists anywhere: gradient, blobs and the title. */
export function GeneratedCover({ name, className = '' }: { name: string; className?: string }) {
  const h = hashString(name)
  const [a, b] = PALETTES[h % PALETTES.length]
  const angle = h % 360
  const cleaned = name.replace(/[^\p{L}\p{N}\s:'&!-]/gu, '').trim() || name
  return (
    <div
      className={`relative overflow-hidden flex items-end ${className}`}
      style={{ background: `linear-gradient(${angle}deg, ${a}, ${b})` }}
    >
      <div className="absolute -top-1/3 -right-1/4 w-2/3 aspect-square rounded-full bg-white/20 blur-sm" />
      <div className="absolute -bottom-1/2 -left-1/4 w-2/3 aspect-square rounded-full bg-black/15" />
      <span className="relative font-display font-extrabold text-ink-950/85 leading-[.95] p-[6%] text-[clamp(12px,9cqw,40px)] line-clamp-3 [container-type:inline-size] w-full">
        {cleaned}
      </span>
    </div>
  )
}

interface Props {
  id: string
  name: string
  src: string | null
  className?: string
  imgClassName?: string
  eager?: boolean
}

export const CoverImage = memo(function CoverImage({ id, name, src, className = '', imgClassName = '', eager }: Props) {
  const [current, setCurrent] = useState(src)
  const [failed, setFailed] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [prevSrc, setPrevSrc] = useState(src)

  // Reset during render (not in an effect) so a cached image's onload can't be undone afterwards
  if (src !== prevSrc) {
    setPrevSrc(src)
    setCurrent(src)
    setFailed(false)
    setLoaded(false)
  }

  useEffect(() => {
    if (!src) requestImageRepair(id).then(url => { if (url) setCurrent(url) })
  }, [id, src])

  async function handleError() {
    const url = await requestImageRepair(id)
    if (url && url !== current) setCurrent(url)
    else setFailed(true)
  }

  if (!current || failed) {
    return <div className={`[container-type:inline-size] ${className}`}><GeneratedCover name={name} className="w-full h-full" /></div>
  }

  return (
    <div className={`relative overflow-hidden bg-ink-800 ${className}`}>
      {!loaded && <div className="absolute inset-0 skeleton" />}
      <img
        ref={img => { if (img?.complete && img.naturalWidth > 0 && !loaded) setLoaded(true) }}
        src={current}
        // Steam's CDN allows CORS; loading it in CORS mode lets the colour sampler reuse the cached image
        crossOrigin={/steamstatic\.com\//.test(current) ? 'anonymous' : undefined}
        alt=""
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        draggable={false}
        onLoad={() => setLoaded(true)}
        onError={handleError}
        className={`w-full h-full object-cover transition-opacity duration-500 ${loaded ? 'opacity-100' : 'opacity-0'} ${imgClassName}`}
      />
    </div>
  )
})
