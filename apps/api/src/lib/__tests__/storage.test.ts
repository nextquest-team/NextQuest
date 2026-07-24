import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const sendMock = vi.fn();
vi.mock("@aws-sdk/client-s3", () => {
  class FakeCommand {
    constructor(public input: Record<string, unknown>) {}
  }
  return {
    // Fonction classique (pas une arrow function) : vitest 4 invoque
    // l'implementation via Reflect.construct quand le mock est appele avec
    // `new` (cf. storage.ts qui fait `new S3Client(...)` comme le vrai SDK) ;
    // une arrow function n'est pas constructible et ferait echouer l'appel.
    S3Client: vi.fn(function () {
      return { send: sendMock };
    }),
    PutObjectCommand: class extends FakeCommand {},
    DeleteObjectCommand: class extends FakeCommand {},
    HeadBucketCommand: class extends FakeCommand {},
    CreateBucketCommand: class extends FakeCommand {},
    PutBucketPolicyCommand: class extends FakeCommand {},
  };
});

import {
  PutObjectCommand,
  DeleteObjectCommand,
  CreateBucketCommand,
  PutBucketPolicyCommand,
} from "@aws-sdk/client-s3";
import {
  isStorageConfigured,
  ensureBucket,
  putAvatar,
  deleteAvatar,
  purgeUserStorage,
  StorageError,
  __resetStorageForTests,
} from "../storage.js";

const S3_VARS: Record<string, string> = {
  S3_ENDPOINT: "http://127.0.0.1:9000",
  S3_ACCESS_KEY: "test-key",
  S3_SECRET_KEY: "test-secret",
  S3_BUCKET: "test-avatars",
  S3_PUBLIC_URL: "http://127.0.0.1:9000/test-avatars",
};

beforeEach(() => {
  Object.assign(process.env, S3_VARS);
  sendMock.mockReset().mockResolvedValue({});
  __resetStorageForTests();
});

afterEach(() => {
  for (const k of Object.keys(S3_VARS)) delete process.env[k];
});

function sentCommands() {
  return sendMock.mock.calls.map(([cmd]) => cmd);
}

describe("isStorageConfigured", () => {
  it("false si une variable S3 manque", () => {
    delete process.env.S3_ENDPOINT;
    expect(isStorageConfigured()).toBe(false);
  });
  it("true quand tout est pose", () => {
    expect(isStorageConfigured()).toBe(true);
  });
});

describe("ensureBucket", () => {
  it("ne cree rien si le bucket existe (HeadBucket ok)", async () => {
    await ensureBucket();
    expect(sentCommands().some((c) => c instanceof CreateBucketCommand)).toBe(false);
  });

  it("cree le bucket + policy lecture publique si absent", async () => {
    // Le SDK S3 signale un bucket absent par une erreur nommee NotFound (404)
    const notFound = Object.assign(new Error("bucket absent"), { name: "NotFound" });
    sendMock.mockRejectedValueOnce(notFound).mockResolvedValue({});
    await ensureBucket();
    const cmds = sentCommands();
    expect(cmds.some((c) => c instanceof CreateBucketCommand)).toBe(true);
    const policy = cmds.find((c) => c instanceof PutBucketPolicyCommand);
    expect(policy).toBeDefined();
    expect(String(policy!.input.Policy)).toContain("s3:GetObject");
  });

  it("se re-tente apres un echec d'init (pas de memoisation de l'erreur)", async () => {
    sendMock.mockRejectedValue(new Error("ECONNREFUSED"));
    await expect(ensureBucket()).rejects.toBeInstanceOf(StorageError);
    // Une erreur non-404 ne doit PAS declencher de tentative de creation
    expect(sentCommands().some((c) => c instanceof CreateBucketCommand)).toBe(false);
    sendMock.mockReset().mockResolvedValue({});
    await expect(ensureBucket()).resolves.toBeUndefined();
  });
});

describe("putAvatar", () => {
  it("ecrit sous la cle fixe et renvoie l'URL publique avec cache-buster", async () => {
    const url = await putAvatar("user-123", Buffer.from("webp-bytes"));
    const put = sentCommands().find((c) => c instanceof PutObjectCommand);
    expect(put!.input.Key).toBe("avatars/user-123.webp");
    expect(put!.input.Bucket).toBe("test-avatars");
    expect(put!.input.ContentType).toBe("image/webp");
    expect(url).toMatch(
      /^http:\/\/127\.0\.0\.1:9000\/test-avatars\/avatars\/user-123\.webp\?v=\d+$/,
    );
  });

  it("wrappe les erreurs SDK en StorageError", async () => {
    // HeadBucket (ensureBucket) passe, PutObject echoue
    sendMock.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error("boom"));
    await expect(putAvatar("user-123", Buffer.from("x"))).rejects.toBeInstanceOf(StorageError);
  });
});

describe("deleteAvatar / purgeUserStorage", () => {
  it("supprime la cle avatar du user", async () => {
    await deleteAvatar("user-123");
    const del = sentCommands().find((c) => c instanceof DeleteObjectCommand);
    expect(del!.input.Key).toBe("avatars/user-123.webp");
  });

  it("purgeUserStorage supprime les objets du user", async () => {
    await purgeUserStorage("user-123");
    expect(sentCommands().some((c) => c instanceof DeleteObjectCommand)).toBe(true);
  });

  it("StorageError explicite quand le storage n'est pas configure", async () => {
    delete process.env.S3_ENDPOINT;
    await expect(putAvatar("u", Buffer.from("x"))).rejects.toBeInstanceOf(StorageError);
  });
});
