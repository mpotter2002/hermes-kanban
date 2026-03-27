import Editor from "@monaco-editor/react";
import { AlertTriangle, ChevronRight, Save, Terminal, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import {
	AlertDialog,
	AlertDialogBody,
	AlertDialogFooter,
	AlertDialogHeader,
} from "@/components/ui/dialog";
import { getRuntimeTrpcClient } from "@/runtime/trpc-client";

interface FileEditorOverlayProps {
	isOpen: boolean;
	filePath: string | null;
	workspaceId: string;
	onClose: () => void;
	onSaved?: () => void;
}

interface DraftState {
	content: string;
	timestamp: number;
}

const DRAFT_PREFIX = "kb-file-draft:";
const AUTO_SAVE_DELAY_MS = 2000;

function getDraftKey(filePath: string, workspaceId: string): string {
	return `${DRAFT_PREFIX}${workspaceId}:${filePath}`;
}

function loadDraft(filePath: string, workspaceId: string): DraftState | null {
	try {
		const key = getDraftKey(filePath, workspaceId);
		const stored = localStorage.getItem(key);
		if (stored) {
			return JSON.parse(stored) as DraftState;
		}
	} catch {
		// ignore
	}
	return null;
}

function saveDraft(filePath: string, workspaceId: string, content: string): void {
	try {
		const key = getDraftKey(filePath, workspaceId);
		const draft: DraftState = { content, timestamp: Date.now() };
		localStorage.setItem(key, JSON.stringify(draft));
	} catch {
		// ignore
	}
}

function clearDraft(filePath: string, workspaceId: string): void {
	try {
		const key = getDraftKey(filePath, workspaceId);
		localStorage.removeItem(key);
	} catch {
		// ignore
	}
}

function getLanguageFromPath(filePath: string): string {
	const ext = filePath.split(".").pop()?.toLowerCase();
	switch (ext) {
		case "ts":
		case "tsx":
			return "typescript";
		case "js":
		case "jsx":
			return "javascript";
		case "json":
			return "json";
		case "html":
			return "html";
		case "css":
			return "css";
		case "scss":
		case "sass":
			return "scss";
		case "less":
			return "less";
		case "md":
		case "mdx":
			return "markdown";
		case "py":
			return "python";
		case "sh":
		case "bash":
			return "shell";
		case "yaml":
		case "yml":
			return "yaml";
		case "toml":
			return "toml";
		case "xml":
			return "xml";
		case "sql":
			return "sql";
		case "rs":
			return "rust";
		case "go":
			return "go";
		case "java":
			return "java";
		case "cpp":
		case "cc":
		case "cxx":
			return "cpp";
		case "c":
			return "c";
		case "h":
		case "hpp":
			return "cpp";
		case "rb":
			return "ruby";
		case "php":
			return "php";
		case "swift":
			return "swift";
		case "kt":
			return "kotlin";
		default:
			return "plaintext";
	}
}

function formatFileSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FileEditorOverlay({
	isOpen,
	filePath,
	workspaceId,
	onClose,
	onSaved,
}: FileEditorOverlayProps): React.ReactElement {
	const [content, setContent] = useState<string>("");
	const [originalContent, setOriginalContent] = useState<string>("");
	const [isLoading, setIsLoading] = useState(false);
	const [isSaving, setIsSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
	const [fileSize, setFileSize] = useState<number | null>(null);
	const [lastSaved, setLastSaved] = useState<Date | null>(null);

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const autoSaveTimeoutRef = useRef<number | null>(null);
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const editorRef = useRef<any>(null);

	// Fetch file content when opened
	useEffect(() => {
		if (!isOpen || !filePath) {
			setContent("");
			setOriginalContent("");
			setError(null);
			setFileSize(null);
			setLastSaved(null);
			return;
		}

		const fetchContent = async (): Promise<void> => {
			setIsLoading(true);
			setError(null);

			try {
				// Check for draft first
				const draft = loadDraft(filePath, workspaceId);

				const result = await getRuntimeTrpcClient(workspaceId).workspace.getFileContent.query({
					path: filePath,
				});

				if (result.kind === "text" && result.content !== null) {
					setOriginalContent(result.content);
					setFileSize(result.sizeBytes ?? null);

					// Use draft if it exists and is newer
					if (draft && draft.timestamp > Date.now() - 24 * 60 * 60 * 1000) {
						setContent(draft.content);
					} else {
						setContent(result.content);
						clearDraft(filePath, workspaceId);
					}
				} else if (result.kind === "binary") {
					setError("Binary files cannot be edited");
				} else if (result.kind === "too_large") {
					setError("File is too large to edit");
				} else if (result.kind === "missing") {
					setError("File not found");
				} else {
					setError("Failed to load file");
				}
			} catch (err) {
				setError(err instanceof Error ? err.message : "Failed to load file");
			} finally {
				setIsLoading(false);
			}
		};

		void fetchContent();
	}, [isOpen, filePath, workspaceId]);

	// Auto-save to localStorage
	useEffect(() => {
		if (!filePath || content === originalContent) return;

		if (autoSaveTimeoutRef.current) {
			window.clearTimeout(autoSaveTimeoutRef.current);
		}

		autoSaveTimeoutRef.current = window.setTimeout(() => {
			saveDraft(filePath, workspaceId, content);
		}, AUTO_SAVE_DELAY_MS);

		return () => {
			if (autoSaveTimeoutRef.current) {
				window.clearTimeout(autoSaveTimeoutRef.current);
			}
		};
	}, [content, filePath, workspaceId, originalContent]);

	const hasUnsavedChanges = content !== originalContent;

	const handleClose = useCallback((): void => {
		if (hasUnsavedChanges) {
			setShowUnsavedDialog(true);
		} else {
			onClose();
		}
	}, [hasUnsavedChanges, onClose]);

	const handleDiscardAndClose = useCallback((): void => {
		if (filePath) {
			clearDraft(filePath, workspaceId);
		}
		setShowUnsavedDialog(false);
		onClose();
	}, [filePath, workspaceId, onClose]);

	const handleSave = useCallback(async (): Promise<void> => {
		if (!filePath) return;

		setIsSaving(true);
		setError(null);

		try {
			const result = await getRuntimeTrpcClient(workspaceId).workspace.saveFileContent.mutate({
				path: filePath,
				content,
			});

			if (result.success) {
				setOriginalContent(content);
				clearDraft(filePath, workspaceId);
				setLastSaved(new Date());
				onSaved?.();
			} else {
				setError(result.error ?? "Failed to save file");
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to save file");
		} finally {
			setIsSaving(false);
		}
	}, [filePath, workspaceId, content, onSaved]);

	const handleEditInTerminal = useCallback(async (): Promise<void> => {
		if (!filePath) return;
		
		// Open terminal in new tab with the file path
		// This is a simplified version - in production, we'd use the terminal session manager
		const terminalUrl = `/terminal?file=${encodeURIComponent(filePath)}&workspace=${encodeURIComponent(workspaceId)}`;
		window.open(terminalUrl, '_blank');
	}, [filePath, workspaceId]);

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const handleEditorMount = useCallback((editor: any): void => {
		editorRef.current = editor;
		// Add keyboard shortcut for save (Ctrl+S / Cmd+S)
		const monaco = (window as { monaco?: { KeyMod?: { CtrlCmd: number }; KeyCode?: { KeyS: number } } }).monaco;
		if (!monaco?.KeyMod?.CtrlCmd || !monaco?.KeyCode?.KeyS) return;
		// eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
		editor.addCommand(
			// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
			monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS,
			() => {
				void handleSave();
			}
		);
	}, [handleSave]);

	// Build breadcrumb from file path
	const pathParts = filePath?.split("/") ?? [];

	return (
		<>
			<div
				className={cn(
					"fixed inset-0 z-50 flex flex-col bg-surface-1 transition-opacity duration-200",
					isOpen ? "opacity-100" : "pointer-events-none opacity-0"
				)}
			>
				{/* Header */}
				<div className="flex items-center justify-between border-b border-border px-4 py-3">
					<div className="flex min-w-0 flex-1 flex-col gap-1">
						{/* Breadcrumb */}
						<div className="flex items-center gap-1 text-sm text-text-secondary">
							{pathParts.map((part, index) => (
								<div key={index} className="flex items-center">
									{index > 0 && <ChevronRight className="mx-1 h-3.5 w-3.5 text-text-tertiary" />}
									<span
										className={cn(
											"truncate",
											index === pathParts.length - 1 ? "font-medium text-text-primary" : "hover:text-text-primary"
										)}
									>
										{part}
									</span>
								</div>
								))}
							</div>
						{/* Meta info */}
						<div className="flex items-center gap-3 text-xs text-text-tertiary">
							{fileSize !== null && <span>{formatFileSize(fileSize)}</span>}
							{lastSaved && <span>Saved {lastSaved.toLocaleTimeString()}</span>}
							{hasUnsavedChanges && (
								<span className="flex items-center gap-1 text-yellow-400">
									<span className="h-1.5 w-1.5 rounded-full bg-yellow-400" />
									Unsaved changes
								</span>
								)}
						</div>
					</div>

					<div className="flex items-center gap-2">
						<Button
							variant="default"
							size="sm"
							onClick={() => void handleEditInTerminal()}
							disabled={!filePath}
							className="gap-1.5"
						>
							<Terminal className="h-4 w-4" />
							Edit in Terminal
						</Button>
						<Button
							variant="primary"
							size="sm"
							onClick={() => void handleSave()}
							disabled={!hasUnsavedChanges || isSaving}
							className="gap-1.5"
						>
							{isSaving ? (
								<span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
							) : (
								<Save className="h-4 w-4" />
							)}
							Save to VM
						</Button>
						<Button variant="ghost" size="sm" onClick={handleClose} className="text-text-secondary hover:text-text-primary">
							<X className="h-5 w-5" />
						</Button>
					</div>
				</div>

				{/* Error banner */}
				{error && (
					<div className="flex items-center gap-2 border-b border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-400">
						<AlertTriangle className="h-4 w-4" />
						{error}
					</div>
				)}

				{/* Editor */}
				<div className="flex-1 min-h-0">
					{isLoading ? (
						<div className="flex h-full items-center justify-center text-text-secondary">
							<div className="flex flex-col items-center gap-3">
								<div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-accent" />
								<p>Loading file...</p>
							</div>
						</div>
					) : (
						<Editor
							height="100%"
							defaultLanguage={filePath ? getLanguageFromPath(filePath) : "plaintext"}
							value={content}
							onChange={(value) => setContent(value ?? "")}
							onMount={handleEditorMount}
							options={{
								minimap: { enabled: false },
								fontSize: 14,
								lineNumbers: "on",
								roundedSelection: false,
								scrollBeyondLastLine: false,
								readOnly: false,
								theme: "vs-dark",
								automaticLayout: true,
								padding: { top: 16 },
								fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
							}}
						/>
					)}
				</div>
			</div>

			{/* Unsaved changes dialog */}
			<AlertDialog open={showUnsavedDialog} onOpenChange={setShowUnsavedDialog}>
				<AlertDialogHeader>Unsaved Changes</AlertDialogHeader>
				<AlertDialogBody>
					<p className="text-text-secondary">
						You have unsaved changes to <code className="rounded bg-surface-2 px-1 py-0.5 text-text-secondary">{filePath}</code>. What would you like to do?
					</p>
				</AlertDialogBody>
				<AlertDialogFooter>
					<Button variant="default" onClick={() => setShowUnsavedDialog(false)}>
						Keep Editing
					</Button>
					<Button variant="ghost" onClick={handleDiscardAndClose}>
						Discard Changes
					</Button>
					<Button
						variant="primary"
						onClick={() => void handleSave().then(() => onClose())}
						disabled={isSaving}
					>
						{isSaving ? "Saving..." : "Save & Close"}
					</Button>
				</AlertDialogFooter>
			</AlertDialog>
		</>
	);
}
