import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "./supabaseClient";
import "./styles.css";

function DailySummary() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [days, setDays] = useState([]);
  const [selectedDay, setSelectedDay] = useState(null);
  const [dayTimeEntries, setDayTimeEntries] = useState([]);
  const [dayExpenses, setDayExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [chantierRate, setChantierRate] = useState(0);
  const [dayStats, setDayStats] = useState(null);

  useEffect(() => {
    const fetchInitialData = async () => {
      setLoading(true);
      try {
        const { data: chantierData, error: chantierError } = await supabase
          .from("chantiers")
          .select("current_rate")
          .eq("id", id)
          .single();

        if (chantierError) throw chantierError;
        setChantierRate(chantierData?.current_rate || 0);

        const { data: timeEntriesData, error: timeEntriesError } =
          await supabase
            .from("daily_hours")
            .select("date")
            .eq("chantier_id", id);

        if (timeEntriesError) throw timeEntriesError;

        const { data: expensesData, error: expensesError } = await supabase
          .from("expenses")
          .select("date")
          .eq("chantier_id", id);

        if (expensesError) throw expensesError;

        const allDates = [
          ...new Set([
            ...(timeEntriesData || []).map((t) => t.date),
            ...(expensesData || []).map((e) => e.date),
          ]),
        ].sort((a, b) => new Date(b) - new Date(a));

        setDays(allDates);
      } catch (error) {
        console.error("Error fetching initial data:", error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();
  }, [id]);

  const calculateDuration = (arrived, departed) => {
    if (!arrived || !departed) return 0;

    const [arrivedHours, arrivedMins] = arrived.split(":").map(Number);
    const [departedHours, departedMins] = departed.split(":").map(Number);

    let totalMinutes =
      departedHours * 60 + departedMins - (arrivedHours * 60 + arrivedMins);
    if (totalMinutes < 0) totalMinutes += 24 * 60;

    return totalMinutes;
  };

  const calculateDayStats = useCallback((timeEntries, expenses) => {
    let totalMinutes = 0;
    let totalEarnings = 0;
    let totalExpensesAmount = 0;

    timeEntries.forEach((entry) => {
      const entryMinutes = calculateDuration(
        entry.arrived_at,
        entry.departed_at
      );
      totalMinutes += entryMinutes;
      totalEarnings += (entryMinutes / 60) * (entry.hourly_rate || 0);
    });

    expenses.forEach((expense) => {
      totalExpensesAmount += parseFloat(expense.amount) || 0;
    });

    const netTotal = totalEarnings + totalExpensesAmount;

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const formattedTotalHours = `${hours}h ${minutes}m`;

    return {
      totalHours: formattedTotalHours,
      totalEarnings: `€${totalEarnings.toFixed(2)}`,
      totalExpenses: `€${totalExpensesAmount.toFixed(2)}`,
      netTotal: `€${netTotal.toFixed(2)}`,
    };
  }, []);

  const fetchDayDetails = async (date) => {
    try {
      const { data: timeEntriesData, error: timeEntriesError } = await supabase
        .from("daily_hours")
        .select("*")
        .eq("chantier_id", id)
        .eq("date", date)
        .order("arrived_at", { ascending: true });

      if (timeEntriesError) throw timeEntriesError;

      const { data: expensesData, error: expensesError } = await supabase
        .from("expenses")
        .select("*")
        .eq("chantier_id", id)
        .eq("date", date)
        .order("created_at", { ascending: false });

      if (expensesError) throw expensesError;

      setDayTimeEntries(timeEntriesData || []);
      setDayExpenses(expensesData || []);
      setSelectedDay(date);

      const calculatedStats = calculateDayStats(
        timeEntriesData || [],
        expensesData || []
      );
      setDayStats(calculatedStats);
    } catch (error) {
      console.error("Error fetching day details:", error.message);
    }
  };

  const closeModal = () => {
    setSelectedDay(null);
    setDayTimeEntries([]);
    setDayExpenses([]);
    setDayStats(null);
  };

  const calculateHoursAndEarningsEntry = (arrived, departed, rate) => {
    const totalMinutes = calculateDuration(arrived, departed);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const decimalHours = totalMinutes / 60;
    const earnings = (decimalHours * rate).toFixed(2);

    return {
      hours: `${hours}h ${minutes}m`,
      earnings: `€${earnings}`,
    };
  };

  if (loading) return <div className="loading-state">Chargement...</div>;

  return (
    <div className="daily-summary-container">
      <button onClick={() => navigate(-1)} className="back-button">
        ← Retour
      </button>

      <h2>Résumé quotidien</h2>

      <div className="days-list">
        {days.length === 0 ? (
          <p className="empty-state">Aucune donnée disponible</p>
        ) : (
          days.map((day) => {
            const dateObj = new Date(day);
            return (
              <div
                key={day}
                className="day-card"
                onClick={() => fetchDayDetails(day)}
              >
                <span className="date-part-weekday-day">
                  {dateObj.toLocaleDateString("fr-FR", {
                    weekday: "long",
                    day: "2-digit",
                  })}
                </span>{" "}
                <span className="date-part-month-year">
                  {dateObj.toLocaleDateString("fr-FR", {
                    month: "long",
                    year: "numeric",
                  })}
                </span>
              </div>
            );
          })
        )}
      </div>

      {selectedDay && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-content">
              <button className="close-modal" onClick={closeModal}>
                ×
              </button>
              <h3>
                {new Date(selectedDay).toLocaleDateString("fr-FR", {
                  weekday: "long",
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })}
              </h3>

              {dayStats && (
                <div className="modal-section stats-section">
                  <h4>Statistiques du jour</h4>
                  <div className="stats-grid">
                    <div className="stat-card">
                      <h4>Heures travaillées</h4>
                      <div className="stat-value blue">
                        {dayStats.totalHours}
                      </div>
                    </div>
                    <div className="stat-card">
                      <h4>Gains</h4>
                      <div className="stat-value green">
                        {dayStats.totalEarnings}
                      </div>
                    </div>
                    <div className="stat-card">
                      <h4>Dépenses</h4>
                      <div className="stat-value red">
                        {dayStats.totalExpenses}
                      </div>
                    </div>
                    <div className="stat-card">
                      <h4>Total net</h4>
                      <div className="stat-value purple">
                        {dayStats.netTotal}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="modal-section">
                <h4>Entrées de temps</h4>
                {dayTimeEntries.length === 0 ? (
                  <p className="empty-state">Aucune entrée ce jour</p>
                ) : (
                  <table className="expense-table">
                    <thead>
                      <tr>
                        <th>Arrivée</th>
                        <th>Départ</th>
                        <th>Heures</th>
                        <th>Gains</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dayTimeEntries.map((entry) => {
                        const { hours, earnings } =
                          calculateHoursAndEarningsEntry(
                            entry.arrived_at,
                            entry.departed_at,
                            entry.hourly_rate // Use entry's hourly rate
                          );
                        return (
                          <tr key={entry.id}>
                            <td>{entry.arrived_at}</td>
                            <td>{entry.departed_at}</td>
                            <td>{hours}</td>
                            <td>{earnings}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="modal-section">
                <h4>Dépenses</h4>
                {dayExpenses.length === 0 ? (
                  <p className="empty-state">Aucune dépense ce jour</p>
                ) : (
                  <table className="expense-table">
                    <thead>
                      <tr>
                        <th>Description</th>
                        <th>Montant</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dayExpenses.map((expense) => (
                        <tr key={expense.id}>
                          <td>{expense.description}</td>
                          <td>€{parseFloat(expense.amount).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DailySummary;
