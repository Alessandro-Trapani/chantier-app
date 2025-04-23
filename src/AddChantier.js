import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "./supabaseClient";
import "./styles.css";

function AddChantier() {
  const navigate = useNavigate();
  const [newChantier, setNewChantier] = useState({
    name: "",
    address: "",
    description: "",
    status: "active",
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const { data, error } = await supabase
        .from("chantiers")
        .insert([newChantier])
        .select();

      if (error) throw error;
      navigate("/");
    } catch (error) {
      console.error("Erreur lors de l'ajout du chantier :", error.message);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setNewChantier((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <div className="form-container">
      <h2>Ajouter un nouveau chantier</h2>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Nom :</label>
          <input
            type="text"
            name="name"
            value={newChantier.name}
            onChange={handleChange}
            required
          />
        </div>

        <div className="form-group">
          <label>Adresse :</label>
          <input
            type="text"
            name="address"
            value={newChantier.address}
            onChange={handleChange}
          />
        </div>

        <div className="form-group">
          <label>Description :</label>
          <textarea
            name="description"
            value={newChantier.description}
            onChange={handleChange}
          />
        </div>

        <div className="form-actions">
          <button type="button" onClick={() => navigate("/")}>
            Annuler
          </button>
          <button type="submit" className="action-button">
            Enregistrer le chantier
          </button>
        </div>
      </form>
    </div>
  );
}

export default AddChantier;
