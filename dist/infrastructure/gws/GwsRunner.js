import { execFile } from "node:child_process";
import { promisify } from "node:util";
const exec = promisify(execFile);
export class GwsRunnerError extends Error {
    args;
    stderr;
    constructor(message, args, stderr) {
        super(message);
        this.args = args;
        this.stderr = stderr;
        this.name = "GwsRunnerError";
    }
}
export class GwsRunner {
    async run(args) {
        try {
            const { stdout } = await exec("gws", args);
            const trimmed = stdout.trim();
            if (!trimmed) {
                return undefined;
            }
            return JSON.parse(trimmed);
        }
        catch (err) {
            const e = err;
            throw new GwsRunnerError(`gws command failed: ${e.message ?? "unknown error"}`, args, e.stderr ?? "");
        }
    }
}
