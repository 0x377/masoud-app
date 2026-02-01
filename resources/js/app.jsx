import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../css/app.css";
import StartApp from "./Start.jsx";
import { Provider } from "react-redux";
import { PersistGate } from "redux-persist/integration/react";
import { store, persistor } from "./Store/store";
import { BrowserRouter as Router } from "react-router-dom";

const root = createRoot(document.getElementById("root"));
root.render(
  <StrictMode>
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <Router>
          <StartApp />
        </Router>
      </PersistGate>
    </Provider>
  </StrictMode>,
);
