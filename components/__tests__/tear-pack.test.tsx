import React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TearPack } from "../tear-pack";

vi.mock("gsap", () => ({ default: { to: vi.fn(), killTweensOf: vi.fn() } }));
afterEach(cleanup);

function pointer(target: Element, type: string, x: number, y = 50) {
  fireEvent(
    target,
    Object.assign(new Event(type, { bubbles: true }), {
      pointerId: 1,
      pointerType: "touch",
      isPrimary: true,
      button: 0,
      clientX: x,
      clientY: y,
    }),
  );
}
function pack() {
  const open = vi.fn();
  render(
    <TearPack label="Open preview" onOpen={open} reducedMotion>
      <span>Artwork</span>
    </TearPack>,
  );
  const surface = screen.getByRole("button", { name: "Open preview" });
  Object.assign(surface, {
    setPointerCapture: vi.fn(),
    hasPointerCapture: () => true,
    releasePointerCapture: vi.fn(),
  });
  vi.spyOn(surface, "getBoundingClientRect").mockReturnValue({
    width: 214,
  } as DOMRect);
  return { open, surface, art: screen.getByText("Artwork") };
}
describe("pack touch capture", () => {
  it("finishes a tear after implicit child capture transfers to the surface", () => {
    const { surface, art, open } = pack();
    act(() => {
      pointer(art, "pointerdown", 20);
      pointer(surface, "pointermove", 55);
      pointer(art, "lostpointercapture", 55);
      pointer(surface, "pointermove", 150);
      pointer(surface, "pointerup", 150);
    });
    expect(open).toHaveBeenCalledOnce();
  });
  it("cancels when the surface itself loses capture", () => {
    const { surface, art, open } = pack();
    act(() => {
      pointer(art, "pointerdown", 20);
      pointer(surface, "pointermove", 55);
      pointer(surface, "lostpointercapture", 55);
      pointer(surface, "pointerup", 150);
    });
    expect(open).not.toHaveBeenCalled();
  });
  it("keeps a vertical scroll gesture from opening the pack", () => {
    const { surface, art, open } = pack();
    act(() => {
      pointer(art, "pointerdown", 20);
      pointer(surface, "pointermove", 23, 90);
      pointer(surface, "pointerup", 150, 90);
    });
    expect(open).not.toHaveBeenCalled();
  });
});
