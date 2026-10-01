/**
 * On a phone, a control drawn smaller than a finger answers one anyway: the
 * room it answers in reaches six past it on every side, over padding around it
 * where nothing else is pressed, and it is drawn no larger. For the small round
 * buttons on rows too tight to draw them at a finger's size, which a finger
 * would otherwise have to aim at.
 */
export const FINGER_ROOM = "max-lg:relative max-lg:after:absolute max-lg:after:-inset-[6px]";
