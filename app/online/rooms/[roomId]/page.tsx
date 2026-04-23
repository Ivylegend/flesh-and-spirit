import OnlinePlayScreen from "@/components/FleshAndSpirit/OnlinePlayScreen";

interface OnlineRoomPageProps {
  params: Promise<{
    roomId: string;
  }>;
}

export default async function OnlineRoomPage({
  params,
}: OnlineRoomPageProps) {
  const { roomId } = await params;

  return <OnlinePlayScreen roomId={roomId} backHref="/online" />;
}
