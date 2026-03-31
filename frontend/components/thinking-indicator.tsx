"use client"

export function ThinkingIndicator() {
  return (
    <div className="flex items-start gap-3">
      <div className="flex flex-col gap-3 w-full max-w-md">
        {/* Bouncing dots */}
        <div className="flex items-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="block w-2 h-2 rounded-full bg-muted-foreground/60 thinking-dot"
              style={{ animationDelay: `${i * 0.2}s` }}
            />
          ))}
        </div>

        {/* Shimmer skeleton bars */}
        <div className="space-y-2.5">
          <div className="h-3 w-[85%] rounded-full thinking-shimmer" />
          <div className="h-3 w-[65%] rounded-full thinking-shimmer" style={{ animationDelay: '0.2s' }} />
          <div className="h-3 w-[45%] rounded-full thinking-shimmer" style={{ animationDelay: '0.4s' }} />
        </div>
      </div>
    </div>
  )
}
