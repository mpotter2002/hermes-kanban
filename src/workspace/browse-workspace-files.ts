import { readFile, stat } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";

import type {
	RuntimeWorkspaceFileContentResponse,
	RuntimeWorkspaceFileTreeResponse,
} from "../core/api-contract.js";
import { listWorkspaceFiles } from "./search-workspace-files.js";

const MAX_TEXT_FILE_BYTES = 512 * 1024;
const BINARY_SAMPLE_BYTES = 8 * 1024;

function resolveWorkspaceRelativePath(workspacePath: string, filePath: string): string {
	const resolvedPath = resolve(workspacePath, filePath);
	const relativePath = relative(workspacePath, resolvedPath);
	if (relativePath.startsWith("..") || isAbsolute(relativePath)) {
		throw new Error("File path is outside the current workspace.");
	}
	return resolvedPath;
}

function isLikelyBinary(buffer: Buffer): boolean {
	const sample = buffer.subarray(0, BINARY_SAMPLE_BYTES);
	for (const byte of sample) {
		if (byte === 0) {
			return true;
		}
	}
	return false;
}

export async function loadWorkspaceFileTree(workspacePath: string): Promise<RuntimeWorkspaceFileTreeResponse> {
	const files = await listWorkspaceFiles(workspacePath);
	return { files };
}

export async function loadWorkspaceFileContent(
	workspacePath: string,
	filePath: string,
): Promise<RuntimeWorkspaceFileContentResponse> {
	const resolvedPath = resolveWorkspaceRelativePath(workspacePath, filePath);

	let fileStats;
	try {
		fileStats = await stat(resolvedPath);
	} catch {
		return {
			path: filePath,
			kind: "missing",
			content: null,
			sizeBytes: null,
		};
	}

	if (!fileStats.isFile()) {
		return {
			path: filePath,
			kind: "missing",
			content: null,
			sizeBytes: null,
		};
	}

	if (fileStats.size > MAX_TEXT_FILE_BYTES) {
		return {
			path: filePath,
			kind: "too_large",
			content: null,
			sizeBytes: fileStats.size,
		};
	}

	const buffer = await readFile(resolvedPath);
	if (isLikelyBinary(buffer)) {
		return {
			path: filePath,
			kind: "binary",
			content: null,
			sizeBytes: buffer.byteLength,
		};
	}

	return {
		path: filePath,
		kind: "text",
		content: buffer.toString("utf8"),
		sizeBytes: buffer.byteLength,
	};
}
