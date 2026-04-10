import { useState } from 'react'

interface Props {
  label: string
  children: React.ReactNode
  position?: 'top' | 'left'
}

export default function Tooltip({ label, children, position = 'top' }: Props) {
  const [visible, setVisible] = useState(false)

  const tipStyle: React.CSSProperties =
    position === 'top'
      ? { top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: 6 }
      : { right: '100%', top: '50%', transform: 'translateY(-50%)', marginRight: 6 }

  return (
    <div
      style={{ position: 'relative', display: 'inline-flex' }}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && (
        <div style={{
          position: 'absolute',
          ...tipStyle,
          background: '#1e1e1e',
          border: '1px solid rgba(255,255,255,0.1)',
          color: '#d4d4d4',
          fontSize: 11,
          padding: '3px 8px',
          borderRadius: 6,
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          zIndex: 100,
        }}>
          {label}
        </div>
      )}
    </div>
  )
}
