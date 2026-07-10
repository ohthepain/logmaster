type FtueBracketTextProps = {
  text: string
  className?: string
}

export function FtueBracketText({ text, className }: FtueBracketTextProps) {
  const parts = text.split(/(\([^)]+\))/g).filter(Boolean)

  return (
    <span className={className}>
      {parts.map((part, index) => {
        const match = part.match(/^\((.+)\)$/)
        if (match) {
          return (
            <span key={index} className="brand-emphasis font-semibold">
              {match[1]}
            </span>
          )
        }
        return <span key={index}>{part}</span>
      })}
    </span>
  )
}
