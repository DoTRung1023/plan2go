/**
 * A one-off, and it has to be run BEFORE `pnpm db:push`, while the database's
 * own TravelMode enum still has CYCLE in it. Postgres cannot drop a value that
 * rows are still holding, so pushing first fails and leaves the schema and the
 * database disagreeing.
 *
 *   pnpm db:reset-cycling     # this, first
 *   pnpm db:push              # then the enum value goes
 *
 * Written as SQL rather than through the client on purpose. The generated
 * client is built from schema.prisma, which no longer has CYCLE, so it would
 * refuse to name the very value this has to find. SQL talks to the database's
 * enum, which still has it until the push.
 *
 * Cycling is gone because the Routes API does not answer for it across much of
 * the world, so the product was offering a way to travel it could not actually
 * cost. Legs that were cycled become walked: it is the other way of getting
 * there under your own power, and the honest replacement for a number that was
 * never really priced is a slow one rather than a fast one.
 *
 * Cached legs are deleted rather than converted. The cache holds answers we can
 * ask for again, and a cycling duration relabelled as a walking one would be
 * wrong for as long as it lived.
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

try {
  const stops = await db.$executeRaw`
    UPDATE "Stop" SET "travelMode" = 'WALK' WHERE "travelMode" = 'CYCLE'
  `;
  const days = await db.$executeRaw`
    UPDATE "Day" SET "endTravelMode" = 'WALK' WHERE "endTravelMode" = 'CYCLE'
  `;
  const cached = await db.$executeRaw`
    DELETE FROM "LegCache" WHERE "mode" = 'CYCLE'
  `;

  console.log(
    `Walked ${stops} stop leg(s) and ${days} day-end leg(s) that were cycled.\n` +
      `Dropped ${cached} cached cycling leg(s).\n` +
      "Now run: pnpm db:push",
  );
} finally {
  await db.$disconnect();
}
