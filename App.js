import React, { useEffect, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
} from "recharts";

function App() {
  const ECG_HISTORY_LENGTH = 500;

  const [patient, setPatient] = useState({ name: "", age: "", sex: "" });
  const [currentPatientId, setCurrentPatientId] = useState(null);
  const [monitoring, setMonitoring] = useState(false);
  const [vitals, setVitals] = useState({});
  const [ecgHistory, setEcgHistory] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [lastUpdate, setLastUpdate] = useState("--:--:--");
  const [patientRecords, setPatientRecords] = useState([]);
  const [patientName, setPatientName] = useState("");

  const startMonitoring = () => {
    fetch("http://127.0.0.1:5000/start_monitoring", { method: "POST" })
      .then(() => setMonitoring(true));
  };

  const stopMonitoring = () => {
    fetch("http://127.0.0.1:5000/stop_monitoring", { method: "POST" })
      .then(() => setMonitoring(false));
  };

  const savePatient = () => {
    if (!patient.name) return alert("Enter patient name!");
    fetch("http://127.0.0.1:5000/set_patient", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patient)
    })
      .then(res => res.json())
      .then(data => {
        setCurrentPatientId(data.id);
        setPatientName(patient.name);
        setPatientRecords([]);
        setEcgHistory([]);
      });
  };

  useEffect(() => {
    if (!monitoring || !currentPatientId) return;

    const interval = setInterval(() => {
      fetch("http://127.0.0.1:5000/vitals")
        .then(res => res.json())
        .then(data => {
          setVitals(data);
          setAlerts(data.alerts || []);
          setPatientName(data.patient_name || patientName);

          // ECG only updates when monitoring
          if (data.ecg_signal && data.ecg_signal.length > 0) {
            setEcgHistory(prev => {
              let newEcg = [...prev];
              let lastTime = newEcg.length > 0 ? newEcg[newEcg.length - 1].time : 0;
              const TIME_STEP = 3;
              data.ecg_signal.forEach(val => {
                lastTime += TIME_STEP;
                const scaledVal = (val - 50) * 1.5 + 50;
                newEcg.push({ time: lastTime, value: scaledVal });
              });
              if (newEcg.length > ECG_HISTORY_LENGTH) {
                newEcg = newEcg.slice(newEcg.length - ECG_HISTORY_LENGTH);
              }
              return newEcg;
            });
          }

          if (data.last_5_records) setPatientRecords(data.last_5_records);

          setLastUpdate(new Date().toLocaleTimeString());
        })
        .catch(err => console.error(err));
    }, 500);

    return () => clearInterval(interval);
  }, [monitoring, currentPatientId]);

  const exportData = () => {
    window.open("http://127.0.0.1:5000/export", "_blank");
  };

  const getCardColor = (vital, type) => {
    if (type === "heart_rate") return vital < 60 || vital > 100 ? "#ff4d4f" : "#4caf50";
    if (type === "spo2") return vital < 90 ? "#ff4d4f" : "#4caf50";
    if (type === "temperature") return vital < 36 || vital > 38 ? "#ff4d4f" : "#4caf50";
    if (type === "respiratory_rate") return vital < 12 || vital > 20 ? "#ff4d4f" : "#4caf50";
  };

  const buttonStyle = {
    flex: 1,
    padding: 12,
    fontSize: "1.2rem",
    cursor: "pointer",
    borderRadius: 10, // Smooth corners
    border: "none"
  };

  return (
    <div style={{ padding: 30, fontFamily: "Garet, sans-serif", background: "#111", color: "#f1f1f1", minHeight: "100vh" }}>
      
      <h1 style={{
        textAlign: "center",
        fontSize: "4rem",
        fontWeight: "bold",
        background: "linear-gradient(to right, #00f, #fff, #0f0)",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        marginBottom: 40
      }}>AROGYA</h1>

      {/* Patient Details */}
      <div style={{ display: "flex", gap: 20, marginBottom: 25 }}>
        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          <label style={{ fontSize: "1.3rem", marginBottom: 5 }}>Name</label>
          <input style={{ padding: 10, fontSize: "1.2rem" }} placeholder="Name" value={patient.name} onChange={e => setPatient({ ...patient, name: e.target.value })} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          <label style={{ fontSize: "1.3rem", marginBottom: 5 }}>Age</label>
          <input type="number" style={{ padding: 10, fontSize: "1.2rem" }} placeholder="Age" value={patient.age} onChange={e => setPatient({ ...patient, age: e.target.value })} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          <label style={{ fontSize: "1.3rem", marginBottom: 5 }}>Gender</label>
          <select style={{ padding: 10, fontSize: "1.2rem" }} value={patient.sex} onChange={e => setPatient({ ...patient, sex: e.target.value })}>
            <option value="">Select</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Other">Other</option>
          </select>
        </div>

        {/* Save Patient Button proportional */}
        <button onClick={savePatient} style={{ ...buttonStyle, backgroundColor: "#555", color: "#fff" }}>Save Patient</button>
      </div>

      {/* Monitoring Controls */}
      <div style={{ display: "flex", gap: 20, marginBottom: 25 }}>
        <button onClick={startMonitoring} disabled={monitoring || !currentPatientId} style={{ ...buttonStyle, backgroundColor: "#4caf50", color: "#fff" }}>Start Monitoring</button>
        <button onClick={stopMonitoring} disabled={!monitoring} style={{ ...buttonStyle, backgroundColor: "#4caf50", color: "#fff" }}>Stop Monitoring</button>
        <button onClick={exportData} disabled={!currentPatientId} style={{ ...buttonStyle, backgroundColor: "#2196f3", color: "#fff" }}>Export Data</button>
      </div>

      {currentPatientId && <h2>Patient: {patientName}</h2>}
      {alerts.length > 0 && <div style={{ color: "red", marginBottom: 10 }}>Alerts: {alerts.join(", ")}</div>}

      {/* Vitals Cards */}
      <div style={{ display: "flex", gap: 20, marginBottom: 25 }}>
        {["heart_rate", "spo2", "temperature", "respiratory_rate"].map(v => (
          <div key={v} style={{
            background: "#222", padding: 15, borderRadius: 10, minWidth: 140,
            borderLeft: 5px solid ${getCardColor(vitals[v], v)}
          }}>
            <strong>{v.replace("_", " ").toUpperCase()}</strong>
            <div style={{ fontSize: "1.5em" }}>{vitals[v] || "--"}</div>
          </div>
        ))}
      </div>

      {/* ECG Graph only shows when monitoring */}
      {monitoring && (
        <div style={{ marginBottom: 25 }}>
          <h3>ECG Waveform</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={ecgHistory}>
              <Line type="linear" dataKey="value" stroke="#00ff00" dot={false} isAnimationActive={false} />
              <XAxis dataKey="time" hide />
              <YAxis domain={[0,100]} stroke="#f1f1f1" />
              <Tooltip contentStyle={{ backgroundColor:"#222", color:"#f1f1f1" }} />
              <CartesianGrid stroke="#555" strokeDasharray="3 3" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Last 5 Patient Records */}
      <div style={{ overflowX: "auto", marginTop: 20 }}>
        <h3>Last 5 Readings</h3>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead style={{ backgroundColor: "#222" }}>
            <tr>
              {["Time", "Heart Rate", "SpO₂", "Temperature", "Respiratory Rate", "ECG Range"].map(h => (
                <th key={h} style={{ padding: "10px 15px", border: "1px solid #555", textAlign: "center" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {patientRecords.map((rec, i) => (
              <tr key={i} style={{ backgroundColor: i % 2 === 0 ? "#1a1a1a" : "#111" }}>
                <td style={{ padding: "8px 12px", border: "1px solid #555", textAlign: "center" }}>{new Date(rec.time * 1000).toLocaleTimeString()}</td>
                <td style={{ padding: "8px 12px", border: "1px solid #555", textAlign: "center" }}>{rec.heart_rate}</td>
                <td style={{ padding: "8px 12px", border: "1px solid #555", textAlign: "center" }}>{rec.spo2}</td>
                <td style={{ padding: "8px 12px", border: "1px solid #555", textAlign: "center" }}>{rec.temperature}</td>
                <td style={{ padding: "8px 12px", border: "1px solid #555", textAlign: "center" }}>{rec.respiratory_rate}</td>
                <td style={{ padding: "8px 12px", border: "1px solid #555", textAlign: "center" }}>{rec.ecg_summary}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 15 }}>Last Update: {lastUpdate}</div>
    </div>
  );
}

export default App;
