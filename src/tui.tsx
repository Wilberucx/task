#!/usr/bin/env node
import React, { useState, useEffect, useMemo } from "react";
import { render, Box, Text, useInput, useStdout } from "ink";
import { GwsTaskRepository } from "./infrastructure/gws/GwsTaskRepository.js";
import { TaskService } from "./application/TaskService.js";
import type { GroupedTasks } from "./application/TaskService.js";

const repo = new GwsTaskRepository();
const service = new TaskService(repo);

interface TaskNode {
  id: string;
  title: string;
  status: "needsAction" | "completed";
  notes?: string;
  due?: string;
  completed?: string;
  taskListId: string;
  parent?: string;
  children: TaskNode[];
}

interface Task {
  id: string;
  title: string;
  status: "needsAction" | "completed";
  notes?: string;
  due?: string;
  completed?: string;
  taskListId: string;
  parent?: string;
}

type Mode = "normal" | "create" | "edit" | "detail";

function collectIdsWithChildren(nodes: TaskNode[]): string[] {
  const ids: string[] = [];
  for (const node of nodes) {
    if (node.children.length > 0) ids.push(node.id);
    ids.push(...collectIdsWithChildren(node.children));
  }
  return ids;
}

function flattenVisible(nodes: TaskNode[], collapsed: Set<string>): TaskNode[] {
  const result: TaskNode[] = [];
  for (const node of nodes) {
    result.push(node);
    if (!collapsed.has(node.id)) {
      result.push(...flattenVisible(node.children, collapsed));
    }
  }
  return result;
}

function truncate(text: string, maxWidth: number): string {
  if (text.length <= maxWidth) return text;
  return text.slice(0, maxWidth - 1) + "…";
}

const HEADER_ROWS = { large: 1, medium: 1, small: 1, tiny: 0 };
const TABS_ROWS = 2;
const STATUS_ROWS = 3;

type Breakpoint = "large" | "medium" | "small" | "tiny";

function getBreakpoint(cols: number): Breakpoint {
  if (cols >= 100) return "large";
  if (cols >= 70) return "medium";
  if (cols >= 40) return "small";
  return "tiny";
}

const App = () => {
  const [groups, setGroups] = useState<GroupedTasks[]>([]);
  const [activeListIndex, setActiveListIndex] = useState(0);
  const [activeTaskIndex, setActiveTaskIndex] = useState(0);
  const [mode, setMode] = useState<Mode>("normal");
  const [message, setMessage] = useState("");
  const [createTitle, setCreateTitle] = useState("");
  const [createNotes, setCreateNotes] = useState("");
  const [createFocus, setCreateFocus] = useState<"title" | "notes">("title");
  const [editTitle, setEditTitle] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editFocus, setEditFocus] = useState<"title" | "notes">("title");
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [scrollOffset, setScrollOffset] = useState(0);

  const { stdout } = useStdout();
  const [cols, setCols] = useState(stdout.columns);
  const [rows, setRows] = useState(stdout.rows);

  const currentList = groups[activeListIndex];
  const currentTasks = currentList?.tasks ?? [];

  const visibleTasks = useMemo(() => flattenVisible(currentTasks, collapsed), [currentTasks, collapsed]);

  const selectedTask = visibleTasks[activeTaskIndex];

  useEffect(() => {
    setScrollOffset(0);
  }, [selectedTask, mode]);

  useEffect(() => {
    let shouldUpdate = true;
    const handler = () => {
      if (shouldUpdate) {
        setCols(stdout.columns);
        setRows(stdout.rows);
      }
    };
    stdout.on("resize", handler);
    return () => {
      shouldUpdate = false;
      stdout.off("resize", handler);
    };
  }, [stdout]);

  const breakpoint = getBreakpoint(cols);
  const headerH = HEADER_ROWS[breakpoint];
  
  // Height adaptivity: prioritize height if taller than wide
  const detailH = rows > cols ? Math.floor(rows * 0.4) : Math.max(3, Math.floor(rows * 0.25));
  
  const listH = rows - headerH - TABS_ROWS - STATUS_ROWS - (mode !== "detail" && selectedTask && (selectedTask.notes || selectedTask.due) && breakpoint !== "tiny" ? detailH : 0);

  const initCollapsed = (nodes: TaskNode[]) => {
    const ids = collectIdsWithChildren(nodes);
    setCollapsed(new Set(ids));
  };

  useEffect(() => {
    refreshTasks();
  }, []);

  useEffect(() => {
    if (currentTasks.length > 0) {
      initCollapsed(currentTasks);
    }
  }, [activeListIndex]);

  const refreshTasks = async () => {
    try {
      const g = await service.getAllTasks();
      setGroups(g);
      if (activeListIndex >= g.length) {
        setActiveListIndex(0);
        setActiveTaskIndex(0);
      }
      if (g[activeListIndex]) {
        initCollapsed(g[activeListIndex].tasks);
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
    const tempTask: TaskNode = {
      id: tempId,
      title: createTitle.trim(),
      status: "needsAction",
      notes: createNotes.trim() || undefined,
      taskListId: listId,
      children: []
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

  const handleEditStart = () => {
    if (!selectedTask) return;
    setEditingTaskId(selectedTask.id);
    setEditTitle(selectedTask.title);
    setEditNotes(selectedTask.notes || "");
    setEditFocus("title");
    setMode("edit");
  };

  const handleEdit = async () => {
    if (!editingTaskId || !currentList || !editTitle.trim()) return;
    const listId = currentList.listId;

    setGroups(groups.map(g => {
      if (g.listId !== listId) return g;
      return {
        ...g,
        tasks: g.tasks.map(t => t.id === editingTaskId ? { ...t, title: editTitle.trim(), notes: editNotes.trim() || undefined } : t)
      };
    }));
    setMode("normal");
    setMessage("Tarea actualizada");
    setEditingTaskId(null);
    setEditTitle("");
    setEditNotes("");

    try {
      await service.createTask(listId, editTitle.trim(), editNotes.trim() || undefined);
      refreshTasks();
    } catch {
      setMessage("Error al actualizar");
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

    if (mode === "edit") {
      if (key.escape) {
        setMode("normal");
        setEditingTaskId(null);
        setEditTitle("");
        setEditNotes("");
        return;
      }

      if (key.tab) {
        setEditFocus((f) => (f === "title" ? "notes" : "title"));
        return;
      }

      if (key.return) {
        if (editFocus === "notes") {
          handleEdit();
          return;
        }
        setEditFocus("notes");
        return;
      }

      if (key.backspace) {
        if (editFocus === "title") {
          setEditTitle((t) => t.slice(0, -1));
        } else {
          setEditNotes((n) => n.slice(0, -1));
        }
        return;
      }

      if (key.upArrow || key.downArrow) {
        setEditFocus((f) => (f === "title" ? "notes" : "title"));
        return;
      }

      if (input) {
        if (editFocus === "title") {
          setEditTitle((t) => t + input);
        } else {
          setEditNotes((n) => n + input);
        }
      }
      return;
    }

    if (mode === "detail") {
      if (key.escape) {
        setMode("normal");
        return;
      }
      if (input === "j") setScrollOffset((o) => o + 1);
      if (input === "k") setScrollOffset((o) => Math.max(0, o - 1));
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
        if (visibleTasks.length > 0) {
          setActiveTaskIndex((i) => Math.min(i + 1, visibleTasks.length - 1));
        }
        break;
      case "k":
        if (visibleTasks.length > 0) {
          setActiveTaskIndex((i) => Math.max(i - 1, 0));
        }
        break;
      case "g":
        setActiveTaskIndex(0);
        break;
      case "G":
        setActiveTaskIndex(Math.max(0, visibleTasks.length - 1));
        break;
    }

    if (input === "l" && selectedTask && selectedTask.children.length > 0) {
      setCollapsed((prev) => {
        const next = new Set(prev);
        next.delete(selectedTask.id);
        return next;
      });
      return;
    }

    if (input === "h" && selectedTask && selectedTask.children.length > 0) {
      setCollapsed((prev) => {
        const next = new Set(prev);
        next.add(selectedTask.id);
        return next;
      });
      return;
    }

    if (input === " " && selectedTask) {
      handleComplete();
      return;
    }

    if (key.return && selectedTask) {
      setMode("detail");
      return;
    }

    switch (input) {
      case "d":
        handleDelete();
        break;
      case "a":
        setCreateTitle("");
        setCreateNotes("");
        setCreateFocus("title");
        setMode("create");
        break;
      case "e":
        handleEditStart();
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
    <Box flexDirection="column" height={rows - 2}>
      {breakpoint !== "tiny" && (
        <Box flexDirection="row" justifyContent="space-between" paddingX={1} height={1} marginBottom={1}>
          <Box>
            <Text bold color="cyan">TASK </Text>
            <Text dimColor>| {currentList?.listTitle}</Text>
          </Box>
          <Text dimColor>j/k: tasks • spc: done • ret: detail • d/e/a/r/q</Text>
        </Box>
      )}

      <Box flexDirection="row" marginY={1} paddingX={1}>
        {groups.map((group, idx) => (
          <Box key={group.listId} marginRight={2}>
            <Text bold={idx === activeListIndex} color={idx === activeListIndex ? "cyan" : "gray"}>
              {idx === activeListIndex ? "●" : "○"} {group.listTitle.toUpperCase()}
            </Text>
          </Box>
        ))}
      </Box>

      <Box flexDirection="column" overflow="hidden" height={listH}>
        {visibleTasks.length === 0 ? (
          <Text dimColor>  No hay tareas en esta lista</Text>
        ) : (
          visibleTasks.map((task: TaskNode, idx: number) => {
            const isCollapsed = collapsed.has(task.id);
            const hasChildren = task.children.length > 0;
            const isChild = !!task.parent;
            const dateStr = task.due ? ` 📅${new Date(task.due).toLocaleDateString()}` : "";
            const titleMaxWidth = cols - (isChild ? 8 : 6) - dateStr.length;
            
            return (
              <Box key={task.id} paddingX={1} flexDirection="row">
                <Text color={idx === activeTaskIndex ? "green" : "white"}>
                  {idx === activeTaskIndex ? "▶ " : "  "}
                  {task.status === "completed" ? "▣ " : "▢ "}
                </Text>
                <Box flexDirection="column" flexShrink={1}>
                  <Text color={idx === activeTaskIndex ? "green" : "white"} bold={idx === activeTaskIndex}>
                    {isChild ? "  " : ""}
                    {task.title}
                    {hasChildren && (isCollapsed ? " ▸" : " ▾")}
                  </Text>
                  {dateStr && <Text dimColor>{dateStr}</Text>}
                </Box>
              </Box>
            );
          })
        )}
      </Box>

      {mode !== "detail" && selectedTask && (selectedTask.notes || selectedTask.due) && breakpoint !== "tiny" && (
        <Box flexDirection="column" borderStyle="round" borderColor="gray" paddingX={1} marginTop={1} height={detailH} overflow="hidden">
          <Text bold color="gray">Detalles:</Text>
          {selectedTask.notes && <Text>{selectedTask.notes}</Text>}
          {selectedTask.due && <Text dimColor>📅 Vence: {new Date(selectedTask.due).toLocaleString()}</Text>}
        </Box>
      )}

      {mode === "detail" && selectedTask && (
        <Box flexDirection="column" borderStyle="bold" borderColor="cyan" paddingX={1} marginTop={1} height={detailH} overflow="hidden">
          <Text bold color="cyan">{selectedTask.title}</Text>
          <Box flexDirection="column" marginTop={1} overflow="hidden">
             {(selectedTask.notes || "").split("\n").slice(scrollOffset).map((line, i) => (
               <Text key={i}>{line}</Text>
             ))}
          </Box>
          <Box marginTop={1} flexDirection="row" justifyContent="space-between">
            <Text dimColor>Esc: Volver • j/k: Scroll</Text>
            {selectedTask.due && <Text dimColor>📅 {new Date(selectedTask.due).toLocaleString()}</Text>}
          </Box>
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

      {mode === "edit" && (
        <Box flexDirection="column" borderStyle="bold" borderColor="yellow" padding={1} marginTop={1}>
          <Text bold color="yellow">Editar tarea</Text>
          <Box marginTop={1}>
            <Text color={editFocus === "title" ? "yellow" : "white"}>
              {editFocus === "title" ? "▸" : " "} Título: {editTitle}
              {editFocus === "title" ? "▌" : ""}
            </Text>
          </Box>
          <Box>
            <Text color={editFocus === "notes" ? "yellow" : "white"}>
              {editFocus === "notes" ? "▸" : " "} Notas: {editNotes || "(opcional)"}
              {editFocus === "notes" ? "▌" : ""}
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
              {`[${activeListIndex + 1}/${groups.length}] ${visibleTasks.length > 0 ? `[${activeTaskIndex + 1}/${visibleTasks.length}]` : ""}`}
            </Text>
          )}
        </Text>
      </Box>
    </Box>
  );
};

render(<App />);