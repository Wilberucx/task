#!/usr/bin/env node
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { render, Box, Text, useInput } from "ink";
import { GwsTaskRepository } from "./infrastructure/gws/GwsTaskRepository.js";
import { TaskService } from "./application/TaskService.js";
const repo = new GwsTaskRepository();
const service = new TaskService(repo);
const App = () => {
    const [groups, setGroups] = useState([]);
    const [activeListIndex, setActiveListIndex] = useState(0);
    const [activeTaskIndex, setActiveTaskIndex] = useState(0);
    const [mode, setMode] = useState("normal");
    const [message, setMessage] = useState("");
    const [createTitle, setCreateTitle] = useState("");
    const [createNotes, setCreateNotes] = useState("");
    const [createFocus, setCreateFocus] = useState("title");
    const [editTitle, setEditTitle] = useState("");
    const [editNotes, setEditNotes] = useState("");
    const [editFocus, setEditFocus] = useState("title");
    const [editingTaskId, setEditingTaskId] = useState(null);
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
        }
        catch (e) {
            setMessage(`Error: ${e instanceof Error ? e.message : e}`);
        }
    };
    const getPosition = () => {
        if (!currentList || !selectedTask)
            return { list: "", task: "" };
        return { list: currentList.listId, task: selectedTask.id };
    };
    const handleComplete = () => {
        const pos = getPosition();
        if (!pos.list || !pos.task)
            return;
        const newGroups = groups.map(g => {
            if (g.listId !== pos.list)
                return g;
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
        if (!pos.list || !pos.task)
            return;
        const newGroups = groups.map(g => {
            if (g.listId !== pos.list)
                return g;
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
        if (!createTitle.trim() || !currentList)
            return;
        const listId = currentList.listId;
        const tempId = `temp-${Date.now()}`;
        const tempTask = {
            id: tempId,
            title: createTitle.trim(),
            status: "needsAction",
            notes: createNotes.trim() || undefined,
            taskListId: listId
        };
        setGroups(groups.map((g, i) => {
            if (i !== activeListIndex)
                return g;
            return { ...g, tasks: [...g.tasks, tempTask] };
        }));
        setMode("normal");
        setMessage("Tarea creada");
        setCreateTitle("");
        setCreateNotes("");
        try {
            await service.createTask(listId, createTitle.trim(), createNotes.trim() || undefined);
            refreshTasks();
        }
        catch {
            setGroups(groups.map((g, i) => {
                if (i !== activeListIndex)
                    return g;
                return { ...g, tasks: g.tasks.filter(t => t.id !== tempId) };
            }));
            setMessage("Error al crear");
            refreshTasks();
        }
    };
    const handleEditStart = () => {
        if (!selectedTask)
            return;
        setEditingTaskId(selectedTask.id);
        setEditTitle(selectedTask.title);
        setEditNotes(selectedTask.notes || "");
        setEditFocus("title");
        setMode("edit");
    };
    const handleEdit = async () => {
        if (!editingTaskId || !currentList || !editTitle.trim())
            return;
        const listId = currentList.listId;
        setGroups(groups.map(g => {
            if (g.listId !== listId)
                return g;
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
        }
        catch {
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
                }
                else {
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
                }
                else {
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
                }
                else {
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
                }
                else {
                    setEditNotes((n) => n + input);
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
    return (_jsxs(Box, { flexDirection: "column", height: process.stdout.rows - 2, children: [_jsxs(Box, { borderStyle: "bold", borderColor: "cyan", flexDirection: "column", padding: 1, children: [_jsx(Text, { bold: true, children: "\uD83D\uDCCB Tasks" }), _jsx(Text, { dimColor: true, children: "  Tab: listas \u2022 j/k: tareas \u2022 Enter: complete \u2022 d: delete \u2022 e: edit \u2022 a: create \u2022 r: refresh \u2022 q: quit" })] }), _jsx(Box, { flexDirection: "row", marginY: 0, children: groups.map((group, idx) => (_jsx(Box, { borderStyle: idx === activeListIndex ? "bold" : "single", borderColor: idx === activeListIndex ? "cyan" : "gray", paddingX: 1, marginRight: 1, children: _jsxs(Text, { bold: idx === activeListIndex, color: idx === activeListIndex ? "cyan" : "white", children: [idx === activeListIndex ? "● " : "○ ", group.listTitle] }) }, group.listId))) }), _jsx(Box, { flexDirection: "column", overflow: "hidden", children: currentTasks.length === 0 ? (_jsx(Text, { dimColor: true, children: "No hay tareas en esta lista" })) : (currentTasks.map((task, idx) => (_jsxs(Box, { children: [_jsxs(Text, { color: idx === activeTaskIndex ? "green" : "white", bold: idx === activeTaskIndex, children: [idx === activeTaskIndex ? "▶ " : "  ", task.title] }), task.due && _jsxs(Text, { dimColor: true, children: [" \uD83D\uDCC5", new Date(task.due).toLocaleDateString()] })] }, task.id)))) }), selectedTask && (selectedTask.notes || selectedTask.due) && (_jsxs(Box, { flexDirection: "column", borderStyle: "round", borderColor: "gray", padding: 1, marginTop: 1, children: [_jsx(Text, { bold: true, children: "Detalles:" }), selectedTask.notes && _jsx(Text, { children: selectedTask.notes }), selectedTask.due && _jsxs(Text, { children: ["\uD83D\uDCC5 Vence: ", new Date(selectedTask.due).toLocaleString()] })] })), mode === "create" && (_jsxs(Box, { flexDirection: "column", borderStyle: "bold", borderColor: "green", padding: 1, marginTop: 1, children: [_jsxs(Text, { bold: true, color: "green", children: ["Nueva tarea en \"", currentList?.listTitle, "\""] }), _jsx(Box, { marginTop: 1, children: _jsxs(Text, { color: createFocus === "title" ? "green" : "white", children: [createFocus === "title" ? "▸" : " ", " T\u00EDtulo: ", createTitle, createFocus === "title" ? "▌" : ""] }) }), _jsx(Box, { children: _jsxs(Text, { color: createFocus === "notes" ? "green" : "white", children: [createFocus === "notes" ? "▸" : " ", " Notas: ", createNotes || "(opcional)", createFocus === "notes" ? "▌" : ""] }) }), _jsx(Box, { marginTop: 1, children: _jsx(Text, { dimColor: true, children: "Enter: siguiente campo / confirmar \u2022 Tab: cambiar campo \u2022 Esc: cancelar" }) })] })), mode === "edit" && (_jsxs(Box, { flexDirection: "column", borderStyle: "bold", borderColor: "yellow", padding: 1, marginTop: 1, children: [_jsx(Text, { bold: true, color: "yellow", children: "Editar tarea" }), _jsx(Box, { marginTop: 1, children: _jsxs(Text, { color: editFocus === "title" ? "yellow" : "white", children: [editFocus === "title" ? "▸" : " ", " T\u00EDtulo: ", editTitle, editFocus === "title" ? "▌" : ""] }) }), _jsx(Box, { children: _jsxs(Text, { color: editFocus === "notes" ? "yellow" : "white", children: [editFocus === "notes" ? "▸" : " ", " Notas: ", editNotes || "(opcional)", editFocus === "notes" ? "▌" : ""] }) }), _jsx(Box, { marginTop: 1, children: _jsx(Text, { dimColor: true, children: "Enter: siguiente campo / confirmar \u2022 Tab: cambiar campo \u2022 Esc: cancelar" }) })] })), message && (_jsx(Box, { marginTop: 1, children: _jsx(Text, { color: "green", children: message }) })), _jsx(Box, { marginTop: 1, children: _jsx(Text, { dimColor: true, children: mode === "create" ? (_jsx(Text, { color: "cyan", children: "Creando tarea..._" })) : (_jsxs(Text, { children: ["[", activeListIndex + 1, "/", groups.length, "] ", currentTasks.length > 0 ? `[${activeTaskIndex + 1}/${currentTasks.length}]` : ""] })) }) })] }));
};
render(_jsx(App, {}));
