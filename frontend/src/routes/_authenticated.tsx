import { Outlet, createFileRoute } from "@tanstack/react-router";
import { AuthGate } from "@/components/sentinel/soc";

export const Route = createFileRoute("/_authenticated")({ component: () => <AuthGate><Outlet /></AuthGate> });