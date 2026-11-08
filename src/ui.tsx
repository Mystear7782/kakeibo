import type { CSSProperties, ReactNode } from 'react'

export const COLORS = {
  expense: '#ffb27a',
  income: '#8cc8ff',
  transfer: '#c9ced6',
}

type ChipProps = {
  label: string
  on: boolean
  color: string
  onClick: () => void
  className?: string
}

export function Chip({ label, on, color, onClick, className = 'chip' }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={on}
      className={className}
      style={{ '--c': color } as CSSProperties}
      onClick={onClick}
    >
      {label}
    </button>
  )
}

type SwitchProps = {
  label: string
  help: string
  on: boolean
  onChange: (on: boolean) => void
}

export function Switch({ label, help, on, onChange }: SwitchProps) {
  return (
    <button type="button" role="switch" aria-checked={on} className="switch" onClick={() => onChange(!on)}>
      <span className="switch-text">
        <span className="switch-label">{label}</span>
        <span className="switch-help">{help}</span>
      </span>
      <span aria-hidden="true" className="switch-track">
        <span className="switch-knob" />
      </span>
    </button>
  )
}

export function Toast({ text }: { text: string }) {
  if (!text) return null
  return (
    <div role="status" className="toast">
      {text}
    </div>
  )
}

type HeaderProps = {
  title: string
  onBack?: () => void
  backLabel?: string
  right?: ReactNode
}

export function Header({ title, onBack, backLabel, right }: HeaderProps) {
  return (
    <div className={onBack ? 'header header-back' : 'header'}>
      {onBack && (
        <button type="button" aria-label={backLabel} className="icon-btn" onClick={onBack}>
          <svg aria-hidden="true" width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12.5 4 6.5 10l6 6" />
          </svg>
        </button>
      )}
      <h1>{title}</h1>
      {right}
    </div>
  )
}

export function Screen({ children }: { children: ReactNode }) {
  return <div className="screen">{children}</div>
}

export function Scroll({ children, gap = 12 }: { children: ReactNode; gap?: number }) {
  return (
    <div className="scroll" style={{ gap }}>
      {children}
    </div>
  )
}

export function Footer({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div className="footer">
      {hint && <p className="hint">{hint}</p>}
      <div className="footer-row">{children}</div>
    </div>
  )
}

export type Tab = 'entry' | 'calendar' | 'fixed' | 'subscription'

const TABS: { id: Tab; label: string; icon: ReactNode }[] = [
  {
    id: 'entry',
    label: '入力',
    icon: <path d="M4 18l1-4L15.5 3.5a1.8 1.8 0 0 1 2.5 0l.5.5a1.8 1.8 0 0 1 0 2.5L8 17l-4 1Z" />,
  },
  {
    id: 'calendar',
    label: 'カレンダー',
    icon: (
      <>
        <rect x="3" y="5" width="16" height="14" rx="2" />
        <path d="M3 9h16M7.5 3v4M14.5 3v4M7 13h.01M11 13h.01M15 13h.01" />
      </>
    ),
  },
  {
    id: 'fixed',
    label: '固定費',
    icon: (
      <>
        <path d="M18 8a7.5 7.5 0 0 0-13-1.5L3.5 8M4 14a7.5 7.5 0 0 0 13 1.5l1.5-1.5" />
        <path d="M3.5 4v4h4M18.5 18v-4h-4" />
      </>
    ),
  },
  {
    id: 'subscription',
    label: 'サブスク',
    icon: (
      <>
        <rect x="3" y="5" width="16" height="12" rx="2" />
        <path d="M3 9h16M7 13h4" />
      </>
    ),
  },
]

export function TabBar({ current, onSelect }: { current: Tab | null; onSelect: (tab: Tab) => void }) {
  return (
    <nav aria-label="メイン" className="tabbar">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          aria-current={current === tab.id ? 'page' : undefined}
          className="tab"
          onClick={() => onSelect(tab.id)}
        >
          <svg aria-hidden="true" width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            {tab.icon}
          </svg>
          {tab.label}
        </button>
      ))}
    </nav>
  )
}
