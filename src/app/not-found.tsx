import type { Metadata } from "next";
import SiteLayout from "./(site)/layout";
import SiteNotFound from "./(site)/not-found";

export const metadata: Metadata = { title: "Page not found" };

/** Unmatched URLs land here (outside the (site) group), so wrap the site chrome around the 404. */
export default function NotFound() {
  return (
    <SiteLayout>
      <SiteNotFound />
    </SiteLayout>
  );
}
