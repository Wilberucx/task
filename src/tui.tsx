#!/usr/bin/env node
import React, { useState, useEffect, useMemo } from "react";
import { render, Box, Text, useInput, useStdout } from "ink";
import { GwsTaskRepository } from "./infrastructure/gws/GwsTaskRepository.js";
import { TaskService } from "./application/TaskService.js";
import type { GroupedTasks } from "./application/TaskService.js";
import fs from "fs";
import path from "path";
import os from "os";

const CACHE_DIR = path.join(os.homedir(), ".cache", "task-cli");
const CACHE_FILE = path.join(CACHE_DIR, "last_tasks.json");

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
type CreateFocus = "title" | "notes" | "subtasks";
type EditFocus = "title" | "notes" | "subtasks";

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


function calcLines(text: string, maxWidth: number): number {
  if (!text) return 1;
  let total = 0;
  for (const line of text.split('\n')) {
    if (line.length === 0) {
      total += 1;
    } else {
      total += Math.ceil(line.length / maxWidth);
    }
  }
  return total;
}

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
  const [createFocus, setCreateFocus] = useState<CreateFocus>("title");
  const [createSubtasks, setCreateSubtasks] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editSubtasks, setEditSubtasks] = useState("");
  const [editFocus, setEditFocus] = useState<EditFocus>("title");
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [scrollOffset, setScrollOffset] = useState(0);
  const [helpVisible, setHelpVisible] = useState(false);

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

  const textWidth = Math.max(1, cols - 8);
  const maxBoxH = Math.max(3, Math.min(Math.floor(rows * 0.3), 12));

  const breakpoint = getBreakpoint(cols);

  // Portrait mode: no detail preview to maximize task list space
  const detailH = rows > cols ? 0 : Math.max(4, Math.floor(rows * 0.35));

  const listH = rows - TABS_ROWS - STATUS_ROWS - (mode !== "detail" && selectedTask && (selectedTask.notes || selectedTask.due) && breakpoint !== "tiny" ? detailH : 0);


  const initCollapsed = (nodes: TaskNode[]) => {
    const ids = collectIdsWithChildren(nodes);
    setCollapsed(new Set(ids));
  };

  useEffect(() => {
    if (fs.existsSync(CACHE_FILE)) {
      try {
        const cachedData = JSON.parse(fs.readFileSync(CACHE_FILE, "utf-8"));
        setGroups(cachedData);
      } catch (e) {
        // Ignorar errores de lectura de caché
      }
    }
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
      
      // Solo actualizar si hay cambios (JSON string comparison para simplificar)
      if (JSON.stringify(g) !== JSON.stringify(groups)) {
        setGroups(g);
        
        // Guardar en caché
        if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
        fs.writeFileSync(CACHE_FILE, JSON.stringify(g));
      }

      if (activeListIndex >= g.length) {
        setActiveListIndex(0);
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
    setMessage("Task completed");

    service.completeTask(pos.list, pos.task).then(() => refreshTasks()).catch(() => {
      setMessage("Error completing");
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
    setMessage("Task deleted");

    service.deleteTask(pos.list, pos.task).then(() => refreshTasks()).catch(() => {
      setMessage("Error deleting");
      refreshTasks();
    });
  };

  const handleCreate = async () => {
    if (!createTitle.trim() || !currentList) return;
    const listId = currentList.listId;

    setMode("normal");
    setMessage("Creating task…");

    // Parse subtask lines from the multi-line input
    const subtaskLines = createSubtasks
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0);

    try {
      // Create the main task
      const created = await service.createTask(listId, createTitle.trim(), createNotes.trim() || undefined);

      // Create each subtask as a child of the main task
      if (subtaskLines.length > 0 && created.id) {
        await Promise.all(
          subtaskLines.map(title =>
            service.createTask(listId, title, undefined, created.id)
          )
        );
      }

      setMessage("Task created");
      refreshTasks();
    } catch {
      setMessage("Error creating task");
      refreshTasks();
    }

    setCreateTitle("");
    setCreateNotes("");
    setCreateSubtasks("");
  };

  const handleEditStart = () => {
    if (!selectedTask) return;
    setEditingTaskId(selectedTask.id);
    setEditTitle(selectedTask.title);
    setEditNotes(selectedTask.notes || "");
    setEditSubtasks("");
    setEditFocus("title");
    setMode("edit");
  };

  const handleEdit = async () => {
    if (!editingTaskId || !currentList || !editTitle.trim()) return;
    const listId = currentList.listId;

    // Parse subtask lines
    const subtaskLines = editSubtasks
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0);

    setGroups(groups.map(g => {
      if (g.listId !== listId) return g;
      return {
        ...g,
        tasks: g.tasks.map(t => t.id === editingTaskId ? {
          ...t,
          title: editTitle.trim(),
          notes: editNotes.trim() || undefined
        } : t)
      };
    }));
    setMode("normal");
    setMessage("Task updated");
    setEditingTaskId(null);
    setEditTitle("");
    setEditNotes("");
    setEditSubtasks("");

    try {
      await service.updateTask(listId, editingTaskId, editTitle.trim(), editNotes.trim() || undefined);

      // Create subtasks under the edited task
      if (subtaskLines.length > 0 && editingTaskId) {
        await Promise.all(
          subtaskLines.map(title =>
            service.createTask(listId, title, undefined, editingTaskId)
          )
        );
      }

      refreshTasks();
    } catch {
      setMessage("Error updating");
      refreshTasks();
    }
  };

  useInput((input, key) => {
    if (mode === "create") {
      if (key.escape) {
        setMode("normal");
        setCreateTitle("");
        setCreateNotes("");
        setCreateSubtasks("");
        return;
      }

      if (key.shift && key.tab) {
        setCreateFocus((f) => {
          const order: CreateFocus[] = ["title", "notes", "subtasks"];
          return order[(order.indexOf(f) - 1 + order.length) % order.length];
        });
        return;
      }

      if (key.tab) {
        setCreateFocus((f) => {
          const order: CreateFocus[] = ["title", "notes", "subtasks"];
          return order[(order.indexOf(f) + 1) % order.length];
        });
        return;
      }

      // Enter creates the task (newline in subtasks field)
      if (key.return) {
        if (createFocus === "subtasks") {
          setCreateSubtasks((s) => s + "\n");
          return;
        }
        handleCreate();
        return;
      }

      if (key.upArrow || key.downArrow) {
        setCreateFocus((f) => {
          const order: CreateFocus[] = ["title", "notes", "subtasks"];
          return order[(order.indexOf(f) + (key.upArrow ? -1 : 1) + order.length) % order.length];
        });
        return;
      }

      if (key.backspace) {
        if (createFocus === "title") {
          setCreateTitle((t) => t.slice(0, -1));
        } else if (createFocus === "notes") {
          setCreateNotes((n) => n.slice(0, -1));
        } else {
          setCreateSubtasks((s) => s.slice(0, -1));
        }
        return;
      }

      if (input) {
        if (createFocus === "title") {
          setCreateTitle((t) => t + input);
        } else if (createFocus === "notes") {
          setCreateNotes((n) => n + input);
        } else {
          setCreateSubtasks((s) => s + input);
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
        setEditSubtasks("");
        return;
      }

      if (key.shift && key.tab) {
        setEditFocus((f) => {
          const order: EditFocus[] = ["title", "notes", "subtasks"];
          return order[(order.indexOf(f) - 1 + order.length) % order.length];
        });
        return;
      }

      if (key.tab) {
        setEditFocus((f) => {
          const order: EditFocus[] = ["title", "notes", "subtasks"];
          return order[(order.indexOf(f) + 1) % order.length];
        });
        return;
      }

      // Enter saves the task (newline in subtasks field)
      if (key.return) {
        if (editFocus === "subtasks") {
          setEditSubtasks((s) => s + "\n");
          return;
        }
        handleEdit();
        return;
      }

      if (key.upArrow || key.downArrow) {
        setEditFocus((f) => {
          const order: EditFocus[] = ["title", "notes", "subtasks"];
          return order[(order.indexOf(f) + (key.upArrow ? -1 : 1) + order.length) % order.length];
        });
        return;
      }

      if (key.backspace) {
        if (editFocus === "title") {
          setEditTitle((t) => t.slice(0, -1));
        } else if (editFocus === "notes") {
          setEditNotes((n) => n.slice(0, -1));
        } else {
          setEditSubtasks((s) => s.slice(0, -1));
        }
        return;
      }

      if (input) {
        if (editFocus === "title") {
          setEditTitle((t) => t + input);
        } else if (editFocus === "notes") {
          setEditNotes((n) => n + input);
        } else {
          setEditSubtasks((s) => s + input);
        }
      }
      return;
    }

    // If help is visible, dismiss on any action key
    if (helpVisible) {
      if (input === "?") {
        setHelpVisible(false);
        return;
      }
      if (key.escape) {
        setHelpVisible(false);
        return;
      }
      if (input || key.return || key.tab || (key.shift && key.tab)) {
        setHelpVisible(false);
        // fall through to process the action
      }
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
        setCreateSubtasks("");
        setCreateFocus("title");
        setMode("create");
        break;
      case "e":
        handleEditStart();
        break;
      case "?":
        setHelpVisible(!helpVisible);
        break;
      case "r":
        refreshTasks();
        break;
      case "q":
        process.exit(0);
        break;
    }

    if (input === ":") {
      setCreateTitle("");
      setCreateNotes("");
      setCreateSubtasks("");
      setCreateFocus("title");
      setMode("create");
    }
  });

  // ─── Full-screen create modal (with subtask entry) ──────────────────
  if (mode === "create") {
    const titleBoxH = Math.min(calcLines(createTitle, textWidth) + 2, maxBoxH);
    const notesBoxH = Math.min(calcLines(createNotes, textWidth) + 2, maxBoxH);
    const subtasksBoxH = Math.min(calcLines(createSubtasks, textWidth) + 2, maxBoxH);

    return (
      <Box flexDirection="column" height={rows - 2} paddingX={2} paddingY={1}>
        <Box flexGrow={1} minHeight={1} />

        <Box justifyContent="center">
          <Text bold color="green">✦ NEW TASK ✦</Text>
        </Box>
        <Box justifyContent="center">
          <Text dimColor>─── {currentList?.listTitle.toUpperCase()} ───</Text>
        </Box>

        <Box height={2} />

        <Box flexDirection="column" marginBottom={1}>
          <Text bold color={createFocus === "title" ? "green" : "gray"}>
            {createFocus === "title" ? "▸ " : "  "}TITLE
          </Text>
          <Box
            borderStyle="round"
            borderColor={createFocus === "title" ? "green" : "gray"}
            paddingX={1}
            height={titleBoxH}
          >
            <Text wrap="wrap">
              {createTitle || (createFocus === "title" ? "" : <Text dimColor>(empty)</Text>)}
              {createFocus === "title" && <Text color="green">▌</Text>}
            </Text>
          </Box>
        </Box>

        <Box flexDirection="column" marginBottom={1}>
          <Text bold color={createFocus === "notes" ? "green" : "gray"}>
            {createFocus === "notes" ? "▸ " : "  "}NOTES
          </Text>
          <Box
            borderStyle="round"
            borderColor={createFocus === "notes" ? "green" : "gray"}
            paddingX={1}
            height={notesBoxH}
          >
            <Text wrap="wrap">
              {createNotes || (createFocus === "notes" ? "" : <Text dimColor>(optional)</Text>)}
              {createFocus === "notes" && <Text color="green">▌</Text>}
            </Text>
          </Box>
        </Box>

        <Box flexDirection="column" marginBottom={1}>
          <Text bold color={createFocus === "subtasks" ? "green" : "gray"}>
            {createFocus === "subtasks" ? "▸ " : "  "}SUBTASKS
            <Text dimColor> (Enter for new line)</Text>
          </Text>
          <Box
            borderStyle="round"
            borderColor={createFocus === "subtasks" ? "green" : "gray"}
            paddingX={1}
            height={subtasksBoxH}
          >
            <Text wrap="wrap">
              {createSubtasks || (createFocus === "subtasks" ? "" : <Text dimColor>(optional)</Text>)}
              {createFocus === "subtasks" && <Text color="green">▌</Text>}
            </Text>
          </Box>
        </Box>

        {message && (
          <Box justifyContent="center" marginBottom={1}>
            <Text color="green">{message}</Text>
          </Box>
        )}

        <Box flexGrow={1} minHeight={1} />

        <Box justifyContent="center" marginBottom={1}>
          <Text dimColor>
            {createFocus === "subtasks"
              ? "Enter: New Line  •  Tab/↑↓: Field  •  Esc: Cancel"
              : "Enter: Create  •  Tab/↑↓: Field  •  Esc: Cancel"}
          </Text>
        </Box>
      </Box>
    );
  }

  // ─── Full-screen edit modal (same boxes as create) ───────────────────
  if (mode === "edit") {
    const editTitleBoxH = Math.min(calcLines(editTitle, textWidth) + 2, maxBoxH);
    const editNotesBoxH = Math.min(calcLines(editNotes, textWidth) + 2, maxBoxH);
    const editSubtasksBoxH = Math.min(calcLines(editSubtasks, textWidth) + 2, maxBoxH);

    return (
      <Box flexDirection="column" height={rows - 2} paddingX={2} paddingY={1}>
        <Box flexGrow={1} minHeight={1} />

        <Box justifyContent="center">
          <Text bold color="yellow">✦ EDIT TASK ✦</Text>
        </Box>
        <Box justifyContent="center">
          <Text dimColor>─── {currentList?.listTitle.toUpperCase()} ───</Text>
        </Box>

        <Box height={2} />

        <Box flexDirection="column" marginBottom={1}>
          <Text bold color={editFocus === "title" ? "yellow" : "gray"}>
            {editFocus === "title" ? "▸ " : "  "}TITLE
          </Text>
          <Box
            borderStyle="round"
            borderColor={editFocus === "title" ? "yellow" : "gray"}
            paddingX={1}
            height={editTitleBoxH}
          >
            <Text wrap="wrap">
              {editTitle || (editFocus === "title" ? "" : <Text dimColor>(empty)</Text>)}
              {editFocus === "title" && <Text color="yellow">▌</Text>}
            </Text>
          </Box>
        </Box>

        <Box flexDirection="column" marginBottom={1}>
          <Text bold color={editFocus === "notes" ? "yellow" : "gray"}>
            {editFocus === "notes" ? "▸ " : "  "}NOTES
          </Text>
          <Box
            borderStyle="round"
            borderColor={editFocus === "notes" ? "yellow" : "gray"}
            paddingX={1}
            height={editNotesBoxH}
          >
            <Text wrap="wrap">
              {editNotes || (editFocus === "notes" ? "" : <Text dimColor>(empty)</Text>)}
              {editFocus === "notes" && <Text color="yellow">▌</Text>}
            </Text>
          </Box>
        </Box>

        <Box flexDirection="column" marginBottom={1}>
          <Text bold color={editFocus === "subtasks" ? "yellow" : "gray"}>
            {editFocus === "subtasks" ? "▸ " : "  "}SUBTASKS
            <Text dimColor> (Enter for new line)</Text>
          </Text>
          <Box
            borderStyle="round"
            borderColor={editFocus === "subtasks" ? "yellow" : "gray"}
            paddingX={1}
            height={editSubtasksBoxH}
          >
            <Text wrap="wrap">
              {editSubtasks || (editFocus === "subtasks" ? "" : <Text dimColor>(optional)</Text>)}
              {editFocus === "subtasks" && <Text color="yellow">▌</Text>}
            </Text>
          </Box>
        </Box>

        {message && (
          <Box justifyContent="center" marginBottom={1}>
            <Text color="green">{message}</Text>
          </Box>
        )}

        <Box flexGrow={1} />

        <Box justifyContent="center" marginBottom={1}>
          <Text dimColor>
            {editFocus === "subtasks"
              ? "Enter: New Line  •  Tab/↑↓: Field  •  Esc: Cancel"
              : "Enter: Save  •  Tab/↑↓: Field  •  Esc: Cancel"}
          </Text>
        </Box>
      </Box>
    );
  }

  // ─── UI normal ───────────────────────────────────────────────────────
  return (
    <Box flexDirection="column" height={rows - 2}>
      {breakpoint !== "tiny" && (
        <Box flexDirection="row" paddingX={1} height={1} marginBottom={1}>
          <Box>
            <Text bold color="cyan">TASK </Text>
            <Text dimColor>| {currentList?.listTitle}</Text>
          </Box>
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
          <Text dimColor>  No tasks in this list</Text>
        ) : (
          visibleTasks.map((task: TaskNode, idx: number) => {
            const isCollapsed = collapsed.has(task.id);
            const hasChildren = task.children.length > 0;
            const isChild = !!task.parent;
            const dateStr = task.due ? ` 📅${new Date(task.due).toLocaleDateString()}` : "";
            
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

      {mode !== "detail" && selectedTask && (selectedTask.notes || selectedTask.due) && breakpoint !== "tiny" && detailH > 0 && (
        <Box flexDirection="column" borderStyle="round" borderColor="gray" paddingX={1} marginTop={1} height={detailH} overflow="hidden">
          <Text bold color="gray">Details:</Text>
          {selectedTask.notes && <Text>{selectedTask.notes}</Text>}
          {selectedTask.due && <Text dimColor>📅 Due: {new Date(selectedTask.due).toLocaleString()}</Text>}
        </Box>
      )}

      {mode === "detail" && selectedTask && (
        <Box flexDirection="column" borderStyle="bold" borderColor="cyan" paddingX={1} marginTop={1} height={detailH} overflow="hidden">
          <Box flexDirection="column" overflow="hidden">
             {(selectedTask.notes || "").split("\n").slice(scrollOffset).map((line, i) => (
               <Text key={i}>{line}</Text>
             ))}
          </Box>
          <Box marginTop={1} flexDirection="row" justifyContent="space-between">
            <Text dimColor>Esc: Back • j/k: Scroll</Text>
            {selectedTask.due && <Text dimColor>📅 {new Date(selectedTask.due).toLocaleString()}</Text>}
          </Box>
        </Box>
      )}

      {message && (
        <Box marginTop={1}>
          <Text color="green">{message}</Text>
        </Box>
      )}

      <Box marginTop={1} flexDirection="row" justifyContent="space-between">
        <Text dimColor>
          {`[${activeListIndex + 1}/${groups.length}] ${visibleTasks.length > 0 ? `[${activeTaskIndex + 1}/${visibleTasks.length}]` : ""}`}
        </Text>
        {!helpVisible && <Text dimColor>?: help</Text>}
        {helpVisible && <Text dimColor>?: / Esc: close</Text>}
      </Box>

      {helpVisible && (
        <Box
          flexDirection="column"
          borderStyle="round"
          borderColor="cyan"
          paddingX={2}
          paddingY={1}
          marginTop={1}
          height={Math.min(16, Math.floor((rows - 2) / 2))}
          overflow="hidden"
        >
          <Box justifyContent="center" marginBottom={1}>
            <Text bold color="cyan">HELP</Text>
          </Box>
          <Box flexDirection="row">
            <Box flexDirection="column" marginRight={4}>
              <Text bold color="gray">Navigation</Text>
              <Text>  j/k    Move tasks</Text>
              <Text>  g/G    Top / Bottom</Text>
              <Text>  Tab    Switch list</Text>
              <Text>  h/l    Collapse / Expand</Text>
              <Text>  Enter  View details</Text>
            </Box>
            <Box flexDirection="column">
              <Text bold color="gray">Actions</Text>
              <Text>  Space  Toggle done</Text>
              <Text>  d      Delete task</Text>
              <Text>  e      Edit task</Text>
              <Text>  a / :  New task</Text>
              <Text>  r      Refresh</Text>
              <Text>  q      Quit</Text>
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  );
};

render(<App />);
