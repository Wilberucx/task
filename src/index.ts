#!/usr/bin/env node
import { spawnSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);

if (args.length === 0) {
  // Sin argumentos: TUI
  // El archivo TUI se compilaba como parte de src/tui.tsx
  // Para un binario único, consolidaremos la lógica.
  // Como ya tengo src/cli.ts y src/tui.tsx, 
  // una estrategia rápida es ejecutar el componente TUI.
  
  // Por ahora, llamamos al ejecutable tui si existe, o importamos la lógica.
  // Dado que ambos son scripts, el enfoque más limpio es consolidar:
  import("./tui.js");
} else {
  // Con argumentos: CLI
  import("./cli.js");
}
