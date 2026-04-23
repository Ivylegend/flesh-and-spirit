import OnlinePlayScreen from "@/components/FleshAndSpirit/OnlinePlayScreen";

interface OnlineInvitationPageProps {
  params: Promise<{
    token: string;
  }>;
}

export default async function OnlineInvitationPage({
  params,
}: OnlineInvitationPageProps) {
  const { token } = await params;

  return <OnlinePlayScreen inviteToken={token} backHref="/online" />;
}
