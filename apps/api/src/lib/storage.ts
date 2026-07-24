import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
  PutBucketPolicyCommand,
} from "@aws-sdk/client-s3";

// Erreur dediee : les routes la mappent sur un 503 propre au lieu de laisser
// fuiter une erreur SDK brute au client.
export class StorageError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "StorageError";
    this.cause = cause;
  }
}

// La config est lue a l'appel (pas a l'import) pour que les tests puissent
// poser/retirer les variables d'env librement.
function storageEnv() {
  const { S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY, S3_BUCKET, S3_PUBLIC_URL } =
    process.env;
  if (!S3_ENDPOINT || !S3_ACCESS_KEY || !S3_SECRET_KEY || !S3_BUCKET || !S3_PUBLIC_URL) {
    return null;
  }
  return {
    endpoint: S3_ENDPOINT,
    accessKey: S3_ACCESS_KEY,
    secretKey: S3_SECRET_KEY,
    bucket: S3_BUCKET,
    publicUrl: S3_PUBLIC_URL,
  };
}

export function isStorageConfigured(): boolean {
  return storageEnv() !== null;
}

let client: S3Client | null = null;

function getClient(): S3Client {
  const env = storageEnv();
  if (!env) {
    throw new StorageError("Stockage objet non configure (variables S3_* manquantes)");
  }
  if (!client) {
    client = new S3Client({
      endpoint: env.endpoint,
      // MinIO et les S3-compatibles auto-heberges ne supportent pas le
      // virtual-hosted-style (bucket.domaine) : path-style obligatoire.
      forcePathStyle: true,
      region: "us-east-1",
      credentials: {
        accessKeyId: env.accessKey,
        secretAccessKey: env.secretKey,
      },
    });
  }
  return client;
}

// Cree le bucket + policy lecture publique s'il n'existe pas. Memoise en cas
// de succes (pas un HeadBucket par upload) ; re-tente au prochain appel si
// l'init a echoue (ex: MinIO pas encore pret au boot de l'API).
let bucketReady: Promise<void> | null = null;

export function ensureBucket(): Promise<void> {
  if (!bucketReady) {
    bucketReady = initBucket().catch((err) => {
      bucketReady = null;
      throw err instanceof StorageError
        ? err
        : new StorageError("Initialisation du bucket impossible", err);
    });
  }
  return bucketReady;
}

async function initBucket(): Promise<void> {
  const env = storageEnv();
  if (!env) {
    throw new StorageError("Stockage objet non configure (variables S3_* manquantes)");
  }
  const s3 = getClient();
  try {
    await s3.send(new HeadBucketCommand({ Bucket: env.bucket }));
    return;
  } catch (err) {
    // On ne cree le bucket que si HeadBucket dit "absent" (404). Toute autre
    // erreur (reseau, credentials) doit remonter telle quelle : la masquer en
    // tentant un CreateBucket voue a l'echec brouillerait le diagnostic.
    const status = (err as { $metadata?: { httpStatusCode?: number } })?.$metadata
      ?.httpStatusCode;
    const notFound = (err instanceof Error && err.name === "NotFound") || status === 404;
    if (!notFound) {
      throw err;
    }
  }
  await s3.send(new CreateBucketCommand({ Bucket: env.bucket }));
  // Lecture publique : le front hotlinke les avatars comme les covers IGDB.
  await s3.send(
    new PutBucketPolicyCommand({
      Bucket: env.bucket,
      Policy: JSON.stringify({
        Version: "2012-10-17",
        Statement: [
          {
            Effect: "Allow",
            Principal: { AWS: ["*"] },
            Action: ["s3:GetObject"],
            Resource: [`arn:aws:s3:::${env.bucket}/*`],
          },
        ],
      }),
    }),
  );
}

function avatarKey(userId: string): string {
  return `avatars/${userId}.webp`;
}

// Ecrase la cle fixe du user (zero orphelin) et renvoie l'URL publique avec
// cache-buster ?v= : la cle ne change pas, seul le parametre invalide le
// cache navigateur.
export async function putAvatar(userId: string, body: Buffer): Promise<string> {
  const env = storageEnv();
  if (!env) {
    throw new StorageError("Stockage objet non configure (variables S3_* manquantes)");
  }
  await ensureBucket();
  try {
    await getClient().send(
      new PutObjectCommand({
        Bucket: env.bucket,
        Key: avatarKey(userId),
        Body: body,
        ContentType: "image/webp",
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );
  } catch (err) {
    throw new StorageError("Ecriture de l'avatar impossible", err);
  }
  return `${env.publicUrl}/${avatarKey(userId)}?v=${Date.now()}`;
}

export async function deleteAvatar(userId: string): Promise<void> {
  const env = storageEnv();
  if (!env) {
    throw new StorageError("Stockage objet non configure (variables S3_* manquantes)");
  }
  await ensureBucket();
  try {
    // DeleteObject est idempotent cote S3 : pas d'erreur si la cle n'existe pas.
    await getClient().send(
      new DeleteObjectCommand({ Bucket: env.bucket, Key: avatarKey(userId) }),
    );
  } catch (err) {
    throw new StorageError("Suppression de l'avatar impossible", err);
  }
}

// Purge RGPD : supprime TOUS les objets du user. La cascade Postgres ne
// couvre pas le bucket -- le futur hard delete de compte (DELETE /users/me)
// DOIT appeler cette fonction AVANT le DELETE FROM users. Voir la note
// d'architecture dans docs/database/schema.dbml.
export async function purgeUserStorage(userId: string): Promise<void> {
  // Aujourd'hui un user ne possede que son avatar ; etendre ici si d'autres
  // objets apparaissent (banniere, etc.).
  await deleteAvatar(userId);
}

// Reservee aux tests : reinitialise les singletons du module.
export function __resetStorageForTests(): void {
  client = null;
  bucketReady = null;
}
