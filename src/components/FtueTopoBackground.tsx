export function FtueTopoBackground() {
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden
    >
      <svg
        className="absolute inset-0 h-full w-full"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <pattern
            id="ftue-grid"
            width="48"
            height="48"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 48 0 L 0 0 0 48"
              fill="none"
              stroke="rgba(59,130,246,0.07)"
              strokeWidth="0.75"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#ftue-grid)" />
        <g fill="none" stroke="rgba(59,130,246,0.13)" strokeWidth="1.1">
          <ellipse cx="18%" cy="28%" rx="120" ry="88" />
          <ellipse cx="22%" cy="30%" rx="96" ry="70" />
          <ellipse cx="26%" cy="32%" rx="72" ry="52" />
          <ellipse cx="78%" cy="62%" rx="140" ry="96" />
          <ellipse cx="74%" cy="64%" rx="108" ry="74" />
          <ellipse cx="70%" cy="66%" rx="76" ry="52" />
          <ellipse cx="52%" cy="78%" rx="160" ry="110" />
          <ellipse cx="48%" cy="80%" rx="120" ry="82" />
        </g>
        <path
          d="M -40 520 C 120 470, 200 430, 320 390 S 520 300, 700 250 S 920 180, 1100 120"
          fill="none"
          stroke="rgba(235,69,57,0.42)"
          strokeWidth="2.5"
          strokeDasharray="10 8"
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#f3f6fa]/85" />
    </div>
  )
}
