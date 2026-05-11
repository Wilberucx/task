#!/usr/bin/env node
import React, { useState, useEffect } from "react";
import { render, Box, Text, useInput } from "ink";
import { GwsTaskRepository } from "./infrastructure/gws/GwsTaskRepository.js";
import { TaskService } from "./application/TaskService.js";

const repo = new GwsTaskRepository();
const service = new TaskService(repo);

interface Task {
  id: string;
  title: string;
  status: "needsAction" | "completed";
  taskListId: string;
}

interface GroupedTasks {
  listId: string;
  listTitle: string;
  tasks: Task[];
}

const App = () => {
  const [groups, setGroups] = useState<GroupedTasks[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"normal" | "command">("normal");
  const [command, setCommand] = useState("");
  const [message, setMessage] = useState("");

  const flatTasks: { listId: string; listTitle: string; task: Task; index: number }[] = [];
  groups.forEach((g) => {
    g.tasks.forEach((t) => {
      flatTasks.push({ listId: g.listId, listTitle: g.listTitle, task: t, index: flatTasks.length });
    });
  });

  useEffect(() => {
    loadTasks();
  }, []);

  const loadTasks = async () => {
    setLoading(true);
    try {
      const g = await service.getAllTasks();
      setGroups(g);
      setSelectedIndex(0);
    } catch (e) {
      setMessage(`Error: ${e instanceof Error ? e.message : e}`);
    }
    setLoading(false);
  };

  const getPosition = () => {
    if (flatTasks.length === 0) return { list: "", task: "" };
    const current = flatTasks[selectedIndex];
    return { list: current.listId, task: current.task.id };
  };

  useInput((input, key) => {
    if (mode === "command") {
      if (key.return) {
        executeCommand(command);
        setCommand("");
        setMode("normal");
      } else if (key.escape) {
        setCommand("");
        setMode("normal");
      } else if (key.backspace) {
        setCommand((c) => c.slice(0, -1));
      } else {
        setCommand((c) => c + input);
      }
      return;
    }

    switch (input) {
      case "j":
        setSelectedIndex((i) => Math.min(i + 1, flatTasks.length - 1));
        break;
      case "k":
        setSelectedIndex((i) => Math.max(i - 1, 0));
        break;
      case "g":
        setSelectedIndex(0);
        break;
      case "G":
        setSelectedIndex(flatTasks.length - 1);
        break;
    }

    if (key.return) {
      const pos = getPosition();
      if (pos.list && pos.task) {
        service.completeTask(pos.list, pos.task).then(() => {
          setMessage("Tarea completada");
          loadTasks();
        });
      }
    }

    switch (input) {
      case "d":
        const posD = getPosition();
        if (posD.list && posD.task) {
          service.deleteTask(posD.list, posD.task).then(() => {
            setMessage("Tarea eliminada");
            loadTasks();
          });
        }
        break;
      case "c":
        setMode("command");
        setCommand(":create ");
        break;
      case "r":
        loadTasks();
        setMessage("Actualizado");
        break;
      case "q":
        process.exit(0);
        break;
    }

    if (input === ":") {
      setMode("command");
      setCommand(":");
    }
  });

  const executeCommand = async (cmd: string) => {
    if (cmd.startsWith(":create ")) {
      const rest = cmd.slice(8).trim();
      const match = rest.match(/"([^"]+)"\s+"([^"]+)"(?:\s+"([^"]+)")?/);
      if (match) {
        const [, listName, title, notes] = match;
        const lists = await service.getAllLists();
        const list = lists.find((l) => l.title.toLowerCase() === listName.toLowerCase());
        if (list) {
          await service.createTask(list.id, title, notes);
          setMessage("Tarea creada");
          loadTasks();
        } else {
          setMessage(`Lista no encontrada: ${listName}`);
        }
      } else {
        setMessage('Uso: :create "Lista" "Título" "Notas"');
      }
    } else {
      setMessage("Comando desconocido");
    }
  };

  if (loading) {
    return <Text>Cargando...</Text>;
  }

  return (
    <Box flexDirection="column" height={process.stdout.rows - 2}>
      <Box borderStyle="bold" borderColor="cyan" flexDirection="column" padding={1}>
        <Text bold>📋 Tasks</Text>
        <Text dimColor>  j/k: move • Enter: complete • d: delete • r: refresh • c: create • q: quit</Text>
      </Box>

      <Box flexDirection="column" overflow="hidden">
        {groups.map((group) => (
          <Box key={group.listId} flexDirection="column" marginY={0}>
            <Text bold color="yellow">
              # {group.listTitle}
            </Text>
            {group.tasks.map((task) => {
              const idx = flatTasks.findIndex((t) => t.task.id === task.id);
              const isSelected = idx === selectedIndex;
              return (
                <Text key={task.id} color={isSelected ? "green" : "white"} bold={isSelected}>
                  {isSelected ? "▶ " : "  "}
                  {task.title}
                </Text>
              );
            })}
          </Box>
        ))}
        {flatTasks.length === 0 && (
          <Text dimColor>No hay tareas pendientes</Text>
        )}
      </Box>

      {message && (
        <Box marginTop={1}>
          <Text color="green">{message}</Text>
        </Box>
      )}

      <Box marginTop={1}>
        <Text dimColor>
          {mode === "command" ? (
            <Text color="cyan">{command}_</Text>
          ) : (
            <Text>
              [{selectedIndex + 1}/{flatTasks.length}]
            </Text>
          )}
        </Text>
      </Box>
    </Box>
  );
};

render(<App />);