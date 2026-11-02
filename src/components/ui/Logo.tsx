type Variant = 'full' | 'white' | 'dark' | 'symbol' | 'symbol-white'

const SRCS: Record<Variant, string> = {
  full: '/brand/gocart-logo.svg',
  white: '/brand/gocart-logo-white.svg',
  dark: '/brand/gocart-logo-dark.svg',
  symbol: '/brand/gocart-symbol.svg',
  'symbol-white': '/brand/gocart-symbol-white.svg',
}

interface Props {
  variant?: Variant
  height?: number
  className?: string
}

export function Logo({ variant = 'full', height = 32, className }: Props) {
  return (
    <img
      src={SRCS[variant]}
      alt="GoCart"
      height={height}
      className={className}
      style={{ height, width: 'auto' }}
    />
  )
}
