import type { Task, TaskList } from "../domain/entities/index.js";
import type { TaskRepository } from "../domain/ports/TaskRepository.js";

export interface GroupedTasks {
  listId: string;
  listTitle: string;
  tasks: Task[];
}

export class TaskService {
  constructor(private readonly repository: TaskRepository) {}

  async getAllLists(): Promise<TaskList[]> {
    return this.repository.getLists();
  }

  async getAllTasks(): Promise<GroupedTasks[]> {
    const lists = await this.repository.getLists();
    const results: GroupedTasks[] = [];

    for (const list of lists) {
      const tasks = await this.repository.getTasks(list.id);
      results.push({
        listId: list.id,
        listTitle: list.title,
        tasks: tasks.filter((t) => t.status === "needsAction"),
      });
    }

    return results;
  }

  async completeTask(taskListId: string, taskId: string): Promise<void> {
    return this.repository.complete(taskListId, taskId);
  }

  async createTask(
    taskListId: string,
    title: string,
    notes?: string,
  ): Promise<Task> {
    return this.repository.create(taskListId, title, notes);
  }

  async deleteTask(taskListId: string, taskId: string): Promise<void> {
    return this.repository.delete(taskListId, taskId);
  }
}