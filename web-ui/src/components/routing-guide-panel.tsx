import type { ReactElement } from "react";
import { Brain, Zap, Shield, Wrench, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

interface RunnerCard {
	id: string;
	name: string;
	icon: ReactElement;
	color: string;
	role: string;
	phase: string;
	useFor: string[];
	default?: boolean;
}

const runners: RunnerCard[] = [
	{
		id: "kimi",
		name: "Kimi",
		icon: <Brain className="h-4 w-4" />,
		color: "bg-purple-500",
		role: "Strategist",
		phase: "Phase 1",
		useFor: ["Planning", "Architecture", "Specs", "Project setup", "Discussion"],
	},
	{
		id: "codex",
		name: "Codex",
		icon: <Zap className="h-4 w-4" />,
		color: "bg-green-500",
		role: "Fast Builder",
		phase: "Phase 2",
		useFor: ["UI work", "Features", "Quick iteration", "Dashboards", "Frontend"],
		default: true,
	},
	{
		id: "claude",
		name: "Claude Code",
		icon: <Shield className="h-4 w-4" />,
		color: "bg-orange-500",
		role: "Careful Builder",
		phase: "Phase 2",
		useFor: ["Backend", "Infrastructure", "Refactors", "High-risk code"],
	},
	{
		id: "minimax",
		name: "MiniMax",
		icon: <Wrench className="h-4 w-4" />,
		color: "bg-blue-500",
		role: "Utility (Coming Soon)",
		phase: "Phase 2",
		useFor: ["Quick patches", "Cleanup", "Fallback", "Small fixes"],
	},
];

function RunnerBadge({ runner }: { runner: RunnerCard }): ReactElement {
	return (
		<div className="flex items-center gap-2 rounded-lg bg-surface-2 px-2 py-1.5">
			<span className={`flex h-6 w-6 items-center justify-center rounded-full text-white ${runner.color}`}>
				{runner.icon}
			</span>
			<div className="flex flex-col">
				<span className="text-xs font-medium text-text-primary flex items-center gap-1">
					{runner.name}
					{runner.default && (
						<span className="text-[10px] px-1 py-0 rounded bg-surface-3 text-text-secondary">default</span>
					)}
				</span>
				<span className="text-[10px] text-text-secondary">{runner.role}</span>
			</div>
		</div>
	);
}

export default function RoutingGuidePanel(): ReactElement {
	const [isExpanded, setIsExpanded] = useState(false);

	return (
		<div className="flex flex-col gap-3 rounded-xl border border-border bg-surface-1 p-4">
			<button
				type="button"
				onClick={() => setIsExpanded(!isExpanded)}
				className="flex items-center justify-between w-full"
			>
				<div className="flex items-center gap-2">
					<span className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/20 text-purple-400">
						<Brain className="h-4 w-4" />
					</span>
					<div className="flex flex-col items-start">
						<h3 className="text-sm font-semibold text-text-primary">AI Routing Guide</h3>
						<p className="text-xs text-text-secondary">Which runner to use when</p>
					</div>
				</div>
				{isExpanded ? (
					<ChevronUp className="h-4 w-4 text-text-secondary" />
				) : (
					<ChevronDown className="h-4 w-4 text-text-secondary" />
				)}
			</button>

			{isExpanded && (
				<div className="flex flex-col gap-4 pt-2 border-t border-border">
					{/* Quick Decision Tree */}
					<div className="rounded-lg bg-surface-2 p-3">
						<h4 className="text-xs font-semibold text-text-primary mb-2">Quick Decision Tree</h4>
						<div className="flex flex-col gap-1.5 text-xs">
							<div className="flex items-center gap-2">
								<span className="text-purple-400 font-medium">Planning?</span>
								<span className="text-text-secondary">→</span>
								<span className="text-text-primary">Kimi</span>
							</div>
							<div className="flex items-center gap-2">
								<span className="text-green-400 font-medium">UI/Product?</span>
								<span className="text-text-secondary">→</span>
								<span className="text-text-primary">Codex</span>
							</div>
							<div className="flex items-center gap-2">
								<span className="text-orange-400 font-medium">Backend/Infra?</span>
								<span className="text-text-secondary">→</span>
								<span className="text-text-primary">Claude Code</span>
							</div>
							<div className="flex items-center gap-2">
								<span className="text-blue-400 font-medium">Small/Fallback?</span>
								<span className="text-text-secondary">→</span>
								<span className="text-text-primary">MiniMax</span>
							</div>
						</div>
					</div>

					{/* Phase 1 */}
					<div>
						<div className="flex items-center gap-2 mb-2">
							<span className="text-xs font-semibold text-purple-400">Phase 1</span>
							<span className="text-xs text-text-secondary">Understand + Plan</span>
						</div>
						<div className="grid grid-cols-1 gap-2">
							<RunnerBadge runner={runners.find(r => r.id === "kimi")!} />
						</div>
						<p className="text-[10px] text-text-secondary mt-1.5 pl-1">
							Project setup, specs, architecture, getting caught up on repos
						</p>
					</div>

					{/* Phase 2 */}
					<div>
						<div className="flex items-center gap-2 mb-2">
							<span className="text-xs font-semibold text-green-400">Phase 2</span>
							<span className="text-xs text-text-secondary">Build</span>
						</div>
						<div className="grid grid-cols-1 gap-2">
							{runners.slice(1).map((runner) => (
								<RunnerBadge key={runner.id} runner={runner} />
							))}
						</div>
					</div>

					{/* Handoff Pattern */}
					<div className="rounded-lg bg-surface-2 p-3">
						<h4 className="text-xs font-semibold text-text-primary mb-2">Handoff Pattern</h4>
						<ol className="text-xs text-text-secondary list-decimal list-inside space-y-1">
							<li>
								<span className="text-purple-400">Kimi</span> understands repo → writes plan
							</li>
							<li>
								<span className="text-green-400">Builders</span> execute against spec
							</li>
							<li>
								<span className="text-purple-400">Kimi</span> reviews → suggests next steps
							</li>
						</ol>
					</div>

					{/* Footer */}
					<div className="text-[10px] text-text-tertiary text-center pt-1">
						See Notion → OpenClaw/Hermes → AI Routing Policy for full details
					</div>
				</div>
			)}
		</div>
	);
}
