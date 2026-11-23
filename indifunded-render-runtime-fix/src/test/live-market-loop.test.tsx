import { render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { api } from "@/lib/api";
import { useLiveMarketQuotes } from "@/lib/useLiveMarket";

function UnstableSymbolsConsumer({ onRender }: { onRender: () => void }) {
  onRender();
  const [tick, setTick] = useState(0);
  // Intentionally pass a fresh array literal on every render (like Terminal/Positions)
  const { quotes, loading } = useLiveMarketQuotes(["NIFTY", "BANKNIFTY"], {
    pollMs: 0,
    enabled: true,
  });
  return (
    <div data-testid="quotes-count" onClick={() => setTick((t) => t + 1)}>
      {loading ? "loading" : quotes.length}:{tick}
    </div>
  );
}

describe("useLiveMarketQuotes render stability", () => {
  it("does not exceed maximum update depth when caller passes a fresh array every render", async () => {
    const spy = vi.spyOn(api, "get").mockResolvedValue({
      data: {
        marketStatus: "CLOSED",
        fetchedAt: "2026-11-18T00:00:00Z",
        quotes: [
          { symbol: "NIFTY", ltp: 25450, changePct: 0.4, exchange: "NSE", kind: "INDEX" },
          { symbol: "BANKNIFTY", ltp: 62350, changePct: -0.2, exchange: "NSE", kind: "INDEX" },
        ],
      },
    } as never);

    let renders = 0;
    const { getByTestId } = render(<UnstableSymbolsConsumer onRender={() => renders++} />);

    await waitFor(() => {
      expect(getByTestId("quotes-count").textContent).toBe("2:0");
    });

    // Re-render again with a new array reference; cached quotes must not loop
    getByTestId("quotes-count").click();
    await waitFor(() => {
      expect(getByTestId("quotes-count").textContent).toBe("2:1");
    });

    expect(renders).toBeLessThan(10);
    spy.mockRestore();
  });
});
