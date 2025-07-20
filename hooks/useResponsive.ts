import { useWindowDimensions } from 'react-native';

// These breakpoints are common, but you can adjust them for your app's design.
const breakpoints = {
  sm: 640, // Small devices (phones)
  md: 768, // Medium devices (tablets)
  lg: 1024, // Large devices (desktops)
};

export function useResponsive() {
  const { width, height } = useWindowDimensions();

  const isMobile = width < breakpoints.md;
  const isTablet = width >= breakpoints.md && width < breakpoints.lg;
  const isDesktop = width >= breakpoints.lg;

  return {
    width,
    height,
    isMobile,
    isTablet,
    isDesktop,
  };
}
