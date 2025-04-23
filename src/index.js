import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import App from "./App";
import Chantiers from "./Chantiers";
import AddChantier from "./AddChantier";
import Chantier from "./Chantier";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Chantiers />} />
        <Route path="/chantier/:id" element={<Chantier />} />
        <Route path="add-chantier" element={<AddChantier />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
