import { createFileRoute } from "@tanstack/react-router";
import { LoginPage } from "@/components/sentinel/soc";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Analyst Login | SentinelIDS" },
      { name: "description", content: "Secure analyst access to the SentinelIDS network intrusion monitoring console." },
      { property: "og:title", content: "Analyst Login | SentinelIDS" },
      { property: "og:description", content: "Secure analyst access to the SentinelIDS network intrusion monitoring console." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LoginPage,
});