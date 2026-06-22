// Les enums PostgreSQL garantissent l'integrite des donnees directement en BDD,
// pas seulement cote appli -- si quelqu'un tape du SQL a la main, c'est toujours protege
import { pgEnum } from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role_enum", ["user", "admin"]);

export const visibilityEnum = pgEnum("visibility_enum", [
  "private",
  "friends_only",
  "public",
]);

export const releaseStatusEnum = pgEnum("release_status_enum", [
  "released",
  "upcoming",
  "early_access",
  "rumored",
  "cancelled",
]);

export const gameStatusEnum = pgEnum("game_status_enum", [
  "wishlist",
  "backlog",
  "playing",
  "completed",
  "abandoned",
]);

export const friendshipStatusEnum = pgEnum("friendship_status_enum", [
  "pending",
  "accepted",
  "blocked",
]);

export const verificationTokenTypeEnum = pgEnum(
  "verification_token_type_enum",
  ["email_verification", "password_reset"],
);

export const consentTypeEnum = pgEnum("consent_type_enum", [
  "terms_of_service",
  "privacy_policy",
  "data_processing",
  "marketing",
]);

export const reportStatusEnum = pgEnum("report_status_enum", [
  "pending",
  "reviewed",
  "resolved",
  "dismissed",
]);

export const conversationTypeEnum = pgEnum("conversation_type_enum", [
  "direct",
  "group",
]);

export const conversationRoleEnum = pgEnum("conversation_role_enum", [
  "member",
  "admin",
]);

export const gameUpdateSourceEnum = pgEnum("game_update_source_enum", [
  "igdb",
  "rawg",
  "scraper",
  "manual",
]);

export const gdprRequestTypeEnum = pgEnum("gdpr_request_type_enum", [
  "access",
  "rectification",
  "erasure",
  "portability",
  "opposition",
]);

export const gdprRequestStatusEnum = pgEnum("gdpr_request_status_enum", [
  "pending",
  "processing",
  "completed",
  "rejected",
]);

export const notificationTypeEnum = pgEnum("notification_type_enum", [
  "friend_request",
  "friend_accepted",
  "game_release",
  "game_update",
  "message_received",
  "achievement_unlocked",
  "recommendation",
  "system",
]);

export const activityTypeEnum = pgEnum("activity_type_enum", [
  "game_added",
  "game_status_changed",
  "game_completed",
  "game_rated",
  "game_reviewed",
  "achievement_unlocked",
  "badge_earned",
  "friend_added",
]);

export const devicePlatformEnum = pgEnum("device_platform_enum", [
  "ios",
  "android",
]);

export const recommendationFeedbackEnum = pgEnum(
  "recommendation_feedback_enum",
  ["liked", "dismissed", "added"],
);

export const recommendationBucketEnum = pgEnum("recommendation_bucket_enum", [
  "library_unplayed", // jeu deja possede, pas encore joue
  "discovery", // jeu sorti, non possede
  "upcoming", // jeu pas encore sorti
]);
