/**
 * The icon set, drawn from Lucide at the weights DESIGN.md asks for.
 *
 * Every one of these is decorative. Nothing in this product is an icon on its
 * own, so each is hidden from a screen reader and the words beside it are what
 * gets read out.
 *
 * These are primitives: a shape with no domain knowledge. Which icon stands for
 * a travel mode is a question for the feature that knows what a travel mode is.
 */
interface IconProps {
  /** Edge of the square the glyph is drawn in. */
  readonly size: number;
  /** Heavier for interface chrome, lighter inline beside text. */
  readonly strokeWidth?: number;
  readonly className?: string;
}

function Glyph({
  size,
  strokeWidth = 2.6,
  className,
  children,
}: IconProps & { readonly children: React.ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {children}
    </svg>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </Glyph>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M18 6 6 18M6 6l12 12" />
    </Glyph>
  );
}

export function PinIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="2.6" />
    </Glyph>
  );
}

export function HomeIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="m3 10 9-7 9 7v10a1.6 1.6 0 0 1-1.6 1.6H4.6A1.6 1.6 0 0 1 3 20Z" />
      <path d="M9.5 21.5v-7h5v7" />
    </Glyph>
  );
}

export function ClockIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.2 2" />
    </Glyph>
  );
}

export function CarIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" />
      <circle cx="7" cy="17" r="2" />
      <path d="M9 17h6" />
      <circle cx="17" cy="17" r="2" />
    </Glyph>
  );
}

export function WalkIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M4 16v-2.4C4 11.5 3 10.5 3 8c0-2.7 1.5-6 4.5-6C9.4 2 10 3.8 10 5.5c0 3.1-2 5.7-2 8.7V16a2 2 0 1 1-4 0Z" />
      <path d="M20 20v-2.4c0-1.1 1-2.1 1-4.6 0-2.7-1.5-6-4.5-6C14.6 7 14 8.8 14 10.5c0 3.1 2 5.7 2 8.7V20a2 2 0 1 0 4 0Z" />
      <path d="M16 17h4M4 13h4" />
    </Glyph>
  );
}

export function BikeIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <circle cx="18.5" cy="17.5" r="3.5" />
      <circle cx="5.5" cy="17.5" r="3.5" />
      <circle cx="15" cy="5" r="1" />
      <path d="M12 17.5V14l-3-3 4-3 2 3h2" />
    </Glyph>
  );
}

export function PlaneIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2Z" />
    </Glyph>
  );
}

export function TrainIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <rect width="16" height="16" x="4" y="3" rx="3" />
      <path d="M4 11h16M12 3v8m-4 8-2 3m12 0-2-3" />
      <path d="M8 15h.01M16 15h.01" />
    </Glyph>
  );
}
