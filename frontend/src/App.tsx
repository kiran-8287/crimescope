import { BrowserRouter } from "react-router-dom";
import { Providers } from "@/app/providers";
import { router } from "@/app/router";
import { RouterProvider } from "react-router-dom";

export default function App() {
  return (
    <BrowserRouter>
      <Providers>
        <RouterProvider router={router} />
      </Providers>
    </BrowserRouter>
  );
}
