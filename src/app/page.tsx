import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/userId";
import { DEFAULT_MIN_SCORE } from "@/lib/constants";
import SignalApp from "@/components/SignalApp";

export const dynamic = "force-dynamic";

export default async function Page() {
  const userId = await getUserId();

  const [watches, alerts, setting] = userId
    ? await Promise.all([
        prisma.watch.findMany({ where: { userId }, orderBy: { createdAt: "desc" } }),
        prisma.alert.findMany({
          where: { userId, dismissed: false },
          orderBy: { createdAt: "desc" },
          take: 50,
        }),
        prisma.setting.findUnique({ where: { userId } }),
      ])
    : [[], [], null];

  return (
    <SignalApp
      initialWatches={watches}
      initialAlerts={alerts}
      initialSetting={{
        minScore: setting?.minScore ?? DEFAULT_MIN_SCORE,
        browserNotify: setting?.browserNotify ?? true,
      }}
    />
  );
}
