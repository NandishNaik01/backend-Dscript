const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs/promises'); // Use fs/promises for async/await
const path = require('path');
const Groq = require('groq-sdk');
const dotenv = require('dotenv');

dotenv.config(); // Load environment variables

const app = express();
const port = 5000;
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

app.use(cors());
app.use(bodyParser.json());

// Define file paths
const appointmentsFilePath = path.join(__dirname, 'queue.json');
const reportsFilePath = path.join(__dirname, 'reports.json');
const attendedPatientsFilePath = path.join(__dirname, 'attendedpatients.json');

// Endpoint to get appointments
app.get('/appointments', async (req, res) => {
  try {
    const data = await fs.readFile(appointmentsFilePath, 'utf8');
    const appointments = JSON.parse(data);
    res.json(appointments);
  } catch (error) {
    console.error('Failed to read or parse appointments file:', error);
    res.status(500).json({ error: 'Failed to read appointments file' });
  }
});

// Endpoint to move patient to attended list
app.post('/attend-patient', async (req, res) => {
  const patient = req.body.patient;

  try {
    // Read and update appointments
    const appointmentsData = await fs.readFile(appointmentsFilePath, 'utf8');
    let appointments = JSON.parse(appointmentsData);
    appointments = appointments.filter(app => app.id !== patient.id);
    await fs.writeFile(appointmentsFilePath, JSON.stringify(appointments, null, 2));

    // Read and update attended patients
    const attendedPatientsData = await fs.readFile(attendedPatientsFilePath, 'utf8');
    let attendedPatients = JSON.parse(attendedPatientsData);
    attendedPatients.push(patient);
    await fs.writeFile(attendedPatientsFilePath, JSON.stringify(attendedPatients, null, 2));

    res.send('Patient moved to attended list');
  } catch (error) {
    console.error('Error processing patient:', error);
    res.status(500).send('Error processing patient');
  }
});

// Endpoint to save appointment
app.post('/save-appointment', async (req, res) => {
  const newAppointment = req.body;
  console.log(newAppointment);

  try {
    // Read existing appointments
    let reports = [];
    try {
      const data = await fs.readFile(reportsFilePath, 'utf8');
      // Check if data is empty or invalid
      if (data.trim().length > 0) {
        reports = JSON.parse(data);
      }
    } catch (readError) {
      // Handle file read error or JSON parse error
      if (readError.code === 'ENOENT') {
        // File does not exist, start with an empty array
        reports = [];
      } else {
        // If JSON parsing fails, treat it as an empty file
        if (readError instanceof SyntaxError) {
          reports = [];
        } else {
          throw readError; // Re-throw unexpected errors
        }
      }
    }

    // Add new appointment with a new ID
    newAppointment.id = reports.length ? Math.max(reports.map(app => app.id)) + 1 : 1;
    reports.push(newAppointment);

    // Write updated appointments back to the file
    await fs.writeFile(reportsFilePath, JSON.stringify(reports, null, 2));

    res.json({ message: 'Appointment saved successfully' });
  } catch (error) {
    console.error('Failed to read or write appointments file:', error);
    res.status(500).json({ error: 'Failed to save appointment' });
  }
});

app.post('/save-report', async (req, res) => {
  const newAppointment = req.body;
  console.log("", newAppointment);

  try {
    // Read existing appointments
    const data = await fs.readFile(appointmentsFilePath, 'utf8');
    let appointments = JSON.parse(data);

    // Add new appointment with a new ID
    newAppointment.id = appointments.length ? Math.max(appointments.map(app => app.id)) + 1 : 1;
    appointments.push(newAppointment);

    // Write updated appointments back to the file
    await fs.writeFile(appointmentsFilePath, JSON.stringify(appointments, null, 2));

    res.json({ message: 'Appointment saved successfully' });
  } catch (error) {
    console.error('Failed to read or write appointments file:', error);
    res.status(500).json({ error: 'Failed to save appointment' });
  }
});
// Endpoint to save report

// Function to get chat completion from Groq
async function getGroqChatCompletion(prompt) {
  return groq.chat.completions.create({
    messages: [{ role: "user", content: prompt }],
    model: "llama3-8b-8192",
  });
}

// Endpoint for chat completion
app.post('/chat', async (req, res) => {
  const { prompt } = req.body;

  if (!prompt) return res.status(400).send('Missing prompt in request body');

  try {
    // Check if the prompt is "get patient data"
    if (prompt === "get patient data") {
      const mockPrescription = `
      <div>
        <h2>Patient Diagnosis History:</h2>
        <ul>
          <li>
            <strong>Headache</strong><br>
            <strong>Date:</strong> 2024-07-01<br>
            <strong>Diagnosis:</strong> Headache<br>
            <strong>Treatment:</strong> Pain relief medication
          </li>
          <li>
            <strong>Broken Leg</strong><br>
            <strong>Date:</strong> 2024-06-15<br>
            <strong>Diagnosis:</strong> Fractured femur<br>
            <strong>Treatment:</strong> Cast and rest
          </li>
          <li>
            <strong>Flu</strong><br>
            <strong>Date:</strong> 2024-05-20<br>
            <strong>Diagnosis:</strong> Influenza<br>
            <strong>Treatment:</strong> Rest, fluids, and antiviral medication
          </li>
        </ul>
      </div>
    `;
    return res.send(mockPrescription);
    }

    // For all other prompts, continue with existing logic
    const chatCompletion = await getGroqChatCompletion(prompt);
    res.send(chatCompletion.choices[0]?.message?.content || '');
  } catch (error) {
    console.error('Error querying Groq AI:', error);
    res.status(500).send('Error querying Groq AI');
  }
});


app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
