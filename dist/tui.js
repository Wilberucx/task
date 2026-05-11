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
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [mode, setMode] = useState("normal");
    const [command, setCommand] = useState("");
    const [message, setMessage] = useState("");
    const flatTasks = [];
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
        }
        catch (e) {
            setMessage(`Error: ${e instanceof Error ? e.message : e}`);
        }
        setLoading(false);
    };
    const getPosition = () => {
        if (flatTasks.length === 0)
            return { list: "", task: "" };
        const current = flatTasks[selectedIndex];
        return { list: current.listId, task: current.task.id };
    };
    useInput((input, key) => {
        if (mode === "command") {
            if (key.return) {
                executeCommand(command);
                setCommand("");
                setMode("normal");
            }
            else if (key.escape) {
                setCommand("");
                setMode("normal");
            }
            else if (key.backspace) {
                setCommand((c) => c.slice(0, -1));
            }
            else {
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
    const executeCommand = async (cmd) => {
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
                }
                else {
                    setMessage(`Lista no encontrada: ${listName}`);
                }
            }
            else {
                setMessage('Uso: :create "Lista" "Título" "Notas"');
            }
        }
        else {
            setMessage("Comando desconocido");
        }
    };
    if (loading) {
        return _jsx(Text, { children: "Cargando..." });
    }
    return (_jsxs(Box, { flexDirection: "column", height: process.stdout.rows - 2, children: [_jsxs(Box, { borderStyle: "bold", borderColor: "cyan", flexDirection: "column", padding: 1, children: [_jsx(Text, { bold: true, children: "\uD83D\uDCCB Tasks" }), _jsx(Text, { dimColor: true, children: "  j/k: move \u2022 Enter: complete \u2022 d: delete \u2022 r: refresh \u2022 c: create \u2022 q: quit" })] }), _jsxs(Box, { flexDirection: "column", overflow: "hidden", children: [groups.map((group) => (_jsxs(Box, { flexDirection: "column", marginY: 0, children: [_jsxs(Text, { bold: true, color: "yellow", children: ["# ", group.listTitle] }), group.tasks.map((task) => {
                                const idx = flatTasks.findIndex((t) => t.task.id === task.id);
                                const isSelected = idx === selectedIndex;
                                return (_jsxs(Text, { color: isSelected ? "green" : "white", bold: isSelected, children: [isSelected ? "▶ " : "  ", task.title] }, task.id));
                            })] }, group.listId))), flatTasks.length === 0 && (_jsx(Text, { dimColor: true, children: "No hay tareas pendientes" }))] }), message && (_jsx(Box, { marginTop: 1, children: _jsx(Text, { color: "green", children: message }) })), _jsx(Box, { marginTop: 1, children: _jsx(Text, { dimColor: true, children: mode === "command" ? (_jsxs(Text, { color: "cyan", children: [command, "_"] })) : (_jsxs(Text, { children: ["[", selectedIndex + 1, "/", flatTasks.length, "]"] })) }) })] }));
};
render(_jsx(App, {}));
