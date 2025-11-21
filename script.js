(function () {
            // --- Utilities & storage keys ---
            const DK = 'lifedrop_donors';
            const RK = 'lifedrop_receivers';
            const NOTIF_LIMIT = 5;

            function loadJSON(k) { try { return JSON.parse(localStorage.getItem(k) || '[]') } catch (e) { return [] } }
            function saveJSON(k, v) { localStorage.setItem(k, JSON.stringify(v)) }

            // default demo donors (only added if none exist)
            const defaultDonors = [
                { id: idGen(), name: "Arjun Verma", blood: "A+", phone: "9876543210", center: "City Blood Centre — Downtown", verified: true },
                { id: idGen(), name: "Riya Sharma", blood: "O+", phone: "9123456789", center: "Greenfield Medical", verified: true },
                { id: idGen(), name: "Karan Singh", blood: "B-", phone: "9988776655", center: "Community Health Hub", verified: true },
                { id: idGen(), name: "Deepika", blood: "AB+", phone: "9090909090", center: "City Blood Centre — Downtown", verified: false },
                { id: idGen(), name: "Mohit Kumar", blood: "O-", phone: "8877665544", center: "Greenfield Medical", verified: true }
            ];

            // compatibility map (who can receive from which donors) - donors' blood in array -> receivable by key
            // We'll look up donors whose blood is compatible with the requested group:
            const compatible = {
                "A+": ["A+", "A-", "O+", "O-"],
                "A-": ["A-", "O-"],
                "B+": ["B+", "B-", "O+", "O-"],
                "B-": ["B-", "O-"],
                "AB+": ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"],
                "AB-": ["A-", "B-", "AB-", "O-"],
                "O+": ["O+", "O-"],
                "O-": ["O-"]
            };

            // DOM refs
            const donorListEl = document.getElementById('donorList');
            const dashDonorsEl = document.getElementById('dashDonors');
            const matchListEl = document.getElementById('matchList');
            const dashReceiversEl = document.getElementById('dashReceivers');
            const dashNotifsEl = document.getElementById('dashNotifs');
            const notifierEl = document.getElementById('notifier');
            const statDonors = document.getElementById('statDonors');
            const statReceivers = document.getElementById('statReceivers');
            const mostRequested = document.getElementById('mostRequested');

            // In-memory live lists (init from localStorage)
            let donors = loadJSON(DK);
            let receivers = loadJSON(RK);
            if (!donors || donors.length === 0) { donors = defaultDonors.slice(); saveJSON(DK, donors); }
            if (!receivers) receivers = [];

            // IDs & helpers
            function idGen() { return 'id_' + Math.random().toString(36).slice(2, 9) }

            // --- Renderers ---
            function renderDonors() {
                donorListEl.innerHTML = ''; dashDonorsEl.innerHTML = '';
                donors.forEach(d => {
                    const c = createDonorCard(d);
                    donorListEl.appendChild(c.cloneNode(true));
                    dashDonorsEl.appendChild(createDonorCard(d, true));
                });
                statDonors.textContent = donors.length;
                updateMostRequested();
            }

            function createDonorCard(d, withActions = false) {
                const wrap = document.createElement('div'); wrap.className = 'card reveal';
                wrap.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:start;gap:.6rem">
          <div style="display:flex;gap:.8rem;align-items:center">
            <div class="avatar">${(d.name || 'U')[0]}</div>
            <div>
              <strong>${d.name}</strong>
              <div class="muted small">${d.center}</div>
            </div>
          </div>
          <div style="text-align:right">
            <div style="font-weight:800;color:var(--maroon)">${d.blood}</div>
            <div class="muted small">${d.verified ? 'Verified' : 'Unverified'}</div>
          </div>
        </div>
        <div style="margin-top:.6rem;display:flex;gap:.6rem;align-items:center;justify-content:space-between">
          <div class="muted small">Phone: ${d.phone}</div>
          <div style="display:flex;gap:.45rem">
            <button class="chat-btn contactBtn" data-id="${d.id}">Contact</button>
            ${withActions ? `<button class="btn btn-ghost small delDonor" data-id="${d.id}">Delete</button>` : ''}
          </div>
        </div>
      `;
                return wrap;
            }

            function renderReceivers() {
                dashReceiversEl.innerHTML = '';
                receivers.forEach(r => {
                    const el = document.createElement('div'); el.className = 'card reveal';
                    el.innerHTML = `<strong>${r.name}</strong><div class="muted small">Blood: ${r.blood} • Urgency: ${r.urgency}</div><div style="margin-top:.6rem" class="muted small">Hospital: ${r.hospital}</div><div style="margin-top:.6rem;display:flex;gap:.6rem"><button class="btn btn-primary viewReq" data-id="${r.id}">View</button> <button class="btn btn-ghost small delReq" data-id="${r.id}">Delete</button></div>`;
                    dashReceiversEl.appendChild(el);
                });
                statReceivers.textContent = receivers.length;
            }

            // notifications render
            function addNotification(title, text) {
                const n = document.createElement('div'); n.className = 'note';
                n.innerHTML = `<strong style="color:var(--maroon)">${title}</strong><div class="muted small">${text}</div>`;
                notifierEl.prepend(n);
                // auto-remove older
                setTimeout(() => { n.style.opacity = '0'; n.style.transition = 'opacity .6s'; setTimeout(() => n.remove(), 700) }, 8000);
                // dash log
                const log = document.createElement('div'); log.className = 'muted small'; log.style.padding = '.45rem .6rem'; log.style.borderBottom = '1px dashed rgba(0,0,0,0.04)'; log.textContent = `${new Date().toLocaleString()} — ${title}: ${text}`; dashNotifsEl.prepend(log);
                // keep only limit
                while (notifierEl.children.length > NOTIF_LIMIT) notifierEl.removeChild(notifierEl.lastChild);
            }

            // update most requested blood group
            function updateMostRequested() {
                const counts = {};
                receivers.forEach(r => counts[r.blood] = (counts[r.blood] || 0) + 1);
                // donors influence too? we'll use receivers
                const sorted = Object.keys(counts).sort((a, b) => (counts[b] || 0) - (counts[a] || 0));
                mostRequested.textContent = sorted[0] || 'A+';
            }

            // find matches for a requested blood group
            function findMatchesFor(group) {
                if (!group) return [];
                const allowed = compatible[group] || [];
                return donors.filter(d => allowed.includes(d.blood));
            }

            // === Forms & interactions ===
            // Donation form - adds donor to localStorage and re-renders
            const donationForm = document.getElementById('donationForm');
            const formMsg = document.getElementById('formMsg');
            donationForm.addEventListener('submit', function (e) {
                e.preventDefault();
                const f = new FormData(donationForm);
                if (!f.get('fname') || !f.get('email') || !f.get('phone') || !f.get('blood') || !f.get('center')) {
                    formMsg.textContent = 'Please fill all required fields.'; formMsg.style.color = 'crimson'; return;
                }
                const d = { id: idGen(), name: f.get('fname'), email: f.get('email'), phone: f.get('phone'), blood: f.get('blood'), center: f.get('center'), verified: false };
                donors.unshift(d); saveJSON(DK, donors); renderDonors();
                formMsg.style.color = 'green'; formMsg.textContent = 'Registration received! Added to donors.';
                setTimeout(() => formMsg.textContent = '', 1500);
                donationForm.reset();
            });

            document.getElementById('clearForm').addEventListener('click', () => { donationForm.reset(); formMsg.textContent = ''; });

            // Contact form (support)
            const contactForm = document.getElementById('contactForm');
            const contactMsg = document.getElementById('contactMsg');
            contactForm.addEventListener('submit', function (e) {
                e.preventDefault();
                const cname = document.getElementById('cname').value.trim();
                const cemail = document.getElementById('cemail').value.trim();
                const cmsg = document.getElementById('cmsg').value.trim();
                if (!cname || !cemail || !cmsg) { contactMsg.style.color = 'crimson'; contactMsg.textContent = 'Please complete all fields.'; return; }
                contactMsg.style.color = 'var(--muted)'; contactMsg.textContent = 'Sending...';
                setTimeout(() => { contactMsg.style.color = 'green'; contactMsg.textContent = 'Thanks — we will reply soon.'; contactForm.reset(); }, 900);
            });

            // Receiver form handling: add receiver, show matches
            const receiverForm = document.getElementById('receiverForm');
            const receiverMsg = document.getElementById('receiverMsg');
            receiverForm.addEventListener('submit', function (e) {
                e.preventDefault();
                const f = new FormData(receiverForm);
                if (!f.get('rname') || !f.get('rphone') || !f.get('rblood') || !f.get('urgency') || !f.get('hospital')) {
                    receiverMsg.style.color = 'crimson'; receiverMsg.textContent = 'Please fill required fields.'; return;
                }
                const r = { id: idGen(), name: f.get('rname'), phone: f.get('rphone'), blood: f.get('rblood'), urgency: f.get('urgency'), hospital: f.get('hospital'), condition: f.get('condition') || '', created: Date.now() };
                receivers.unshift(r); saveJSON(RK, receivers); renderReceivers(); updateMostRequested();
                receiverMsg.style.color = 'green'; receiverMsg.textContent = 'Request logged — matching donors below.';
                setTimeout(() => receiverMsg.textContent = '', 2000);
                receiverForm.reset();
                // show matches
                showMatchesForRequest(r);
                // create notification
                addNotification('New request', `${r.name} needs ${r.blood} (${r.urgency})`);
            });

            document.getElementById('clearReceiver').addEventListener('click', () => { receiverForm.reset(); receiverMsg.textContent = ''; });

            function showMatchesForRequest(r) {
                const matches = findMatchesFor(r.blood);
                renderMatchList(matches);
                // if critical, suggest to send emergency or highlight
                if (r.urgency === 'critical') addNotification('Critical request', `Immediate help needed for ${r.blood} at ${r.hospital}`);
            }

            function renderMatchList(list) {
                matchListEl.innerHTML = '';
                if (!list.length) { matchListEl.innerHTML = '<div class="muted small">No matching donors available right now.</div>'; return; }
                list.forEach(d => {
                    const el = document.createElement('div'); el.className = 'card reveal';
                    el.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center">
          <div style="display:flex;gap:.8rem;align-items:center">
            <div class="avatar">${d.name[0]}</div>
            <div><strong>${d.name}</strong><div class="muted small">${d.center}</div></div>
          </div>
          <div style="text-align:right"><div style="font-weight:800;color:var(--maroon)">${d.blood}</div><div class="muted small">${d.verified ? 'Verified' : ''}</div></div>
        </div>
        <div style="margin-top:.6rem;display:flex;gap:.6rem;align-items:center;justify-content:space-between">
          <div class="muted small">Phone: ${d.phone}</div>
          <div style="display:flex;gap:.45rem">
            <button class="chat-btn contactBtn" data-id="${d.id}">Contact</button>
            <button class="btn btn-ghost small copyPhone" data-phone="${d.phone}">Copy</button>
          </div>
        </div>`;
                    matchListEl.appendChild(el);
                });
            }

            // Emergency send: notify matched donors (simulated)
            document.getElementById('sendEmergency').addEventListener('click', () => {
                // take latest receiver from list (or prompt)
                if (receivers.length === 0) { addNotification('Emergency failed', 'No active requests to send.'); return; }
                const r = receivers[0]; // most recent
                const matches = findMatchesFor(r.blood);
                if (matches.length === 0) { addNotification('Emergency', `No donors to notify for ${r.blood}`); return; }
                // create notifications for each donor & open SMS UI for first match (simulate contacting)
                matches.forEach((d, idx) => {
                    addNotification('Emergency Alert', `Notified ${d.name} (${d.blood}) about ${r.name} at ${r.hospital}`);
                    // simulate SMS entry for first match open
                    if (idx === 0) openChatWith(d, `Emergency: ${r.name} needs ${r.blood} at ${r.hospital}. Urgency: ${r.urgency}`);
                });
            });

            // --- SMS-like UI (chat) ---
            const smsModal = document.getElementById('smsModal');
            const smsBody = document.getElementById('smsBody');
            const smsTitle = document.getElementById('smsTitle');
            const smsInput = document.getElementById('smsInput');
            const smsSend = document.getElementById('smsSend');
            const smsClose = document.getElementById('smsClose');

            // simple in-memory chat store (for session only)
            const chats = {};

            function openChatWith(donor, initialMsg) {
                smsModal.style.display = 'flex';
                smsTitle.textContent = `Chat — ${donor.name}`;
                smsBody.innerHTML = '';
                smsBody.scrollTop = smsBody.scrollHeight;
                currentChatId = donor.id;
                if (!chats[donor.id]) chats[donor.id] = [];
                if (initialMsg) {
                    chats[donor.id].push({ who: 'them', text: initialMsg, time: Date.now() });
                }
                renderChat(donor.id);
            }

            function renderChat(id) {
                smsBody.innerHTML = '';
                const arr = chats[id] || [];
                arr.forEach(m => {
                    const p = document.createElement('div');
                    p.className = 'sms-msg ' + (m.who === 'me' ? 'me' : 'them');
                    p.textContent = m.text;
                    smsBody.appendChild(p);
                });
                smsBody.scrollTop = smsBody.scrollHeight;
            }

            let currentChatId = null;
            smsSend.addEventListener('click', () => {
                const txt = smsInput.value.trim();
                if (!txt || !currentChatId) return;
                chats[currentChatId] = chats[currentChatId] || [];
                chats[currentChatId].push({ who: 'me', text: txt, time: Date.now() });
                renderChat(currentChatId);
                smsInput.value = '';
                // simulate reply after 1s
                setTimeout(() => { chats[currentChatId].push({ who: 'them', text: 'Received. I can help. Call me: ' + donorById(currentChatId).phone, time: Date.now() }); renderChat(currentChatId); }, 900);
            });
            smsClose.addEventListener('click', () => { smsModal.style.display = 'none'; currentChatId = null; });

            // contact button delegation (donor contact)
            document.body.addEventListener('click', (e) => {
                if (e.target.classList.contains('contactBtn')) {
                    const id = e.target.dataset.id;
                    const d = donorById(id);
                    if (!d) return;
                    openChatWith(d, `Hi ${d.name}, someone is requesting ${d.blood}. Can you help?`);
                }
                if (e.target.classList.contains('copyPhone')) {
                    const p = e.target.dataset.phone;
                    navigator.clipboard?.writeText(p).then(() => addNotification('Copied', `Phone ${p} copied to clipboard`)).catch(() => { });
                }
                if (e.target.classList.contains('delDonor')) {
                    const id = e.target.dataset.id; deleteDonor(id);
                }
                if (e.target.classList.contains('delReq')) {
                    const id = e.target.dataset.id; deleteReceiver(id);
                }
                if (e.target.classList.contains('viewReq')) {
                    const id = e.target.dataset.id; const r = receiverById(id);
                    if (r) { alert(`Request by ${r.name}\nBlood: ${r.blood}\nUrgency: ${r.urgency}\nHospital: ${r.hospital}\nCondition: ${r.condition}`) }
                }
            });

            function donorById(id) { return donors.find(d => d.id === id) }
            function receiverById(id) { return receivers.find(r => r.id === id) }

            // delete helpers
            function deleteDonor(id) {
                if (!confirm('Delete donor permanently?')) return;
                donors = donors.filter(d => d.id !== id); saveJSON(DK, donors); renderDonors();
                addNotification('Donor removed', 'A donor entry was deleted from storage.');
            }
            function deleteReceiver(id) {
                if (!confirm('Delete request permanently?')) return;
                receivers = receivers.filter(r => r.id !== id); saveJSON(RK, receivers); renderReceivers();
                addNotification('Request removed', 'A receiver request was deleted.');
            }

            // dashboard tabs
            document.querySelectorAll('.tab').forEach(t => {
                t.addEventListener('click', () => {
                    document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
                    t.classList.add('active');
                    const to = t.dataset.tab;
                    document.querySelectorAll('.tabContent').forEach(c => c.style.display = 'none');
                    document.getElementById(to).style.display = 'block';
                });
            });

            // Export / clear buttons
            document.getElementById('exportDonors').addEventListener('click', () => {
                const blob = new Blob([JSON.stringify(donors, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a'); a.href = url; a.download = 'lifedrop_donors.json'; a.click(); URL.revokeObjectURL(url);
            });
            document.getElementById('exportReceivers').addEventListener('click', () => {
                const blob = new Blob([JSON.stringify(receivers, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a'); a.href = url; a.download = 'lifedrop_receivers.json'; a.click(); URL.revokeObjectURL(url);
            });
            document.getElementById('clearDonors').addEventListener('click', () => { if (confirm('Clear all donors?')) { donors = []; saveJSON(DK, donors); renderDonors(); addNotification('Donors cleared', 'All donor entries removed.'); } });
            document.getElementById('clearReceivers').addEventListener('click', () => { if (confirm('Clear all receivers?')) { receivers = []; saveJSON(RK, receivers); renderReceivers(); addNotification('Receivers cleared', 'All receiver requests removed.'); } });
            document.getElementById('simNotif').addEventListener('click', () => addNotification('Simulated', 'This is a simulated real-time notification'));

            // simulate real-time notifications (for demo) every 18-30s
            setInterval(() => {
                const sample = ['New donor added nearby', 'Volunteer signed up', 'Reminder: blood drive tomorrow', 'Low stock: O+'];
                const msg = sample[Math.floor(Math.random() * sample.length)];
                addNotification('Live update', msg);
            }, 23000);

            // --- Admin panel simple auth & UI toggle ---
            const adminToggle = document.getElementById('adminToggle');
            let adminUnlocked = false;
            adminToggle.addEventListener('click', () => {
                if (!adminUnlocked) {
                    const pass = prompt('Enter admin key (demo):');
                    if (pass === 'lifedrop-admin') { adminUnlocked = true; adminToggle.textContent = 'Admin (open)'; alert('Admin unlocked. Dashboard -> open "Dashboard" in nav.'); }
                    else { alert('Wrong key. Demo admin key is: lifedrop-admin'); return; }
                } else {
                    // show admin panel (scroll to dashboard)
                    location.hash = '#dashboard';
                }
            });

            // --- Drawer, smooth scroll, testimonials (kept original code) ---
            const hambtn = document.getElementById('hambtn');
            const drawer = document.getElementById('drawer');
            const closeDrawer = document.getElementById('closeDrawer');
            const overlay = document.getElementById('overlay');
            function openDrawer() { drawer.classList.add('open'); overlay.classList.add('show'); drawer.setAttribute('aria-hidden', 'false'); closeDrawer.focus(); }
            function closeIt() { drawer.classList.remove('open'); overlay.classList.remove('show'); drawer.setAttribute('aria-hidden', 'true'); hambtn.focus(); }
            hambtn.addEventListener('click', openDrawer); closeDrawer.addEventListener('click', closeIt); overlay.addEventListener('click', closeIt);
            document.addEventListener('keydown', e => { if (e.key === 'Escape') closeIt(); });
            document.querySelectorAll('.drawer .nav-link').forEach(a => a.addEventListener('click', closeIt));
            document.querySelectorAll('a[href^="#"]').forEach(a => a.addEventListener('click', function (e) { const tgt = document.querySelector(this.getAttribute('href')); if (tgt) { e.preventDefault(); tgt.scrollIntoView({ behavior: 'smooth', block: 'start' }); closeIt(); } }));

            // Testimonials carousel (kept)
            const inner = document.getElementById('testimonialInner'); const prev = document.getElementById('prev'); const next = document.getElementById('next'); let idx = 0;
            function updateTestimonial() { if (!inner || !inner.children[0]) return; const cw = inner.children[0].getBoundingClientRect().width + 16; inner.style.transform = 'translateX(' + (-idx * cw) + 'px)'; }
            if (prev && next) { next.addEventListener('click', () => { idx = Math.min(idx + 1, inner.children.length - 1); updateTestimonial(); }); prev.addEventListener('click', () => { idx = Math.max(idx - 1, 0); updateTestimonial(); }); window.addEventListener('resize', updateTestimonial); }

            // set year
            document.getElementById('year').textContent = new Date().getFullYear();

            // reveal animation trigger
            document.querySelectorAll('.reveal').forEach(el => { el.style.animationPlayState = 'running'; });

            // how it works scroll
            document.getElementById('learnBtn').addEventListener('click', () => document.querySelector('#donate').scrollIntoView({ behavior: 'smooth' }));

            // chat buttons (delegation already handled), render initial UI
            function init() {
                renderDonors(); renderReceivers();
                // show the most recent receiver's matches by default
                if (receivers.length) showMatchesForRequest(receivers[0]);
            }
            init();

            // small helper: keep storage updated on unload
            window.addEventListener('beforeunload', () => { saveJSON(DK, donors); saveJSON(RK, receivers); });

            // helper: clicking contact in donors list opens chat (delegated)
            // done via earlier delegation

        })();