import type { Metadata } from "next";
import { HomePage as HomePageView } from "@/features/home/home-page";
import { getHomePageData } from "@/services/home";

export const metadata: Metadata = {
  title: "Bijoux en résine et fleurs naturelles",
  description: "Bijoux en résine fabriqués à la main avec des fleurs naturelles séchées.",
};

export default async function HomePage() {
  return <HomePageView data={await getHomePageData()} />;
}
