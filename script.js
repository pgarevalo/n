let notes = [];
let activeNoteId = null;

const noteArea = document.getElementById('note-area');
const tabBar = document.getElementById('tab-bar');
const addBtn = document.getElementById('add-tab-btn');
const downloadBtn = document.getElementById('download-btn');
const openBtn = document.getElementById('open-btn');
const fileInput = document.getElementById('file-input');
const statusText = document.getElementById('status');
const themeBtn = document.getElementById('theme-btn');
const fontSizeSelect = document.getElementById('font-size'); // New Selector

// 1. INITIALIZE
// Added 'fontSize' to the retrieval list
chrome.storage.local.get(['allNotes', 'lastActiveId', 'theme', 'fontSize'], (data) => {
    notes = data.allNotes || [{ id: Date.now(), title: 'Note 1', content: '' }];
    activeNoteId = data.lastActiveId || notes[0].id;

    // --- THEME INITIALIZATION ---
    let currentTheme = data.theme;
    if (!currentTheme) {
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            currentTheme = 'dark';
        } else {
            currentTheme = 'light';
        }
    }
    applyTheme(currentTheme);

    // --- FONT SIZE INITIALIZATION ---
    const savedFontSize = data.fontSize || '12px';
    noteArea.style.fontSize = savedFontSize;
    fontSizeSelect.value = savedFontSize;

    renderTabs();
    loadActiveNote();
});

// --- THEME LOGIC ---
function applyTheme(theme) {
    if (theme === 'dark') {
        document.body.classList.add('dark-mode');
        themeBtn.textContent = "Light Mode";
    } else {
        document.body.classList.remove('dark-mode');
        themeBtn.textContent = "Dark Mode";
    }
}

themeBtn.onclick = () => {
    const isDark = document.body.classList.contains('dark-mode');
    const newTheme = isDark ? 'light' : 'dark';
    applyTheme(newTheme);
    chrome.storage.local.set({ theme: newTheme });
};

// --- FONT SIZE LOGIC ---
fontSizeSelect.onchange = () => {
    const size = fontSizeSelect.value;
    noteArea.style.fontSize = size;
    chrome.storage.local.set({ fontSize: size });
};

// 2. RENDER TABS
function renderTabs() {
    tabBar.querySelectorAll('.tab').forEach(t => t.remove());

    notes.forEach(note => {
        const tab = document.createElement('div');
        tab.className = `tab ${note.id === activeNoteId ? 'active' : ''}`;
        
        const titleSpan = document.createElement('span');
        titleSpan.textContent = note.title;
        
        titleSpan.addEventListener('dblclick', (e) => {
            e.stopPropagation(); 
            renameTab(note.id, titleSpan);
        });

        const closeBtn = document.createElement('span');
        closeBtn.className = 'close-tab';
        closeBtn.innerHTML = '&times;';
        closeBtn.onclick = (e) => {
            e.stopPropagation();
            deleteTab(note.id);
        };

        tab.onclick = () => switchTab(note.id);
        
        tab.appendChild(titleSpan);
        tab.appendChild(closeBtn);
        tabBar.insertBefore(tab, addBtn);
    });
}

// 3. TAB ACTIONS
function switchTab(id) {
    if (activeNoteId === id) return; 

    saveCurrentNote();
    activeNoteId = id;
    loadActiveNote();
    renderTabs();
    saveAllData();
}
function loadActiveNote() {
    const note = notes.find(n => n.id === activeNoteId);
    noteArea.value = note ? note.content : '';
}

function saveCurrentNote() {
    const note = notes.find(n => n.id === activeNoteId);
    if (note) {
        note.content = noteArea.value;
    }
}

function saveAllData() {
    chrome.storage.local.set({ allNotes: notes, lastActiveId: activeNoteId });
}

addBtn.onclick = () => {
    const newNote = { id: Date.now(), title: `Note ${notes.length + 1}`, content: '' };
    notes.push(newNote);
    switchTab(newNote.id);
};

function deleteTab(id) {
    if (notes.length === 1) return alert("Keep at least one tab.");
    if (confirm("Delete this note?")) {
        notes = notes.filter(n => n.id !== id);
        if (activeNoteId === id) activeNoteId = notes[0].id;
        renderTabs();
        loadActiveNote();
        saveAllData();
    }
}

function renameTab(id, element) {
    const note = notes.find(n => n.id === id);
    const input = document.createElement('input');
    input.className = 'tab-input';
    input.value = note.title;

    element.replaceWith(input);
    input.focus();
    input.select();

    const finish = () => {
        if (input.value.trim() !== "") {
            note.title = input.value;
        }
        renderTabs();
        saveAllData();
    };

    input.onblur = finish;
    input.onkeydown = (e) => {
        if (e.key === 'Enter') finish();
        if (e.key === 'Escape') renderTabs();
    };
}

// 4. AUTO-SAVE
noteArea.addEventListener('input', () => {
    statusText.textContent = "Saving...";
    saveCurrentNote();
    saveAllData();
    setTimeout(() => statusText.textContent = "Auto-saved", 500);
});

// 5. FILE IO (Save As & Open)
downloadBtn.addEventListener('click', async () => {
    if ('showSaveFilePicker' in window) {
        try {
            const handle = await window.showSaveFilePicker({
                suggestedName: `${notes.find(n => n.id === activeNoteId).title}.txt`,
                types: [{ description: 'Text', accept: {'text/plain': ['.txt']} }]
            });
            const writable = await handle.createWritable();
            await writable.write(noteArea.value);
            await writable.close();
        } catch (e) {}
    }
});

openBtn.onclick = () => fileInput.click();
fileInput.onchange = (e) => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = (ev) => {
        const newNote = { id: Date.now(), title: file.name.replace('.txt',''), content: ev.target.result };
        notes.push(newNote);
        switchTab(newNote.id);
    };
    reader.readAsText(file);
};