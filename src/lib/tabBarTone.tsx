import { createContext, ReactNode, useContext, useEffect, useState } from 'react';

/**
 * Whether the tab bar sits under video. Home says so only while a video is
 * actually on screen (not under the time-up lock or an empty Following feed);
 * there the bar is dark in every theme.
 */
const Ctx = createContext<{ onVideo: boolean; setOnVideo: (v: boolean) => void }>({ onVideo: false, setOnVideo: () => {} });

export function TabBarToneProvider({ children }: { children: ReactNode }) {
  const [onVideo, setOnVideo] = useState(false);
  return <Ctx.Provider value={{ onVideo, setOnVideo }}>{children}</Ctx.Provider>;
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
