# Mosaic

A modern resume builder built with React and TypeScript.

## Tech Stack

- **Framework:** React 19 + TypeScript
- **Build:** Vite
- **Styling:** Tailwind CSS 4
- **UI Components:** Radix UI + shadcn/ui
- **State Management:** Zustand

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Scripts

| Command           | Description                         |
| ----------------- | ----------------------------------- |
| `npm run dev`     | Start dev server                    |
| `npm run build`   | Type-check and build for production |
| `npm run preview` | Preview production build            |
| `npm run lint`    | Run ESLint                          |

## Commit Conventions

This project uses [Conventional Commits](https://www.conventionalcommits.org/). Commits are enforced via `commitlint` and a Husky `commit-msg` hook.

```
feat: add resume preview panel
fix: correct date formatting in experience section
docs: update README
```

A `pre-commit` hook runs ESLint and Prettier on staged files via `lint-staged`.
