import { TaskService } from "./application/TaskService.js";
export declare const createTaskService: () => TaskService;
export type { GroupedTasks } from "./application/TaskService.js";
export type { Task, TaskList, TaskStatus } from "./domain/entities/index.js";
export { GwsTaskRepository } from "./infrastructure/gws/GwsTaskRepository.js";
