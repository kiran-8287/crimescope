import { BrowserRouter } from "react-router-dom";
import { Providers } from "@/app/providers";
import { router } from "@/app/router";

export default function App() {
  return (
    <BrowserRouter>
      <Providers>
        <RouterProvider router={router} />
      </Providers>
    </BrowserRouter>
  );
}
