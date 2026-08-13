import { useEffect, useRef, useState } from 'react'

type Props = {
  text: string
  className?: string
  style?: React.CSSProperties
}

/**
 * Chữ dài hơn chỗ chứa thì có thể cho chạy qua lại; vừa chỗ thì đứng yên.
 *
 * Mặc định KHÔNG chạy — cắt bằng dấu ba chấm. Cả danh sách cùng bò ngang liên
 * tục thì rất nhức mắt và không đọc nổi dòng nào. Chỉ chạy khi người dùng chủ
 * động hỏi: rê chuột vào (máy tính) hoặc chạm vào tên (điện thoại), và chạy
 * đúng một lượt rồi thôi.
 *
 * Phải đo bằng JS vì CSS không biết chữ có tràn hay không — nếu cứ cho chạy
 * vô điều kiện thì những tên ngắn cũng nhúc nhích, rất nhiễu. Chỉ khi thật sự
 * tràn mới gắn class chạy; còn lại giữ nguyên cắt bằng dấu ba chấm.
 *
 * Quan trọng: dù chạy hay không, phần tử vẫn bị khoá trong bề rộng của cha
 * (overflow: hidden), nên chữ dài không bao giờ đẩy vỡ hàng nút bên cạnh.
 */
export function MarqueeText({ text, className, style }: Props) {
  const boxRef = useRef<HTMLDivElement>(null)
  const [shift, setShift] = useState(0)
  /** Đang chạy một lượt do người dùng chạm vào (điện thoại không có hover). */
  const [active, setActive] = useState(false)

  useEffect(() => {
    const box = boxRef.current
    if (!box) return

    const measure = () => {
      const inner = box.firstElementChild as HTMLElement | null
      if (!inner) return
      // +2px để chênh lệch làm tròn không kích hoạt chạy một cách vô nghĩa.
      const overflow = inner.scrollWidth - box.clientWidth
      setShift(overflow > 2 ? overflow : 0)
    }

    measure()

    // Bề rộng đổi khi xoay máy, thu cửa sổ, hoặc khi hàng nút bên cạnh co lại.
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure)
      return () => window.removeEventListener('resize', measure)
    }
    const observer = new ResizeObserver(measure)
    observer.observe(box)
    return () => observer.disconnect()
  }, [text])

  const running = shift > 0

  return (
    <div
      ref={boxRef}
      className={'marquee' + (running ? ' is-running' : '') + (active ? ' is-active' : '') + (className ? ` ${className}` : '')}
      title={text}
      style={style}
      // Trên điện thoại không có rê chuột, nên chạm vào tên là cho chạy một
      // lượt rồi tự dừng. Không bắt sự kiện khi chữ vốn đã vừa chỗ.
      onClick={running ? () => setActive(true) : undefined}
      onAnimationEnd={() => setActive(false)}
    >
      <span
        className="marquee-inner"
        style={
          running
            ? // Đi hết phần tràn rồi quay về; càng tràn nhiều chạy càng lâu để
              // tốc độ đọc luôn như nhau thay vì tên dài thì lướt vèo.
              ({ '--marquee-shift': `${shift}px`, animationDuration: `${4 + shift / 28}s` } as React.CSSProperties)
            : undefined
        }
      >
        {text}
      </span>
    </div>
  )
}
