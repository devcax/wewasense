export default function Logo({ size = 40 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className="shrink-0">
      <rect width="32" height="32" rx="9" fill="#ffffff" fillOpacity="0.12" />
      <path d="M5 19c3 0 3-2 5.5-2s3 2 5.5 2 3-2 5.5-2S25 19 27 19v4.5c0 1.4-1.1 2.5-2.5 2.5h-17A2.5 2.5 0 0 1 5 23.5z" fill="#81c6e4" />
      <path d="M16 5.5c3.2 3 4.2 6.4 0 9.5-4.2-3.1-3.2-6.5 0-9.5z" fill="#8dd2a6" />
      <path d="M16 15v-4" stroke="#1c4e33" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}
