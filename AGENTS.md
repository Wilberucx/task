# task-cli

CLI y TUI para gestionar Google Tasks via `gws` CLI.

## Build

```bash
npm run build
```

## Tests

```bash
npm run test      # watch mode
npm run test:run  # single run
```

## CLI

```bash
node dist/cli.js list
node dist/cli.js lists
node dist/cli.js create "Lista" "Título" "notas"
node dist/cli.js complete "Lista" "Tarea"
node dist/cli.js delete "Lista" "Tarea"
node dist/cli.js show "Lista" "Tarea"
```

## TUI

```bash
npm run tui
```

Controles:
- `Tab` / `Shift+Tab` - navegar listas
- `j/k` - navegar tareas
- `g/G` - ir al inicio/fin
- `Enter` - completar tarea
- `d` - eliminar tarea
- `e` - editar tarea
- `a` - crear tarea (modal interactivo)
- `r` - refresh
- `q` - salir

## Notas

- El CLI busca tareas por título (no por ID)
- Las listas se referencian por nombre, no por ID
- El runner GwsRunner maneja respuestas vacías (ej: delete no devuelve JSON)