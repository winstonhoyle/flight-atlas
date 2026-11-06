import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as renderer from "@/utils/renderer";
import { useRenderer } from "./useRenderer";

const memoryStorage = () => {
  const items = new Map<string, string>();
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
  };
};

beforeEach(() => {
  vi.stubGlobal("localStorage", memoryStorage());
  vi.spyOn(renderer, "canWebGL").mockReturnValue(true);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("useRenderer", () => {
  it("starts on canvas", () => {
    expect(renderHook(() => useRenderer()).result.current[0]).toBe("canvas");
  });

  it("remembers the GPU choice", () => {
    const first = renderHook(() => useRenderer());
    act(() => first.result.current[1]("webgl"));
    expect(first.result.current[0]).toBe("webgl");
    expect(renderHook(() => useRenderer()).result.current[0]).toBe("webgl");
  });

  it("uses canvas when a saved GPU choice can't run here", () => {
    localStorage.setItem("renderer", "webgl");
    vi.spyOn(renderer, "canWebGL").mockReturnValue(false);
    expect(renderHook(() => useRenderer()).result.current[0]).toBe("canvas");
  });
});
