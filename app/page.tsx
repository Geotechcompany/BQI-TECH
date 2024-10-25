import { auth } from "@clerk/nextjs/server";
import ClientHomePage from "@/components/ClientHomePage";

export default async function HomePage() {
  const { userId } = await auth();

  return <ClientHomePage userId={userId} />;
}
