import { describe, it, expect, beforeEach } from "vitest";
import { db, users, games } from "@nextquest/db";
import { searchGames } from "../games.service.js";

async function cleanup() {
  // Supprimer games cascade les liaisons (game_genres/tags/similar) et user_games.
  await db.delete(games);
  await db.delete(users);
}
beforeEach(cleanup);

describe("searchGames", () => {
  it("matche par titre (insensible a la casse) et renvoie total", async () => {
    const [u] = await db
      .insert(users)
      .values({ email: "s@test.com", username: "s", passwordHash: "x" })
      .returning({ id: users.id });
    await db
      .insert(games)
      .values({ title: "Hollow Knight", slug: "hk-2", visibility: "public", igdbId: 1 });
    await db
      .insert(games)
      .values({ title: "Celeste", slug: "celeste-2", visibility: "public" });
    const res = await searchGames({ userId: u.id, search: "hollow", limit: 20, offset: 0 });
    expect(res.total).toBe(1);
    expect(res.items[0].title).toBe("Hollow Knight");
    expect(res.items[0].isEnriched).toBe(true);
  });
  it("ne renvoie pas les jeux custom prives d'un autre user", async () => {
    const [u] = await db
      .insert(users)
      .values({ email: "s2@test.com", username: "s2", passwordHash: "x" })
      .returning({ id: users.id });
    const [other] = await db
      .insert(users)
      .values({ email: "s3@test.com", username: "s3", passwordHash: "x" })
      .returning({ id: users.id });
    await db.insert(games).values({
      title: "Secret Game",
      slug: "secret-1",
      visibility: "private",
      isCustom: true,
      createdBy: other.id,
    });
    const res = await searchGames({ userId: u.id, search: "secret", limit: 20, offset: 0 });
    expect(res.total).toBe(0);
  });
  it("trouve un jeu catalogue non-custom meme en visibilite par defaut (privee)", async () => {
    const [u] = await db
      .insert(users)
      .values({ email: "s4@test.com", username: "s4", passwordHash: "x" })
      .returning({ id: users.id });
    // Jeu importe (Steam/IGDB) : isCustom=false, visibility par defaut (private),
    // createdBy null. Doit rester cherchable par tout le monde (catalogue partage).
    await db.insert(games).values({ title: "Warhammer Catalogue", slug: "whc-1" });
    const res = await searchGames({ userId: u.id, search: "warhammer", limit: 20, offset: 0 });
    expect(res.total).toBe(1);
  });
});
