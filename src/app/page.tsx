import Link from "next/link";
import { LynkLogo } from "@/components/Logo";
import { Icon } from "@/components/icons";
import { Avatar, Verified } from "@/components/ui";

export default function Landing() {
  return (
    <div className="min-h-dvh flex flex-col">
      {/* ambient background */}
      <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 h-[520px] w-[520px] rounded-full opacity-25 blur-[140px]" style={{ background: "radial-gradient(circle, var(--a1), transparent 65%)" }} />
        <div className="absolute -bottom-40 -right-40 h-[520px] w-[520px] rounded-full opacity-25 blur-[140px]" style={{ background: "radial-gradient(circle, var(--a2), transparent 65%)" }} />
      </div>

      {/* header */}
      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5">
        <LynkLogo size={34} withWord />
        <nav className="flex items-center gap-2" aria-label="Account">
          <Link href="/login" className="btn h-10 items-center rounded-xl px-4 text-sm font-semibold text-[color:var(--text)] hover:bg-white/6 inline-flex">
            Log in
          </Link>
          <Link href="/signup" className="btn grad h-10 items-center rounded-xl px-4 text-sm font-semibold text-white shadow-lg inline-flex">
            Sign up free
          </Link>
        </nav>
      </header>

      {/* hero */}
      <main className="relative z-10 mx-auto w-full max-w-6xl flex-1 px-5">
        <section className="pt-14 md:pt-24 text-center">
          <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-[color:var(--line)] bg-white/4 px-4 py-1.5 text-xs font-semibold text-[color:var(--muted)] backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            The social network of the future — live now
          </div>
          <h1 className="font-display text-4xl sm:text-6xl md:text-7xl font-bold tracking-tight leading-[1.05]">
            A new way to <span className="text-grad">connect.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-[15px] md:text-lg text-[color:var(--muted)] leading-relaxed">
            Share your world, discover new people, join conversations and create connections
            that actually matter.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/signup" className="btn grad h-12 w-full sm:w-auto rounded-2xl px-8 text-[15px] font-bold text-white shadow-xl shadow-black/30 inline-flex items-center justify-center gap-2">
              Join LYNKZ <Icon.ChevronR size={16} />
            </Link>
            <Link href="/login" className="btn h-12 w-full sm:w-auto rounded-2xl border border-[color:var(--line)] bg-white/4 px-8 text-[15px] font-bold inline-flex items-center justify-center">
              I already have an account
            </Link>
          </div>
          <p className="mt-4 text-xs text-[color:var(--muted)]">
            Connect. <span className="text-[color:var(--a1)]">Share.</span> <span className="text-[color:var(--a2)]">Discover.</span>
          </p>
        </section>

        {/* product preview mock */}
        <section className="mt-16 md:mt-20 relative" aria-label="LYNKZ preview">
          <div className="mx-auto max-w-4xl rounded-3xl border border-[color:var(--line)] bg-[color:var(--bg2)]/70 p-3 md:p-5 shadow-2xl backdrop-blur">
            <div className="grid gap-3 md:grid-cols-[1.5fr_1fr]">
              {/* feed mock */}
              <div className="card p-4 space-y-3">
                <div className="flex gap-3 items-center">
                  <Avatar src="https://i.pravatar.cc/150?img=12" name="Naya Brooks" size={38} />
                  <div className="flex-1">
                    <p className="flex items-center gap-1.5 text-[13.5px] font-semibold">Naya Brooks <Verified className="text-[color:var(--a2)]" /></p>
                    <p className="text-[11px] text-[color:var(--muted)]">@naya · 2h</p>
                  </div>
                </div>
                <p className="text-[13.5px] leading-relaxed">
                  Night ride energy 🌙 <span className="text-cyan-400 font-medium">#CityVibes</span>
                </p>
                <div className="grid h-36 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500/40 via-purple-500/30 to-cyan-500/40">
                  <Icon.Camera size={26} className="text-white/70" />
                </div>
                <div className="flex gap-5 text-[12px] text-[color:var(--muted)]">
                  <span className="flex items-center gap-1 text-rose-400"><Icon.HeartFill size={13} /> 4.2K</span>
                  <span className="flex items-center gap-1"><Icon.Comment size={13} /> 187</span>
                  <span className="flex items-center gap-1 text-emerald-400"><Icon.Repeat size={13} /> 96</span>
                </div>
              </div>
              <div className="space-y-3">
                {/* lynk strip mock */}
                <div className="card p-3.5">
                  <p className="text-[11px] font-bold tracking-widest text-[color:var(--a2)] mb-2.5">ACTIVE LYNKs</p>
                  <div className="flex gap-3">
                    {["img=32", "img=47", "img=5"].map((p, i) => (
                      <div key={p} className="text-center space-y-1">
                        <span className="mx-auto block rounded-full p-[2px] grad"><Avatar src={`https://i.pravatar.cc/100?${p}`} name="LYNK" size={40} /></span>
                        <span className="block text-[9.5px] text-[color:var(--muted)]">{["@kai", "@zara", "@leo"][i]}</span>
                      </div>
                    ))}
                    <div className="grid h-[44px] w-[44px] place-items-center rounded-full border-2 border-dashed border-[color:var(--line)] text-[color:var(--muted)] self-start">
                      <Icon.Plus size={16} />
                    </div>
                  </div>
                </div>
                {/* room mock */}
                <div className="card p-4">
                  <p className="text-[11px] font-bold tracking-widest text-[color:var(--a1)] mb-2">LYNK ROOM</p>
                  <p className="text-[13.5px] font-semibold">🎮 Gaming Lounge</p>
                  <p className="mt-1 text-[11.5px] text-[color:var(--muted)]">1.2K members chatting now</p>
                  <div className="mt-2.5 flex items-center gap-2 text-[11px] text-[color:var(--muted)]">
                    <Avatar src="https://i.pravatar.cc/80?img=15" name="Rico" size={20} /> +3 live
                  </div>
                </div>
                {/* drop mock */}
                <div className="card p-4 border-[color:var(--a2)]/30">
                  <p className="text-[11px] font-bold tracking-widest text-amber-400 mb-2">⚡ LYNK DROP</p>
                  <p className="text-[13px] font-semibold">“Show your setup 🖥️”</p>
                  <p className="mt-1 text-[11px] text-[color:var(--muted)]">38 responses · trending</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* features */}
        <section className="mt-20 md:mt-28 grid gap-4 sm:grid-cols-3" aria-label="Features">
          {[
            {
              icon: <Icon.Link size={20} />,
              t: "LYNKs",
              d: "Temporary posts that vanish after 24 hours. Photos, polls, music, questions — gone before you know it.",
              c: "text-[color:var(--a2)]",
            },
            {
              icon: <Icon.Users size={20} />,
              t: "LYNK ROOMS",
              d: "Live topic rooms for gaming, music, sports, tech and more. Join the conversation in real time.",
              c: "text-[color:var(--a1)]",
            },
            {
              icon: <Icon.Zap size={20} />,
              t: "LYNK DROPs",
              d: "Drop a challenge. “Show your setup”, “What are you listening to?” — the community responds.",
              c: "text-amber-400",
            },
          ].map((f) => (
            <div key={f.t} className="card p-6 hover:-translate-y-1 transition duration-200">
              <span className={`grid h-11 w-11 place-items-center rounded-2xl bg-white/5 ${f.c}`}>{f.icon}</span>
              <h3 className="font-display mt-4 font-semibold text-[16px]">{f.t}</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-[color:var(--muted)]">{f.d}</p>
            </div>
          ))}
        </section>

        <section className="mt-12 md:mt-16 rounded-3xl border border-[color:var(--line)] bg-gradient-to-br from-[color:var(--a1)]/15 via-transparent to-[color:var(--a2)]/15 p-8 md:p-12 text-center">
          <h2 className="font-display text-2xl md:text-4xl font-bold tracking-tight">
            Your world, <span className="text-grad">linked.</span>
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm md:text-[15px] text-[color:var(--muted)]">
            Follow creators, chat in real time, ride the trends — everything you love about social,
            built for the way people connect today.
          </p>
          <Link href="/signup" className="btn grad mt-7 h-12 inline-flex items-center justify-center rounded-2xl px-8 text-[15px] font-bold text-white shadow-xl">
            Get started — it's free
          </Link>
        </section>
      </main>

      <footer className="relative z-10 mt-16 border-t border-[color:var(--line)]">
        <div className="mx-auto flex max-w-6xl flex-col md:flex-row items-center justify-between gap-4 px-5 py-8 text-xs text-[color:var(--muted)]">
          <div className="flex items-center gap-2">
            <LynkLogo size={22} />
            <span>© {new Date().getFullYear()} LYNKZ. All rights reserved.</span>
          </div>
          <nav className="flex flex-wrap justify-center gap-x-5 gap-y-2" aria-label="Footer">
            <Link href="/signup" className="hover:text-[color:var(--text)]">Sign up</Link>
            <Link href="/login" className="hover:text-[color:var(--text)]">Log in</Link>
            <Link href="/explore" className="hover:text-[color:var(--text)]">Explore</Link>
            <Link href="/rooms" className="hover:text-[color:var(--text)]">Rooms</Link>
            <Link href="/drops" className="hover:text-[color:var(--text)]">DROPs</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
