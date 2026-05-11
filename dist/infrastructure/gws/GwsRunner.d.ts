export declare class GwsRunnerError extends Error {
    readonly args: string[];
    readonly stderr: string;
    constructor(message: string, args: string[], stderr: string);
}
export declare class GwsRunner {
    run<T>(args: string[]): Promise<T | void>;
}
