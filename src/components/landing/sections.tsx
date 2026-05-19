"use client";

import React, { useState } from "react";
import {
  useReveal,
  Reveal,
  RevealOne,
  useScrolled,
  useActiveSection,
  useCounter,
  useAutoIndex,
} from "./motion";
import { Icon } from "./icons";
import {
  HeroGradient,
  StatsGradient,
  StepGradient,
  BlobThumb,
  FooterGradient,
} from "./gradients";

// ── Shared helpers ──────────────────────────────────────────
const Container = ({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <div className={`w-full max-w-[1280px] mx-auto px-6 md:px-10 ${className}`}>
    {children}
  </div>
);

const Eyebrow = ({ children }: { children: React.ReactNode }) => (
  <span className="eyebrow">{children}</span>
);

const Display = ({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) => <h2 className={`display ${className}`}>{children}</h2>;

// ── NAV ─────────────────────────────────────────────────────
export const Nav = () => {
  const scrolled = useScrolled(8);
  const active = useActiveSection([
    "top",
    "about",
    "how",
    "playbooks",
    "cases",
    "tech",
    "workflows",
  ]);
  const [open, setOpen] = useState(false);

  const links = [
    { h: "#about", l: "About", id: "about" },
    { h: "#playbooks", l: "Playbooks", id: "playbooks" },
    { h: "#how", l: "How we work", id: "how" },
    { h: "#cases", l: "Case studies", id: "cases" },
  ];

  const productItems = [
    { h: "#tech", l: "Architecture", desc: "DAG engine, durable execution" },
    { h: "#workflows", l: "All Workflows", desc: "18 workflows across 5 packs" },
    { h: "#playbooks", l: "Playbooks", desc: "Pre-built operational playbooks" },
    { h: "#how", l: "How We Work", desc: "From discovery to optimization" },
  ];

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
        scrolled ? "nav-scrolled" : ""
      }`}
    >
      <Container
        className={`flex items-center justify-between transition-all duration-300 ${
          scrolled ? "h-16" : "h-24"
        }`}
      >
        <nav className="hidden md:flex items-center gap-9 text-[15px] text-ink-soft">
          {/* Product dropdown */}
          <div className="nav-dropdown-trigger relative">
            <button className={`relative transition-colors flex items-center gap-1 ${
              active === "tech" || active === "workflows" ? "text-ink" : "hover:text-ink"
            }`}>
              Product
              <Icon.ChevDown size={12} />
            </button>
            <div className="nav-dropdown w-[280px]">
              <div className="card-soft p-2 shadow-lg">
                {productItems.map((item) => (
                  <a
                    key={item.h}
                    href={item.h}
                    className="block px-4 py-3 rounded-2xl hover:bg-ink/5 transition-colors"
                  >
                    <div className="text-[14px] font-medium text-ink">{item.l}</div>
                    <div className="text-[12px] text-ink-muted mt-0.5">{item.desc}</div>
                  </a>
                ))}
              </div>
            </div>
          </div>

          {links.map((L) => (
            <a
              key={L.h}
              href={L.h}
              className={`relative transition-colors ${
                active === L.id ? "text-ink" : "hover:text-ink"
              }`}
            >
              {L.l}
              <span
                className={`absolute -bottom-1.5 left-0 right-0 h-px bg-ink transition-transform origin-left duration-300 ${
                  active === L.id ? "scale-x-100" : "scale-x-0"
                }`}
              />
            </a>
          ))}
        </nav>

        <button
          onClick={() => setOpen((o) => !o)}
          className="md:hidden w-10 h-10 grid place-items-center rounded-full bg-ink/5 z-10"
        >
          <div className="space-y-[5px]">
            <span
              className={`block w-4 h-px bg-ink transition-transform duration-300 ${
                open ? "translate-y-[3px] rotate-45" : ""
              }`}
            />
            <span
              className={`block w-4 h-px bg-ink transition-opacity duration-200 ${
                open ? "opacity-0" : ""
              }`}
            />
            <span
              className={`block w-4 h-px bg-ink transition-transform duration-300 ${
                open ? "-translate-y-[3px] -rotate-45" : ""
              }`}
            />
          </div>
        </button>

        <a
          href="#top"
          className={`serif leading-none text-ink absolute left-1/2 -translate-x-1/2 transition-all duration-300 ${
            scrolled ? "text-[26px]" : "text-[34px]"
          }`}
        >
          Crewgods
        </a>

        <a
          href="#book"
          className={`btn-primary !text-[14px] transition-all ${
            scrolled ? "!py-2 !px-4" : "!py-2.5 !px-5"
          }`}
        >
          Book a free call
        </a>
      </Container>

      <div
        className="md:hidden mobile-drawer absolute inset-x-0"
        data-open={open}
      >
        <Container>
          <div className="card-soft p-4 mt-2 flex flex-col gap-1 bg-cream-50">
            <div className="text-[11px] text-ink-muted uppercase tracking-[0.15em] px-3 pt-2 pb-1">Product</div>
            {productItems.map((item) => (
              <a
                key={item.h}
                href={item.h}
                onClick={() => setOpen(false)}
                className="py-2.5 px-3 rounded-2xl hover:bg-ink/5 text-[15px]"
              >
                {item.l}
                <span className="text-[12px] text-ink-muted ml-2">{item.desc}</span>
              </a>
            ))}
            <div className="h-px bg-ink/5 my-1" />
            {links.map((L) => (
              <a
                key={L.h}
                href={L.h}
                onClick={() => setOpen(false)}
                className="py-3 px-3 rounded-2xl hover:bg-ink/5 text-[16px]"
              >
                {L.l}
              </a>
            ))}
          </div>
        </Container>
      </div>
    </header>
  );
};

// ── HERO ────────────────────────────────────────────────────
export const Hero = () => {
  const headRef = useReveal();
  const artRef = useReveal();
  return (
    <section id="top" className="relative pt-32 md:pt-36 pb-20">
      <div className="absolute inset-0 page-warmth pointer-events-none" />
      <Container className="relative">
        <div ref={headRef} data-reveal="" className="text-center max-w-[1100px] mx-auto">
          <h1
            className="display text-[clamp(56px,9vw,128px)]"
            style={{ "--rev-d": "0ms" } as React.CSSProperties}
          >
            <span className="line">Your back office,</span>
            <span className="line">
              <em>on autopilot.</em>
            </span>
          </h1>
          <p
            className="text-[clamp(17px,1.55vw,21px)] text-ink-soft mt-7 max-w-[640px] mx-auto leading-[1.55]"
            style={{ "--rev-d": "180ms" } as React.CSSProperties}
          >
            We plug Crewgods into your tools, run the repetitive work for you,
            and only ask for your input when it really matters.
          </p>
          <div
            className="flex flex-wrap items-center justify-center gap-3 mt-9"
            style={{ "--rev-d": "320ms" } as React.CSSProperties}
          >
            <a href="#book" className="btn-primary">
              Book a free call
              <span className="icon-go">
                <Icon.ArrowRight size={14} />
              </span>
            </a>
            <a href="#how" className="btn-secondary">
              How we work
              <span className="w-6 h-6 rounded-full bg-ink text-cream-50 grid place-items-center">
                <Icon.Play size={11} />
              </span>
            </a>
          </div>
        </div>

        <div
          ref={artRef}
          className="mt-20 reveal"
          style={{ transitionDelay: "450ms" }}
        >
          <div className="drift">
            <HeroGradient />
          </div>
        </div>
      </Container>
    </section>
  );
};

// ── LOGO STRIP ──────────────────────────────────────────────
export const LogoStrip = () => {
  const logos = [
    "Northbay",
    "Vertex Labs",
    "Halo/Co",
    "Roamera",
    "Stitchpost",
    "Junebug",
    "Foundry.",
    "Bantam",
    "Oakwork",
    "Triplet",
  ];
  return (
    <section className="py-14">
      <Container>
        <RevealOne>
          <div className="text-center text-[13px] text-ink-muted uppercase tracking-[0.2em] mb-7">
            Trusted by 400+ small ops teams
          </div>
        </RevealOne>
        <div
          className="overflow-hidden"
          style={{
            maskImage:
              "linear-gradient(90deg, transparent, #000 10%, #000 90%, transparent)",
            WebkitMaskImage:
              "linear-gradient(90deg, transparent, #000 10%, #000 90%, transparent)",
          }}
        >
          <div className="flex gap-16 marquee-track whitespace-nowrap">
            {[...logos, ...logos, ...logos].map((l, k) => (
              <span key={k} className="serif text-[28px] text-ink-muted/90">
                {l}
              </span>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
};

// ── STAT TILE ───────────────────────────────────────────────
const StatTile = ({
  target,
  suffix = "",
  prefix = "",
  label,
}: {
  target: number;
  suffix?: string;
  prefix?: string;
  label: string;
}) => {
  const { ref, value } = useCounter(target, { duration: 1800 });
  const formatted =
    prefix +
    String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ",") +
    suffix;
  return (
    <div
      ref={ref}
      className="glass-tile flex flex-col justify-between p-7 md:p-9 text-cream-50"
    >
      <div className="serif text-[clamp(54px,7vw,110px)] leading-[0.95] tabular-nums">
        {formatted}
      </div>
      <div className="text-[14px] md:text-[16px] mt-6 text-cream-100/90">
        {label}
      </div>
    </div>
  );
};

// ── WHO WE ARE ──────────────────────────────────────────────
export const WhoWeAre = () => (
  <section id="about" className="pt-16 pb-10">
    <Container>
      <Reveal
        stagger={120}
        className="grid md:grid-cols-[1.4fr_1fr] gap-10 mb-10"
      >
        <div>
          <Eyebrow>Who we are</Eyebrow>
          <Display className="text-[clamp(40px,5.5vw,76px)] mt-6">
            The team that runs <em>your</em> ops.
          </Display>
        </div>
        <div className="md:pt-2 flex items-end">
          <p className="text-[17px] text-ink-soft leading-[1.6] max-w-[520px]">
            We built Crewgods for small teams drowning in invoices, tickets,
            emails and to-dos. We connect the tools you already use, take the
            busywork off your plate, and stay out of the way until a real
            decision needs you.
          </p>
        </div>
      </Reveal>

      <RevealOne>
        <div className="relative img-blob">
          <div className="drift">
            <StatsGradient className="relative" />
          </div>
          <div className="absolute inset-0 p-6 md:p-10 grid md:grid-cols-3 gap-4 md:gap-6">
            <StatTile
              target={1500}
              suffix="+"
              label="Hours saved for clients each month"
            />
            <StatTile
              target={35}
              suffix="%"
              label="Average reduction in manual work"
            />
            <StatTile
              target={45}
              suffix=" days"
              label="Average time to measurable ROI"
            />
          </div>
        </div>
      </RevealOne>

      <RevealOne delay={200}>
        <div className="mt-6 card-soft px-6 md:px-9 py-6 md:py-7 flex flex-col md:flex-row items-start md:items-center gap-4 md:gap-6">
          <div className="serif text-[clamp(24px,2.4vw,32px)] flex-1">
            Want to be part of the team?
          </div>
          <span className="eyebrow !bg-cream-200/60 !text-ink-soft">
            3 roles open
          </span>
          <a href="#careers" className="btn-primary">
            Apply now
            <span className="icon-go">
              <Icon.ArrowRight size={14} />
            </span>
          </a>
        </div>
      </RevealOne>
    </Container>
  </section>
);

// ── HOW WE WORK ─────────────────────────────────────────────
const STEPS = [
  {
    n: "01",
    t: "Discover",
    tone: "purple" as const,
    d: "We learn your workflows and find where the busywork lives. You get a short, plain-English plan — no jargon, no hype.",
  },
  {
    n: "02",
    t: "Build",
    tone: "teal" as const,
    d: "We connect Crewgods to the tools you already use and set up the playbooks that fit your team. Usually live within a week.",
  },
  {
    n: "03",
    t: "Deploy",
    tone: "rose" as const,
    d: "We turn it on quietly, side-by-side with your team. You approve anything that matters from Slack or email.",
  },
  {
    n: "04",
    t: "Optimize",
    tone: "blue" as const,
    d: "We watch what works, fix what doesn't, and add new playbooks as your team grows. It gets better every month.",
  },
];

export const HowWeWork = () => {
  const [hovering, setHovering] = useState(false);
  const [active, goTo, progress] = useAutoIndex(STEPS.length, {
    interval: 5800,
    paused: hovering,
  });
  return (
    <section id="how" className="py-24 md:py-32">
      <Container>
        <Reveal
          stagger={140}
          className="text-center max-w-[1000px] mx-auto mb-16"
        >
          <h2 className="display text-[clamp(40px,6.2vw,84px)]">
            <span className="line">
              We handle <em>everything</em>
            </span>
            <span className="line">so you don&apos;t have to.</span>
          </h2>
          <p className="text-[17px] text-ink-soft mt-6 max-w-[600px] mx-auto leading-[1.6]">
            From finding the opportunity to keeping it running smoothly — we
            manage the whole thing so you can stay focused on your business.
          </p>
        </Reveal>

        <div className="grid md:grid-cols-[1.05fr_1fr] gap-10 md:gap-16 items-start">
          <div
            onMouseEnter={() => setHovering(true)}
            onMouseLeave={() => setHovering(false)}
          >
            {STEPS.map((s, i) => {
              const isActive = active === i;
              return (
                <div
                  key={s.n}
                  className="step-row"
                  data-active={isActive}
                  onClick={() => goTo(i)}
                  onMouseEnter={() => goTo(i)}
                >
                  <div className="serif text-[clamp(54px,6vw,84px)] leading-none flex items-baseline">
                    <span className="step-label">{s.t}</span>
                    <sup className="num-sup">{s.n}</sup>
                  </div>
                  {isActive && (
                    <div className="step-bar">
                      <i style={{ width: `${progress * 100}%` }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="md:sticky md:top-28">
            <div className="step-stage">
              {STEPS.map((s, i) => (
                <div
                  key={s.n}
                  className={`step-layer ${active === i ? "is-active" : ""}`}
                >
                  <div className="drift">
                    <StepGradient tone={s.tone} />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-7 min-h-[140px]">
              {STEPS.map((s, i) => (
                <div
                  key={s.n}
                  className={`transition-all duration-500 ${
                    active === i
                      ? "opacity-100 translate-y-0 relative"
                      : "opacity-0 translate-y-2 absolute pointer-events-none"
                  }`}
                >
                  <div className="serif text-[28px] mb-3">{s.t}</div>
                  <p className="text-[16px] text-ink-soft leading-[1.6] max-w-[420px]">
                    {s.d}
                  </p>
                </div>
              ))}
            </div>
            <a
              href="#book"
              className="inline-flex items-center gap-2 mt-7 text-[15px] ulink"
            >
              <Icon.CornerDown size={14} /> Book a free call
            </a>
          </div>
        </div>
      </Container>
    </section>
  );
};

// ── PLAYBOOKS GRID ──────────────────────────────────────────
const PLAYBOOKS = [
  {
    t: "Finance",
    d: "Invoices, expenses & payment chasing — handled.",
    tone: "orange",
  },
  {
    t: "Customer support",
    d: "Replies drafted, refunds approved, tickets routed.",
    tone: "purple",
  },
  {
    t: "HR & recruiting",
    d: "Resumes screened, offers sent, onboarding lined up.",
    tone: "rose",
  },
  {
    t: "Sales",
    d: "Leads routed, follow-ups sent, deal coaching nudges.",
    tone: "blue",
  },
  {
    t: "Operations",
    d: "Vendors onboarded, incidents triaged, SLAs watched.",
    tone: "teal",
  },
  {
    t: "Marketing",
    d: "Briefs drafted, posts scheduled, weekly reports.",
    tone: "sand",
  },
  {
    t: "Legal",
    d: "NDAs reviewed, contracts redlined, signatures chased.",
    tone: "indigo",
  },
  {
    t: "E-commerce",
    d: "Orders, returns, reviews and inventory — on watch.",
    tone: "sage",
  },
];

export const PlaybooksSection = () => (
  <section id="playbooks" className="py-24 md:py-32 border-t hairline">
    <Container>
      <Reveal
        stagger={120}
        className="grid md:grid-cols-[1fr_1.2fr] gap-10 md:gap-16 mb-16 items-end"
      >
        <div>
          <Eyebrow>Playbooks</Eyebrow>
          <Display className="text-[clamp(40px,5.5vw,76px)] mt-6">
            <span className="line">Pick a playbook.</span>
            <span className="line">
              <em>It runs itself.</em>
            </span>
          </Display>
        </div>
        <p className="text-[17px] text-ink-soft leading-[1.6] max-w-[560px]">
          Each playbook is a tested set of workflows for a part of your
          business. Turn one on, connect your tools, and the work starts running
          — quietly, in the background.
        </p>
      </Reveal>

      <Reveal stagger={70} className="grid sm:grid-cols-2 md:grid-cols-4 gap-3">
        {PLAYBOOKS.map((p, k) => (
          <a key={k} href="#" className="card-soft lift p-6 block group">
            <div className="transition-transform duration-500 group-hover:rotate-6 group-hover:scale-110">
              <BlobThumb tone={p.tone} size={72} />
            </div>
            <div className="serif text-[26px] mt-6">{p.t}</div>
            <p className="text-[14px] text-ink-soft mt-2 leading-[1.55] min-h-[3em]">
              {p.d}
            </p>
            <div className="flex items-center gap-1.5 mt-5 text-[13px] text-ink-soft group-hover:text-ink transition-colors">
              See workflows{" "}
              <span className="icon-go group-hover:translate-x-1 transition-transform">
                <Icon.ArrowRight size={12} />
              </span>
            </div>
          </a>
        ))}
      </Reveal>
    </Container>
  </section>
);

// ── CASE STUDIES ────────────────────────────────────────────
const CASES = [
  {
    co: "Northbay Logistics",
    sector: "Finance",
    tone: "orange",
    headline: "Cut invoice approvals from 5 days to 3 hours.",
    body: "Crewgods reads vendor invoices, matches them to POs, and only pings the CFO when something looks off. Approvals now happen in Slack, in seconds.",
    stat: "94%",
    sl: "Of invoices approved without a human touch",
  },
  {
    co: "Roamera",
    sector: "Customer support",
    tone: "rose",
    headline: "Took 1,200 weekly tickets down to 80.",
    body: "Refunds under $50 are handled automatically. Anything above goes to a human with a draft reply, the customer history and a recommended decision attached.",
    stat: "32h",
    sl: "Saved per week on support handling",
  },
  {
    co: "Junebug",
    sector: "Sales",
    tone: "blue",
    headline: "Doubled lead response speed.",
    body: "New leads are scored and routed within seconds. The right rep gets a draft reply and a one-line summary of who they are — already in their inbox.",
    stat: "2×",
    sl: "Faster first response to inbound",
  },
];

export const CaseStudies = () => (
  <section id="cases" className="py-24 md:py-32 border-t hairline">
    <Container>
      <Reveal
        stagger={140}
        className="flex items-end justify-between gap-10 mb-14"
      >
        <div>
          <Eyebrow>Case studies</Eyebrow>
          <Display className="text-[clamp(40px,5.5vw,76px)] mt-6">
            <span className="line">Quiet results,</span>
            <span className="line">
              <em>loud impact.</em>
            </span>
          </Display>
        </div>
        <a
          href="#"
          className="text-[15px] ulink hidden md:inline-flex items-center gap-1.5"
        >
          View all <Icon.ArrowRight size={12} />
        </a>
      </Reveal>

      <Reveal stagger={120} className="space-y-4">
        {CASES.map((c, k) => (
          <article
            key={k}
            className="card-soft lift p-6 md:p-8 grid md:grid-cols-[260px_1fr_auto] gap-8 md:gap-10 items-center"
          >
            <div className="flex items-center gap-4">
              <BlobThumb tone={c.tone} size={84} />
              <div>
                <div className="serif text-[22px] leading-tight">{c.co}</div>
                <div className="text-[12px] text-ink-muted uppercase tracking-[0.15em] mt-1">
                  {c.sector}
                </div>
              </div>
            </div>
            <div>
              <div className="serif text-[clamp(24px,2.4vw,32px)] leading-[1.15] max-w-[640px]">
                {c.headline}
              </div>
              <p className="text-[14.5px] text-ink-soft mt-3 leading-[1.6] max-w-[640px]">
                {c.body}
              </p>
            </div>
            <div className="text-left md:text-right">
              <div className="serif text-[clamp(40px,5vw,64px)] leading-none">
                {c.stat}
              </div>
              <div className="text-[12px] text-ink-muted mt-2 md:max-w-[180px] md:ml-auto leading-snug">
                {c.sl}
              </div>
            </div>
          </article>
        ))}
      </Reveal>
    </Container>
  </section>
);

// ── TESTIMONIALS ────────────────────────────────────────────
const TESTI = [
  {
    q: "It just runs. Our finance team gets their Fridays back.",
    n: "Maya Castellanos",
    r: "COO · Vertex Labs",
    tone: "orange",
  },
  {
    q: "The first AI thing we've used that didn't need babysitting.",
    n: "Owen Patel",
    r: "Founder · Junebug",
    tone: "rose",
  },
  {
    q: "Refunds, replies, ticket routing — all quietly handled.",
    n: "Priya Raman",
    r: "Ops Lead · Roamera",
    tone: "purple",
  },
  {
    q: "They saved us from hiring two ops people we couldn't afford.",
    n: "Lukas Brand",
    r: "CTO · Foundry.",
    tone: "blue",
  },
];

export const Testimonials = () => {
  const [hover, setHover] = useState(false);
  const [i, goTo, progress] = useAutoIndex(TESTI.length, {
    interval: 6000,
    paused: hover,
  });
  return (
    <section className="py-24 md:py-32 border-t hairline">
      <Container className="max-w-[1080px]">
        <RevealOne>
          <div className="text-center mb-14">
            <Eyebrow>What clients say</Eyebrow>
            <Display className="text-[clamp(36px,5vw,64px)] mt-6">
              <span className="line">Words from the people</span>
              <span className="line">
                <em>we keep out of the weeds.</em>
              </span>
            </Display>
          </div>
        </RevealOne>

        <RevealOne>
          <div
            className="card-soft p-8 md:p-14 relative overflow-hidden"
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
          >
            <Icon.Quote size={28} className="text-ink-faint" />
            <div className="relative mt-6 min-h-[160px] md:min-h-[140px]">
              {TESTI.map((t, k) => (
                <div
                  key={k}
                  className={`transition-all duration-700 ${
                    k === i
                      ? "opacity-100 translate-y-0 relative"
                      : "opacity-0 translate-y-3 absolute inset-0 pointer-events-none"
                  }`}
                >
                  <p className="serif text-[clamp(26px,3.2vw,44px)] leading-[1.15] max-w-[820px]">
                    &ldquo;{t.q}&rdquo;
                  </p>
                  <div className="flex items-center gap-4 mt-8">
                    <BlobThumb tone={t.tone} size={48} />
                    <div>
                      <div className="text-[15px] font-medium">{t.n}</div>
                      <div className="text-[13px] text-ink-muted">{t.r}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between mt-10 pt-6 border-t hairline">
              <div className="flex items-center gap-2">
                {TESTI.map((_, k) => (
                  <button
                    key={k}
                    onClick={() => goTo(k)}
                    className="relative h-1.5 rounded-full overflow-hidden bg-ink/10 transition-all"
                    style={{ width: k === i ? 40 : 16 }}
                  >
                    {k === i && (
                      <span
                        className="absolute inset-y-0 left-0 bg-ink rounded-full"
                        style={{ width: `${progress * 100}%` }}
                      />
                    )}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() =>
                    goTo((i - 1 + TESTI.length) % TESTI.length)
                  }
                  className="w-11 h-11 rounded-full bg-ink/5 hover:bg-ink/10 grid place-items-center"
                >
                  <Icon.ArrowRight size={14} className="rotate-180" />
                </button>
                <button
                  onClick={() => goTo((i + 1) % TESTI.length)}
                  className="w-11 h-11 rounded-full bg-ink text-cream-50 hover:bg-ink-soft grid place-items-center"
                >
                  <Icon.ArrowRight size={14} />
                </button>
              </div>
            </div>
          </div>
        </RevealOne>
      </Container>
    </section>
  );
};

// ── FAQ ─────────────────────────────────────────────────────
const FAQ_ITEMS = [
  {
    q: "How long until I see results?",
    a: "Most teams have their first playbook live within a week. You'll usually feel the difference inside the first month — fewer Slack pings, fewer overdue tasks.",
  },
  {
    q: "Do I have to change the tools I use?",
    a: "No. Crewgods plugs into the tools you already have — Gmail, Slack, HubSpot, Stripe, QuickBooks, Zendesk, and more. We meet you where you work.",
  },
  {
    q: "Will AI make decisions on its own?",
    a: "Only when you tell it to. You set the rules — anything above a threshold, anything risky, anything new — comes to a human. The boring, repeatable stuff just runs.",
  },
  {
    q: "Is my data safe?",
    a: "Yes. SOC 2 Type II. We strip out anything you mark sensitive, and you can self-host on our Business plan. We do not train models on your data.",
  },
  {
    q: "What does it cost?",
    a: "Pricing is based on how many workflow runs you need, not how many people are on your team. Start with a free call and we'll quote a real number against your actual workload.",
  },
];

const FaqItem = ({
  q,
  a,
  open,
  onToggle,
}: {
  q: string;
  a: string;
  open: boolean;
  onToggle: () => void;
}) => (
  <div className={`card-soft transition-all ${open ? "bg-cream-50/80" : ""}`}>
    <button
      onClick={onToggle}
      className="w-full text-left px-7 py-5 flex items-center justify-between gap-6"
    >
      <span className="serif text-[clamp(20px,2vw,26px)]">{q}</span>
      <span
        className={`chev w-9 h-9 grid place-items-center rounded-full bg-ink text-cream-50 flex-none transition-transform duration-300 ${
          open ? "rotate-45" : ""
        }`}
      >
        <Icon.Plus size={14} />
      </span>
    </button>
    <div
      className="grid transition-[grid-template-rows] duration-500 ease-out"
      style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
    >
      <div className="overflow-hidden">
        <div
          className={`px-7 pb-6 text-[16px] text-ink-soft leading-[1.65] pr-12 max-w-[760px] transition-opacity duration-300 ${
            open ? "opacity-100" : "opacity-0"
          }`}
        >
          {a}
        </div>
      </div>
    </div>
  </div>
);

export const FAQ = () => {
  const [open, setOpen] = useState(0);
  return (
    <section className="py-24 md:py-32 border-t hairline">
      <Container className="max-w-[920px]">
        <RevealOne>
          <div className="text-center mb-12">
            <Eyebrow>FAQ</Eyebrow>
            <Display className="text-[clamp(36px,5vw,64px)] mt-6">
              Common <em>questions</em>.
            </Display>
          </div>
        </RevealOne>
        <Reveal stagger={90} className="space-y-2">
          {FAQ_ITEMS.map((it, k) => (
            <FaqItem
              key={k}
              q={it.q}
              a={it.a}
              open={open === k}
              onToggle={() => setOpen(open === k ? -1 : k)}
            />
          ))}
        </Reveal>
      </Container>
    </section>
  );
};

// ── FINAL CTA ───────────────────────────────────────────────
export const FinalCTA = () => (
  <section id="book" className="py-28 md:py-36 border-t hairline">
    <Container>
      <RevealOne>
        <div className="relative img-blob">
          <div className="drift">
            <FooterGradient />
          </div>
          <div className="absolute inset-0 grid place-items-center text-center px-6">
            <div>
              <h2 className="display text-[clamp(40px,6vw,84px)] text-cream-50">
                <span className="line">Stop running the busywork.</span>
                <span className="line serif-italic text-cream-100/85">
                  Let us run it for you.
                </span>
              </h2>
              <div className="flex items-center justify-center gap-3 mt-9">
                <a href="#book" className="btn-primary !bg-cream-50 !text-ink">
                  Book a free call
                  <span className="icon-go">
                    <Icon.ArrowRight size={14} />
                  </span>
                </a>
                <a
                  href="#playbooks"
                  className="btn-secondary !bg-white/15 !text-cream-50 hover:!bg-white/25"
                >
                  See playbooks
                </a>
              </div>
            </div>
          </div>
        </div>
      </RevealOne>
    </Container>
  </section>
);

// ── FOOTER ──────────────────────────────────────────────────
export const Footer = () => (
  <footer className="pt-10 pb-12">
    <Container>
      <div className="grid md:grid-cols-[1.4fr_1fr_1fr_1fr] gap-10 border-t hairline pt-12">
        <div>
          <div className="serif text-[34px] leading-none">Crewgods</div>
          <p className="text-[14px] text-ink-soft mt-5 max-w-[300px] leading-[1.6]">
            Your back office, on autopilot. Built for small teams who want
            their afternoons back.
          </p>
        </div>
        {[
          {
            t: "Product",
            l: ["Playbooks", "How we work", "Pricing", "Changelog"],
          },
          {
            t: "Company",
            l: ["About", "Case studies", "Careers", "Contact"],
          },
          { t: "Resources", l: ["Docs", "Security", "Privacy", "Terms"] },
        ].map((col) => (
          <div key={col.t}>
            <div className="text-[12px] text-ink-muted uppercase tracking-[0.18em] mb-4">
              {col.t}
            </div>
            <ul className="space-y-2.5">
              {col.l.map((li) => (
                <li key={li}>
                  <a
                    href="#"
                    className="text-[14px] text-ink-soft hover:text-ink transition-colors"
                  >
                    {li}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 mt-12 text-[12.5px] text-ink-muted">
        <div>&copy; 2026 Crewgods Inc.</div>
        <div className="flex items-center gap-5">
          <a href="#" className="hover:text-ink transition-colors">
            Twitter
          </a>
          <a href="#" className="hover:text-ink transition-colors">
            LinkedIn
          </a>
          <a href="#" className="hover:text-ink transition-colors">
            GitHub
          </a>
        </div>
      </div>
    </Container>
  </footer>
);
