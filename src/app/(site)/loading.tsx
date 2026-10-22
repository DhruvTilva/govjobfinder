import { RouteLoader } from "@/components/Loader";

/** The only loading file for the public site: every page below shows the shared loader through it. */
export default function Loading() {
  return <RouteLoader />;
}
