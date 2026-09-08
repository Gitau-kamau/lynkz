import {
  pgTable,
  text,
  uuid,
  integer,
  boolean,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const ts = (name: string) => timestamp(name, { withTimezone: true });

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    username: text("username").notNull(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    displayName: text("display_name").notNull(),
    avatarUrl: text("avatar_url"),
    coverUrl: text("cover_url"),
    bio: text("bio").notNull().default(""),
    website: text("website").notNull().default(""),
    location: text("location").notNull().default(""),
    isPrivate: boolean("is_private").notNull().default(false),
    isVerified: boolean("is_verified").notNull().default(false),
    isAdmin: boolean("is_admin").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    isBanned: boolean("is_banned").notNull().default(false),
    interests: text("interests").array().notNull().default([]),
    prefs: jsonb("prefs").notNull().default({}),
    onboardingDone: boolean("onboarding_done").notNull().default(false),
    lastSeenAt: ts("last_seen_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("users_username_uq").on(t.username),
    uniqueIndex("users_email_uq").on(t.email),
    index("users_created_idx").on(t.createdAt),
  ]
);

export const sessions = pgTable(
  "sessions",
  {
    token: text("token").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: ts("expires_at").notNull(),
    userAgent: text("user_agent").notNull().default(""),
    ip: text("ip").notNull().default(""),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)]
);

export const resetTokens = pgTable("reset_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  expiresAt: ts("expires_at").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const follows = pgTable(
  "follows",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    followerId: uuid("follower_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    followingId: uuid("following_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("accepted"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("follows_uq").on(t.followerId, t.followingId),
    index("follows_following_idx").on(t.followingId),
  ]
);

export const posts = pgTable(
  "posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    content: text("content").notNull().default(""),
    location: text("location").notNull().default(""),
    visibility: text("visibility").notNull().default("everyone"),
    question: text("question").notNull().default(""),
    poll: jsonb("poll"),
    tags: text("tags").array().notNull().default([]),
    likeCount: integer("like_count").notNull().default(0),
    commentCount: integer("comment_count").notNull().default(0),
    repostCount: integer("repost_count").notNull().default(0),
    viewCount: integer("view_count").notNull().default(0),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
    deletedAt: ts("deleted_at"),
  },
  (t) => [
    index("posts_author_idx").on(t.authorId),
    index("posts_created_idx").on(t.createdAt),
  ]
);

export const postMedia = pgTable(
  "post_media",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    type: text("type").notNull().default("image"),
    position: integer("position").notNull().default(0),
  },
  (t) => [index("post_media_post_idx").on(t.postId)]
);

export const reposts = pgTable(
  "reposts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("reposts_uq").on(t.userId, t.postId),
    index("reposts_post_idx").on(t.postId),
  ]
);

export const postLikes = pgTable(
  "post_likes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("post_likes_uq").on(t.postId, t.userId),
    index("post_likes_user_idx").on(t.userId),
  ]
);

export const comments = pgTable(
  "comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    parentId: uuid("parent_id"),
    content: text("content").notNull(),
    likeCount: integer("like_count").notNull().default(0),
    createdAt: ts("created_at").notNull().defaultNow(),
    deletedAt: ts("deleted_at"),
  },
  (t) => [index("comments_post_idx").on(t.postId)]
);

export const commentLikes = pgTable(
  "comment_likes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    commentId: uuid("comment_id")
      .notNull()
      .references(() => comments.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("comment_likes_uq").on(t.commentId, t.userId)]
);

export const savedPosts = pgTable(
  "saved_posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    collectionId: uuid("collection_id"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("saved_posts_uq").on(t.userId, t.postId),
    index("saved_posts_user_idx").on(t.userId),
  ]
);

export const collections = pgTable(
  "collections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("collections_uq").on(t.userId, t.name)]
);

export const pollVotes = pgTable(
  "poll_votes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    option: integer("option").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("poll_votes_uq").on(t.postId, t.userId)]
);

export const hashtags = pgTable(
  "hashtags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    postCount: integer("post_count").notNull().default(0),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("hashtags_name_uq").on(t.name)]
);

export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    typing: jsonb("typing").notNull().default({}),
    lastMessageAt: ts("last_message_at").notNull().defaultNow(),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("conversations_last_idx").on(t.lastMessageAt)]
);

export const conversationMembers = pgTable(
  "conversation_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    unreadCount: integer("unread_count").notNull().default(0),
    lastReadAt: ts("last_read_at").notNull().defaultNow(),
    muted: boolean("muted").notNull().default(false),
  },
  (t) => [
    uniqueIndex("conv_members_uq").on(t.conversationId, t.userId),
    index("conv_members_user_idx").on(t.userId),
  ]
);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    senderId: uuid("sender_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    content: text("content").notNull().default(""),
    mediaUrl: text("media_url"),
    replyToId: uuid("reply_to_id"),
    isRead: boolean("is_read").notNull().default(false),
    deletedAt: ts("deleted_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("messages_conv_idx").on(t.conversationId, t.createdAt),
    index("messages_sender_idx").on(t.senderId),
  ]
);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    actorId: uuid("actor_id"),
    type: text("type").notNull(),
    postId: uuid("post_id"),
    roomId: uuid("room_id"),
    lynkId: uuid("lynk_id"),
    dropId: uuid("drop_id"),
    text: text("text").notNull().default(""),
    isRead: boolean("is_read").notNull().default(false),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("notifications_user_idx").on(t.userId, t.createdAt),
    index("notifications_unread_idx").on(t.userId, t.isRead),
  ]
);

export const lynks = pgTable(
  "lynks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull().default("text"),
    content: text("content").notNull().default(""),
    mediaUrl: text("media_url"),
    poll: jsonb("poll"),
    music: jsonb("music"),
    viewCount: integer("view_count").notNull().default(0),
    reactionCount: integer("reaction_count").notNull().default(0),
    replyCount: integer("reply_count").notNull().default(0),
    expiresAt: ts("expires_at").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
    deletedAt: ts("deleted_at"),
  },
  (t) => [
    index("lynks_user_idx").on(t.userId),
    index("lynks_expires_idx").on(t.expiresAt),
  ]
);

export const lynkViews = pgTable(
  "lynk_views",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lynkId: uuid("lynk_id")
      .notNull()
      .references(() => lynks.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("lynk_views_uq").on(t.lynkId, t.userId)]
);

export const lynkReactions = pgTable(
  "lynk_reactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lynkId: uuid("lynk_id")
      .notNull()
      .references(() => lynks.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    emoji: text("emoji").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("lynk_reactions_uq").on(t.lynkId, t.userId)]
);

export const lynkReplies = pgTable(
  "lynk_replies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lynkId: uuid("lynk_id")
      .notNull()
      .references(() => lynks.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("lynk_replies_lynk_idx").on(t.lynkId)]
);

export const rooms = pgTable(
  "rooms",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    category: text("category").notNull().default("Local"),
    creatorId: uuid("creator_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    isClosed: boolean("is_closed").notNull().default(false),
    pinnedIds: jsonb("pinned_ids").notNull().default([]),
    mutedIds: jsonb("muted_ids").notNull().default([]),
    memberCount: integer("member_count").notNull().default(1),
    messageCount: integer("message_count").notNull().default(0),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("rooms_category_idx").on(t.category), index("rooms_created_idx").on(t.createdAt)]
);

export const roomMembers = pgTable(
  "room_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    roomId: uuid("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("member"),
    joinedAt: ts("joined_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("room_members_uq").on(t.roomId, t.userId),
    index("room_members_user_idx").on(t.userId),
  ]
);

export const roomMessages = pgTable(
  "room_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    roomId: uuid("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    isPinned: boolean("is_pinned").notNull().default(false),
    createdAt: ts("created_at").notNull().defaultNow(),
    deletedAt: ts("deleted_at"),
  },
  (t) => [index("room_messages_room_idx").on(t.roomId, t.createdAt)]
);

export const drops = pgTable(
  "drops",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    prompt: text("prompt").notNull(),
    kind: text("kind").notNull().default("challenge"),
    category: text("category").notNull().default("Other"),
    responseCount: integer("response_count").notNull().default(0),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("drops_created_idx").on(t.createdAt), index("drops_category_idx").on(t.category)]
);

export const dropResponses = pgTable(
  "drop_responses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dropId: uuid("drop_id")
      .notNull()
      .references(() => drops.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    content: text("content").notNull().default(""),
    mediaUrl: text("media_url"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("drop_responses_uq").on(t.dropId, t.userId),
    index("drop_responses_drop_idx").on(t.dropId),
  ]
);

export const reports = pgTable(
  "reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reporterId: uuid("reporter_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    targetType: text("target_type").notNull(),
    targetId: uuid("target_id").notNull(),
    reason: text("reason").notNull(),
    details: text("details").notNull().default(""),
    status: text("status").notNull().default("pending"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("reports_status_idx").on(t.status), index("reports_target_idx").on(t.targetId)]
);

export const blocks = pgTable(
  "blocks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blockerId: uuid("blocker_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    blockedId: uuid("blocked_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("blocks_uq").on(t.blockerId, t.blockedId)]
);

export const mutes = pgTable(
  "mutes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    muterId: uuid("muter_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    mutedId: uuid("muted_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("mutes_uq").on(t.muterId, t.mutedId)]
);

export type User = typeof users.$inferSelect;
export type PostRow = typeof posts.$inferSelect;
export type Conversation = typeof conversations.$inferSelect;
