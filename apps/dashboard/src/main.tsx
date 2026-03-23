
import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import "./styles/index.css";

// console.log("[Dashboard] main.tsx initializing...");
createRoot(document.getElementById("root")!).render(<App />);
// console.log("[Dashboard] main.tsx render called.");
   