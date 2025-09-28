from flask import Flask, jsonify, request, send_file
from flask_cors import CORS
import numpy as np
import serial
import threading
import csv
import io
import time

app = Flask(_name_)
CORS(app)

# -------------------------
# Serial setup for AD8232
# -------------------------
SERIAL_PORT = "COM7"  # Replace with your Arduino COM port
BAUD_RATE = 9600

try:
    ser = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=1)
except:
    ser = None
    print("Warning: Serial not connected.")

# -------------------------
# ECG buffer
# -------------------------
ECG_BUFFER_SIZE = 500
ecg_buffer = []
buffer_lock = threading.Lock()

# -------------------------
# Patient data storage
# -------------------------
patients = {}  # {id: {name, age, sex, vitals_history, ecg_history, logs}}
current_patient_id = None
monitoring = False

# -------------------------
# Function to read ECG
# -------------------------
def read_ecg_value():
    if ser is None:
        return None
    try:
        line = ser.readline().decode('utf-8', errors='ignore').strip()
        value = float(line)
        return value
    except ValueError:
        return None

# -------------------------
# Thread to continuously read ECG when monitoring
# -------------------------
def ecg_reader():
    global ecg_buffer, monitoring
    while True:
        if monitoring:
            val = read_ecg_value()
            if val is not None:
                with buffer_lock:
                    ecg_buffer.append(val)
                    if len(ecg_buffer) > ECG_BUFFER_SIZE:
                        ecg_buffer = ecg_buffer[-ECG_BUFFER_SIZE:]
        time.sleep(0.005)  # ~200Hz sampling

threading.Thread(target=ecg_reader, daemon=True).start()

# -------------------------
# Routes
# -------------------------

@app.route("/start_monitoring", methods=["POST"])
def start_monitoring():
    global monitoring
    monitoring = True
    return jsonify({"status": "Monitoring started"})


@app.route("/stop_monitoring", methods=["POST"])
def stop_monitoring():
    global monitoring
    monitoring = False
    return jsonify({"status": "Monitoring stopped"})


@app.route("/set_patient", methods=["POST"])
def set_patient():
    global current_patient_id
    data = request.json
    patient_id = str(len(patients) + 1)
    patients[patient_id] = {
        "name": data.get("name"),
        "age": data.get("age"),
        "sex": data.get("sex"),
        "vitals_history": [],
        "ecg_history": [],
        "logs": []
    }
    current_patient_id = patient_id
    return jsonify({"status": "Patient set", "id": patient_id, "name": data.get("name")})


@app.route("/vitals")
def vitals():
    global current_patient_id, ecg_buffer

    if current_patient_id is None:
        return jsonify({"error": "No patient selected"}), 400

    # Simulated vitals (replace with real sensors if available)
    heart_rate = max(1, int(np.random.normal(75, 5)))
    spo2 = max(80, min(100, int(np.random.normal(97, 1))))
    temperature = round(np.random.normal(36.8, 0.3), 1)
    respiratory_rate = max(10, min(25, int(np.random.normal(16, 2))))

    # Get ECG snapshot
    with buffer_lock:
        ecg_snapshot = ecg_buffer[-100:] if len(ecg_buffer) >= 100 else ecg_buffer.copy()

    # Save to patient history (keep only last 5 readings)
    patient = patients[current_patient_id]
    vitals_record = {
        "time": int(time.time()),
        "heart_rate": heart_rate,
        "spo2": spo2,
        "temperature": temperature,
        "respiratory_rate": respiratory_rate,
        "ecg_summary": f"{min(ecg_snapshot) if ecg_snapshot else '--'} - {max(ecg_snapshot) if ecg_snapshot else '--'}"
    }
    patient["vitals_history"].insert(0, vitals_record)  # newest first
    patient["vitals_history"] = patient["vitals_history"][:5]  # keep only last 5

    # Alert detection
    alerts = []
    if heart_rate < 60 or heart_rate > 100:
        alerts.append("Heart Rate abnormal")
    if spo2 < 90:
        alerts.append("SpO2 low")
    if temperature < 36 or temperature > 38:
        alerts.append("Temperature abnormal")

    data = {
        "patient_name": patient["name"],
        "heart_rate": heart_rate,
        "spo2": spo2,
        "temperature": temperature,
        "respiratory_rate": respiratory_rate,
        "ecg_signal": ecg_snapshot,
        "alerts": alerts,
        "last_5_records": patient["vitals_history"]
    }

    return jsonify(data)


@app.route("/export", methods=["GET"])
def export():
    if current_patient_id is None:
        return jsonify({"error": "No patient selected"}), 400
    patient = patients[current_patient_id]

    # CSV in memory
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Time", "Heart Rate", "SpO2", "Temperature", "Respiratory Rate", "ECG"])
    for v in patient["vitals_history"]:
        writer.writerow([
            time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(v["time"])),
            v["heart_rate"],
            v["spo2"],
            v["temperature"],
            v["respiratory_rate"],
            v.get("ecg_summary", "--")
        ])
    output.seek(0)
    return send_file(io.BytesIO(output.getvalue().encode()), mimetype="text/csv",
                     attachment_filename=f"patient_{current_patient_id}_data.csv", as_attachment=True)


if _name_ == "_main_":
    app.run(debug=True)
