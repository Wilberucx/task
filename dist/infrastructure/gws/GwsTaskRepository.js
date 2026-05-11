import { GwsRunner } from "./GwsRunner.js";
export class GwsTaskRepository {
    runner;
    constructor(runner = new GwsRunner()) {
        this.runner = runner;
    }
    async getLists() {
        const res = await this.runner.run([
            "tasks",
            "tasklists",
            "list",
        ]);
        if (!res)
            return [];
        return (res.items ?? []).map(({ id, title }) => ({ id, title }));
    }
    async getTasks(taskListId) {
        const res = await this.runner.run([
            "tasks",
            "tasks",
            "list",
            "--params",
            JSON.stringify({ tasklist: taskListId }),
        ]);
        if (!res)
            return [];
        return (res.items ?? []).map((task) => ({ ...task, taskListId }));
    }
    async complete(taskListId, taskId) {
        await this.runner.run([
            "tasks",
            "tasks",
            "patch",
            "--params",
            JSON.stringify({ tasklist: taskListId, task: taskId }),
            "--json",
            JSON.stringify({ status: "completed" }),
        ]);
    }
    async create(taskListId, title, notes) {
        const body = { title };
        if (notes)
            body.notes = notes;
        const raw = await this.runner.run([
            "tasks",
            "tasks",
            "insert",
            "--params",
            JSON.stringify({ tasklist: taskListId }),
            "--json",
            JSON.stringify(body),
        ]);
        if (!raw || !raw.id) {
            throw new Error("Failed to create task");
        }
        return { id: raw.id, title: raw.title, status: raw.status, notes: raw.notes, taskListId };
    }
    async delete(taskListId, taskId) {
        await this.runner.run([
            "tasks",
            "tasks",
            "delete",
            "--params",
            JSON.stringify({ tasklist: taskListId, task: taskId }),
        ]);
    }
}
