# task-cli

CLI and TUI to manage Google Tasks via the `gws` CLI.

## Prerequisites

- Node.js 18+
- `gws` CLI installed — see <https://github.com/google-workspace/gws>
- Authentication configured: run `gws auth setup`

## Installation

```bash
git clone https://github.com/Wilberucx/task
npm install
npm run build:bin
```

## Usage

### List View

| Key       | Action                   |
| --------- | ------------------------ |
| Tab       | Switch task list         |
| Shift+Tab | Previous task list       |
| j / k     | Navigate tasks           |
| g / G     | Go to first/last task    |
| l         | Expand subtasks          |
| h         | Collapse subtasks        |
| Space     | Complete/uncomplete task |
| Enter     | View task details        |
| a         | Create task              |
| e         | Edit task                |
| d         | Delete task              |
| r         | Refresh                  |
| q         | Quit                     |

### Detail View

| Key | Action                              |
| --- | ----------------------------------- |
| Tab | Switch between Description/Subtasks |
| Esc | Back to list                        |
| q   | Quit                                |

## Responsive Mode

The TUI adapts to terminal width:

- **Large** (≥120 cols): Full ASCII art header + keybindings + list + detail panel
- **Medium** (≥80 cols): Keybindings only + list + detail panel
- **Small** (≥40 cols): Compact keybindings (`spc:done ret:detail...`) + list only
- **Tiny** (<40 cols): No header + list only

In Small/Tiny modes, press `Enter` on a task to view full details (the detail view always shows regardless of breakpoint).

## Architecture

The project follows hexagonal architecture (ports and adapters):

- **Domain**: pure business logic in `src/domain/`
- **Ports**: interfaces in `src/ports/` that define how the domain interacts with the outside world
- **Infrastructure**: adapters that implement those ports, such as `GwsTaskRepository` which talks to the `gws` CLI
- **Application layer**: services that orchestrate use cases (`src/application/`)
- **TUI**: React-based terminal UI that consumes the application layer — this front-end is interchangeable, allowing the same core to power both CLI and TUI interfaces

