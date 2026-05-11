import { GwsTaskRepository } from "./infrastructure/gws/GwsTaskRepository.js";
import { TaskService } from "./application/TaskService.js";

export const createTaskService = () => new TaskService(new GwsTaskRepository());

export type { GroupedTasks } from "./application/TaskService.js";
export type { Task, TaskList, TaskStatus } from "./domain/entities/index.js";
export { GwsTaskRepository } from "./infrastructure/gws/GwsTaskRepository.js";
