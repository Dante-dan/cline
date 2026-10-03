import { parseHookEventPayload } from "@cline/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	readStdinUtf8: vi.fn(),
	appendHookAudit: vi.fn(),
	handleSessionHookEvent: vi.fn(),
	writeHookJson: vi.fn(),
}));

vi.mock("../session/session", () => ({
	handleSessionHookEvent: mocks.handleSessionHookEvent,
}));
vi.mock("../utils/helpers", () => ({
	readStdinUtf8: mocks.readStdinUtf8,
	appendHookAudit: mocks.appendHookAudit,
	writeHookJson: mocks.writeHookJson,
	parseCliHookPayload: async (value: unknown) => parseHookEventPayload(value),
}));

import { runHookCommand } from "./hook";

// Schema-valid stdin payload from issue #14808.
const payload = {
	clineVersion: "3.0.62",
	hookName: "agent_error",
	timestamp: "2000-01-01T00:00:00.000Z",
	taskId: "fixture-task",
	workspaceRoots: [],
	userId: "fixture-user",
	agent_id: "fixture-agent",
	parent_agent_id: null,
	iteration: 0,
	error: { name: "Error", message: "fixture failure" },
};

describe("runHookCommand", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("accepts schema-valid agent_error events and writes a JSON response", async () => {
		mocks.readStdinUtf8.mockResolvedValue(JSON.stringify(payload));
		const io = { writeln: vi.fn(), writeErr: vi.fn() };
		expect(await runHookCommand(io)).toBe(0);
		expect(io.writeErr).not.toHaveBeenCalled();
		expect(mocks.appendHookAudit).toHaveBeenCalledWith(payload);
		expect(mocks.handleSessionHookEvent).toHaveBeenCalledWith(payload);
		expect(mocks.writeHookJson).toHaveBeenCalledWith({});
	});

	it("continues to reject unknown event names without handling them", async () => {
		mocks.readStdinUtf8.mockResolvedValue(
			JSON.stringify({ ...payload, hookName: "unknown_event" }),
		);
		const io = { writeln: vi.fn(), writeErr: vi.fn() };
		expect(await runHookCommand(io)).toBe(1);
		expect(io.writeErr).toHaveBeenCalledWith("invalid hook payload");
		expect(mocks.appendHookAudit).not.toHaveBeenCalled();
		expect(mocks.handleSessionHookEvent).not.toHaveBeenCalled();
		expect(mocks.writeHookJson).not.toHaveBeenCalled();
	});
});
