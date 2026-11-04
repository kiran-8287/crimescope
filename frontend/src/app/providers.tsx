import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactProvider } from "@/app/providers/ReactProvider";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
    },
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ReactProvider>{children}</ReactProvider>
    </QueryClientProvider>
  );
}
