import "./styles.css";

import { bootstrap } from "./app";

bootstrap().catch((error) => {
  console.error("Chromnotes: bootstrap failed.", error);
});
