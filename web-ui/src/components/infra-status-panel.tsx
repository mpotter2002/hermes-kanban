import type { ReactElement } from "react";
import { useEffect, useState } from "react";

type ReachabilityStatus = "checking" | "online" | "offline";

interface ServiceStatusCard {
	id: string;
	name: string;
	status: ReachabilityStatus;
	statusText: string;
}

const HEALTH_POLL_INTERVAL_MS = 15_000;

async function checkReachability(url: string): Promise<boolean> {
	const controller = new AbortController();
	const timeoutId = window.setTimeout(() => controller.abort(), 4_000);

	try {
		const response = await fetch(url, {
			method: "GET",
			mode: "no-cors",
			signal: controller.signal,
		});
		return response.type === "opaque" || response.ok;
	} catch {
		return false;
	} finally {
		window.clearTimeout(timeoutId);
	}
}

function StatusDot({ status }: { status: ReachabilityStatus | "fixed-online" }): ReactElement {
	const className =
		status === "online" || status === "fixed-online"
			? "bg-status-green shadow-[0_0_10px_rgba(63,185,80,0.45)]"
			: status === "checking"
				? "bg-status-blue/70"
				: "bg-text-tertiary";

	return <span className={`h-2.5 w-2.5 rounded-full ${className}`} aria-hidden />;
}

function StatusCard({ service }: { service: ServiceStatusCard }): ReactElement {
	return (
		<div className="rounded-lg border border-border bg-surface-2 p-4">
			<div className="flex items-start justify-between gap-3">
				<div>
					<p className="text-sm font-medium text-text-primary">{service.name}</p>
					<p className="mt-1 text-xs text-text-secondary">{service.statusText}</p>
				</div>
				<StatusDot status={service.status} />
			</div>
		</div>
	);
}

export default function InfraStatusPanel(): ReactElement {
	const [gatewayOnline, setGatewayOnline] = useState<ReachabilityStatus>("checking");
	const [dashboardOnline, setDashboardOnline] = useState<ReachabilityStatus>("checking");

	useEffect(() => {
		let cancelled = false;

		const refreshStatuses = async (): Promise<void> => {
			const [gatewayReachable, dashboardReachable] = await Promise.all([
				checkReachability("http://localhost:18789/health"),
				checkReachability("http://localhost:3001"),
			]);

			if (cancelled) {
				return;
			}

			setGatewayOnline(gatewayReachable ? "online" : "offline");
			setDashboardOnline(dashboardReachable ? "online" : "offline");
		};

		void refreshStatuses();
		const intervalId = window.setInterval(() => {
			void refreshStatuses();
		}, HEALTH_POLL_INTERVAL_MS);

		return () => {
			cancelled = true;
			window.clearInterval(intervalId);
		};
	}, []);

	const services: ServiceStatusCard[] = [
		{
			id: "gateway",
			name: "Hermes Gateway",
			status: gatewayOnline,
			statusText:
				gatewayOnline === "online"
					? "Healthy"
					: gatewayOnline === "checking"
						? "Checking connection..."
						: "Unreachable",
		},
		{
			id: "dashboard",
			name: "Hermes Dashboard",
			status: dashboardOnline,
			statusText:
				dashboardOnline === "online"
					? "Available"
					: dashboardOnline === "checking"
						? "Checking connection..."
						: "Unreachable",
		},
		{
			id: "kanban",
			name: "Hermes Kanban",
			status: "online",
			statusText: "Running",
		},
		{
			id: "tailscale",
			name: "Tailscale",
			status: "online",
			statusText: "Connected - 100.105.191.62",
		},
	];

	return (
		<div className="flex h-full min-h-0 flex-col rounded-md border border-border bg-surface-1">
			<div className="border-b border-border px-4 py-3">
				<h2 className="text-sm font-semibold text-text-primary">Infrastructure</h2>
				<p className="mt-1 text-xs text-text-secondary">Live status for local Hermes services.</p>
			</div>
			<div className="grid gap-3 overflow-y-auto p-3">
				{services.map((service) => (
					<StatusCard key={service.id} service={service} />
				))}
			</div>
		</div>
	);
}
