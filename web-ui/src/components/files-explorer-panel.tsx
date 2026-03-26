import { File, FileCode2, Folder, FolderOpen, Search, X as CloseIcon } from "lucide-react";
import type { ReactElement } from "react";
import { useEffect, useMemo, useState } from "react";

import { cn } from "@/components/ui/cn";
import { Spinner } from "@/components/ui/spinner";
import { getRuntimeTrpcClient } from "@/runtime/trpc-client";
import type { RuntimeWorkspaceFileContentResponse } from "@/runtime/types";
import { buildFileTree, type FileTreeNode } from "@/utils/file-tree";

function FileTreeItem({
	node,
	depth,
	selectedPath,
	onSelectPath,
}: {
	node: FileTreeNode;
	depth: number;
	selectedPath: string | null;
	onSelectPath: (path: string) => void;
}): ReactElement {
	const isDirectory = node.type === "directory";
	const isSelected = !isDirectory && selectedPath === node.path;

	return (
		<div>
			<button
				type="button"
				onClick={() => {
					if (!isDirectory) {
						onSelectPath(node.path);
					}
				}}
				className={cn(
					"flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors",
					isDirectory ? "cursor-default text-text-secondary" : "text-text-secondary hover:bg-surface-3 hover:text-text-primary",
					isSelected ? "bg-accent text-white hover:bg-accent" : null,
				)}
				style={{ paddingLeft: depth * 12 + 8 }}
			>
				{isDirectory ? (
					node.children.length > 0 ? <FolderOpen size={14} className="shrink-0" /> : <Folder size={14} className="shrink-0" />
				) : (
					<File size={14} className="shrink-0" />
				)}
				<span className="truncate">{node.name}</span>
			</button>
			{node.children.length > 0 ? (
				<div>
					{node.children.map((child) => (
						<FileTreeItem
							key={child.path}
							node={child}
							depth={depth + 1}
							selectedPath={selectedPath}
							onSelectPath={onSelectPath}
						/>
					))}
				</div>
			) : null}
		</div>
	);
}

function FileViewer({
	selectedPath,
	content,
	isLoading,
}: {
	selectedPath: string | null;
	content: RuntimeWorkspaceFileContentResponse | null;
	isLoading: boolean;
}): ReactElement {
	if (!selectedPath) {
		return (
			<div className="flex flex-1 items-center justify-center px-4 text-center text-sm text-text-secondary">
				Select a file to view its contents.
			</div>
		);
	}

	if (isLoading) {
		return (
			<div className="flex flex-1 items-center justify-center">
				<Spinner size={18} />
			</div>
		);
	}

	if (!content || content.kind === "missing") {
		return (
			<div className="flex flex-1 items-center justify-center px-4 text-center text-sm text-text-secondary">
				File unavailable.
			</div>
		);
	}

	if (content.kind === "binary") {
		return (
			<div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 text-center text-sm text-text-secondary">
				<FileCode2 size={24} />
				<p>Binary or non-text file preview is not available yet.</p>
			</div>
		);
	}

	if (content.kind === "too_large") {
		return (
			<div className="flex flex-1 items-center justify-center px-4 text-center text-sm text-text-secondary">
				File is too large to preview in the dashboard.
			</div>
		);
	}

	return (
		<div className="flex min-h-0 flex-1 flex-col overflow-hidden">
			<div className="border-b border-border px-3 py-2">
				<p className="truncate font-mono text-[11px] text-text-secondary">{content.path}</p>
			</div>
			<pre className="flex-1 overflow-auto bg-surface-0 px-3 py-3 font-mono text-[11px] leading-5 text-text-primary whitespace-pre-wrap break-words">
				{content.content ?? ""}
			</pre>
		</div>
	);
}

export function FilesExplorerPanel({
	workspaceId,
}: {
	workspaceId: string | null;
}): ReactElement {
	const [files, setFiles] = useState<string[] | null>(null);
	const [isLoadingFiles, setIsLoadingFiles] = useState(false);
	const [selectedPath, setSelectedPath] = useState<string | null>(null);
	const [fileContent, setFileContent] = useState<RuntimeWorkspaceFileContentResponse | null>(null);
	const [isLoadingContent, setIsLoadingContent] = useState(false);
	const [filter, setFilter] = useState("");

	useEffect(() => {
		setFiles(null);
		setSelectedPath(null);
		setFileContent(null);
		if (!workspaceId) {
			return;
		}

		let cancelled = false;
		setIsLoadingFiles(true);
		void getRuntimeTrpcClient(workspaceId).workspace.getFileTree.query().then((payload) => {
			if (cancelled) {
				return;
			}
			setFiles(payload.files);
			setSelectedPath(payload.files[0] ?? null);
			setIsLoadingFiles(false);
		}).catch(() => {
			if (cancelled) {
				return;
			}
			setFiles([]);
			setIsLoadingFiles(false);
		});

		return () => {
			cancelled = true;
		};
	}, [workspaceId]);

	useEffect(() => {
		setFileContent(null);
		if (!workspaceId || !selectedPath) {
			return;
		}

		let cancelled = false;
		setIsLoadingContent(true);
		void getRuntimeTrpcClient(workspaceId).workspace.getFileContent.query({ path: selectedPath }).then((payload) => {
			if (cancelled) {
				return;
			}
			setFileContent(payload);
			setIsLoadingContent(false);
		}).catch(() => {
			if (cancelled) {
				return;
			}
			setFileContent(null);
			setIsLoadingContent(false);
		});

		return () => {
			cancelled = true;
		};
	}, [selectedPath, workspaceId]);

	const filteredFiles = useMemo(() => {
		if (!files) {
			return [];
		}
		const query = filter.trim().toLowerCase();
		if (!query) {
			return files;
		}
		return files.filter((path) => path.toLowerCase().includes(query));
	}, [files, filter]);

	const tree = useMemo(() => buildFileTree(filteredFiles), [filteredFiles]);

	return (
		<div className="flex h-full min-h-0 flex-col overflow-hidden rounded-md border border-border bg-surface-1">
			<div className="border-b border-border px-4 py-3">
				<h2 className="text-sm font-semibold text-text-primary">Files</h2>
				<p className="mt-0.5 text-xs text-text-secondary">Browse the current project on the VM.</p>
			</div>
			<div className="border-b border-border px-3 py-2">
				<label className="flex items-center gap-2 rounded-md border border-border bg-surface-2 px-2 py-2 text-text-secondary">
					<Search size={14} className="shrink-0" />
					<input
						value={filter}
						onChange={(event) => setFilter(event.target.value)}
						placeholder="Filter files"
						className="min-w-0 flex-1 bg-transparent text-xs text-text-primary outline-none placeholder:text-text-tertiary"
					/>
					{filter ? (
						<button
							type="button"
							onClick={() => setFilter("")}
							className="rounded-sm p-0.5 text-text-tertiary hover:bg-surface-3 hover:text-text-primary"
							aria-label="Clear file filter"
						>
							<CloseIcon size={12} />
						</button>
					) : null}
				</label>
			</div>
			<div className="flex min-h-0 flex-1 flex-col overflow-hidden">
				<div className="min-h-0 flex-[0.95] overflow-auto border-b border-border bg-surface-0 px-2 py-2">
					{isLoadingFiles ? (
						<div className="flex h-full items-center justify-center">
							<Spinner size={18} />
						</div>
					) : tree.length === 0 ? (
						<div className="flex h-full items-center justify-center px-4 text-center text-sm text-text-secondary">
							No files to display.
						</div>
					) : (
						tree.map((node) => (
							<FileTreeItem
								key={node.path}
								node={node}
								depth={0}
								selectedPath={selectedPath}
								onSelectPath={setSelectedPath}
							/>
						))
					)}
				</div>
				<div className="min-h-0 flex-[1.05] overflow-hidden">
					<FileViewer selectedPath={selectedPath} content={fileContent} isLoading={isLoadingContent} />
				</div>
			</div>
		</div>
	);
}

export default FilesExplorerPanel;
