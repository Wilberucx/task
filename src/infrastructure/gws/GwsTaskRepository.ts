import type { Task, TaskList } from "../../domain/entities/index.js";
import type { TaskRepository } from "../../domain/ports/TaskRepository.js";
import { GwsRunner } from "./GwsRunner.js";

interface RawTaskList {
  id: string;
  title: string;
}

interface RawTask {
  id: string;
  title: string;
  status: "needsAction" | "completed";
  notes?: string;
  due?: string;
  completed?: string;
}

interface GwsListsResponse {
  items?: RawTaskList[];
}

interface GwsTasksResponse {
  items?: RawTask[];
}

export class GwsTaskRepository implements TaskRepository {
  constructor(private readonly runner = new GwsRunner()) {}

  async getLists(): Promise<TaskList[]> {
    const res = await this.runner.run<GwsListsResponse>([
      "tasks",
      "tasklists",
      "list",
    ]);

    if (!res) return [];
    return (res.items ?? []).map(({ id, title }) => ({ id, title }));
  }

  async getTasks(taskListId: string): Promise<Task[]> {
    const res = await this.runner.run<GwsTasksResponse>([
      "tasks",
      "tasks",
      "list",
      "--params",
      JSON.stringify({ tasklist: taskListId }),
    ]);

    if (!res) return [];
    return (res.items ?? []).map((task) => ({ ...task, taskListId }));
  }

  async complete(taskListId: string, taskId: string): Promise<void> {
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

  async create(
    taskListId: string,
    title: string,
    notes?: string,
  ): Promise<Task> {
    const body: Record<string, string> = { title };
    if (notes) body.notes = notes;

    const raw = await this.runner.run<RawTask>([
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

  async delete(taskListId: string, taskId: string): Promise<void> {
    await this.runner.run([
      "tasks",
      "tasks",
      "delete",
      "--params",
      JSON.stringify({ tasklist: taskListId, task: taskId }),
    ]);
  }
}
