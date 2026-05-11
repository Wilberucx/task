import type { Task, TaskList } from "../entities/index.js";

export interface TaskRepository {
  getLists(): Promise<TaskList[]>;
  getTasks(taskListId: string): Promise<Task[]>;
  complete(taskListId: string, taskId: string): Promise<void>;
  create(taskListId: string, title: string, notes?: string): Promise<Task>;
  update(taskListId: string, taskId: string, title: string, notes?: string): Promise<Task>;
  delete(taskListId: string, taskId: string): Promise<void>;
}
