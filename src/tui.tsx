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
  notes?: string;
  due?: string;
  completed?: string;
  taskListId: string;
}

interface GroupedTasks {
  listId: string;
  listTitle: string;
  tasks: Task[];
}

type Mode = "normal" | "create";

const App = () => {
  const [groups, setGroups] = useState<GroupedTasks[]>([]);
  const [activeListIndex, setActiveListIndex] = useState(0);
  const [activeTaskIndex, setActiveTaskIndex] = useState(0);
  const [mode, setMode] = useState<Mode>("normal");
  const [message, setMessage] = useState("");
  const [createTitle, setCreateTitle] = useState("");
  const [createNotes, setCreateNotes] = useState("");
  const [createFocus, setCreateFocus] = useState<"title" | "notes">("title");

  const currentList = groups[activeListIndex];
  const currentTasks = currentList?.tasks ?? [];
  const selectedTask = currentTasks[activeTaskIndex];

  useEffect(() => {
    refreshTasks();
  }, []);

  const refreshTasks = async () => {
    try {
      const g = await service.getAllTasks();
      setGroups(g);
      if (activeListIndex >= g.length) {
        setActiveListIndex(0);
        setActiveTaskIndex(0);
      }
    } catch (e) {
      setMessage(`Error: ${e instanceof Error ? e.message : e}`);
    }
  };

  const getPosition = () => {
    if (!currentList || !selectedTask) return { list: "", task: "" };
    return { list: currentList.listId, task: selectedTask.id };
  };

  const handleComplete = () => {
    const pos = getPosition();
    if (!pos.list || !pos.task) return;

    const newGroups = groups.map(g => {
      if (g.listId !== pos.list) return g;
      return {
        ...g,
        tasks: g.tasks.filter(t => t.id !== pos.task)
      };
    });
    setGroups(newGroups);
    setMessage("Tarea completada");

    service.completeTask(pos.list, pos.task).then(() => refreshTasks()).catch(() => {
      setMessage("Error al completar");
      refreshTasks();
    });
  };

  const handleDelete = () => {
    const pos = getPosition();
    if (!pos.list || !pos.task) return;

    const newGroups = groups.map(g => {
      if (g.listId !== pos.list) return g;
      return {
        ...g,
        tasks: g.tasks.filter(t => t.id !== pos.task)
      };
    });
    setGroups(newGroups);
    setMessage("Tarea eliminada");

    service.deleteTask(pos.list, pos.task).then(() => refreshTasks()).catch(() => {
      setMessage("Error al eliminar");
      refreshTasks();
    });
  };

  const handleCreate = async () => {
    if (!createTitle.trim() || !currentList) return;
    const listId = currentList.listId;
    const tempId = `temp-${Date.now()}`;
    const tempTask: Task = {
      id: tempId,
      title: createTitle.trim(),
      status: "needsAction",
      notes: createNotes.trim() || undefined,
      taskListId: listId
    };

    setGroups(groups.map((g, i) => {
      if (i !== activeListIndex) return g;
      return { ...g, tasks: [...g.tasks, tempTask] };
    }));
    setMode("normal");
    setMessage("Tarea creada");
    setCreateTitle("");
    setCreateNotes("");

    try {
      await service.createTask(listId, createTitle.trim(), createNotes.trim() || undefined);
      refreshTasks();
    } catch {
      setGroups(groups.map((g, i) => {
        if (i !== activeListIndex) return g;
        return { ...g, tasks: g.tasks.filter(t => t.id !== tempId) };
      }));
      setMessage("Error al crear");
      refreshTasks();
    }
  };

  useInput((input, key) => {
    if (mode === "create") {
      if (key.escape) {
        setMode("normal");
        setCreateTitle("");
        setCreateNotes("");
        return;
      }

      if (key.tab) {
        setCreateFocus((f) => (f === "title" ? "notes" : "title"));
        return;
      }

      if (key.return) {
        if (createFocus === "notes") {
          handleCreate();
          return;
        }
        setCreateFocus("notes");
        return;
      }

      if (key.backspace) {
        if (createFocus === "title") {
          setCreateTitle((t) => t.slice(0, -1));
        } else {
          setCreateNotes((n) => n.slice(0, -1));
        }
        return;
      }

      if (key.upArrow || key.downArrow) {
        setCreateFocus((f) => (f === "title" ? "notes" : "title"));
        return;
      }

      if (input) {
        if (createFocus === "title") {
          setCreateTitle((t) => t + input);
        } else {
          setCreateNotes((n) => n + input);
        }
      }
      return;
    }

    if (key.tab) {
      setActiveListIndex((i) => (i + 1) % groups.length);
      setActiveTaskIndex(0);
      return;
    }

    if (key.shift && key.tab) {
      setActiveListIndex((i) => (i - 1 + groups.length) % groups.length);
      setActiveTaskIndex(0);
      return;
    }

    switch (input) {
      case "j":
        if (currentTasks.length > 0) {
          setActiveTaskIndex((i) => Math.min(i + 1, currentTasks.length - 1));
        }
        break;
      case "k":
        if (currentTasks.length > 0) {
          setActiveTaskIndex((i) => Math.max(i - 1, 0));
        }
        break;
      case "g":
        setActiveTaskIndex(0);
        break;
      case "G":
        setActiveTaskIndex(Math.max(0, currentTasks.length - 1));
        break;
    }

    if (key.return && selectedTask) {
      handleComplete();
    }

    switch (input) {
      case "d":
        handleDelete();
        break;
      case "c":
        setCreateTitle("");
        setCreateNotes("");
        setCreateFocus("title");
        setMode("create");
        break;
      case "r":
        refreshTasks();
        break;
      case "q":
        process.exit(0);
        break;
    }

    if (input === ":") {
      setMode("create");
      setCreateTitle("");
      setCreateNotes("");
      setCreateFocus("title");
    }
  });

  return (
    <Box flexDirection="column" height={process.stdout.rows - 2}>
      <Box borderStyle="bold" borderColor="cyan" flexDirection="column" padding={1}>
        <Text bold>📋 Tasks</Text>
        <Text dimColor>  Tab: listas • j/k: tareas • Enter: complete • d: delete • r: refresh • c: create • q: quit</Text>
      </Box>

      <Box flexDirection="row" marginY={0}>
        {groups.map((group, idx) => (
          <Box key={group.listId} borderStyle={idx === activeListIndex ? "bold" : "single"} borderColor={idx === activeListIndex ? "cyan" : "gray"} paddingX={1} marginRight={1}>
            <Text bold={idx === activeListIndex} color={idx === activeListIndex ? "cyan" : "white"}>
              {idx === activeListIndex ? "● " : "○ "}
              {group.listTitle}
            </Text>
          </Box>
        ))}
      </Box>

      <Box flexDirection="column" overflow="hidden">
        {currentTasks.length === 0 ? (
          <Text dimColor>No hay tareas en esta lista</Text>
        ) : (
          currentTasks.map((task, idx) => (
            <Box key={task.id}>
              <Text color={idx === activeTaskIndex ? "green" : "white"} bold={idx === activeTaskIndex}>
                {idx === activeTaskIndex ? "▶ " : "  "}
                {task.title}
              </Text>
              {task.due && <Text dimColor> 📅{new Date(task.due).toLocaleDateString()}</Text>}
            </Box>
          ))
        )}
      </Box>

      {selectedTask && (selectedTask.notes || selectedTask.due) && (
        <Box flexDirection="column" borderStyle="round" borderColor="gray" padding={1} marginTop={1}>
          <Text bold>Detalles:</Text>
          {selectedTask.notes && <Text>{selectedTask.notes}</Text>}
          {selectedTask.due && <Text>📅 Vence: {new Date(selectedTask.due).toLocaleString()}</Text>}
        </Box>
      )}

      {mode === "create" && (
        <Box flexDirection="column" borderStyle="bold" borderColor="green" padding={1} marginTop={1}>
          <Text bold color="green">Nueva tarea en "{currentList?.listTitle}"</Text>
          <Box marginTop={1}>
            <Text color={createFocus === "title" ? "green" : "white"}>
              {createFocus === "title" ? "▸" : " "} Título: {createTitle}
              {createFocus === "title" ? "▌" : ""}
            </Text>
          </Box>
          <Box>
            <Text color={createFocus === "notes" ? "green" : "white"}>
              {createFocus === "notes" ? "▸" : " "} Notas: {createNotes || "(opcional)"}
              {createFocus === "notes" ? "▌" : ""}
            </Text>
          </Box>
          <Box marginTop={1}>
            <Text dimColor>Enter: siguiente campo / confirmar • Tab: cambiar campo • Esc: cancelar</Text>
          </Box>
        </Box>
      )}

      {message && (
        <Box marginTop={1}>
          <Text color="green">{message}</Text>
        </Box>
      )}

      <Box marginTop={1}>
        <Text dimColor>
          {mode === "create" ? (
            <Text color="cyan">Creando tarea..._</Text>
          ) : (
            <Text>
              [{activeListIndex + 1}/{groups.length}] {currentTasks.length > 0 ? `[${activeTaskIndex + 1}/${currentTasks.length}]` : ""}
            </Text>
          )}
        </Text>
      </Box>
    </Box>
  );
};

render(<App />);