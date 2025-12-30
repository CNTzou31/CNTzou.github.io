const TARGET_DATE = new Date('July 25, 2026 00:00:00').getTime();
const USER_HEIGHT_CM = 173;
// PASTE YOUR GOOGLE SCRIPT URL HERE
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyfPk23oVfuQSwVKp_QtC2MuAbSKnvSl3xmLs6Ce5KcN7aTzL8kX7IC4r3fuJrsQ23K/exec';

// State
let currentDate = new Date(); // Updates with month navigation
const today = new Date(); // Fixed 'today'

// DOM Elements
const calendarDaysGrid = document.getElementById('calendarDays');
const currentMonthLabel = document.getElementById('currentMonthLabel');
const modal = document.getElementById('entryModal');
const closeModalBtn = document.querySelector('.close-modal');
const saveBtn = document.getElementById('saveBtn');
const weightInput = document.getElementById('weightInput');
const bmiDisplay = document.getElementById('bmiDisplay');
const bmiCategory = document.getElementById('bmiCategory');
const modalDateTitle = document.getElementById('modalDateTitle');

let selectedDateKey = null; // Format: YYYY-MM-DD

// --- Calendar Logic ---
function getStorageData() {
    const data = localStorage.getItem('taiwanCountdownData');
    return data ? JSON.parse(data) : {};
}

function saveStorageData(data) {
    localStorage.setItem('taiwanCountdownData', JSON.stringify(data));
}

function renderCalendar() {
    calendarDaysGrid.innerHTML = "";

    // Set Header
    const options = { month: 'long', year: 'numeric' };
    currentMonthLabel.innerText = currentDate.toLocaleDateString('en-US', options);

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    // First day of current month
    const firstDay = new Date(year, month, 1);
    // Last day of current month
    const lastDay = new Date(year, month + 1, 0);

    const daysInMonth = lastDay.getDate();
    const startDayIndex = firstDay.getDay(); // 0 = Sunday

    // Get Data
    const storedData = getStorageData();

    // Pad previous month days
    for (let i = 0; i < startDayIndex; i++) {
        const spacer = document.createElement('div');
        spacer.classList.add('day-cell', 'other-month');
        calendarDaysGrid.appendChild(spacer);
    }

    // Days
    for (let i = 1; i <= daysInMonth; i++) {
        const dateObj = new Date(year, month, i);
        const dateKey = dateObj.toISOString().split('T')[0]; // YYYY-MM-DD

        const dayDiv = document.createElement('div');
        dayDiv.classList.add('day-cell');

        // Highlight today
        if (dateObj.toDateString() === today.toDateString()) {
            dayDiv.classList.add('today');
        }

        const dateNum = document.createElement('div');
        dateNum.classList.add('day-number');
        dateNum.innerText = i;
        dayDiv.appendChild(dateNum);

        // Days Remaining Calculation
        const d1 = new Date(year, month, i);
        d1.setHours(12, 0, 0, 0); // Noon to avoid DST issues
        const d2 = new Date(TARGET_DATE);
        d2.setHours(12, 0, 0, 0);

        const diffTime = d2.getTime() - d1.getTime();
        // Use logic that mimics 'ceil' but handles negative/positive correctly relative to dates
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays >= 0) {
            const daysLeftDiv = document.createElement('div');
            daysLeftDiv.classList.add('days-left');
            daysLeftDiv.innerText = `${diffDays} days`;
            dayDiv.appendChild(daysLeftDiv);
        }

        // Display Data if exists
        if (storedData[dateKey]) {
            const dataDiv = document.createElement('div');
            dataDiv.classList.add('day-data');

            const wSpan = document.createElement('span');
            wSpan.classList.add('data-weight');
            wSpan.innerText = `${storedData[dateKey].weight}kg`;

            const bSpan = document.createElement('span');
            bSpan.classList.add('data-bmi');
            bSpan.innerText = `BMI ${storedData[dateKey].bmi}`;

            dataDiv.appendChild(wSpan);
            dataDiv.appendChild(bSpan);
            dayDiv.appendChild(dataDiv);
        }

        dayDiv.addEventListener('click', () => openModal(dateKey));

        calendarDaysGrid.appendChild(dayDiv);
    }
}

// --- Navigation ---
document.getElementById('prevMonth').addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    renderCalendar();
});

document.getElementById('nextMonth').addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    renderCalendar();
});

// --- Modal & BMI Logic ---
function calculateBMI(weight) {
    // BMI = kg / (m * m)
    const heightM = USER_HEIGHT_CM / 100;
    return (weight / (heightM * heightM)).toFixed(1);
}

function getBMICategory(bmi) {
    if (bmi < 18.5) return { text: 'Underweight', color: '#facc15' }; // Yellow
    if (bmi < 24.9) return { text: 'Normal', color: '#22c55e' }; // Green
    if (bmi < 29.9) return { text: 'Overweight', color: '#f97316' }; // Orange
    return { text: 'Obese', color: '#ef4444' }; // Red
}

function openModal(dateKey) {
    selectedDateKey = dateKey;
    modalDateTitle.innerText = new Date(dateKey).toDateString();
    modal.classList.remove('hidden');

    const storedData = getStorageData();
    if (storedData[dateKey]) {
        weightInput.value = storedData[dateKey].weight;
        updateBMIUI(storedData[dateKey].weight);
    } else {
        weightInput.value = '';
        bmiDisplay.innerText = '--';
        bmiCategory.innerText = '--';
        bmiCategory.style.backgroundColor = '#334155';
    }
}

function updateBMIUI(weight) {
    if (!weight || weight <= 0) {
        bmiDisplay.innerText = '--';
        bmiCategory.innerText = '--';
        bmiCategory.style.backgroundColor = '#334155';
        return;
    }
    const bmi = calculateBMI(weight);
    const category = getBMICategory(bmi);

    bmiDisplay.innerText = bmi;
    bmiCategory.innerText = category.text;
    bmiCategory.style.backgroundColor = category.color;
    bmiCategory.style.color = '#1e293b'; // Dark text for better contrast on bright badges
}

weightInput.addEventListener('input', (e) => {
    updateBMIUI(e.target.value);
});

saveBtn.addEventListener('click', () => {
    const weight = parseFloat(weightInput.value);
    if (!selectedDateKey) return;

    const data = getStorageData();

    if (weight && weight > 0) {
        const bmi = calculateBMI(weight);
        data[selectedDateKey] = {
            weight: weight,
            bmi: bmi
        };
    } else {
        // If clear or 0, maybe remove? Or just ignore. Let's remove if empty.
        delete data[selectedDateKey];
    }

    saveStorageData(data);

    // --- Google Sheets Sync ---
    if (GOOGLE_SCRIPT_URL && GOOGLE_SCRIPT_URL !== 'PLACEHOLDER') {
        saveBtn.innerText = "Saving...";
        fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
                'Content-Type': 'text/plain'
            },
            body: JSON.stringify({
                date: selectedDateKey,
                weight: weight,
                bmi: calculateBMI(weight)
            })
        }).then(() => {
            console.log("Success! (Note: 'no-cors' mode hides the response body, so we assume success if no network error)");
            saveBtn.innerText = "Saved!";
            setTimeout(() => saveBtn.innerText = "Save Entry", 1500);
        }).catch(err => {
            console.error('Error saving to sheet. Check network tab for details.', err);
            saveBtn.innerText = "Error (Saved Locally)";
        });
    }

    modal.classList.add('hidden');
    renderCalendar();
});

closeModalBtn.addEventListener('click', () => {
    modal.classList.add('hidden');
});

// Close modal on click outside
modal.addEventListener('click', (e) => {
    if (e.target === modal) {
        modal.classList.add('hidden');
    }
});

// Init
// --- Cloud Sync ---
function syncWithCloud() {
    if (!GOOGLE_SCRIPT_URL || GOOGLE_SCRIPT_URL === 'PLACEHOLDER') return;

    console.log("Syncing with cloud...");

    // Fetch with no-store to avoid browser caching of old data
    fetch(GOOGLE_SCRIPT_URL, { cache: "no-store" })
        .then(response => response.json())
        .then(cloudData => {
            console.log("Cloud data received:", cloudData);

            // Merge cloud data into local storage
            const localData = getStorageData();
            // Cloud data takes precedence to ensure sync across devices
            const mergedData = { ...localData, ...cloudData };

            saveStorageData(mergedData);
            renderCalendar(); // Re-render with new data
            console.log("Sync complete.");
        })
        .catch(err => {
            console.error("Error syncing with cloud:", err);
        });
}

// Init
renderCalendar();
syncWithCloud();
