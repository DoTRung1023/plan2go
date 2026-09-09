/**
 * A one-off. Checkpoints used to be something any stop could be turned into,
 * anywhere in a day. They now mean one thing only: where a day begins and where
 * it ends, which are held on the day itself and not as stops. Every stop still
 * carrying the flag is therefore a mid-day checkpoint from the old meaning, and
 * this turns them all back into ordinary stops.
 *
 * The stay each one had was kept while it was a checkpoint, so a stop coming
 * back from this is the stop it was before, with the time it had.
 *
 *   pnpm db:reset-checkpoints
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

try {
  const { count } = await db.stop.updateMany({
    where: { checkpoint: true },
    data: { checkpoint: false },
  });
  console.log(`Turned ${count} checkpoint stop(s) back into ordinary stops.`);
} finally {
  await db.$disconnect();
}
