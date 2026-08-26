import { describe, expect, it } from 'vitest'
import { cleanMovieTitle, parseLinkPreview } from './linkPreviewParse'

const page = (head: string) => `<!DOCTYPE html><html><head>${head}</head><body>x</body></html>`

describe('parseLinkPreview', () => {
  it('doc duoc the og chuan', () => {
    const out = parseLinkPreview(
      page(`
        <meta property="og:title" content="Inception (2010)">
        <meta property="og:image" content="https://img.test/poster.jpg">
        <meta property="og:description" content="Dom Cobb la mot ke trom">
        <meta property="og:site_name" content="IMDb">
      `),
    )
    expect(out.title).toBe('Inception (2010)')
    expect(out.image).toBe('https://img.test/poster.jpg')
    expect(out.siteName).toBe('IMDb')
  })

  it('content dung TRUOC property van doc duoc', () => {
    const out = parseLinkPreview(page('<meta content="Ten phim" property="og:title">'))
    expect(out.title).toBe('Ten phim')
  })

  it('khong co og thi lay twitter, roi toi the title', () => {
    expect(parseLinkPreview(page('<meta name="twitter:title" content="Tu twitter">')).title).toBe('Tu twitter')
    expect(parseLinkPreview(page('<title>Tu the title</title>')).title).toBe('Tu the title')
  })

  it('doi ky tu HTML ve chu that', () => {
    const out = parseLinkPreview(page(`<meta property="og:title" content="Harry Potter &amp; the Prince&#39;s Tale">`))
    expect(out.title).toBe("Harry Potter & the Prince's Tale")
  })

  it('trang khong co gi thi tra rong, khong vo', () => {
    expect(parseLinkPreview(page(''))).toEqual({ title: '', image: '', description: '', siteName: '' })
    expect(parseLinkPreview('')).toEqual({ title: '', image: '', description: '', siteName: '' })
  })

  it('HTML rac khong lam vo', () => {
    expect(() => parseLinkPreview('<<<>>> meta og:title')).not.toThrow()
  })
})

describe('cleanMovieTitle', () => {
  it('bo duoi ten trang', () => {
    expect(cleanMovieTitle('Inception (2010) - IMDb', 'IMDb')).toBe('Inception (2010)')
    expect(cleanMovieTitle('Parasite | Letterboxd')).toBe('Parasite')
    expect(cleanMovieTitle('Ma Trận – Wikipedia')).toBe('Ma Trận')
  })

  it('KHONG cat nham khi ten trang nam GIUA ten phim', () => {
    expect(cleanMovieTitle('IMDb Story - The Movie', 'IMDb')).toBe('IMDb Story - The Movie')
  })

  it('khong co duoi thi giu nguyen', () => {
    expect(cleanMovieTitle('Co Dau Ma')).toBe('Co Dau Ma')
  })

  it('ten phim co dau gach van giu duoc', () => {
    expect(cleanMovieTitle('Spider-Man: No Way Home - IMDb', 'IMDb')).toBe('Spider-Man: No Way Home')
  })
})
