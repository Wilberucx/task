import type { Task, TaskList } from "../domain/entities/index.js";
import type { TaskRepository } from "../domain/ports/TaskRepository.js";
export interface GroupedTasks {
    listId: string;
    listTitle: string;
    tasks: Task[];
}
export declare class TaskService {
    private readonly repository;
    constructor(repository: TaskRepository);
    getAllLists(): Promise<TaskList[]>;
    getAllTasks(): Promise<GroupedTasks[]>;
    completeTask(taskListId: string, taskId: string): Promise<void>;
    createTask(taskListId: string, title: string, notes?: string): Promise<Task>;
    deleteTask(taskListId: string, taskId: string): Promise<void>;
}
