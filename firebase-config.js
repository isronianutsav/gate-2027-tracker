import { db } from "./firebase-config.js";

import {
  collection,
  setDoc,
  getDoc,
  doc,
  getDocs,
  addDoc,
  onSnapshot,
  updateDoc,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

// ============================================================
//  LOGIN CONFIGURATION
// ============================================================
const CORRECT_PASSWORD = "gate2027"; // 👈 Change this to your password

// ============================================================
//  GLOBALS
// ============================================================
let memberChart = null;
let currentMember = "";
let celebrationShown = false;

const members = ["Utsav", "Shivendu", "Alok", "Abhijeet", "Abhishek"];

// ============================================================
//  HELPERS
// ============================================================
async function addActivity(message) {
  await addDoc(collection(db, "activities"), { message, time: Date.now() });
}

// ============================================================
//  CREATE MEMBERS
// ============================================================
async function createMembers() {
  for (const name of members) {
    const ref = doc(db, "members", name);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, { name, progress: 0, streak: 0, lastActive: "" });
    }
  }
}

// ============================================================
//  LOAD MEMBER CARDS
// ============================================================
async function loadMembers() {
  const container = document.getElementById("members");
  container.innerHTML = "";
  const snapshot = await getDocs(collection(db, "members"));
  snapshot.forEach((member) => {
    const data = member.data();
    const p = data.progress || 0;
    let badge =
      p >= 76 ? "👑 GATE Warrior" :
      p >= 51 ? "🥇 Advanced" :
      p >= 26 ? "🥈 Intermediate" : "🥉 Beginner";

    container.innerHTML += `
      <div onclick="window.openMember('${data.name}')" class="member-card">
        <div class="member-card-header">
          <span class="member-card-name">${data.name}</span>
          <span class="member-card-badge">${badge}</span>
        </div>
        <div class="member-card-stats">
          <span>📊 ${p}%</span>
          <span class="text-orange-500">🔥 ${data.streak || 0}</span>
        </div>
        <div class="member-card-progress">
          <div class="member-card-progress-bar" style="width: ${p}%"></div>
        </div>
      </div>
    `;
  });
}

// ============================================================
//  LOAD LEADERBOARD
// ============================================================
async function loadLeaderboard() {
  const board = document.getElementById("leaderboard");
  board.innerHTML = "";
  const snapshot = await getDocs(collection(db, "members"));
  let list = [];
  snapshot.forEach(m => list.push(m.data()));
  list.sort((a, b) => (b.progress || 0) - (a.progress || 0));

  list.forEach((m, i) => {
    const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`;
    board.innerHTML += `
      <div class="leaderboard-item">
        <span><span class="medal">${medal}</span> ${m.name}</span>
        <span class="font-semibold text-indigo-600 dark:text-indigo-300">${m.progress || 0}%</span>
      </div>
    `;
  });
}

// ============================================================
//  LOAD ANALYTICS
// ============================================================
async function loadAnalytics() {
  const snapshot = await getDocs(collection(db, "members"));
  let labels = [],
    progress = [];
  snapshot.forEach(m => {
    labels.push(m.data().name);
    progress.push(m.data().progress || 0);
  });

  const ctx = document.getElementById("memberChart").getContext("2d");
  if (memberChart) memberChart.destroy();
  memberChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Progress %",
        data: progress,
        backgroundColor: "#818cf8",
        borderRadius: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, max: 100 }
      }
    }
  });
}

// ============================================================
//  OPEN MEMBER
// ============================================================
window.openMember = function(name) {
  currentMember = name;
  const section = document.getElementById("subjectSection");
  section.classList.remove("hidden");

  document.getElementById("memberName").innerHTML =
    `<i class="fas fa-user-graduate text-indigo-500"></i> ${name}'s Subjects`;

  loadSubjects();
  loadTargets();
  loadStudyHours();
  loadWeeklyHours();
  loadMemberStats();
  updateTargetCompletion();
};

// ============================================================
//  SUBJECTS CRUD
// ============================================================
window.addSubject = async function() {
  if (!currentMember) return alert("Select a member first");
  const subject = document.getElementById("subjectInput").value.trim();
  if (!subject) return;

  const snap = await getDocs(collection(db, "members", currentMember, "subjects"));
  let exists = false;
  snap.forEach(d => {
    if (d.data().name.toLowerCase() === subject.toLowerCase()) exists = true;
  });
  if (exists) return alert("Subject already exists");

  await addDoc(collection(db, "members", currentMember, "subjects"), {
    name: subject,
    progress: 0,
    lecturesDone: 0,
    lecturesTotal: 0,
    dppsDone: 0,
    dppsTotal: 0,
    pyqsDone: 0,
    pyqsTotal: 0,
    notes: ""
  });

  document.getElementById("subjectInput").value = "";
  await addActivity(`${currentMember} added subject ${subject}`);
};

window.deleteSubject = async function(id) {
  if (!confirm("Delete subject?")) return;
  await deleteDoc(doc(db, "members", currentMember, "subjects", id));
  await updateMemberProgress();
  loadMembers();
};

window.updateField = async function(id, field, value) {
  const ref = doc(db, "members", currentMember, "subjects", id);
  await updateDoc(ref, { [field]: Number(value) });

  const subjSnap = await getDoc(ref);
  const data = subjSnap.data();
  const done = (data.lecturesDone || 0) + (data.dppsDone || 0) + (data.pyqsDone || 0);
  const total = (data.lecturesTotal || 0) + (data.dppsTotal || 0) + (data.pyqsTotal || 0);
  const prog = total === 0 ? 0 : Math.round((done / total) * 100);
  await updateDoc(ref, { progress: prog });

  setTimeout(async () => {
    await updateMemberProgress();
    await updateStreak();
    loadMembers();
    loadLeaderboard();
    loadAnalytics();
  }, 300);
};

window.updateNote = async function(id, note) {
  await updateDoc(doc(db, "members", currentMember, "subjects", id), { notes: note });
};

// ============================================================
//  LOAD SUBJECTS
// ============================================================
function loadSubjects() {
  const list = document.getElementById("subjectList");
  onSnapshot(collection(db, "members", currentMember, "subjects"), (snap) => {
    list.innerHTML = "";
    snap.forEach((docSnap) => {
      const s = docSnap.data();
      const p = s.progress || 0;
      let statusClass = "notstarted";
      let statusText = "⏸️ Not started";
      if (p >= 100) { statusClass = "done";
        statusText = "✅ Done"; } else if (p > 0) { statusClass = "inprogress";
        statusText = "⏳ In progress"; }

      list.innerHTML += `
        <div class="subject-card">
          <div class="subject-card-header">
            <h4 class="font-bold text-lg">${s.name}</h4>
            <span class="subject-status ${statusClass}">${statusText}</span>
            <button onclick="window.deleteSubject('${docSnap.id}')" class="text-red-400 hover:text-red-600 text-sm">
              <i class="fas fa-trash"></i>
            </button>
          </div>

          <div class="subject-fields">
            <div>
              <label>Lectures</label>
              <div class="field-pair">
                <input type="number" value="${s.lecturesDone || 0}" onchange="window.updateField('${docSnap.id}','lecturesDone',this.value)">
                <span style="opacity:0.4;">/</span>
                <input type="number" value="${s.lecturesTotal || 0}" onchange="window.updateField('${docSnap.id}','lecturesTotal',this.value)">
              </div>
            </div>
            <div>
              <label>DPP</label>
              <div class="field-pair">
                <input type="number" value="${s.dppsDone || 0}" onchange="window.updateField('${docSnap.id}','dppsDone',this.value)">
                <span style="opacity:0.4;">/</span>
                <input type="number" value="${s.dppsTotal || 0}" onchange="window.updateField('${docSnap.id}','dppsTotal',this.value)">
              </div>
            </div>
            <div>
              <label>PYQ</label>
              <div class="field-pair">
                <input type="number" value="${s.pyqsDone || 0}" onchange="window.updateField('${docSnap.id}','pyqsDone',this.value)">
                <span style="opacity:0.4;">/</span>
                <input type="number" value="${s.pyqsTotal || 0}" onchange="window.updateField('${docSnap.id}','pyqsTotal',this.value)">
              </div>
            </div>
            <div class="subject-notes" style="grid-column: span 2;">
              <label>Notes</label>
              <textarea rows="2" onchange="window.updateNote('${docSnap.id}',this.value)">${s.notes || ''}</textarea>
            </div>
          </div>

          <div class="member-card-progress" style="margin-top: 0.75rem;">
            <div class="member-card-progress-bar" style="width: ${p}%"></div>
          </div>
          <span class="text-sm font-semibold">${p}%</span>
        </div>
      `;
    });
  });
}

// ============================================================
//  MEMBER STATS
// ============================================================
async function loadMemberStats() {
  const snap = await getDoc(doc(db, "members", currentMember));
  const d = snap.data() || {};
  document.getElementById("statProgress").innerText = (d.progress || 0) + "%";
  document.getElementById("statStreak").innerText = d.streak || 0;
}

// ============================================================
//  TARGETS CRUD
// ============================================================
window.addTarget = async function() {
  if (!currentMember) return alert("Select a member");
  const title = document.getElementById("targetInput").value.trim();
  if (!title) return;
  await addDoc(collection(db, "members", currentMember, "targets"), { title, completed: false });
  document.getElementById("targetInput").value = "";
  await addActivity(`${currentMember} added target: ${title}`);
};

window.toggleTarget = async function(id, status) {
  await updateDoc(doc(db, "members", currentMember, "targets", id), { completed: status });
  if (status) await addActivity(`${currentMember} completed a target`);
  updateTargetCompletion();
};

window.deleteTarget = async function(id) {
  if (!confirm("Delete target?")) return;
  await deleteDoc(doc(db, "members", currentMember, "targets", id));
  updateTargetCompletion();
};

function loadTargets() {
  const list = document.getElementById("targetList");
  onSnapshot(collection(db, "members", currentMember, "targets"), (snap) => {
    list.innerHTML = "";
    snap.forEach((d) => {
      const t = d.data();
      list.innerHTML += `
        <div class="target-item">
          <input type="checkbox" ${t.completed ? "checked" : ""} onchange="window.toggleTarget('${d.id}',this.checked)">
          <span class="target-text ${t.completed ? 'done' : ''}">${t.title}</span>
          <button onclick="window.deleteTarget('${d.id}')" class="text-red-400 hover:text-red-600 text-sm">
            <i class="fas fa-times"></i>
          </button>
        </div>
      `;
    });
    updateTargetCompletion();
  });
}

async function updateTargetCompletion() {
  const snap = await getDocs(collection(db, "members", currentMember, "targets"));
  let total = 0,
    done = 0;
  snap.forEach(d => { total++;
    if (d.data().completed) done++; });
  const p = total === 0 ? 0 : Math.round((done / total) * 100);
  document.getElementById("targetCompletion").innerText = p + "%";
}

// ============================================================
//  STUDY HOURS
// ============================================================
window.saveStudyHours = async function() {
  const hours = Number(document.getElementById("studyHours").value);
  if (!hours) return;
  const today = new Date().toISOString().split("T")[0];
  await setDoc(doc(db, "members", currentMember, "studyHours", today), { hours });
  loadStudyHours();
  loadWeeklyHours();
};

async function loadStudyHours() {
  const today = new Date().toISOString().split("T")[0];
  const snap = await getDoc(doc(db, "members", currentMember, "studyHours", today));
  const h = snap.exists() ? snap.data().hours : 0;
  document.getElementById("hoursDisplay").innerText = `Today: ${h}h`;
}

async function loadWeeklyHours() {
  const div = document.getElementById("weeklyHours");
  const totalEl = document.getElementById("weeklyTotal");
  div.innerHTML = "";
  let total = 0;
  const snap = await getDocs(collection(db, "members", currentMember, "studyHours"));
  snap.forEach(d => {
    const h = d.data().hours || 0;
    total += h;
    div.innerHTML += `<div class="week-item"><span>${d.id}</span><span>${h}h</span></div>`;
  });
  totalEl.innerText = `Weekly Total: ${total}h`;
}

// ============================================================
//  ACTIVITY FEED
// ============================================================
function loadActivityFeed() {
  const feed = document.getElementById("activityFeed");
  onSnapshot(collection(db, "activities"), (snap) => {
    let items = [];
    snap.forEach(d => items.push(d.data()));
    items.sort((a, b) => b.time - a.time);
    feed.innerHTML = items.slice(0, 20).map(i =>
      `<div class="activity-item">${i.message}</div>`
    ).join("");
  });
}

// ============================================================
//  GOAL
// ============================================================
window.saveGoal = async function() {
  const goal = document.getElementById("goalInput").value.trim();
  if (!goal) return;
  await setDoc(doc(db, "team", "goal"), { title: goal });
  document.getElementById("goalInput").value = "";
  
  const ref = doc(db, "team", "goalCheckoff");
  await setDoc(ref, {});
  celebrationShown = false;
  await initializeGoalCheckoff();
  await addActivity("📝 New team goal set: " + goal);
};

function loadGoal() {
  onSnapshot(doc(db, "team", "goal"), (snap) => {
    if (snap.exists()) {
      const t = snap.data().title;
      document.getElementById("goalDisplay").innerText = t;
      document.getElementById("goalDisplayInline").innerText = t;
    }
  });
}

// ============================================================
//  TEAM GOAL CHECKOFF
// ============================================================
window.toggleGoalCheckoff = async function(memberName, checked) {
  const ref = doc(db, "team", "goalCheckoff");
  const snap = await getDoc(ref);
  
  let checkoffData = {};
  if (snap.exists()) {
    checkoffData = snap.data();
  }
  
  checkoffData[memberName] = checked;
  await setDoc(ref, checkoffData);
  await checkGoalCompletion();
};

async function checkGoalCompletion() {
  const memberSnap = await getDocs(collection(db, "members"));
  const membersList = [];
  memberSnap.forEach(m => membersList.push(m.data().name));
  
  const ref = doc(db, "team", "goalCheckoff");
  const snap = await getDoc(ref);
  const checkoffData = snap.exists() ? snap.data() : {};
  
  let checkedCount = 0;
  membersList.forEach(name => {
    if (checkoffData[name] === true) {
      checkedCount++;
    }
  });
  
  const totalMembers = membersList.length;
  const progress = totalMembers === 0 ? 0 : Math.round((checkedCount / totalMembers) * 100);
  
  document.getElementById("goalProgressBar").style.width = progress + "%";
  document.getElementById("goalProgressText").innerText = progress + "% completed (" + checkedCount + "/" + totalMembers + ")";
  
  const badge = document.getElementById("goalStatusBadge");
  if (progress === 100) {
    badge.innerText = "✅ Completed!";
    badge.classList.add("completed");
    
    if (!celebrationShown) {
      celebrationShown = true;
      showCelebration();
      await addActivity("🎉 Team goal completed by all members!");
    }
  } else {
    badge.innerText = "⏳ In Progress (" + checkedCount + "/" + totalMembers + ")";
    badge.classList.remove("completed");
    celebrationShown = false;
  }
  
  loadGoalCheckoffList();
}

async function loadGoalCheckoffList() {
  const container = document.getElementById("goalCheckoffList");
  if (!container) return;
  
  const memberSnap = await getDocs(collection(db, "members"));
  const membersList = [];
  memberSnap.forEach(m => membersList.push(m.data().name));
  
  const ref = doc(db, "team", "goalCheckoff");
  const snap = await getDoc(ref);
  const checkoffData = snap.exists() ? snap.data() : {};
  
  container.innerHTML = "";
  membersList.forEach(name => {
    const checked = checkoffData[name] === true;
    container.innerHTML += `
      <div class="goal-checkoff-item ${checked ? 'checked' : ''}">
        <input type="checkbox" 
               ${checked ? 'checked' : ''} 
               onchange="window.toggleGoalCheckoff('${name}', this.checked)">
        <span class="member-name">${name}</span>
        <span class="check-status ${checked ? 'done' : 'pending'}">
          ${checked ? '✅ Done' : '⏳ Pending'}
        </span>
      </div>
    `;
  });
  
  let allChecked = true;
  membersList.forEach(name => {
    if (checkoffData[name] !== true) {
      allChecked = false;
    }
  });
  if (!allChecked) {
    celebrationShown = false;
  }
  
  await checkGoalCompletion();
}

window.resetTeamGoal = async function() {
  if (!confirm("Reset all goal checkoffs? This will uncheck all members.")) return;
  
  const ref = doc(db, "team", "goalCheckoff");
  await setDoc(ref, {});
  
  const popup = document.getElementById("celebrationPopup");
  popup.classList.add("hidden");
  
  celebrationShown = false;
  
  await loadGoalCheckoffList();
  await addActivity("🔄 Team goal checkoff was reset");
};

function showCelebration() {
  const popup = document.getElementById("celebrationPopup");
  popup.classList.remove("hidden");
  
  const goalText = document.getElementById("goalDisplay").innerText;
  document.getElementById("celebrationGoalText").innerText = 
    goalText !== "No Goal Set" ? 
    `🎯 "${goalText}" completed by everyone!` : 
    "All team members have checked off the goal!";
  
  createConfetti();
}

window.closeCelebration = function() {
  document.getElementById("celebrationPopup").classList.add("hidden");
};

function createConfetti() {
  const container = document.createElement('div');
  container.className = 'confetti-container';
  document.body.appendChild(container);
  
  const colors = ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#ff6bff', '#ff9f43'];
  const shapes = ['■', '●', '▲', '★', '◆', '❤'];
  
  for (let i = 0; i < 80; i++) {
    const confetti = document.createElement('div');
    confetti.className = 'confetti';
    confetti.textContent = shapes[Math.floor(Math.random() * shapes.length)];
    confetti.style.left = Math.random() * 100 + '%';
    confetti.style.color = colors[Math.floor(Math.random() * colors.length)];
    confetti.style.fontSize = (Math.random() * 15 + 8) + 'px';
    confetti.style.animationDuration = (Math.random() * 2 + 1.5) + 's';
    confetti.style.animationDelay = (Math.random() * 1.5) + 's';
    container.appendChild(confetti);
  }
  
  setTimeout(() => {
    container.remove();
  }, 4000);
}

async function initializeGoalCheckoff() {
  celebrationShown = false;
  await loadGoalCheckoffList();
}

// ============================================================
//  COMPARISON & ACCOUNTABILITY
// ============================================================
async function loadComparison() {
  const div = document.getElementById("comparisonSection");
  const snap = await getDocs(collection(db, "members"));
  div.innerHTML = "";
  snap.forEach(m => {
    const d = m.data();
    div.innerHTML += `
      <div class="comparison-item">
        <span>${d.name}</span>
        <span class="font-semibold">${d.progress || 0}%</span>
      </div>
    `;
  });
}

async function loadAccountability() {
  const box = document.getElementById("accountabilityList");
  const today = new Date().toISOString().split("T")[0];
  const snap = await getDocs(collection(db, "members"));
  box.innerHTML = "";
  snap.forEach(m => {
    const d = m.data();
    if (d.lastActive !== today) {
      box.innerHTML += `
        <div class="accountability-item warning">
          <i class="fas fa-exclamation-circle"></i> ${d.name} hasn't updated today
        </div>
      `;
    } else {
      box.innerHTML += `
        <div class="accountability-item success">
          <i class="fas fa-check-circle"></i> ${d.name} updated today
        </div>
      `;
    }
  });
}

// ============================================================
//  PROGRESS & STREAK UPDATES
// ============================================================
async function updateMemberProgress() {
  const subSnap = await getDocs(collection(db, "members", currentMember, "subjects"));
  let total = 0,
    count = 0;
  subSnap.forEach(s => { total += s.data().progress || 0;
    count++; });
  const avg = count === 0 ? 0 : Math.round(total / count);
  await updateDoc(doc(db, "members", currentMember), { progress: avg });
}

async function updateStreak() {
  const today = new Date().toISOString().split("T")[0];
  const ref = doc(db, "members", currentMember);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const data = snap.data();
  if (data.lastActive !== today) {
    await updateDoc(ref, { streak: (data.streak || 0) + 1, lastActive: today });
  }
}

// ============================================================
//  COUNTDOWN
// ============================================================
function startCountdown() {
  const gate = new Date("2027-02-06");
  function update() {
    const diff = gate - new Date();
    if (diff <= 0) {
      document.getElementById("countdown").innerText = "🎉 GATE 2027 Started!";
      return;
    }
    const d = Math.floor(diff / (1000 * 60 * 60 * 24));
    const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const m = Math.floor((diff / (1000 * 60)) % 60);
    document.getElementById("countdown").innerText = `${d}d ${h}h ${m}m`;
  }
  update();
  setInterval(update, 60000);
}

// ============================================================
//  SEARCH
// ============================================================
window.searchMembers = function() {
  const q = document.getElementById("searchBox").value.toLowerCase();
  document.querySelectorAll(".member-card").forEach(c => {
    c.style.display = c.innerText.toLowerCase().includes(q) ? "" : "none";
  });
};

// ============================================================
//  EXPORT REPORT
// ============================================================
window.exportReport = async function() {
  const snap = await getDocs(collection(db, "members"));
  let txt = "📊 GATE 2027 TEAM REPORT\n\n";
  snap.forEach(m => {
    const d = m.data();
    txt += `${d.name}  |  Progress: ${d.progress || 0}%  |  Streak: ${d.streak || 0}\n`;
  });
  const blob = new Blob([txt], { type: "text/plain" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "GATE-Team-Report.txt";
  a.click();
};

// ============================================================
//  THEME TOGGLE
// ============================================================
window.toggleTheme = function() {
  document.body.classList.toggle("dark");
  const isDark = document.body.classList.contains("dark");
  localStorage.setItem("darkMode", isDark);
  const icon = document.getElementById("themeIcon");
  const label = document.getElementById("themeLabel");
  icon.className = isDark ? "fas fa-sun" : "fas fa-moon";
  label.innerText = isDark ? "Light" : "Dark";
};

// ============================================================
//  INITIALIZE APP (DEFINED BEFORE BEING CALLED)
// ============================================================
async function initializeApp() {
  await createMembers();
  loadMembers();
  loadLeaderboard();
  loadAnalytics();
  loadActivityFeed();
  loadGoal();
  loadComparison();
  loadAccountability();
  startCountdown();
  await initializeGoalCheckoff();

  if (localStorage.getItem("darkMode") === "true") {
    document.body.classList.add("dark");
    document.getElementById("themeIcon").className = "fas fa-sun";
    document.getElementById("themeLabel").innerText = "Light";
  }
}

// ============================================================
//  LOGIN HANDLERS (DEFINED AFTER initializeApp)
// ============================================================
window.handleLogin = function() {
  const passwordInput = document.getElementById("passwordInput");
  const errorEl = document.getElementById("loginError");
  const password = passwordInput.value.trim();

  if (password === CORRECT_PASSWORD) {
    document.getElementById("loginPage").style.display = "none";
    const mainApp = document.getElementById("mainApp");
    mainApp.classList.remove("hidden");
    setTimeout(() => {
      mainApp.classList.add("visible");
    }, 50);
    errorEl.classList.add("hidden");
    passwordInput.classList.remove("error");
    passwordInput.value = "";
    initializeApp();
  } else {
    errorEl.classList.remove("hidden");
    passwordInput.classList.add("error");
    passwordInput.value = "";
    passwordInput.focus();
    passwordInput.style.animation = "shake 0.4s ease";
    setTimeout(() => {
      passwordInput.style.animation = "";
    }, 500);
  }
};

// Add shake keyframes
const styleSheet = document.createElement("style");
styleSheet.textContent = `
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-8px); }
    75% { transform: translateX(8px); }
  }
`;
document.head.appendChild(styleSheet);

document.addEventListener("DOMContentLoaded", () => {
  const passwordInput = document.getElementById("passwordInput");
  if (passwordInput) {
    passwordInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleLogin();
      }
    });
  }
});

// ============================================================
//  LOGOUT HANDLER
// ============================================================
window.handleLogout = function() {
  if (confirm("Are you sure you want to logout?")) {
    const mainApp = document.getElementById("mainApp");
    mainApp.classList.remove("visible");
    setTimeout(() => {
      mainApp.classList.add("hidden");
      document.getElementById("loginPage").style.display = "flex";
      document.getElementById("passwordInput").value = "";
      document.getElementById("loginError").classList.add("hidden");
    }, 300);
  }
};

// ============================================================
//  PREVENT ACCESS WITHOUT LOGIN
// ============================================================
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("loginPage").style.display = "flex";
  document.getElementById("mainApp").classList.add("hidden");
  document.getElementById("mainApp").classList.remove("visible");
});