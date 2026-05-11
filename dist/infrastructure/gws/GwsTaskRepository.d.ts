import type { Task, TaskList } from "../../domain/entities/index.js";
import type { TaskRepository } from "../../domain/ports/TaskRepository.js";
import { GwsRunner } from "./GwsRunner.js";
export declare class GwsTaskRepository implements TaskRepository {
    private readonly runner;
    constructor(runner?: GwsRunner);
    getLists(): Promise<TaskList[]>;
    getTasks(taskListId: string): Promise<Task[]>;
    complete(taskListId: string, taskId: string): Promise<void>;
    create(taskListId: string, title: string, notes?: string): Promise<Task>;
    delete(taskListId: string, taskId: string): Promise<void>;
}
