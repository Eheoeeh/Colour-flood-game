const LS_AD_STATS = "cf_ad_stats_v1";
const LS_AD_FREE_UNTIL = "cf_ad_free_until";

export interface AdStats {
  totalAdsWatched: number;
  totalCoinsEarnedFromAds: number;
  totalLevelsCompleted: number;
  sessionCount: number;
}

const DEFAULT_STATS: AdStats = {
  totalAdsWatched: 0,
  totalCoinsEarnedFromAds: 0,
  totalLevelsCompleted: 0,
  sessionCount: 0,
};

export function loadAdStats(): AdStats {
  try {
    const raw = localStorage.getItem(LS_AD_STATS);
    if (!raw) return { ...DEFAULT_STATS };
    return { ...DEFAULT_STATS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_STATS };
  }
}

export function saveAdStats(stats: AdStats): void {
  try {
    localStorage.setItem(LS_AD_STATS, JSON.stringify(stats));
  } catch {}
}

export function incrementAdsWatched(coinsEarned = 0): AdStats {
  const stats = loadAdStats();
  const next: AdStats = {
    ...stats,
    totalAdsWatched: stats.totalAdsWatched + 1,
    totalCoinsEarnedFromAds: stats.totalCoinsEarnedFromAds + coinsEarned,
  };
  saveAdStats(next);
  console.log(
    `[AdMob] Ad watched. Total ads: ${next.totalAdsWatched}. Coins from ads: ${next.totalCoinsEarnedFromAds}.`
  );
  if (next.totalAdsWatched % 10 === 0) {
    unlockAdFreeHour();
    console.log("[AdMob] 🎉 Ad-Free Hour unlocked after 10 ads!");
  }
  return next;
}

export function incrementLevelsCompleted(): void {
  const stats = loadAdStats();
  const next = { ...stats, totalLevelsCompleted: stats.totalLevelsCompleted + 1 };
  saveAdStats(next);
  console.log(`[AdMob] Level completed. Total levels: ${next.totalLevelsCompleted}`);
}

export function incrementSessionCount(): void {
  const stats = loadAdStats();
  saveAdStats({ ...stats, sessionCount: stats.sessionCount + 1 });
  console.log(`[AdMob] Session started. Total sessions: ${stats.sessionCount + 1}`);
}

export function isAdFreeHour(): boolean {
  try {
    const until = localStorage.getItem(LS_AD_FREE_UNTIL);
    if (!until) return false;
    const active = Date.now() < parseInt(until, 10);
    if (active) console.log("[AdMob] Ad-Free Hour is active — skipping interstitial");
    return active;
  } catch {
    return false;
  }
}

export function unlockAdFreeHour(): void {
  try {
    const until = Date.now() + 60 * 60 * 1000;
    localStorage.setItem(LS_AD_FREE_UNTIL, String(until));
  } catch {}
}

let levelsThisSession = 0;

export function checkInterstitialTrigger(): boolean {
  levelsThisSession++;
  const should = levelsThisSession % 3 === 0;
  if (should) {
    console.log(
      `[AdMob] Interstitial triggered (${levelsThisSession} levels completed this session)`
    );
  }
  return should;
}
