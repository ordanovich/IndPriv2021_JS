// Build-time flag. Toggled to true by the `build-demo-dist` gulp task before
// running the production build, and restored to false afterwards. Used by
// index.js to choose the runtime config URL and by UserInterface.jsx to
// surface the demo banner.
export const DEMO_MODE = false;
