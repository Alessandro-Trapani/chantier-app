import { Routes, Route } from "react-router-dom";
import Chantiers from "./Chantiers";

function App() {
  return (
    <Routes>
      <Route path="/chantiers" element={<Chantiers />} />
    </Routes>
  );
}

export default App;
