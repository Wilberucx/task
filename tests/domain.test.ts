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
});