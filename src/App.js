import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import Chantiers from "./Chantiers";

function App() {
  return (
    <Router basename="/chantier-app">
      <Routes>
        <Route path="/" element={<Navigate to="/chantiers" replace />} />
        <Route path="/chantiers" element={<Chantiers />} />
      </Routes>
    </Router>
  );
}

export default App;
