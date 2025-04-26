import { useState, useEffect } from "react";
import { redirect, useNavigate } from "react-router-dom";
import { supabase } from "./supabaseClient";
import "./styles.css";
import logo from "./logoHD.png";
import trashcan from "./red-trash-can-icon.svg";

function ChantiersList() {
  const [chantiers, setChantiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [chantierToDelete, setChantierToDelete] = useState(null);
  const [chantierStats, setChantierStats] = useState({});
  const navigate = useNavigate();

  useEffect(() => {
    fetchChantiers();
  }, []);

  const fetchChantiers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("chantiers")
        .select("*")
        .eq("user_id", localStorage.getItem("user_id"));

      if (error) throw error;
      setChantiers(data);
      await loadStatsForChantiers(data);
    } catch (error) {
      console.error("Erreur récupération chantiers:", error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadStatsForChantiers = async (chantiersList) => {
    const stats = {};

    for (const chantier of chantiersList) {
      const { totalHours, netTotal } = await calculateChantierStats(
        chantier.id
      );
      stats[chantier.id] = { totalHours, netTotal };
    }

    setChantierStats(stats);
  };

  const calculateChantierStats = async (chantierId) => {
    try {
      // Get time entries
      const { data: timeEntries, error: timeError } = await supabase
        .from("daily_hours")
        .select("arrived_at, departed_at, hourly_rate")
        .eq("chantier_id", chantierId);

      if (timeError) throw timeError;

      // Get expenses
      const { data: expenses, error: expensesError } = await supabase
        .from("expenses")
        .select("amount")
        .eq("chantier_id", chantierId);

      if (expensesError) throw expensesError;

      // Calculate total hours
      let totalMinutes = 0;
      let totalEarnings = 0;

      timeEntries.forEach((entry) => {
        if (entry.arrived_at && entry.departed_at) {
          const [arrivedHours, arrivedMins] = entry.arrived_at
            .split(":")
            .map(Number);
          const [departedHours, departedMins] = entry.departed_at
            .split(":")
            .map(Number);

          let minutes =
            departedHours * 60 +
            departedMins -
            (arrivedHours * 60 + arrivedMins);
          if (minutes < 0) minutes += 24 * 60;

          totalMinutes += minutes;
          totalEarnings += (minutes / 60) * (entry.hourly_rate || 0);
        }
      });

      // Calculate total expenses
      const totalExpenses = expenses.reduce((sum, expense) => {
        return sum + (parseFloat(expense.amount) || 0);
      }, 0);

      // Calculate net total
      const netTotal = totalEarnings + totalExpenses;

      // Convert total minutes to hours
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      const totalHours = `${hours}h ${minutes}m`;

      return {
        totalHours,
        netTotal: `€${netTotal.toFixed(2)}`,
      };
    } catch (error) {
      console.error("Erreur calcul stats:", error);
      return { totalHours: "0h 0m", netTotal: "€0.00" };
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
      setChantierStats((prev) => {
        const newStats = { ...prev };
        delete newStats[chantierToDelete];
        return newStats;
      });
    } catch (error) {
      console.error("Erreur suppression chantier:", error.message);
    } finally {
      setShowDeleteModal(false);
      setChantierToDelete(null);
    }
  };

  if (loading) return <div className="loading-state">Chargement...</div>;
  if (chantiers.length === 0)
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
          <div className="empty-state">Aucun chantier trouvé</div>
          <button
            className="logout-button"
            onClick={() => {
              localStorage.setItem("isAuthenticated", "false");
              localStorage.removeItem("user_id");
              window.location.reload();
            }}
          >
            Logout
          </button>
        </div>
      </>
    );

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
                <p className="item-description">
                  <strong>Description:</strong>{" "}
                  {!chantier.description
                    ? "Aucune description"
                    : chantier.description}
                </p>
                <div className="item-stats">
                  <p className="stat-value blue">
                    <strong>Total heures:</strong>{" "}
                    {chantierStats[chantier.id]?.totalHours || "Calcul..."}
                  </p>
                  <p className="stat-value purple">
                    <strong>Total net:</strong>{" "}
                    {chantierStats[chantier.id]?.netTotal || "Calcul..."}
                  </p>
                </div>
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
        <button
          className="logout-button"
          onClick={() => {
            localStorage.setItem("isAuthenticated", "false");
            localStorage.removeItem("user_id");
            window.location.reload();
            redirect("/");
          }}
        >
          Logout
        </button>
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
