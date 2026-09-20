declare module 'canvas-confetti';

// canvas-confetti's UMD source file (resolved as this package's "main" entry,
// since it ships no bundled type declarations) references the CommonJS
// `module` global — declare it minimally rather than pulling in all of
// @types/node's globals (which cascades into unrelated node_modules type
// errors, e.g. inside the `punycode` package).
declare const module: { exports: any };
