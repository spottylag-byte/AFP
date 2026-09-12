export default function Logo({ size = 36 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Soccer Point"
    >
      <circle cx="20" cy="20" r="19" fill="#16213A" stroke="#D9A441" strokeWidth="1.5" />
      <g stroke="#D9A441" strokeWidth="1.3" fill="none">
        <polygon
          points="20,11 25.5,15 23.5,21.5 16.5,21.5 14.5,15"
          fill="#D9A441"
          fillOpacity="0.15"
        />
        <path d="M20 11 L20 5.5" />
        <path d="M25.5 15 L31 13" />
        <path d="M23.5 21.5 L27 27" />
        <path d="M16.5 21.5 L13 27" />
        <path d="M14.5 15 L9 13" />
      </g>
    </svg>
  );
}
