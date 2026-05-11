import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);

export class GwsRunnerError extends Error {
  constructor(
    message: string,
    public readonly args: string[],
    public readonly stderr: string,
  ) {
    super(message);
    this.name = "GwsRunnerError";
  }
}

export class GwsRunner {
  async run<T>(args: string[]): Promise<T | void> {
    try {
      const { stdout } = await exec("gws", args);
      const trimmed = stdout.trim();
      if (!trimmed) {
        return undefined;
      }
      return JSON.parse(trimmed) as T;
    } catch (err: unknown) {
      const e = err as { stderr?: string; message?: string };
      throw new GwsRunnerError(
        `gws command failed: ${e.message ?? "unknown error"}`,
        args,
        e.stderr ?? "",
      );
    }
  }
}
