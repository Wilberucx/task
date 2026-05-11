import type { Task, TaskStatus } from "./Task.js";
export type { Task, TaskStatus } from "./Task.js";
export type { TaskList } from "./TaskList.js";

export interface TaskNode extends Task {
  children: TaskNode[];
}
