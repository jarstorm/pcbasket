import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";

// Calm, unhurried loops (a manager doesn't need arcade-action music) — all
// CC0 (public domain), OpenGameArt.org:
// - Town 1/2, Market theme 1 — Geomancer (opengameart.org/content/town-theme-1)
// - MainMenu Music ("dream") — jkjkke (opengameart.org/content/mainmenu-music)
// - Slow Stride Loop — isaiah658 (opengameart.org/content/slow-stride)
const TRACKS = [
  require("../../assets/audio/town1.mp3"),
  require("../../assets/audio/town2.mp3"),
  require("../../assets/audio/market1.mp3"),
  require("../../assets/audio/mainmenu.mp3"),
  require("../../assets/audio/slowstride.ogg"),
];

const STORAGE_KEY = "musicMuted";

function shuffledIndexes() {
  const a = TRACKS.map((_, i) => i);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const MusicContext = createContext(null);

// A shuffled, endlessly-looping playlist of short chiptune tracks instead
// of one single loop — reshuffles once it's played through all of them.
export function MusicProvider({ children }) {
  const [muted, setMuted] = useState(true);
  const [ready, setReady] = useState(false);
  const orderRef = useRef(shuffledIndexes());
  const [trackIndex, setTrackIndex] = useState(0);

  const player = useAudioPlayer(TRACKS[orderRef.current[0]]);
  const status = useAudioPlayerStatus(player);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((v) => {
      setMuted(v === "true");
      setReady(true);
    });
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (muted) player.pause();
    else player.play();
  }, [muted, ready, player]);

  useEffect(() => {
    if (!status.didJustFinish) return;
    let next = trackIndex + 1;
    if (next >= orderRef.current.length) {
      orderRef.current = shuffledIndexes();
      next = 0;
    }
    setTrackIndex(next);
    player.replace(TRACKS[orderRef.current[next]]);
    if (!muted) player.play();
  }, [status.didJustFinish, trackIndex, muted, player]);

  const toggleMute = () => {
    setMuted((m) => {
      const next = !m;
      AsyncStorage.setItem(STORAGE_KEY, String(next)).catch(() => {});
      return next;
    });
  };

  const value = useMemo(() => ({ muted, toggleMute }), [muted]);
  return <MusicContext.Provider value={value}>{children}</MusicContext.Provider>;
}

export function useMusic() {
  return useContext(MusicContext);
}
