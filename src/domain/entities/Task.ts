export type TaskStatus = "needsAction" | "completed";

export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  notes?: string;
  due?: string;
  completed?: string;
  taskListId: string;
  parent?: string;
}
