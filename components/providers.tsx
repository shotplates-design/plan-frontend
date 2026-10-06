"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { api, isApiError, isUnreachable, setAccessToken } from "@/lib/api";
import { demoGame } from "@/lib/demo-data";
import { loadSlip, saveSlip, type SlipLeg } from "@/lib/slip";
import type { MeOut, PackOut, SignupRequest, Theme, UsageOut, WalletOut } from "@/lib/types";

const SKIN_KEY = "plan-skin";

export type ApiMode = "unknown" | "live" | "demo";

interface AppContextValue {
  ready: boolean;
  theme: Theme | null;
  pickerOpen: boolean;
  openPicker: () => void;
  closePicker: () => void;
  chooseTheme: (theme: Theme) => Promise<void>;
  themeError: string | null;
  user: MeOut | null;
  usage: UsageOut | null;
  setUsage: (usage: UsageOut | null) => void;
  wallet: WalletOut | null;
  refreshWallet: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  signup: (input: { email: string; password: string; displayName?: string }) => Promise<void>;
  logout: () => Promise<void>;
  apiMode: ApiMode;
  noteLive: () => void;
  noteDemo: () => void;
  slip: SlipLeg[];
  toggleLeg: (leg: Omit<SlipLeg, "wagerCents"> & { wagerCents?: number }) => void;
  removeLeg: (key: string) => void;
  setLegStake: (key: string, wagerCents: number) => void;
  clearLegs: (keys: string[]) => void;
  paywallOpen: boolean;
  paywallReason: string | null;
  paywallPacks: PackOut[] | null;
  openPaywall: (reason?: string | null, packs?: PackOut[] | null) => void;
  closePaywall: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

function readDomTheme(): Theme | null {
  const value = document.documentElement.dataset.theme;
  return value === "fanduel" || value === "draftkings" ? value : null;
}

function writeTheme(theme: Theme | null) {
  if (theme) {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(SKIN_KEY, theme);
    } catch {
      /* ignore */
    }
  } else {
    delete document.documentElement.dataset.theme;
  }
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [theme, setTheme] = useState<Theme | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [themeError, setThemeError] = useState<string | null>(null);
  const [user, setUser] = useState<MeOut | null>(null);
  const [usage, setUsage] = useState<UsageOut | null>(null);
  const [wallet, setWallet] = useState<WalletOut | null>(null);
  const [apiMode, setApiMode] = useState<ApiMode>("unknown");
  const [slip, setSlip] = useState<SlipLeg[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [paywallReason, setPaywallReason] = useState<string | null>(null);
  const [paywallPacks, setPaywallPacks] = useState<PackOut[] | null>(null);
  const pruned = useRef(false);

  useEffect(() => {
    const initial = readDomTheme();
    if (initial) setTheme(initial);
    else setPickerOpen(true);
    setSlip(loadSlip());
    setHydrated(true);
    setReady(true);

    let cancel = false;
    void (async () => {
      try {
        const me = await api.me();
        if (cancel) return;
        setUser(me);
        setUsage(me.usage);
        if (me.theme) {
          setTheme(me.theme);
          setPickerOpen(false);
          writeTheme(me.theme);
        } else {
          setTheme(null);
          setPickerOpen(true);
          writeTheme(null);
        }
        try {
          const balance = await api.wallet();
          if (!cancel) setWallet(balance);
        } catch {
          /* wallet is optional on first paint */
        }
      } catch (err) {
        if (cancel) return;
        if (isApiError(err) && err.status === 401) setAccessToken(null);
      }
    })();

    return () => {
      cancel = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveSlip(slip);
  }, [slip, hydrated]);

  const noteDemo = useCallback(() => {
    setApiMode("demo");
    setSlip((prev) => prev.filter((leg) => demoGame(leg.gameId)));
  }, []);

  const noteLive = useCallback(() => {
    setApiMode("live");
    if (pruned.current) return;
    pruned.current = true;
    void (async () => {
      const legs = loadSlip();
      const ids = [...new Set(legs.map((leg) => leg.gameId))];
      const dead = new Set<string>();
      await Promise.all(
        ids.map(async (id) => {
          try {
            await api.getGame(id);
          } catch (err) {
            if (isApiError(err) && err.status === 404) dead.add(id);
          }
        }),
      );
      if (dead.size === 0) return;
      setSlip((prev) => prev.filter((leg) => !dead.has(leg.gameId)));
    })();
  }, []);

  const refreshWallet = useCallback(async () => {
    try {
      setWallet(await api.wallet());
    } catch (err) {
      if (isApiError(err) && err.status === 401) setWallet(null);
    }
  }, []);

  const applySession = useCallback(async (accessToken: string) => {
    setAccessToken(accessToken);
    const me = await api.me();
    setUser(me);
    setUsage(me.usage);
    if (me.theme) {
      setTheme(me.theme);
      setPickerOpen(false);
      writeTheme(me.theme);
    } else {
      setTheme(null);
      setPickerOpen(true);
      writeTheme(null);
    }
    await refreshWallet();
  }, [refreshWallet]);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await api.login({ email, password });
      await applySession(res.access_token);
    },
    [applySession],
  );

  const signup = useCallback(
    async (input: { email: string; password: string; displayName?: string }) => {
      const body: SignupRequest = {
        email: input.email,
        password: input.password,
        display_name: input.displayName?.trim() ? input.displayName.trim() : null,
        theme,
      };
      const res = await api.signup(body);
      await applySession(res.access_token);
    },
    [applySession, theme],
  );

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch (err) {
      if (!isUnreachable(err) && isApiError(err) && err.status !== 401) {
        /* still drop the local session */
      }
    }
    setAccessToken(null);
    setUser(null);
    setUsage(null);
    setWallet(null);
  }, []);

  const chooseTheme = useCallback(
    async (next: Theme) => {
      setTheme(next);
      setPickerOpen(false);
      setThemeError(null);
      writeTheme(next);
      if (!user) return;
      try {
        const prefs = await api.updatePreferences({ theme: next });
        setUser((current) => (current ? { ...current, theme: prefs.theme } : current));
      } catch (err) {
        if (isUnreachable(err)) {
          setThemeError("Saved on this device. The API is unreachable, so the choice was not synced.");
        } else if (isApiError(err)) {
          setThemeError(err.message);
        }
      }
    },
    [user],
  );

  const toggleLeg = useCallback((leg: Omit<SlipLeg, "wagerCents"> & { wagerCents?: number }) => {
    setSlip((prev) => {
      if (prev.some((item) => item.key === leg.key)) return prev.filter((item) => item.key !== leg.key);
      return [
        ...prev,
        {
          key: leg.key,
          gameId: leg.gameId,
          market: leg.market,
          desc: leg.desc,
          price: leg.price,
          line: leg.line,
          wagerCents: leg.wagerCents ?? 1000,
        },
      ];
    });
  }, []);

  const removeLeg = useCallback((key: string) => {
    setSlip((prev) => prev.filter((leg) => leg.key !== key));
  }, []);

  const setLegStake = useCallback((key: string, wagerCents: number) => {
    setSlip((prev) => prev.map((leg) => (leg.key === key ? { ...leg, wagerCents } : leg)));
  }, []);

  const clearLegs = useCallback((keys: string[]) => {
    const drop = new Set(keys);
    setSlip((prev) => prev.filter((leg) => !drop.has(leg.key)));
  }, []);

  const openPaywall = useCallback((reason?: string | null, packs?: PackOut[] | null) => {
    setPaywallReason(reason ?? null);
    setPaywallPacks(packs ?? null);
    setPaywallOpen(true);
  }, []);

  const closePaywall = useCallback(() => setPaywallOpen(false), []);

  const value = useMemo<AppContextValue>(
    () => ({
      ready,
      theme,
      pickerOpen,
      openPicker: () => setPickerOpen(true),
      closePicker: () => {
        if (theme) setPickerOpen(false);
      },
      chooseTheme,
      themeError,
      user,
      usage,
      setUsage,
      wallet,
      refreshWallet,
      login,
      signup,
      logout,
      apiMode,
      noteLive,
      noteDemo,
      slip,
      toggleLeg,
      removeLeg,
      setLegStake,
      clearLegs,
      paywallOpen,
      paywallReason,
      paywallPacks,
      openPaywall,
      closePaywall,
    }),
    [
      ready,
      theme,
      pickerOpen,
      chooseTheme,
      themeError,
      user,
      usage,
      wallet,
      refreshWallet,
      login,
      signup,
      logout,
      apiMode,
      noteLive,
      noteDemo,
      slip,
      toggleLeg,
      removeLeg,
      setLegStake,
      clearLegs,
      paywallOpen,
      paywallReason,
      paywallPacks,
      openPaywall,
      closePaywall,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within Providers");
  return ctx;
}
