import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import Chantiers from "./Chantiers";
import AddChantier from "./AddChantier";
import Chantier from "./Chantier";

function App() {
  return (
    <Router basename="/chantier-app">
      <Routes>
        <Route path="/" element={<Navigate to="/chantiers" replace />} />
        <Route path="/chantiers" element={<Chantiers />} />
        <Route path="/add-chantier" element={<AddChantier />} />
        <Route path="/chantier/:id" element={<Chantier />} />
      </Routes>
    </Router>
  );
}

export default App;
