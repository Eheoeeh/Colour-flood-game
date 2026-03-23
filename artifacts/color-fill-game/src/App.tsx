import { useState, useCallback, useEffect } from "react";
import MenuScreen from "@/pages/MenuScreen";
import LevelSelect from "@/pages/LevelSelect";
import Game from "@/pages/game";
import SettingsScreen from "@/pages/SettingsScreen";
import AdOverlay from "@/components/AdOverlay";
import type { AdType } from "@/components/AdOverlay";
import {
  loadProgress,
  saveProgress,
  updateLevelProgress,
  saveOverallBest,
  TOTAL_LEVELS,
} from "@/lib/levels";
import type { LevelProgress } from "@/lib/levels";
import {
  isAdFreeHour,
  checkInterstitialTrigger,
  incrementAdsWatched,
  incrementLevelsCompleted,
  incrementSessionCount,
} from "@/lib/ads";

type Screen = "menu" | "levelselect" | "game" | "settings";

interface AdRequest {
  type: AdType;
  label?: string;
  onComplete: (watched: boolean) => void;
}

export default function App() {
  const [screen, setScreen] = useState<Screen>("menu");
  const [currentLevel, setCurrentLevel] = useState(1);
  const [progress, setProgress] = useState<LevelProgress[]>(loadProgress);
  const [settingsReturnTo, setSettingsReturnTo] = useState<Screen>("menu");
  const [adRequest, setAdRequest] = useState<AdRequest | null>(null);

  useEffect(() => {
    incrementSessionCount();
  }, []);

  // ── Interstitial ─────────────────────────────────────────────────────────
  const showInterstitialAd = useCallback((callback: () => void) => {
    if (isAdFreeHour()) {
      setTimeout(callback, 100);
      return;
    }
    console.log("[AdMob] Scheduling interstitial (1s delay)...");
    setTimeout(() => {
      setAdRequest({
        type: "interstitial",
        onComplete: () => {
          incrementAdsWatched(0);
          setAdRequest(null);
          callback();
        },
      });
    }, 1000);
  }, []);

  // ── Rewarded ─────────────────────────────────────────────────────────────
  const showRewardedAd = useCallback(
    (label: string, callback: (watched: boolean) => void) => {
      console.log(`[AdMob] Opening rewarded ad: "${label}"`);
      setAdRequest({
        type: "rewarded",
        label,
        onComplete: (watched) => {
          if (watched) incrementAdsWatched(0);
          setAdRequest(null);
          callback(watched);
        },
      });
    },
    []
  );

  // ── Level complete ────────────────────────────────────────────────────────
  const handleLevelComplete = useCallback(
    (stars: number, score: number) => {
      const next = updateLevelProgress(currentLevel, stars, progress);
      setProgress(next);
      saveProgress(next);
      saveOverallBest(score);
      incrementLevelsCompleted();

      if (checkInterstitialTrigger()) {
        showInterstitialAd(() => {
          console.log("[AdMob] Interstitial closed, player continues.");
        });
      }
    },
    [currentLevel, progress, showInterstitialAd]
  );

  const handleSelectLevel = (n: number) => {
    setCurrentLevel(n);
    setScreen("game");
  };

  const handleNextLevel = () => {
    if (currentLevel < TOTAL_LEVELS) {
      setCurrentLevel(prev => prev + 1);
    } else {
      setScreen("levelselect");
    }
  };

  const openSettings = (returnTo: Screen) => {
    setSettingsReturnTo(returnTo);
    setScreen("settings");
  };

  // ── Rewarded: Watch ad to continue after game over ────────────────────────
  const handleWatchAdContinue = useCallback(
    (onGranted: (extraMoves: number, extraSecs: number) => void) => {
      showRewardedAd("Watch to get 5 extra moves + 10s!", (watched) => {
        if (watched) {
          console.log("[AdMob] Reward granted: +5 moves, +10 seconds");
          onGranted(5, 10);
        }
      });
    },
    [showRewardedAd]
  );

  // ── Rewarded: Watch ad for hint (reveal next 3 best moves) ───────────────
  const handleWatchAdHint = useCallback(
    (onGranted: () => void) => {
      showRewardedAd("Watch to reveal the next 3 best moves!", (watched) => {
        if (watched) {
          console.log("[AdMob] Reward granted: hint reveal");
          onGranted();
        }
      });
    },
    [showRewardedAd]
  );

  // ── Rewarded: Watch ad for coins (in Settings) ────────────────────────────
  const handleWatchAdForCoins = useCallback(
    (onGranted: (coins: number) => void) => {
      showRewardedAd("Watch to earn +50 coins!", (watched) => {
        if (watched) {
          incrementAdsWatched(50);
          console.log("[AdMob] Reward granted: +50 coins");
          onGranted(50);
        }
      });
    },
    [showRewardedAd]
  );

  return (
    <>
      {screen === "menu" && (
        <MenuScreen
          onPlay={() => setScreen("levelselect")}
          onSettings={() => openSettings("menu")}
          progress={progress}
        />
      )}
      {screen === "levelselect" && (
        <LevelSelect
          progress={progress}
          onSelectLevel={handleSelectLevel}
          onBack={() => setScreen("menu")}
        />
      )}
      {screen === "game" && (
        <Game
          key={currentLevel}
          levelNum={currentLevel}
          onBack={() => setScreen("levelselect")}
          onNextLevel={handleNextLevel}
          onLevelComplete={handleLevelComplete}
          onGoSettings={() => openSettings("levelselect")}
          onWatchAdContinue={handleWatchAdContinue}
          onWatchAdHint={handleWatchAdHint}
        />
      )}
      {screen === "settings" && (
        <SettingsScreen
          onBack={() => setScreen(settingsReturnTo)}
          onWatchAdForCoins={handleWatchAdForCoins}
        />
      )}

      {adRequest && (
        <AdOverlay
          type={adRequest.type}
          label={adRequest.label}
          onComplete={adRequest.onComplete}
        />
      )}
    </>
  );
}
