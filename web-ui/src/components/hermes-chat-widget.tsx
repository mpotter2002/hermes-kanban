import { Loader2, Send, X } from "lucide-react";
import type { FormEvent, KeyboardEvent, ReactElement } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";

type ChatMessageRole = "user" | "assistant" | "system";

interface ChatMessage {
	id: string;
	role: ChatMessageRole;
	text: string;
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
					"max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap",
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

export default function HermesChatWidget(): ReactElement {
	const [isOpen, setIsOpen] = useState(false);
	const [draft, setDraft] = useState("");
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [isSending, setIsSending] = useState(false);
	const messageListRef = useRef<HTMLDivElement | null>(null);

	useEffect(() => {
		const listElement = messageListRef.current;
		if (!listElement) {
			return;
		}
		listElement.scrollTop = listElement.scrollHeight;
	}, [messages, isSending]);

	const canSend = useMemo(() => draft.trim().length > 0 && !isSending, [draft, isSending]);

	const appendMessage = (message: ChatMessage): void => {
		setMessages((current) => [...current, message]);
	};

	const handleSubmit = async (event?: FormEvent<HTMLFormElement>): Promise<void> => {
		event?.preventDefault();
		const text = draft.trim();
		if (text.length === 0 || isSending) {
			return;
		}

		const userMessage: ChatMessage = {
			id: `user-${Date.now()}`,
			role: "user",
			text,
		};
		appendMessage(userMessage);
		setDraft("");
		setIsSending(true);

		try {
			const replyText = await sendHermesMessage(text);
			appendMessage({
				id: `assistant-${Date.now()}`,
				role: "assistant",
				text: replyText,
			});
		} catch {
			appendMessage({
				id: `system-${Date.now()}`,
				role: "system",
				text: "Hermes is offline. Message via Telegram.",
			});
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
		<div className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col items-end gap-3">
			{isOpen ? (
				<div className="pointer-events-auto flex h-[28rem] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-border bg-surface-1 shadow-2xl">
					<div className="flex items-center justify-between border-b border-border px-4 py-3">
						<div>
							<h2 className="text-sm font-semibold text-text-primary">Chat with Hermes</h2>
							<p className="text-xs text-text-secondary">Local Hermes gateway messaging.</p>
						</div>
						<Button
							variant="ghost"
							size="sm"
							icon={<X size={16} />}
							onClick={() => setIsOpen(false)}
							aria-label="Close Hermes chat"
						/>
					</div>
					<div ref={messageListRef} className="flex-1 space-y-3 overflow-y-auto bg-surface-0/40 px-3 py-3">
						{messages.length === 0 ? (
							<div className="rounded-xl border border-dashed border-border bg-surface-2/60 px-3 py-4 text-sm text-text-secondary">
								Send a message to Hermes.
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
					<form onSubmit={(event) => void handleSubmit(event)} className="border-t border-border bg-surface-1 p-3">
						<div className="flex items-end gap-2">
							<textarea
								value={draft}
								onChange={(event) => setDraft(event.target.value)}
								onKeyDown={handleComposerKeyDown}
								placeholder="Message Hermes"
								rows={2}
								className="min-h-20 flex-1 resize-none rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-border-focus focus:outline-none"
							/>
							<Button
								type="submit"
								variant="primary"
								size="md"
								icon={isSending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
								disabled={!canSend}
								className="shrink-0"
							>
								Send
							</Button>
						</div>
					</form>
				</div>
			) : null}
			<button
				type="button"
				onClick={() => setIsOpen((current) => !current)}
				className="pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full border border-border bg-surface-2 text-2xl shadow-xl transition-colors hover:bg-surface-3 focus:outline-none focus:ring-2 focus:ring-border-focus"
				aria-label={isOpen ? "Close Hermes chat" : "Open Hermes chat"}
			>
				<span aria-hidden>🤖</span>
			</button>
		</div>
	);
}
