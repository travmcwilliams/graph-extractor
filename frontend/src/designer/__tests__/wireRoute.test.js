import { describe, it, expect } from "vitest";
import { wireRoute, routeMidpoint } from "../circuitState";

describe("wireRoute", () => {
  it("keeps horizontally aligned wires straight", () => {
    expect(wireRoute([0, 10, 100, 10])).toEqual([0, 10, 100, 10]);
  });

  it("keeps vertically aligned wires straight", () => {
    expect(wireRoute([5, 0, 5, 80])).toEqual([5, 0, 5, 80]);
  });

  it("routes unaligned wires horizontal-then-vertical", () => {
    expect(wireRoute([0, 0, 100, 40])).toEqual([0, 0, 100, 0, 100, 40]);
  });
});

describe("routeMidpoint", () => {
  it("returns the chord midpoint for a straight wire", () => {
    expect(routeMidpoint([0, 0, 100, 0])).toEqual({ x: 50, y: 0 });
  });

  it("lands on the wire for an L-shaped route, not the off-wire chord midpoint", () => {
    // Path length 100 + 40 = 140; halfway is 70 along the first (horizontal) leg.
    const mid = routeMidpoint(wireRoute([0, 0, 100, 40]));
    expect(mid).toEqual({ x: 70, y: 0 });
  });

  it("handles a midpoint falling on the second leg", () => {
    // Path length 20 + 100 = 120; halfway is 60 -> 40 down the vertical leg.
    const mid = routeMidpoint(wireRoute([0, 0, 20, 100]));
    expect(mid).toEqual({ x: 20, y: 40 });
  });

  it("handles zero-length wires", () => {
    expect(routeMidpoint([7, 7, 7, 7])).toEqual({ x: 7, y: 7 });
  });
});
