import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import Chantiers from "./Chantiers";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/chantiers" replace />} />
      <Route path="/chantiers" element={<Chantiers />} />
    </Routes>
  );
}

export default App;
