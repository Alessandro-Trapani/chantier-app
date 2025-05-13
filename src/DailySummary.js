import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "./supabaseClient";
import "./styles.css";
import * as XLSX from "xlsx";

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
  const [exporting, setExporting] = useState(false);

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

  const formatDurationFromMinutes = (totalMinutes) => {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}h ${minutes}m`;
  };

  const calculateDayStats = useCallback((timeEntries, expenses) => {
    let totalMinutes = 0;
    let totalEarnings = 0;
    let totalExpensesAmount = 0;
    let totalExpensesWithMargin = 0;

    timeEntries.forEach((entry) => {
      const entryMinutes = calculateDuration(
        entry.arrived_at,
        entry.departed_at
      );
      totalMinutes += entryMinutes;
      totalEarnings += (entryMinutes / 60) * (entry.hourly_rate || 0);
    });

    expenses.forEach((expense) => {
      const baseAmount =
        parseFloat(expense.base_amount) || parseFloat(expense.amount) || 0;
      const margin = parseFloat(expense.margin) || 0;
      const amountWithMargin = baseAmount * (1 + margin / 100);
      totalExpensesAmount += baseAmount;
      totalExpensesWithMargin += amountWithMargin;
    });

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const formattedTotalHours = `${hours}h ${minutes}m`;

    return {
      totalHours: formattedTotalHours,
      totalEarnings: `€${totalEarnings.toFixed(2)}`,
      totalExpensesWithMargin: `€${totalExpensesWithMargin.toFixed(2)}`,
      netEarnings: `€${(totalEarnings + totalExpensesWithMargin).toFixed(2)}`,
      marginImpact: `€${(totalExpensesWithMargin - totalExpensesAmount).toFixed(
        2
      )}`,
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
    const earnings = (decimalHours * (rate || 0)).toFixed(2);

    return {
      hours: `${hours}h ${minutes}m`,
      earnings: `€${earnings}`,
    };
  };

  const handleExportToExcel = async () => {
    setExporting(true);
    try {
      const { data: timeEntries, error: timeEntriesError } = await supabase
        .from("daily_hours")
        .select("*")
        .eq("chantier_id", id)
        .order("date", { ascending: false })
        .order("arrived_at", { ascending: true });

      if (timeEntriesError) throw timeEntriesError;

      const { data: expenses, error: expensesError } = await supabase
        .from("expenses")
        .select("*")
        .eq("chantier_id", id)
        .order("date", { ascending: false })
        .order("created_at", { ascending: true });

      if (expensesError) throw expensesError;

      const sheetDataAoA = [];

      // Entrées de temps section
      const timeEntriesHeaders = [
        "date",
        "arrivee",
        "depart",
        "duree",
        "taux horaire",
        "gain horaire",
      ];
      sheetDataAoA.push(timeEntriesHeaders);
      (timeEntries || []).forEach((entry) => {
        const durationMinutes = calculateDuration(
          entry.arrived_at,
          entry.departed_at
        );
        const hourlyRate = parseFloat(entry.hourly_rate) || 0;
        const hourlyGain = (durationMinutes / 60) * hourlyRate;
        sheetDataAoA.push([
          entry.date,
          entry.arrived_at,
          entry.departed_at,
          formatDurationFromMinutes(durationMinutes),
          hourlyRate.toFixed(2),
          hourlyGain.toFixed(2),
        ]);
      });

      sheetDataAoA.push([]);

      // Dépenses section
      const expensesHeaders = [
        "date",
        "description",
        "montant",
        "marge",
        "TOT",
      ];
      sheetDataAoA.push(expensesHeaders);
      (expenses || []).forEach((expense) => {
        const baseAmount =
          parseFloat(expense.base_amount || expense.amount) || 0;
        const marginPercentage = parseFloat(expense.margin) || 0;
        const totalAmount = baseAmount * (1 + marginPercentage / 100);
        sheetDataAoA.push([
          expense.date,
          expense.description,
          baseAmount.toFixed(2),
          marginPercentage + "%",
          totalAmount.toFixed(2),
        ]);
      });

      const ws = XLSX.utils.aoa_to_sheet(sheetDataAoA);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Résumé Chantier");

      XLSX.writeFile(
        wb,
        `Export_Chantier_${id}_${new Date().toISOString().slice(0, 10)}.xlsx`
      );
    } catch (error) {
      console.error("Error exporting data to Excel:", error.message);
      alert("Erreur lors de l'exportation des données: " + error.message);
    } finally {
      setExporting(false);
    }
  };

  if (loading) return <div className="loading-state">Chargement...</div>;

  return (
    <div className="daily-summary-container">
      <button onClick={() => navigate(-1)} className="back-button">
        ← Retour
      </button>

      <button
        onClick={handleExportToExcel}
        disabled={exporting}
        style={{
          margin: "0px 0px 20px 10px",
          padding: "10px 15px",
          cursor: "pointer",
        }}
      >
        {exporting ? "Exportation..." : "Exporter en Excel"}
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
                        {dayStats.totalExpensesWithMargin}
                      </div>
                    </div>
                    <div className="stat-card">
                      <h4>marge</h4>
                      <div className="stat-value orange">
                        {dayStats.marginImpact}
                      </div>
                    </div>
                    <div className="stat-card">
                      <h4>Total net</h4>
                      <div className="stat-value purple">
                        {dayStats.netEarnings}
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
                            entry.hourly_rate
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
                        <th>Montant base</th>
                        <th>Marge</th>
                        <th>Montant total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dayExpenses.map((expense) => {
                        const baseAmount =
                          parseFloat(expense.base_amount || expense.amount) ||
                          0;
                        const margin = parseFloat(expense.margin) || 0;
                        const totalAmount = baseAmount * (1 + margin / 100);

                        return (
                          <tr key={expense.id}>
                            <td>{expense.description}</td>
                            <td>€{baseAmount.toFixed(2)}</td>
                            <td>{margin}%</td>
                            <td>€{totalAmount.toFixed(2)}</td>
                          </tr>
                        );
                      })}
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
