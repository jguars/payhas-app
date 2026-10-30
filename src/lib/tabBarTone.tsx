import { createContext, ReactNode, useContext, useEffect, useState } from 'react';

/**
 * Whether the tab bar sits under video. Home says so only while a video is
 * actually on screen (not under the time-up lock or an empty Following feed);
 * there the bar is dark in every theme.
 */
const Ctx = createContext<{ onVideo: boolean; setOnVideo: (v: boolean) => void; hidden: boolean; setHidden: (v: boolean) => void }>({
  onVideo: false,
  setOnVideo: () => {},
  hidden: false,
  setHidden: () => {},
});

export function TabBarToneProvider({ children }: { children: ReactNode }) {
  const [onVideo, setOnVideo] = useState(false);
  const [hidden, setHidden] = useState(false);
  return <Ctx.Provider value={{ onVideo, setOnVideo, hidden, setHidden }}>{children}</Ctx.Provider>;
}

/** True while Home's full display is on: the bar keeps its place but shows nothing and takes no taps. */
export const useTabBarHidden = () => useContext(Ctx).hidden;

/** Home calls this with whether full display is on. */
export function useHideTabBar(hide: boolean) {
  const { setHidden } = useContext(Ctx);
  useEffect(() => {
    setHidden(hide);
    return () => setHidden(false);
  }, [hide, setHidden]);
}

/** The bar reads this; it only counts while Home is the focused tab. */
export const useTabBarOnVideo = () => useContext(Ctx).onVideo;

/** Home calls this with whether a video is showing right now. */
export function useReportVideoUnderBar(showing: boolean) {
  const { setOnVideo } = useContext(Ctx);
  useEffect(() => {
    setOnVideo(showing);
    return () => setOnVideo(false);
  }, [showing, setOnVideo]);
}
