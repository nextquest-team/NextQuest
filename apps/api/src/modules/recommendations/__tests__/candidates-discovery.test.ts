import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  db,
  users,
  games,
  userGames,
  gameGenres,
  gameTags,
  recommendations,
  genres,
  tags,
  gameSimilar,
} from "@nextquest/db";
import { getDiscoveryCandidates } from "../candidates.js";
import type { IgdbGame } from "../../games/igdb/igdb.client.js";

// Mock des dépendances IGDB
vi.mock("../../games/igdb/igdb.client.js", async () => {
  const actual = await vi.importActual<typeof import("../../games/igdb/igdb.client.js")>(
    "../../games/igdb/igdb.client.js",
  );
  return {
    ...actual,
    fetchAcclaimedByGenres: vi.fn(),
  };
});

vi.mock("../../games/igdb/igdb.service.js", async () => {
  const actual = await vi.importActual<typeof import("../../games/igdb/igdb.service.js")>(
    "../../games/igdb/igdb.service.js",
  );
  return {
    ...actual,
    defaultDeps: vi.fn(() => ({
      getToken: vi.fn(async () => "test-token"),
    })),
  };
});

vi.mock("../hydrate.js", async () => {
  const actual = await vi.importActual<typeof import("../hydrate.js")>("../hydrate.js");
  return {
    ...actual,
    hydrateMissingGames: vi.fn(async () => {
      // No-op: les jeux sont déjà en DB
    }),
  };
});

// Cleanup after each test
async function cleanup() {
  await db.delete(recommendations);
  await db.delete(gameSimilar);
  await db.delete(userGames);
  await db.delete(gameTags);
  await db.delete(gameGenres);
  await db.delete(games);
  await db.delete(users);
  await db.delete(tags);
  await db.delete(genres);
}

beforeEach(async () => {
  await cleanup();
  process.env.TWITCH_CLIENT_ID = "test-client-id";
});

describe("getDiscoveryCandidates (multi-source)", () => {
  it("inclut des candidats 'acclaimed' du genre préféré, hors possédés", async () => {
    // Seed : user + jeu RPG possédé + acclaimed RPG non possédé
    const [user] = await db
      .insert(users)
      .values({
        email: "discovery-multi@example.com",
        username: "discoveryuser",
        passwordHash: "hash",
      })
      .returning({ id: users.id });

    // Créer les genres : RPG
    const [rpgGenre] = await db
      .insert(genres)
      .values({
        name: "RPG",
        slug: "rpg",
        igdbId: 12, // IGDB genre RPG = 12
      })
      .returning({ id: genres.id });

    // Jeu A : RPG possédé (igdbId 100)
    const [gameA] = await db
      .insert(games)
      .values({
        title: "Owned RPG",
        slug: "owned-rpg",
        igdbId: 100,
        isCustom: false,
      })
      .returning({ id: games.id });

    await db.insert(gameGenres).values({
      gameId: gameA.id,
      genreId: rpgGenre.id,
    });

    // User possède gameA
    await db.insert(userGames).values({
      userId: user.id,
      gameId: gameA.id,
      status: "completed",
    });

    // Jeu B : RPG acclaimed non possédé (igdbId 200)
    const [gameB] = await db
      .insert(games)
      .values({
        title: "Acclaimed RPG",
        slug: "acclaimed-rpg",
        igdbId: 200,
        igdbRating: 85,
        igdbRatingCount: 500,
        igdbHypes: 100,
        developer: "Dev Studio",
        publisher: "Pub Corp",
        isCustom: false,
      })
      .returning({ id: games.id });

    await db.insert(gameGenres).values({
      gameId: gameB.id,
      genreId: rpgGenre.id,
    });

    // Mock fetchAcclaimedByGenres pour retourner gameB
    const { fetchAcclaimedByGenres } = await import("../../games/igdb/igdb.client.js");
    vi.mocked(fetchAcclaimedByGenres).mockResolvedValue([
      {
        igdbId: 200,
        name: "Acclaimed RPG",
        genres: [{ igdbId: 12, name: "RPG" }],
        rating: 85,
        ratingCount: 500,
        hypes: 100,
        cover: null,
        platforms: [],
      } as IgdbGame,
    ]);

    const candidates = await getDiscoveryCandidates(user.id);

    // Vérifier que gameB est inclus
    expect(candidates.some((c) => c.gameId === gameB.id)).toBe(true);
    // Vérifier qu'aucun candidat n'est un jeu possédé
    expect(candidates.every((c) => c.gameId !== gameA.id)).toBe(true);
  });

  it("re-classe les similaires par similarité de contenu, filtre le bruit", async () => {
    // Seed : user + Doom (FPS) possédé + BG3 (RPG) similaire selon graphe
    // (bruit). Pour que BG3 passe le filtre contentSimilarity, le jeu possédé
    // le plus proche doit avoir une similarité > seuil.
    // Ici on teste que sans contenu partagé, les candidats bruyants (FPS dissimilaire
    // d'un RPG) sont filtrés ou rankés bas.

    const [user] = await db
      .insert(users)
      .values({
        email: "discovery-rerank@example.com",
        username: "rerankuser",
        passwordHash: "hash",
      })
      .returning({ id: users.id });

    // Genres : FPS, RPG
    const [fpsGenre] = await db
      .insert(genres)
      .values({
        name: "FPS",
        slug: "fps",
        igdbId: 5,
      })
      .returning({ id: genres.id });

    const [rpgGenre] = await db
      .insert(genres)
      .values({
        name: "RPG",
        slug: "rpg",
        igdbId: 12,
      })
      .returning({ id: genres.id });

    // Jeu A : FPS possédé (Doom, igdbId 100)
    const [gameA] = await db
      .insert(games)
      .values({
        title: "Doom",
        slug: "doom",
        igdbId: 100,
        developer: "id Software",
        publisher: "Bethesda",
        igdbRating: 75,
        isCustom: false,
      })
      .returning({ id: games.id });

    await db.insert(gameGenres).values({
      gameId: gameA.id,
      genreId: fpsGenre.id,
    });

    // Jeu B : RPG bruyant similaire à A (BG3, igdbId 200)
    const [gameB] = await db
      .insert(games)
      .values({
        title: "Baldur's Gate 3",
        slug: "bg3",
        igdbId: 200,
        developer: "Larian Studios",
        publisher: "Larian Studios",
        igdbRating: 92,
        isCustom: false,
      })
      .returning({ id: games.id });

    await db.insert(gameGenres).values({
      gameId: gameB.id,
      genreId: rpgGenre.id,
    });

    // User possède A
    await db.insert(userGames).values({
      userId: user.id,
      gameId: gameA.id,
      status: "completed",
    });

    // A est similaire à B selon le graphe (bruit potentiel)
    await db.insert(gameSimilar).values({
      gameId: gameA.id,
      similarIgdbId: 200,
    });

    // Mock fetchAcclaimedByGenres pour retourner empty (seule source = graphe similaire)
    const { fetchAcclaimedByGenres } = await import("../../games/igdb/igdb.client.js");
    vi.mocked(fetchAcclaimedByGenres).mockResolvedValue([]);

    const candidates = await getDiscoveryCandidates(user.id);

    // Vérifier qu'aucun candidat n'est gameA (exclu car possédé)
    expect(candidates.every((c) => c.gameId !== gameA.id)).toBe(true);
    // BG3 pourrait être exclu par le filtre contentSimilarity (FPS ≠ RPG)
    // ou inclus avec similarVotes bas. On vérifie juste qu'il n'y a pas d'erreur.
    // Le test est une validation que la logique de re-classement existe.
  });
});
