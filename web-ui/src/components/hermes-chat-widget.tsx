import { Loader2, Send } from "lucide-react";
import type { FormEvent, KeyboardEvent, ReactElement } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";

const HERMES_CHAT_STORAGE_KEY = "kb-hermes-chat";

type ChatMessageRole = "user" | "assistant" | "system";

interface ChatMessage {
	id: string;
	role: ChatMessageRole;
	text: string;
}

interface StoredHermesChatState {
	draft: string;
	messages: ChatMessage[];
}

interface HermesTaskDraft {
	title: string;
	description: string | null;
}

interface HermesTaskCreationResult {
	taskId: string;
	prompt: string;
}

function loadStoredHermesChatState(): StoredHermesChatState {
	try {
		const stored = localStorage.getItem(HERMES_CHAT_STORAGE_KEY);
		if (!stored) {
			return { draft: "", messages: [] };
		}
		const parsed = JSON.parse(stored) as { draft?: unknown; messages?: unknown };
		const draft = typeof parsed.draft === "string" ? parsed.draft : "";
		const messages = Array.isArray(parsed.messages)
			? parsed.messages.flatMap((message): ChatMessage[] => {
					if (!message || typeof message !== "object") {
						return [];
					}
					const candidate = message as { id?: unknown; role?: unknown; text?: unknown };
					if (
						typeof candidate.id !== "string" ||
						(candidate.role !== "user" && candidate.role !== "assistant" && candidate.role !== "system") ||
						typeof candidate.text !== "string"
					) {
						return [];
					}
					return [
						{
							id: candidate.id,
							role: candidate.role,
							text: candidate.text,
						},
					];
				})
			: [];
		return { draft, messages };
	} catch {
		return { draft: "", messages: [] };
	}
}

function saveStoredHermesChatState(state: StoredHermesChatState): void {
	try {
		localStorage.setItem(HERMES_CHAT_STORAGE_KEY, JSON.stringify(state));
	} catch {
		// ignore storage failures
	}
}

function createChatMessage(role: ChatMessageRole, text: string): ChatMessage {
	return {
		id: `${role}-${Date.now()}-${crypto.randomUUID()}`,
		role,
		text,
	};
}

function isHermesTaskCommand(text: string): boolean {
	return /^\/(?:task|todo)\b/i.test(text.trim());
}

function parseHermesTaskCommand(text: string): HermesTaskDraft | null {
	const match = /^\/(?:task|todo)\s+(.+)$/i.exec(text.trim());
	if (!match) {
		return null;
	}

	const [rawTitle, ...descriptionParts] = match[1]!.split("|");
	const title = rawTitle?.trim() ?? "";
	const description = descriptionParts.join("|").trim();
	if (!title) {
		return null;
	}

	return {
		title,
		description: description.length > 0 ? description : null,
	};
}

function buildAssistantText(payload: unknown): string {
	if (typeof payload === "string" && payload.trim().length > 0) {
		return payload;
	}
	if (!payload || typeof payload !== "object") {
		return "Hermes responded without text.";
	}

	const candidateValues = [
		(payload as Record<string, unknown>).response,
		(payload as Record<string, unknown>).message,
		(payload as Record<string, unknown>).text,
		(payload as Record<string, unknown>).reply,
	];

	for (const value of candidateValues) {
		if (typeof value === "string" && value.trim().length > 0) {
			return value;
		}
	}

	return JSON.stringify(payload);
}

async function sendHermesMessage(text: string): Promise<string> {
	const response = await fetch("http://localhost:18789/message", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			platform: "local",
			text,
			chat_id: "kanban-ui",
		}),
	});

	if (!response.ok) {
		throw new Error(`Request failed with status ${response.status}`);
	}

	const responseText = await response.text();
	if (responseText.trim().length === 0) {
		return "Hermes received your message.";
	}

	try {
		return buildAssistantText(JSON.parse(responseText));
	} catch {
		return responseText;
	}
}

function ChatBubble({ message }: { message: ChatMessage }): ReactElement {
	const isUser = message.role === "user";
	const isSystem = message.role === "system";

	return (
		<div className={cn("flex w-full", isUser ? "justify-end" : "justify-start")}>
			<div
				className={cn(
					"max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm",
					isUser
						? "rounded-br-md bg-accent text-white"
						: isSystem
							? "rounded-bl-md border border-status-orange/30 bg-status-orange/10 text-status-orange"
							: "rounded-bl-md border border-border bg-surface-2 text-text-primary",
				)}
			>
				{message.text}
			</div>
		</div>
	);
}

export function HermesChatPanel({
	onCreateTask,
	isMobile = false,
}: {
	onCreateTask?: (task: HermesTaskDraft) => HermesTaskCreationResult | null;
	isMobile?: boolean;
}): ReactElement {
	const [storedState, setStoredState] = useState<StoredHermesChatState>(() => loadStoredHermesChatState());
	const [isSending, setIsSending] = useState(false);
	const messageListRef = useRef<HTMLDivElement | null>(null);
	const draft = storedState.draft;
	const messages = storedState.messages;

	useEffect(() => {
		saveStoredHermesChatState(storedState);
	}, [storedState]);

	useEffect(() => {
		const listElement = messageListRef.current;
		if (!listElement) {
			return;
		}
		listElement.scrollTop = listElement.scrollHeight;
	}, [messages, isSending]);

	const canSend = useMemo(() => draft.trim().length > 0 && !isSending, [draft, isSending]);

	const appendMessage = (message: ChatMessage): void => {
		setStoredState((current) => ({
			...current,
			messages: [...current.messages, message],
		}));
	};

	const handleSubmit = async (event?: FormEvent<HTMLFormElement>): Promise<void> => {
		event?.preventDefault();
		const text = draft.trim();
		if (text.length === 0 || isSending) {
			return;
		}

		appendMessage(createChatMessage("user", text));
		setStoredState((current) => ({
			...current,
			draft: "",
		}));

		const taskCommand = parseHermesTaskCommand(text);
		if (taskCommand) {
			const createdTask = onCreateTask?.(taskCommand);
			if (!createdTask) {
				appendMessage(
					createChatMessage(
						"system",
						'Could not create a backlog card. Use "/task Title | optional description" after opening a board.',
					),
				);
				return;
			}
			appendMessage(
				createChatMessage(
					"system",
					`Created backlog task "${taskCommand.title}" (${createdTask.taskId}).`,
				),
			);
			return;
		}
		if (isHermesTaskCommand(text)) {
			appendMessage(
				createChatMessage(
					"system",
					'Invalid task command. Example: "/task Fix mobile overlay | keep bottom nav visible".',
				),
			);
			return;
		}

		setIsSending(true);

		try {
			const replyText = await sendHermesMessage(text);
			appendMessage(createChatMessage("assistant", replyText));
		} catch {
			appendMessage(createChatMessage("system", "Hermes is offline. Message via Telegram."));
		} finally {
			setIsSending(false);
		}
	};

	const handleComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
		if (event.key === "Enter" && !event.shiftKey) {
			event.preventDefault();
			void handleSubmit();
		}
	};

	return (
		<div className="flex h-full min-h-0 flex-col overflow-hidden rounded-md border border-border bg-surface-1">
			<div className={cn("border-b border-border", isMobile ? "px-3 py-2" : "px-4 py-3")}>
				<h2 className="text-sm font-semibold text-text-primary">Hermes</h2>
				<p className="text-xs text-text-secondary">Local Hermes gateway messaging.</p>
			</div>
			<div ref={messageListRef} className="flex-1 space-y-3 overflow-y-auto bg-surface-0/40 px-3 py-3">
				{messages.length === 0 ? (
					<div className="rounded-xl border border-dashed border-border bg-surface-2/60 px-3 py-4 text-sm text-text-secondary">
						Send a message to Hermes, or create a backlog card with `/task Title | optional description`.
					</div>
				) : (
					messages.map((message) => <ChatBubble key={message.id} message={message} />)
				)}
				{isSending ? (
					<div className="flex justify-start">
						<div className="inline-flex items-center gap-2 rounded-2xl rounded-bl-md border border-border bg-surface-2 px-3 py-2 text-sm text-text-secondary">
							<Loader2 size={14} className="animate-spin" />
							Thinking...
						</div>
					</div>
				) : null}
			</div>
			<form
				onSubmit={(event) => void handleSubmit(event)}
				className={cn(
					"border-t border-border bg-surface-1",
					isMobile ? "px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-2" : "p-3",
				)}
			>
				<div className="relative">
					<textarea
						value={draft}
						onChange={(event) =>
							setStoredState((current) => ({
								...current,
								draft: event.target.value,
							}))
						}
						onKeyDown={handleComposerKeyDown}
						placeholder="Message Hermes or use /task"
						rows={2}
						className={cn(
							"w-full resize-none rounded-xl border border-border bg-surface-2 px-3 py-2 pr-14 text-sm text-text-primary placeholder:text-text-tertiary focus:border-border-focus focus:outline-none",
							isMobile ? "min-h-16 max-h-36" : "min-h-20",
						)}
					/>
					<Button
						type="submit"
						variant="primary"
						size="sm"
						icon={isSending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
						disabled={!canSend}
						className="absolute right-2 bottom-2 h-9 px-3"
					>
						{isMobile ? null : "Send"}
					</Button>
				</div>
			</form>
		</div>
	);
}

export default HermesChatPanel;
