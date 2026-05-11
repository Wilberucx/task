export class TaskService {
    repository;
    constructor(repository) {
        this.repository = repository;
    }
    async getAllLists() {
        return this.repository.getLists();
    }
    async getAllTasks() {
        const lists = await this.repository.getLists();
        const results = [];
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
    async completeTask(taskListId, taskId) {
        return this.repository.complete(taskListId, taskId);
    }
    async createTask(taskListId, title, notes) {
        return this.repository.create(taskListId, title, notes);
    }
    async deleteTask(taskListId, taskId) {
        return this.repository.delete(taskListId, taskId);
    }
}
