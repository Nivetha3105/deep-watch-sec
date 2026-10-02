import * as AlertDialog from "@radix-ui/react-alert-dialog";
import * as Dialog from "@radix-ui/react-dialog";
import {
  Activity, AlertTriangle, BellRing, Check, ChevronLeft, ChevronRight, CircleDot, Eye,
  Filter, Network, Radar, RefreshCw, Search, ServerCog, ShieldCheck, Trash2, UserRoundSearch, X, Zap,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { sentinelApi, type AnalyticsSummary, type AttackType, type SecurityAlert, type Severity } from "@/services/sentinel-api";

const severityTone: Record<Severity, string> = {
  HIGH: "border-severity-high/35 bg-severity-high/10 text-severity-high",
  MEDIUM: "border-severity-medium/35 bg-severity-medium/10 text-severity-medium",
  LOW: "border-severity-low/35 bg-severity-low/10 text-severity-low",
};

function SeverityBadge({ value }: { value: Severity }) {
  return <span className={cn("inline-flex min-w-16 items-center justify-center rounded-sm border px-2 py-1 font-mono text-[10px] font-semibold", severityTone[value])}>{value}</span>;
}

function SectionHeader({ title, eyebrow, right }: { title: string; eyebrow?: string; right?: React.ReactNode }) {
  return <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 border-b border-border px-5 py-4">
    <div className="min-w-0"><p className="mb-1 font-mono text-[10px] uppercase tracking-[0.18em] text-primary">{eyebrow ?? "Monitor"}</p><h2 className="truncate text-sm font-semibold uppercase tracking-[0.08em] text-foreground">{title}</h2></div>
    {right}
  </div>;
}

function LiveMark({ label = "Live" }: { label?: string }) {
  return <span className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-severity-low"><span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-severity-low opacity-40" /><span className="relative h-2 w-2 rounded-full bg-severity-low" /></span>{label}</span>;
}

function KpiCard({ label, value, detail, icon: Icon, tone }: { label: string; value: string; detail: string; icon: typeof Activity; tone?: "danger" }) {
  return <article className="panel-surface group relative overflow-hidden rounded-lg border border-border p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30">
    <div className={cn("absolute inset-x-0 top-0 h-px bg-primary/50", tone === "danger" && "bg-severity-high/60")} />
    <div className="mb-7 flex items-start justify-between"><span className="font-mono text-[10px] font-semibold tracking-[0.15em] text-muted-foreground">{label}</span><span className={cn("grid h-8 w-8 place-items-center rounded-md border border-primary/20 bg-primary/8 text-primary", tone === "danger" && "border-severity-high/25 bg-severity-high/8 text-severity-high")}><Icon size={15} /></span></div>
    <div className="flex items-end justify-between gap-3"><div><div className="font-mono text-[28px] font-medium tracking-tight text-foreground">{value}</div><p className="mt-1 text-[11px] text-muted-foreground">{detail}</p></div><LiveMark label="sync" /></div>
  </article>;
}

function Header({ onSimulate, busy }: { onSimulate: (type: AttackType) => void; busy: AttackType | null }) {
  const [clock, setClock] = useState("");
  useEffect(() => { const update = () => setClock(new Date().toLocaleTimeString("en-GB", { hour12: false })); update(); const timer = window.setInterval(update, 1000); return () => window.clearInterval(timer); }, []);
  const simulations: { type: AttackType; icon: typeof Activity }[] = [{ type: "BRUTE FORCE", icon: UserRoundSearch }, { type: "PORT SCAN", icon: Radar }, { type: "DOS BURST", icon: Zap }];
  return <header className="sticky top-0 z-30 border-b border-border bg-background/92 backdrop-blur-xl">
    <div className="mx-auto grid max-w-[1720px] grid-cols-[minmax(300px,1fr)_auto_minmax(260px,1fr)] items-center gap-5 px-6 py-3">
      <div className="flex min-w-0 items-center gap-3"><span className="cyan-glow grid h-10 w-10 shrink-0 place-items-center rounded-md border border-primary/35 bg-primary/10 text-primary"><ShieldCheck size={22} /></span><div className="min-w-0"><div className="flex items-center gap-2"><h1 className="text-lg font-semibold tracking-wide">Sentinel<span className="text-primary">IDS</span></h1><span className="rounded-sm border border-primary/25 bg-primary/8 px-1.5 py-0.5 font-mono text-[9px] text-primary">v2.0</span></div><p className="truncate text-[10px] text-muted-foreground">Real-Time Network Intrusion &amp; Threat Monitoring</p></div></div>
      <div className="flex items-center gap-2"><span className="mr-1 font-mono text-[9px] tracking-[0.17em] text-muted-foreground">SIMULATE</span>{simulations.map(({ type, icon: Icon }) => <Button key={type} onClick={() => onSimulate(type)} disabled={Boolean(busy)} className="h-8 px-2.5 font-mono text-[9px]"><Icon size={13} className={busy === type ? "animate-pulse text-primary" : "text-muted-foreground"} />{type}</Button>)}</div>
      <div className="flex justify-end gap-5"><div className="text-right"><LiveMark label="Connected" /><p className="mt-0.5 font-mono text-[9px] text-muted-foreground">LIVE SOCKET STREAM</p></div><div className="border-l border-border pl-5 text-right"><p className="font-mono text-sm text-foreground">{clock || "--:--:--"}</p><p className="text-[9px] uppercase tracking-widest text-muted-foreground">UTC +05:30</p></div></div>
    </div>
  </header>;
}

function AnalyticsPanel({ summary }: { summary: AnalyticsSummary }) {
  const severity = Object.entries(summary.severity) as [Severity, number][];
  const vectors = Object.entries(summary.vectors) as [AttackType, number][];
  const maxVector = Math.max(...vectors.map(([, count]) => count));
  return <div className="grid grid-cols-2 gap-4">
    <section className="panel-surface rounded-lg border border-border"><SectionHeader eyebrow="Threat analytics" title="Severity Distribution" right={<span className="font-mono text-[10px] text-muted-foreground">TOTAL {summary.alerts}</span>} /><div className="p-5">
      <div className="mb-5 flex h-2 overflow-hidden rounded-sm bg-muted">{severity.map(([level, count]) => <div key={level} className={cn(level === "HIGH" ? "bg-severity-high" : level === "MEDIUM" ? "bg-severity-medium" : "bg-severity-low")} style={{ width: `${(count / summary.alerts) * 100}%` }} />)}</div>
      <div className="grid grid-cols-3 gap-3">{severity.map(([level, count]) => <div key={level} className="border-l border-border pl-3"><p className={cn("font-mono text-[10px]", level === "HIGH" ? "text-severity-high" : level === "MEDIUM" ? "text-severity-medium" : "text-severity-low")}>{level}</p><p className="mt-2 font-mono text-xl">{count}</p><p className="text-[10px] text-muted-foreground">{Math.round((count / summary.alerts) * 100)}% of alerts</p></div>)}</div>
    </div></section>
    <section className="panel-surface rounded-lg border border-border"><SectionHeader eyebrow="Pattern intelligence" title="Detected Attack Vectors" right={<Network size={16} className="text-primary" />} /><div className="space-y-4 p-5">{vectors.map(([vector, count]) => <div key={vector}><div className="mb-2 flex items-center justify-between font-mono text-[10px]"><span className="text-muted-foreground">{vector}</span><span className="text-foreground">{count}</span></div><div className="h-1.5 overflow-hidden rounded-sm bg-muted"><div className="h-full bg-primary transition-all duration-700" style={{ width: `${(count / maxVector) * 100}%` }} /></div></div>)}</div></section>
  </div>;
}

function ThreatStream({ alerts, onClear }: { alerts: SecurityAlert[]; onClear: () => void }) {
  const active = alerts.filter((alert) => alert.status !== "RESOLVED").slice(0, 4);
  return <section className="panel-surface rounded-lg border border-border"><SectionHeader eyebrow="Realtime detection" title="Live Threat Stream" right={<div className="flex items-center gap-4"><LiveMark /><span className="font-mono text-[10px] text-muted-foreground">{active.length} ALERTS</span><Button variant="ghost" onClick={onClear} className="h-7"><Trash2 size={12} />Clear feed</Button></div>} />
    <div className="h-[252px] overflow-y-auto p-3">{active.length === 0 ? <div className="grid h-full place-items-center text-center"><div><ShieldCheck className="mx-auto mb-3 text-severity-low" size={28} /><p className="text-sm font-medium">No active threats detected</p><p className="mt-1 text-[11px] text-muted-foreground">Perimeter monitoring remains active</p></div></div> : <div className="space-y-2">{active.map((alert) => <article key={alert.id} className={cn("grid grid-cols-[76px_130px_130px_minmax(0,1fr)_72px] items-center gap-3 rounded-md border border-border bg-background/35 px-3 py-3 transition-colors hover:border-primary/25 hover:bg-accent/40", alert.fresh && "alert-enter")}><SeverityBadge value={alert.severity} /><div><p className="font-mono text-[10px] text-muted-foreground">VECTOR</p><p className="mt-1 text-[11px] font-semibold">{alert.attackType}</p></div><div><p className="font-mono text-[10px] text-muted-foreground">SOURCE</p><p className="mt-1 font-mono text-[11px] text-primary">{alert.sourceIp}</p></div><div className="min-w-0"><p className="truncate text-xs text-foreground">{alert.description}</p><p className="mt-1 font-mono text-[9px] text-muted-foreground">{alert.id} · {alert.timestamp}</p></div><span className="justify-self-end rounded-sm border border-severity-high/25 bg-severity-high/8 px-2 py-1 font-mono text-[9px] text-severity-high">{alert.status}</span></article>)}</div>}</div>
  </section>;
}

function LoadingRows() { return <>{Array.from({ length: 5 }).map((_, index) => <tr key={index} className="border-b border-border"><td colSpan={7} className="px-5 py-3"><div className="h-8 animate-pulse rounded bg-muted/60" /></td></tr>)}</>; }

function TelemetryTable({ alerts, loading, error, onRefresh, onResolve, onDelete, onView }: { alerts: SecurityAlert[]; loading: boolean; error: string | null; onRefresh: () => void; onResolve: (id: string) => void; onDelete: (alert: SecurityAlert) => void; onView: (alert: SecurityAlert) => void }) {
  const [query, setQuery] = useState(""); const [filter, setFilter] = useState<"ALL" | Severity>("ALL"); const [page, setPage] = useState(1); const perPage = 5;
  const filtered = useMemo(() => alerts.filter((alert) => (filter === "ALL" || alert.severity === filter) && alert.sourceIp.includes(query.trim())), [alerts, filter, query]);
  const pages = Math.max(1, Math.ceil(filtered.length / perPage)); const rows = filtered.slice((page - 1) * perPage, page * perPage);
  useEffect(() => setPage(1), [query, filter]);
  return <section className="panel-surface rounded-lg border border-border"><SectionHeader eyebrow="Forensic record" title="Security Incident Telemetry Log" right={<span className="font-mono text-[10px] text-muted-foreground">RETENTION 30 DAYS</span>} />
    <div className="flex items-center justify-between gap-4 border-b border-border px-4 py-3"><div className="flex items-center gap-3"><label className="relative"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by Source IP" className="h-9 w-64 rounded-md border border-input bg-background/60 pl-9 pr-3 text-xs text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/50" /></label><div className="flex items-center rounded-md border border-border bg-background/40 p-1"><Filter size={13} className="mx-2 text-muted-foreground" />{(["ALL", "HIGH", "MEDIUM", "LOW"] as const).map((level) => <button key={level} onClick={() => setFilter(level)} className={cn("h-7 rounded-sm px-2.5 font-mono text-[9px] transition-colors", filter === level ? "bg-accent text-primary" : "text-muted-foreground hover:text-foreground")}>{level}</button>)}</div></div><Button onClick={onRefresh}><RefreshCw size={13} className={loading ? "animate-spin" : ""} />Refresh</Button></div>
    <div className="overflow-x-auto"><table className="w-full min-w-[1050px] border-collapse text-left"><thead><tr className="border-b border-border bg-background/35 font-mono text-[9px] uppercase tracking-[0.13em] text-muted-foreground"><th className="px-5 py-3 font-medium">Severity</th><th className="px-4 py-3 font-medium">Attack Vector</th><th className="px-4 py-3 font-medium">Source IP</th><th className="px-4 py-3 font-medium">Description</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 font-medium">Timestamp</th><th className="px-4 py-3 text-right font-medium">Action</th></tr></thead><tbody>{loading ? <LoadingRows /> : error ? <tr><td colSpan={7} className="h-48 text-center"><AlertTriangle className="mx-auto mb-2 text-severity-high" /><p className="text-sm">Telemetry failed to load</p><button onClick={onRefresh} className="mt-2 text-xs text-primary">Try again</button></td></tr> : rows.length === 0 ? <tr><td colSpan={7} className="h-48 text-center"><Search className="mx-auto mb-2 text-muted-foreground" /><p className="text-sm">No matching incidents</p></td></tr> : rows.map((alert) => <tr key={alert.id} className="border-b border-border/70 text-xs transition-colors hover:bg-accent/35"><td className="px-5 py-3"><SeverityBadge value={alert.severity} /></td><td className="px-4 py-3 font-medium">{alert.attackType}</td><td className="px-4 py-3 font-mono text-primary">{alert.sourceIp}</td><td className="max-w-[340px] truncate px-4 py-3 text-muted-foreground">{alert.description}</td><td className="px-4 py-3"><span className={cn("inline-flex items-center gap-1.5 font-mono text-[9px]", alert.status === "RESOLVED" ? "text-severity-low" : alert.status === "OPEN" ? "text-severity-high" : "text-severity-medium")}><CircleDot size={10} />{alert.status}</span></td><td className="px-4 py-3 font-mono text-[10px] text-muted-foreground">02 OCT · {alert.timestamp}</td><td className="px-4 py-3"><div className="flex justify-end gap-1"><Button variant="ghost" className="h-7 w-7 p-0" title="View alert" onClick={() => onView(alert)}><Eye size={13} /></Button><Button variant="ghost" className="h-7 w-7 p-0" title="Resolve alert" disabled={alert.status === "RESOLVED"} onClick={() => onResolve(alert.id)}><Check size={13} /></Button><Button variant="ghost" className="h-7 w-7 p-0 hover:text-severity-high" title="Delete alert" onClick={() => onDelete(alert)}><Trash2 size={13} /></Button></div></td></tr>)}</tbody></table></div>
    <div className="flex items-center justify-between px-5 py-3"><p className="font-mono text-[10px] text-muted-foreground">SHOWING {rows.length} OF {filtered.length} RESULTS</p><div className="flex items-center gap-3"><Button variant="ghost" className="h-7" disabled={page === 1} onClick={() => setPage((p) => p - 1)}><ChevronLeft size={13} />Previous</Button><span className="font-mono text-[10px] text-muted-foreground">PAGE {page} / {pages}</span><Button variant="ghost" className="h-7" disabled={page === pages} onClick={() => setPage((p) => p + 1)}>Next<ChevronRight size={13} /></Button></div></div>
  </section>;
}

function DeleteDialog({ alert, onClose, onConfirm }: { alert: SecurityAlert | null; onClose: () => void; onConfirm: () => void }) {
  return <AlertDialog.Root open={Boolean(alert)} onOpenChange={(open) => !open && onClose()}><AlertDialog.Portal><AlertDialog.Overlay className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm" /><AlertDialog.Content className="panel-surface fixed left-1/2 top-1/2 z-50 w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border p-6 shadow-2xl"><AlertDialog.Title className="text-base font-semibold">Delete telemetry record?</AlertDialog.Title><AlertDialog.Description className="mt-2 text-sm leading-6 text-muted-foreground">This will remove <span className="font-mono text-foreground">{alert?.id}</span> from the current incident log.</AlertDialog.Description><div className="mt-6 flex justify-end gap-2"><AlertDialog.Cancel asChild><Button>Cancel</Button></AlertDialog.Cancel><AlertDialog.Action asChild><Button variant="danger" onClick={onConfirm}><Trash2 size={13} />Delete record</Button></AlertDialog.Action></div></AlertDialog.Content></AlertDialog.Portal></AlertDialog.Root>;
}

function DetailDialog({ alert, onClose }: { alert: SecurityAlert | null; onClose: () => void }) {
  return <Dialog.Root open={Boolean(alert)} onOpenChange={(open) => !open && onClose()}><Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm" /><Dialog.Content className="panel-surface fixed left-1/2 top-1/2 z-50 w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border"><div className="flex items-start justify-between border-b border-border p-5"><div><p className="font-mono text-[10px] text-primary">INCIDENT DETAIL</p><Dialog.Title className="mt-1 text-lg font-semibold">{alert?.id}</Dialog.Title></div><Dialog.Close className="text-muted-foreground hover:text-foreground"><X size={18} /></Dialog.Close></div><div className="grid grid-cols-2 gap-x-8 gap-y-6 p-5 text-xs">{alert && <><div><p className="mb-2 text-muted-foreground">Severity</p><SeverityBadge value={alert.severity} /></div><div><p className="mb-2 text-muted-foreground">Status</p><p>{alert.status}</p></div><div><p className="mb-2 text-muted-foreground">Attack vector</p><p>{alert.attackType}</p></div><div><p className="mb-2 text-muted-foreground">Source address</p><p className="font-mono text-primary">{alert.sourceIp}</p></div><div className="col-span-2"><p className="mb-2 text-muted-foreground">Detection summary</p><p className="leading-6">{alert.description}</p></div></>}</div></Dialog.Content></Dialog.Portal></Dialog.Root>;
}

export function SentinelDashboard() {
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]); const [summary, setSummary] = useState<AnalyticsSummary | null>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null); const [busy, setBusy] = useState<AttackType | null>(null); const [deleteTarget, setDeleteTarget] = useState<SecurityAlert | null>(null); const [detail, setDetail] = useState<SecurityAlert | null>(null); const [feedVisible, setFeedVisible] = useState(true);
  const load = async () => { setLoading(true); setError(null); try { const [nextAlerts, nextSummary] = await Promise.all([sentinelApi.getAlerts(), sentinelApi.getSummary()]); setAlerts(nextAlerts); setSummary(nextSummary); } catch { setError("Unable to load telemetry"); } finally { setLoading(false); } };
  useEffect(() => { void load(); }, []);
  const simulate = async (type: AttackType) => { setBusy(type); const alert = await sentinelApi.simulate(type); setAlerts((current) => [alert, ...current]); setFeedVisible(true); setBusy(null); toast.warning(`${type} signature injected`, { description: `${alert.sourceIp} added to the live stream.` }); };
  const resolve = async (id: string) => { await sentinelApi.resolveAlert(id); setAlerts((current) => current.map((alert) => alert.id === id ? { ...alert, status: "RESOLVED" } : alert)); toast.success("Incident resolved", { description: `${id} has been marked resolved.` }); };
  const remove = async () => { if (!deleteTarget) return; await sentinelApi.deleteAlert(deleteTarget.id); setAlerts((current) => current.filter((alert) => alert.id !== deleteTarget.id)); toast.success("Telemetry record deleted"); setDeleteTarget(null); };
  return <div className="soc-grid min-h-screen bg-background"><Header onSimulate={simulate} busy={busy} /><main className="mx-auto max-w-[1720px] space-y-4 px-6 py-5">
    <div className="flex items-center justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">Operations / Threat overview</p><p className="mt-1 text-xs text-muted-foreground">Monitoring perimeter activity across 12 active network segments</p></div><div className="flex items-center gap-5 font-mono text-[9px] text-muted-foreground"><span>ENGINE <b className="text-severity-low">OPERATIONAL</b></span><span>LATENCY <b className="text-foreground">18 MS</b></span><span>UPTIME <b className="text-foreground">99.98%</b></span></div></div>
    {loading || !summary ? <div className="grid grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-36 animate-pulse rounded-lg border border-border bg-card" />)}</div> : <div className="grid grid-cols-4 gap-4"><KpiCard label="TELEMETRY INGESTED" value={summary.telemetry.toLocaleString()} detail="Total network events" icon={Activity} /><KpiCard label="INTRUSION ALERTS" value={summary.alerts.toString()} detail="+8 in the last hour" icon={BellRing} /><KpiCard label="CRITICAL INCIDENTS" value={summary.critical.toString()} detail="3 require triage" icon={AlertTriangle} tone="danger" /><KpiCard label="MALICIOUS ACTORS" value={summary.actors.toString()} detail="Unique suspicious source IPs" icon={ServerCog} /></div>}
    {summary && <AnalyticsPanel summary={summary} />}
    <ThreatStream alerts={feedVisible ? alerts : []} onClear={() => { setFeedVisible(false); toast("Live feed cleared", { description: "Stored incident records remain available below." }); }} />
    <TelemetryTable alerts={alerts} loading={loading} error={error} onRefresh={() => void load()} onResolve={(id) => void resolve(id)} onDelete={setDeleteTarget} onView={setDetail} />
    <footer className="flex items-center justify-between pb-2 pt-1 font-mono text-[9px] uppercase tracking-wider text-muted-foreground"><span>SentinelIDS Security Operations Console</span><span className="flex items-center gap-2"><ShieldCheck size={12} className="text-severity-low" />All monitoring systems nominal</span></footer>
  </main><DeleteDialog alert={deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={() => void remove()} /><DetailDialog alert={detail} onClose={() => setDetail(null)} /></div>;
}
