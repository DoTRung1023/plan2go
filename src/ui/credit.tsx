/**
 * Who made this: the line at the foot of the front door and of every printed
 * sheet. One place for it, so the two say it the same way, heart and all.
 *
 * Inline, and sized by whatever it sits in: the heart is as tall as the
 * words beside it and a shade darker than the accent, which is the one
 * step of it that reads as text at these sizes, and the name is a link in
 * the same ink. On paper the link is still the name.
 */
export function Credit({ className = "" }: { readonly className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <span>Made with</span>
      <svg aria-hidden="true" viewBox="38 55 190 161" className="h-[1.2em] w-auto text-terracotta-700">
        <path
          fill="currentColor"
          d="M132.8 214 45.6 107.2A30.3 30.3 0 0 1 40.5 90c0-18.2 13.8-33 30.8-33 17.4 0 30.8 13.2 30.8 30.6v29.1c0 18.7 11.8 30.3 30.7 30.3 19 0 31.2-11.6 31.2-30.3V87.6C164 70.2 177.7 57 195 57c17 0 30.8 14.8 30.8 33a30.3 30.3 0 0 1-5.1 17.2L132.8 214Z"
        />
      </svg>
      <span className="sr-only">love</span>
      <span>by</span>
      <a
        href="https://vietbrosinaus.com"
        target="_blank"
        rel="noopener noreferrer"
        className="font-semibold text-terracotta-700 underline underline-offset-2"
      >
        vietbrosinaus
      </a>
    </span>
  );
}
