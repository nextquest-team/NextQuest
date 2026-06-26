import { describe, it, expect, vi } from "vitest";
import { fetchAcclaimedByGenres } from "../igdb.client.js";

describe("fetchAcclaimedByGenres", () => {
  it("interroge les jeux sortis, bien notés, des genres donnés", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [
        {
          id: 1,
          name: "Divinity OS2",
          genres: [{ id: 12 }],
          rating: 92,
          rating_count: 5000,
        },
      ],
    });
    vi.stubGlobal("fetch", fetchMock);
    const res = await fetchAcclaimedByGenres([12], 1_700_000_000, "tok", "cid");
    expect(res.length).toBe(1);
    const body = fetchMock.mock.calls[0][1].body as string;
    expect(body).toContain("genres = (12)");
    expect(body).toContain("first_release_date <"); // déjà sorti
    expect(body).toContain("rating_count >"); // assez de votes
    vi.unstubAllGlobals();
  });
});
