import * as React from 'react'

const AVATAR_GRADIENTS: [string, string][] = [
  ['#4e6d9e', '#1e3461'], // navy
  ['#3a6b4a', '#143024'], // forest green
  ['#7a3545', '#331219'], // burgundy
  ['#2a6e6e', '#0d3535'], // dark teal
  ['#a06818', '#472808'], // deep amber
  ['#7a5030', '#33200e'], // warm brown
  ['#4e6e50', '#1d2e1e'], // sage
  ['#5e4070', '#24182e'], // plum
  ['#7a6430', '#33290e'], // ochre
  ['#4e6e30', '#1d2e0e'], // moss
  ['#6e3a30', '#2e130e'], // rust
]

function usernameGradient(username: string): [string, string] {
  let hash = 0
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash)
  }
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length]
}

type DefaultAvatarProps = {
  username: string
  className?: string
}

export function DefaultAvatar({ username, className }: DefaultAvatarProps): React.ReactElement {
  const rawId = React.useId().replace(/:/g, '')
  const [colorLight, colorDark] = usernameGradient(username)
  const gradientId = `dag-${rawId}`

  return (
    <svg
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label={`${username}'s avatar`}
      role="img"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={colorLight} />
          <stop offset="100%" stopColor={colorDark} />
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="50" fill={`url(#${gradientId})`} />
      <svg x="24" y="20" width="52" height="60" viewBox="0 0 512 512">
        <polygon
          fill="white"
          fillOpacity={0.92}
          points="422,482 422,422 90,422 90,482 60,482 60,512 90,512 422,512 452,512 452,482"
        />
        <path
          fill="white"
          fillOpacity={0.92}
          d="M257,0H155h-15h-30v30h30v201h51.213L241,181.213v57.573l-121,121V392h272V135C392,60.561,331.439,0,257,0z"
        />
      </svg>
    </svg>
  )
}
