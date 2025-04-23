import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "./supabaseClient";
import "./styles.css";
import logo from "./logoHD.png";
import trashcan from "./red-trash-can-icon.svg";

function ChantiersList() {
  const [chantiers, setChantiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [chantierToDelete, setChantierToDelete] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchChantiers();
  }, []);

  const fetchChantiers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.from("chantiers").select("*");

      if (error) throw error;
      setChantiers(data);
    } catch (error) {
      console.error(
        "Erreur lors de la récupération des chantiers:",
        error.message
      );
    } finally {
      setLoading(false);
    }
  };

  const handleClick = (chantierId) => {
    navigate(`/chantier/${chantierId}`);
  };

  const handleDeleteClick = (chantierId, e) => {
    e.stopPropagation();
    setChantierToDelete(chantierId);
    setShowDeleteModal(true);
  };

  const confirmDelete = async (shouldDelete) => {
    if (!shouldDelete || !chantierToDelete) {
      setShowDeleteModal(false);
      return;
    }

    try {
      const { error } = await supabase
        .from("chantiers")
        .delete()
        .eq("id", chantierToDelete);

      if (error) throw error;
      setChantiers(
        chantiers.filter((chantier) => chantier.id !== chantierToDelete)
      );
    } catch (error) {
      console.error(
        "Erreur lors de la suppression du chantier:",
        error.message
      );
    } finally {
      setShowDeleteModal(false);
      setChantierToDelete(null);
    }
  };

  if (loading) return <div className="loading-state">Chargement...</div>;
  if (chantiers.length === 0)
    return <div className="empty-state">Aucun chantier trouvé</div>;

  return (
    <>
      <img className="logo" src={logo} alt="Logo" />
      <div className="list-container">
        <h2 className="list-heading">Chantiers</h2>
        <button
          className="action-button"
          onClick={() => navigate("/add-chantier")}
        >
          Ajouter un chantier
        </button>
        <ul className="list">
          {chantiers.map((chantier) => (
            <li
              key={chantier.id}
              className="list-item"
              onClick={() => handleClick(chantier.id)}
            >
              <div className="item-header">
                <h3 className="item-title">
                  {chantier.name || "Chantier sans nom"}
                </h3>
                <span className="item-meta">
                  Créé le: {new Date(chantier.created_at).toLocaleDateString()}
                </span>
              </div>

              <div className="item-content">
                <p>
                  <strong>Adresse:</strong>{" "}
                  {chantier.address || "Non spécifiée"}
                </p>
                {
                  <p className="item-description">
                    <strong>Description:</strong>{" "}
                    {!chantier.description
                      ? "Aucune description"
                      : chantier.description}
                  </p>
                }
              </div>
              <img
                src={trashcan}
                className="delete-button"
                onClick={(e) => handleDeleteClick(chantier.id, e)}
                aria-label="Supprimer le chantier"
              />
            </li>
          ))}
        </ul>
      </div>

      {showDeleteModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-content">
              <h3>Confirmation de suppression</h3>
              <p>Êtes-vous sûr de vouloir supprimer ce chantier ?</p>
              <div className="modal-buttons">
                <button
                  className="confirm-button"
                  onClick={() => confirmDelete(true)}
                >
                  Oui, supprimer
                </button>
                <button
                  className="cancel-button"
                  onClick={() => confirmDelete(false)}
                >
                  Annuler
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default ChantiersList;
