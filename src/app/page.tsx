import { HomeClient } from "@/components/HomeClient";
import { countLiveRooms } from "@/lib/room-service";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let liveCount = 0;
  try {
    liveCount = await countLiveRooms();
  } catch {
    liveCount = 0;
  }

  return <HomeClient liveCount={liveCount} />;
}
