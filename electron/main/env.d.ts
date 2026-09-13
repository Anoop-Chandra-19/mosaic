/** Vite inlines `?raw` imports as strings — how migrations ship inside the main bundle. */
declare module '*.sql?raw' {
  const sql: string;
  export default sql;
}
