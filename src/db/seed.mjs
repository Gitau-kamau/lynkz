/* LYNKZ demo data seeder.
 * Removes ALL existing LYNKZ data and repopulates with clearly-marked demo content.
 * Demo password for every account: Password123!
 * Run: node src/db/seed.mjs
 */
import pg from "pg";
import fs from "fs";
import path from "path";
import { createHash } from "crypto";
import bcrypt from "bcryptjs";

const env = fs.readFileSync(path.resolve(".env"), "utf8");
const m = env.match(/^DATABASE_URL=(.+)$/m);
const DATABASE_URL = m ? m[1].trim() : "postgresql://postgres:postgres@127.0.0.1:5432/app_db";
const pool = new pg.Pool({ connectionString: DATABASE_URL });

const H = (s) => createHash("sha256").update(s).digest("hex");
const PW = await bcrypt.hash("Password123!", 10);
const now = new Date();
const hoursAgo = (h) => new Date(now.getTime() - h * 3600000).toISOString();
const hoursFromNow = (h) => new Date(now.getTime() + h * 3600000).toISOString();
const daysAgo = (d) => hoursAgo(d * 24);

const img = (seed, w = 900, h = 650) => `https://picsum.photos/seed/${seed}/${w}/${h}`;
const av = (n) => `https://i.pravatar.cc/150?img=${n}`;

async function main() {
  console.log("🧹 Clearing existing data…");
  const tables = [
    "sessions", "reset_tokens", "follows", "post_media", "post_likes", "comments", "comment_likes",
    "saved_posts", "collections", "poll_votes", "hashtags", "conversation_members", "messages",
    "conversations", "notifications", "lynk_views", "lynk_reactions", "lynk_replies", "lynks",
    "room_members", "room_messages", "rooms", "drop_responses", "drops", "reports", "blocks", "mutes",
    "reposts", "posts", "users",
  ];
  for (const t of tables) {
    await pool.query(`DELETE FROM ${t}`).catch((e) => console.error(`skip ${t}:`, e.message));
  }

  console.log("👥 Creating demo users…");
  const users = [
    ["demo", "Tariq Demo", PW, av(68), "This is a DEMO account. Log in with demo@lynkz.app / Password123!", true, false, ["Technology", "Gaming", "Music"]],
    ["naya", "Naya Brooks", PW, av(47), "Creator · music · night rides 🎧", true, false, ["Music", "Photography", "Travel"]],
    ["kai", "Kai Chen", PW, av(12), "Indie dev building cool things 🚀", true, false, ["Technology", "Coding", "Gaming"]],
    ["zara", "Zara Ali", PW, av(45), "Student · fashion lover 📚", false, false, ["Fashion", "School", "Books"]],
    ["leo", "Leo Martins", PW, av(53), "Football is life ⚽", false, false, ["Sports", "Food"]],
    ["maya", "Maya Okafor", PW, av(32), "Photographer chasing light 📸", true, false, ["Photography", "Art", "Travel"]],
    ["rico", "Rico Vega", PW, av(15), "GG only. Streaming daily 🎮", true, false, ["Gaming", "Technology"]],
    ["sami", "Sami Torres", PW, av(59), "Music head. Playlists on playlists 🎶", false, false, ["Music", "Movies"]],
  ];
  const userIds = {};
  for (const [username, displayName, pw, avatar, bio, verified, admin, interests] of users) {
    const email = `${username}@lynkz.app`;
    const [u] = await pool.query(
      `INSERT INTO users (username, email, password_hash, display_name, avatar_url, bio, is_verified, is_admin, interests, onboarding_done, last_seen_at, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true,now(),$10) RETURNING id`,
      [username, email, pw, displayName, avatar, bio, verified, admin, interests, daysAgo(30 + Math.random() * 60)]
    );
    userIds[username] = u.rows[0].id;
  }

  console.log("🔗 Creating follows…");
  const follows = [
    ["demo", "naya"], ["demo", "kai"], ["demo", "zara"], ["demo", "leo"], ["demo", "maya"], ["demo", "rico"], ["demo", "sami"],
    ["naya", "demo"], ["kai", "demo"], ["rico", "demo"], ["sami", "demo"],
    ["naya", "maya"], ["maya", "naya"], ["kai", "rico"], ["rico", "kai"],
    ["zara", "maya"], ["leo", "sami"], ["maya", "zara"], ["zara", "leo"], ["leo", "rico"], ["sami", "naya"], ["maya", "leo"],
  ];
  for (const [f, t] of follows) {
    await pool.query(
      `INSERT INTO follows (follower_id, following_id, status, created_at) VALUES ($1,$2,'accepted',$3)`,
      [userIds[f], userIds[t], daysAgo(20 + Math.random() * 40)]
    );
  }
  // one pending request: maya -> zara (zara is private)
  await pool.query(
    `INSERT INTO follows (follower_id, following_id, status) VALUES ($1,$2,'pending')`,
    [userIds["maya"], userIds["zara"]]
  );

  console.log("📝 Creating posts…");
  const postDefs = [
    ["naya", "Night ride energy. City never sleeps 🌙 #CityVibes #LYNKZ", "Downtown", 6],
    ["naya", "Just dropped my new track — tell me what you think 🎧 #NewMusic #LYNKZ", "Studio", 5],
    ["kai", "Shipped a new feature at 2am. Coffee count: 4 ☕ #DevLife #Technology", "Home office", 4],
    ["kai", "Hot take: the best keyboard is a loud one. Fight me. #TechTalk", null, 3],
    ["zara", "Thrifted this whole fit for under $40 😌 #Fashion #ThriftHaul", "Fashion District", 7],
    ["zara", "Study grind: 3 hours, one playlist, zero regrets #SchoolLife #StudyVibes", "Library", 8],
    ["leo", "Match day. Nothing beats the atmosphere 🏟️ #Football #LYNKZ", "Stadium", 10],
    ["maya", "Golden hour does all the work 📸 #Photography #GoldenHour", "Rooftop", 2],
    ["rico", "New stream setup day! Finally cable-managed 💪 #Gaming #Setup", null, 1],
    ["sami", "Top 5 albums of the year — drop yours below 👇 #Music", null, 9],
    ["demo", "Welcome to LYNKZ! This is my demo account — explore the platform, post something, join a room. 🚀 #LYNKZ #Welcome", "Everywhere", 0],
    ["maya", "Back from the mountains. My legs are gone but my heart is full 🏔️ #Travel", "The Alps", 12],
  ];
  const postIds = {};
  const tagsSeen = new Map();
  const bumpTag = (t) => tagsSeen.set(t, (tagsSeen.get(t) ?? 0) + 1);
  let pi = 0;
  for (const [author, content, location, hAgo] of postDefs) {
    pi++;
    const tags = [...content.matchAll(/\B#([a-zA-Z0-9_]{1,40})/g)].map((x) => x[1].toLowerCase());
    tags.forEach(bumpTag);
    const [p] = await pool.query(
      `INSERT INTO posts (author_id, content, location, visibility, tags, view_count, like_count, comment_count, created_at)
       VALUES ($1,$2,$3,'everyone',$4,${Math.floor(50 + Math.random() * 900)},${Math.floor(0 + Math.random() * 4)},0,$5) RETURNING id`,
      [userIds[author], content, location, tags, hoursAgo(hAgo)]
    );
    postIds[content.slice(0, 20)] = p.rows[0].id;
    if (pi % 2 === 0 && pi <= 10) {
      await pool.query(`INSERT INTO post_media (post_id, url, type, position) VALUES ($1,$2,'image',0)`, [p.rows[0].id, img("lynkz" + pi)]);
    }
    if (pi === 10) {
      await pool.query(`INSERT INTO post_media (post_id, url, type, position) VALUES ($1,$2,'image',0), ($1,$3,'image',1)`, [p.rows[0].id, img("multi-a" + pi), img("multi-b" + pi)]);
    }
  }

  // poll post
  const [pollPost] = await pool.query(
    `INSERT INTO posts (author_id, content, poll, tags, view_count, created_at)
     VALUES ($1,'Help me decide my next stream 🎮 #Gaming #Poll', $2, '{gaming,poll}', 420, $3) RETURNING id`,
    [userIds["rico"], JSON.stringify({ question: "What should I stream tonight?", options: ["Valorant", "Minecraft", "Chess (seriously)", "Just chatting"], votes: [12, 18, 4, 9] }), hoursAgo(3)]
  );
  // question post
  const [qPost] = await pool.query(
    `INSERT INTO posts (author_id, content, question, created_at) VALUES ($1,$2,$3,$4) RETURNING id`,
    [userIds["sami"], "Drop your top album below 👇 #Music", "What's the best album of the year?", hoursAgo(9)]
  );

  console.log("💬 Creating comments…");
  const commentDefs = [
    [postIds["Night ride energy"], "naya", ["This is so pretty 😍", "Wow, what city is this?", "The colors!! 🔥"]],
    [postIds["Shipped a new feature"], "kai", ["2am features are the best features 😂", "Proud of you bro 👏"]],
    [postIds["Thrifted this whole fit"], "zara", ["No way, that's criminal 🔥", "Teach me your ways 🙏"]],
    [postIds["Match day"], "leo", ["LET'S GOOO ⚽", "Best atmosphere in football, no debate."]],
    [postIds["Golden hour"], "maya", ["This is wallpaper material 📸", "Unreal shot"]],
    [postIds["Welcome to LYNKZ"], "demo", ["Welcome! Great to have you here 🎉", "This platform is awesome so far"]],
  ];
  for (const [postId, author, texts] of commentDefs) {
    const pid = postId ?? Object.values(postIds)[0];
    let cId = null;
    for (let i = 0; i < texts.length; i++) {
      const [c] = await pool.query(
        `INSERT INTO comments (post_id, author_id, content, created_at) VALUES ($1,$2,$3,$4) RETURNING id`,
        [pid, userIds[author], texts[i], hoursAgo(1 + i * 0.4)]
      );
      if (i === 1) cId = c.rows[0].id;
    }
    if (cId) {
      await pool.query(`INSERT INTO comments (post_id, author_id, parent_id, content, created_at) VALUES ($1,$2,$3,$4,$5)`,
        [pid, userIds["maya"], cId, "Totally agree with this 👏", hoursAgo(0.5)]);
    }
    await pool.query(`UPDATE posts SET comment_count = (SELECT count(*) FROM comments WHERE post_id = $1) WHERE id = $1`, [pid]);
  }

  console.log("❤️ Creating likes, saves, reposts…");
  const allPostIds = Object.values(postIds);
  for (let i = 0; i < 45; i++) {
    const postId = allPostIds[Math.floor(Math.random() * allPostIds.length)];
    const liker = users[Math.floor(Math.random() * users.length)][0];
    if (liker === "demo") continue;
    await pool.query(`INSERT INTO post_likes (post_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [postId, userIds[liker]]);
  }
  await pool.query(`UPDATE posts SET like_count = (SELECT count(*) FROM post_likes WHERE post_id = posts.id)`);
  await pool.query(`INSERT INTO saved_posts (user_id, post_id) SELECT $1, id FROM posts ORDER BY random() LIMIT 3`, [userIds["demo"]]);
  await pool.query(`INSERT INTO reposts (user_id, post_id) VALUES ($1,$2), ($1,$3) ON CONFLICT DO NOTHING`,
    [userIds["maya"], postIds["Night ride energy"], postIds["Match day"]]);
  await pool.query(`UPDATE posts SET repost_count = (SELECT count(*) FROM reposts WHERE post_id = posts.id)`);

  console.log("⚡ Creating hashtags…");
  for (const [name, count] of tagsSeen) {
    await pool.query(`INSERT INTO hashtags (name, post_count) VALUES ($1,$2) ON CONFLICT (name) DO UPDATE SET post_count = hashtags.post_count + $2`, [name, count]);
  }
  await pool.query(`INSERT INTO hashtags (name, post_count) VALUES ('Gaming', 18), ('Music', 22), ('Fashion', 12), ('Sports', 14) ON CONFLICT (name) DO NOTHING`);

  console.log("⏳ Creating LYNKs…");
  const lynkDefs = [
    ["naya", "photo", img("lynk-photo", 700, 900), null, null, 6, 800, ["maya", "demo", "sami"]],
    ["kai", "text", "Hot take delivered: coffee before code. Always. ☕", null, null, 3, 420, ["demo", "rico"]],
    ["zara", "poll", null, JSON.stringify({ question: "Fit check?", options: ["Fire 🔥", "Mid 😬", "Wear it to school"], votes: [22, 3, 8] }), null, 5, 300, ["maya", "demo"]],
    ["leo", "music", null, null, JSON.stringify({ title: "Vamos", artist: "Leo Martins" }), 1, 150, ["sami"]],
    ["maya", "question", "What should I photograph next week — city or coast?", null, null, 2, 90, ["naya"]],
    ["sami", "text", "This 24h LYNK thing is kinda fun ngl ⚡", null, null, 0, 40, []],
  ];
  for (const [author, type, mediaUrl, poll, music, hAgo, views, viewerNames] of lynkDefs) {
    const [l] = await pool.query(
      `INSERT INTO lynks (user_id, type, content, media_url, poll, music, view_count, expires_at, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [userIds[author], type, type === "text" ? lynkDefs.find((x) => x[0] === author && x[1] === "text")?.[2] ?? "" : "", mediaUrl, poll, music, views, hoursFromNow(24 - hAgo), hoursAgo(hAgo)]
    );
    for (const v of viewerNames) {
      await pool.query(`INSERT INTO lynk_views (lynk_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [l.rows[0].id, userIds[v]]);
    }
  }
  // expired lynk
  await pool.query(
    `INSERT INTO lynks (user_id, type, content, expires_at, created_at) VALUES ($1,'text','This expired lynk should be gone 🫠', $2, $3)`,
    [userIds["rico"], hoursAgo(1), hoursAgo(30)]
  );

  console.log("🏠 Creating LYNK ROOMS…");
  const roomDefs = [
    ["rico", "Gaming Lounge", "Ranked grind, chill vibes, and the occasional rage quit. Everyone welcome.", "Gaming", ["kai", "demo", "leo", "sami"]],
    ["naya", "Music Vibes", "Share what you're listening to. Playlist exchange station 🎧", "Music", ["sami", "demo", "maya"]],
    ["kai", "Tech Talk", "Devs, gadgets and hot takes. Bring your keyboard opinions.", "Technology", ["rico", "demo"]],
    ["zara", "School Life", "Homework help, study tips, and survival stories 📚", "School", ["maya", "demo"]],
    ["leo", "Campus Sports", "Match days, fitness challenges and free talk ⚽🏀", "Sports", ["rico", "maya"]],
  ];
  const roomIds = {};
  for (const [creator, name, description, category, members] of roomDefs) {
    const [r] = await pool.query(
      `INSERT INTO rooms (name, description, category, creator_id, member_count, message_count, created_at)
       VALUES ($1,$2,$3,$4,1,0,$5) RETURNING id`,
      [name, description, category, userIds[creator], hoursAgo(20 + Math.random() * 30)]
    );
    roomIds[name] = r.rows[0].id;
    await pool.query(`INSERT INTO room_members (room_id, user_id, role) VALUES ($1,$2,'creator')`, [r.rows[0].id, userIds[creator]]);
    for (const mem of members) {
      await pool.query(`INSERT INTO room_members (room_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [r.rows[0].id, userIds[mem]]);
    }
    const memberCount = members.length + 1;
    await pool.query(`UPDATE rooms SET member_count = $2 WHERE id = $1`, [r.rows[0].id, memberCount]);
    const msgs = [
      [creator, `Welcome to ${name}! Introduce yourselves 👋`],
      [members[0] ?? creator, "Hey everyone! Excited to be here 🔥"],
      [members[1] ?? creator, "This room is about to be amazing"],
      [creator, "Rules: be kind, stay on topic, have fun ✨"],
    ];
    for (let i = 0; i < msgs.length; i++) {
      await pool.query(
        `INSERT INTO room_messages (room_id, user_id, content, created_at) VALUES ($1,$2,$3,$4)`,
        [r.rows[0].id, userIds[msgs[i][0]], msgs[i][1], hoursAgo(18 - i * 2)]
      );
    }
    await pool.query(`UPDATE rooms SET message_count = (SELECT count(*) FROM room_messages WHERE room_id = $1) WHERE id = $1`, [r.rows[0].id]);
  }
  const [pinned] = await pool.query(
    `INSERT INTO room_messages (room_id, user_id, content, is_pinned) VALUES ($1,$2,$3,true) RETURNING id`,
    [roomIds["Gaming Lounge"], userIds["rico"], "📌 RULES: be kind, stay on topic, have fun ✨"]
  );
  await pool.query(`UPDATE rooms SET pinned_ids = $2 WHERE id = $1`, [roomIds["Gaming Lounge"], JSON.stringify([pinned.rows[0].id])]);

  console.log("🎯 Creating LYNK DROPs…");
  const dropDefs = [
    ["rico", "Show your setup 🖥️", "Gaming", ["kai", "demo"]],
    ["naya", "What song are you listening to right now? 🎧", "Music", ["sami", "maya"]],
    ["leo", "Best football team of all time? ⚽", "Sports", ["demo"]],
    ["zara", "Post your weekend photo 📸", "Fashion", []],
  ];
  const dropIds = {};
  for (const [creator, prompt, category, responders] of dropDefs) {
    const [d] = await pool.query(
      `INSERT INTO drops (user_id, prompt, kind, category, response_count, created_at) VALUES ($1,$2,'challenge',$3,0,$4) RETURNING id`,
      [userIds[creator], prompt, category, hoursAgo(5 + Math.random() * 30)]
    );
    dropIds[prompt] = d.rows[0].id;
    for (const resp of responders) {
      await pool.query(
        `INSERT INTO drop_responses (drop_id, user_id, content, media_url, created_at) VALUES ($1,$2,$3,$4,$5)`,
        [d.rows[0].id, userIds[resp], resp === "kai" ? "My battlestation is ready 🎮" : resp === "demo" ? "Here's mine — cable chaos included 😄" : "Can't stop listening to this one", resp === "sami" ? img("drop-music", 500, 500) : resp === "maya" ? img("drop-photo", 500, 500) : null, hoursAgo(3)]
      );
    }
    await pool.query(`UPDATE drops SET response_count = (SELECT count(*) FROM drop_responses WHERE drop_id = $1) WHERE id = $1`, [d.rows[0].id]);
  }

  console.log("🔔 Creating notifications…");
  const notifDefs = [
    [userIds["demo"], userIds["naya"], "like", "Naya Brooks liked your post"],
    [userIds["demo"], userIds["kai"], "comment", "Kai Chen commented: Nice one! 🔥"],
    [userIds["demo"], userIds["maya"], "follow", "Maya Okafor started following you"],
    [userIds["demo"], userIds["rico"], "room", "Rico Vega posted in a room you're in: Gaming Lounge"],
    [userIds["demo"], userIds["sami"], "drop", "Sami Torres responded to your DROP"],
    [userIds["demo"], userIds["zara"], "follow_request", "Zara Ali requested to follow you"],
  ];
  for (const [uid, actor, type, text] of notifDefs) {
    await pool.query(
      `INSERT INTO notifications (user_id, actor_id, type, text, is_read, created_at) VALUES ($1,$2,$3,$4,$5,$6)`,
      [uid, actor, type, text, Math.random() > 0.5, hoursAgo(1 + Math.random() * 10)]
    );
  }

  console.log("💬 Creating a demo conversation…");
  const [conv] = await pool.query(`INSERT INTO conversations (last_message_at) VALUES (now()) RETURNING id`);
  await pool.query(`INSERT INTO conversation_members (conversation_id, user_id) VALUES ($1,$2), ($1,$3)`, [conv.rows[0].id, userIds["demo"], userIds["naya"]]);
  await pool.query(
    `INSERT INTO messages (conversation_id, sender_id, content, created_at) VALUES ($1,$2,'Hey! Welcome to LYNKZ 👋', $3)`,
    [conv.rows[0].id, userIds["naya"], hoursAgo(2)]
  );
  await pool.query(
    `INSERT INTO messages (conversation_id, sender_id, content, created_at) VALUES ($1,$2,'Thanks! Loving the vibe here so far ⚡', $3)`,
    [conv.rows[0].id, userIds["demo"], hoursAgo(1.8)]
  );

  console.log("✅ Seed complete!");
  console.log("   Log in: demo@lynkz.app / Password123!");
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
