import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

export interface ClaudeUsageSnapshot {
	model?: string;
	five_hour_used_percentage?: number;
	seven_day_used_percentage?: number;
	five_hour_resets_at?: number;
	seven_day_resets_at?: number;
	available: boolean;
}

interface ClaudeStatusLineCachePayload {
	captured_at?: unknown;
	model?: unknown;
	five_hour_used_percentage?: unknown;
	seven_day_used_percentage?: unknown;
	five_hour_resets_at?: unknown;
	seven_day_resets_at?: unknown;
}

const DEFAULT_STATUSLINE_CACHE_PATH = join(homedir(), ".claude", "statusline", "latest.json");

function toOptionalNumber(value: unknown): number | undefined {
	if (typeof value !== "number" || !Number.isFinite(value)) {
		return undefined;
	}
	return value;
}

function toOptionalString(value: unknown): string | undefined {
	return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

export async function readClaudeUsageSnapshot(): Promise<ClaudeUsageSnapshot> {
	try {
		const raw = await readFile(DEFAULT_STATUSLINE_CACHE_PATH, "utf8");
		const payload = JSON.parse(raw) as ClaudeStatusLineCachePayload;
		const model = toOptionalString(payload.model);
		const fiveHourUsedPercentage = toOptionalNumber(payload.five_hour_used_percentage);
		const sevenDayUsedPercentage = toOptionalNumber(payload.seven_day_used_percentage);
		const fiveHourResetsAt = toOptionalNumber(payload.five_hour_resets_at);
		const sevenDayResetsAt = toOptionalNumber(payload.seven_day_resets_at);
		return {
			model,
			five_hour_used_percentage: fiveHourUsedPercentage,
			seven_day_used_percentage: sevenDayUsedPercentage,
			five_hour_resets_at: fiveHourResetsAt,
			seven_day_resets_at: sevenDayResetsAt,
			available:
				model !== undefined ||
				fiveHourUsedPercentage !== undefined ||
				sevenDayUsedPercentage !== undefined ||
				fiveHourResetsAt !== undefined ||
				sevenDayResetsAt !== undefined,
		};
	} catch {
		return {
			available: false,
		};
	}
}
