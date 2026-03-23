import { useState } from "react";
import MenuScreen from "@/pages/MenuScreen";
import LevelSelect from "@/pages/LevelSelect";
import Game from "@/pages/game";
import SettingsScreen from "@/pages/SettingsScreen";
import {
  loadProgress,
  saveProgress,
  updateLevelProgress,
  saveOverallBest,
  TOTAL_LEVELS,
} from "@/lib/levels";
import type { LevelProgress } from "@/lib/levels";

type Screen = "menu" | "levelselect" | "game" | "settings";

export default function App() {
  const [screen, setScreen] = useState<Screen>("menu");
  const [currentLevel, setCurrentLevel] = useState(1);
  const [progress, setProgress] = useState<LevelProgress[]>(loadProgress);
  const [settingsReturnTo, setSettingsReturnTo] = useState<Screen>("menu");

  const handleSelectLevel = (n: number) => {
    setCurrentLevel(n);
    setScreen("game");
  };

  const handleLevelComplete = (stars: number, score: number) => {
    const next = updateLevelProgress(currentLevel, stars, progress);
    setProgress(next);
    saveProgress(next);
    saveOverallBest(score);
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
        />
      )}
      {screen === "settings" && (
        <SettingsScreen onBack={() => setScreen(settingsReturnTo)} />
      )}
    </>
  );
}
