import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

export interface KimiUsageSnapshot {
	balance_cny?: number;
	balance_usd?: number;
	available: boolean;
	error?: string;
}

interface MoonshotBalanceResponse {
	data?: {
		available_balance?: number;
	};
}

const CNY_TO_USD_RATE = 0.14;

async function fetchMoonshotBalance(apiKey: string): Promise<{ cny: number; usd: number } | null> {
	const response = await fetch("https://api.moonshot.ai/v1/users/me/balance", {
		headers: {
			"Authorization": `Bearer ${apiKey}`,
		},
	});

	if (!response.ok) {
		if (response.status === 401) {
			throw new Error("Invalid API key");
		}
		throw new Error(`HTTP ${response.status}`);
	}

	const data = await response.json() as MoonshotBalanceResponse;
	const balanceCny = data?.data?.available_balance;

	if (balanceCny === undefined || balanceCny === null) {
		return null;
	}

	return {
		cny: balanceCny,
		usd: balanceCny * CNY_TO_USD_RATE,
	};
}

async function getMoonshotApiKey(): Promise<string | null> {
	// Try environment variable first
	const envKey = process.env.MOONSHOT_API_KEY;
	if (envKey) {
		return envKey;
	}

	// Try to read from common config locations
	const configPaths = [
		join(homedir(), ".moonshot", "api-key"),
		join(homedir(), ".config", "moonshot", "api-key"),
	];

	for (const configPath of configPaths) {
		try {
			const key = await readFile(configPath, "utf8");
			return key.trim();
		} catch {
			// Continue to next path
		}
	}

	return null;
}

export async function readKimiUsageSnapshot(): Promise<KimiUsageSnapshot> {
	try {
		const apiKey = await getMoonshotApiKey();

		if (!apiKey) {
			return {
				available: false,
				error: "No API key configured",
			};
		}

		const balance = await fetchMoonshotBalance(apiKey);

		if (!balance) {
			return {
				available: false,
				error: "Unable to fetch balance",
			};
		}

		return {
			balance_cny: balance.cny,
			balance_usd: balance.usd,
			available: true,
		};
	} catch (error) {
		return {
			available: false,
			error: error instanceof Error ? error.message : "Unknown error",
		};
	}
}
