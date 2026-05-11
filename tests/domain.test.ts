import { describe, it, expect, vi, beforeEach } from "vitest";
import { TaskService } from "../src/application/TaskService.js";

describe("TaskService", () => {
  let mockRepo: ReturnType<typeof vi.fn>;
  let service: TaskService;

  beforeEach(() => {
    mockRepo = vi.fn();
    service = new TaskService(mockRepo as any);
  });

  describe("getAllLists", () => {
    it("should return lists from repository", async () => {
      const mockLists = [
        { id: "list1", title: "Trabajo" },
        { id: "list2", title: "Personal" },
      ];
      mockRepo.getLists = vi.fn().mockResolvedValue(mockLists);

      const result = await service.getAllLists();

      expect(result).toEqual(mockLists);
      expect(mockRepo.getLists).toHaveBeenCalled();
    });

    it("should return empty array when no lists", async () => {
      mockRepo.getLists = vi.fn().mockResolvedValue([]);

      const result = await service.getAllLists();

      expect(result).toEqual([]);
    });
  });

  describe("getAllTasks", () => {
    it("should return only pending tasks grouped by list", async () => {
      mockRepo.getLists = vi.fn().mockResolvedValue([
        { id: "list1", title: "Trabajo" },
      ]);
      mockRepo.getTasks = vi.fn().mockResolvedValue([
        { id: "t1", title: "Task 1", status: "needsAction", taskListId: "list1" },
        { id: "t2", title: "Task 2", status: "completed", taskListId: "list1" },
        { id: "t3", title: "Task 3", status: "needsAction", taskListId: "list1" },
      ]);

      const result = await service.getAllTasks();

      expect(result).toHaveLength(1);
      expect(result[0].listTitle).toBe("Trabajo");
      expect(result[0].tasks).toHaveLength(2);
      expect(result[0].tasks.map((t: any) => t.id)).toEqual(["t1", "t3"]);
    });
  });

  describe("completeTask", () => {
    it("should call repository complete", async () => {
      mockRepo.complete = vi.fn().mockResolvedValue(undefined);

      await service.completeTask("list1", "task1");

      expect(mockRepo.complete).toHaveBeenCalledWith("list1", "task1");
    });
  });

  describe("createTask", () => {
    it("should call repository create with correct params", async () => {
      const mockTask = { id: "new1", title: "New Task", status: "needsAction", taskListId: "list1" };
      mockRepo.create = vi.fn().mockResolvedValue(mockTask);

      const result = await service.createTask("list1", "New Task");

      expect(mockRepo.create).toHaveBeenCalledWith("list1", "New Task", undefined);
      expect(result).toEqual(mockTask);
    });

    it("should pass notes when provided", async () => {
      mockRepo.create = vi.fn().mockResolvedValue({ id: "new1", title: "Task", status: "needsAction", taskListId: "list1" });

      await service.createTask("list1", "Task", "some notes");

      expect(mockRepo.create).toHaveBeenCalledWith("list1", "Task", "some notes");
    });
  });

  describe("deleteTask", () => {
    it("should call repository delete", async () => {
      mockRepo.delete = vi.fn().mockResolvedValue(undefined);

      await service.deleteTask("list1", "task1");

      expect(mockRepo.delete).toHaveBeenCalledWith("list1", "task1");
    });
  });

  describe("cache behavior", () => {
    const mockGroups = [
      { listId: "l1", listTitle: "Work", tasks: [{ id: "t1", title: "Task", status: "needsAction" as const, taskListId: "l1", children: [] }] },
    ];

    beforeEach(() => {
      mockRepo.getLists = vi.fn().mockResolvedValue([{ id: "l1", title: "Work" }]);
      mockRepo.getTasks = vi.fn().mockResolvedValue([{ id: "t1", title: "Task", status: "needsAction", taskListId: "l1" }]);
    });

    it("returns cached data within TTL without calling the repo", async () => {
      const result1 = await service.getAllTasks();
      expect(result1).toEqual(mockGroups);

      mockRepo.getLists.mockClear();
      mockRepo.getTasks.mockClear();

      const result2 = await service.getAllTasks();
      expect(result2).toEqual(mockGroups);
      expect(mockRepo.getLists).not.toHaveBeenCalled();
      expect(mockRepo.getTasks).not.toHaveBeenCalled();
    });

    it("re-fetches when cache is stale (past TTL)", async () => {
      vi.useFakeTimers();
      await service.getAllTasks();

      vi.advanceTimersByTime(30_001);

      mockRepo.getLists.mockClear();
      mockRepo.getTasks.mockClear();

      await service.getAllTasks();
      expect(mockRepo.getLists).toHaveBeenCalled();
      expect(mockRepo.getTasks).toHaveBeenCalled();

      vi.useRealTimers();
    });

    it("re-fetches when forceRefresh is true regardless of TTL", async () => {
      await service.getAllTasks();

      mockRepo.getLists.mockClear();
      mockRepo.getTasks.mockClear();

      await service.getAllTasks(true);
      expect(mockRepo.getLists).toHaveBeenCalled();
      expect(mockRepo.getTasks).toHaveBeenCalled();
    });

    it("invalidates cache after completeTask()", async () => {
      mockRepo.complete = vi.fn().mockResolvedValue(undefined);

      await service.getAllTasks();
      mockRepo.getLists.mockClear();
      mockRepo.getTasks.mockClear();

      await service.completeTask("l1", "t1");
      await service.getAllTasks();

      expect(mockRepo.getLists).toHaveBeenCalled();
      expect(mockRepo.getTasks).toHaveBeenCalled();
    });

    it("invalidates cache after createTask()", async () => {
      mockRepo.create = vi.fn().mockResolvedValue({ id: "t2", title: "New", status: "needsAction", taskListId: "l1" });

      await service.getAllTasks();
      mockRepo.getLists.mockClear();
      mockRepo.getTasks.mockClear();

      await service.createTask("l1", "New");
      await service.getAllTasks();

      expect(mockRepo.getLists).toHaveBeenCalled();
      expect(mockRepo.getTasks).toHaveBeenCalled();
    });

    it("invalidates cache after updateTask()", async () => {
      mockRepo.update = vi.fn().mockResolvedValue({ id: "t1", title: "Updated", status: "needsAction", taskListId: "l1" });

      await service.getAllTasks();
      mockRepo.getLists.mockClear();
      mockRepo.getTasks.mockClear();

      await service.updateTask("l1", "t1", "Updated");
      await service.getAllTasks();

      expect(mockRepo.getLists).toHaveBeenCalled();
      expect(mockRepo.getTasks).toHaveBeenCalled();
    });

    it("invalidates cache after deleteTask()", async () => {
      mockRepo.delete = vi.fn().mockResolvedValue(undefined);

      await service.getAllTasks();
      mockRepo.getLists.mockClear();
      mockRepo.getTasks.mockClear();

      await service.deleteTask("l1", "t1");
      await service.getAllTasks();

      expect(mockRepo.getLists).toHaveBeenCalled();
      expect(mockRepo.getTasks).toHaveBeenCalled();
    });
  });

  describe("updateTask", () => {
    it("delegates title and notes to the repository", async () => {
      const mockTask = { id: "t1", title: "Updated", status: "needsAction", notes: "notes", taskListId: "l1" };
      mockRepo.update = vi.fn().mockResolvedValue(mockTask);

      const result = await service.updateTask("l1", "t1", "Updated", "notes");

      expect(mockRepo.update).toHaveBeenCalledWith("l1", "t1", "Updated", "notes");
      expect(result).toEqual(mockTask);
    });

    it("delegates only title when notes is undefined", async () => {
      const mockTask = { id: "t1", title: "Updated", status: "needsAction", taskListId: "l1" };
      mockRepo.update = vi.fn().mockResolvedValue(mockTask);

      await service.updateTask("l1", "t1", "Updated");

      expect(mockRepo.update).toHaveBeenCalledWith("l1", "t1", "Updated", undefined);
    });

    it("passes empty string notes to repository", async () => {
      const mockTask = { id: "t1", title: "Updated", status: "needsAction", taskListId: "l1" };
      mockRepo.update = vi.fn().mockResolvedValue(mockTask);

      await service.updateTask("l1", "t1", "Updated", "");

      expect(mockRepo.update).toHaveBeenCalledWith("l1", "t1", "Updated", "");
    });
  });
});