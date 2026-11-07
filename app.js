import { initializeApp } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js";
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, updateProfile, sendPasswordResetEmail }
  from "https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, addDoc, deleteDoc, getDocs, writeBatch, onSnapshot, collection, query, orderBy, limit, serverTimestamp, arrayUnion }
  from "https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "__FIREBASE_API_KEY__",
  authDomain: "login-user-14d8d.firebaseapp.com",
  projectId: "login-user-14d8d",
  storageBucket: "login-user-14d8d.firebasestorage.app",
  messagingSenderId: "107815183859",
  appId: "1:107815183859:web:d3a5d36c9c54a9d86fde86"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/* ---------- helpers ---------- */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const initials = n => (n || "?").trim().split(/\s+/).slice(0,2).map(w => w[0]).join("").toUpperCase();

async function compressImage(file,{maxDimension=1600,quality=.82}={}){
  if(!file?.type?.startsWith("image/")) return file;
  const bitmap=await createImageBitmap(file);
  const scale=Math.min(1,maxDimension/Math.max(bitmap.width,bitmap.height));
  const width=Math.max(1,Math.round(bitmap.width*scale)),height=Math.max(1,Math.round(bitmap.height*scale));
  const canvas=document.createElement("canvas");canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext("2d",{alpha:false});ctx.drawImage(bitmap,0,0,width,height);bitmap.close?.();
  const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error("Image compression failed.")),"image/jpeg",quality));
  return new File([blob],(file.name.replace(/\.[^.]+$/,"")||"image")+".jpg",{type:"image/jpeg",lastModified:Date.now()});
}
const SUBJECTS = ["C Programming","English","Mathematics","Management","Linux","DE","Other"];
function toast(m){ const r=$("#toastRoot"); r.innerHTML=`<div class="toast">${esc(m)}</div>`; clearTimeout(toast.t); toast.t=setTimeout(()=>r.innerHTML="",2800); }
function ago(ts){
  const d = ts?.toDate ? ts.toDate() : null; if(!d) return "just now";
  const s = (Date.now()-d.getTime())/1000;
  if(s<60) return "just now"; if(s<3600) return Math.floor(s/60)+" min ago";
  if(s<86400) return Math.floor(s/3600)+" h ago"; if(s<172800) return "yesterday";
  return Math.floor(s/86400)+" days ago";
}
function clock(ts){ const d=ts?.toDate?ts.toDate():new Date(); return d.toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}); }
function friendly(e){
  const c = e?.code || "";
  if(c.includes("email-already-in-use")) return "An account already exists with this email. Please log in.";
  if(c.includes("invalid-credential")||c.includes("wrong-password")||c.includes("user-not-found")) return "Incorrect email or password.";
  if(c.includes("weak-password")) return "Password must contain at least 6 characters.";
  if(c.includes("invalid-email")) return "Please enter a valid email address.";
  if(c.includes("too-many-requests")) return "Too many attempts. Please try again later.";
  if(c.includes("operation-not-allowed")) return "Email/Password sign-in is not enabled in the Firebase console.";
  if(c.includes("permission-denied")) return "Permission denied. Check whether the Firestore rules have been published.";
  return e?.message || "Something went wrong.";
}
function show(id){
  ["vLoading","vAuth","vPending","vApp"].forEach(v => $("#"+v).classList.toggle("hidden", v!==id));
}
function modal(title, sub, body){
  $("#modalRoot").innerHTML = `<div class="backdrop" id="bd"><div class="modal" role="dialog" aria-modal="true"><h2>${title}</h2><p class="sub">${sub}</p>${body}</div></div>`;
  $("#bd").addEventListener("click", e => { if(e.target.id==="bd") closeModal(); });
}
const closeModal = () => $("#modalRoot").innerHTML = "";
function avatarHTML(name, url, extraClass="avatar"){
  return url ? `<div class="${extraClass}"><img src="${esc(url)}" alt="${esc(name || "Member")}'s profile photo" loading="lazy"></div>`
    : `<div class="${extraClass}" aria-label="${esc(name || "Member")}">${esc(initials(name))}</div>`;
}
function updateProfileButton(){
  const btn=$("#profileBtn");
  if(!btn) return;
  const url=profile?.avatarURL;
  btn.innerHTML=url
    ? `<img src="${esc(url)}" alt="Your profile photo">`
    : `<span class="profile-initials" aria-hidden="true">${esc(initials(profile?.name || user?.displayName || user?.email))}</span>`;
  btn.setAttribute("aria-label",url?"Change profile photo":"Add profile photo");
}
function openProfileEditor(){
  if(!user || !isApproved()) return;
  const current = profile?.avatarURL || "";
  modal("Profile photo","Choose a clear photo for your Classmate account. JPG, PNG or WEBP · Up to 10 MB.",
    `<div id="avatarPreviewWrap">${current ? `<img class="profile-preview" src="${esc(current)}" alt="Current profile photo">` : `<div class="avatar profile-preview" style="display:grid;place-items:center;font-size:25px">${esc(initials(profile?.name))}</div>`}</div>
    <form id="avatarForm">
      <div class="avatar-upload">
        <label class="avatar-file-label" for="avatarFile"><span class="avatar-file-icon">＋</span><span><strong>Choose a photo</strong><small>Browse JPG, PNG or WEBP (max 10 MB)</small></span><span class="avatar-browse">Browse</span></label>
        <input class="avatar-file-input" id="avatarFile" type="file" accept="image/jpeg,image/png,image/webp" required>
        <div class="avatar-file-name" id="avatarFileName">No photo selected</div>
      </div>
      <div id="avatarStatus" role="status" aria-live="polite"></div>
      <div class="avatar-actions">
        <button class="btn ghost" type="button" id="avatarCancel">Cancel</button>
        <button class="btn danger" type="button" id="avatarRemove" ${current ? "" : "disabled"}>Remove photo</button>
        <button class="btn" type="submit" id="avatarSave">Save photo</button>
      </div>
    </form>`);
  $("#avatarCancel").onclick=closeModal;
  $("#avatarRemove").onclick=async()=>{
    if(!current) return;
    const btn=$("#avatarRemove");btn.disabled=true;$("#avatarSave").disabled=true;$("#avatarCancel").disabled=true;
    $("#avatarStatus").textContent="Removing photo…";
    try{
      await updateDoc(doc(db,"users",user.uid),{avatarURL:""});
      closeModal();toast("Profile photo removed.");
    }catch(err){$("#avatarStatus").textContent="Could not remove photo: "+friendly(err);btn.disabled=false;$("#avatarSave").disabled=false;$("#avatarCancel").disabled=false;}
  };
  $("#avatarFile").onchange=()=>{
    const f=$("#avatarFile").files[0]; if(!f) return;
    if(!["image/jpeg","image/png","image/webp"].includes(f.type) || f.size>10*1024*1024){toast("Choose JPG, PNG or WEBP up to 10 MB.");$("#avatarFile").value="";$("#avatarFileName").textContent="No photo selected";return;}
    $("#avatarFileName").textContent=f.name;
    const reader=new FileReader(); reader.onload=()=>{$("#avatarPreviewWrap").innerHTML=`<img class="profile-preview" src="${reader.result}" alt="Photo preview">`;}; reader.readAsDataURL(f);
  };
  $("#avatarForm").onsubmit=async e=>{
    e.preventDefault(); const file=$("#avatarFile").files[0]; if(!file) return;
    if(!["image/jpeg","image/png","image/webp"].includes(file.type)||file.size>10*1024*1024){toast("Choose JPG, PNG or WEBP up to 10 MB.");return;}
    const btn=$("#avatarSave");btn.disabled=true;$("#avatarCancel").disabled=true;$("#avatarStatus").textContent="Uploading photo…";
    try{
      $("#avatarStatus").textContent="Compressing photo…";
      const optimized=await compressImage(file,{maxDimension:512,quality:.8});
      const data=new FormData();data.append("file",optimized);data.append("upload_preset","classmate_notes");
      $("#avatarStatus").textContent="Uploading optimized photo…";
      const response=await fetch("https://api.cloudinary.com/v1_1/ag2bwflq/image/upload",{method:"POST",body:data});
      const result=await response.json();if(!response.ok)throw new Error(result.error?.message||"Photo upload failed.");
      await updateDoc(doc(db,"users",user.uid),{avatarURL:result.secure_url});
      closeModal();toast("Profile photo updated.");
    }catch(err){$("#avatarStatus").textContent="Could not save photo: "+friendly(err);btn.disabled=false;$("#avatarCancel").disabled=false;}
  };
}
$("#profileBtn").onclick=openProfileEditor;

/* ---------- state ---------- */
let user = null, profile = null, unsubs = [];
let notes = [], reqs = [], members = [];
let filter = "All", tab = "notes";
let chatInitialSnapshot = false;
const isApproved = () => profile?.status === "approved";
const isAdmin = () => isApproved() && profile?.role === "admin";
const stopAll = () => { unsubs.forEach(u => u()); unsubs = []; };

/* ---------- auth UI ---------- */
function setMode(join){
  $("#segLogin").classList.toggle("on", !join); $("#segJoin").classList.toggle("on", join);
  $("#loginForm").classList.toggle("hidden", join); $("#joinForm").classList.toggle("hidden", !join);
  $("#authMsg").innerHTML = "";
}
const authMsg = (t, ok) => $("#authMsg").innerHTML = `<div class="msg ${ok?"ok":"err"}">${esc(t)}</div>`;
$("#segLogin").onclick = () => setMode(false);
$("#segJoin").onclick = () => setMode(true);

$("#loginForm").onsubmit = async e => {
  e.preventDefault(); const b = e.target.querySelector("button[type=submit]"); b.disabled = true;
  try { await signInWithEmailAndPassword(auth, $("#le").value.trim(), $("#lp").value); }
  catch(err){ authMsg(friendly(err)); } finally { b.disabled = false; }
};
$("#joinForm").onsubmit = async e => {
  e.preventDefault(); const b = e.target.querySelector("button[type=submit]"); b.disabled = true;
  const name = $("#jn").value.trim(), email = $("#je").value.trim();
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, $("#jp").value);
    await updateProfile(cred.user, { displayName: name });
    await setDoc(doc(db, "users", cred.user.uid), {
      name, email, semester: $("#js").value, batch: $("#jb").value.trim(),
      status: "pending", role: "member", createdAt: serverTimestamp()
    });
  } catch(err){ authMsg(friendly(err)); } finally { b.disabled = false; }
};
$("#forgotBtn").onclick = async () => {
  const email = $("#le").value.trim();
  if(!email){ authMsg("Enter your email above and click again."); return; }
  try { await sendPasswordResetEmail(auth, email); authMsg("The password reset link has been sent to your email.", true); }
  catch(err){ authMsg(friendly(err)); }
};
const logout = () => signOut(auth);
$("#logoutBtn").onclick = logout; $("#pendLogout").onclick = logout;

/* ---------- session flow ---------- */
show("vLoading");
let authStateResolved = false;
// Show the safe login screen after 1 second if Firebase is still restoring the session.
// Private app content remains locked until authentication and approval are verified.
const loadingFallback = setTimeout(() => {
  if (!authStateResolved) show("vAuth");
}, 1000);
onAuthStateChanged(auth, async u => {
  authStateResolved = true;
  clearTimeout(loadingFallback);
  stopAll(); user = u; profile = null; notes = []; reqs = []; members = []; chatInitialSnapshot = false;

  appStarted = false;
  $("#whoBox").classList.toggle("hidden", !u);
  if(!u){ show("vAuth"); return; }
  $("#whoName").textContent = u.displayName || u.email;

  // Subscribe to the profile immediately. Existing users no longer wait for
  // a separate getDoc request before the app can start rendering.
  let adminSetupChecked = false;
  let profileResolved = false;
  // If the profile lookup is slow, replace the endless spinner with a clear
  // connection message. Do not open private content until approval is confirmed.
  const profileLoadingFallback = setTimeout(() => {
    if (profileResolved) return;
    $("#pendIcon").textContent = "…";
    $("#pendTitle").textContent = "Connecting to Classmate";
    $("#pendText").textContent = "Your login is detected. We are checking your account approval. Please wait a moment.";
    show("vPending");
  }, 1000);
  unsubs.push(onSnapshot(doc(db, "users", u.uid), async snap => {
    profileResolved = true;
    clearTimeout(profileLoadingFallback);
    profile = snap.exists() ? snap.data() : null;
    updateProfileButton();
    $("#profileBtn").classList.toggle("hidden", !isApproved());
    route();

    // Only check the admin marker when the user profile is actually missing.
    // This keeps the secure first-login admin setup without delaying normal logins.
    if (!snap.exists() && !adminSetupChecked) {
      adminSetupChecked = true;
      try {
        const adminMarker = await getDoc(doc(db, "admins", u.uid));
        if (adminMarker.exists()) {
          await setDoc(doc(db, "users", u.uid), {
            name: u.displayName || (u.email || "Admin").split("@")[0],
            email: u.email || "",
            semester: "Admin",
            batch: "Admin",
            status: "approved",
            role: "admin",
            createdAt: serverTimestamp()
          });
        }
      } catch (err) {
        toast("Account setup: " + friendly(err));
      }
    }
  }, err => toast(friendly(err))));
});

let appStarted = false;
function route(){
  if(!user) return;
  if(!isApproved()){
    appStarted = false;
    const declined = profile?.status === "declined";
    $("#pendIcon").textContent = declined ? "✕" : "⏳";
    $("#pendTitle").textContent = declined ? "Request declined" : "Waiting for approval";
    $("#pendText").textContent = declined
      ? "The admin has not approved this request. Please contact your class admin."
      : "Your request has been sent to the admin. This page will open automatically after approval.";
    show("vPending"); return;
  }
  show("vApp");
  $("#adminTab").classList.toggle("hidden", !isAdmin());
  if(!isAdmin() && tab === "admin") setTab("notes");
  if(!appStarted){ appStarted = true; startData(); }
}

function startData(){
  unsubs.push(onSnapshot(query(collection(db,"notes"), orderBy("createdAt","desc"), limit(200)), s => {
    notes = s.docs.map(d => ({id:d.id, ...d.data()})); renderNotes(); $("#nNotes").textContent = notes.length;
  }, e => toast(friendly(e))));
  unsubs.push(onSnapshot(query(collection(db,"requests"), orderBy("createdAt","desc"), limit(100)), s => {
    reqs = s.docs.map(d => ({id:d.id, ...d.data()})); renderReqs(); $("#nReqs").textContent = reqs.length;
  }, e => toast(friendly(e))));
  unsubs.push(onSnapshot(query(collection(db,"messages"), orderBy("createdAt","desc"), limit(60)), s => {
    if (chatInitialSnapshot) {
      const hasNewFromOthers = s.docChanges().some(change =>
        change.type === "added" && change.doc.data().uid !== user.uid
      );
      // The green chat indicator stays visible at all times.
    } else {
      chatInitialSnapshot = true;
    }
    renderChat(s.docs.map(d => ({id:d.id, ...d.data()})).reverse());
  }, e => toast(friendly(e))));
  // Every approved member reads only the public aggregate count, not other users' profiles.
  unsubs.push(onSnapshot(doc(db,"stats","members"), snap => {
    $("#nMembers").textContent = snap.exists() ? (snap.data().count ?? 0) : "0";
  }, e => toast(friendly(e))));
  if(isAdmin()){
    unsubs.push(onSnapshot(query(collection(db,"users"), orderBy("createdAt","desc")), async snap => {
      members = snap.docs.map(d => ({id:d.id, ...d.data()}));
      renderAdmin();
      const count = members.filter(m => m.status === "approved").length;
      try {
        await setDoc(doc(db,"stats","members"), {count, updatedAt:serverTimestamp()});
      } catch(err) { toast("Could not update member count: " + friendly(err)); }
    }, e => toast(friendly(e))));
  }
}

/* ---------- tabs ---------- */
function setTab(t){
  tab = t;
  document.querySelectorAll(".tab").forEach(b => b.classList.toggle("on", b.dataset.tab === t));
  [["notes","pNotes"],["requests","pRequests"],["chat","pChat"],["admin","pAdmin"]].forEach(([k,id]) => $("#"+id).classList.toggle("hidden", k !== t));
  if(t === "chat"){ const l = $("#chatLog"); l.scrollTop = l.scrollHeight; }
}
$("#tabs").onclick = e => { const b = e.target.closest(".tab"); if(b) setTab(b.dataset.tab); };

/* ---------- notes ---------- */
function renderChips(){
  $("#chips").innerHTML = ["All", ...SUBJECTS].map(s => `<button class="chip ${s===filter?"on":""}" data-f="${esc(s)}">${esc(s==="All"?"All notes":s)}</button>`).join("");
}
$("#chips").onclick = e => { const b = e.target.closest("[data-f]"); if(!b) return; filter = b.dataset.f; renderNotes(); };
$("#q").oninput = () => renderNotes();
function renderNotes(){
  renderChips();
  const q = $("#q").value.toLowerCase();
  const found = notes.filter(n => (filter==="All" || n.subject===filter) && `${n.title} ${n.subject} ${n.byName}`.toLowerCase().includes(q));
  $("#noteList").innerHTML = found.length ? found.map(n => {
    const mine = n.uid === user.uid || isAdmin();
    const ext = (n.fileName || n.link || "").split("?")[0].split(".").pop().toLowerCase();
    const label = ["pdf","doc","docx","ppt","pptx","xls","xlsx","png","jpg","jpeg"].includes(ext) ? ext.toUpperCase().slice(0,4) : "FILE";
    return `<article class="item">${avatarHTML(n.byName,n.avatarURL)}
      <div class="grow"><strong>${esc(n.title)}</strong><p>${esc(n.byName)} · ${ago(n.createdAt)}</p><span class="tag">${esc(n.subject)}</span></div>
      <a class="btn soft sm" href="${esc(n.link)}" target="_blank" rel="noopener noreferrer">Open ↗</a>
      ${mine ? `<button class="btn danger sm" data-delnote="${n.id}" aria-label="Delete note">✕</button>` : ""}</article>`;
  }).join("") : `<div class="empty">No notes uploaded yet. Share the first file!</div>`;
}
$("#noteList").onclick = async e => {
  const d = e.target.closest("[data-delnote]"); if(!d) return;
  if(!confirm("Delete this note?")) return;
  const note = notes.find(n => n.id === d.dataset.delnote);
  try {
    await deleteDoc(doc(db,"notes",d.dataset.delnote));
    
    toast("Note deleted.");
  } catch(err){ toast(friendly(err)); }
};
$("#addNote").onclick = () => {
  modal("Upload class notes","Choose a file from your device. Maximum 15 MB.",
  `<form id="nf"><div class="field"><label for="nt">Title</label><input id="nt" required maxlength="120" placeholder="e.g. C Programming — Unit 2"></div>
   <div class="field"><label for="ns">Subject</label><select id="ns">${SUBJECTS.map(s=>`<option>${esc(s)}</option>`).join("")}</select></div>
   <div class="field"><label for="noteFile">Select PDF, Word, PPT or image</label><input id="noteFile" type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.png,.jpg,.jpeg" required></div>
   <div id="uploadStatus" role="status" aria-live="polite"></div>
   <div style="display:flex;gap:8px"><button class="btn ghost full" type="button" id="cx">Cancel</button><button class="btn full" type="submit" id="shareBtn">Upload</button></div></form>`);
  $("#cx").onclick = closeModal;
  $("#nf").onsubmit = async e => {
    e.preventDefault();
    const file = $("#noteFile").files[0];
    const allowed = ["pdf","doc","docx","ppt","pptx","png","jpg","jpeg"];
    const ext = (file?.name.split(".").pop() || "").toLowerCase();
    if(!file || !allowed.includes(ext)){ toast("Choose a PDF, Word, PPT or image file."); return; }
    if(file.size > 15 * 1024 * 1024){ toast("File must be 15 MB or smaller."); return; }
    const btn = $("#shareBtn");
    btn.disabled = true;
    $("#cx").disabled = true;
    $("#uploadStatus").textContent = "Uploading file…";
    let path = null;
    try {
      path = null;
      const optimizedFile = file.type.startsWith("image/") ? await compressImage(file,{maxDimension:1800,quality:.82}) : file;
      $("#uploadStatus").textContent = optimizedFile !== file ? "Uploading compressed image…" : "Uploading file…";
      const formData = new FormData();
      formData.append("file", optimizedFile);
      formData.append("upload_preset", "classmate_notes");
      const response = await fetch("https://api.cloudinary.com/v1_1/ag2bwflq/auto/upload", { method:"POST", body:formData });
      const uploaded = await response.json();
      if(!response.ok) throw new Error(uploaded.error?.message || "Cloudinary upload failed.");
      const link = uploaded.secure_url;
      $("#uploadStatus").textContent = "Saving note details…";
      await addDoc(collection(db,"notes"), {title:$("#nt").value.trim(),subject:$("#ns").value,link,storagePath:path,fileName:file.name,uid:user.uid,byName:profile.name,avatarURL:profile.avatarURL || "",createdAt:serverTimestamp()});
      closeModal(); toast("Note uploaded successfully!");
    } catch(err) {
      if(path) { try { await deleteObject(storageRef(storage,path)); } catch(_) {} }
      $("#uploadStatus").textContent = "Upload failed: " + friendly(err);
      toast(friendly(err));
      btn.disabled = false; $("#cx").disabled = false;
    }
  };
};

/* ---------- requests ---------- */
function renderReqs(){
  $("#reqList").innerHTML = reqs.length ? reqs.map(r => {
    const voters = r.voters || [], voted = voters.includes(user.uid);
    const mine = r.uid === user.uid || isAdmin(), files = r.attachments || [];
    return `<article class="request-card">
      <div class="request-head">${avatarHTML(r.byName,r.avatarURL)}
        <div class="grow"><strong>${esc(r.title)}</strong><p>${esc(r.subject)} · by ${esc(r.byName)} · ${ago(r.createdAt)}</p><span class="tag">♡ ${voters.length} need this</span></div>
        <span class="request-status ${files.length?"fulfilled":""}">${files.length?"Fulfilled":"Needed"}</span>
      </div>
      ${files.length ? `<div class="request-files">${files.map(f=>`<div class="request-file"><span class="request-file-icon">📄</span><div class="grow"><strong>${esc(f.fileName || "Shared notes")}</strong><small>Uploaded by ${esc(f.byName || "Classmate")}</small></div><a class="btn soft sm" href="${esc(f.url)}" target="_blank" rel="noopener noreferrer">Open file ↗</a></div>`).join("")}</div>` : `<p class="request-empty">No files uploaded yet. Help your classmates by sharing the notes.</p>`}
      <div class="request-actions"><button class="btn soft sm" type="button" data-uploadreq="${r.id}">＋ Upload notes</button><button class="btn ${voted?"ghost":"soft"} sm" data-vote="${r.id}" ${voted?"disabled":""}>${voted?"Voted":"I need this"}</button>${mine ? `<button class="btn danger sm" data-delreq="${r.id}" aria-label="Delete request">✕</button>` : ""}</div>
    </article>`;
  }).join("") : `<div class="empty">There are no open requests yet. Create the first one!</div>`;
}
$("#reqList").onclick = async e => {
  const v=e.target.closest("[data-vote]"),d=e.target.closest("[data-delreq]"),u=e.target.closest("[data-uploadreq]");
  try {
    if(v) await updateDoc(doc(db,"requests",v.dataset.vote),{voters:arrayUnion(user.uid)});
    if(d && confirm("Do you want to delete this request?")) await deleteDoc(doc(db,"requests",d.dataset.delreq));
    if(u) openRequestUpload(u.dataset.uploadreq);
  } catch(err){toast(friendly(err));}
};
function openRequestUpload(requestId){
  const request=reqs.find(x=>x.id===requestId);if(!request)return;
  modal("Upload requested notes",`Share a file for “${esc(request.title)}”. PDF, Word, PPT or image · Max 15 MB.`,
    `<form id="requestUploadForm"><div class="field"><label for="requestNoteFile">Choose notes file</label><input id="requestNoteFile" type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.png,.jpg,.jpeg" required></div><div id="requestUploadStatus" role="status" aria-live="polite"></div><div style="display:flex;gap:8px"><button class="btn ghost full" type="button" id="requestUploadCancel">Cancel</button><button class="btn full" type="submit" id="requestUploadSave">Upload notes</button></div></form>`);
  $("#requestUploadCancel").onclick=closeModal;
  $("#requestUploadForm").onsubmit=async e=>{
    e.preventDefault();
    const file=$("#requestNoteFile").files[0],allowed=["pdf","doc","docx","ppt","pptx","png","jpg","jpeg"];
    const ext=(file?.name.split(".").pop()||"").toLowerCase();
    if(!file||!allowed.includes(ext)){toast("Choose a PDF, Word, PPT or image file.");return;}
    if(file.size>15*1024*1024){toast("File must be 15 MB or smaller.");return;}
    const btn=$("#requestUploadSave");btn.disabled=true;$("#requestUploadCancel").disabled=true;$("#requestUploadStatus").textContent="Uploading file…";
    try{
      const optimizedFile=file.type.startsWith("image/")?await compressImage(file,{maxDimension:1800,quality:.82}):file;
      const data=new FormData();data.append("file",optimizedFile);data.append("upload_preset","classmate_notes");
      const response=await fetch("https://api.cloudinary.com/v1_1/ag2bwflq/auto/upload",{method:"POST",body:data});
      const uploaded=await response.json();if(!response.ok)throw new Error(uploaded.error?.message||"Cloudinary upload failed.");
      await updateDoc(doc(db,"requests",requestId),{attachments:arrayUnion({url:uploaded.secure_url,fileName:file.name,byName:profile.name,uid:user.uid,createdAt:new Date().toISOString()})});
      closeModal();toast("Notes added to the request.");
    }catch(err){$("#requestUploadStatus").textContent="Upload failed: "+friendly(err);btn.disabled=false;$("#requestUploadCancel").disabled=false;}
  };
}
$("#addReq").onclick = () => {
  modal("Request notes","Which notes do you need?",
  `<form id="rf"><div class="field"><label for="rt">What do you need?</label><input id="rt" required maxlength="120" placeholder="e.g. Linux shell scripting programs"></div>
   <div class="field"><label for="rs">Subject</label><select id="rs">${SUBJECTS.map(s=>`<option>${s}</option>`).join("")}</select></div>
   <div style="display:flex;gap:8px"><button class="btn ghost full" type="button" id="cx">Cancel</button><button class="btn full" type="submit">Post request</button></div></form>`);
  $("#cx").onclick = closeModal;
  $("#rf").onsubmit = async e => {
    e.preventDefault();
    try {
      await addDoc(collection(db,"requests"), { title:$("#rt").value.trim(), subject:$("#rs").value, uid:user.uid, byName:profile.name, avatarURL:profile.avatarURL || "", voters:[user.uid], createdAt:serverTimestamp() });
      closeModal(); toast("Request posted.");
    } catch(err){ toast(friendly(err)); }
  };
};

/* ---------- chat ---------- */
let chatReplyTarget = null;
function setChatReply(m){
  chatReplyTarget = m;
  const bar=$("#chatReplyPreview");
  if(!m){bar.classList.add("hidden");bar.innerHTML="";return;}
  bar.classList.remove("hidden");
  bar.innerHTML=`<div class="reply-preview-copy"><b>Replying to ${esc(m.byName || "Member")}</b><span>${esc(m.text)}</span></div><button type="button" class="reply-close" id="cancelChatReply" aria-label="Cancel reply">×</button>`;
  $("#cancelChatReply").onclick=()=>setChatReply(null);
  $("#chatInput").focus();
}
function renderChat(msgs){
  const log = $("#chatLog");
  const atBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 80;
  log.innerHTML = msgs.length ? msgs.map(m => {
    const me = m.uid === user.uid;
    const quoted = m.replyTo ? `<div class="bubble-quote"><b>${esc(m.replyTo.byName || "Member")}</b><span>${esc(m.replyTo.text || "")}</span></div>` : "";
    return `<div class="bubble-row ${me?"me":""}" data-message-id="${esc(m.id)}">
      ${avatarHTML(m.byName,m.avatarURL)}
      <div class="bubble-wrap"><div class="bubble">${me?"":`<b>${esc(m.byName)}</b>`}${quoted}${esc(m.text)}<time>${clock(m.createdAt)}</time></div><button class="chat-reply-btn" type="button" aria-label="Reply to ${esc(m.byName || "message")}">↩ Reply</button></div></div>`;
  }).join("") : `<div class="empty" style="margin:auto">Send the first message 👋</div>`;
  log.querySelectorAll(".bubble-row").forEach(row=>{
    const msg=msgs.find(x=>x.id===row.dataset.messageId);
    row.querySelector(".chat-reply-btn").onclick=()=>setChatReply(msg);
    let startX=0,startY=0;
    row.addEventListener("touchstart",e=>{startX=e.changedTouches[0].clientX;startY=e.changedTouches[0].clientY;},{passive:true});
    row.addEventListener("touchend",e=>{
      const dx=e.changedTouches[0].clientX-startX,dy=e.changedTouches[0].clientY-startY;
      if(dx>65 && Math.abs(dx)>Math.abs(dy)*1.3) setChatReply(msg);
    },{passive:true});
  });
  if(atBottom || tab !== "chat") log.scrollTop = log.scrollHeight;
}
$("#chatForm").onsubmit = async e => {
  e.preventDefault();
  const inp = $("#chatInput"), text = inp.value.trim(); if(!text) return;
  const replyTo=chatReplyTarget ? {id:chatReplyTarget.id,byName:chatReplyTarget.byName || "Member",text:chatReplyTarget.text} : null;
  inp.value = "";
  try {
    await addDoc(collection(db,"messages"), { text, uid:user.uid, byName:profile.name, avatarURL:profile.avatarURL || "", ...(replyTo ? {replyTo} : {}), createdAt:serverTimestamp() });
    setChatReply(null);
  } catch(err){ inp.value = text; toast(friendly(err)); }
};

/* ---------- admin chat cleanup ---------- */
$("#clearChatBtn").onclick = async () => {
  if (!isAdmin()) { toast("Only admins can clear the class chat."); return; }
  if (!confirm("Delete ALL class chat messages for everyone? This cannot be undone.")) return;
  const btn = $("#clearChatBtn");
  btn.disabled = true;
  btn.textContent = "Clearing…";
  try {
    const snap = await getDocs(collection(db,"messages"));
    const docs = snap.docs;
    for (let i = 0; i < docs.length; i += 450) {
      const batch = writeBatch(db);
      docs.slice(i, i + 450).forEach(item => batch.delete(item.ref));
      await batch.commit();
    }
    toast(`Chat cleared. ${docs.length} message(s) deleted.`);
  } catch(err) {
    toast("Could not clear chat: " + friendly(err));
  } finally {
    btn.disabled = false;
    btn.textContent = "Clear chat";
  }
};

/* ---------- admin ---------- */
function renderAdmin(){
  const pend = members.filter(m => m.status === "pending");
  const ok = members.filter(m => m.status === "approved");
  $("#nMembers").textContent = ok.length;
  $("#pendBadge").textContent = pend.length; $("#pendBadge").classList.toggle("hidden", !pend.length);
  $("#pendList").innerHTML = pend.length ? pend.map(m => `<div class="item">${avatarHTML(m.name,m.avatarURL)}
    <div class="grow"><strong>${esc(m.name)}</strong><p>${esc(m.email)} · ${esc(m.semester)} · ${esc(m.batch)}</p></div>
    <button class="btn sm" data-approve="${m.id}">Approve</button><button class="btn danger sm" data-decline="${m.id}">Decline</button></div>`).join("")
    : `<div class="empty">There are no pending requests.</div>`;
  $("#memList").innerHTML = ok.map(m => `<div class="item">${avatarHTML(m.name,m.avatarURL)}
    <div class="grow"><strong>${esc(m.name)}${m.role==="admin"?" · Admin":""}</strong><p>${esc(m.email)} · ${esc(m.semester)} · ${esc(m.batch)}</p></div>
    ${m.id!==user.uid ? `<button class="btn ghost sm" data-revoke="${m.id}">Remove</button>` : ""}</div>`).join("");
}
$("#pAdmin").onclick = async e => {
  const a = e.target.closest("[data-approve]"), d = e.target.closest("[data-decline]"), r = e.target.closest("[data-revoke]");
  try {
    if(a){ await updateDoc(doc(db,"users",a.dataset.approve), { status:"approved" }); toast("Approved ✓"); }
    if(d){ await updateDoc(doc(db,"users",d.dataset.decline), { status:"declined" }); toast("Declined."); }
    if(r && confirm("Do you want to remove this member's access?")){ await updateDoc(doc(db,"users",r.dataset.revoke), { status:"declined" }); toast("Access removed."); }
  } catch(err){ toast(friendly(err)); }
};
