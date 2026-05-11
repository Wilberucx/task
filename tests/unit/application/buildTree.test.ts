import { describe, it, expect } from "vitest";
import type { Task } from "../../src/domain/entities/index.js";

function buildTree(tasks: Task[]): import("../../src/domain/entities/index.js").TaskNode[] {
  const nodeMap = new Map<string, import("../../src/domain/entities/index.js").TaskNode>();
  const roots: import("../../src/domain/entities/index.js").TaskNode[] = [];

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

describe("buildTree", () => {
  it("empty list returns empty array", () => {
    const result = buildTree([]);
    expect(result).toEqual([]);
  });

  it("tasks without parent are all roots", () => {
    const tasks: Task[] = [
      { id: "t1", title: "Task 1", status: "needsAction", taskListId: "list1" },
      { id: "t2", title: "Task 2", status: "needsAction", taskListId: "list1" },
    ];

    const result = buildTree(tasks);

    expect(result).toHaveLength(2);
    expect(result[0].children).toEqual([]);
    expect(result[1].children).toEqual([]);
  });

  it("task with valid parent appears as child", () => {
    const tasks: Task[] = [
      { id: "t1", title: "Parent", status: "needsAction", taskListId: "list1" },
      { id: "t2", title: "Child", status: "needsAction", taskListId: "list1", parent: "t1" },
    ];

    const result = buildTree(tasks);

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Parent");
    expect(result[0].children).toHaveLength(1);
    expect(result[0].children[0].title).toBe("Child");
  });

  it("task with non-existent parent is treated as root", () => {
    const tasks: Task[] = [
      { id: "t1", title: "Orphan", status: "needsAction", taskListId: "list1", parent: "nonexistent" },
    ];

    const result = buildTree(tasks);

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Orphan");
  });

  it("two levels of nesting (grandchild)", () => {
    const tasks: Task[] = [
      { id: "t1", title: "Parent", status: "needsAction", taskListId: "list1" },
      { id: "t2", title: "Child", status: "needsAction", taskListId: "list1", parent: "t1" },
      { id: "t3", title: "Grandchild", status: "needsAction", taskListId: "list1", parent: "t2" },
    ];

    const result = buildTree(tasks);

    expect(result).toHaveLength(1);
    expect(result[0].children).toHaveLength(1);
    expect(result[0].children[0].title).toBe("Child");
    expect(result[0].children[0].children).toHaveLength(1);
    expect(result[0].children[0].children[0].title).toBe("Grandchild");
  });

  it("multiple children under same parent", () => {
    const tasks: Task[] = [
      { id: "t1", title: "Parent", status: "needsAction", taskListId: "list1" },
      { id: "t2", title: "Child 1", status: "needsAction", taskListId: "list1", parent: "t1" },
      { id: "t3", title: "Child 2", status: "needsAction", taskListId: "list1", parent: "t1" },
      { id: "t4", title: "Child 3", status: "needsAction", taskListId: "list1", parent: "t1" },
    ];

    const result = buildTree(tasks);

    expect(result).toHaveLength(1);
    expect(result[0].children).toHaveLength(3);
    expect(result[0].children.map(c => c.title).sort()).toEqual(["Child 1", "Child 2", "Child 3"]);
  });
});