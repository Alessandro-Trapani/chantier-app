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
  const [currentRate, setCurrentRate] = useState(0);
  const [currentRateInput, setCurrentRateInput] = useState("");
  const [newEntry, setNewEntry] = useState({
    date: new Date().toISOString().split("T")[0],
    arrived_at: new Date().toTimeString().slice(0, 5),
    departed_at: new Date().toTimeString().slice(0, 5),
  });
  const [newExpense, setNewExpense] = useState({
    description: "",
    amount: "",
    date: new Date().toISOString().split("T")[0],
  });
  const [hasBlockedTime, setHasBlockedTime] = useState(
    !!localStorage.getItem("blocked_arrival_time")
  );

  useEffect(() => {
    const fetchData = async () => {
      await fetchChantier();
      await fetchTimeEntries();
      await fetchExpenses();
    };
    fetchData();
  }, [id]);

  const fetchChantier = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("chantiers")
        .select("*")
        .eq("id", id)
        .eq("user_id", localStorage.getItem("user_id"))
        .single();

      if (error) throw error;
      setChantier(data);
      setCurrentRate(data.current_rate || 0);
      setCurrentRateInput(data.current_rate?.toString() || "");
    } catch (error) {
      console.error("Erreur récupération chantier:", error.message);
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
      console.error("Erreur récupération entrées de temps:", error.message);
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

      const expensesWithFiles = await Promise.all(
        data.map(async (expense) => {
          if (expense.file_path) {
            const {
              data: { signedUrl },
            } = await supabase.storage
              .from("expense-files")
              .createSignedUrl(expense.file_path, 3600);
            return { ...expense, file_url: signedUrl };
          }
          return expense;
        })
      );

      setExpenses(expensesWithFiles || []);
    } catch (error) {
      console.error("Erreur récupération dépenses:", error.message);
    }
  };

  const handleUpdateRate = async () => {
    const newRate = parseFloat(currentRateInput) || 0;
    try {
      const { error } = await supabase
        .from("chantiers")
        .update({ current_rate: newRate })
        .eq("id", id);

      if (error) throw error;
      setCurrentRate(newRate);
    } catch (error) {
      console.error("Erreur mise à jour taux:", error.message);
      setCurrentRateInput(currentRate.toString());
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
      console.error("Erreur suppression entrée:", error.message);
    }
  };

  const deleteExpense = async (expenseId) => {
    try {
      // Find the expense to get the file path
      const expenseToDelete = expenses.find((e) => e.id === expenseId);

      if (expenseToDelete?.file_path) {
        // Delete the file from storage
        const { error: storageError } = await supabase.storage
          .from("expense-files")
          .remove([expenseToDelete.file_path]);

        if (storageError) throw storageError;
      }

      // Delete the expense from the database
      const { error: dbError } = await supabase
        .from("expenses")
        .delete()
        .eq("id", expenseId);

      if (dbError) throw dbError;

      // Update local state
      setExpenses(expenses.filter((expense) => expense.id !== expenseId));
    } catch (error) {
      console.error("Erreur suppression dépense:", error.message);
      alert("Erreur lors de la suppression de la dépense. Veuillez réessayer.");
    }
  };

  const handleFileUpload = async (expenseId, file) => {
    if (!file) return;

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${expenseId}-${Date.now()}.${fileExt}`;
      const filePath = `expenses/${expenseId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("expense-files")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { error: updateError } = await supabase
        .from("expenses")
        .update({ file_path: filePath })
        .eq("id", expenseId);

      if (updateError) throw updateError;

      await fetchExpenses();
    } catch (error) {
      console.error("Erreur upload fichier:", error.message);
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
            date: newEntry.date,
            arrived_at:
              localStorage.getItem("blocked_arrival_time") ||
              newEntry.arrived_at.slice(0, 5),
            departed_at: newEntry.departed_at.slice(0, 5),
            hourly_rate: currentRate,
          },
        ])
        .select();

      if (error) throw error;

      setTimeEntries([data[0], ...timeEntries]);
      setNewEntry({
        date: new Date().toISOString().split("T")[0],
        arrived_at: "",
        departed_at: "",
      });
      localStorage.removeItem("blocked_arrival_time"); // Clear localStorage on submit
    } catch (error) {
      console.error("Erreur ajout entrée:", error.message);
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
            amount: parseFloat(newExpense.amount) || 0,
            date: newExpense.date,
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
      console.error("Erreur ajout dépense:", error.message);
    }
  };

  if (loading) return <div className="loading-state">Chargement...</div>;
  if (!chantier)
    return (
      <div className="empty-state">
        <button onClick={() => navigate(-1)} className="back-button">
          ← Retour
        </button>
        Chantier introuvable
      </div>
    );

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
          <div className="form-group">
            <label>Taux actuel (€) :</label>
            <div className="rate-update-container">
              <input
                className="taux"
                type="number"
                placeholder={chantier.current_rate}
                onChange={(e) => setCurrentRateInput(e.target.value)}
                step="0.1"
                min="0"
              />
              <button onClick={handleUpdateRate} className="update-rate-button">
                Mettre à jour
              </button>
            </div>
          </div>
        </div>

        <div className="detail-section stats-section">
          <h3>Statistiques</h3>
          <div className="stats-grid">
            <div className="stat-card">
              <h4>Heures travaillées</h4>
              <div className="stat-value blue">{totalHours}</div>
            </div>
            <div className="stat-card">
              <h4>Total gains</h4>
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
                <div style={{ display: "flex", gap: "8px" }}>
                  <input
                    type="time"
                    name="arrived_at"
                    step="900"
                    id="heure_arrive"
                    value={
                      localStorage.getItem("blocked_arrival_time") ||
                      newEntry.arrived_at
                    }
                    onChange={handleInputChange}
                    required
                    style={{
                      border: hasBlockedTime ? "2px dotted blue" : "",
                    }}
                  />
                </div>

                <button
                  className="action-button"
                  type="button"
                  onClick={() => {
                    const now = new Date();
                    const hours = String(now.getHours()).padStart(2, "0");
                    const minutes = String(now.getMinutes()).padStart(2, "0");
                    const currentTime = `${hours}:${minutes}`;

                    setNewEntry((prev) => ({
                      ...prev,
                      arrived_at: currentTime,
                    }));
                    localStorage.setItem("blocked_arrival_time", currentTime);
                    setHasBlockedTime(true); // Add this line
                  }}
                >
                  Bloquer
                </button>

                <button
                  className="red-btn action-button"
                  type="button"
                  onClick={() => {
                    localStorage.removeItem("blocked_arrival_time");
                    setHasBlockedTime(false); // Add this line
                  }}
                >
                  Débloquer
                </button>
              </div>
              <div className="form-group">
                <label>Heure de départ :</label>
                <input
                  type="time"
                  step="900"
                  name="departed_at"
                  value={newEntry.departed_at}
                  onChange={handleInputChange}
                  required
                />
              </div>
            </div>
            <button
              type="submit"
              className="action-button"
              onClick={() => {
                setHasBlockedTime(false);
              }}
            >
              Ajouter une entrée
            </button>
          </form>

          <div className="time-entries">
            <h4>Entrées de temps</h4>
            {timeEntries.length === 0 ? (
              <p className="empty-state">Aucune entrée enregistrée</p>
            ) : (
              <table className="time-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Arrivée</th>
                    <th>Départ</th>
                    <th>Heures</th>
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
                          {new Date(entry.date).toLocaleDateString("fr-FR", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                          })}
                        </td>
                        <td>{entry.arrived_at.toString().slice(0, 5)}</td>
                        <td>{entry.departed_at.toString().slice(0, 5)}</td>
                        <td>{hours}</td>
                        <td>{earnings}</td>
                        <td>
                          <img
                            src={trashcan}
                            className="delete-button"
                            onClick={() => deleteTimeEntry(entry.id)}
                            aria-label="Supprimer"
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
                <label>Date :</label>
                <input
                  type="date"
                  name="date"
                  value={newExpense.date}
                  onChange={handleExpenseChange}
                  required
                />
              </div>
              <div className="form-group">
                <label>Description :</label>
                <input
                  type="text"
                  placeholder="Description"
                  name="description"
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
                  placeholder="montant"
                  step="0.1"
                  min="0"
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
          <h4>Historique</h4>
          <div className="expenses-list">
            {expenses.length === 0 ? (
              <p className="empty-state">Aucune dépense</p>
            ) : (
              <table className="expense-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Montant</th>
                    <th>Fichier</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((expense) => (
                    <tr key={expense.id}>
                      <td>
                        {" "}
                        {new Date(expense.date).toLocaleDateString("fr-FR", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                        })}
                      </td>
                      <td>{expense.description}</td>
                      <td>€{parseFloat(expense.amount).toFixed(2)}</td>
                      <td>
                        {expense.file_url ? (
                          <a
                            href={expense.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="file-link"
                          >
                            📄 Voir
                          </a>
                        ) : (
                          <label className="file-upload-label">
                            <input
                              type="file"
                              onChange={(e) =>
                                handleFileUpload(expense.id, e.target.files[0])
                              }
                              style={{ display: "none" }}
                              accept="image/*,.pdf,.doc,.docx"
                            />
                            <span className="file-upload-button">
                              + Ajouter
                            </span>
                          </label>
                        )}
                      </td>
                      <td>
                        <img
                          src={trashcan}
                          className="delete-button"
                          onClick={() => deleteExpense(expense.id)}
                          aria-label="Supprimer"
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
