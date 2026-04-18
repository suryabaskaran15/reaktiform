// ─────────────────────────────────────────────────────────────
//  CSS MODULE DECLARATIONS
//  Tells TypeScript that importing CSS files is valid.
//  This eliminates the TS error:
//    "Cannot find module 'reaktiform/styles' or its corresponding
//     type declarations"
//  when consumers do: import 'reaktiform/styles'
// ─────────────────────────────────────────────────────────────

declare module "*.css" {
  const content: string;
  export default content;
}

// Explicit declaration for the package's own CSS subpath exports
declare module "reaktiform/styles" {
  const styles: string;
  export default styles;
}

declare module "reaktiform/cells/styles" {
  const styles: string;
  export default styles;
}
