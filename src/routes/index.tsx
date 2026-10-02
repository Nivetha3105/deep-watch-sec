import { createFileRoute } from "@tanstack/react-router";
import { SentinelDashboard } from "@/components/sentinel/dashboard";

// No head() here: the home route inherits title/description/og/twitter from
// __root.tsx, and ships no og:image so serve-time hosting can inject the
// project's social preview (explicit og:image or latest screenshot).
export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SentinelIDS | Threat Monitoring Console" },
      { name: "description", content: "Professional real-time network intrusion and threat monitoring dashboard." },
      { property: "og:title", content: "SentinelIDS | Threat Monitoring Console" },
      { property: "og:description", content: "Professional real-time network intrusion and threat monitoring dashboard." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

// IMPORTANT: Replace this placeholder. See ./README.md for routing conventions.
function Index() {
  return <SentinelDashboard />;
}
