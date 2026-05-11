import type { Task, TaskList, TaskNode } from "../domain/entities/index.js";
import type { TaskRepository } from "../domain/ports/TaskRepository.js";

export interface GroupedTasks {
  listId: string;
  listTitle: string;
  tasks: TaskNode[];
}

function buildTree(tasks: Task[]): TaskNode[] {
  const nodeMap = new Map<string, TaskNode>();
  const roots: TaskNode[] = [];

  for (const task of tasks) {
    nodeMap.set(task.id, { ...task, children: [] });
  }

  for (const [, node] of nodeMap) {
    if (node.parent && nodeMap.has(node.parent)) {
      nodeMap.get(node.parent)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

const CACHE_TTL_MS = 30_000;

interface CacheEntry {
  data: GroupedTasks[];
  fetchedAt: number;
}

export class TaskService {
  private cache: CacheEntry | null = null;

  constructor(private readonly repository: TaskRepository) {}

  async getAllLists(): Promise<TaskList[]> {
    return this.repository.getLists();
  }

  async getAllTasks(forceRefresh = false): Promise<GroupedTasks[]> {
    const now = Date.now();
    const isStale = !this.cache || now - this.cache.fetchedAt > CACHE_TTL_MS;

    if (!forceRefresh && !isStale && this.cache) {
      return this.cache.data;
    }

    const lists = await this.repository.getLists();
    const results: GroupedTasks[] = [];

    for (const list of lists) {
      const tasks = await this.repository.getTasks(list.id);
      const pendingTasks = tasks.filter((t) => t.status === "needsAction");
      results.push({
        listId: list.id,
        listTitle: list.title,
        tasks: buildTree(pendingTasks),
      });
    }

    this.cache = { data: results, fetchedAt: now };
    return results;
  }

  private invalidate(): void {
    this.cache = null;
  }

  async completeTask(taskListId: string, taskId: string): Promise<void> {
    await this.repository.complete(taskListId, taskId);
    this.invalidate();
  }

  async createTask(
    taskListId: string,
    title: string,
    notes?: string,
  ): Promise<Task> {
    const task = await this.repository.create(taskListId, title, notes);
    this.invalidate();
    return task;
  }

  async updateTask(
    taskListId: string,
    taskId: string,
    title: string,
    notes?: string,
  ): Promise<Task> {
    const task = await this.repository.update(taskListId, taskId, title, notes);
    this.invalidate();
    return task;
  }

  async deleteTask(taskListId: string, taskId: string): Promise<void> {
    await this.repository.delete(taskListId, taskId);
    this.invalidate();
  }
}