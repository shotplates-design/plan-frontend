"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { BetSlip } from "@/components/bet-slip";
import { PaywallModal } from "@/components/paywall";
import { useApp } from "@/components/providers";
import { bookDisplayName, cx, formatCents } from "@/lib/format";
import type { Theme } from "@/lib/types";

const RAIL = [
  { label: "NFL", icon: "🏈", href: "/games", active: true },
  { label: "Live now", icon: "🔴" },
  { label: "MLB", icon: "⚾" },
  { label: "NBA", icon: "🏀" },
  { label: "NCAAF", icon: "🏈" },
  { label: "Soccer", icon: "⚽" },
];

const ALL_SPORTS = [
  { label: "NHL", icon: "🏒" },
  { label: "Tennis", icon: "🎾" },
  { label: "MMA", icon: "🥊" },
  { label: "Golf", icon: "⛳" },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const { ready, theme, pickerOpen, openPicker, closePicker, chooseTheme, themeError, user, usage, wallet, logout, slip, openPaywall } =
    useApp();
  const pathname = usePathname();
  const [slipOpen, setSlipOpen] = useState(false);
  const skin: Theme = theme ?? "fanduel";

  if (!ready) return <div className="boot-screen" />;

  const loggedIn = Boolean(user);
  const showTries = Boolean(user && usage?.paywall_enabled);

  return (
    <>
      <div className={cx("skin-picker", pickerOpen && "is-open")} role="dialog" aria-labelledby="skin-picker-title">
        <div className="skin-picker-inner">
          <div className="skin-picker-logo">
            Plan <span>·</span> NFL
          </div>
          <h1 id="skin-picker-title" className="picker-title">
            Which sportsbook do you use?
          </h1>
          <p className="skin-picker-sub">We will theme Plan to match — same odds board, plus hit rates on props.</p>
          <div className="skin-cards">
            <button type="button" className="skin-card fd" onClick={() => void chooseTheme("fanduel")}>
              <span className="skin-card-badge">Light board</span>
              <h3>FanDuel</h3>
              <p>Royal blue header, navy rail, white odds buttons, Spread · Money · Total.</p>
              <div className="skin-card-swatches">
                <span className="swatch" style={{ background: "#1c57c4" }} />
                <span className="swatch" style={{ background: "#0c1b33" }} />
                <span className="swatch" style={{ background: "#1493FF" }} />
                <span className="swatch" style={{ background: "#1db954" }} />
                <span className="swatch" style={{ background: "#e8eef5" }} />
              </div>
            </button>
            <button type="button" className="skin-card dk" onClick={() => void chooseTheme("draftkings")}>
              <span className="skin-card-badge">Dark board</span>
              <h3>DraftKings</h3>
              <p>Near-black board, green prices, date-grouped games, Spread · Total · Moneyline.</p>
              <div className="skin-card-swatches">
                <span className="swatch" style={{ background: "#000" }} />
                <span className="swatch" style={{ background: "#131313" }} />
                <span className="swatch" style={{ background: "#53d337" }} />
                <span className="swatch" style={{ background: "#2e2e2e" }} />
                <span className="swatch" style={{ background: "#f0f0f0" }} />
              </div>
            </button>
          </div>
          {theme ? (
            <button type="button" className="picker-cancel" onClick={closePicker}>
              Keep {bookDisplayName(theme)}
            </button>
          ) : (
            <p className="skin-picker-note">Logged-out choice is saved on this device. Switch anytime from the header.</p>
          )}
          {themeError ? <p className="picker-error">{themeError}</p> : null}
        </div>
      </div>

      <div className="app visible">
        <div className="top-strip">
          <span className="active">SPORTSBOOK</span>
          <span>CASINO</span>
          <span>FANTASY</span>
          <span>RACEBOOK</span>
          <span className="strip-note">Plan · 21+ · Responsible Gaming · Play money</span>
        </div>
        <header className="header">
          <Link href="/games" className="header-logo">
            <span className="fd-mark">FanDuel</span>
            <span className="dk-mark">DK</span>
            <span className="dk-word">Sportsbook</span>
            <span className="plan">× Plan</span>
          </Link>
          <nav className="header-nav">
            <Link href="/games" className={pathname.startsWith("/games") ? "active" : ""}>
              Home
            </Link>
            <Link href="/bets" className={pathname.startsWith("/bets") ? "active" : ""}>
              My Bets
            </Link>
            <Link href="/promotions" className={pathname.startsWith("/promotions") ? "active" : ""}>
              Promotions
            </Link>
            <span className="nav-muted" title="Live betting is not offered">
              Live
            </span>
          </nav>
          <div className="header-actions">
            {showTries ? (
              <button type="button" className="tries-pill" onClick={() => openPaywall(usage?.tries_remaining === 0 ? "out_of_tries" : "browse")}>
                {usage?.tries_remaining == null ? "Unlimited" : `${usage?.tries_remaining} tries`}
              </button>
            ) : null}
            {loggedIn && wallet ? (
              <Link href="/wallet" className="balance-pill">
                {formatCents(wallet.balance_cents)}
              </Link>
            ) : null}
            <button type="button" className="btn-switch-skin" onClick={openPicker}>
              Switch book
            </button>
            {loggedIn ? (
              <>
                <span className="user-chip">{user?.display_name || user?.email}</span>
                <button type="button" className="btn-ghost" onClick={() => void logout()}>
                  Log out
                </button>
              </>
            ) : skin === "fanduel" ? (
              <>
                <Link href="/login" className="btn-ghost">
                  Log in
                </Link>
                <Link href="/signup" className="btn-cta">
                  Join now
                </Link>
              </>
            ) : (
              <Link href="/signup" className="btn-cta">
                Sign Up or Log In
              </Link>
            )}
          </div>
        </header>
        <div className="body-row">
          <aside className="left-rail" aria-label="Sports">
            <div className="rail-section">
              <div className="rail-label">Popular</div>
              {RAIL.map((item) =>
                item.href ? (
                  <Link key={item.label} href={item.href} className={item.active ? "rail-item active" : "rail-item"}>
                    <span className="rail-icon">{item.icon}</span>
                    <span className="label">{item.label}</span>
                  </Link>
                ) : (
                  <div key={item.label} className="rail-item rail-soon" title="NFL only">
                    <span className="rail-icon">{item.icon}</span>
                    <span className="label">{item.label}</span>
                  </div>
                ),
              )}
            </div>
            <div className="rail-section">
              <div className="rail-label">All Sports</div>
              {ALL_SPORTS.map((item) => (
                <div key={item.label} className="rail-item rail-soon" title="NFL only">
                  <span className="rail-icon">{item.icon}</span>
                  <span className="label">{item.label}</span>
                </div>
              ))}
            </div>
          </aside>
          <main className="main-board">{children}</main>
          <aside className={cx("bet-slip-col", slipOpen && "open")} aria-label="Bet slip">
            <BetSlip onClose={() => setSlipOpen(false)} />
          </aside>
        </div>
        {slipOpen ? <button type="button" className="slip-backdrop" aria-label="Close bet slip" onClick={() => setSlipOpen(false)} /> : null}
        <button type="button" className="slip-fab" onClick={() => setSlipOpen(true)}>
          Betslip <span className="slip-count">{slip.length}</span>
        </button>
      </div>
      <PaywallModal />
    </>
  );
}
