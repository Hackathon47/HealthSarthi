// frontend/script.js

const BACKEND_URL = "http://localhost:5000"; // Use localhost for local testing/port forwarding

// --- I. UI Element References ---
const ui = {
    citySelect: document.getElementById('city-select'),
    emailInput: document.getElementById('email-input'),
    festivalCheck: document.getElementById('festival-check'),
    floodCheck: document.getElementById('flood-check'),
    runBtn: document.getElementById('run-agent-btn'),
    
    aqiGaugeContainer: document.getElementById('aqi-gauge-container'),
    aqiGauge: document.getElementById('aqi-gauge'),
    aqiValue: document.getElementById('aqi-value'),
    
    chatterCount: document.getElementById('chatter-count'),
    tweetsBox: document.getElementById('tweets-box'),
    
    statusMessage: document.getElementById('status-message'),
    analysisOutput: document.getElementById('analysis-output'),
    actionsLog: document.getElementById('actions-log'),
    rawJsonDetails: document.getElementById('raw-json-details'),
    rawJsonPre: document.getElementById('raw-json-pre')
};

// --- II. Core Data & Helpers ---

const INDIAN_CITIES = [
    "Mumbai", "Delhi", "Bengaluru", "Kolkata", "Chennai", "Hyderabad", "Pune", "Jaipur", "Lucknow", "Ahmedabad"
];

// Replicates the AQI coloring logic from the React app
const getAqiInfo = (aqi) => {
    if (aqi === null || isNaN(aqi)) return { color: '#888888', shadow: 'rgba(136, 136, 136, 0.2)', className: '' };
    if (aqi > 300) return { color: '#d90022', shadow: 'rgba(217, 0, 34, 0.5)', className: 'hazardous' };
    if (aqi > 200) return { color: '#ff4d00', shadow: 'rgba(255, 77, 0, 0.5)', className: 'very-unhealthy' };
    if (aqi > 150) return { color: '#ff9b00', shadow: 'rgba(255, 155, 0, 0.5)', className: 'unhealthy' };
    if (aqi > 100) return { color: '#ffd500', shadow: 'rgba(255, 213, 0, 0.5)', className: 'unhealthy-sensitive' };
    if (aqi > 50) return { color: '#00e000', shadow: 'rgba(0, 224, 0, 0.5)', className: 'moderate' };
    return { color: '#00cc00', shadow: 'rgba(0, 204, 0, 0.5)', className: 'good' };
};

// --- III. Rendering Functions ---

function renderInitialState() {
    // Populate city dropdown
    INDIAN_CITIES.forEach(city => {
        const option = document.createElement('option');
        option.value = city;
        option.textContent = city;
        ui.citySelect.appendChild(option);
    });

    // Set initial display
    ui.aqiValue.textContent = '---';
    ui.chatterCount.textContent = '0';
    ui.rawJsonDetails.style.display = 'none';
}

function updateAqiGauge(aqi) {
    const aqiInfo = getAqiInfo(aqi);
    const displayValue = aqi === null ? 'N/A' : aqi;

    ui.aqiValue.textContent = displayValue;
    
    // Update colors and classes for the animated ring
    ui.aqiGauge.style.borderColor = aqiInfo.color;
    ui.aqiGauge.style.boxShadow = `0 0 15px 1px ${aqiInfo.shadow}`;
    ui.aqiGaugeContainer.className = `aqi-gauge-container ${aqiInfo.className}`;
}

function updateTweets(tweets, count) {
    ui.chatterCount.textContent = count;
    ui.tweetsBox.innerHTML = ''; // Clear previous tweets

    if (tweets && tweets.length > 0) {
        tweets.slice(0, 3).forEach(tweet => {
            const p = document.createElement('p');
            p.className = 'tweet-item';
            p.textContent = tweet.text;
            ui.tweetsBox.appendChild(p);
        });
    } else {
        ui.tweetsBox.innerHTML = '<p class="no-chatter">No recent chatter found.</p>';
    }
}

function updateLog(plan, actionsLog) {
    ui.actionsLog.innerHTML = ''; // Clear previous log

    // 1. Log the real-world actions
    actionsLog.forEach(log => {
        const div = document.createElement('div');
        div.className = `log-item ${log.success ? 'success' : 'error'}`;
        
        let text = '';
        if (log.type === 'email') {
            text = log.success ? `✅ Email Sent to ${log.destination}` : `❌ Email Failed: ${log.error}`;
        } else if (log.type === 'tweet') {
            text = log.success ? `✅ Tweet Posted! (ID: ${log.tweetId})` : `❌ Tweet Failed: ${log.error}`;
        }
        div.textContent = text;
        ui.actionsLog.appendChild(div);
    });
    
    // 2. Log the Mock Supply Order (Warning/Warn)
    if (plan.actions.supply_order.order) {
        const div = document.createElement('div');
        div.className = 'log-item warn';
        div.textContent = `📦 Supply Order Logged (Mock): ${plan.actions.supply_order.quantity}x ${plan.actions.supply_order.item}.`;
        ui.actionsLog.appendChild(div);
    }
}

// --- IV. Main Agent Function ---

async function handleRunAgent() {
    // 1. Reset UI and show loading
    ui.runBtn.disabled = true;
    ui.runBtn.textContent = '🛰️ SENSING & THINKING...';
    ui.statusMessage.textContent = 'Acquiring live data from APIs...';
    ui.analysisOutput.innerHTML = '<p>Analyzing data and formulating plan...</p>';
    ui.actionsLog.innerHTML = '';
    ui.rawJsonDetails.style.display = 'none';
    updateAqiGauge(null);

    const recipientEmail = ui.emailInput.value;

    const crisisData = {
        selectedCity: ui.citySelect.value,
        is_festival: ui.festivalCheck.checked,
        is_flood_alert: ui.floodCheck.checked
    };

    try {
        // 2. Send request to backend
        const response = await fetch(`${BACKEND_URL}/api/get-plan`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ crisisData, recipientEmail }),
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || `HTTP error! Status: ${response.status}`);
        }

        const { plan, actionsLog, liveAqi, chatterCount, chatterTweets } = await response.json();
        
        // 3. Render results
        ui.statusMessage.textContent = 'Plan Execution Complete!';
        ui.analysisOutput.innerHTML = `<p>"${plan.analysis}"</p>`;
        
        updateAqiGauge(liveAqi);
        updateTweets(chatterTweets, chatterCount);
        updateLog(plan, actionsLog);

        // Show raw JSON
        ui.rawJsonPre.textContent = JSON.stringify(plan, null, 2);
        ui.rawJsonDetails.style.display = 'block';

    } catch (e) {
        console.error("Agent Error:", e);
        ui.statusMessage.textContent = '🔴 ERROR: Deployment or API Failure.';
        ui.analysisOutput.innerHTML = `<p style="color:var(--error);">Failed to run agent. Check network connection or backend logs for: ${e.message}</p>`;
        updateAqiGauge(null);
    } finally {
        ui.runBtn.disabled = false;
        ui.runBtn.textContent = '🚀 RUN AGENT';
    }
}

// --- V. Event Listeners (Setup) ---
document.addEventListener('DOMContentLoaded', () => {
    renderInitialState();
    ui.runBtn.addEventListener('click', handleRunAgent);
});