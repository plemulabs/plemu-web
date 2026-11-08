import { BrowserPlayer } from "../../../components/devnet/player";
export default async function Play({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <BrowserPlayer key={slug} slug={slug} />;
}
