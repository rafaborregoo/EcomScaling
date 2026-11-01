import { ModelLabPage } from "../lab-view";
export default async function Page({
  params,
}: {
  params: Promise<{ agentCode: string }>;
}) {
  const { agentCode } = await params;
  return <ModelLabPage agentCode={agentCode} />;
}
