import { describe, it, expect } from "vitest";
import type { Task, TaskList } from "../src/domain/entities/index.js";

describe("Task Entity", () => {
  it("should have required properties", () => {
    const task: Task = {
      id: "t1",
      title: "Test Task",
      status: "needsAction",
      taskListId: "list1",
    };

    expect(task.id).toBe("t1");
    expect(task.title).toBe("Test Task");
    expect(task.status).toBe("needsAction");
    expect(task.taskListId).toBe("list1");
  });

  it("should allow optional properties", () => {
    const task: Task = {
      id: "t1",
      title: "Test Task",
      status: "completed",
      notes: "Some notes",
      due: "2024-12-31T23:59:59Z",
      completed: "2024-12-30T10:00:00Z",
      taskListId: "list1",
    };

    expect(task.notes).toBe("Some notes");
    expect(task.due).toBe("2024-12-31T23:59:59Z");
    expect(task.completed).toBe("2024-12-30T10:00:00Z");
  });

  it("should only allow valid status values", () => {
    const pendingTask: Task = {
      id: "t1",
      title: "Task",
      status: "needsAction",
      taskListId: "list1",
    };

    const completedTask: Task = {
      id: "t1",
      title: "Task",
      status: "completed",
      taskListId: "list1",
    };

    expect(pendingTask.status).toBe("needsAction");
    expect(completedTask.status).toBe("completed");
  });
});

describe("TaskList Entity", () => {
  it("should have required properties", () => {
    const list: TaskList = {
      id: "list1",
      title: "Work",
    };

    expect(list.id).toBe("list1");
    expect(list.title).toBe("Work");
  });
});