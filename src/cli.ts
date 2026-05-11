#!/usr/bin/env node
import { GwsTaskRepository } from "./infrastructure/gws/GwsTaskRepository.js";
import { TaskService } from "./application/TaskService.js";

const repo = new GwsTaskRepository();
const service = new TaskService(repo);

async function findListByName(name: string): Promise<string> {
  const lists = await service.getAllLists();
  const normalized = name.toLowerCase();
  const match = lists.find((l) => l.title.toLowerCase() === normalized);
  if (!match) {
    throw new Error(`Lista no encontrada: "${name}"`);
  }
  return match.id;
}

async function findTaskByTitle(listName: string, taskTitle: string): Promise<string> {
  const listId = await findListByName(listName);
  const grouped = await service.getAllTasks();
  const group = grouped.find((g) => g.listId === listId);
  if (!group) {
    throw new Error(`No hay tareas en la lista "${listName}"`);
  }
  const normalized = taskTitle.toLowerCase();
  const match = group.tasks.find((t) => t.title.toLowerCase() === normalized);
  if (!match) {
    throw new Error(`Tarea no encontrada: "${taskTitle}" en lista "${listName}"`);
  }
  return match.id;
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  try {
    switch (command) {
      case "list": {
        const grouped = await service.getAllTasks();
        for (const group of grouped) {
          console.log(`\n# ${group.listTitle}`);
          for (const task of group.tasks) {
            console.log(`  - ${task.title}`);
          }
        }
        break;
      }
      case "lists": {
        const lists = await service.getAllLists();
        for (const list of lists) {
          console.log(`${list.title}`);
        }
        break;
      }
      case "complete": {
        const listName = args[1];
        const taskTitle = args[2];
        if (!listName || !taskTitle) {
          console.error('Usage: task complete "<list>" "<task>"');
          process.exit(1);
        }
        const taskId = await findTaskByTitle(listName, taskTitle);
        const listId = await findListByName(listName);
        await service.completeTask(listId, taskId);
        console.log("Tarea completada");
        break;
      }
      case "create": {
        const listName = args[1];
        const title = args[2];
        const notes = args[3];
        if (!listName || !title) {
          console.error('Usage: task create "<list>" "<title>" [notes]');
          process.exit(1);
        }
        const listId = await findListByName(listName);
        const task = await service.createTask(listId, title, notes);
        console.log(`Creada: ${task.id}`);
        break;
      }
      case "delete": {
        const listName = args[1];
        const taskTitle = args[2];
        if (!listName || !taskTitle) {
          console.error('Usage: task delete "<list>" "<task>"');
          process.exit(1);
        }
        const taskId = await findTaskByTitle(listName, taskTitle);
        const listId = await findListByName(listName);
        await service.deleteTask(listId, taskId);
        console.log("Tarea eliminada");
        break;
      }
      default:
        console.log(`Usage: task <command>
Commands:
  list                       List all pending tasks grouped by list
  lists                      List all task lists
  complete "<list>" "<task>"   Mark a task as complete
  create "<list>" "<title>" [notes]  Create a new task
  delete "<list>" "<task>"    Delete a task

Examples:
  task lists
  task list
  task complete "Trabajo" "Reunión con cliente"
  task create "Personal" "Comprar leche" "notas opcionales"
  task delete "Personal" "Comprar leche"`);
    }
  } catch (err) {
    console.error("Error:", err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

main();