export type Renderer = "canvas" | "webgl";

/** Whether this browser can make a WebGL context. Software-only setups answer yes, so the GPU option stays a choice. */
export const canWebGL = (): boolean => {
  try {
    const canvas = document.createElement("canvas");
    return !!(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
};
