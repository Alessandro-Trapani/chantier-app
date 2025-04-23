import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "./supabaseClient";
import trashcan from "./red-trash-can-icon.svg";
import "./styles.css";

function Chantier() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [chantier, setChantier] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeEntries, setTimeEntries] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [newEntry, setNewEntry] = useState({
    date: new Date().toISOString().split("T")[0],
    arrived_at: "",
    departed_at: "",
    hourly_rate: chantier?.hourly_rate || 0,
  });
  const [newExpense, setNewExpense] = useState({
    description: "",
    amount: "",
  });

  useEffect(() => {
    fetchChantier();
    fetchTimeEntries();
    fetchExpenses();
  }, [id]);

  const fetchChantier = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("chantiers")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      setChantier(data);
    } catch (error) {
      console.error(
        "Erreur lors de la récupération du chantier:",
        error.message
      );
    } finally {
      setLoading(false);
    }
  };

  const fetchTimeEntries = async () => {
    try {
      const { data, error } = await supabase
        .from("daily_hours")
        .select("*")
        .eq("chantier_id", id)
        .order("departed_at", { ascending: false });

      if (error) throw error;
      setTimeEntries(data || []);
    } catch (error) {
      console.error(
        "Erreur lors de la récupération des entrées de temps:",
        error.message
      );
    }
  };

  const fetchExpenses = async () => {
    try {
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .eq("chantier_id", id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setExpenses(data || []);
    } catch (error) {
      console.error(
        "Erreur lors de la récupération des dépenses:",
        error.message
      );
    }
  };

  const deleteTimeEntry = async (entryId) => {
    try {
      const { error } = await supabase
        .from("daily_hours")
        .delete()
        .eq("id", entryId);

      if (error) throw error;
      setTimeEntries(timeEntries.filter((entry) => entry.id !== entryId));
    } catch (error) {
      console.error(
        "Erreur lors de la suppression de l'entrée de temps:",
        error.message
      );
    }
  };

  const deleteExpense = async (expenseId) => {
    try {
      const { error } = await supabase
        .from("expenses")
        .delete()
        .eq("id", expenseId);

      if (error) throw error;
      setExpenses(expenses.filter((expense) => expense.id !== expenseId));
    } catch (error) {
      console.error(
        "Erreur lors de la suppression de la dépense:",
        error.message
      );
    }
  };

  const calculateHoursAndEarnings = (arrived, departed, rate) => {
    if (!arrived || !departed) return { hours: "0h 0m", earnings: "€0.00" };

    const [arrivedHours, arrivedMins] = arrived.split(":").map(Number);
    const [departedHours, departedMins] = departed.split(":").map(Number);

    let totalMinutes =
      departedHours * 60 + departedMins - (arrivedHours * 60 + arrivedMins);
    if (totalMinutes < 0) totalMinutes += 24 * 60;

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const decimalHours = totalMinutes / 60;
    const earnings = (decimalHours * rate).toFixed(2);

    return {
      hours: `${hours}h ${minutes}m`,
      earnings: `€${earnings}`,
    };
  };

  const calculateTotals = () => {
    let totalMinutes = 0;
    let totalEarnings = 0;
    let totalExpensesAmount = 0;

    timeEntries.forEach((entry) => {
      if (entry.arrived_at && entry.departed_at) {
        const [arrivedHours, arrivedMins] = entry.arrived_at
          .split(":")
          .map(Number);
        const [departedHours, departedMins] = entry.departed_at
          .split(":")
          .map(Number);

        let minutes =
          departedHours * 60 + departedMins - (arrivedHours * 60 + arrivedMins);
        if (minutes < 0) minutes += 24 * 60;

        totalMinutes += minutes;
        totalEarnings += (minutes / 60) * (entry.hourly_rate || 0);
      }
    });

    expenses.forEach((expense) => {
      totalExpensesAmount += parseFloat(expense.amount) || 0;
    });

    const totalHours = Math.floor(totalMinutes / 60);
    const remainingMinutes = totalMinutes % 60;

    return {
      totalHours: `${totalHours}h ${remainingMinutes}m`,
      totalEarnings: `€${totalEarnings.toFixed(2)}`,
      totalExpenses: `€${totalExpensesAmount.toFixed(2)}`,
      netEarnings: `€${(totalEarnings + totalExpensesAmount).toFixed(2)}`,
    };
  };

  const { totalHours, totalEarnings, totalExpenses, netEarnings } =
    calculateTotals();

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewEntry((prev) => ({ ...prev, [name]: value }));
  };

  const handleExpenseChange = (e) => {
    const { name, value } = e.target;
    setNewExpense((prev) => ({ ...prev, [name]: value }));
  };

  const addTimeEntry = async (e) => {
    e.preventDefault();
    try {
      const { data, error } = await supabase
        .from("daily_hours")
        .insert([
          {
            chantier_id: id,
            arrived_at: newEntry.arrived_at,
            departed_at: newEntry.departed_at,
            hourly_rate: parseFloat(newEntry.hourly_rate),
          },
        ])
        .select();

      if (error) throw error;
      setTimeEntries([data[0], ...timeEntries]);
      setNewEntry({
        arrived_at: "",
        departed_at: "",
        hourly_rate: chantier?.hourly_rate || 0,
      });
    } catch (error) {
      console.error(
        "Erreur lors de l'ajout de l'entrée de temps:",
        error.message
      );
    }
  };

  const addExpense = async (e) => {
    e.preventDefault();
    try {
      const { data, error } = await supabase
        .from("expenses")
        .insert([
          {
            chantier_id: id,
            description: newExpense.description,
            amount: parseFloat(newExpense.amount),
          },
        ])
        .select();

      if (error) throw error;
      setExpenses([data[0], ...expenses]);
      setNewExpense({
        description: "",
        amount: "",
      });
    } catch (error) {
      console.error("Erreur lors de l'ajout de la dépense:", error.message);
    }
  };

  if (loading) return <div className="loading-state">Chargement...</div>;
  if (!chantier) return <div className="empty-state">Chantier introuvable</div>;

  return (
    <div className="detail-container">
      <button onClick={() => navigate(-1)} className="back-button">
        ← Retour à la liste
      </button>

      <h2 className="detail-heading">{chantier.name || "Chantier sans nom"}</h2>

      <div className="detail-content">
        <div className="detail-section">
          <h3>Informations de base</h3>
          <p>
            <strong>Adresse :</strong> {chantier.address || "Non spécifiée"}
          </p>
          <p>
            <strong>Date de début :</strong>{" "}
            {chantier.start_date
              ? new Date(chantier.start_date).toLocaleDateString()
              : "Non spécifiée"}
          </p>
        </div>

        <div className="detail-section stats-section">
          <h3>Statistiques</h3>
          <div className="stats-grid">
            <div className="stat-card">
              <h4>Heures travaillées</h4>
              <div className="stat-value blue">{totalHours}</div>
            </div>
            <div className="stat-card">
              <h4>Total heures</h4>
              <div className="stat-value green">{totalEarnings}</div>
            </div>
            <div className="stat-card">
              <h4>Total dépenses</h4>
              <div className="stat-value red">{totalExpenses}</div>
            </div>
            <div className="stat-card">
              <h4>Total net</h4>
              <div className="stat-value purple">{netEarnings}</div>
            </div>
          </div>
        </div>

        {chantier.description && (
          <div className="detail-section">
            <h3>Description :</h3>
            <p>{chantier.description}</p>
          </div>
        )}

        <div className="detail-section">
          <h3>Suivi du temps</h3>

          <form onSubmit={addTimeEntry} className="time-form">
            <div className="form-row">
              <div className="form-group">
                <label>Date :</label>
                <input
                  type="date"
                  name="date"
                  value={newEntry.date}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="form-group">
                <label>Heure d'arrivée :</label>
                <input
                  type="time"
                  name="arrived_at"
                  value={newEntry.arrived_at}
                  placeholder="0"
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="form-group">
                <label>Heure de départ :</label>
                <input
                  type="time"
                  name="departed_at"
                  value={newEntry.departed_at}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="form-group">
                <label>Taux horaire (€) :</label>
                <input
                  type="number"
                  name="hourly_rate"
                  step="0.1"
                  min="0"
                  value={newEntry.hourly_rate}
                  onChange={handleInputChange}
                  required
                />
              </div>
            </div>
            <button type="submit" className="action-button">
              Ajouter une entrée
            </button>
          </form>

          <div className="time-entries">
            <h4>Entrées de temps</h4>
            {timeEntries.length === 0 ? (
              <p className="empty-state">Aucune entrée de temps enregistrée</p>
            ) : (
              <table className="time-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Arrivée</th>
                    <th>Départ</th>
                    <th>Heures</th>
                    <th>Taux</th>
                    <th>Gains</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {timeEntries.map((entry) => {
                    const { hours, earnings } = calculateHoursAndEarnings(
                      entry.arrived_at,
                      entry.departed_at,
                      entry.hourly_rate
                    );
                    return (
                      <tr key={entry.id}>
                        <td>
                          {new Date(entry.created_at).toLocaleDateString()}
                        </td>
                        <td>{entry.arrived_at}</td>
                        <td>{entry.departed_at}</td>
                        <td>{hours}</td>
                        <td>€{entry.hourly_rate?.toFixed(2)}</td>
                        <td>{earnings}</td>
                        <td>
                          <img
                            onClick={() => deleteTimeEntry(entry.id)}
                            className="delete-button"
                            aria-label="Supprimer l'entrée"
                            src={trashcan}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="detail-section">
          <h3>Dépenses</h3>

          <form onSubmit={addExpense} className="expense-form">
            <div className="form-row">
              <div className="form-group">
                <label>Description :</label>
                <input
                  type="text"
                  name="description"
                  placeholder="Description"
                  value={newExpense.description}
                  onChange={handleExpenseChange}
                  required
                />
              </div>
              <div className="form-group">
                <label>Montant (€) :</label>
                <input
                  type="number"
                  name="amount"
                  step="0.1"
                  min="0"
                  placeholder="0"
                  value={newExpense.amount}
                  onChange={handleExpenseChange}
                  required
                />
              </div>
            </div>
            <button type="submit" className="action-button">
              Ajouter une dépense
            </button>
          </form>

          <div className="expenses-list">
            <h4>Historique des dépenses</h4>
            {expenses.length === 0 ? (
              <p className="empty-state">Aucune dépense enregistrée</p>
            ) : (
              <table className="expense-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Montant</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((expense) => (
                    <tr key={expense.id}>
                      <td>
                        {new Date(expense.created_at).toLocaleDateString()}
                      </td>
                      <td>{expense.description}</td>
                      <td>€{parseFloat(expense.amount).toFixed(2)}</td>
                      <td>
                        <img
                          onClick={() => deleteExpense(expense.id)}
                          className="delete-button"
                          aria-label="Supprimer la dépense"
                          src={trashcan}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Chantier;
