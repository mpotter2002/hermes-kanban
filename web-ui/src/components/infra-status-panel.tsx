import type { ReactElement } from "react";
import useInfraStatus from "@/hooks/use-infra-status";

type ServiceStatus = "checking" | "online" | "offline";

function StatusDot({ status }: { status: ServiceStatus }): ReactElement {
	const colorClass =
		status === "online"
			? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]"
			: status === "checking"
			? "bg-blue-400/70 animate-pulse"
			: "bg-zinc-500";
	return <span className={`inline-block h-2.5 w-2.5 rounded-full shrink-0 ${colorClass}`} aria-hidden />;
}

function UsageBar({ label, value, max, unit }: { label: string; value: number; max: number; unit: string }): ReactElement {
	const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
	const color = pct > 85 ? "bg-red-500" : pct > 60 ? "bg-yellow-400" : "bg-green-500";
	return (
		<div className="flex flex-col gap-1">
			<div className="flex justify-between text-xs text-text-secondary">
				<span>{label}</span>
				<span>{unit === "%" ? `${Math.round(pct)}%` : unit === "sessions" ? `${Math.round(value)} active` : `${value.toFixed(1)} / ${max.toFixed(1)} ${unit}`}</span>
			</div>
			<div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
				<div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
			</div>
		</div>
	);
}

interface ServiceCard {
	id: string;
	name: string;
	detail: string;
	status: ServiceStatus;
}

export default function InfraStatusPanel(): ReactElement {
	const { data, isLoading: loading } = useInfraStatus();

	const toStatus = (value: boolean | undefined): ServiceStatus => {
		if (loading) return "checking";
		return value ? "online" : "offline";
	};

	const statusLabel = (s: ServiceStatus, onLabel: string) =>
		s === "online" ? onLabel : s === "checking" ? "Checking..." : "Unreachable";

	const services: ServiceCard[] = [
		{
			id: "gateway",
			name: "Hermes Gateway",
			detail: statusLabel(toStatus(data?.gateway), "Running · :18789"),
			status: toStatus(data?.gateway),
		},
		{
			id: "dashboard",
			name: "Hermes Dashboard",
			detail: statusLabel(toStatus(data?.dashboard), "Running · :3001"),
			status: toStatus(data?.dashboard),
		},
		{
			id: "kanban",
			name: "Hermes Kanban",
			detail: "Running · :3484",
			status: "online",
		},
		{
			id: "tailscale",
			name: "Tailscale",
			detail: "Connected · 100.105.191.62",
			status: "online",
		},
	];
	const agentCards: ServiceCard[] = [
		{
			id: "claude",
			name: "Claude Code",
			detail: loading ? "Checking..." : data?.claude_running ? "Active" : "Idle",
			status: toStatus(data?.claude_running),
		},
		{
			id: "codex",
			name: "OpenAI Codex",
			detail: loading ? "Checking..." : data?.codex_running ? "Active" : "Idle",
			status: toStatus(data?.codex_running),
		},
	];

	return (
		<div className="flex h-full min-h-0 flex-col rounded-md border border-border bg-surface-1">
			<div className="border-b border-border px-4 py-3">
				<h2 className="text-sm font-semibold text-text-primary">Infrastructure</h2>
				<p className="mt-0.5 text-xs text-text-secondary">VM service health · refreshes every 10s</p>
			</div>
			<div className="flex flex-col gap-2 overflow-y-auto p-3">
				{services.map((svc) => (
					<div key={svc.id} className="flex items-center justify-between rounded-lg border border-border bg-surface-2 px-4 py-3">
						<div>
							<p className="text-sm font-medium text-text-primary">{svc.name}</p>
							<p className="mt-0.5 text-xs text-text-secondary">{svc.detail}</p>
						</div>
						<StatusDot status={svc.status} />
					</div>
				))}
				{agentCards.map((svc) => (
					<div key={svc.id} className="flex items-center justify-between rounded-lg border border-border bg-surface-2 px-4 py-3">
						<div>
							<p className="text-sm font-medium text-text-primary">{svc.name}</p>
							<p className="mt-0.5 text-xs text-text-secondary">{svc.detail}</p>
						</div>
						<StatusDot status={svc.status} />
					</div>
				))}

				{/* Agent Sessions */}
				<div className="rounded-lg border border-border bg-surface-2 px-4 py-3">
					<p className="mb-2 text-sm font-medium text-text-primary">Active Sessions</p>
					{loading ? (
						<p className="text-xs text-text-secondary">Loading...</p>
					) : (
						<div className="flex flex-col gap-2.5">
							<UsageBar label="Claude Code" value={data?.claude_sessions ?? 0} max={Math.max(data?.claude_sessions ?? 0, 4)} unit="sessions" />
							<UsageBar label="OpenAI Codex" value={data?.codex_sessions ?? 0} max={Math.max(data?.codex_sessions ?? 0, 4)} unit="sessions" />
						</div>
					)}
				</div>

				{/* System Resources */}
				<div className="rounded-lg border border-border bg-surface-2 px-4 py-3">
					<p className="mb-2 text-sm font-medium text-text-primary">System Resources</p>
					{loading ? (
						<p className="text-xs text-text-secondary">Loading...</p>
					) : data ? (
						<div className="flex flex-col gap-2.5">
							<UsageBar label="CPU" value={data.cpu} max={100} unit="%" />
							<UsageBar label="Memory" value={data.mem_used_gb} max={data.mem_total_gb} unit="GB" />
							<UsageBar label="Disk" value={data.disk_used_gb} max={data.disk_total_gb} unit="GB" />
						</div>
					) : (
						<p className="text-xs text-text-secondary">Unavailable</p>
					)}
				</div>
			</div>
		</div>
	);
}
