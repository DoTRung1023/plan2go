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

/** Out of a tray and away: what handing a link to somebody else looks like. */
export function ShareIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" />
      <path d="M12 15V3" />
      <path d="M8 7l4-4 4 4" />
    </Glyph>
  );
}

/** Into a tray and down: the mirror of Share, what a file landing with you looks like. */
export function DownloadIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M12 3v12" />
      <path d="M7 10l5 5 5-5" />
      <path d="M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4" />
    </Glyph>
  );
}

export function TrashIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M4 7h16" />
      <path d="M9 7V4h6v3" />
      <path d="M7 7l1 13h8l1-13" />
    </Glyph>
  );
}

export function ChevronLeftIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M15 5l-7 7 7 7" />
    </Glyph>
  );
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M9 5l7 7-7 7" />
    </Glyph>
  );
}

/** A whole arrow, shaft and head, for stepping through something in order. */
export function ArrowLeftIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M19 12H5" />
      <path d="M12 19l-7-7 7-7" />
    </Glyph>
  );
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M5 12h14" />
      <path d="M12 5l7 7-7 7" />
    </Glyph>
  );
}

/** Three dots: the conventional shape for "there are more actions here". */
export function MoreIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <circle cx="5" cy="12" r="1" fill="currentColor" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
      <circle cx="19" cy="12" r="1" fill="currentColor" />
    </Glyph>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M12 5v14M5 12h14" />
    </Glyph>
  );
}

export function MinusIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M5 12h14" />
    </Glyph>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M20 6 9 17l-5-5" />
    </Glyph>
  );
}

/** Four corners pushing out. The one control that is about the frame, not the map. */
export function ExpandIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3" />
    </Glyph>
  );
}

export function ShrinkIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M8 3v3a2 2 0 0 1-2 2H3M16 3v3a2 2 0 0 0 2 2h3M21 16h-3a2 2 0 0 0-2 2v3M3 16h3a2 2 0 0 1 2 2v3" />
    </Glyph>
  );
}

/** Six dots, the shape a thing you can pick up and move has. Filled, not stroked. */
export function GripIcon({ size, className }: Omit<IconProps, "strokeWidth">) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      className={className}
    >
      <circle cx="9" cy="6" r="1.6" />
      <circle cx="15" cy="6" r="1.6" />
      <circle cx="9" cy="12" r="1.6" />
      <circle cx="15" cy="12" r="1.6" />
      <circle cx="9" cy="18" r="1.6" />
      <circle cx="15" cy="18" r="1.6" />
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

/** A pencil: the conventional shape for "this can be changed". */
export function PencilIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M21.2 6.8a2.8 2.8 0 0 0-4-4L3.9 16.2a2 2 0 0 0-.5.8l-1.4 4.4a.5.5 0 0 0 .6.6l4.4-1.3a2 2 0 0 0 .8-.5Z" />
      <path d="m15 5 4 4" />
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

/** A flag on its pole: the conventional shape for "this is where it finishes". */
export function FlagIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <path d="M4 22v-7" />
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

/** A star, filled: the shape every rating out of five is drawn in. */
export function StarIcon({ size, className }: Omit<IconProps, "strokeWidth">) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      className={className}
    >
      <path d="M12 2.6l2.9 6.1 6.7.8-4.9 4.6 1.3 6.6L12 17.4l-6 3.3 1.3-6.6L2.4 9.5l6.7-.8z" />
    </svg>
  );
}

/** A picture: the sign that there are photographs of something. */
export function PhotosIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <circle cx="9" cy="10" r="1.6" />
      <path d="M21 16l-5-5-8 8" />
    </Glyph>
  );
}

export function GlobeIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18" />
    </Glyph>
  );
}

export function PhoneIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M5 4h3.5l1.7 4.2-2.1 1.4a11 11 0 0 0 6.3 6.3l1.4-2.1L20 15.5V19a1.8 1.8 0 0 1-1.9 1.8A15 15 0 0 1 3.2 5.9 1.8 1.8 0 0 1 5 4z" />
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

export function TrainIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <rect width="16" height="16" x="4" y="3" rx="3" />
      <path d="M4 11h16M12 3v8m-4 8-2 3m12 0-2-3" />
      <path d="M8 15h.01M16 15h.01" />
    </Glyph>
  );
}
