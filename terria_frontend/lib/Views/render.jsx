import { observer } from "mobx-react";
import PropTypes from "prop-types";
import React, { Suspense } from "react";
import { createRoot } from "react-dom/client";
import Variables from "../Styles/variables.scss";
import "./global.scss";
import { Loader } from "./Loader";
import { terriaStore } from "./terriaStore";
import { readPersistedLang } from "./AppContext";
import { parseHash } from "./urlState";

// Captured once at mount so the initial fly-to / lang / quintile / year
// don't shift as TerriaJS or our own writers update the hash later.
const INITIAL_HASH_STATE = typeof window !== "undefined"
  ? parseHash(window.location.hash)
  : {};

// Lazy load the entire TerriaUserInterface component
const LazyTerriaUserInterface = React.lazy(() =>
  import("./UserInterface").then((module) => ({
    default: module.TerriaUserInterface
  }))
);

const Root = observer(({ themeOverrides }) => {
  const { terria, viewState, status } = terriaStore;
  const lang = INITIAL_HASH_STATE.lang || readPersistedLang();

  if (status === "loading") {
    return <Loader lang={lang} />;
  }

  return (
    <>
      <Suspense fallback={<Loader lang={lang} />}>
        <LazyTerriaUserInterface
          terria={terria}
          viewState={viewState}
          themeOverrides={themeOverrides}
          initialHashState={INITIAL_HASH_STATE}
        />
      </Suspense>
      <Loader overlay terria={terria} lang={lang} />
    </>
  );
});

Root.propTypes = {
  themeOverrides: PropTypes.object
};

export const renderUi = () => {
  const container = document.getElementById("ui");
  if (!container) {
    console.error("Container element with id 'ui' not found.");
    return;
  }

  const root = createRoot(container);
  root.render(<Root themeOverrides={Variables} />);
};
