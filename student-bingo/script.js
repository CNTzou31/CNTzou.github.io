document.addEventListener('DOMContentLoaded', () => {
    // --- Configuration ---
    // Look for a global config or default to 'main'
    const CLASS_ID = window.BINGO_CLASS_ID || 'main';
    const STORAGE_KEY_STUDENTS = `bingoStudents_${CLASS_ID}`;
    const STORAGE_KEY_PWD = `bingoAdminPwd`; // Shared password for simplicity, or could be separate

    // --- State ---
    let students = JSON.parse(localStorage.getItem(STORAGE_KEY_STUDENTS)) || [];
    let savedPassword = localStorage.getItem(STORAGE_KEY_PWD) || "admin";
    const BINGO_SIZE = 5;
    let isAdmin = false; // Default to Guest

    // --- DOM Elements ---
    const studentListEl = document.getElementById('studentList');
    const emptyState = document.getElementById('emptyState');
    const newStudentInput = document.getElementById('newStudentName');
    const addStudentBtn = document.getElementById('addStudentBtn');

    // Auth & Admin Elements
    const loginBtn = document.getElementById('loginBtn');
    const changePwdBtn = document.getElementById('changePwdBtn');
    const adminControls = document.getElementById('adminControls');

    // Import
    const csvInput = document.getElementById('csvInput');

    // Global Map Elements
    const globalGrid = document.getElementById('globalBingoGrid');
    const mapLabel = document.getElementById('mapLabel');

    // Stats Elements
    const totalStudentsEl = document.getElementById('totalStudentsCount');
    const totalCardsEl = document.getElementById('totalCardsCount');

    // Class Label (Optional display)
    const classTitleEl = document.getElementById('classPageTitle');
    if (classTitleEl && window.BINGO_CLASS_NAME) {
        classTitleEl.textContent = window.BINGO_CLASS_NAME;
    }

    // Modal Elements
    const passwordModal = document.getElementById('passwordModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalInput = document.getElementById('modalPasswordInput');
    const modalSubmit = document.getElementById('modalSubmitBtn');
    const modalCancel = document.getElementById('modalCancelBtn');

    // --- Logic ---
    function saveState() {
        localStorage.setItem(STORAGE_KEY_STUDENTS, JSON.stringify(students));
    }

    // Helper: Promisified Password Prompt
    function showPasswordPrompt(title = "Enter Password") {
        return new Promise((resolve) => {
            modalTitle.textContent = title;
            modalInput.value = '';
            passwordModal.style.display = 'flex';
            modalInput.focus();

            const close = (val) => {
                passwordModal.style.display = 'none';
                modalInput.removeEventListener('keydown', handleKey);
                modalSubmit.onclick = null;
                modalCancel.onclick = null;
                resolve(val);
            };

            const handleSubmit = () => close(modalInput.value);
            const handleCancel = () => close(null);

            const handleKey = (e) => {
                if (e.key === 'Enter') handleSubmit();
                if (e.key === 'Escape') handleCancel();
            };

            modalSubmit.onclick = handleSubmit;
            modalCancel.onclick = handleCancel;
            modalInput.addEventListener('keydown', handleKey);
        });
    }

    async function toggleAdminMode() {
        if (!isAdmin) {
            // Log In
            const pwd = await showPasswordPrompt("Enter Admin Password");
            if (pwd === savedPassword) {
                isAdmin = true;
                loginBtn.innerHTML = `
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                    <span>Logout</span>
                `;
                loginBtn.classList.add('active');
                adminControls.style.display = 'flex';
                render();
            } else if (pwd !== null) {
                alert("Incorrect password.");
            }
        } else {
            // Log Out
            isAdmin = false;
            loginBtn.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                <span>Login</span>
            `;
            loginBtn.classList.remove('active');
            adminControls.style.display = 'none';
            render();
        }
    }

    async function changePassword() {
        if (!isAdmin) return;
        const current = await showPasswordPrompt("Enter Current Password");
        if (current === savedPassword) {
            const newPwd = await showPasswordPrompt("Enter New Password");
            if (newPwd && newPwd.trim().length > 0) {
                savedPassword = newPwd;
                localStorage.setItem(STORAGE_KEY_PWD, savedPassword);
                alert("Password changed successfully.");
            } else if (newPwd !== null) {
                alert("Password cannot be empty.");
            }
        } else if (current !== null) {
            alert("Incorrect current password.");
        }
    }

    function addStudent(nameOverride) {
        if (!isAdmin) return; // Guard

        const name = nameOverride || newStudentInput.value.trim();
        if (!name) return;

        const newStudent = {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
            name: name,
            cardCounts: {}
        };
        // Init counts
        for (let i = 1; i <= 25; i++) {
            newStudent.cardCounts[i] = 0;
        }

        students.push(newStudent);
        if (!nameOverride) {
            newStudentInput.value = '';
            saveState();
            render();
        }
    }

    function removeStudent(id) {
        if (!isAdmin) return; // Guard
        if (confirm("Are you sure you want to remove this student?")) {
            students = students.filter(s => s.id !== id);
            saveState();
            render();
            updateGlobalMap(null);
        }
    }

    function handleCSVUpload(e) {
        if (!isAdmin) return; // Guard
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function (e) {
            const text = e.target.result;
            const lines = text.split(/\r?\n/);
            let addedCount = 0;

            lines.forEach(line => {
                const cleanName = line.replace(/['"]+/g, '').trim();
                if (cleanName && cleanName.toLowerCase() !== 'name') {
                    addStudent(cleanName);
                    addedCount++;
                }
            });

            saveState();
            render();
            alert(`Successfully imported ${addedCount} students.`);
            csvInput.value = '';
        };
        reader.readAsText(file);
    }

    function getBingoLineCount(student) {
        const counts = student.cardCounts;
        const isCollected = (num) => counts[num] > 0;
        let lineCount = 0;

        // Rows
        for (let r = 0; r < BINGO_SIZE; r++) {
            let rowFull = true;
            for (let c = 0; c < BINGO_SIZE; c++) {
                const num = r * BINGO_SIZE + c + 1;
                if (!isCollected(num)) rowFull = false;
            }
            if (rowFull) lineCount++;
        }

        // Cols
        for (let c = 0; c < BINGO_SIZE; c++) {
            let colFull = true;
            for (let r = 0; r < BINGO_SIZE; r++) {
                const num = r * BINGO_SIZE + c + 1;
                if (!isCollected(num)) colFull = false;
            }
            if (colFull) lineCount++;
        }

        // Diagonals
        let d1Full = true;
        let d2Full = true;
        for (let i = 0; i < BINGO_SIZE; i++) {
            if (!isCollected(i * BINGO_SIZE + i + 1)) d1Full = false;
            if (!isCollected(i * BINGO_SIZE + (BINGO_SIZE - 1 - i) + 1)) d2Full = false;
        }
        if (d1Full) lineCount++;
        if (d2Full) lineCount++;

        return lineCount;
    }

    function getWinningNumbers(student) {
        if (!student) return new Set();
        const counts = student.cardCounts;
        const isCollected = (num) => counts[num] > 0;
        let winners = new Set();
        const addArray = (arr) => arr.forEach(n => winners.add(n));

        for (let r = 0; r < BINGO_SIZE; r++) {
            let line = [];
            for (let c = 0; c < BINGO_SIZE; c++) line.push(r * BINGO_SIZE + c + 1);
            if (line.every(n => isCollected(n))) addArray(line);
        }
        for (let c = 0; c < BINGO_SIZE; c++) {
            let line = [];
            for (let r = 0; r < BINGO_SIZE; r++) line.push(r * BINGO_SIZE + c + 1);
            if (line.every(n => isCollected(n))) addArray(line);
        }
        let d1 = [], d2 = [];
        for (let i = 0; i < BINGO_SIZE; i++) {
            d1.push(i * BINGO_SIZE + i + 1);
            d2.push(i * BINGO_SIZE + (BINGO_SIZE - 1 - i) + 1);
        }
        if (d1.every(n => isCollected(n))) addArray(d1);
        if (d2.every(n => isCollected(n))) addArray(d2);

        return winners;
    }

    function incrementCard(student, number) {
        if (!isAdmin) return; // Guard

        const oldLines = getBingoLineCount(student);
        student.cardCounts[number]++;
        const newLines = getBingoLineCount(student);

        if (newLines > oldLines) {
            confetti.start();
        }

        saveState();
        render(); // Re-render to show updates

        // Optimize: don't full re-render whole list? For now full render is fine
        const hovered = document.querySelector(`.student-row[data-id="${student.id}"]:hover`);
        if (hovered) updateGlobalMap(student);
    }

    function decrementCard(student, number) {
        if (!isAdmin) return; // Guard
        if (student.cardCounts[number] > 0) {
            student.cardCounts[number]--;
            saveState();
            render();
            const hovered = document.querySelector(`.student-row[data-id="${student.id}"]:hover`);
            if (hovered) updateGlobalMap(student);
        }
    }

    function initGlobalMap() {
        globalGrid.innerHTML = '';
        for (let i = 1; i <= 25; i++) {
            const cell = document.createElement('div');
            cell.className = 'map-cell';
            cell.textContent = i;
            cell.id = `map-cell-${i}`;
            globalGrid.appendChild(cell);
        }
    }

    function updateGlobalMap(student) {
        const allCells = document.querySelectorAll('.map-cell');
        allCells.forEach(c => {
            c.className = 'map-cell';
        });

        if (!student) {
            mapLabel.textContent = "Bingo Map (Hover over a student to view progress)";
            mapLabel.classList.remove('active');
            return;
        }

        mapLabel.textContent = `Viewing Map for: ${student.name}`;
        mapLabel.classList.add('active');
        const winningNums = getWinningNumbers(student);

        for (let i = 1; i <= 25; i++) {
            const count = student.cardCounts[i] || 0;
            const cell = document.getElementById(`map-cell-${i}`);
            if (count > 0) cell.classList.add('marked');
            if (winningNums.has(i)) cell.classList.add('winner');
        }
    }

    // --- Render ---
    function render() {
        // Sort students: Bingo lines desc, then name asc
        students.sort((a, b) => {
            const linesA = getBingoLineCount(a);
            const linesB = getBingoLineCount(b);
            if (linesB !== linesA) return linesB - linesA;
            return a.name.localeCompare(b.name);
        });

        // Update Stats
        if (totalStudentsEl) totalStudentsEl.textContent = students.length;
        if (totalCardsEl) {
            const globalTotal = students.reduce((sum, s) => {
                return sum + Object.values(s.cardCounts).reduce((a, b) => a + b, 0);
            }, 0);
            totalCardsEl.textContent = globalTotal;
        }

        studentListEl.innerHTML = '';
        if (students.length === 0) {
            studentListEl.appendChild(emptyState);
            // Don't return, we still might need to render other things
        }

        students.forEach(student => {
            const row = document.createElement('div');
            const lineCount = getBingoLineCount(student);
            const total = Object.values(student.cardCounts).reduce((a, b) => a + b, 0);

            // Add read-only class if not admin
            row.className = `student-row ${lineCount > 0 ? 'has-bingo' : ''} ${!isAdmin ? 'read-only' : ''}`;
            row.dataset.id = student.id;

            const header = `
                <div class="row-header">
                    <div class="student-info">
                        <h3>${student.name} <span class="bingo-indicator">${lineCount} LINES!</span></h3>
                        <div class="student-meta">Collected: ${total}</div>
                    </div>
                    <button class="delete-student-btn" data-delete-id="${student.id}" title="Remove Student">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                </div>
            `;

            let chipsHtml = '<div class="input-strip-container"><div class="number-chips">';
            for (let i = 1; i <= 25; i++) {
                const count = student.cardCounts[i] || 0;
                chipsHtml += `
                    <div class="chip ${count > 0 ? 'active' : ''} ${count > 1 ? 'has-multiple' : ''}" 
                         data-num="${i}" 
                         oncontextmenu="return false;">
                        ${i}
                        <div class="chip-count">${count}</div>
                    </div>
                `;
            }
            chipsHtml += '</div></div>';

            row.innerHTML = header + chipsHtml;

            // Events
            const chips = row.querySelectorAll('.chip');
            chips.forEach(chip => {
                const num = parseInt(chip.dataset.num);
                chip.addEventListener('click', (e) => {
                    e.stopPropagation();
                    incrementCard(student, num);
                });
                chip.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    decrementCard(student, num);
                });
            });

            // Delete button
            const delBtn = row.querySelector('.delete-student-btn');
            delBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                removeStudent(student.id);
            });

            row.addEventListener('mouseenter', () => updateGlobalMap(student));
            row.addEventListener('mouseleave', () => updateGlobalMap(null));

            studentListEl.appendChild(row);
        });
    }

    // --- Init ---
    initGlobalMap();

    // Listeners
    loginBtn.addEventListener('click', toggleAdminMode);
    changePwdBtn.addEventListener('click', changePassword);

    addStudentBtn.addEventListener('click', () => addStudent());
    newStudentInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addStudent();
    });

    csvInput.addEventListener('change', handleCSVUpload);

    render(); // Initial render (guest mode)
});

