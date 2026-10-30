/**
 * Ambient declarations for statically imported image assets.
 *
 * `next-env.d.ts` (which normally pulls in `next/image-types/global`) is
 * gitignored, so a fresh clone has no declarations until `next dev` or
 * `next build` runs. CI typechecks straight after checkout, which made
 * `import logo from "@/assets/brand/logo-mark.webp"` fail with TS2307.
 *
 * The type is referenced with an inline `import(...)` rather than a top-level
 * import on purpose: a top-level import would make this file a module, turning
 * `declare module "*.webp"` into a module augmentation that never matches an
 * import specifier, and the error would stay.
 */
declare module "*.webp" {
  const content: import("next/image").StaticImageData;

  export default content;
}
