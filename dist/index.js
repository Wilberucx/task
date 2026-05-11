import { GwsTaskRepository } from "./infrastructure/gws/GwsTaskRepository.js";
import { TaskService } from "./application/TaskService.js";
export const createTaskService = () => new TaskService(new GwsTaskRepository());
export { GwsTaskRepository } from "./infrastructure/gws/GwsTaskRepository.js";
