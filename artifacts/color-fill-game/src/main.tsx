import { initStorage } from "./lib/storage";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Must run before any lib code reads localStorage
initStorage();

createRoot(document.getElementById("root")!).render(<App />);
