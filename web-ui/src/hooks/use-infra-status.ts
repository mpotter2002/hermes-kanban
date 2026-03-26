import { useEffect, useState } from "react";

export interface InfraStatusResponse {
	gateway: boolean;
	dashboard: boolean;
	kanban: boolean;
	tailscale: boolean;
	claude_running: boolean;
	codex_running: boolean;
	claude_sessions: number;
	codex_sessions: number;
	cpu: number;
	mem_used_gb: number;
	mem_total_gb: number;
	disk_used_gb: number;
	disk_total_gb: number;
	claude_usage: {
		model?: string;
		five_hour_used_percentage?: number;
		seven_day_used_percentage?: number;
		five_hour_resets_at?: number;
		seven_day_resets_at?: number;
		available: boolean;
	};
}

const INFRA_STATUS_POLL_INTERVAL_MS = 10_000;

async function fetchInfraStatus(signal: AbortSignal): Promise<InfraStatusResponse | null> {
	try {
		const base = import.meta.env.BASE_URL.replace(/\/$/, "");
		const response = await fetch(`${base}/api/infra-status`, { signal });
		if (!response.ok) {
			return null;
		}
		return (await response.json()) as InfraStatusResponse;
	} catch {
		return null;
	}
}

export default function useInfraStatus(): {
	data: InfraStatusResponse | null;
	isLoading: boolean;
} {
	const [data, setData] = useState<InfraStatusResponse | null>(null);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		let cancelled = false;

		const refresh = async (): Promise<void> => {
			const controller = new AbortController();
			const timeoutId = window.setTimeout(() => controller.abort(), 5_000);
			const result = await fetchInfraStatus(controller.signal);
			window.clearTimeout(timeoutId);
			if (!cancelled) {
				setData(result);
				setIsLoading(false);
			}
		};

		void refresh();
		const intervalId = window.setInterval(() => {
			void refresh();
		}, INFRA_STATUS_POLL_INTERVAL_MS);

		return () => {
			cancelled = true;
			window.clearInterval(intervalId);
		};
	}, []);

	return { data, isLoading };
}
