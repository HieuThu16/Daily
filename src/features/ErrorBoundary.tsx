import { Component, type ErrorInfo, type ReactNode } from 'react'

/**
 * Chặn lỗi render để một tab hỏng không kéo trắng cả app.
 *
 * React unmount toàn bộ cây khi có lỗi render không ai bắt, nên không có lớp này
 * thì một bản ghi dữ liệu lạ ở bất kỳ đâu cũng thành màn hình trắng, tải lại vẫn
 * trắng vì dữ liệu vẫn lạ. Đặt `key` theo đường dẫn để đổi tab là tự hồi lại.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Lỗi render:', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <section style={{ padding: 24, maxWidth: 520, margin: '0 auto', textAlign: 'center' }}>
        <h2 style={{ fontSize: '1rem', margin: '0 0 6px' }}>Mục này đang lỗi</h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0 0 16px' }}>
          Các mục khác vẫn dùng được bình thường. Dữ liệu của bạn không bị ảnh hưởng.
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button className="primary" onClick={() => this.setState({ error: null })}>
            Thử lại
          </button>
          <button onClick={() => window.location.assign('/home')}>Về trang chủ</button>
        </div>
        <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 14, wordBreak: 'break-word' }}>
          {this.state.error.message}
        </p>
      </section>
    )
  }
}
