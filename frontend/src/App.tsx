import { Providers } from "@/app/providers";
import { OverviewPage } from "@/features/overview/OverviewPage";

export default function App() {
  return (
    <Providers>
      <OverviewPage />
    </Providers>
  );
}
