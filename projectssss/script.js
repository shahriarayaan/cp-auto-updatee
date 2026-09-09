// --- 1. FIREBASE CONFIGURATION ---
const firebaseConfig = {
    apiKey: "AIzaSyCo8U1Nu5XmTn6Y40uFR5KSc0z5aMFPG38",
    authDomain: "cp-tracker-7b54f.firebaseapp.com",
    databaseURL: "https://cp-tracker-7b54f-default-rtdb.firebaseio.com",
    projectId: "cp-tracker-7b54f",
    storageBucket: "cp-tracker-7b54f.firebasestorage.app",
    messagingSenderId: "553691786776",
    appId: "1:553691786776:web:330b45007c3db68d17dd6d",
    measurementId: "G-KT4XC5JXFP"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// --- 2. DYNAMIC PROBLEM DATA ---
let problems = []; // Hardcoded array bad diye Firebase theke dynamic sync hobe

// --- 3. LOCAL STATE & INIT ---
let userData = JSON.parse(localStorage.getItem('cp_tracker_user')) || {
    handle: '',
    solvedProblems: [],
    solvedCount: 0
};

let globalUsersList = [];

function init() {
    if (userData.handle) {
        document.getElementById('cf-handle-input').value = userData.handle;
        document.getElementById('handle-status').innerText = `Active Handle: ${userData.handle}`;
    }
    listenToProblems(); // Dynamic Problems Sync
    listenToGlobalLeaderboard();
}

// Navigation Handler
function switchPage(pageId) {
    document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
    document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
    
    document.getElementById(pageId).classList.add('active');
    
    const activeLink = Array.from(document.querySelectorAll('.nav-link')).find(
        link => link.getAttribute('onclick') === `switchPage('${pageId}')`
    );
    if (activeLink) activeLink.classList.add('active');

    if (pageId === 'profile') renderProfile();
}

// --- 4. FIREBASE REAL-TIME SYNC ---
function listenToProblems() {
    // Listens for problem list changes live from Firebase
    database.ref('problems').on('value', (snapshot) => {
        const data = snapshot.val();
        if (data) {
            problems = Object.values(data);
        } else {
            problems = [];
        }
        renderProblems();
        if (document.getElementById('profile') && document.getElementById('profile').classList.contains('active')) {
            renderProfile();
        }
    });
}

function saveHandle() {
    const input = document.getElementById('cf-handle-input').value.trim();
    if (!input) return alert('Please enter a valid handle');
    
    const sanitizedHandle = input.replace(/[.#$\[\]]/g, "_");

    userData.handle = input;
    localStorage.setItem('cp_tracker_user', JSON.stringify(userData));
    document.getElementById('handle-status').innerText = `Active Handle: ${userData.handle}`;

    database.ref('users/' + sanitizedHandle).set({
        handle: userData.handle,
        solvedCount: userData.solvedCount || 0
    });

    alert('Handle saved and synced with Live Leaderboard!');
}

function syncUserToFirebase() {
    if (!userData.handle) return;
    const sanitizedHandle = userData.handle.replace(/[.#$\[\]]/g, "_");
    
    database.ref('users/' + sanitizedHandle).update({
        handle: userData.handle,
        solvedCount: userData.solvedCount
    });
}

function listenToGlobalLeaderboard() {
    database.ref('users').on('value', (snapshot) => {
        const data = snapshot.val();
        globalUsersList = [];
        
        if (data) {
            Object.keys(data).forEach(key => {
                globalUsersList.push(data[key]);
            });
        }
        
        globalUsersList.sort((a, b) => b.solvedCount - a.solvedCount);
        
        renderLeaderboardUI();
        renderProfile();
    });
}

// --- 5. RENDER FUNCTIONS ---
function renderProblems() {
    const container = document.getElementById('problem-container');
    container.innerHTML = '';

    if (problems.length === 0) {
        container.innerHTML = `<p style="text-align:center; color:#666;">No problems added yet.</p>`;
        return;
    }

    problems.forEach(p => {
        const isSolved = userData.solvedProblems.includes(p.id);
        const badgeHTML = isSolved 
            ? `<span class="badge badge-solved">Accepted</span>`
            : `<span class="badge badge-pending">Pending</span>`;

        const buttonHTML = isSolved 
            ? `<button class="btn btn-outline" disabled>Completed</button>`
            : `<button class="btn" onclick="verifySubmission('${p.contestId}', '${p.index}', '${p.id}')">Verify Solution</button>`;

        container.innerHTML += `
            <div class="problem-card">
                <div class="problem-info">
                    <a href="${p.link}" target="_blank">${p.contestId}${p.index} - ${p.name}</a>
                    <div style="margin-top: 0.25rem;">${badgeHTML}</div>
                </div>
                <div>${buttonHTML}</div>
            </div>
        `;
    });
}

async function verifySubmission(contestId, index, problemId) {
    if (!userData.handle) {
        alert('Please set your Codeforces handle on the Home page first!');
        switchPage('landing');
        return;
    }

    try {
        const res = await fetch(`https://codeforces.com/api/user.status?handle=${userData.handle}&from=1&count=20`);
        const data = await res.json();

        if (data.status !== "OK") {
            alert('Error fetching CF data. Check your username.');
            return;
        }

        const hasPassed = data.result.some(sub => 
            sub.problem.contestId == contestId && 
            sub.problem.index === index && 
            sub.verdict === "OK"
        );

        if (hasPassed) {
            if (!userData.solvedProblems.includes(problemId)) {
                userData.solvedProblems.push(problemId);
                userData.solvedCount += 1;
                
                localStorage.setItem('cp_tracker_user', JSON.stringify(userData));
                syncUserToFirebase();
                
                alert('Congratulations! Problem verified and score updated globally.');
                renderProblems();
            }
        } else {
            document.getElementById('modal').style.display = 'flex';
        }
    } catch (err) {
        alert('Network error while connecting to Codeforces API.');
    }
}

function renderLeaderboardUI() {
    const tbody = document.getElementById('leaderboard-body');
    tbody.innerHTML = '';

    if (globalUsersList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;">No users registered yet.</td></tr>`;
        return;
    }

    globalUsersList.forEach((item, index) => {
        const isCurrentUser = userData.handle && item.handle.toLowerCase() === userData.handle.toLowerCase();
        tbody.innerHTML += `
            <tr style="${isCurrentUser ? 'background-color: var(--light-green); font-weight: bold;' : ''}">
                <td>#${index + 1}</td>
                <td>${item.handle} ${isCurrentUser ? '(You)' : ''}</td>
                <td>${item.solvedCount}</td>
                <td><span class="badge badge-solved">Active</span></td>
            </tr>
        `;
    });
}

function renderProfile() {
    document.getElementById('user-solved').innerText = userData.solvedCount;
    
    const userIndex = globalUsersList.findIndex(item => item.handle.toLowerCase() === (userData.handle || '').toLowerCase());
    document.getElementById('user-rank').innerText = userIndex > -1 ? `#${userIndex + 1}` : '#--';

    const pendingContainer = document.getElementById('pending-list');
    pendingContainer.innerHTML = '';

    const pendingProblems = problems.filter(p => !userData.solvedProblems.includes(p.id));
    if (pendingProblems.length === 0) {
        pendingContainer.innerHTML = `<p style="color: var(--primary-green); font-weight: 600;">Great job! All problems are completed.</p>`;
    } else {
        pendingProblems.forEach(p => {
            pendingContainer.innerHTML += `
                <div class="problem-card">
                    <div class="problem-info">
                        <a href="${p.link}" target="_blank">${p.contestId}${p.index} - ${p.name}</a>
                    </div>
                    <span class="badge badge-pending">Pending</span>
                </div>
            `;
        });
    }
}

function closeModal() {
    document.getElementById('modal').style.display = 'none';
}

// --- 6. ADMIN FEATURE: SHUDHU LINK DIYE PROBLEM ADD KORA ---
function addProblem(url, problemName) {
    try {
        // Link string parse kora (e.g. https://codeforces.com/problemset/problem/1900/A)
        const parts = url.split('/').filter(Boolean);
        const index = parts.pop();
        const contestId = parts.pop();

        if (!contestId || !index) {
            alert("Invalid Codeforces URL format!");
            return;
        }

        const newId = Date.now().toString();
        const newProblem = {
            id: newId,
            contestId: contestId,
            index: index.toUpperCase(),
            name: problemName,
            link: url.trim()
        };

        // Direct Firebase Database-e push (Vercel automatic live hobe)
        database.ref('problems/' + newId).set(newProblem)
            .then(() => alert(`Successfully added: ${contestId}${index.toUpperCase()} - ${problemName}`))
            .catch(err => alert("Error adding problem: " + err.message));

    } catch (e) {
        alert("Please enter a valid Codeforces problem URL.");
    }
}

init();