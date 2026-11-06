import { afterEach, describe, expect, it, vi } from "vitest";
import { canWebGL } from "./renderer";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("canWebGL", () => {
  it("is false when the browser gives no WebGL context", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    expect(canWebGL()).toBe(false);
  });

  it("is true with a WebGL2 or a WebGL1 context", () => {
    const context = {} as WebGL2RenderingContext;
    const spy = vi.spyOn(HTMLCanvasElement.prototype, "getContext");
    spy.mockImplementation((id: string) => (id === "webgl2" ? context : null) as never);
    expect(canWebGL()).toBe(true);
    spy.mockImplementation((id: string) => (id === "webgl" ? context : null) as never);
    expect(canWebGL()).toBe(true);
  });

  it("is false when asking throws", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(canWebGL()).toBe(false);
  });
});
