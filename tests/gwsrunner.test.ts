import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("node:child_process", () => ({
  execFile: vi.fn(),
}));

vi.mock("node:util", () => ({
  promisify: (fn: any) => fn,
}));

import { GwsRunner, GwsRunnerError } from "../src/infrastructure/gws/GwsRunner.js";
import { execFile } from "node:child_process";

describe("GwsRunner", () => {
  let runner: GwsRunner;

  beforeEach(() => {
    runner = new GwsRunner();
    vi.clearAllMocks();
  });

  it("should parse valid JSON response", async () => {
    (execFile as ReturnType<typeof vi.fn>).mockResolvedValue({ stdout: '{"items": []}' });

    const result = await runner.run<{ items: string[] }>(["tasks", "lists"]);

    expect(result).toEqual({ items: [] });
    expect(execFile).toHaveBeenCalledWith("gws", ["tasks", "lists"]);
  });

  it("should handle empty response", async () => {
    (execFile as ReturnType<typeof vi.fn>).mockResolvedValue({ stdout: "" });

    const result = await runner.run(["delete"]);

    expect(result).toBeUndefined();
  });

  it("should handle whitespace-only response", async () => {
    (execFile as ReturnType<typeof vi.fn>).mockResolvedValue({ stdout: "   \n  " });

    const result = await runner.run(["delete"]);

    expect(result).toBeUndefined();
  });

  it("should throw GwsRunnerError on failure", async () => {
    (execFile as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Command failed"));

    await expect(runner.run(["invalid"])).rejects.toThrow(GwsRunnerError);
  });

  it("should include args in error message on failure", async () => {
    (execFile as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("ENOENT"));

    try {
      await runner.run(["tasks", "invalid"]);
    } catch (e) {
      expect(e).toBeInstanceOf(GwsRunnerError);
      expect((e as any).args).toEqual(["tasks", "invalid"]);
    }
  });
});