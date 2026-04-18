// src/tests/setup.ts
// Pure logic tests — no DOM matchers needed.
// @testing-library/jest-dom is only needed for React component tests.

// Signal to React that we are in a test environment
// (suppresses act() warnings if any React code runs indirectly)
// @ts-expect-error — global augmentation for React test environment
global.IS_REACT_ACT_ENVIRONMENT = true;
