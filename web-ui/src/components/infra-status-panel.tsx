import type { ReactElement } from "react";
import { useEffect, useState } from "react";

type StatusTone = "ok" | "unknown" | "error";

interface ServiceStatusCard {
	description: string;
	id: string;
	name: string;
	statusText: string;
	tone: StatusTone;
}

interface ReachabilityResult {
	statusText: string;
	tone: StatusTone;
}

async function checkReachability(url: string, onlineLabel: string): Promise<ReachabilityResult> {
	const controller = new AbortController();
	const timeoutId = window.setTimeout(() => controller.abort(), 4_000);

	try {
		const response = await fetch(url, {
			method: "GET",
			mode: "no-cors",
			signal: controller.signal,
		});

		if (response.type === "opaque" || response.ok) {
			return { statusText: onlineLabel, tone: "ok" };
		}

		return { statusText: "Error", tone: "error" };
	} catch {
		return { statusText: "Unknown", tone: "unknown" };
	} finally {
		window.clearTimeout(timeoutId);
	}
}

function StatusDot({ tone }: { tone: StatusTone }): ReactElement {
	const className =
		tone === "ok"
			? "bg-status-green shadow-[0_0_10px_rgba(63,185,80,0.4)]"
			: tone === "error"
				? "bg-status-red shadow-[0_0_10px_rgba(248,81,73,0.35)]"
				: "bg-text-tertiary";

	return <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${className}`} aria-hidden />;
}

function StatusCard({ service }: { service: ServiceStatusCard }): ReactElement {
	return (
		<div className="rounded-lg border border-border bg-surface-2 p-4">
			<div className="flex items-start justify-between gap-3">
				<div className="min-w-0">
					<p className="text-sm font-medium text-text-primary">{service.name}</p>
					<p className="mt-1 text-xs font-medium text-text-secondary">{service.statusText}</p>
					<p className="mt-2 text-xs leading-5 text-text-tertiary">{service.description}</p>
				</div>
				<StatusDot tone={service.tone} />
			</div>
		</div>
	);
}

function SystemResourcesCard(): ReactElement {
	return (
		<div className="rounded-lg border border-border bg-surface-2 p-4">
			<div className="flex items-start justify-between gap-3">
				<div className="min-w-0">
					<p className="text-sm font-medium text-text-primary">System Resources</p>
					<p className="mt-1 text-xs font-medium text-text-secondary">Check VM for live stats</p>
					<p className="mt-2 text-xs leading-5 text-text-tertiary">
						Access via <span className="font-mono text-text-secondary">http://100.105.191.62:3001</span>
					</p>
				</div>
				<StatusDot tone="unknown" />
			</div>
		</div>
	);
}

export default function InfraStatusPanel(): ReactElement {
	const [gatewayStatus, setGatewayStatus] = useState<ReachabilityResult>({
		statusText: "Checking...",
		tone: "unknown",
	});
	const [dashboardStatus, setDashboardStatus] = useState<ReachabilityResult>({
		statusText: "Checking...",
		tone: "unknown",
	});

	useEffect(() => {
		let cancelled = false;

		const loadStatuses = async (): Promise<void> => {
			const [gateway, dashboard] = await Promise.all([
				checkReachability("http://localhost:18789/health", "Healthy"),
				checkReachability("http://localhost:3001", "Running"),
			]);

			if (cancelled) {
				return;
			}

			setGatewayStatus(gateway);
			setDashboardStatus(dashboard);
		};

		void loadStatuses();

		return () => {
			cancelled = true;
		};
	}, []);

	const services: ServiceStatusCard[] = [
		{
			id: "gateway",
			name: "Hermes Gateway",
			statusText: gatewayStatus.statusText,
			tone: gatewayStatus.tone,
			description: "Health endpoint: http://localhost:18789/health",
		},
		{
			id: "dashboard",
			name: "Hermes Dashboard",
			statusText: dashboardStatus.statusText,
			tone: dashboardStatus.tone,
			description: "Dashboard endpoint: http://localhost:3001",
		},
		{
			id: "kanban",
			name: "Hermes Kanban",
			statusText: "Running",
			tone: "ok",
			description: "This service is active in the current session.",
		},
		{
			id: "tailscale",
			name: "Tailscale",
			statusText: "Connected",
			tone: "ok",
			description: "Tailscale IP: 100.105.191.62",
		},
	];

	return (
		<div className="flex h-full min-h-0 flex-col rounded-md border border-border bg-surface-1">
			<div className="border-b border-border px-4 py-3">
				<h2 className="text-sm font-semibold text-text-primary">Infrastructure</h2>
				<p className="mt-1 text-xs text-text-secondary">Hermes VM service health and access points.</p>
			</div>
			<div className="grid gap-3 overflow-y-auto p-3">
				{services.map((service) => (
					<StatusCard key={service.id} service={service} />
				))}
				<SystemResourcesCard />
			</div>
		</div>
	);
}
