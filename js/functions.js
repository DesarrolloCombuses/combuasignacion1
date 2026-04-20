const SUPABASE_URL = "https://jtnlcckphveeqhyrxlku.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_khOBBj9EIe2Ahmkz_KxVUw_R-SDOpk0";
const PLANILLA_SUPABASE_URL = "https://cbplebkmxrkaafqdhiyi.supabase.co";
const PLANILLA_SUPABASE_ANON_KEY = "sb_publishable_DZCceNTENY4ViP17-eZrGg_bdMElZ9X";
const PLANILLA_TABLE_NAME = "planilla_afiliados_2";
const PLANILLA_SELECT_COLUMNS = [
  "hora_llegada",
  "tipo_llegada",
  "base",
  "interno",
  "itinerario_llegada",
  "hora_despacho",
  "itinerario_despacho",
  "conductor",
  "estado",
  "espera",
  "generado_en",
  "created_at"
].join(", ");
const PLANILLA_FETCH_LIMIT = 1200;
const SUPER_ADMIN_EMAIL = "administrador@combuses.com.co";
const BASE_USER_EMAIL_RE = /^base\s*([0-9]+)@combuses\.com\.co$/i;
const ALLOW_PUBLIC_SIGNUP = false;
if (!window.XLSX) {
  throw new Error("No cargo XLSX. Verifica conexion a internet o ruta del script.");
}
if (!window.supabase || typeof window.supabase.createClient !== "function") {
  throw new Error("No cargo Supabase JS. Verifica conexion a internet o ruta del script.");
}
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const planillaSupabaseClient = window.supabase.createClient(PLANILLA_SUPABASE_URL, PLANILLA_SUPABASE_ANON_KEY);
const authPanel = document.getElementById("authPanel");
const appWrap = document.getElementById("appWrap");
const authEmail = document.getElementById("authEmail");
const authPassword = document.getElementById("authPassword");
const authStatus = document.getElementById("authStatus");
const authUserLabel = document.getElementById("authUserLabel");
const btnSignIn = document.getElementById("btnSignIn");
const btnSignUp = document.getElementById("btnSignUp");
const btnLogout = document.getElementById("btnLogout");
const appToast = document.getElementById("appToast");
const lblSync = document.getElementById("lblSync");
const swapModal = document.getElementById("swapModal");
const swapSourceLabelEl = document.getElementById("swapSourceLabel");
const swapTargetLabelEl = document.getElementById("swapTargetLabel");
const swapSourceVehEl = document.getElementById("swapSourceVeh");
const swapTargetVehEl = document.getElementById("swapTargetVeh");
const btnSwapCancel = document.getElementById("btnSwapCancel");
const btnSwapConfirm = document.getElementById("btnSwapConfirm");
const noteModal = document.getElementById("noteModal");
const noteModalTitleEl = document.getElementById("noteModalTitle");
const noteModalSub = document.getElementById("noteModalSub");
const noteModalInput = document.getElementById("noteModalInput");
const btnNoteClear = document.getElementById("btnNoteClear");
const btnNoteCancel = document.getElementById("btnNoteCancel");
const btnNoteSave = document.getElementById("btnNoteSave");

let appInitialized = false;
let currentUserId = null;
let currentUserEmail = "";
let currentUserRole = "";
let currentUserBase = "";
let currentProgramacionId = null;
let currentProgramacionFileName = "programacion_online";
let dragFeedbackTimer = null;
let swapModalResolver = null;
let noteModalResolver = null;
const ROW_UI_ID_KEY = "__ROW_UI_ID";
let rowUiIdSeq = 1;
const UNASSIGNED_LABEL = "SIN CONDUCTOR PROGRAMADO";
let syncRowsInProgress = false;
let syncRowsPending = false;
let syncRetryTimer = null;
let autoRefreshTimer = null;
const SYNC_RETRY_DELAY_MS = 8000;
const AUTO_REFRESH_DELAY_MS = 45000;

function getPendingRowsStorageKey(){
  return `pending_programacion_rows_${currentUserId || "anon"}`;
}

function savePendingRowsLocally(reason = "Cambios pendientes"){
  try {
    const payload = {
      reason,
      saved_at: new Date().toISOString(),
      programacion_id: currentProgramacionId || null,
      file_name: currentProgramacionFileName || "programacion_online",
      rows_data: rows
    };
    localStorage.setItem(getPendingRowsStorageKey(), JSON.stringify(payload));
  } catch (e) {
    console.error("No se pudo guardar pendiente local:", e);
  }
}

function readPendingRowsLocal(){
  try {
    const raw = localStorage.getItem(getPendingRowsStorageKey());
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function clearPendingRowsLocal(){
  try {
    localStorage.removeItem(getPendingRowsStorageKey());
  } catch (e) {}
}

function hasPendingRowsLocal(){
  const pending = readPendingRowsLocal();
  return !!(pending && Array.isArray(pending.rows_data) && pending.rows_data.length > 0);
}

function clearSyncRetryTimer(){
  if (!syncRetryTimer) return;
  clearTimeout(syncRetryTimer);
  syncRetryTimer = null;
}

function scheduleSyncRetry(reason = "Reintento automatico"){
  if (syncRetryTimer || !currentUserId) return;
  syncRetryTimer = setTimeout(async () => {
    syncRetryTimer = null;
    if (!navigator.onLine || !currentUserId || !hasPendingRowsLocal()) return;
    await syncProgramacionRowsToSupabase(reason);
  }, SYNC_RETRY_DELAY_MS);
}

function isViewingLatestProgramacion(){
  if (!currentProgramacionId) return true;
  if (!Array.isArray(programacionesHistory) || programacionesHistory.length === 0) return true;
  const latestKnownId = programacionesHistory[0]?.id;
  return String(currentProgramacionId) === String(latestKnownId);
}

async function refreshFromSupabaseIfSafe(){
  if (!currentUserId) return;
  if (syncRowsInProgress || syncRowsPending) return;
  if (hasPendingRowsLocal()) return;
  if (!isViewingLatestProgramacion()) return;
  try {
    await loadLatestProgramacionFromSupabase();
    if (currentBase) refreshFilterDateOptions();
    updateWorkflowGuide();
    renderTable();
    renderDrivers();
    renderNovedades();
    refreshVisorDateOptions();
    renderLiveExcelPreview();
    renderConsultaBaseView();
    if (!AUDIT_DISABLED && isSuperAdmin()) renderAuditLog();
  } catch (refreshError) {
    console.error("No se pudo refrescar desde Supabase:", refreshError);
  }
}

function setAuthStatus(msg, type){
  authStatus.textContent = msg;
  authStatus.className = `auth-status ${type}`;
}

function showToast(msg, type = "ok"){
  if (!appToast) return;
  appToast.textContent = msg;
  appToast.className = `toast ${type} show`;
  clearTimeout(dragFeedbackTimer);
  dragFeedbackTimer = setTimeout(() => {
    appToast.className = `toast ${type}`;
  }, 2600);
}

function setSyncStatus(type, msg){
  lblSync.textContent = msg;
  lblSync.className = `pill pill-${type}`;
}

function canViewAllRowsByRole(){
  return !!currentUserId;
}

function isSuperAdmin(){
  return norm(currentUserEmail) === norm(SUPER_ADMIN_EMAIL);
}

function canExportXlsx(){
  return isSuperAdmin();
}

function updateExportAccess(){
  const btnExport = document.getElementById("btnExport");
  const btnExportFormato = document.getElementById("btnExportFormato");
  const btnDeleteDay = document.getElementById("btnDeleteDay");
  const adminDayDate = document.getElementById("adminDayDate");
  if (!btnExport && !btnExportFormato) return;
  if (canExportXlsx()) {
    if (btnExport) {
      btnExport.classList.remove("hidden");
      btnExport.disabled = rows.length === 0;
    }
    if (btnExportFormato) {
      btnExportFormato.classList.remove("hidden");
      btnExportFormato.disabled = rows.length === 0;
    }
    if (btnDeleteDay) btnDeleteDay.disabled = rows.length === 0;
    if (adminDayDate) adminDayDate.disabled = false;
    return;
  }
  if (btnExport) {
    btnExport.classList.add("hidden");
    btnExport.disabled = true;
  }
  if (btnExportFormato) {
    btnExportFormato.classList.add("hidden");
    btnExportFormato.disabled = true;
  }
  if (btnDeleteDay) btnDeleteDay.disabled = true;
  if (adminDayDate) adminDayDate.disabled = true;
}

function getRoleFromMetadata(user){
  const raw = user?.app_metadata?.role ?? user?.user_metadata?.role ?? "";
  return String(raw || "").trim().toLowerCase();
}

function getBaseFromMetadata(user){
  const raw = user?.app_metadata?.base ?? user?.user_metadata?.base ?? "";
  const canonical = getBaseCanonical(raw);
  return canonical || "";
}

function getBaseFromEmail(email){
  const m = String(email || "").trim().match(BASE_USER_EMAIL_RE);
  return m ? String(m[1]) : "";
}

function isBaseOperator(){
  return currentUserRole === "base_operator" && !!getBaseCanonical(currentUserBase);
}

function extractConductorName(val){
  if (!val) return '';
  if (norm(val) === UNASSIGNED_LABEL) return '';
  const match = String(val).match(/^(.*?)\s*\[(DISPONIBLE|INCAPACITADO|PERMISO|DESCANSO|VACACIONES|RECONOCIMIENTO DE RUTA|DIA NO REMUNERADO|CALAMIDAD|RENUNCIA)\]\s*$/);
  return match ? match[1].trim() : String(val).trim();
}

function highlightDropTargets(active){
  document.querySelectorAll("td.drop").forEach(td => {
    td.classList.toggle("drop-active", active);
  });
}

function autoScrollDuringDrag(clientY){
  const edge = 90;
  const maxStep = 28;
  const viewportH = window.innerHeight || document.documentElement.clientHeight || 0;
  if (!viewportH) return;

  const topDelta = edge - clientY;
  const bottomDelta = clientY - (viewportH - edge);

  if (topDelta > 0) {
    const step = Math.max(8, Math.round((topDelta / edge) * maxStep));
    window.scrollBy(0, -step);
  } else if (bottomDelta > 0) {
    const step = Math.max(8, Math.round((bottomDelta / edge) * maxStep));
    window.scrollBy(0, step);
  }
}

function closeSwapModal(confirmed){
  if (swapModal) swapModal.classList.add("hidden");
  if (swapModalResolver) {
    const resolve = swapModalResolver;
    swapModalResolver = null;
    resolve(!!confirmed);
  }
}

function confirmVehicleSwapModal(payload){
  if (!swapModal || !btnSwapCancel || !btnSwapConfirm) {
    return Promise.resolve(confirm("Confirmar cambio de carro?"));
  }
  swapSourceLabelEl.textContent = payload?.sourceLabel || "-";
  swapTargetLabelEl.textContent = payload?.targetLabel || "-";
  swapSourceVehEl.textContent = payload?.sourceVeh || "-";
  swapTargetVehEl.textContent = payload?.targetVeh || "-";
  swapModal.classList.remove("hidden");

  return new Promise(resolve => {
    swapModalResolver = resolve;
  });
}

function isInternalRowKey(key){
  const keyText = String(key || "");
  return keyText.startsWith("__NOTE__") || keyText === ROW_UI_ID_KEY;
}

function ensureRowUiId(rowObj){
  const row = rowObj || {};
  if (!row[ROW_UI_ID_KEY]) {
    row[ROW_UI_ID_KEY] = `R${Date.now().toString(36)}${(rowUiIdSeq++).toString(36)}`;
  }
  return String(row[ROW_UI_ID_KEY]);
}

function sanitizeRowForStorage(rowObj){
  const clean = { ...(rowObj || {}) };
  delete clean[ROW_UI_ID_KEY];
  return clean;
}

function getConductorNoteKey(conductorKey){
  return `__NOTE__${String(conductorKey || "")}`;
}

function getVehiculoNoteKey(){
  return "__NOTE__VEHICULO";
}

function getConductorNote(rowObj, conductorKey){
  const row = rowObj || {};
  const noteKey = getConductorNoteKey(conductorKey);
  return String(row[noteKey] || "").trim();
}

function setConductorNote(rowObj, conductorKey, noteText){
  const row = rowObj || {};
  const noteKey = getConductorNoteKey(conductorKey);
  const clean = String(noteText || "").trim();
  if (!clean) delete row[noteKey];
  else row[noteKey] = clean;
}

function getVehiculoNote(rowObj){
  const row = rowObj || {};
  const noteKey = getVehiculoNoteKey();
  return String(row[noteKey] || "").trim();
}

function setVehiculoNote(rowObj, noteText){
  const row = rowObj || {};
  const noteKey = getVehiculoNoteKey();
  const clean = String(noteText || "").trim();
  if (!clean) delete row[noteKey];
  else row[noteKey] = clean;
}

function isConductorSlotResolved(rowObj, conductorKey){
  if (!conductorKey) return false;
  const assigned = extractConductorName((rowObj || {})[conductorKey] || "");
  if (assigned) return true;
  const note = getConductorNote(rowObj, conductorKey);
  return !!note;
}

function closeNoteModal(action, textValue = ""){
  if (noteModal) noteModal.classList.add("hidden");
  if (noteModalResolver) {
    const resolve = noteModalResolver;
    noteModalResolver = null;
    resolve({ action, text: String(textValue || "") });
  }
}

function openConductorNoteModal(payload = {}){
  if (!noteModal || !noteModalInput || !btnNoteSave || !btnNoteCancel || !btnNoteClear) {
    const fallback = prompt("Escribe la nota para la casilla sin conductor:", payload?.note || "");
    if (fallback === null) return Promise.resolve({ action: "cancel", text: payload?.note || "" });
    return Promise.resolve({ action: "save", text: String(fallback || "") });
  }
  if (noteModalTitleEl) noteModalTitleEl.textContent = payload?.title || "Nota en casilla sin conductor";
  noteModalSub.textContent = payload?.label
    ? `Turno: ${payload.label}`
    : "Escribe una nota para este turno.";
  noteModalInput.value = payload?.note || "";
  noteModal.classList.remove("hidden");
  setTimeout(() => noteModalInput.focus(), 10);

  return new Promise(resolve => {
    noteModalResolver = resolve;
  });
}

function getSwapRowLabel(rowObj, keys = {}){
  const row = rowObj || {};
  const n = keys.numeroKey ? String(row[keys.numeroKey] || "").trim() : "";
  const p = keys.puestoKey ? String(row[keys.puestoKey] || "").trim() : "";
  const h = keys.iniciaKey ? excelTimeToHHMM(row[keys.iniciaKey]) : "";
  const parts = [];
  if (n) parts.push(`#${n}`);
  if (p) parts.push(p);
  if (h) parts.push(h);
  return parts.join(" | ") || "Fila sin referencia";
}

function syncFichoVehicleLinksAfterSwap(opts = {}){
  const sourceVeh = String(opts.sourceVeh ?? "").trim();
  const targetVeh = String(opts.targetVeh ?? "").trim();
  if (!sourceVeh || !targetVeh || sourceVeh === targetVeh) return 0;

  const fechaFiltro = normalizeDateToISO(opts.selectedDate || "");
  const baseFiltro = getBaseCanonical(opts.currentBase || "");
  const excludedRows = Array.isArray(opts.excludedRows) ? opts.excludedRows : [];
  const sourceNorm = normalizeVehicleId(sourceVeh);
  const targetNorm = normalizeVehicleId(targetVeh);
  const conductorKeys = [opts.conductorKey1, opts.conductorKey2].filter(Boolean);
  let updated = 0;

  rows.forEach(row => {
    if (!row || excludedRows.includes(row)) return;
    if (!isFichoRowByContent(row)) return;

    if (baseFiltro) {
      const rowBase = getRowCanonicalBase(row, opts.baseKey || null);
      if (rowBase !== baseFiltro) return;
    }
    if (fechaFiltro) {
      const rowDate = getRowDateISO(row, opts.fechaKey || null);
      if (rowDate !== fechaFiltro) return;
    }

    const vehKey = getVehiculoKey(row);
    if (!vehKey) return;
    const rowVehNorm = normalizeVehicleId(row[vehKey]);
    if (rowVehNorm === sourceNorm) {
      row[vehKey] = targetVeh;
      conductorKeys.forEach(k => {
        row[k] = UNASSIGNED_LABEL;
        setConductorNote(row, k, "");
      });
      updated++;
    } else if (rowVehNorm === targetNorm) {
      row[vehKey] = sourceVeh;
      conductorKeys.forEach(k => {
        row[k] = UNASSIGNED_LABEL;
        setConductorNote(row, k, "");
      });
      updated++;
    }
  });

  return updated;
}

function syncConductoresAfterVehicleSwap(sourceRow, targetRow, conductorKey1, conductorKey2){
  const keys = [conductorKey1, conductorKey2].filter(Boolean);
  if (!sourceRow || !targetRow || keys.length === 0) {
    return { swapped: false, blockedByFicho: false };
  }
  const sourceIsFicho = isFichoRowByContent(sourceRow);
  const targetIsFicho = isFichoRowByContent(targetRow);

  if (sourceIsFicho || targetIsFicho) {
    if (sourceIsFicho) {
      keys.forEach(k => {
        sourceRow[k] = UNASSIGNED_LABEL;
        setConductorNote(sourceRow, k, "");
      });
    }
    if (targetIsFicho) {
      keys.forEach(k => {
        targetRow[k] = UNASSIGNED_LABEL;
        setConductorNote(targetRow, k, "");
      });
    }
    return { swapped: false, blockedByFicho: true };
  }

  keys.forEach(k => {
    const sourceVal = sourceRow[k];
    const targetVal = targetRow[k];
    sourceRow[k] = targetVal;
    targetRow[k] = sourceVal;

    const sourceNote = getConductorNote(sourceRow, k);
    const targetNote = getConductorNote(targetRow, k);
    setConductorNote(sourceRow, k, targetNote);
    setConductorNote(targetRow, k, sourceNote);
  });

  return { swapped: true, blockedByFicho: false };
}

function validateProgramacionRows(parsedRows){
  if (!Array.isArray(parsedRows) || parsedRows.length === 0) {
    throw new Error("El archivo esta vacio o no contiene filas validas.");
  }
  const headerSet = new Set();
  parsedRows.slice(0, 50).forEach(r => {
    Object.keys(r || {}).forEach(k => headerSet.add(k));
  });
  const headers = Array.from(headerSet);
  const normHeaders = headers.map(h => norm(h));
  const compactHeaders = headers.map(h => normCompact(h));
  const hasBase = normHeaders.some(h => BASE_COLUMN_ALIASES.includes(h));
  const hasVehiculo = normHeaders.some(h => ["VEH", "VEHICULO", "VEHÍCULO", "MOVIL", "MÓVIL"].includes(h));
  if (!hasBase) {
    if (!hasVehiculo) {
      throw new Error("Falta columna de base (BASE/PUESTO) o VEHICULO para inferir base.");
    }
  }
  const inferredConductores = inferConductorKeysFromList(headers);
  if (!inferredConductores.key1 && !inferredConductores.key2) {
    throw new Error("Falta columna de conductor (ej: CONDUCTOR 1 / CONDUCTOR 2).");
  }
}

function inferConductorKeysFromList(keys){
  const list = Array.isArray(keys) ? keys : [];
  const token = (k) => normCompact(k).replace(/[^A-Z0-9]/g, "");
  const conductorCandidates = list.filter(k => token(k).includes("CONDUCT"));

  let key1 = null;
  let key2 = null;

  conductorCandidates.forEach(k => {
    const t = token(k);
    if (!key1 && (t.includes("1") || t.endsWith("UNO"))) key1 = k;
    if (!key2 && t.includes("2")) key2 = k;
  });

  conductorCandidates.forEach(k => {
    if (!key1) {
      key1 = k;
      return;
    }
    if (!key2 && k !== key1) key2 = k;
  });

  return { key1, key2 };
}

function inferInicioKeysFromList(keys){
  const list = Array.isArray(keys) ? keys : [];
  const token = (k) => normCompact(k).replace(/[^A-Z0-9]/g, "");
  const inicioCandidates = list.filter(k => {
    const t = token(k);
    return t.includes("INICIA") || t.includes("INICIO") || t.includes("HORAINICIO");
  });

  let key1 = null;
  let key2 = null;

  inicioCandidates.forEach(k => {
    const t = token(k);
    if (!key2 && t.includes("2")) key2 = k;
    if (!key1 && (t.includes("1") || t === "INICIA" || t === "INICIO" || t === "HORAINICIO")) key1 = k;
  });

  inicioCandidates.forEach(k => {
    if (!key1) {
      key1 = k;
      return;
    }
    if (!key2 && k !== key1) key2 = k;
  });

  return { key1, key2 };
}

function isTimeColumnKey(headerKey){
  const t = normCompact(headerKey).replace(/[^A-Z0-9]/g, "");
  return t.includes("HORA") || t.startsWith("INICIA") || t.startsWith("INICIO");
}

function applyAuthState(session){
  const loggedIn = !!session;
  authPanel.classList.toggle("hidden", loggedIn);
  appWrap.classList.toggle("hidden", !loggedIn);
  btnLogout.classList.toggle("hidden", !loggedIn);

  if(loggedIn){
    const user = session.user;
    currentUserId = user.id;
    currentUserEmail = user.email || "";
    currentUserRole = getRoleFromMetadata(user);
    const baseFromMetadata = getBaseFromMetadata(user);
    const baseFromEmail = getBaseFromEmail(currentUserEmail);
    currentUserBase = getBaseCanonical(baseFromMetadata || baseFromEmail);
    if (!currentUserRole && baseFromMetadata) currentUserRole = "base_operator";
    if (!currentUserRole && baseFromEmail) currentUserRole = "base_operator";

    authUserLabel.textContent = isSuperAdmin()
      ? `Usuario: ${currentUserEmail} (ADMIN)`
      : isBaseOperator()
        ? `Usuario: ${currentUserEmail} (${formatBaseLabel(currentUserBase)})`
        : `Usuario: ${currentUserEmail || "sin correo"}`;
    setAuthStatus("Sesion iniciada.", "ok");
    setSyncStatus("warn", "Validando datos...");
    updateExportAccess();
    if(!appInitialized || rows.length === 0){
      appInitialized = true;
      initializeApp().catch((error) => {
        console.error("Error inicializando app:", error);
        setSyncStatus("err", "Error inicializando");
        showToast("No se pudo inicializar la app.", "err");
        appInitialized = false;
      });
    } else {
      applyRoleRestrictions();
    }
  }else{
    currentUserId = null;
    currentUserEmail = "";
    currentUserRole = "";
    currentUserBase = "";
    currentProgramacionId = null;
    rows = [];
    novedades = [];
    currentBase = "";
    assignedByBase = {};
    authUserLabel.textContent = "No autenticado";
    setAuthStatus("Inicia sesion para continuar.", "warn");
    setSyncStatus("warn", "Sin sesion");
    updateExportAccess();
    appInitialized = false;
    applyRoleRestrictions();
  }
}

btnSignIn.onclick = async () => {
  const email = authEmail.value.trim();
  const password = authPassword.value;
  if(!email || !password){
    setAuthStatus("Escribe correo y contrasena.", "err");
    return;
  }
  setAuthStatus("Validando acceso...", "warn");
  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if(error){
    setAuthStatus(error.message, "err");
    return;
  }
  authPassword.value = "";
};

btnSignUp.onclick = async () => {
  if (!ALLOW_PUBLIC_SIGNUP) {
    setAuthStatus("Registro deshabilitado. Solicita tu usuario al administrador.", "warn");
    return;
  }
  const email = authEmail.value.trim();
  const password = authPassword.value;
  if(!email || !password){
    setAuthStatus("Escribe correo y contrasena.", "err");
    return;
  }
  setAuthStatus("Creando cuenta...", "warn");
  const { error } = await supabaseClient.auth.signUp({ email, password });
  if(error){
    setAuthStatus(error.message, "err");
    return;
  }
  setAuthStatus("Cuenta creada. Revisa tu correo si la confirmacion esta activa.", "ok");
  authPassword.value = "";
};

if (btnSignUp && !ALLOW_PUBLIC_SIGNUP) {
  btnSignUp.classList.add("hidden");
  btnSignUp.disabled = true;
}

btnLogout.onclick = async () => {
  const { error } = await supabaseClient.auth.signOut();
  if(error){
    setAuthStatus(error.message, "err");
  }
};

async function initAuth(){
  const { data, error } = await supabaseClient.auth.getSession();
  if(error){
    setAuthStatus(error.message, "err");
    applyAuthState(null);
  }else{
    applyAuthState(data.session);
  }
  supabaseClient.auth.onAuthStateChange((_event, session) => {
    applyAuthState(session);
  });
}

if (btnSwapCancel) btnSwapCancel.onclick = () => closeSwapModal(false);
if (btnSwapConfirm) btnSwapConfirm.onclick = () => closeSwapModal(true);
if (swapModal) {
  swapModal.addEventListener("click", (ev) => {
    if (ev.target === swapModal) closeSwapModal(false);
  });
}
if (btnNoteCancel) btnNoteCancel.onclick = () => closeNoteModal("cancel", noteModalInput?.value || "");
if (btnNoteSave) btnNoteSave.onclick = () => closeNoteModal("save", noteModalInput?.value || "");
if (btnNoteClear) btnNoteClear.onclick = () => closeNoteModal("clear", "");
if (noteModal) {
  noteModal.addEventListener("click", (ev) => {
    if (ev.target === noteModal) closeNoteModal("cancel", noteModalInput?.value || "");
  });
}
document.addEventListener("keydown", (ev) => {
  if (ev.key === "Escape" && swapModal && !swapModal.classList.contains("hidden")) {
    closeSwapModal(false);
    return;
  }
  if (ev.key === "Escape" && noteModal && !noteModal.classList.contains("hidden")) {
    closeNoteModal("cancel", noteModalInput?.value || "");
    return;
  }
  if (ev.key === "Enter" && noteModal && !noteModal.classList.contains("hidden") && ev.ctrlKey) {
    closeNoteModal("save", noteModalInput?.value || "");
  }
});

function safeFileName(name){
  return (name || "archivo.xlsx").replace(/[^a-zA-Z0-9._-]/g, "_");
}

function buildConsolidatedRowsFromHistory(records){
  const list = Array.isArray(records) ? records : [];
  const seen = new Set();
  const consolidated = [];
  let totalUnmapped = 0;

  // records viene en orden desc (mas reciente primero). Prioriza lo mas nuevo.
  list.forEach(rec => {
    const prepared = normalizeProgramacionRows(Array.isArray(rec?.rows_data) ? rec.rows_data : []);
    totalUnmapped += prepared.unmappedVehicles || 0;
    prepared.normalized.forEach(row => {
      const slotKey = buildProgramacionSlotKey(row);
      const rowKey = buildProgramacionRowKey(row);
      const key = slotKey ? `S:${slotKey}` : (rowKey ? `K:${rowKey}` : "");
      if (!key) {
        consolidated.push(row);
        return;
      }
      if (seen.has(key)) return;
      seen.add(key);
      consolidated.push(row);
    });
  });

  return { rows: consolidated, unmappedVehicles: totalUnmapped };
}

function mergeLatestRowsIntoConsolidatedRows(consolidatedRowsInput, latestRowsInput){
  const consolidatedRows = Array.isArray(consolidatedRowsInput) ? consolidatedRowsInput : [];
  const latestRows = Array.isArray(latestRowsInput) ? latestRowsInput : [];
  if (consolidatedRows.length === 0) return latestRows.slice();
  if (latestRows.length === 0) return consolidatedRows.slice();

  const latestByKey = new Map();
  latestRows.forEach(row => {
    const slotKey = buildProgramacionSlotKey(row);
    const rowKey = buildProgramacionRowKey(row);
    const matchKey = slotKey ? `S:${slotKey}` : (rowKey ? `K:${rowKey}` : null);
    if (matchKey) latestByKey.set(matchKey, row);
  });

  const merged = [];
  const baseKeys = new Set();
  consolidatedRows.forEach(row => {
    const slotKey = buildProgramacionSlotKey(row);
    const rowKey = buildProgramacionRowKey(row);
    const matchKey = slotKey ? `S:${slotKey}` : (rowKey ? `K:${rowKey}` : null);
    if (!matchKey) {
      merged.push(row);
      return;
    }
    baseKeys.add(matchKey);
    if (latestByKey.has(matchKey)) {
      merged.push(latestByKey.get(matchKey));
    } else {
      merged.push(row);
    }
  });

  latestRows.forEach(row => {
    const slotKey = buildProgramacionSlotKey(row);
    const rowKey = buildProgramacionRowKey(row);
    const matchKey = slotKey ? `S:${slotKey}` : (rowKey ? `K:${rowKey}` : null);
    if (!matchKey || !baseKeys.has(matchKey)) merged.push(row);
  });

  return merged;
}

function isProgramacionFilasUnavailable(error){
  const msg = String(error?.message || "").toLowerCase();
  return msg.includes("programacion_filas") && (msg.includes("does not exist") || msg.includes("relation") || msg.includes("column"));
}

function isPermissionLikeError(error){
  const msg = String(error?.message || "").toLowerCase();
  return msg.includes("permission denied")
    || msg.includes("row-level security")
    || msg.includes("violates row-level security")
    || msg.includes("policy");
}

function chunkArray(input, size = 500){
  const list = Array.isArray(input) ? input : [];
  const chunkSize = Math.max(1, Number(size) || 500);
  const out = [];
  for (let i = 0; i < list.length; i += chunkSize) {
    out.push(list.slice(i, i + chunkSize));
  }
  return out;
}

function waitMs(ms){
  const duration = Math.max(0, Number(ms) || 0);
  return new Promise(resolve => setTimeout(resolve, duration));
}

function stableStringify(value){
  if (value === null || value === undefined) return "";
  if (typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(v => stableStringify(v)).join(",")}]`;
  const keys = Object.keys(value).sort((a, b) => a.localeCompare(b));
  return `{${keys.map(k => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(",")}}`;
}

function rowsSignature(rowsInput){
  const list = Array.isArray(rowsInput) ? rowsInput : [];
  const parts = list.map(row => {
    const slotKey = buildProgramacionSlotKey(row);
    const rowKey = buildProgramacionRowKey(row);
    const identity = slotKey ? `S:${slotKey}` : (rowKey ? `K:${rowKey}` : "X:");
    const clean = sanitizeRowForStorage(row);
    return `${identity}|${stableStringify(clean)}`;
  });
  parts.sort((a, b) => a.localeCompare(b));
  return `${parts.length}::${parts.join("||")}`;
}

function getRowsScopedForCurrentUser(rowsInput){
  const list = Array.isArray(rowsInput) ? rowsInput : [];
  if (!isBaseOperator()) return list.slice();
  const baseScope = getBaseCanonical(currentUserBase);
  if (!baseScope) return [];
  return list.filter(r => getRowCanonicalBase(r) === baseScope);
}

async function verifyProgramacionPersisted(programacionId, expectedRows){
  if (!programacionId) {
    return { ok: false, method: "none", message: "No existe programacion activa para verificar." };
  }
  const expectedScoped = getRowsScopedForCurrentUser(expectedRows);
  let lastResult = { ok: false, method: "none", message: "Sin resultado de verificacion." };

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const rowsResult = await loadProgramacionRowsFromSupabase(programacionId);
      if (rowsResult?.ok) {
        const actualScoped = getRowsScopedForCurrentUser(rowsResult.rows || []);
        const ok = rowsSignature(expectedScoped) === rowsSignature(actualScoped);
        lastResult = {
          ok,
          method: "programacion_filas",
          message: ok
            ? "Guardado verificado en programacion_filas."
            : `Diferencia detectada (${actualScoped.length}/${expectedScoped.length} filas).`
        };
        if (ok) return lastResult;
      } else if (rowsResult?.unavailable) {
        const { data, error } = await supabaseClient
          .from("programaciones")
          .select("rows_data")
          .eq("id", programacionId)
          .limit(1)
          .maybeSingle();
        if (error) {
          lastResult = { ok: false, method: "programaciones.rows_data", message: error.message || "Error leyendo respaldo." };
        } else {
          const actualRows = Array.isArray(data?.rows_data) ? data.rows_data : [];
          const actualScoped = getRowsScopedForCurrentUser(actualRows);
          const ok = rowsSignature(expectedScoped) === rowsSignature(actualScoped);
          lastResult = {
            ok,
            method: "programaciones.rows_data",
            message: ok
              ? "Guardado verificado en rows_data."
              : `Diferencia detectada (${actualScoped.length}/${expectedScoped.length} filas).`
          };
          if (ok) return lastResult;
        }
      }
    } catch (verifyError) {
      lastResult = {
        ok: false,
        method: "verify_error",
        message: verifyError?.message || "Error de verificacion."
      };
    }

    if (attempt < 2) await waitMs(350);
  }

  return lastResult;
}

function buildProgramacionFilaPayload(rowsInput, programacionId){
  const source = Array.isArray(rowsInput) ? rowsInput : [];
  return source.map(row => {
    const rowKey = buildProgramacionRowKey(row);
    const rowData = sanitizeRowForStorage(row);
    const baseCanonical = getRowCanonicalBase(row) || null;
    const fechaIso = getRowDateISO(row) || null;
    const vehKey = getVehiculoKey(row);
    const vehiculo = vehKey ? String(row[vehKey] || "").trim() || null : null;
    return {
      programacion_id: programacionId,
      row_key: rowKey,
      row_data: rowData,
      base: baseCanonical ? formatBaseLabel(baseCanonical) : null,
      fecha: fechaIso,
      vehiculo,
      updated_by: currentUserId || null
    };
  }).filter(r => !!r.row_key);
}

async function loadProgramacionRowsFromSupabase(programacionId){
  if (!programacionId) return { ok: true, rows: [] };
  const pageSize = 1000;
  const allRows = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabaseClient
      .from("programacion_filas")
      .select("row_data")
      .eq("programacion_id", programacionId)
      .order("id", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) {
      if (isProgramacionFilasUnavailable(error)) {
        return { ok: false, unavailable: true, rows: [] };
      }
      throw error;
    }
    const chunk = Array.isArray(data) ? data : [];
    allRows.push(...chunk);
    if (chunk.length < pageSize) break;
    offset += pageSize;
  }

  return {
    ok: true,
    rows: allRows.map(r => r?.row_data).filter(r => r && typeof r === "object")
  };
}

async function syncProgramacionRowsTable(programacionId, rowsInput){
  if (!programacionId || !currentUserId) return { ok: false, skipped: true };
  const payload = buildProgramacionFilaPayload(rowsInput, programacionId);
  const pageSize = 1000;
  const existingRows = [];
  let offset = 0;
  while (true) {
    const existingResult = await supabaseClient
      .from("programacion_filas")
      .select("row_key")
      .eq("programacion_id", programacionId)
      .order("id", { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (existingResult.error) {
      if (isProgramacionFilasUnavailable(existingResult.error)) {
        return { ok: false, unavailable: true };
      }
      throw existingResult.error;
    }
    const chunk = Array.isArray(existingResult.data) ? existingResult.data : [];
    existingRows.push(...chunk);
    if (chunk.length < pageSize) break;
    offset += pageSize;
  }

  const existingKeys = new Set(existingRows.map(r => String(r.row_key || "")).filter(Boolean));
  const nextKeys = new Set(payload.map(r => String(r.row_key || "")).filter(Boolean));
  const toDelete = Array.from(existingKeys).filter(k => !nextKeys.has(k));

  for (const keyChunk of chunkArray(toDelete, 300)) {
    const delResult = await supabaseClient
      .from("programacion_filas")
      .delete()
      .eq("programacion_id", programacionId)
      .in("row_key", keyChunk);
    if (delResult.error) throw delResult.error;
  }

  for (const upsertChunk of chunkArray(payload, 300)) {
    if (upsertChunk.length === 0) continue;
    const upsertResult = await supabaseClient
      .from("programacion_filas")
      .upsert(upsertChunk, { onConflict: "programacion_id,row_key" });
    if (upsertResult.error) {
      if (isProgramacionFilasUnavailable(upsertResult.error)) {
        return { ok: false, unavailable: true };
      }
      throw upsertResult.error;
    }
  }

  return { ok: true, count: payload.length };
}

function mergeRowsForBaseOperator(latestRowsInput, localRowsInput, baseCanonical){
  const latestRows = Array.isArray(latestRowsInput) ? latestRowsInput : [];
  const localRows = Array.isArray(localRowsInput) ? localRowsInput : [];
  const baseScope = getBaseCanonical(baseCanonical);
  if (!baseScope) return localRows;

  const localMap = new Map();
  const localBaseKeys = new Set();
  localRows.forEach(r => {
    const key = buildProgramacionRowKey(r);
    const slotKey = buildProgramacionSlotKey(r);
    if (!key && !slotKey) return;
    if (key) localMap.set(`K:${key}`, r);
    if (slotKey) localMap.set(`S:${slotKey}`, r);
    const rowBase = getRowCanonicalBase(r);
    if (rowBase === baseScope) {
      if (slotKey) localBaseKeys.add(`S:${slotKey}`);
      else if (key) localBaseKeys.add(`K:${key}`);
    }
  });

  const merged = [];
  const usedLocalKeys = new Set();
  latestRows.forEach(r => {
    const key = buildProgramacionRowKey(r);
    const slotKey = buildProgramacionSlotKey(r);
    const matchKey = slotKey ? `S:${slotKey}` : (key ? `K:${key}` : null);
    if (!matchKey) {
      merged.push(r);
      return;
    }
    const rowBase = getRowCanonicalBase(r);
    if (rowBase === baseScope) {
      if (localMap.has(matchKey)) {
        merged.push(localMap.get(matchKey));
        usedLocalKeys.add(matchKey);
      }
      return;
    }
    merged.push(r);
  });

  localBaseKeys.forEach(key => {
    if (usedLocalKeys.has(key)) return;
    const row = localMap.get(key);
    if (row) merged.push(row);
  });

  return merged;
}

async function loadLatestProgramacionFromSupabase(){
  let query = supabaseClient
    .from("programaciones")
    .select("id, file_name, rows_data, uploaded_by, created_at")
    .order("id", { ascending: false })
    .limit(500);
  if (!canViewAllRowsByRole()) {
    query = query.eq("uploaded_by", currentUserId);
  }
  const { data, error } = await query;

  if (error) {
    console.error("Error cargando programacion:", error);
    showToast(`Error programaciones: ${error.message || "sin detalle"}`, "err");
    setSyncStatus("err", "Error de lectura");
    return;
  }

  programacionesHistory = data || [];
  renderProgramacionesHistoryOptions();

  if (programacionesHistory.length === 0) {
    rows = [];
    lblGlobal.textContent = "Sin archivo cargado";
    setSyncStatus("warn", "Sin programacion");
    return;
  }

  const latest = programacionesHistory[0];
  currentProgramacionId = latest.id;
  currentProgramacionFileName = latest.file_name || currentProgramacionFileName;

  // Reconstruye una vista consolidada desde el historial (mas reciente gana por clave),
  // para evitar perder dias cuando se cargan archivos parciales en distintos momentos.
  const consolidated = buildConsolidatedRowsFromHistory(programacionesHistory);
  let nextRows = dedupeProgramacionRows(consolidated.rows).rows;

  let loadedFromRowsTable = false;
  try {
    const rowsResult = await loadProgramacionRowsFromSupabase(currentProgramacionId);
    if (rowsResult?.ok && Array.isArray(rowsResult.rows) && rowsResult.rows.length > 0) {
      const merged = mergeLatestRowsIntoConsolidatedRows(nextRows, rowsResult.rows);
      const reordered = reorderRowsByReference(nextRows, merged);
      rows = dedupeProgramacionRows(reordered).rows;
      loadedFromRowsTable = true;
    }
  } catch (rowsError) {
    console.warn("No se pudo leer programacion_filas durante la carga:", rowsError);
  }
  if (!loadedFromRowsTable) {
    rows = nextRows;
    if (consolidated.unmappedVehicles > 0) {
      showToast(`Atencion: ${consolidated.unmappedVehicles} vehiculos sin base mapeada.`, "warn");
      setSyncStatus("warn", "Mapeo parcial");
      return;
    }
  }
  lblGlobal.textContent = `Programacion en linea: ${programacionesHistory.length} archivos | Filas: ${rows.length}`;
  updateExportAccess();
  fillStartBases();
  setSyncStatus("ok", "Programacion online");
}

function renderProgramacionesHistoryOptions(){
  const sel = document.getElementById("historyProgramacion");
  if (!sel) return;
  const prev = sel.value || "";
  sel.innerHTML = `<option value="">Historial de programaciones...</option>`;
  programacionesHistory.forEach(rec => {
    const op = document.createElement("option");
    op.value = String(rec.id);
    const dt = rec.created_at ? new Date(rec.created_at).toLocaleString("es-CO") : "sin fecha";
    op.textContent = `${rec.file_name || "programacion"} | ${dt} | id ${rec.id}`;
    sel.appendChild(op);
  });
  if (prev && programacionesHistory.some(r => String(r.id) === prev)) {
    sel.value = prev;
  } else if (currentProgramacionId) {
    sel.value = String(currentProgramacionId);
  }
}

async function applyProgramacionRecord(record){
  if (!record) return;
  currentProgramacionId = record.id;
  currentProgramacionFileName = record.file_name || currentProgramacionFileName;
  const prepared = normalizeProgramacionRows(Array.isArray(record.rows_data) ? record.rows_data : []);
  try {
    const rowsResult = await loadProgramacionRowsFromSupabase(currentProgramacionId);
    rows = rowsResult.ok ? reorderRowsByReference(prepared.normalized, rowsResult.rows) : prepared.normalized;
  } catch (rowsError) {
    console.error("Error cargando filas del historial:", rowsError);
    rows = prepared.normalized;
  }
  rows = dedupeProgramacionRows(rows).rows;
  lblGlobal.textContent = `Programacion en linea: ${record.file_name} | Filas: ${rows.length}`;
  updateExportAccess();
  fillStartBases();
  if (currentBase) refreshFilterDateOptions();
  renderTable();
  renderDrivers();
  renderNovedades();
  setSyncStatus(prepared.unmappedVehicles > 0 ? "warn" : "ok", prepared.unmappedVehicles > 0 ? "Mapeo parcial" : "Programacion online");
}

async function saveProgramacionToSupabase(file, parsedRows){
  if (!currentUserId) {
    throw new Error("No hay sesion activa.");
  }

  const storagePath = `${currentUserId}/${Date.now()}_${safeFileName(file.name)}`;
  const uploadResult = await supabaseClient.storage
    .from("programaciones")
    .upload(storagePath, file, { upsert: false });

  if (uploadResult.error) {
    console.error("Error subiendo archivo a Storage:", uploadResult.error);
  }

  // Historial: cada archivo cargado crea un nuevo registro de programacion.
  const insertResult = await supabaseClient
    .from("programaciones")
    .insert({
      uploaded_by: currentUserId,
      file_name: file.name,
      file_path: uploadResult.error ? null : storagePath,
      rows_data: parsedRows
    })
    .select("id")
    .single();
  const data = insertResult.data;
  const error = insertResult.error;

  if (error) {
    setSyncStatus("err", "Error guardando");
    throw error;
  }

  currentProgramacionId = data?.id || null;
  currentProgramacionFileName = file?.name || currentProgramacionFileName;
  let savedToRowsTable = false;
  if (currentProgramacionId) {
    try {
      const rowsSyncResult = await syncProgramacionRowsTable(currentProgramacionId, parsedRows);
      savedToRowsTable = !!rowsSyncResult.ok;
      if (!rowsSyncResult.ok && rowsSyncResult.unavailable) {
        console.warn("Tabla programacion_filas no disponible; se usa rows_data como respaldo.");
      }
    } catch (rowsSyncError) {
      console.error("Error guardando filas de programacion:", rowsSyncError);
    }
  }
  if (currentProgramacionId) {
    programacionesHistory = [
      {
        id: currentProgramacionId,
        file_name: file?.name || currentProgramacionFileName,
        rows_data: parsedRows,
        uploaded_by: currentUserId,
        created_at: new Date().toISOString()
      },
      ...programacionesHistory.filter(r => String(r.id) !== String(currentProgramacionId))
    ];
    renderProgramacionesHistoryOptions();
    rows = dedupeProgramacionRows(parsedRows).rows;
    lblGlobal.textContent = `Programacion en linea: ${programacionesHistory.length} archivos | Filas: ${rows.length}`;
  }
  setSyncStatus("ok", "Archivo guardado");
  showToast("Archivo validado y sincronizado en Supabase.", "ok");
}

async function syncProgramacionRowsToSupabase(reason = "Cambios guardados en Supabase."){
  if (!currentUserId || !Array.isArray(rows)) return false;
  if (!navigator.onLine) {
    savePendingRowsLocally("Sin internet");
    setSyncStatus("warn", "Sin internet - pendiente");
    showToast("Sin internet. Cambios guardados localmente.", "warn");
    scheduleSyncRetry(reason);
    return false;
  }
  if (syncRowsInProgress) {
    syncRowsPending = true;
    savePendingRowsLocally("Cambio en cola de sincronizacion");
    return false;
  }
  syncRowsInProgress = true;
  savePendingRowsLocally("Sincronizando cambios");
  setSyncStatus("warn", "Guardando cambios...");

  try {
    let rowsToPersist = Array.isArray(rows) ? rows.slice() : [];
    let rowsTableSynced = false;
    const dedupedBeforeSync = dedupeProgramacionRows(rowsToPersist);
    if (dedupedBeforeSync.removed > 0) {
      rowsToPersist = dedupedBeforeSync.rows;
      rows = rowsToPersist;
    }
    if (isBaseOperator() && currentProgramacionId) {
      const latestRowsResult = await loadProgramacionRowsFromSupabase(currentProgramacionId);
      if (latestRowsResult?.ok) {
        rowsToPersist = mergeRowsForBaseOperator(latestRowsResult.rows, rowsToPersist, currentUserBase);
        rowsToPersist = dedupeProgramacionRows(rowsToPersist).rows;
      }
    }
    rowsToPersist = getRowsOrderedByCurrentReference(rowsToPersist);
    rows = rowsToPersist;

    if (currentProgramacionId) {
      try {
        const rowsSyncResult = await syncProgramacionRowsTable(currentProgramacionId, rowsToPersist);
        rowsTableSynced = !!rowsSyncResult?.ok;
      } catch (rowsSyncError) {
        if (!isProgramacionFilasUnavailable(rowsSyncError)) throw rowsSyncError;
      }
      const { error } = await supabaseClient
        .from("programaciones")
        .update({ rows_data: rowsToPersist })
        .eq("id", currentProgramacionId);
      if (error) {
        if (rowsTableSynced && isBaseOperator() && isPermissionLikeError(error)) {
          console.warn("Sin permiso para actualizar programaciones.rows_data; cambios preservados en programacion_filas.");
        } else {
          throw error;
        }
      }
    } else {
      const { data, error } = await supabaseClient
        .from("programaciones")
        .insert({
          uploaded_by: currentUserId,
          file_name: currentProgramacionFileName || "programacion_online",
          file_path: null,
          rows_data: rowsToPersist
        })
        .select("id")
        .single();
      if (error) throw error;
      currentProgramacionId = data?.id || null;
      if (currentProgramacionId) {
        try {
          await syncProgramacionRowsTable(currentProgramacionId, rowsToPersist);
        } catch (rowsSyncError) {
          if (!isProgramacionFilasUnavailable(rowsSyncError)) throw rowsSyncError;
        }
      }
    }

    const verifyResult = await verifyProgramacionPersisted(currentProgramacionId, rowsToPersist);
    if (!verifyResult.ok) {
      throw new Error(`No se pudo confirmar guardado en Supabase (${verifyResult.method}). ${verifyResult.message || ""}`.trim());
    }

    setSyncStatus("ok", "Guardado verificado");
    if (currentProgramacionId && Array.isArray(programacionesHistory)) {
      programacionesHistory = programacionesHistory.map(rec =>
        String(rec.id) === String(currentProgramacionId)
          ? { ...rec, rows_data: rowsToPersist }
          : rec
      );
    }
    showToast(`${reason} (verificado)`, "ok");
    clearPendingRowsLocal();
    clearSyncRetryTimer();
    return true;
  } catch (error) {
    console.error("Error sincronizando cambios de programacion:", error);
    savePendingRowsLocally("Error de sincronizacion");
    setSyncStatus("err", "Error guardando cambios");
    const detail = String(error?.message || "");
    if (isPermissionLikeError(error)) {
      showToast("Cambios pendientes por permisos en Supabase (RLS). Contacta al administrador.", "err");
    } else {
      showToast(`Cambios pendientes. Se reintentara al reconectar.${detail ? ` (${detail})` : ""}`, "warn");
    }
    scheduleSyncRetry(reason);
    return false;
  } finally {
    syncRowsInProgress = false;
    if (syncRowsPending) {
      syncRowsPending = false;
      syncProgramacionRowsToSupabase(reason);
    }
  }
}

async function loadNovedadesFromSupabase(options = {}){
  const silent = !!options.silent;
  if (!currentUserId) return;
  let query = supabaseClient
    .from("novedades")
    .select("id, nombre, base, estado, fecha")
    .order("id", { ascending: false });
  if (!canViewAllRowsByRole()) {
    query = query.eq("user_id", currentUserId);
  }
  const { data, error } = await query;

  if (error) {
    console.error("Error cargando novedades:", error);
    showToast(`Error novedades: ${error.message || "sin detalle"}`, "err");
    novedades = [];
    setSyncStatus("err", "Error novedades");
    return;
  }

  novedades = data || [];
  if (!silent) showToast(`Novedades cargadas: ${novedades.length}`, "ok");
}

async function createNovedadInSupabase(payload){
  if (!currentUserId) {
    throw new Error("No hay sesion activa.");
  }
  const { data, error } = await supabaseClient
    .from("novedades")
    .insert({
      user_id: currentUserId,
      nombre: payload.nombre,
      base: payload.base,
      estado: payload.estado,
      fecha: payload.fecha
    })
    .select("id, nombre, base, estado, fecha")
    .single();
  if (error) throw error;
  setSyncStatus("ok", "Novedad registrada");
  showToast("Novedad registrada en Supabase.", "ok");
  return data;
}

async function updateNovedadEstadoInSupabase(id, estado){
  const { error } = await supabaseClient
    .from("novedades")
    .update({ estado })
    .eq("id", id);

  if (error) {
    throw error;
  }
  setSyncStatus("ok", "Novedad actualizada");
}

async function deleteNovedadInSupabase(id){
  const { error } = await supabaseClient
    .from("novedades")
    .delete()
    .eq("id", id);

  if (error) {
    throw error;
  }
  setSyncStatus("ok", "Novedad eliminada");
}
/* ===================== DATA ===================== */
let rows = [];
let currentBase = "";
let driversByBase = {};     // { "2": ["NOMBRE", ...] }
let assignedByBase = {};    // { "2": Set(["..."]) }
let basesCatalog = [];
let isLoadingDrivers = false;
let programacionesHistory = [];
let planillaAfiliadosRows = [];
let planillaAfiliadosLoading = false;
let planillaAfiliadosLoadedOnce = false;
let planillaLastLoadedAt = 0;
let planillaAutoRefreshTimer = null;
let aeropuertoSelectedItinerary = "";
let sanDiegoSelectedItinerary = "";
let nutibaraSelectedItinerary = "";
let lastAeropuertoRenderedRows = [];
let lastSanDiegoRenderedRows = [];
let lastNutibaraRenderedRows = [];
let operativoViewMode = "operativo";
const ARRIVALS_PANEL_TAB_IDS = ["llegadas-aeropuerto", "llegadas-san-diego", "llegadas-nutibara"];
const PLANILLA_REFRESH_MAX_AGE_MS = 15000;
const PLANILLA_AUTO_REFRESH_MS = 30000;

// Estructura para novedades (conductores con estado)
let novedades = []; // Array de objetos { nombre, base, estado, fecha }
const AppState = {
  get hasRows(){
    return Array.isArray(rows) && rows.length > 0;
  },
  clearProgramacion(){
    rows = [];
    assignedByBase = {};
  },
  replaceRows(nextRows){
    rows = Array.isArray(nextRows) ? nextRows : [];
    assignedByBase = {};
  }
};

const NOVEDADES = {
  DISPONIBLE: { class: 'disponible', color: '#22c55e', label: 'Disponible' },
  INCAPACITADO: { class: 'incapacitado', color: '#ef4444', label: 'Incapacitado' },
  PERMISO: { class: 'permiso', color: '#f59e0b', label: 'Permiso' },
  DESCANSO: { class: 'descanso', color: '#6b7280', label: 'Descanso' },
  VACACIONES: { class: 'vacaciones', color: '#0ea5e9', label: 'Vacaciones' },
  "RECONOCIMIENTO DE RUTA": { class: 'reconocimiento_ruta', color: '#7c3aed', label: 'Reconocimiento de ruta' },
  "DIA NO REMUNERADO": { class: 'dia_no_remunerado', color: '#b45309', label: 'Dia no remunerado' },
  CALAMIDAD: { class: 'calamidad', color: '#be123c', label: 'Calamidad' },
  RENUNCIA: { class: 'renuncia', color: '#334155', label: 'Renuncia' },
  PENDIENTE: { class: 'pendiente', color: '#9ca3af', label: 'Pendiente' }
};

// Importante: PUESTO (NUTIBARA/SAN DIEGO/EXPOSICIONES) no representa la base operativa.
const BASE_COLUMN_ALIASES = ["BASE", "PATIO", "ESTACION", "ESTACIÓN"];

/* ===================== UI ===================== */
const lblGlobal = document.getElementById("lblGlobal");
const lblCurrentBase = document.getElementById("lblCurrentBase");
const lblDriversCount = document.getElementById("lblDriversCount");
const adminPanel = document.getElementById("adminPanel");
const converterPanel = document.getElementById("converterPanel");
const operativoPanel = document.getElementById("operativoPanel");
const operativoInner = document.getElementById("operativoInner");
const startBaseSelect = document.getElementById("startBase");
const basesList = document.getElementById("basesList");
const csvStatus = document.getElementById("csvStatus");
const gridHead = document.querySelector('#grid thead');
const gridBody = document.querySelector('#grid tbody');
const novedadesBody = document.getElementById('novedadesBody');
const currentBaseDisplay = document.getElementById("currentBaseDisplay");
const novedadesBaseDisplay = document.getElementById("novedadesBaseDisplay");
const novedadesCount = document.getElementById("novedadesCount");
const debugOutput = document.getElementById("debugOutput");
const btnRefreshDebug = document.getElementById("btnRefreshDebug");
const gridViewport = document.getElementById("gridViewport");
const novedadesViewport = document.getElementById("novedadesViewport");
const workflowGuide = document.getElementById("workflowGuide");
const stepSelectDate = document.getElementById("stepSelectDate");
const stepAssignDrivers = document.getElementById("stepAssignDrivers");
const stepRegisterStates = document.getElementById("stepRegisterStates");
const workflowNote = document.getElementById("workflowNote");
const consultaFrom = document.getElementById("consultaFrom");
const consultaTo = document.getElementById("consultaTo");
const btnApplyConsulta = document.getElementById("btnApplyConsulta");
const consultaBaseLabel = document.getElementById("consultaBaseLabel");
const consultaProgramadosCount = document.getElementById("consultaProgramadosCount");
const consultaEstadosCount = document.getElementById("consultaEstadosCount");
const consultaProgramadosBody = document.getElementById("consultaProgramadosBody");
const consultaEstadosBody = document.getElementById("consultaEstadosBody");
const consultaTimeline = document.getElementById("consultaTimeline");
const adminComplianceCard = document.getElementById("adminComplianceCard");
const adminComplianceDate = document.getElementById("adminComplianceDate");
const adminComplianceBody = document.getElementById("adminComplianceBody");
const adminComplianceSummary = document.getElementById("adminComplianceSummary");
const btnRefreshCompliance = document.getElementById("btnRefreshCompliance");
const liveExcelPreview = document.getElementById("liveExcelPreview");
const visorDateSelect = document.getElementById("visorDateSelect");
const visorScopeSelect = document.getElementById("visorScopeSelect");
const btnRefreshVisor = document.getElementById("btnRefreshVisor");
const btnExportVisor = document.getElementById("btnExportVisor");
const auditBody = document.getElementById("auditBody");
const auditCount = document.getElementById("auditCount");
const auditFrom = document.getElementById("auditFrom");
const auditTo = document.getElementById("auditTo");
const auditUserFilter = document.getElementById("auditUserFilter");
const auditTableFilter = document.getElementById("auditTableFilter");
const auditOpFilter = document.getElementById("auditOpFilter");
const btnRefreshAudit = document.getElementById("btnRefreshAudit");
let auditLogRows = [];
const AUDIT_DISABLED = true;
const planillaFilterInterno = document.getElementById("planillaFilterInterno");
const planillaFilterBase = document.getElementById("planillaFilterBase");
const planillaFilterTipo = document.getElementById("planillaFilterTipo");
const planillaFilterHoraLlegada = document.getElementById("planillaFilterHoraLlegada");
const btnRefreshPlanilla = document.getElementById("btnRefreshPlanilla");
const btnDownloadLlegadas = document.getElementById("btnDownloadLlegadas");
const btnDownloadDespachos = document.getElementById("btnDownloadDespachos");
const planillaStatus = document.getElementById("planillaStatus");
const planillaCount = document.getElementById("planillaCount");
const planillaHead = document.getElementById("planillaHead");
const planillaBody = document.getElementById("planillaBody");
const btnRefreshLlegadasAeropuerto = document.getElementById("btnRefreshLlegadasAeropuerto");
const aeropuertoSearch = document.getElementById("aeropuertoSearch");
const aeropuertoEstadoFilter = document.getElementById("aeropuertoEstadoFilter");
const aeropuertoUploadFrom = document.getElementById("aeropuertoUploadFrom");
const aeropuertoUploadTo = document.getElementById("aeropuertoUploadTo");
const btnDownloadLlegadasAeropuerto = document.getElementById("btnDownloadLlegadasAeropuerto");
const llegadasAeropuertoTitle = document.getElementById("llegadasAeropuertoTitle");
const llegadasAeropuertoCount = document.getElementById("llegadasAeropuertoCount");
const llegadasAeropuertoStatus = document.getElementById("llegadasAeropuertoStatus");
const llegadasAeropuertoBody = document.getElementById("llegadasAeropuertoBody");
const llegadasAeropuertoTabs = document.getElementById("llegadasAeropuertoTabs");
const btnRefreshLlegadasSanDiego = document.getElementById("btnRefreshLlegadasSanDiego");
const sanDiegoSearch = document.getElementById("sanDiegoSearch");
const sanDiegoEstadoFilter = document.getElementById("sanDiegoEstadoFilter");
const sanDiegoUploadFrom = document.getElementById("sanDiegoUploadFrom");
const sanDiegoUploadTo = document.getElementById("sanDiegoUploadTo");
const btnDownloadLlegadasSanDiego = document.getElementById("btnDownloadLlegadasSanDiego");
const llegadasSanDiegoTitle = document.getElementById("llegadasSanDiegoTitle");
const llegadasSanDiegoCount = document.getElementById("llegadasSanDiegoCount");
const llegadasSanDiegoStatus = document.getElementById("llegadasSanDiegoStatus");
const llegadasSanDiegoBody = document.getElementById("llegadasSanDiegoBody");
const llegadasSanDiegoTabs = document.getElementById("llegadasSanDiegoTabs");
const btnRefreshLlegadasNutibara = document.getElementById("btnRefreshLlegadasNutibara");
const nutibaraSearch = document.getElementById("nutibaraSearch");
const nutibaraEstadoFilter = document.getElementById("nutibaraEstadoFilter");
const nutibaraUploadFrom = document.getElementById("nutibaraUploadFrom");
const nutibaraUploadTo = document.getElementById("nutibaraUploadTo");
const btnDownloadLlegadasNutibara = document.getElementById("btnDownloadLlegadasNutibara");
const llegadasNutibaraTitle = document.getElementById("llegadasNutibaraTitle");
const llegadasNutibaraCount = document.getElementById("llegadasNutibaraCount");
const llegadasNutibaraStatus = document.getElementById("llegadasNutibaraStatus");
const llegadasNutibaraBody = document.getElementById("llegadasNutibaraBody");
const llegadasNutibaraTabs = document.getElementById("llegadasNutibaraTabs");

/* ===================== UTIL ===================== */
function norm(s){ return (s||"").toString().trim().toUpperCase(); }
function normCompact(s){ return norm(s).replace(/\s+/g, ""); }

function getBaseCanonical(value){
  const raw = String(value ?? "").trim().toUpperCase();
  if (!raw) return "";
  const m = raw.match(/^BASE\s*(\d+)$/i);
  if (m) return m[1];
  return raw;
}

function formatBaseLabel(value){
  const canonical = getBaseCanonical(value);
  if (/^\d+$/.test(canonical)) return `BASE ${canonical}`;
  return canonical;
}

function sameBase(a, b){
  const ca = getBaseCanonical(a);
  const cb = getBaseCanonical(b);
  return !!ca && !!cb && ca === cb;
}

function updateWorkflowGuide(){
  if (!workflowGuide || !stepSelectDate || !stepAssignDrivers || !stepRegisterStates || !workflowNote) return;
  if (!currentBase) {
    workflowGuide.classList.add("hidden");
    return;
  }
  workflowGuide.classList.remove("hidden");
  const selectedDate = document.getElementById("filterDate")?.value || "";
  const filterInput = document.getElementById("filterDrivers");

  if (!selectedDate) {
    stepSelectDate.className = "workflow-step active";
    stepAssignDrivers.className = "workflow-step";
    stepRegisterStates.className = "workflow-step";
    workflowNote.textContent = "Paso 1: selecciona la fecha para ver turnos y habilitar asignaciones.";
    if (filterInput) filterInput.disabled = true;
    return;
  }

  stepSelectDate.className = "workflow-step done";
  const status = getDateStatusForBase(selectedDate);

  if (status.state === "complete") {
    stepAssignDrivers.className = "workflow-step done";
    stepRegisterStates.className = "workflow-step done";
    workflowNote.textContent = `Dia completo: ${status.filled}/${status.required} turnos y sin sobrantes.`;
  } else if (status.state === "needs_states") {
    stepAssignDrivers.className = "workflow-step done";
    stepRegisterStates.className = "workflow-step active";
    workflowNote.textContent = `Turnos completos (${status.filled}/${status.required}). Lleva ${status.remaining} sobrantes a Estados del personal.`;
  } else {
    stepAssignDrivers.className = "workflow-step active";
    stepRegisterStates.className = "workflow-step";
    workflowNote.textContent = `Completa turnos: ${status.filled}/${status.required}. En cada vacio, asigna conductor o agrega nota.`;
  }
  if (filterInput) filterInput.disabled = false;
}

function adjustDynamicTableViewport(){
  const applyTo = (el) => {
    if (!el || !el.closest(".tab-content.active")) return;
    const rect = el.getBoundingClientRect();
    const available = Math.max(260, window.innerHeight - rect.top - 36);
    el.style.maxHeight = `${available}px`;
  };
  if (gridViewport) {
    gridViewport.style.maxHeight = "none";
    gridViewport.style.overflow = "visible";
  }
  applyTo(novedadesViewport);
}

function applyRoleRestrictions(){
  const navButtonsRow = document.getElementById("btnGoOperativo")?.parentElement;
  const baseSelectorRow = document.getElementById("btnEnterBase")?.parentElement;
  const btnGoConverter = document.getElementById("btnGoConverter");
  const tabDebug = document.querySelector('.tab[data-tab="debugsupabase"]');
  const tabAudit = document.querySelector('.tab[data-tab="audit"]');
  const tabVisor = document.querySelector('.tab[data-tab="visor"]');
  const tabNovedades = document.querySelector('.tab[data-tab="novedades"]');
  const operativoTitle = document.getElementById("operativoMainTitle") || document.querySelector("#operativoPanel h2");
  const auditContent = document.getElementById("tab-audit");

  if (AUDIT_DISABLED) {
    if (tabAudit) tabAudit.classList.add("hidden");
    if (auditContent?.classList.contains("active")) {
      auditContent.classList.remove("active");
      const progTab = document.querySelector('.tab[data-tab="programacion"]');
      const progContent = document.getElementById("tab-programacion");
      if (progTab) progTab.classList.add("active");
      if (progContent) progContent.classList.add("active");
    }
  }

  if (isBaseOperator()) {
    adminPanel.classList.add("hidden");
    if (converterPanel) converterPanel.classList.add("hidden");
    operativoPanel.classList.remove("hidden");
    if (navButtonsRow) navButtonsRow.classList.add("hidden");
    if (baseSelectorRow) baseSelectorRow.classList.add("hidden");
    if (btnGoConverter) btnGoConverter.classList.add("hidden");
    if (tabDebug) tabDebug.classList.add("hidden");
    if (tabAudit) tabAudit.classList.add("hidden");
    if (tabVisor) tabVisor.classList.remove("hidden");
    if (tabNovedades) tabNovedades.classList.remove("hidden");
    if (operativoTitle) operativoTitle.textContent = `Ingreso de conductores - ${formatBaseLabel(currentUserBase)}`;
    if (getBaseCanonical(currentBase) !== getBaseCanonical(currentUserBase)) {
      enterBase(currentUserBase);
    }
    updateExportAccess();
    return;
  }

  if (navButtonsRow) navButtonsRow.classList.remove("hidden");
  if (baseSelectorRow) baseSelectorRow.classList.remove("hidden");
  if (btnGoConverter) btnGoConverter.classList.toggle("hidden", !isSuperAdmin());
  if (!isSuperAdmin() && converterPanel) converterPanel.classList.add("hidden");
  if (tabDebug) tabDebug.classList.remove("hidden");
  if (tabAudit) tabAudit.classList.toggle("hidden", AUDIT_DISABLED ? true : !isSuperAdmin());
  if (tabVisor) tabVisor.classList.remove("hidden");
  if (!isSuperAdmin()) {
    if (auditContent?.classList.contains("active")) {
      auditContent.classList.remove("active");
      const progTab = document.querySelector('.tab[data-tab="programacion"]');
      const progContent = document.getElementById("tab-programacion");
      if (progTab) progTab.classList.add("active");
      if (progContent) progContent.classList.add("active");
    }
  }
  if (operativoTitle) operativoTitle.textContent = operativoViewMode === "llegadas" ? "Panel de llegadas vehiculos" : "Panel de operacion";
  updateExportAccess();
  renderAdminComplianceDashboard();
}

async function renderSupabaseDebug(){
  if (!debugOutput) return;
  if (!currentUserId) {
    debugOutput.textContent = "Sin sesion activa.";
    return;
  }
  debugOutput.textContent = "Consultando Supabase...";
  let query = supabaseClient
    .from("programaciones")
    .select("id, file_name, rows_data, uploaded_by")
    .order("id", { ascending: false })
    .limit(1);
  if (!canViewAllRowsByRole()) {
    query = query.eq("uploaded_by", currentUserId);
  }
  const { data, error } = await query;

  if (error) {
    debugOutput.textContent = `Error consultando Supabase:\n${error.message}`;
    return;
  }
  if (!data || data.length === 0) {
    debugOutput.textContent = "No hay programacion guardada en Supabase para este usuario.";
    return;
  }

  const latest = data[0];
  const rawRows = Array.isArray(latest.rows_data) ? latest.rows_data : [];
  const prepared = normalizeProgramacionRows(rawRows);
  const normalizedRows = prepared.normalized;

  const headerSet = new Set();
  rawRows.slice(0, 200).forEach(r => Object.keys(r || {}).forEach(k => headerSet.add(k)));
  const allKeys = Array.from(headerSet);
  const baseCandidates = allKeys.filter(k => BASE_COLUMN_ALIASES.includes(norm(k)));
  let debugBaseKey = null;
  if (baseCandidates.length > 0) {
    const score = (key) => normalizedRows.slice(0, 500).reduce((acc, r) => acc + (String((r && r[key]) ?? "").trim() ? 1 : 0), 0);
    baseCandidates.sort((a, b) => score(b) - score(a));
    debugBaseKey = baseCandidates[0];
  }
  const countsByCanonical = {};
  normalizedRows.forEach(r => {
    const baseVal = debugBaseKey ? r[debugBaseKey] : (r.BASE || r.PUESTO || "");
    const c = getBaseCanonical(baseVal);
    if (!c) return;
    countsByCanonical[c] = (countsByCanonical[c] || 0) + 1;
  });

  const selected = getBaseCanonical(currentBase);
  const selectedCount = selected ? (countsByCanonical[selected] || 0) : 0;
  const lines = [];
  lines.push(`Archivo: ${latest.file_name}`);
  lines.push(`Registro ID: ${latest.id}`);
  lines.push(`Creado: ${latest.created_at || "(columna created_at no disponible)"}`);
  lines.push(`uploaded_by: ${latest.uploaded_by || "(sin dato)"}`);
  lines.push(`Usuario autenticado: ${currentUserId || "(sin sesion)"}`);
  lines.push(`Filas raw en Supabase: ${rawRows.length}`);
  lines.push(`Filas normalizadas: ${normalizedRows.length}`);
  lines.push(`Columnas candidatas de base: ${baseCandidates.length ? baseCandidates.join(", ") : "(ninguna)"}`);
  lines.push(`Columna base usada en diagnostico: ${debugBaseKey || "(ninguna)"}`);
  lines.push(`Base seleccionada UI: ${currentBase || "(ninguna)"}`);
  lines.push(`Base seleccionada canonica: ${selected || "(ninguna)"}`);
  lines.push(`Filas que matchean base seleccionada: ${selectedCount}`);
  lines.push(`Vehiculos sin mapeo de base: ${prepared.unmappedVehicles}`);
  lines.push("");
  lines.push("Conteo por base canonica:");
  const sortedBases = Object.keys(countsByCanonical).sort((a,b)=>a.localeCompare(b, undefined, {numeric:true}));
  if (sortedBases.length === 0) {
    lines.push("- No se detectaron bases en las filas.");
  } else {
    sortedBases.forEach(b => lines.push(`- ${formatBaseLabel(b)}: ${countsByCanonical[b]} filas`));
  }
  lines.push("");
  lines.push("Muestra (primeras 5 filas normalizadas):");
  normalizedRows.slice(0, 5).forEach((r, i) => {
    const baseVal = debugBaseKey ? r[debugBaseKey] : (r.BASE || r.PUESTO || "");
    const vehKey = getVehiculoKey(r);
    const vehVal = vehKey ? r[vehKey] : "";
    lines.push(`${i+1}. base='${baseVal}' canon='${getBaseCanonical(baseVal)}' vehiculo='${vehVal}'`);
  });

  debugOutput.textContent = lines.join("\n");
}

function escapeHtml(value){
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatPlanillaCell(value){
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch (e) {
      return String(value);
    }
  }
  return String(value);
}

function mapTipoLlegada(value){
  const code = String(value ?? "").trim();
  if (code === "104") return "Llegada Aeropuerto";
  if (code === "101") return "Llegada San Diego";
  if (code === "110") return "Llegada Nutibara";
  return code || "-";
}

const PLANILLA_VIEW_COLUMNS = [
  { title: "Hora llegada", value: (row) => row?.hora_llegada },
  { title: "Tipo", value: (row) => mapTipoLlegada(row?.tipo_llegada) },
  { title: "Base", value: (row) => row?.base },
  { title: "Interno", value: (row) => row?.interno },
  { title: "Itinerario llegada", value: (row) => row?.itinerario_llegada },
  { title: "Hora despacho", value: (row) => row?.hora_despacho },
  { title: "Itinerario despacho", value: (row) => row?.itinerario_despacho },
  { title: "Conductor", value: (row) => row?.conductor },
  { title: "Estado", value: (row) => row?.estado },
  { title: "Espera", value: (row) => row?.espera },
  { title: "Generado en", value: (row) => row?.generado_en }
];

function getPlanillaFilteredRows(rowsInput){
  const rowsList = Array.isArray(rowsInput) ? rowsInput : [];
  const internoTerm = String(planillaFilterInterno?.value || "").trim().toLowerCase();
  const baseTerm = String(planillaFilterBase?.value || "").trim().toLowerCase();
  const tipoTerm = String(planillaFilterTipo?.value || "").trim().toLowerCase();
  const horaLlegadaTerm = String(planillaFilterHoraLlegada?.value || "").trim().toLowerCase();
  const filtered = rowsList.filter(row => {
    const internoOk = !internoTerm || formatPlanillaCell(row?.interno).toLowerCase().includes(internoTerm);
    const baseOk = !baseTerm || formatPlanillaCell(row?.base).toLowerCase().includes(baseTerm);
    const tipoTxt = mapTipoLlegada(row?.tipo_llegada).toLowerCase();
    const tipoOk = !tipoTerm || tipoTxt.includes(tipoTerm);
    const horaLlegadaOk = !horaLlegadaTerm || formatPlanillaCell(row?.hora_llegada).toLowerCase().includes(horaLlegadaTerm);
    return internoOk && baseOk && tipoOk && horaLlegadaOk;
  });
  const ordered = filtered.sort(comparePlanillaRowsByCurrentDateTime);
  return dedupeLlegadasByHour(ordered);
}

function parsePlanillaDateTime(value){
  const raw = String(value || "").trim();
  if (!raw) return null;
  const normalized = raw.includes("T") ? raw : raw.replace(" ", "T");
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function isSameLocalDate(a, b){
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function comparePlanillaRowsByCurrentDateTime(a, b){
  const now = new Date();
  const aDate = parsePlanillaDateTime(a?.hora_llegada || a?.generado_en || a?.hora_despacho);
  const bDate = parsePlanillaDateTime(b?.hora_llegada || b?.generado_en || b?.hora_despacho);
  if (!aDate && !bDate) return 0;
  if (!aDate) return 1;
  if (!bDate) return -1;

  const aIsToday = isSameLocalDate(aDate, now);
  const bIsToday = isSameLocalDate(bDate, now);
  if (aIsToday !== bIsToday) return aIsToday ? -1 : 1;

  if (aIsToday && bIsToday) {
    const aDiff = Math.abs(aDate.getTime() - now.getTime());
    const bDiff = Math.abs(bDate.getTime() - now.getTime());
    if (aDiff !== bDiff) return aDiff - bDiff;
  }

  return bDate.getTime() - aDate.getTime();
}

function formatPlanillaDateTime(value){
  const date = parsePlanillaDateTime(value);
  if (!date) return formatPlanillaCell(value);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
}

function toIsoDateFromDateTime(value){
  const date = parsePlanillaDateTime(value);
  if (!date) return "";
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function getPlanillaUploadDateIso(row){
  return toIsoDateFromDateTime(row?.generado_en || row?.created_at || row?.hora_llegada || row?.hora_despacho);
}

function getPlanillaUploadDateText(row){
  return formatPlanillaDateTime(row?.generado_en || row?.created_at);
}

function hasValidDespacho(row){
  const raw = String(row?.hora_despacho ?? "").trim();
  return !!raw && raw !== "-";
}

function getDespachoDateTimeText(row){
  if (!hasValidDespacho(row)) return "-";
  return formatPlanillaDateTime(row?.hora_despacho);
}

function getOperacionEstadoText(row){
  if (hasValidDespacho(row)) return "Despachado";
  return "En espera";
}

function getDisplayItinerarioByEstado(row){
  const itinLlegada = formatPlanillaCell(row?.itinerario_llegada).trim();
  const itinDespacho = getItinerarioDespachoText(row);
  if (!hasValidDespacho(row)) {
    return itinLlegada || "-";
  }
  return itinDespacho || itinLlegada || "-";
}

function getItinerarioLlegadaText(row){
  const itin = formatPlanillaCell(row?.itinerario_llegada).trim();
  return itin || "-";
}

function getItinerarioDespachoText(row){
  const itin = formatPlanillaCell(row?.itinerario_despacho).trim();
  return itin || "-";
}

function getItinerarioLlegadaCellHtml(row){
  const itin = escapeHtml(getItinerarioLlegadaText(row));
  const itinColor = getItinerarioTextColorByRow(row);
  if (hasValidDespacho(row)) {
    return `<strong style="color:${itinColor}">${itin}</strong>`;
  }
  return `<strong style="color:${itinColor}">${itin}</strong> <span style="display:inline-block;margin-left:6px;padding:2px 8px;border:1px solid #fdba74;border-radius:999px;background:#fff7ed;color:#9a3412;font-size:12px;line-height:1.2" title="Vehiculo en espera por este itinerario de llegada">En espera</span>`;
}

function getItineraryGroupLabel(itinValue){
  const raw = String(itinValue || "").trim();
  if (!raw || raw === "-" || raw.toLowerCase() === "sin itinerario") {
    return "Proximos a despachar";
  }
  return raw;
}

function getItineraryThemeByRows(rowsInput, estadoMode){
  const mode = String(estadoMode || "").trim().toLowerCase();
  if (mode === "en_espera") return "espera";
  if (mode === "despachado") return "despachado";
  const rows = Array.isArray(rowsInput) ? rowsInput : [];
  if (!rows.length) return "mixed";
  const hasDesp = rows.some(r => hasValidDespacho(r));
  const hasEspera = rows.some(r => !hasValidDespacho(r));
  if (hasDesp && !hasEspera) return "despachado";
  if (!hasDesp && hasEspera) return "espera";
  return "mixed";
}

function getItineraryButtonStyle(theme, active){
  if (theme === "espera") {
    return active
      ? "background:#b45309;border-color:#b45309;color:#ffffff"
      : "background:#fff7ed;border-color:#fdba74;color:#9a3412";
  }
  if (theme === "despachado") {
    return active
      ? "background:#047857;border-color:#047857;color:#ffffff"
      : "background:#ecfdf5;border-color:#86efac;color:#065f46";
  }
  return "";
}

function getItinerarioTextColorByRow(row){
  return hasValidDespacho(row) ? "#065f46" : "#9a3412";
}

function normalizeItineraryKey(value){
  return String(value || "").trim().toLowerCase();
}

function getGroupingItineraryForRow(row, estadoMode){
  const mode = String(estadoMode || "").trim().toLowerCase();
  if (mode === "en_espera") {
    if (hasValidDespacho(row)) return getItinerarioDespachoText(row);
    return getItinerarioLlegadaText(row);
  }
  return getDisplayItinerarioByEstado(row);
}

function rowMatchesSelectedItinerary(row, selectedItinerary, estadoMode){
  const selectedKey = normalizeItineraryKey(selectedItinerary);
  if (!selectedKey) return false;
  const mode = String(estadoMode || "").trim().toLowerCase();
  if (mode === "en_espera") {
    if (hasValidDespacho(row)) {
      return normalizeItineraryKey(getItinerarioDespachoText(row)) === selectedKey;
    }
    return normalizeItineraryKey(getItinerarioLlegadaText(row)) === selectedKey;
  }
  return normalizeItineraryKey(getGroupingItineraryForRow(row, mode)) === selectedKey;
}

function getRowsFilteredByUploadDate(rowsInput, fromIso, toIso){
  const rows = Array.isArray(rowsInput) ? rowsInput : [];
  if (!fromIso && !toIso) return rows;
  return rows.filter(row => {
    const uploadIso = getPlanillaUploadDateIso(row);
    if (!uploadIso) return false;
    if (fromIso && uploadIso < fromIso) return false;
    if (toIso && uploadIso > toIso) return false;
    return true;
  });
}

function getRowsFilteredByEstado(rowsInput, estadoMode){
  const rows = Array.isArray(rowsInput) ? rowsInput : [];
  const mode = String(estadoMode || "").trim().toLowerCase();
  if (!mode) return rows;
  let filtered = rows.filter(row => {
    const isDespachado = hasValidDespacho(row);
    if (mode === "en_espera") return !isDespachado;
    if (mode === "despachado") return isDespachado;
    return true;
  });
  if (mode === "en_espera") {
    filtered = getRowsFilteredByEsperaOperationalDay(filtered);
  }
  return filtered;
}

function isSameLocalCalendarDate(a, b){
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function getRowsFilteredByEsperaOperationalDay(rowsInput){
  const rows = Array.isArray(rowsInput) ? rowsInput : [];
  if (!rows.length) return rows;
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  return rows.filter(row => {
    const date = parsePlanillaDateTime(row?.hora_llegada || row?.generado_en || row?.hora_despacho);
    if (!date) return false;

    if (isSameLocalCalendarDate(date, now)) return true;
    if (isSameLocalCalendarDate(date, yesterday) && date.getHours() >= 21) return true;
    return false;
  });
}

function getRowsFilteredBySearchTerm(rowsInput, searchTerm){
  const rows = Array.isArray(rowsInput) ? rowsInput : [];
  const term = String(searchTerm || "").trim().toLowerCase();
  if (!term) return rows;
  return rows.filter(row => {
    const tokens = [
      formatPlanillaDateTime(row?.hora_llegada),
      getPlanillaUploadDateText(row),
      formatTimeAgoEs(parsePlanillaDateTime(row?.hora_llegada || row?.generado_en || row?.hora_despacho)),
      formatPlanillaCell(row?.base),
      formatPlanillaCell(row?.interno),
      getItinerarioLlegadaText(row),
      getItinerarioDespachoText(row),
      getDespachoDateTimeText(row),
      getOperacionEstadoText(row),
      formatPlanillaCell(row?.conductor),
      formatPlanillaCell(row?.estado),
      mapTipoLlegada(row?.tipo_llegada)
    ];
    return tokens.join(" ").toLowerCase().includes(term);
  });
}

function getLlegadasRowsForView(tipoCode, options = {}){
  const searchTerm = String(options.searchTerm || "");
  const fromIso = String(options.fromIso || "").trim();
  const toIso = String(options.toIso || "").trim();
  const estadoMode = String(options.estadoMode || "");
  const hasExplicitFilters = !!searchTerm.trim() || !!fromIso || !!toIso || !!estadoMode;
  const rows = getLlegadasRowsByTipo(tipoCode, { preferToday: !hasExplicitFilters });
  const byEstado = getRowsFilteredByEstado(rows, estadoMode);
  const byDate = getRowsFilteredByUploadDate(byEstado, fromIso, toIso);
  return getRowsFilteredBySearchTerm(byDate, searchTerm);
}

function exportPlanillaRowsToExcel(rowsInput, mode, filePrefix){
  if (!window.XLSX) {
    showToast("No se pudo cargar XLSX para exportar.", "err");
    return;
  }
  const rows = Array.isArray(rowsInput) ? rowsInput : [];
  if (!rows.length) {
    showToast("No hay datos para exportar.", "warn");
    return;
  }
  const mapped = rows.map(row => {
    const base = {
      "Fecha subida": getPlanillaUploadDateText(row),
      "Tipo": mapTipoLlegada(row?.tipo_llegada),
      "Base": formatPlanillaCell(row?.base),
      "Interno": formatPlanillaCell(row?.interno),
      "Conductor": formatPlanillaCell(row?.conductor),
      "Estado": formatPlanillaCell(row?.estado),
      "Espera": formatPlanillaCell(row?.espera)
    };
    if (mode === "despachos") {
      return {
        "Hora despacho": formatPlanillaDateTime(row?.hora_despacho),
        "Itinerario despacho": formatPlanillaCell(row?.itinerario_despacho),
        ...base
      };
    }
    return {
      "Hora llegada": formatPlanillaDateTime(row?.hora_llegada),
      "Itinerario llegada": formatPlanillaCell(row?.itinerario_llegada),
      ...base
    };
  });
  const ws = XLSX.utils.json_to_sheet(mapped);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, mode === "despachos" ? "Despachos" : "Llegadas");
  const stamp = new Date();
  const y = stamp.getFullYear();
  const m = String(stamp.getMonth() + 1).padStart(2, "0");
  const d = String(stamp.getDate()).padStart(2, "0");
  const hh = String(stamp.getHours()).padStart(2, "0");
  const mi = String(stamp.getMinutes()).padStart(2, "0");
  XLSX.writeFile(wb, safeFileName(`${filePrefix}_${y}${m}${d}_${hh}${mi}.xlsx`));
}

function formatTimeAgoEs(dateInput){
  const date = dateInput instanceof Date ? dateInput : parsePlanillaDateTime(dateInput);
  if (!date) return "-";
  const diffMs = Date.now() - date.getTime();
  const mins = Math.max(0, Math.floor(diffMs / 60000));
  if (mins < 1) return "hace 0 min";
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  if (rem === 0) return `hace ${hours} h`;
  return `hace ${hours} h ${rem} min`;
}

function getHourBucketKey(value){
  const date = parsePlanillaDateTime(value);
  if (!date) return "";
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}`;
}

function getLlegadaRowPriorityTime(row){
  return parsePlanillaDateTime(
    row?.hora_despacho
    || row?.generado_en
    || row?.created_at
    || row?.hora_llegada
  );
}

function hasItinerarioDespacho(row){
  const txt = formatPlanillaCell(row?.itinerario_despacho).trim();
  return !!txt && txt !== "-";
}

function shouldPreferLlegadaRow(candidate, current){
  const currentHasDespacho = hasValidDespacho(current);
  const candidateHasDespacho = hasValidDespacho(candidate);
  if (candidateHasDespacho !== currentHasDespacho) return candidateHasDespacho;

  if (candidateHasDespacho && currentHasDespacho) {
    const currentHasItinDesp = hasItinerarioDespacho(current);
    const candidateHasItinDesp = hasItinerarioDespacho(candidate);
    if (candidateHasItinDesp !== currentHasItinDesp) return candidateHasItinDesp;
  }

  const currentTime = getLlegadaRowPriorityTime(current);
  const candidateTime = getLlegadaRowPriorityTime(candidate);
  if (!currentTime && !candidateTime) return false;
  if (!candidateTime) return false;
  if (!currentTime) return true;
  return candidateTime.getTime() > currentTime.getTime();
}

function dedupeLlegadasByHour(rowsInput){
  const rows = Array.isArray(rowsInput) ? rowsInput : [];
  const keyToIndex = new Map();
  const out = [];
  rows.forEach(row => {
    const hourKey = getHourBucketKey(row?.hora_llegada || row?.generado_en || row?.hora_despacho);
    const tipo = formatPlanillaCell(row?.tipo_llegada);
    const interno = formatPlanillaCell(row?.interno);
    const base = formatPlanillaCell(row?.base);
    const itin = formatPlanillaCell(row?.itinerario_llegada);
    const dedupeKey = `${hourKey}|${tipo}|${base}|${interno}|${itin}`;
    if (!hourKey) {
      out.push(row);
      return;
    }
    if (!keyToIndex.has(dedupeKey)) {
      keyToIndex.set(dedupeKey, out.length);
      out.push(row);
      return;
    }
    const idx = keyToIndex.get(dedupeKey);
    const current = out[idx];
    if (shouldPreferLlegadaRow(row, current)) {
      out[idx] = row;
    }
  });
  return out;
}

function getLlegadasRowsByTipo(tipoCode, options = {}){
  const preferToday = options.preferToday !== false;
  const allRows = Array.isArray(planillaAfiliadosRows) ? planillaAfiliadosRows : [];
  const rowsFiltered = allRows.filter(r => String(r?.tipo_llegada ?? "").trim() === String(tipoCode));
  let source = rowsFiltered;
  if (preferToday) {
    const now = new Date();
    const todayRows = rowsFiltered.filter(r => {
      const date = parsePlanillaDateTime(r?.hora_llegada || r?.generado_en || r?.hora_despacho);
      return !!date && isSameLocalDate(date, now);
    });
    source = todayRows.length > 0 ? todayRows : rowsFiltered;
  }
  const sorted = source
    .slice()
    .sort((a, b) => {
      const da = parsePlanillaDateTime(a?.hora_llegada || a?.generado_en || a?.hora_despacho);
      const db = parsePlanillaDateTime(b?.hora_llegada || b?.generado_en || b?.hora_despacho);
      if (!da && !db) return 0;
      if (!da) return 1;
      if (!db) return -1;
      return db.getTime() - da.getTime();
    });
  return dedupeLlegadasByHour(sorted);
}

function renderLlegadasAeropuerto(){
  if (!llegadasAeropuertoBody) return;
  const estadoMode = aeropuertoEstadoFilter?.value || "";
  const rowsSource = getLlegadasRowsForView("104", {
    searchTerm: aeropuertoSearch?.value || "",
    estadoMode: estadoMode === "en_espera" ? "" : estadoMode,
    fromIso: aeropuertoUploadFrom?.value || "",
    toIso: aeropuertoUploadTo?.value || ""
  });
  const rows = estadoMode === "en_espera"
    ? getRowsFilteredByEsperaOperationalDay(rowsSource)
    : rowsSource;
  lastAeropuertoRenderedRows = rows.slice();
  if (llegadasAeropuertoCount) llegadasAeropuertoCount.textContent = String(rows.length);
  if (llegadasAeropuertoTitle) llegadasAeropuertoTitle.textContent = "Ultimas Llegadas Aeropuerto (104)";
  if (rows.length === 0) {
    if (llegadasAeropuertoTabs) llegadasAeropuertoTabs.innerHTML = "";
    llegadasAeropuertoBody.innerHTML = `<tr><td colspan="8" class="muted" style="text-align:center;padding:12px">Sin llegadas de aeropuerto.</td></tr>`;
    return;
  }
  const grouped = new Map();
  rows.forEach(row => {
    const itin = getGroupingItineraryForRow(row, estadoMode);
    if (!grouped.has(itin)) grouped.set(itin, []);
    grouped.get(itin).push(row);
  });

  const itineraries = Array.from(grouped.keys()).sort((a, b) => a.localeCompare(b, "es"));
  if (!aeropuertoSelectedItinerary || !grouped.has(aeropuertoSelectedItinerary)) {
    aeropuertoSelectedItinerary = itineraries[0];
  }
  if (llegadasAeropuertoTabs) {
    llegadasAeropuertoTabs.innerHTML = itineraries.map(itin => {
      const active = itin === aeropuertoSelectedItinerary;
      const count = grouped.get(itin)?.length || 0;
      const cls = active ? "btn btn-primary" : "btn btn-ghost";
      const theme = getItineraryThemeByRows(grouped.get(itin), estadoMode);
      const style = getItineraryButtonStyle(theme, active);
      const label = getItineraryGroupLabel(itin);
      return `<button type="button" class="${cls}" style="${style}" data-aep-itin="${escapeHtml(itin)}">${escapeHtml(label)} (${count})</button>`;
    }).join("");
    llegadasAeropuertoTabs.querySelectorAll("[data-aep-itin]").forEach(btn => {
      btn.addEventListener("click", () => {
        aeropuertoSelectedItinerary = btn.getAttribute("data-aep-itin") || "";
        renderLlegadasAeropuerto();
      });
    });
  }

  const selectedRows = rows.filter(row => rowMatchesSelectedItinerary(row, aeropuertoSelectedItinerary, estadoMode));
  lastAeropuertoRenderedRows = selectedRows.slice();
  if (selectedRows.length === 0) {
    llegadasAeropuertoBody.innerHTML = `<tr><td colspan="8" class="muted" style="text-align:center;padding:12px">Sin datos para el itinerario seleccionado.</td></tr>`;
    return;
  }
  llegadasAeropuertoBody.innerHTML = selectedRows.map(row => {
    const date = parsePlanillaDateTime(row?.hora_llegada || row?.generado_en || row?.hora_despacho);
    const horaTxt = formatPlanillaDateTime(row?.hora_llegada || row?.generado_en || row?.hora_despacho);
    const despachoTxt = getDespachoDateTimeText(row);
    const operacionTxt = getOperacionEstadoText(row);
    const haceTxt = formatTimeAgoEs(date);
    const baseTxt = formatPlanillaCell(row?.base);
    const internoTxt = formatPlanillaCell(row?.interno);
    const itinLlegadaHtml = getItinerarioLlegadaCellHtml(row);
    const itinDespachoTxt = getItinerarioDespachoText(row);
    return `<tr>
      <td>${escapeHtml(horaTxt)}</td>
      <td>${escapeHtml(despachoTxt)}</td>
      <td><strong style="color:${operacionTxt === "Despachado" ? "#065f46" : "#b45309"}">${escapeHtml(operacionTxt)}</strong></td>
      <td><strong style="color:#1d4ed8">${escapeHtml(haceTxt)}</strong></td>
      <td>${escapeHtml(baseTxt)}</td>
      <td><strong style="color:#065f46">${escapeHtml(internoTxt)}</strong></td>
      <td>${itinLlegadaHtml}</td>
      <td><strong>${escapeHtml(itinDespachoTxt)}</strong></td>
    </tr>`;
  }).join("");
}

function renderLlegadasSanDiego(){
  if (!llegadasSanDiegoBody) return;
  const estadoMode = sanDiegoEstadoFilter?.value || "";
  const rowsSource = getLlegadasRowsForView("101", {
    searchTerm: sanDiegoSearch?.value || "",
    estadoMode: estadoMode === "en_espera" ? "" : estadoMode,
    fromIso: sanDiegoUploadFrom?.value || "",
    toIso: sanDiegoUploadTo?.value || ""
  });
  const rows = estadoMode === "en_espera"
    ? getRowsFilteredByEsperaOperationalDay(rowsSource)
    : rowsSource;
  lastSanDiegoRenderedRows = rows.slice();
  if (llegadasSanDiegoCount) llegadasSanDiegoCount.textContent = String(rows.length);
  if (llegadasSanDiegoTitle) llegadasSanDiegoTitle.textContent = "Ultimas Llegadas San Diego (101)";
  if (rows.length === 0) {
    if (llegadasSanDiegoTabs) llegadasSanDiegoTabs.innerHTML = "";
    llegadasSanDiegoBody.innerHTML = `<tr><td colspan="8" class="muted" style="text-align:center;padding:12px">Sin llegadas de San Diego.</td></tr>`;
    return;
  }

  const grouped = new Map();
  rows.forEach(row => {
    const itin = getGroupingItineraryForRow(row, estadoMode);
    if (!grouped.has(itin)) grouped.set(itin, []);
    grouped.get(itin).push(row);
  });

  const itineraries = Array.from(grouped.keys()).sort((a, b) => a.localeCompare(b, "es"));
  if (!sanDiegoSelectedItinerary || !grouped.has(sanDiegoSelectedItinerary)) {
    sanDiegoSelectedItinerary = itineraries[0];
  }

  if (llegadasSanDiegoTabs) {
    llegadasSanDiegoTabs.innerHTML = itineraries.map(itin => {
      const active = itin === sanDiegoSelectedItinerary;
      const count = grouped.get(itin)?.length || 0;
      const cls = active ? "btn btn-primary" : "btn btn-ghost";
      const theme = getItineraryThemeByRows(grouped.get(itin), estadoMode);
      const style = getItineraryButtonStyle(theme, active);
      const label = getItineraryGroupLabel(itin);
      return `<button type="button" class="${cls}" style="${style}" data-sd-itin="${escapeHtml(itin)}">${escapeHtml(label)} (${count})</button>`;
    }).join("");
    llegadasSanDiegoTabs.querySelectorAll("[data-sd-itin]").forEach(btn => {
      btn.addEventListener("click", () => {
        sanDiegoSelectedItinerary = btn.getAttribute("data-sd-itin") || "";
        renderLlegadasSanDiego();
      });
    });
  }

  const selectedRows = rows.filter(row => rowMatchesSelectedItinerary(row, sanDiegoSelectedItinerary, estadoMode));
  lastSanDiegoRenderedRows = selectedRows.slice();
  if (selectedRows.length === 0) {
    llegadasSanDiegoBody.innerHTML = `<tr><td colspan="8" class="muted" style="text-align:center;padding:12px">Sin datos para el itinerario seleccionado.</td></tr>`;
    return;
  }
  llegadasSanDiegoBody.innerHTML = selectedRows.map(row => {
    const date = parsePlanillaDateTime(row?.hora_llegada || row?.generado_en || row?.hora_despacho);
    const horaTxt = formatPlanillaDateTime(row?.hora_llegada || row?.generado_en || row?.hora_despacho);
    const despachoTxt = getDespachoDateTimeText(row);
    const operacionTxt = getOperacionEstadoText(row);
    const haceTxt = formatTimeAgoEs(date);
    const baseTxt = formatPlanillaCell(row?.base);
    const internoTxt = formatPlanillaCell(row?.interno);
    const itinLlegadaHtml = getItinerarioLlegadaCellHtml(row);
    const itinDespachoTxt = getItinerarioDespachoText(row);
    return `<tr>
      <td>${escapeHtml(horaTxt)}</td>
      <td>${escapeHtml(despachoTxt)}</td>
      <td><strong style="color:${operacionTxt === "Despachado" ? "#065f46" : "#b45309"}">${escapeHtml(operacionTxt)}</strong></td>
      <td><strong style="color:#1d4ed8">${escapeHtml(haceTxt)}</strong></td>
      <td>${escapeHtml(baseTxt)}</td>
      <td><strong style="color:#065f46">${escapeHtml(internoTxt)}</strong></td>
      <td>${itinLlegadaHtml}</td>
      <td><strong>${escapeHtml(itinDespachoTxt)}</strong></td>
    </tr>`;
  }).join("");
}

function renderLlegadasNutibara(){
  if (!llegadasNutibaraBody) return;
  const estadoMode = nutibaraEstadoFilter?.value || "";
  const rowsSource = getLlegadasRowsForView("110", {
    searchTerm: nutibaraSearch?.value || "",
    estadoMode: estadoMode === "en_espera" ? "" : estadoMode,
    fromIso: nutibaraUploadFrom?.value || "",
    toIso: nutibaraUploadTo?.value || ""
  });
  const rows = estadoMode === "en_espera"
    ? getRowsFilteredByEsperaOperationalDay(rowsSource)
    : rowsSource;
  lastNutibaraRenderedRows = rows.slice();
  if (llegadasNutibaraCount) llegadasNutibaraCount.textContent = String(rows.length);
  if (llegadasNutibaraTitle) llegadasNutibaraTitle.textContent = "Ultimas Llegadas Nutibara (110)";
  if (rows.length === 0) {
    if (llegadasNutibaraTabs) llegadasNutibaraTabs.innerHTML = "";
    llegadasNutibaraBody.innerHTML = `<tr><td colspan="8" class="muted" style="text-align:center;padding:12px">Sin llegadas de Nutibara.</td></tr>`;
    return;
  }
  const grouped = new Map();
  rows.forEach(row => {
    const itin = getGroupingItineraryForRow(row, estadoMode);
    if (!grouped.has(itin)) grouped.set(itin, []);
    grouped.get(itin).push(row);
  });

  const itineraries = Array.from(grouped.keys()).sort((a, b) => a.localeCompare(b, "es"));
  if (!nutibaraSelectedItinerary || !grouped.has(nutibaraSelectedItinerary)) {
    nutibaraSelectedItinerary = itineraries[0];
  }
  if (llegadasNutibaraTabs) {
    llegadasNutibaraTabs.innerHTML = itineraries.map(itin => {
      const active = itin === nutibaraSelectedItinerary;
      const count = grouped.get(itin)?.length || 0;
      const cls = active ? "btn btn-primary" : "btn btn-ghost";
      const theme = getItineraryThemeByRows(grouped.get(itin), estadoMode);
      const style = getItineraryButtonStyle(theme, active);
      const label = getItineraryGroupLabel(itin);
      return `<button type="button" class="${cls}" style="${style}" data-nut-itin="${escapeHtml(itin)}">${escapeHtml(label)} (${count})</button>`;
    }).join("");
    llegadasNutibaraTabs.querySelectorAll("[data-nut-itin]").forEach(btn => {
      btn.addEventListener("click", () => {
        nutibaraSelectedItinerary = btn.getAttribute("data-nut-itin") || "";
        renderLlegadasNutibara();
      });
    });
  }

  const selectedRows = rows.filter(row => rowMatchesSelectedItinerary(row, nutibaraSelectedItinerary, estadoMode));
  lastNutibaraRenderedRows = selectedRows.slice();
  if (selectedRows.length === 0) {
    llegadasNutibaraBody.innerHTML = `<tr><td colspan="8" class="muted" style="text-align:center;padding:12px">Sin datos para el itinerario seleccionado.</td></tr>`;
    return;
  }
  llegadasNutibaraBody.innerHTML = selectedRows.map(row => {
    const date = parsePlanillaDateTime(row?.hora_llegada || row?.generado_en || row?.hora_despacho);
    const horaTxt = formatPlanillaDateTime(row?.hora_llegada || row?.generado_en || row?.hora_despacho);
    const despachoTxt = getDespachoDateTimeText(row);
    const operacionTxt = getOperacionEstadoText(row);
    const haceTxt = formatTimeAgoEs(date);
    const baseTxt = formatPlanillaCell(row?.base);
    const internoTxt = formatPlanillaCell(row?.interno);
    const itinLlegadaHtml = getItinerarioLlegadaCellHtml(row);
    const itinDespachoTxt = getItinerarioDespachoText(row);
    return `<tr>
      <td>${escapeHtml(horaTxt)}</td>
      <td>${escapeHtml(despachoTxt)}</td>
      <td><strong style="color:${operacionTxt === "Despachado" ? "#065f46" : "#b45309"}">${escapeHtml(operacionTxt)}</strong></td>
      <td><strong style="color:#1d4ed8">${escapeHtml(haceTxt)}</strong></td>
      <td>${escapeHtml(baseTxt)}</td>
      <td><strong style="color:#065f46">${escapeHtml(internoTxt)}</strong></td>
      <td>${itinLlegadaHtml}</td>
      <td><strong>${escapeHtml(itinDespachoTxt)}</strong></td>
    </tr>`;
  }).join("");
}

function renderPlanillaAfiliados(){
  if (!planillaHead || !planillaBody) return;
  const filtered = getPlanillaFilteredRows(planillaAfiliadosRows);

  if (planillaCount) planillaCount.textContent = String(filtered.length);

  planillaHead.innerHTML = `<tr>${PLANILLA_VIEW_COLUMNS.map(c => `<th>${escapeHtml(c.title)}</th>`).join("")}</tr>`;
  if (filtered.length === 0) {
    planillaBody.innerHTML = `<tr><td colspan="${PLANILLA_VIEW_COLUMNS.length}" class="muted" style="text-align:center;padding:12px">No hay coincidencias.</td></tr>`;
    return;
  }

  planillaBody.innerHTML = filtered.map(row => {
    const cells = PLANILLA_VIEW_COLUMNS.map(col => `<td>${escapeHtml(formatPlanillaCell(col.value(row)))}</td>`).join("");
    return `<tr>${cells}</tr>`;
  }).join("");
}

function getFilteredPlanillaRowsForExport(){
  return getPlanillaFilteredRows(planillaAfiliadosRows);
}

function handleDownloadLlegadas(){
  const filtered = getFilteredPlanillaRowsForExport();
  const onlyLlegadas = filtered.filter(row => !!String(row?.hora_llegada || "").trim());
  exportPlanillaRowsToExcel(onlyLlegadas, "llegadas", "llegadas_planilla");
}

function handleDownloadDespachos(){
  const filtered = getFilteredPlanillaRowsForExport();
  const onlyDespachos = filtered.filter(row => !!String(row?.hora_despacho || "").trim());
  exportPlanillaRowsToExcel(onlyDespachos, "despachos", "despachos_planilla");
}

function handleDownloadLlegadasAeropuerto(){
  exportPlanillaRowsToExcel(lastAeropuertoRenderedRows, "llegadas", "llegadas_aeropuerto");
}

function handleDownloadLlegadasSanDiego(){
  exportPlanillaRowsToExcel(lastSanDiegoRenderedRows, "llegadas", "llegadas_san_diego");
}

function handleDownloadLlegadasNutibara(){
  exportPlanillaRowsToExcel(lastNutibaraRenderedRows, "llegadas", "llegadas_nutibara");
}

function getActiveTabId(){
  return document.querySelector(".tab.active")?.getAttribute("data-tab") || "";
}

function isPlanillaRelatedTab(tabId){
  const id = String(tabId || "");
  return id === "planilla-afiliados"
    || id === "llegadas-aeropuerto"
    || id === "llegadas-san-diego"
    || id === "llegadas-nutibara";
}

async function ensureFreshPlanillaData(options = {}){
  const force = !!options.force;
  const maxAgeMs = Number(options.maxAgeMs || PLANILLA_REFRESH_MAX_AGE_MS);
  const stale = !planillaAfiliadosLoadedOnce || !planillaLastLoadedAt || ((Date.now() - planillaLastLoadedAt) > maxAgeMs);
  if (force || stale) {
    await loadPlanillaAfiliadosFromSupabase();
    return;
  }
  renderPlanillaAfiliados();
  renderLlegadasAeropuerto();
  renderLlegadasSanDiego();
  renderLlegadasNutibara();
}

async function loadPlanillaAfiliadosFromSupabase(){
  if (planillaAfiliadosLoading) return;
  if (!currentUserId) return;
  planillaAfiliadosLoading = true;
  if (planillaStatus) planillaStatus.textContent = "Consultando Supabase...";
  try {
    const { data, error } = await planillaSupabaseClient
      .from(PLANILLA_TABLE_NAME)
      .select(PLANILLA_SELECT_COLUMNS)
      .order("hora_llegada", { ascending: false, nullsFirst: false })
      .limit(PLANILLA_FETCH_LIMIT);
    if (error) throw error;
    planillaAfiliadosRows = Array.isArray(data) ? data : [];
    planillaAfiliadosLoadedOnce = true;
    planillaLastLoadedAt = Date.now();
    renderPlanillaAfiliados();
    renderLlegadasAeropuerto();
    renderLlegadasSanDiego();
    renderLlegadasNutibara();
    if (planillaStatus) {
      const stamp = new Date().toLocaleString("es-CO");
      planillaStatus.textContent = `Actualizado: ${stamp}`;
    }
    if (llegadasAeropuertoStatus) {
      const stamp2 = new Date().toLocaleString("es-CO");
      llegadasAeropuertoStatus.textContent = `Actualizado: ${stamp2}`;
    }
    if (llegadasSanDiegoStatus) {
      const stampSd = new Date().toLocaleString("es-CO");
      llegadasSanDiegoStatus.textContent = `Actualizado: ${stampSd}`;
    }
    if (llegadasNutibaraStatus) {
      const stamp3 = new Date().toLocaleString("es-CO");
      llegadasNutibaraStatus.textContent = `Actualizado: ${stamp3}`;
    }
  } catch (error) {
    console.error(`Error cargando ${PLANILLA_TABLE_NAME}:`, error);
    if (planillaStatus) planillaStatus.textContent = `Error: ${error?.message || "consulta fallida"}`;
    if (llegadasAeropuertoStatus) llegadasAeropuertoStatus.textContent = `Error: ${error?.message || "consulta fallida"}`;
    if (llegadasSanDiegoStatus) llegadasSanDiegoStatus.textContent = `Error: ${error?.message || "consulta fallida"}`;
    if (llegadasNutibaraStatus) llegadasNutibaraStatus.textContent = `Error: ${error?.message || "consulta fallida"}`;
    showToast(`No se pudo cargar ${PLANILLA_TABLE_NAME} desde Supabase.`, "err");
  } finally {
    planillaAfiliadosLoading = false;
  }
}

function summarizeAuditChange(row){
  if (!row) return "-";
  if (row.operation === "INSERT") return "Creado";
  if (row.operation === "DELETE") return "Eliminado";
  const oldObj = row.old_data && typeof row.old_data === "object" ? row.old_data : {};
  const newObj = row.new_data && typeof row.new_data === "object" ? row.new_data : {};
  const allKeys = Array.from(new Set([...Object.keys(oldObj), ...Object.keys(newObj)]));
  const changed = allKeys.filter(k => JSON.stringify(oldObj[k]) !== JSON.stringify(newObj[k]));
  if (changed.length === 0) return "Sin cambios detectados";
  return `Campos: ${changed.slice(0, 4).join(", ")}${changed.length > 4 ? "..." : ""}`;
}

function renderAuditLog(){
  if (!auditBody) return;
  if (AUDIT_DISABLED) {
    auditBody.innerHTML = `<tr><td colspan="6" class="muted" style="text-align:center;padding:14px">Auditoria deshabilitada.</td></tr>`;
    if (auditCount) auditCount.textContent = "0";
    return;
  }
  const userText = String(auditUserFilter?.value || "").trim().toLowerCase();
  const tableValue = String(auditTableFilter?.value || "");
  const opValue = String(auditOpFilter?.value || "");
  const fromValue = normalizeDateToISO(auditFrom?.value || "");
  const toValue = normalizeDateToISO(auditTo?.value || "");

  const filtered = (auditLogRows || []).filter(r => {
    if (tableValue && String(r.table_name || "") !== tableValue) return false;
    if (opValue && String(r.operation || "") !== opValue) return false;
    if (userText && !String(r.changed_email || "").toLowerCase().includes(userText)) return false;
    const changedDate = normalizeDateToISO(String(r.changed_at || "").slice(0, 10));
    if (fromValue && changedDate && changedDate < fromValue) return false;
    if (toValue && changedDate && changedDate > toValue) return false;
    return true;
  });

  if (auditCount) auditCount.textContent = String(filtered.length);
  if (filtered.length === 0) {
    auditBody.innerHTML = `<tr><td colspan="6" class="muted" style="text-align:center;padding:14px">Sin eventos para los filtros seleccionados.</td></tr>`;
    return;
  }

  auditBody.innerHTML = "";
  filtered.forEach(r => {
    const tr = document.createElement("tr");
    const changedAt = r.changed_at ? new Date(r.changed_at).toLocaleString("es-CO") : "-";
    const user = r.changed_email || r.changed_by || "-";
    const rowPk = r.row_pk || "-";
    const change = summarizeAuditChange(r);
    tr.innerHTML = `
      <td>${escapeHtml(changedAt)}</td>
      <td>${escapeHtml(user)}</td>
      <td>${escapeHtml(r.table_name || "-")}</td>
      <td>${escapeHtml(r.operation || "-")}</td>
      <td><span class="muted">${escapeHtml(rowPk)}</span></td>
      <td>${escapeHtml(change)}</td>
    `;
    auditBody.appendChild(tr);
  });
}

async function loadAuditLogFromSupabase(options = {}){
  const silent = !!options.silent;
  if (!auditBody) return;
  if (AUDIT_DISABLED) {
    auditLogRows = [];
    auditBody.innerHTML = `<tr><td colspan="6" class="muted" style="text-align:center;padding:14px">Auditoria deshabilitada.</td></tr>`;
    if (auditCount) auditCount.textContent = "0";
    return;
  }
  if (!isSuperAdmin()) {
    auditBody.innerHTML = `<tr><td colspan="6" class="muted" style="text-align:center;padding:14px">Solo el administrador puede ver auditoria.</td></tr>`;
    if (auditCount) auditCount.textContent = "0";
    return;
  }
  auditBody.innerHTML = `<tr><td colspan="6" class="muted" style="text-align:center;padding:14px">Consultando auditoria...</td></tr>`;

  const { data, error } = await supabaseClient
    .from("audit_log")
    .select("id, table_name, operation, row_pk, changed_by, changed_email, changed_at, old_data, new_data")
    .order("changed_at", { ascending: false })
    .limit(1000);

  if (error) {
    auditBody.innerHTML = `<tr><td colspan="6" class="muted" style="text-align:center;padding:14px">Error cargando auditoria: ${escapeHtml(error.message || "sin detalle")}</td></tr>`;
    if (auditCount) auditCount.textContent = "0";
    return;
  }
  auditLogRows = data || [];
  renderAuditLog();
  if (!silent) showToast(`Auditoria cargada: ${auditLogRows.length}`, "ok");
}

const VEHICLE_TO_BASE_MAP = {
  "703":"BASE 4","705":"BASE 4","707":"BASE 4","708":"BASE 5","709":"BASE 3",
  "714":"BASE 3","715":"BASE 4","710":"BASE 3","717":"BASE 4","718":"BASE 3",
  "719":"BASE 2","720":"BASE 3","721":"BASE 4","722":"BASE 3","723":"BASE 3",
  "724":"BASE 3","725":"BASE 4","726":"BASE 3","727":"BASE 3","728":"BASE 4",
  "729":"BASE 1","730":"BASE 1","731":"BASE 4","732":"BASE 1","733":"BASE 5",
  "734":"BASE 3","735":"BASE 4","736":"BASE 8","737":"BASE 3","738":"BASE 3",
  "739":"BASE 3","740":"BASE 3","741":"BASE 3","742":"BASE 3","743":"BASE 3",
  "744":"BASE 3","745":"BASE 3","746":"BASE 4","747":"BASE 5","748":"BASE 2",
  "749":"BASE 2","750":"BASE 3","751":"BASE 3","752":"BASE 3","753":"BASE 3",
  "754":"BASE 3","755":"BASE 3","756":"BASE 8","757":"BASE 5","758":"BASE 3",
  "759":"BASE 6","15":"BASE 5","17":"BASE 3","59":"BASE 5","64":"BASE 5",
  "89":"BASE 5","100":"BASE 5","157":"BASE 5","163":"BASE 5","211":"BASE 5",
  "232":"BASE 5","507":"BASE 3","510":"BASE 3"
};

function normalizeVehicleId(value){
  const raw = String(value ?? "").trim();
  const digits = raw.replace(/\D/g, "");
  return digits || raw.toUpperCase();
}

function getVehiculoKey(rowObj){
  const keys = Object.keys(rowObj || {});
  return keys.find(k => {
    const n = norm(k);
    return n === "VEH" || n === "VEHICULO" || n === "VEHÍCULO" || n === "MOVIL" || n === "MÓVIL";
  }) || null;
}

function getRowCanonicalBase(rowObj, explicitBaseKey = null){
  const row = rowObj || {};
  const keys = Object.keys(row);
  const baseKey = explicitBaseKey || keys.find(k => BASE_COLUMN_ALIASES.includes(norm(k))) || null;
  const directBase = baseKey ? getBaseCanonical(row[baseKey]) : "";
  if (directBase) return directBase;

  const vehKey = getVehiculoKey(row);
  if (!vehKey) return "";
  const vehicleId = normalizeVehicleId(row[vehKey]);
  const inferred = VEHICLE_TO_BASE_MAP[vehicleId] || "";
  return getBaseCanonical(inferred);
}

function normalizeProgramacionRows(inputRows){
  const source = Array.isArray(inputRows) ? inputRows : [];
  let unmappedVehicles = 0;
  const normalized = source.map(raw => {
    const r = { ...raw };
    const fechaKey = Object.keys(r).find(k => norm(k) === "FECHA");
    if(fechaKey && r[fechaKey] !== undefined && r[fechaKey] !== null && r[fechaKey] !== "") {
      r[fechaKey] = normalizeDateToISO(r[fechaKey]);
    }

    const baseKey = Object.keys(r).find(k => BASE_COLUMN_ALIASES.includes(norm(k)));
    const vehiculoKey = getVehiculoKey(r);
    if (vehiculoKey) {
      const vehicleId = normalizeVehicleId(r[vehiculoKey]);
      const inferredBase = VEHICLE_TO_BASE_MAP[vehicleId] || "";
      if (inferredBase) {
        r.BASE = inferredBase;
      } else if (vehicleId) {
        unmappedVehicles++;
      }
    }
    return r;
  });
  return { normalized, unmappedVehicles };
}

function excelDateToISO(serial){
  if(serial === null || serial === undefined) return serial;
  if(typeof serial === "string" && serial.includes("-")) return serial;
  if(isNaN(serial)) return serial;
  const utc_days = Math.floor(serial - 25569);
  const utc_value = utc_days * 86400;
  const date_info = new Date(utc_value * 1000);
  const d = date_info.getUTCDate().toString().padStart(2,'0');
  const m = (date_info.getUTCMonth()+1).toString().padStart(2,'0');
  const y = date_info.getUTCFullYear();
  return `${y}-${m}-${d}`;
}

function normalizeDateToISO(value){
  if (value === null || value === undefined) return value;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getFullYear();
    const mo = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${mo}-${d}`;
  }
  if (typeof value === "number" && !isNaN(value)) return excelDateToISO(value);
  const raw = String(value).trim();
  if (!raw) return raw;
  if (/^\d+(\.\d+)?$/.test(raw)) {
    const asNum = Number(raw);
    if (!Number.isNaN(asNum)) return excelDateToISO(asNum);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  let m = raw.match(/^(\d{4}-\d{1,2}-\d{1,2})(?:[T\s].*)$/);
  if (m) {
    const isoPart = normalizeDateToISO(m[1]);
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(isoPart || ""))) return isoPart;
  }
  m = raw.match(/^(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})(?:[T\s].*)$/);
  if (m) {
    const datePart = normalizeDateToISO(m[1]);
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(datePart || ""))) return datePart;
  }
  m = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) {
    let p1 = parseInt(m[1], 10);
    let p2 = parseInt(m[2], 10);
    if (Number.isNaN(p1) || Number.isNaN(p2)) return raw;

    // Acepta ambos formatos: dd/mm/yyyy y mm/dd/yyyy.
    // Reglas:
    // - si p1 > 12, es dia/mes
    // - si p2 > 12, es mes/dia
    // - si ambos <= 12, se mantiene dia/mes por defecto local
    let d = p1;
    let mo = p2;
    if (p1 <= 12 && p2 > 12) {
      d = p2;
      mo = p1;
    }

    if (mo < 1 || mo > 12 || d < 1 || d > 31) return raw;
    const y = m[3];
    return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  m = raw.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (m) {
    const y = m[1];
    const mo = m[2].padStart(2, "0");
    const d = m[3].padStart(2, "0");
    return `${y}-${mo}-${d}`;
  }
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const mo = String(parsed.getMonth() + 1).padStart(2, "0");
    const d = String(parsed.getDate()).padStart(2, "0");
    return `${y}-${mo}-${d}`;
  }
  return raw;
}

function excelDateToReadable(iso){
  if(typeof iso!=='string'||!iso.includes('-')) return iso;
  const [y,m,d]=iso.split('-');
  return `${d}/${m}/${y}`;
}

function excelTimeToHHMM(value){
  if(value === null || value === undefined || value === "") return "";
  if(typeof value === "string"){
    const raw = value.trim();
    const m = raw.match(/^(\d{1,2}):(\d{1,2})$/);
    if (!m) return raw;
    let hh = parseInt(m[1], 10);
    let mm = parseInt(m[2], 10);
    if (Number.isNaN(hh) || Number.isNaN(mm)) return raw;
    if (mm < 0 || mm > 59) return raw;
    if (hh >= 24) hh = hh % 24;
    if (hh < 0) hh = 0;
    return `${String(hh).padStart(2,"0")}:${String(mm).padStart(2,"0")}`;
  }
  if(typeof value !== "number") return value;
  const fraction = value % 1;
  let totalMins = Math.round(fraction * 24 * 60);
  let hh = Math.floor(totalMins / 60) % 24;
  let mm = totalMins % 60;
  return `${hh.toString().padStart(2,"0")}:${mm.toString().padStart(2,"0")}`;
}

function getHeaderKeyByNorm(aliases){
  if(rows.length===0) return null;
  const headerSet = new Set();
  rows.slice(0, 200).forEach(r => Object.keys(r || {}).forEach(k => headerSet.add(k)));
  const keys = Array.from(headerSet);
  return keys.find(k => aliases.includes(norm(k))) || null;
}

function formatDateLongEs(value){
  const iso = normalizeDateToISO(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso || ""))) return excelDateToReadable(iso);
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const formatted = dt.toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  return formatted.toUpperCase().replace(/ DE /g, " DE ");
}

function getBaseKey(){
  if(rows.length===0) return null;
  const headerSet = new Set();
  rows.slice(0, 200).forEach(r => Object.keys(r || {}).forEach(k => headerSet.add(k)));
  const keys = Array.from(headerSet);
  const baseKeyExact = keys.find(k => norm(k) === "BASE");
  if (baseKeyExact) {
    const hasData = rows.slice(0, 500).some(r => String((r && r[baseKeyExact]) ?? "").trim());
    if (hasData) return baseKeyExact;
  }
  const aliases = new Set(BASE_COLUMN_ALIASES.filter(a => a !== "BASE"));
  const candidates = keys.filter(k => aliases.has(norm(k)));
  if (candidates.length === 0) return null;
  const score = (key) => rows.slice(0, 500).reduce((acc, r) => {
    const v = String((r && r[key]) ?? "").trim();
    return acc + (v ? 1 : 0);
  }, 0);
  candidates.sort((a, b) => score(b) - score(a));
  return candidates[0];
}

function getFechaKey(){
  if(rows.length===0) return null;
  const headerSet = new Set();
  rows.slice(0, 200).forEach(r => Object.keys(r || {}).forEach(k => headerSet.add(k)));
  const keys = Array.from(headerSet);
  return keys.find(k => norm(k) === "FECHA") || null;
}

function getFechaKeyFromArray(inputRows){
  if(!Array.isArray(inputRows) || inputRows.length === 0) return null;
  const keySet = new Set();
  inputRows.slice(0, 200).forEach(r => Object.keys(r || {}).forEach(k => keySet.add(k)));
  const keys = Array.from(keySet);
  return keys.find(k => norm(k) === "FECHA") || null;
}

function getRowDateISO(rowObj, preferredFechaKey = null){
  const row = rowObj || {};
  const keys = Object.keys(row);
  const fechaKey = (preferredFechaKey && keys.includes(preferredFechaKey))
    ? preferredFechaKey
    : (keys.find(k => norm(k) === "FECHA") || null);
  if (!fechaKey) return "";
  const iso = normalizeDateToISO(row[fechaKey]);
  return /^\d{4}-\d{2}-\d{2}$/.test(String(iso || "")) ? iso : "";
}

function partitionRowsByDate(inputRows, targetIso, preferredFechaKey = null){
  const target = normalizeDateToISO(targetIso);
  const selected = [];
  const rest = [];
  (Array.isArray(inputRows) ? inputRows : []).forEach(r => {
    const rowIso = getRowDateISO(r, preferredFechaKey);
    if (rowIso && rowIso === target) selected.push(r);
    else rest.push(r);
  });
  return { selected, rest };
}

function getSelectedOperativeDateISO(){
  return normalizeDateToISO(document.getElementById("filterDate")?.value || "");
}

function isFichoRowByContent(rowObj){
  const row = rowObj || {};
  const keys = Object.keys(row);
  const findByNorm = (aliases) => keys.find(k => aliases.includes(norm(k))) || null;
  const puestoKey = findByNorm(["PUESTO"]);
  const numeroKey = findByNorm(["#"]);
  const baseKey = findByNorm(BASE_COLUMN_ALIASES);
  const rowContext = `${norm(puestoKey ? row[puestoKey] : "")} ${norm(numeroKey ? row[numeroKey] : "")} ${norm(baseKey ? row[baseKey] : "")}`;
  return rowContext.includes("FICHO");
}

function getDateAssignmentStatsForBase(dateIso, baseValue = currentBase){
  const fechaKey = getFechaKey();
  const baseKey = getBaseKey();
  const { key1, key2 } = getConductorKeysFromRows();
  const canonicalBase = getBaseCanonical(baseValue);
  let requiredSlots = 0;
  let filledSlots = 0;

  if (!fechaKey || (!key1 && !key2) || !canonicalBase) {
    return { requiredSlots, filledSlots, pendingSlots: 0 };
  }

  rows.forEach(r => {
    const rowBase = getRowCanonicalBase(r, baseKey);
    if (canonicalBase && rowBase !== canonicalBase) return;
    const rowDate = normalizeDateToISO(r[fechaKey]);
    if (rowDate !== dateIso) return;
    if (isFichoRowByContent(r)) return;

    [key1, key2].forEach(k => {
      if (!k) return;
      requiredSlots++;
      if (isConductorSlotResolved(r, k)) filledSlots++;
    });
  });

  return {
    requiredSlots,
    filledSlots,
    pendingSlots: Math.max(0, requiredSlots - filledSlots)
  };
}

function getRemainingDriversCountForDate(dateIso, baseValue = currentBase){
  const canonicalBase = getBaseCanonical(baseValue);
  if (!canonicalBase) return 0;

  const pool = driversByBase[canonicalBase] || driversByBase[formatBaseLabel(canonicalBase)] || [];
  if (!pool.length) return 0;

  const fechaKey = getFechaKey();
  const baseKey = getBaseKey();
  const { key1, key2 } = getConductorKeysFromRows();
  const assigned = new Set();

  if (fechaKey && (key1 || key2)) {
    rows.forEach(r => {
      const rowBase = getRowCanonicalBase(r, baseKey);
      if (canonicalBase && rowBase !== canonicalBase) return;
      const rowDate = normalizeDateToISO(r[fechaKey]);
      if (rowDate !== dateIso) return;
      if (isFichoRowByContent(r)) return;
      const n1 = extractConductorName(key1 ? r[key1] : "");
      const n2 = extractConductorName(key2 ? r[key2] : "");
      if (n1) assigned.add(norm(n1));
      if (n2) assigned.add(norm(n2));
    });
  }

  const inNovedades = new Set(
    novedades
      .filter(n => sameBase(n.base, canonicalBase) && normalizeDateToISO(n.fecha) === dateIso)
      .map(n => norm(n.nombre))
  );

  return pool.filter(d => !assigned.has(norm(d)) && !inNovedades.has(norm(d))).length;
}

function getDateStatusForBase(dateIso, baseValue = currentBase){
  const stats = getDateAssignmentStatsForBase(dateIso, baseValue);
  const remaining = getRemainingDriversCountForDate(dateIso, baseValue);

  if (stats.requiredSlots === 0) {
    return {
      state: "no_turns",
      label: "Sin turnos",
      required: 0,
      filled: 0,
      pending: 0,
      remaining
    };
  }

  if (stats.pendingSlots > 0 && stats.filledSlots === 0) {
    return {
      state: "not_started",
      label: `Sin iniciar (0/${stats.requiredSlots})`,
      required: stats.requiredSlots,
      filled: stats.filledSlots,
      pending: stats.pendingSlots,
      remaining
    };
  }

  if (stats.pendingSlots > 0) {
    return {
      state: "in_progress",
      label: `En proceso (${stats.filledSlots}/${stats.requiredSlots})`,
      required: stats.requiredSlots,
      filled: stats.filledSlots,
      pending: stats.pendingSlots,
      remaining
    };
  }

  if (remaining > 0) {
    return {
      state: "needs_states",
      label: `Falta estados (${remaining})`,
      required: stats.requiredSlots,
      filled: stats.filledSlots,
      pending: 0,
      remaining
    };
  }

  return {
    state: "complete",
    label: `Completo (${stats.filledSlots}/${stats.requiredSlots})`,
    required: stats.requiredSlots,
    filled: stats.filledSlots,
    pending: 0,
    remaining: 0
  };
}

function getAvailableDatesForCurrentBase(){
  const fechaKey = getFechaKey();
  if (!fechaKey || rows.length === 0) return [];
  const dates = new Set();

  rows.forEach(r => {
    const iso = normalizeDateToISO(r[fechaKey]);
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(iso || ""))) {
      dates.add(iso);
    }
  });

  return Array.from(dates).sort((a, b) => a.localeCompare(b));
}

function getAllAvailableDatesFromRows(){
  const fechaKey = getFechaKey();
  if (!fechaKey || rows.length === 0) return [];
  const dates = new Set();
  rows.forEach(r => {
    const iso = normalizeDateToISO(r[fechaKey]);
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(iso || ""))) dates.add(iso);
  });
  return Array.from(dates).sort((a, b) => b.localeCompare(a)); // reciente primero
}

function getAllBasesInProgramacion(){
  const baseKey = getBaseKey();
  const bases = new Set();
  rows.forEach(r => {
    const b = getRowCanonicalBase(r, baseKey);
    if (b) bases.add(b);
  });
  return Array.from(bases).sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }));
}

function ensureConsultaDateDefaults(){
  if (!consultaFrom || !consultaTo) return;
  const dates = getAvailableDatesForCurrentBase();
  if (!dates.length) {
    consultaFrom.value = "";
    consultaTo.value = "";
    return;
  }
  if (!consultaFrom.value || !dates.includes(consultaFrom.value)) consultaFrom.value = dates[0];
  if (!consultaTo.value || !dates.includes(consultaTo.value)) consultaTo.value = dates[dates.length - 1];
  if (consultaFrom.value > consultaTo.value) {
    const tmp = consultaFrom.value;
    consultaFrom.value = consultaTo.value;
    consultaTo.value = tmp;
  }
}

function renderConsultaBaseView(){
  if (!consultaProgramadosBody || !consultaEstadosBody) return;
  const base = getBaseCanonical(currentBase);
  consultaProgramadosBody.innerHTML = "";
  consultaEstadosBody.innerHTML = "";
  consultaBaseLabel.textContent = base ? formatBaseLabel(base) : "-";
  if (!base) {
    consultaProgramadosBody.innerHTML = `<tr><td colspan="3" class="muted" style="text-align:center;padding:12px">Selecciona una base.</td></tr>`;
    consultaEstadosBody.innerHTML = `<tr><td colspan="3" class="muted" style="text-align:center;padding:12px">Selecciona una base.</td></tr>`;
    if (consultaTimeline) consultaTimeline.innerHTML = `<div class="gantt-empty">Selecciona una base para visualizar el timeline.</div>`;
    consultaProgramadosCount.textContent = "0";
    consultaEstadosCount.textContent = "0";
    return;
  }

  ensureConsultaDateDefaults();
  const fromIso = normalizeDateToISO(consultaFrom?.value || "");
  const toIso = normalizeDateToISO(consultaTo?.value || "");
  const isInRange = (iso) => {
    if (!iso) return false;
    if (fromIso && iso < fromIso) return false;
    if (toIso && iso > toIso) return false;
    return true;
  };

  const baseKey = getBaseKey();
  const fechaKey = getFechaKey();
  const numeroKey = getHeaderKeyByNorm(["#"]);
  const puestoKey = getHeaderKeyByNorm(["PUESTO"]);
  const vehiculoKey = getHeaderKeyByNorm(["VEH", "VEHICULO", "VEHÍCULO", "MOVIL", "MÓVIL"]);
  const horaFinKey = getHeaderKeyByNorm(["HORA FIN", "HORA FINAL"]);
  const headerSet = new Set();
  rows.slice(0, 200).forEach(r => Object.keys(r || {}).forEach(k => headerSet.add(k)));
  const { key1: horaInicio1Key, key2: horaInicio2Key } = inferInicioKeysFromList(Array.from(headerSet));
  const { key1, key2 } = getConductorKeysFromRows();
  const programmedMap = new Map(); // name -> { turns, dates:Set }
  rows.forEach(r => {
    const rowBase = getRowCanonicalBase(r, baseKey);
    if (rowBase !== base) return;
    const rowDate = normalizeDateToISO(fechaKey ? r[fechaKey] : "");
    if (!isInRange(rowDate)) return;
    if (isFichoRowByContent(r)) return;
    [key1, key2].forEach(k => {
      if (!k) return;
      const name = extractConductorName(r[k] || "");
      if (!name) return;
      const keyName = norm(name);
      const item = programmedMap.get(keyName) || { name, turns: 0, dates: new Set() };
      item.turns += 1;
      if (rowDate) item.dates.add(rowDate);
      programmedMap.set(keyName, item);
    });
  });

  const programados = Array.from(programmedMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  if (!programados.length) {
    consultaProgramadosBody.innerHTML = `<tr><td colspan="3" class="muted" style="text-align:center;padding:12px">Sin conductores programados en el rango.</td></tr>`;
  } else {
    programados.forEach(p => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${p.name}</td>
        <td style="text-align:center">${p.turns}</td>
        <td>${Array.from(p.dates).sort().map(excelDateToReadable).join(", ")}</td>
      `;
      consultaProgramadosBody.appendChild(tr);
    });
  }

  const estados = (novedades || [])
    .filter(n => sameBase(n.base, base) && isInRange(normalizeDateToISO(n.fecha)))
    .sort((a, b) => String(a.fecha || "").localeCompare(String(b.fecha || "")) || String(a.nombre || "").localeCompare(String(b.nombre || "")));
  if (!estados.length) {
    consultaEstadosBody.innerHTML = `<tr><td colspan="3" class="muted" style="text-align:center;padding:12px">Sin estados del personal en el rango.</td></tr>`;
  } else {
    estados.forEach(n => {
      const st = NOVEDADES[n.estado] || NOVEDADES.PENDIENTE;
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${excelDateToReadable(normalizeDateToISO(n.fecha || ""))}</td>
        <td>${n.nombre || "-"}</td>
        <td><span class="estado-tag tag-${st.class}">${n.estado || "-"}</span></td>
      `;
      consultaEstadosBody.appendChild(tr);
    });
  }

  consultaProgramadosCount.textContent = String(programados.length);
  consultaEstadosCount.textContent = String(estados.length);

  // ===== Timeline / Gantt =====
  if (!consultaTimeline) return;
  const parseOpMinutes = (val) => {
    if (val === null || val === undefined || val === "") return null;
    if (typeof val === "number" && !Number.isNaN(val)) {
      // Excel fraccion de dia (0..n)
      return Math.round(val * 24 * 60);
    }
    const m = String(val).trim().match(/^(\d{1,2}):(\d{1,2})$/);
    if (!m) return null;
    const hh = parseInt(m[1], 10);
    const mm = parseInt(m[2], 10);
    if (Number.isNaN(hh) || Number.isNaN(mm) || mm < 0 || mm > 59) return null;
    return (hh * 60) + mm;
  };
  const fmtOp = (mins) => {
    if (mins === null || mins === undefined || Number.isNaN(mins)) return "--:--";
    const hh = Math.floor(mins / 60) % 24;
    const mm = Math.abs(mins % 60);
    return `${String(hh).padStart(2,"0")}:${String(mm).padStart(2,"0")}`;
  };
  const timelineItems = [];
  rows.forEach(r => {
    const rowBase = getRowCanonicalBase(r, baseKey);
    if (rowBase !== base) return;
    const rowDate = normalizeDateToISO(fechaKey ? r[fechaKey] : "");
    if (!isInRange(rowDate)) return;
    const numeroRaw = String(numeroKey ? (r[numeroKey] || "") : "").trim();
    const puestoRaw = String(puestoKey ? (r[puestoKey] || "") : "").trim();
    const vehRaw = String(vehiculoKey ? (r[vehiculoKey] || "") : "").trim();
    const isFicho = norm(numeroRaw).includes("FICHO");
    const s1 = parseOpMinutes(horaInicio1Key ? r[horaInicio1Key] : null);
    const s2 = parseOpMinutes(horaInicio2Key ? r[horaInicio2Key] : null);
    const c1 = extractConductorName(key1 ? r[key1] : "") || UNASSIGNED_LABEL;
    const c2 = extractConductorName(key2 ? r[key2] : "") || UNASSIGNED_LABEL;
    let start = s1;
    if ((start === null || start === undefined) && s2 !== null) start = s2;
    if (start !== null && s2 !== null) start = Math.min(start, s2);
    let end = parseOpMinutes(horaFinKey ? r[horaFinKey] : null);
    if (start !== null && end !== null && end < start) end += 24 * 60;
    timelineItems.push({
      date: rowDate,
      numero: numeroRaw || "-",
      puesto: puestoRaw || "-",
      veh: vehRaw || "-",
      c1,
      c2,
      isFicho,
      start,
      end,
      s1,
      s2
    });
  });

  if (!timelineItems.length) {
    consultaTimeline.innerHTML = `<div class="gantt-empty">Sin programacion para el rango seleccionado.</div>`;
    return;
  }

  const domainMin = 0;
  const domainMax = 30 * 60; // hasta 30:00 operativo
  const dayMap = new Map();
  timelineItems
    .sort((a,b) => (a.date || "").localeCompare(b.date || "") || (a.start ?? 99999) - (b.start ?? 99999))
    .forEach(item => {
      if (!dayMap.has(item.date)) dayMap.set(item.date, []);
      dayMap.get(item.date).push(item);
    });

  consultaTimeline.innerHTML = "";
  Array.from(dayMap.keys()).sort((a,b)=>a.localeCompare(b)).forEach(dayIso => {
    const dayBlock = document.createElement("div");
    dayBlock.className = "gantt-day";
    dayBlock.innerHTML = `<div class="gantt-day-title">${excelDateToReadable(dayIso)}</div>`;
    const items = dayMap.get(dayIso) || [];
    items.forEach(it => {
      const row = document.createElement("div");
      row.className = "gantt-row";
      const left = document.createElement("div");
      left.className = "gantt-label";
      const c1Hora = fmtOp(it.s1);
      const c2Hora = fmtOp(it.s2);
      const finHora = fmtOp(it.end);
      const finExtra = (it.end !== null && it.end >= (24 * 60)) ? " (+1 dia)" : "";
      left.innerHTML = `
        <strong>${it.numero}</strong> | VEH ${it.veh} | ${it.puesto}<br>
        <span class="consulta-mini"><strong>C1 ${c1Hora}:</strong> ${it.c1}</span><br>
        <span class="consulta-mini"><strong>C2 ${c2Hora}:</strong> ${it.c2}</span><br>
        <span class="consulta-mini"><strong>FIN:</strong> ${finHora}${finExtra}</span>
      `;

      const track = document.createElement("div");
      track.className = "gantt-track";
      const bar = document.createElement("div");
      bar.className = `gantt-bar ${it.isFicho ? "ficho" : ""}`;
      const effectiveStart = it.start ?? 0;
      let effectiveEnd = it.end ?? (it.start !== null ? it.start + 30 : 60);
      if (effectiveEnd <= effectiveStart) effectiveEnd = effectiveStart + 30;
      const leftPct = Math.max(0, Math.min(100, ((effectiveStart - domainMin) / (domainMax - domainMin)) * 100));
      const widthPct = Math.max(2, Math.min(100 - leftPct, ((effectiveEnd - effectiveStart) / (domainMax - domainMin)) * 100));
      bar.style.left = `${leftPct}%`;
      bar.style.width = `${widthPct}%`;
      bar.textContent = it.isFicho
        ? `FICHO salida | C1 ${c1Hora} | C2 ${c2Hora} | FIN ${finHora}${finExtra}`
        : `C1 ${c1Hora} | C2 ${c2Hora} | FIN ${finHora}${finExtra}`;
      track.appendChild(bar);
      row.appendChild(left);
      row.appendChild(track);
      dayBlock.appendChild(row);
    });
    consultaTimeline.appendChild(dayBlock);
  });
}

function renderAdminComplianceDashboard(){
  if (!adminComplianceCard || !adminComplianceBody || !adminComplianceDate || !adminComplianceSummary) return;
  adminComplianceCard.classList.toggle("hidden", !isSuperAdmin());
  if (!isSuperAdmin()) return;

  const availableDates = getAllAvailableDatesFromRows();
  const prev = adminComplianceDate.value || "";
  adminComplianceDate.innerHTML = `<option value="">Selecciona fecha...</option>`;
  availableDates.forEach(iso => {
    const op = document.createElement("option");
    op.value = iso;
    op.textContent = excelDateToReadable(iso);
    adminComplianceDate.appendChild(op);
  });
  if (prev && availableDates.includes(prev)) adminComplianceDate.value = prev;
  else if (availableDates.length > 0) adminComplianceDate.value = availableDates[0];
  else adminComplianceDate.value = "";

  const dateIso = adminComplianceDate.value || "";
  if (!dateIso) {
    adminComplianceBody.innerHTML = `<tr><td colspan="5" class="muted" style="text-align:center;padding:12px">No hay fechas disponibles.</td></tr>`;
    adminComplianceSummary.textContent = "Sin datos";
    return;
  }

  const bases = getAllBasesInProgramacion();
  if (bases.length === 0) {
    adminComplianceBody.innerHTML = `<tr><td colspan="5" class="muted" style="text-align:center;padding:12px">No hay bases en la programacion.</td></tr>`;
    adminComplianceSummary.textContent = `${excelDateToReadable(dateIso)} | 0 bases`;
    return;
  }

  let completeCount = 0;
  adminComplianceBody.innerHTML = "";
  bases.forEach(base => {
    const status = getDateStatusForBase(dateIso, base);
    if (status.state === "complete") completeCount++;
    const stats = getDateAssignmentStatsForBase(dateIso, base);
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${formatBaseLabel(base)}</strong></td>
      <td><span class="status-chip status-${status.state}">${status.label}</span></td>
      <td>${stats.filledSlots}/${stats.requiredSlots}</td>
      <td>${stats.pendingSlots}</td>
      <td>${status.remaining ?? 0}</td>
    `;
    adminComplianceBody.appendChild(tr);
  });
  adminComplianceSummary.textContent = `${excelDateToReadable(dateIso)} | Cumplieron ${completeCount}/${bases.length}`;
}

function refreshFilterDateOptions(){
  const dateSelect = document.getElementById("filterDate");
  const clearBtn = document.getElementById("clearFilter");
  if (!dateSelect) return;

  const previousValue = dateSelect.value || "";
  const availableDates = getAvailableDatesForCurrentBase();

  dateSelect.innerHTML = `<option value="">Selecciona fecha...</option>`;
  availableDates.forEach(iso => {
    const op = document.createElement("option");
    op.value = iso;
    const status = getDateStatusForBase(iso);
    op.textContent = `${excelDateToReadable(iso)} - ${status.label}`;
    dateSelect.appendChild(op);
  });

  if (previousValue && availableDates.includes(previousValue)) {
    dateSelect.value = previousValue;
  } else {
    dateSelect.value = "";
  }

  dateSelect.disabled = !currentBase || availableDates.length === 0;
  dateSelect.dataset.prevValue = dateSelect.value || "";
  if (clearBtn) clearBtn.disabled = !dateSelect.value;
}

function autoSelectDateForBaseOperator(){
  if (!isBaseOperator()) return;
  const dateSelect = document.getElementById("filterDate");
  if (!dateSelect || dateSelect.disabled) return;
  if (dateSelect.value) return;
  if (dateSelect.options.length <= 1) return;

  // Escoge la fecha mas reciente disponible para que el operador pueda iniciar de inmediato.
  dateSelect.value = dateSelect.options[1].value;
  dateSelect.dataset.prevValue = dateSelect.value;
  const clearBtn = document.getElementById("clearFilter");
  if (clearBtn) clearBtn.disabled = false;
}

function canMoveOnFromSelectedDate(actionLabel = "continuar", dateOverride = null){
  const dateSelect = document.getElementById("filterDate");
  const selectedDate = dateOverride || dateSelect?.value || "";
  if (!selectedDate || !currentBase) return true;

  const status = getDateStatusForBase(selectedDate);
  if (status.state === "in_progress") {
    showToast(`Antes de ${actionLabel}, completa turnos del ${excelDateToReadable(selectedDate)}: asigna conductor o agrega nota en cada vacio.`, "warn");
    return false;
  }
  if (status.state === "needs_states") {
    showToast(`Antes de ${actionLabel}, pasa ${status.remaining} sobrantes a Estados del personal para ${excelDateToReadable(selectedDate)}.`, "warn");
    return false;
  }
  return true;
}

function getConductorKeysFromRows(){
  if(rows.length===0) return { key1: null, key2: null };
  const headerSet = new Set();
  rows.slice(0, 50).forEach(r => Object.keys(r || {}).forEach(k => headerSet.add(k)));
  return inferConductorKeysFromList(Array.from(headerSet));
}

function getConductorKeysFromArray(inputRows){
  if(!Array.isArray(inputRows) || inputRows.length === 0) return { key1: null, key2: null };
  const keySet = new Set();
  inputRows.slice(0, 50).forEach(r => Object.keys(r || {}).forEach(k => keySet.add(k)));
  return inferConductorKeysFromList(Array.from(keySet));
}

function buildProgramacionRowKey(rowObj){
  const slotKey = buildProgramacionSlotKey(rowObj);
  if (slotKey && slotKey.replace(/\|/g, "").trim()) {
    return `SLOT:${slotKey}`;
  }

  const row = rowObj || {};
  const fallback = { ...row };
  Object.keys(fallback).forEach(k => {
    if (isInternalRowKey(k)) delete fallback[k];
  });
  const { key1, key2 } = getConductorKeysFromArray([row]);
  if (key1) delete fallback[key1];
  if (key2) delete fallback[key2];
  return `RAW:${JSON.stringify(fallback)}`;
}

function mergeImportedRowsPreservingAssignments(incomingRows, existingRows){
  if (!Array.isArray(incomingRows) || incomingRows.length === 0) {
    return { mergedRows: [], matchedRows: 0, preservedAssignments: 0 };
  }
  if (!Array.isArray(existingRows) || existingRows.length === 0) {
    return { mergedRows: incomingRows, matchedRows: 0, preservedAssignments: 0 };
  }

  const existingMap = new Map();
  existingRows.forEach(r => {
    const key = buildProgramacionRowKey(r);
    if (key && !existingMap.has(key)) existingMap.set(key, r);
  });

  const incomingConductorKeys = getConductorKeysFromArray(incomingRows);
  const existingConductorKeys = getConductorKeysFromArray(existingRows);
  let matchedRows = 0;
  let preservedAssignments = 0;

  const mergedRows = incomingRows.map(r => {
    const key = buildProgramacionRowKey(r);
    const oldRow = key ? existingMap.get(key) : null;
    if (!oldRow) return r;

    matchedRows++;
    const merged = { ...r };

    if (incomingConductorKeys.key1 && existingConductorKeys.key1) {
      const prev1 = extractConductorName(oldRow[existingConductorKeys.key1] || "");
      if (prev1) {
        merged[incomingConductorKeys.key1] = oldRow[existingConductorKeys.key1];
        preservedAssignments++;
      }
    }
    if (incomingConductorKeys.key2 && existingConductorKeys.key2) {
      const prev2 = extractConductorName(oldRow[existingConductorKeys.key2] || "");
      if (prev2) {
        merged[incomingConductorKeys.key2] = oldRow[existingConductorKeys.key2];
        preservedAssignments++;
      }
    }
    return merged;
  });

  return { mergedRows, matchedRows, preservedAssignments };
}

function scoreProgramacionRowForDedup(rowObj, conductorKey1, conductorKey2){
  const row = rowObj || {};
  let score = 0;
  const c1 = conductorKey1 ? extractConductorName(row[conductorKey1] || "") : "";
  const c2 = conductorKey2 ? extractConductorName(row[conductorKey2] || "") : "";
  if (c1) score += 4;
  if (c2) score += 4;
  if (conductorKey1 && getConductorNote(row, conductorKey1)) score += 2;
  if (conductorKey2 && getConductorNote(row, conductorKey2)) score += 2;
  if (getVehiculoNote(row)) score += 1;
  if (isFichoRowByContent(row)) score -= 1;
  return score;
}

function buildProgramacionSlotKey(rowObj){
  const row = rowObj || {};
  const keys = Object.keys(row).filter(k => !isInternalRowKey(k));
  const findByNorm = (aliases) => keys.find(k => aliases.includes(norm(k))) || null;
  const findByCompact = (aliases) => keys.find(k => aliases.includes(normCompact(k))) || null;
  const fechaKey = findByNorm(["FECHA"]);
  const baseKey = findByNorm(BASE_COLUMN_ALIASES);
  const numeroKey = findByNorm(["#"]);
  const puestoKey = findByNorm(["PUESTO"]);
  const inicia1Key = findByCompact(["INICIA", "INICIO", "HORAINICIO", "HORAINICIO1"]);
  const inicia2Key = findByCompact(["INICIA2", "INICIO2", "HORAINICIO2"]);
  const horaFinKey = findByCompact(["HORAFIN", "HORAFINAL"]);

  const fechaVal = fechaKey ? normalizeDateToISO(row[fechaKey]) : "";
  const baseVal = baseKey ? getBaseCanonical(row[baseKey]) : "";
  const numeroVal = numeroKey ? normCompact(row[numeroKey]) : "";
  const puestoVal = puestoKey ? normCompact(row[puestoKey]) : "";
  const inicia1Val = inicia1Key ? normCompact(excelTimeToHHMM(row[inicia1Key])) : "";
  const inicia2Val = inicia2Key ? normCompact(excelTimeToHHMM(row[inicia2Key])) : "";
  const horaFinVal = horaFinKey ? normCompact(excelTimeToHHMM(row[horaFinKey])) : "";
  return [fechaVal, baseVal, numeroVal, puestoVal, inicia1Val, inicia2Val, horaFinVal].join("|");
}

function reorderRowsByReference(referenceRowsInput, liveRowsInput){
  const referenceRows = Array.isArray(referenceRowsInput) ? referenceRowsInput : [];
  const liveRows = Array.isArray(liveRowsInput) ? liveRowsInput : [];
  if (!referenceRows.length || !liveRows.length) return liveRows.slice();

  const bySlot = new Map();
  const byRowKey = new Map();
  liveRows.forEach(r => {
    const slotKey = buildProgramacionSlotKey(r);
    if (slotKey && !bySlot.has(slotKey)) bySlot.set(slotKey, r);
    const rowKey = buildProgramacionRowKey(r);
    if (rowKey && !byRowKey.has(rowKey)) byRowKey.set(rowKey, r);
  });

  const ordered = [];
  const used = new Set();
  referenceRows.forEach(ref => {
    const slotKey = buildProgramacionSlotKey(ref);
    let row = slotKey ? bySlot.get(slotKey) : null;
    if (!row) {
      const rowKey = buildProgramacionRowKey(ref);
      row = rowKey ? byRowKey.get(rowKey) : null;
    }
    if (row && !used.has(row)) {
      ordered.push(row);
      used.add(row);
    }
  });
  liveRows.forEach(r => {
    if (!used.has(r)) ordered.push(r);
  });
  return ordered;
}

function getCurrentProgramacionReferenceRows(){
  if (!currentProgramacionId || !Array.isArray(programacionesHistory)) return [];
  const rec = programacionesHistory.find(r => String(r.id) === String(currentProgramacionId));
  return Array.isArray(rec?.rows_data) ? rec.rows_data : [];
}

function getRowsOrderedByCurrentReference(sourceRows){
  const liveRows = Array.isArray(sourceRows) ? sourceRows : [];
  const referenceRows = getCurrentProgramacionReferenceRows();
  if (!referenceRows.length) return liveRows.slice();
  return reorderRowsByReference(referenceRows, liveRows);
}

function canonicalizePuestoLabel(value){
  const raw = String(value || "").trim();
  const n = norm(raw);
  if (n.includes("EXPOSICIONES")) return "EXPOSICIONES";
  if (n.includes("SAN DIEGO")) return "SAN DIEGO";
  if (n.includes("NUTIBARA") || n.includes("TERMINAL DEL NORTE")) return "NUTIBARA";
  return raw || "SIN PUESTO";
}

function getOperationalSectionDisplayName(value){
  const canonical = canonicalizePuestoLabel(value);
  if (canonical === "NUTIBARA") return "TERMINAL DEL NORTE";
  if (canonical === "EXPOSICIONES") return "NUTIBARA -EXPOSICIONES";
  return canonical;
}

function buildOperationalEntries(rowsInput, puestoKey, numeroKey){
  const source = Array.isArray(rowsInput) ? rowsInput : [];
  let lastResolvedPuesto = "SIN PUESTO";
  return source.map((r, idx) => {
    const puestoRaw = String(puestoKey ? (r[puestoKey] || "") : "").trim();
    if (puestoRaw) lastResolvedPuesto = canonicalizePuestoLabel(puestoRaw);
    const puestoResolved = puestoRaw ? canonicalizePuestoLabel(puestoRaw) : lastResolvedPuesto;
    const numeroRaw = String(numeroKey ? (r[numeroKey] || "") : "").trim();
    const isFichoMarker = norm(numeroRaw).includes("FICHO");
    return { row: r, idx, puestoResolved, numeroRaw, isFichoMarker };
  });
}

function sortOperationalEntries(entriesInput){
  const entries = Array.isArray(entriesInput) ? entriesInput.slice() : [];
  const puestoRank = (puestoText) => {
    const p = norm(puestoText || "");
    if (p.includes("NUTIBARA")) return 1;
    if (p.includes("SAN DIEGO")) return 2;
    if (p.includes("EXPOSICIONES")) return 3;
    return 99;
  };
  const asNum = (val) => {
    const n = Number(String(val ?? "").replace(/[^\d.-]/g, ""));
    return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER;
  };
  return entries.sort((a, b) => {
    const rankDiff = puestoRank(a.puestoResolved) - puestoRank(b.puestoResolved);
    if (rankDiff !== 0) return rankDiff;
    const aNum = asNum(a.numeroRaw);
    const bNum = asNum(b.numeroRaw);
    if (aNum !== bNum) return aNum - bNum;
    const aIsFicho = !!a.isFichoMarker;
    const bIsFicho = !!b.isFichoMarker;
    if (aIsFicho !== bIsFicho) return aIsFicho ? 1 : -1;
    return a.idx - b.idx;
  });
}

const FICHO_POSITION_RULES = {
  "SAN DIEGO": [
    { ficho: 1, after: 14 },
    { ficho: 2, after: 18 },
    { ficho: 3, after: 22 },
    { ficho: 4, after: 26 },
    { ficho: 5, after: 30 },
    { ficho: 6, after: 34 }
  ],
  "EXPOSICIONES": [
    { ficho: 7, after: 38 },
    { ficho: 8, after: 42 },
    { ficho: 9, after: 46 },
    { ficho: 10, after: 51 }
  ]
};

function getFichoSectionByIndex(idx){
  const n = Number(idx);
  if (!Number.isFinite(n)) return null;
  if (n >= 1 && n <= 6) return "SAN DIEGO";
  if (n >= 7 && n <= 10) return "EXPOSICIONES";
  return null;
}

function sortEntriesByNumericTurn(entriesInput){
  const entries = Array.isArray(entriesInput) ? entriesInput.slice() : [];
  return entries.sort((a, b) => {
    const aNum = getNumericTurnNumber(a?.numeroRaw);
    const bNum = getNumericTurnNumber(b?.numeroRaw);
    const aMissing = !Number.isFinite(aNum);
    const bMissing = !Number.isFinite(bNum);
    if (aMissing !== bMissing) return aMissing ? 1 : -1;
    if (!aMissing && aNum !== bNum) return aNum - bNum;
    return (a?.idx ?? 0) - (b?.idx ?? 0);
  });
}

function groupOperationalEntriesByPuesto(entriesInput){
  const entries = Array.isArray(entriesInput) ? entriesInput : [];
  const buckets = new Map();
  const order = [];
  const ensureBucket = (label) => {
    const key = String(label || "SIN PUESTO");
    if (!buckets.has(key)) {
      buckets.set(key, []);
      order.push(key);
    }
    return buckets.get(key);
  };
  let currentSection = "SIN PUESTO";
  entries.forEach(entry => {
    const rowLabel = canonicalizePuestoLabel(entry?.puestoResolved || "SIN PUESTO");
    const fichoIdx = entry?.isFichoMarker ? getFichoIndexFromNumero(entry?.numeroRaw) : null;
    const fichoSection = fichoIdx ? getFichoSectionByIndex(fichoIdx) : null;
    if (!entry?.isFichoMarker) {
      currentSection = rowLabel || currentSection || "SIN PUESTO";
    } else if (fichoSection) {
      currentSection = fichoSection;
    } else if (!currentSection || currentSection === "SIN PUESTO") {
      currentSection = rowLabel || "SIN PUESTO";
    }
    const sectionLabel = (entry?.isFichoMarker && fichoSection) ? fichoSection : (currentSection || "SIN PUESTO");
    ensureBucket(sectionLabel).push(entry);
  });

  const preferred = ["NUTIBARA", "SAN DIEGO", "EXPOSICIONES", "SIN PUESTO"];
  const grouped = [];
  preferred.forEach(label => {
    if (buckets.has(label) && buckets.get(label).length) {
      grouped.push({ puesto: label, entries: buckets.get(label) });
      buckets.delete(label);
    }
  });
  order.forEach(label => {
    if (buckets.has(label) && buckets.get(label).length) {
      grouped.push({ puesto: label, entries: buckets.get(label) });
    }
  });
  return grouped;
}

function getSectionEntriesForOperationalView(sectionLabelInput, entriesInput){
  const sectionLabel = canonicalizePuestoLabel(sectionLabelInput);
  const entries = Array.isArray(entriesInput) ? entriesInput.slice() : [];
  const nonFichoSorted = sortEntriesByNumericTurn(entries.filter(e => !e?.isFichoMarker));
  if (sectionLabel === "NUTIBARA") return nonFichoSorted;

  const fichoEntries = entries.filter(e => e?.isFichoMarker);
  if (!fichoEntries.length) return nonFichoSorted;

  const fichoByIndex = new Map();
  fichoEntries.forEach(entry => {
    const idx = getFichoIndexFromNumero(entry?.numeroRaw);
    if (!idx || fichoByIndex.has(idx)) return;
    fichoByIndex.set(idx, entry);
  });

  const rules = FICHO_POSITION_RULES[sectionLabel];
  if (!Array.isArray(rules) || !rules.length) {
    const extras = sortEntriesByNumericTurn(fichoEntries);
    return nonFichoSorted.concat(extras);
  }

  const ordered = nonFichoSorted.slice();
  const inserted = new Set();
  rules.forEach(rule => {
    const entry = fichoByIndex.get(rule.ficho);
    if (!entry) return;
    let insertAt = ordered.findIndex(item => {
      if (item?.isFichoMarker) return false;
      const num = getNumericTurnNumber(item?.numeroRaw);
      return Number.isFinite(num) && num > rule.after;
    });
    if (insertAt < 0) insertAt = ordered.length;
    ordered.splice(insertAt, 0, entry);
    inserted.add(rule.ficho);
  });

  const leftovers = Array.from(fichoByIndex.entries())
    .filter(([idx]) => !inserted.has(idx))
    .sort((a, b) => a[0] - b[0])
    .map(([, entry]) => entry);
  return ordered.concat(leftovers);
}

function getFichoIndexFromNumero(value){
  const txt = String(value || "").toUpperCase();
  const m = txt.match(/FICHO\s*([0-9]+)/);
  const idx = m ? Number(m[1]) : NaN;
  return Number.isFinite(idx) ? idx : null;
}

function getNumericTurnNumber(value){
  const digits = String(value ?? "").match(/\d+/);
  if (!digits) return null;
  const n = Number(digits[0]);
  return Number.isFinite(n) ? n : null;
}

function buildFichoAssignmentsByIndex(groupedSections, vehiculoKey, opts = {}){
  const baseKey = opts.baseKey || getBaseKey();
  const fechaKey = opts.fechaKey || getFechaKey();
  const assignments = new Map(); // `${base}|${fecha}` -> Map(idx -> { veh, color })
  (Array.isArray(groupedSections) ? groupedSections : []).forEach(section => {
    const sectionLabel = canonicalizePuestoLabel(section?.puesto || "SIN PUESTO");
    const sectionColor = norm(sectionLabel).includes("EXPOSICIONES") ? "blue" : "green";
    (Array.isArray(section?.entries) ? section.entries : []).forEach(entry => {
      if (!entry?.isFichoMarker) return;
      const idx = getFichoIndexFromNumero(entry.numeroRaw);
      if (!idx) return;
      const veh = String(vehiculoKey ? (entry.row?.[vehiculoKey] || "") : "").trim();
      if (!veh) return;
      const rowBase = getRowCanonicalBase(entry.row, baseKey);
      const rowDate = getRowDateISO(entry.row, fechaKey);
      const groupKey = `${rowBase || ""}|${rowDate || ""}`;
      if (!assignments.has(groupKey)) assignments.set(groupKey, new Map());
      assignments.get(groupKey).set(idx, { veh, color: sectionColor });
    });
  });
  return assignments;
}

function syncNutibaraTop10FromFichos(opts = {}){
  const sourceRows = Array.isArray(rows) ? rows : [];
  if (sourceRows.length === 0) return 0;

  const fechaFiltro = normalizeDateToISO(opts.selectedDate || "");
  const baseFiltro = getBaseCanonical(opts.currentBase || "");
  const numeroKey = opts.numeroKey || getHeaderKeyByNorm(["#"]);
  const puestoKey = opts.puestoKey || getHeaderKeyByNorm(["PUESTO"]);
  const vehiculoKey = opts.vehiculoKey || getHeaderKeyByNorm(["VEH", "VEHICULO", "VEHÍCULO", "MOVIL", "MÓVIL"]);
  const baseKey = opts.baseKey || getBaseKey();
  const fechaKey = opts.fechaKey || getFechaKey();

  if (!numeroKey || !vehiculoKey || !puestoKey) return 0;

  const assignByGroup = new Map(); // `${base}|${fecha}` -> Map(fichoIdx -> veh)
  sourceRows.forEach(row => {
    if (!row) return;
    const rowBase = getRowCanonicalBase(row, baseKey);
    const rowDate = getRowDateISO(row, fechaKey);
    if (baseFiltro && rowBase !== baseFiltro) return;
    if (fechaFiltro && rowDate !== fechaFiltro) return;

    const numeroRaw = String(row[numeroKey] || "").trim();
    const fichoIdx = getFichoIndexFromNumero(numeroRaw);
    if (!fichoIdx) return;
    const veh = String(row[vehiculoKey] || "").trim();
    if (!veh) return;
    const groupKey = `${rowBase || ""}|${rowDate || ""}`;
    if (!assignByGroup.has(groupKey)) assignByGroup.set(groupKey, new Map());
    assignByGroup.get(groupKey).set(fichoIdx, veh);
  });

  let updated = 0;
  sourceRows.forEach(row => {
    if (!row) return;
    const rowBase = getRowCanonicalBase(row, baseKey);
    const rowDate = getRowDateISO(row, fechaKey);
    if (baseFiltro && rowBase !== baseFiltro) return;
    if (fechaFiltro && rowDate !== fechaFiltro) return;

    const numeroRaw = String(row[numeroKey] || "").trim();
    if (getFichoIndexFromNumero(numeroRaw)) return;

    const puesto = canonicalizePuestoLabel(row[puestoKey] || "");
    if (puesto !== "NUTIBARA") return;

    const turnNum = getNumericTurnNumber(numeroRaw);
    if (!turnNum || turnNum < 1 || turnNum > 10) return;

    const groupKey = `${rowBase || ""}|${rowDate || ""}`;
    const mappedVeh = assignByGroup.get(groupKey)?.get(turnNum);
    if (!mappedVeh) return;

    const currentVeh = String(row[vehiculoKey] || "").trim();
    if (currentVeh !== String(mappedVeh).trim()) {
      row[vehiculoKey] = mappedVeh;
      updated++;
    }
  });

  return updated;
}

function dedupeProgramacionRows(inputRows){
  const source = Array.isArray(inputRows) ? inputRows : [];
  if (source.length <= 1) return { rows: source.slice(), removed: 0 };

  const { key1: conductorKey1, key2: conductorKey2 } = getConductorKeysFromArray(source);
  const keepByKey = new Map();
  source.forEach((row, idx) => {
    const slotKey = buildProgramacionSlotKey(row);
    const key = slotKey && slotKey.replace(/\|/g, "").length > 0
      ? `SLOT:${slotKey}`
      : buildProgramacionRowKey(row);
    if (!key) {
      keepByKey.set(`__ROWIDX__${idx}`, row);
      return;
    }
    if (!keepByKey.has(key)) {
      keepByKey.set(key, row);
      return;
    }
    const current = keepByKey.get(key);
    const currentScore = scoreProgramacionRowForDedup(current, conductorKey1, conductorKey2);
    const nextScore = scoreProgramacionRowForDedup(row, conductorKey1, conductorKey2);
    if (nextScore > currentScore) {
      keepByKey.set(key, row);
    }
  });

  const deduped = Array.from(keepByKey.values());
  return { rows: deduped, removed: Math.max(0, source.length - deduped.length) };
}

/* ===================== CARGAR CONDUCTORES DESDE CSV ===================== */
async function loadDriversFromCSV() {
  if (isLoadingDrivers) return;
  isLoadingDrivers = true;
  
  const csvUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vThNrFZLbNklMFtPeg0wF4TA1vZHnZ4YNMmGcnHfty_RoNuAQw__iV2GMXqTsv36MPiks1ARpYui1JK/pub?gid=0&single=true&output=csv';
  
  csvStatus.innerHTML = 'Cargando conductores...';
  
  try {
    const response = await fetch(csvUrl, { cache: "no-cache" });
    const csvText = await response.text();
    const lines = csvText.split('\n').filter(line => line.trim() !== '');
    
    const delimiter = lines[0].includes('\t') ? '\t' : ',';
    const headers = lines[0].split(delimiter).map(h => h.trim());
    
    const nombreIdx = headers.findIndex(h => norm(h) === 'NOMBRE');
    const emailIdx = headers.findIndex(h => norm(h) === 'EMAIL');
    const statusIdx = headers.findIndex(h => norm(h) === 'STATUS');
    
    const newDriversByBase = {};
    let totalEnabled = 0;
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(delimiter);
      const nombre = values[nombreIdx]?.trim() || '';
      const email = values[emailIdx]?.trim() || '';
      const status = statusIdx !== -1 ? values[statusIdx]?.trim().toUpperCase() : 'ENABLED';
      
      const baseMatch = email.match(/BASE\s*(\d+)/i);
      if (baseMatch && nombre && status === 'ENABLED') {
        const baseNumber = baseMatch[1];
        if (!newDriversByBase[baseNumber]) newDriversByBase[baseNumber] = [];
        newDriversByBase[baseNumber].push(nombre);
        totalEnabled++;
      }
    }
    
    // Ordenar
    Object.keys(newDriversByBase).forEach(base => {
      newDriversByBase[base].sort((a, b) => a.localeCompare(b));
    });
    
    driversByBase = newDriversByBase;
    
    const totalBases = Object.keys(driversByBase).length;
    lblDriversCount.textContent = `Conductores: ${totalEnabled} en ${totalBases} bases`;
    csvStatus.innerHTML = `Cargados ${totalEnabled} conductores`;
    
    fillStartBases();
    if (currentBase) {
      rebuildAssigned();
      renderDrivers();
      renderTable();
      renderNovedades();
    }
    
  } catch (error) {
    console.error('Error:', error);
    csvStatus.innerHTML = 'Error al cargar conductores';
  } finally {
    isLoadingDrivers = false;
  }
}

/* ===================== BASES ===================== */
function loadBasesFromStorage(){
  try{
    const raw = localStorage.getItem("basesCatalog");
    basesCatalog = raw ? JSON.parse(raw) : [];
  }catch(e){ basesCatalog = []; }
  renderBasesAdmin();
  fillStartBases();
}

function saveBasesToStorage(){
  localStorage.setItem("basesCatalog", JSON.stringify(basesCatalog));
}

function renderBasesAdmin(){
  basesList.innerHTML = "";
  basesCatalog.slice().sort().forEach(b => {
    const op = document.createElement("option");
    op.value = b; op.textContent = `Base ${b}`;
    basesList.appendChild(op);
  });
}

function fillStartBases(){
  startBaseSelect.innerHTML = `<option value="">Selecciona una base operativa...</option>`;
  const allBases = new Map();
  const addBase = (value) => {
    const canonical = getBaseCanonical(value);
    if (!canonical) return;
    if (!allBases.has(canonical)) allBases.set(canonical, formatBaseLabel(canonical));
  };
  basesCatalog.forEach(b => addBase(String(b)));
  Object.keys(driversByBase).forEach(b => addBase(String(b)));
  const baseKey = getBaseKey();
  if (baseKey && rows.length > 0) {
    rows.forEach(r => {
      const b = getRowCanonicalBase(r, baseKey);
      addBase(b);
    });
  }

  Array.from(allBases.keys()).sort((a,b)=>String(a).localeCompare(String(b), undefined, {numeric: true})).forEach(canonical=>{
    const op = document.createElement("option");
    op.value = canonical;
    const count = (driversByBase[canonical] || driversByBase[formatBaseLabel(canonical)] || []).length || 0;
    op.textContent = `${allBases.get(canonical)} (${count} conductores)`;
    startBaseSelect.appendChild(op);
  });
}

/* ===================== CONDUCTORES ===================== */
function rebuildAssigned(){
  assignedByBase = {};
  const baseKey = getBaseKey();
  const fechaKey = getFechaKey();
  const { key1: conductor1Key, key2: conductor2Key } = getConductorKeysFromRows();
  const selectedDate = document.getElementById("filterDate").value;

  rows.forEach(r => {
    const b = getRowCanonicalBase(r, baseKey);
    if(!b) return;
    if(currentBase && !sameBase(b, currentBase)) return;
    if(selectedDate && fechaKey && normalizeDateToISO(r[fechaKey]) !== selectedDate) return;

    if(!assignedByBase[b]) assignedByBase[b] = new Set();
    
    const name1 = extractConductorName(conductor1Key ? r[conductor1Key] : "");
    const name2 = extractConductorName(conductor2Key ? r[conductor2Key] : "");
    
    if(name1) assignedByBase[b].add(norm(name1));
    if(name2) assignedByBase[b].add(norm(name2));
  });
}

function getAvailableDriversForBase(base){
  base = getBaseCanonical(base);
  if(!base) return [];
  const pool = driversByBase[base] || driversByBase[formatBaseLabel(base)] || [];
  const used = assignedByBase[base] || assignedByBase[formatBaseLabel(base)] || new Set();
  const selectedDate = getSelectedOperativeDateISO();
  
  // Excluir conductores en novedades de la misma base y misma fecha operativa.
  const enNovedades = new Set(
    novedades
      .filter(n => sameBase(n.base, base) && (!selectedDate || normalizeDateToISO(n.fecha) === selectedDate))
      .map(n => norm(n.nombre))
  );
  
  return pool.filter(d => !used.has(norm(d)) && !enNovedades.has(norm(d)));
}

function renderDrivers(){
  const base = getBaseCanonical(currentBase);
  const selectedDate = document.getElementById("filterDate")?.value || "";
  const filterText = document.getElementById('filterDrivers').value.toLowerCase();
  const list = document.getElementById('driversList');
  list.innerHTML = '';

  if(!base){
    currentBaseDisplay.textContent = 'Base -';
    list.innerHTML = `<div class="muted" style="padding:12px;text-align:center">Selecciona una base operativa</div>`;
    refreshFilterDateOptions();
    return;
  }

  if (!selectedDate) {
    currentBaseDisplay.textContent = formatBaseLabel(base);
    list.innerHTML = `<div class="muted" style="padding:12px;text-align:center">Paso 1: selecciona una fecha para habilitar asignacion de conductores</div>`;
    updateWorkflowGuide();
    return;
  }

  currentBaseDisplay.textContent = formatBaseLabel(base);
  const available = getAvailableDriversForBase(base);
  const dateStatus = getDateStatusForBase(selectedDate);

  if (available.length === 0) {
    list.innerHTML = `<div class="muted" style="padding:12px;text-align:center">Todos los conductores asignados</div>`;
    return;
  }

  if (dateStatus.state === "needs_states") {
    const info = document.createElement("div");
    info.className = "muted";
    info.style.padding = "8px";
    info.style.marginBottom = "8px";
    info.style.border = "1px solid #fcd34d";
    info.style.borderRadius = "8px";
    info.style.background = "#fffbeb";
    info.textContent = `Quedan ${dateStatus.remaining} conductores sobrantes. Arrastralos a la pestana "Estados del personal".`;
    list.appendChild(info);
  }

  available
    .filter(d => d.toLowerCase().includes(filterText))
    .forEach(name => {
      const div = document.createElement('div');
      div.className = 'driver-item';
      div.draggable = true;
      div.tabIndex = 0;
      
      div.innerHTML = `
        <span>${name}</span>
        <span class="base-badge">${formatBaseLabel(base)}</span>
      `;
      
      div.ondragstart = ev => {
        highlightDropTargets(true);
        ev.dataTransfer.setData('text/plain', JSON.stringify({
          tipo: 'conductor',
          nombre: name,
          base: base
        }));
        ev.dataTransfer.effectAllowed = 'move';
      };
      div.ondragend = () => highlightDropTargets(false);
      
      list.appendChild(div);
    });
  updateWorkflowGuide();
}

/* ===================== NOVEDADES ===================== */
function renderNovedades(){
  if (!novedadesBody) return;
  adjustDynamicTableViewport();
  const selectedDate = getSelectedOperativeDateISO();
  
  // Filtrar novedades por base actual y fecha seleccionada.
  const novedadesBase = novedades.filter(n =>
    sameBase(n.base, currentBase) &&
    (!!selectedDate && normalizeDateToISO(n.fecha) === selectedDate)
  );
  novedadesCount.textContent = novedadesBase.length;
  novedadesBaseDisplay.textContent = currentBase ? formatBaseLabel(currentBase) : '-';
  
  novedadesBody.innerHTML = '';

  if (!selectedDate) {
    novedadesBody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:20px" class="muted">
      Selecciona una fecha para ver y registrar novedades
    </td></tr>`;
    return;
  }
  
  if (novedadesBase.length === 0) {
    novedadesBody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:20px" class="muted">
      No hay conductores con novedades en esta base para ${excelDateToReadable(selectedDate)}
    </td></tr>`;
    return;
  }
  
  novedadesBase.forEach((n) => {
    const tr = document.createElement('tr');
    const novedad = NOVEDADES[n.estado] || NOVEDADES.PENDIENTE;
    
    tr.innerHTML = `
      <td>
        <div class="conductor-info">
          <strong>${n.nombre}</strong>
        </div>
      </td>
      <td><span class="base-badge">${formatBaseLabel(n.base)}</span></td>
      <td>
        <select class="estado-select" data-id="${n.id}" style="background:${novedad.color}20;border-color:${novedad.color}">
          <option value="DISPONIBLE" ${n.estado === 'DISPONIBLE' ? 'selected' : ''}>Disponible</option>
          <option value="INCAPACITADO" ${n.estado === 'INCAPACITADO' ? 'selected' : ''}>Incapacitado</option>
          <option value="PERMISO" ${n.estado === 'PERMISO' ? 'selected' : ''}>Permiso</option>
          <option value="DESCANSO" ${n.estado === 'DESCANSO' ? 'selected' : ''}>Descanso</option>
          <option value="VACACIONES" ${n.estado === 'VACACIONES' ? 'selected' : ''}>Vacaciones</option>
          <option value="RECONOCIMIENTO DE RUTA" ${n.estado === 'RECONOCIMIENTO DE RUTA' ? 'selected' : ''}>Reconocimiento de ruta</option>
          <option value="DIA NO REMUNERADO" ${n.estado === 'DIA NO REMUNERADO' ? 'selected' : ''}>Dia no remunerado</option>
          <option value="CALAMIDAD" ${n.estado === 'CALAMIDAD' ? 'selected' : ''}>Calamidad</option>
          <option value="RENUNCIA" ${n.estado === 'RENUNCIA' ? 'selected' : ''}>Renuncia</option>
        </select>
      </td>
      <td>
        <button class="btn-small" data-id="${n.id}">Quitar</button>
      </td>
    `;
    
    novedadesBody.appendChild(tr);
  });
  
  // Eventos para los selects
  document.querySelectorAll('.estado-select').forEach(select => {
    select.addEventListener('change', async (e) => {
      const id = e.target.getAttribute('data-id');
      const nuevoEstado = e.target.value;
      const globalIndex = novedades.findIndex(n => String(n.id) === String(id));
      if (globalIndex !== -1) {
        try {
          await updateNovedadEstadoInSupabase(id, nuevoEstado);
          novedades[globalIndex].estado = nuevoEstado;
          renderNovedades();
          renderDrivers(); // Actualizar disponibles
        } catch (error) {
          console.error("Error actualizando novedad:", error);
          alert(`No se pudo actualizar la novedad en Supabase.\n${error?.message || ""}`);
          renderNovedades();
        }
      }
    });
  });
  
  // Eventos para botones de quitar
  document.querySelectorAll('.btn-small').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = e.target.getAttribute('data-id');
      const globalIndex = novedades.findIndex(n => String(n.id) === String(id));
      if (globalIndex !== -1) {
        try {
          await deleteNovedadInSupabase(id);
          novedades.splice(globalIndex, 1);
          renderNovedades();
          renderDrivers(); // Actualizar disponibles
        } catch (error) {
          console.error("Error eliminando novedad:", error);
          alert("No se pudo eliminar la novedad en Supabase.");
        }
      }
    });
  });
  renderLiveExcelPreview();
}

function refreshVisorDateOptions(){
  if (!visorDateSelect) return;
  const prev = visorDateSelect.value || "";
  const dates = getAllAvailableDatesFromRows();
  visorDateSelect.innerHTML = `<option value="">Selecciona fecha...</option>`;
  dates.forEach(iso => {
    const op = document.createElement("option");
    op.value = iso;
    op.textContent = excelDateToReadable(iso);
    visorDateSelect.appendChild(op);
  });
  if (prev && dates.includes(prev)) {
    visorDateSelect.value = prev;
  } else if (dates.length > 0) {
    visorDateSelect.value = dates[dates.length - 1];
  } else {
    visorDateSelect.value = "";
  }
}

function renderLiveExcelPreview(){
  if (!liveExcelPreview) return;
  if (!rows.length) {
    liveExcelPreview.innerHTML = `<div class="muted" style="padding:12px;text-align:center">No hay datos para visualizar.</div>`;
    return;
  }

  const fechaKey = getFechaKey();
  const puestoKey = getHeaderKeyByNorm(["PUESTO"]);
  const numeroKey = getHeaderKeyByNorm(["#"]);
  const vehiculoKey = getHeaderKeyByNorm(["VEH", "VEHICULO", "VEHÍCULO", "MOVIL", "MÓVIL"]);
  const horaFinKey = getHeaderKeyByNorm(["HORA FIN", "HORA FINAL"]);
  const headerSet = new Set();
  rows.slice(0, 200).forEach(r => Object.keys(r || {}).forEach(k => headerSet.add(k)));
  const { key1: horaInicio1Key, key2: horaInicio2Key } = inferInicioKeysFromList(Array.from(headerSet));
  const { key1: conductor1Key, key2: conductor2Key } = getConductorKeysFromRows();

  const visorDate = normalizeDateToISO(visorDateSelect?.value || "");
  if (!visorDate) {
    liveExcelPreview.innerHTML = `<div class="muted" style="padding:12px;text-align:center">Selecciona una fecha en el visor para ver toda la programacion de todas las bases.</div>`;
    return;
  }

  let ordered = rows.slice();
  if (fechaKey) ordered = ordered.filter(r => normalizeDateToISO(r[fechaKey]) === visorDate);
  const scopeMode = String(visorScopeSelect?.value || "all");
  if (scopeMode === "base") {
    const baseScope = getBaseCanonical(currentUserBase);
    if (baseScope) {
      ordered = ordered.filter(r => getRowCanonicalBase(r) === baseScope);
    }
  }
  ordered = dedupeProgramacionRows(ordered).rows;

  if (!ordered.length) {
    liveExcelPreview.innerHTML = `<div class="muted" style="padding:12px;text-align:center">No hay filas para ${excelDateToReadable(visorDate)} con el filtro seleccionado.</div>`;
    return;
  }

  if (!ordered.length) {
    liveExcelPreview.innerHTML = `<div class="muted" style="padding:12px;text-align:center">No hay filas para ${excelDateToReadable(visorDate)}.</div>`;
    return;
  }

  const orderedEntries = buildOperationalEntries(ordered, puestoKey, numeroKey);
  const groupedSections = groupOperationalEntriesByPuesto(orderedEntries);
  const baseKey = getBaseKey();
  const fichoAssignments = buildFichoAssignmentsByIndex(groupedSections, vehiculoKey, { baseKey, fechaKey });

  const formatConductorForPreview = (rowObj, conductorKey) => {
    if (!conductorKey) return "";
    const raw = String(rowObj?.[conductorKey] || "");
    const note = getConductorNote(rowObj, conductorKey);
    const assigned = extractConductorName(raw);
    const isUnassigned = !raw || norm(raw) === UNASSIGNED_LABEL || !assigned;
    if (!note || !isUnassigned) return raw;
    return `${UNASSIGNED_LABEL}\nNOTA: ${note}`;
  };

  const leftRows = [];
  const titleDate = formatDateLongEs(visorDate);
  const openSection = (puestoLabel) => {
    const sectionDisplay = getOperationalSectionDisplayName(puestoLabel);
    if (leftRows.length > 0) leftRows.push({ type: "spacer" });
    leftRows.push({ type: "sectionTitle", title: `${String(sectionDisplay || "SIN PUESTO").toUpperCase()} ${titleDate}` });
    leftRows.push({ type: "header" });
  };

  groupedSections.forEach(section => {
    const sectionLabel = canonicalizePuestoLabel(section.puesto);
    const sectionEntries = getSectionEntriesForOperationalView(sectionLabel, section.entries);
    if (!sectionEntries.length) return;
    openSection(sectionLabel);
    sectionEntries.forEach(entry => {
      const r = entry.row;
      const isFichoMarker = entry.isFichoMarker;
      const turnNum = getNumericTurnNumber(numeroKey ? r[numeroKey] : "");
      let vehRaw = String(vehiculoKey ? (r[vehiculoKey] || "") : "").trim();
      const isNutibara = norm(sectionLabel).includes("NUTIBARA");
      let vehColor = null;
      if (isNutibara && turnNum && turnNum >= 1 && turnNum <= 10) {
        const rowBase = getRowCanonicalBase(r, baseKey);
        const rowDate = getRowDateISO(r, fechaKey) || visorDate;
        const groupKey = `${rowBase || ""}|${rowDate || ""}`;
        const assigned = fichoAssignments.get(groupKey)?.get(turnNum);
        if (assigned?.veh) {
          vehRaw = String(assigned.veh);
          vehColor = assigned.color || null;
        }
      }
      const vehNote = getVehiculoNote(r);
      const vehVal = vehNote ? `${vehRaw}\nCOMENTARIO: ${vehNote}` : vehRaw;

      leftRows.push({
        type: "data",
        isFicho: isFichoMarker,
        fichoBlue: isFichoMarker && norm(sectionLabel).includes("EXPOSICIONES"),
        vehColor,
        cells: [
          numeroKey ? (r[numeroKey] || (entry.idx + 1)) : (entry.idx + 1),
          horaInicio1Key ? excelTimeToHHMM(r[horaInicio1Key]) : "",
          vehVal,
          formatConductorForPreview(r, conductor1Key),
          horaInicio2Key ? excelTimeToHHMM(r[horaInicio2Key]) : "",
          formatConductorForPreview(r, conductor2Key),
          horaFinKey ? excelTimeToHHMM(r[horaFinKey]) : ""
        ]
      });
    });
  });

  let novedadesDelDia = (novedades || []).filter(n => normalizeDateToISO(n.fecha) === visorDate);
  if (scopeMode === "base") {
    const baseScope = getBaseCanonical(currentUserBase);
    if (baseScope) novedadesDelDia = novedadesDelDia.filter(n => sameBase(n.base, baseScope));
  }
  const novRows = novedadesDelDia.length
    ? novedadesDelDia.map(n => [n.base || "-", n.nombre || "-", n.estado || "-"])
    : [["-", "Sin novedades", "-"]];

  const rightRowsCount = 2 + novRows.length;
  const totalRows = Math.max(leftRows.length, rightRowsCount);
  const cellBase = "padding:6px;border:1px solid #d1d5db;font-size:12px;vertical-align:middle";

  let html = `<table style="width:100%;border-collapse:collapse;table-layout:fixed;background:#fff">`;
  html += `<colgroup>
    <col style="width:6%"><col style="width:8%"><col style="width:7%"><col style="width:22%">
    <col style="width:8%"><col style="width:22%"><col style="width:8%"><col style="width:2%">
    <col style="width:10%"><col style="width:20%"><col style="width:10%">
  </colgroup>`;

  for (let i = 0; i < totalRows; i++) {
    const left = leftRows[i] || null;
    const isNovTitle = i === 0;
    const isNovHeader = i === 1;
    const novData = i >= 2 ? novRows[i - 2] : null;
    html += `<tr>`;

    if (left?.type === "sectionTitle") {
      html += `<td colspan="7" style="${cellBase};font-weight:900;text-align:center;background:#f8fafc;font-size:18px">${escapeHtml(left.title)}</td>`;
    } else if (left?.type === "header") {
      const hStyle = `${cellBase};font-weight:800;text-align:center;background:#fff59d`;
      ["#", "INICIA", "VEH", "CONDUCTOR 1", "INICIA", "CONDUCTOR 2", "HORA FIN"].forEach(h => {
        html += `<td style="${hStyle}">${escapeHtml(h)}</td>`;
      });
    } else if (left?.type === "data") {
      const fichoBg = left.isFicho ? (left.fichoBlue ? "background:#2563eb;color:#fff;font-weight:700" : "background:#16a34a;color:#fff;font-weight:700") : "";
      left.cells.forEach((val, idx) => {
        let extra = "text-align:center;white-space:pre-line";
        if (idx === 2 && left.vehColor && !left.isFicho) {
          extra += left.vehColor === "blue"
            ? ";background:#2563eb;color:#fff;font-weight:700"
            : ";background:#16a34a;color:#fff;font-weight:700";
        } else if (fichoBg) {
          extra += `;${fichoBg}`;
        }
        html += `<td style="${cellBase};${extra}">${escapeHtml(val)}</td>`;
      });
    } else {
      for (let c = 0; c < 7; c++) html += `<td style="${cellBase}"></td>`;
    }

    html += `<td style="${cellBase};background:#ffffff"></td>`;
    if (isNovTitle) {
      html += `<td colspan="3" style="${cellBase};font-weight:900;text-align:center;background:#f8fafc;font-size:16px">NOVEDADES DEL DIA</td>`;
    } else if (isNovHeader) {
      const h2 = `${cellBase};font-weight:800;text-align:center;background:#fff59d`;
      html += `<td style="${h2}">BASE</td><td style="${h2}">CONDUCTOR</td><td style="${h2}">ESTADO</td>`;
    } else if (novData) {
      html += `<td style="${cellBase};text-align:center">${escapeHtml(novData[0])}</td>`;
      html += `<td style="${cellBase};text-align:center;white-space:pre-line">${escapeHtml(novData[1])}</td>`;
      html += `<td style="${cellBase};text-align:center">${escapeHtml(novData[2])}</td>`;
    } else {
      html += `<td style="${cellBase}"></td><td style="${cellBase}"></td><td style="${cellBase}"></td>`;
    }
    html += `</tr>`;
  }

  html += `</table>`;
  liveExcelPreview.innerHTML = html;
}

function exportLiveExcelPreviewTable(){
  if (!liveExcelPreview) {
    showToast("Visor no disponible.", "warn");
    return;
  }
  const table = liveExcelPreview.querySelector("table");
  if (!table) {
    showToast("No hay tabla en el visor para exportar.", "warn");
    return;
  }
  if (!window.XLSX || !XLSX.utils || !XLSX.writeFile) {
    showToast("No se pudo cargar XLSX para exportar.", "err");
    return;
  }
  const wb = XLSX.utils.table_to_book(table, { sheet: "Visor" });
  const visorDate = normalizeDateToISO(visorDateSelect?.value || "");
  const scopeMode = String(visorScopeSelect?.value || "all");
  const scopeText = scopeMode === "base" ? "base" : "todo";
  const fileDate = visorDate || "sin_fecha";
  XLSX.writeFile(wb, `visor_excel_${fileDate}_${scopeText}.xlsx`);
}

/* ===================== TABLA PROGRAMACION ===================== */
function renderTable(){
  if (Array.isArray(rows) && rows.length > 1) {
    syncNutibaraTop10FromFichos();
    const deduped = dedupeProgramacionRows(rows);
    if (deduped.removed > 0) rows = deduped.rows;
  }
  gridHead.innerHTML = '';
  gridBody.innerHTML = '';
  adjustDynamicTableViewport();
  refreshFilterDateOptions();
  refreshVisorDateOptions();
  autoSelectDateForBaseOperator();
  updateWorkflowGuide();

  if(rows.length === 0){
    gridBody.innerHTML = `<tr><td colspan="99" class="muted" style="padding:20px;text-align:center">
      ${isBaseOperator()
        ? "No hay programacion disponible para tu base en este momento. Contacta al administrador."
        : "Carga un archivo de programacion en el panel de administracion"}
    </td></tr>`;
    renderDrivers();
    return;
  }

  const rawHeaders = Object.keys(rows[0]).filter(h => h.toUpperCase() !== "HOJA" && !isInternalRowKey(h));
  const preferredHeaderOrder = [
    "#",
    "INICIA",
    "VEH",
    "CONDUCTOR 1",
    "INICIA 2",
    "CONDUCTOR 2",
    "HORA FIN"
  ];
  const normalizeHeaderToken = (h) => normCompact(h).replace(/[^A-Z0-9]/g, "");
  const headerTokens = new Map(rawHeaders.map(h => [h, normalizeHeaderToken(h)]));
  const aliases = {
    "#": ["#"],
    "INICIA": ["INICIA", "INICIO", "HORAINICIO1", "HORAINICIO"],
    "VEH": ["VEH", "VEHICULO", "VEHÍCULO", "MOVIL", "MÓVIL"],
    "CONDUCTOR 1": ["CONDUCTOR1", "CONDUCTOI1", "CONDUCTOR", "CONDUCTOI"],
    "INICIA 2": ["INICIA2", "INICIO2", "HORAINICIO2"],
    "CONDUCTOR 2": ["CONDUCTOR2", "CONDUCTOI2"],
    "HORA FIN": ["HORAFIN", "HORAFINAL", "FIN"]
  };
  const used = new Set();
  const orderedHeaders = [];
  preferredHeaderOrder.forEach(label => {
    const bucket = aliases[label] || [];
    const found = rawHeaders.find(h => {
      if (used.has(h)) return false;
      const t = headerTokens.get(h);
      return bucket.some(a => t === normalizeHeaderToken(a));
    });
    if (found) {
      used.add(found);
      orderedHeaders.push(found);
    }
  });
  rawHeaders.forEach(h => {
    if (!used.has(h)) orderedHeaders.push(h);
  });
  const headers = orderedHeaders;
  const headRow = document.createElement('tr');
  headers.forEach(h => {
    const th = document.createElement('th');
    th.textContent = h;
    headRow.appendChild(th);
  });
  const canDeleteRows = isSuperAdmin();
  if (canDeleteRows) {
    const thAction = document.createElement("th");
    thAction.textContent = "Acciones";
    headRow.appendChild(thAction);
  }
  gridHead.appendChild(headRow);

  const baseKey = getBaseKey();
  const fechaKey = getFechaKey();
  const vehiculoKey = headers.find(h => {
    const n = norm(h);
    return n === "VEH" || n === "VEHICULO" || n === "VEHÍCULO" || n === "MOVIL" || n === "MÓVIL";
  }) || null;
  const vehiculoSwapEnabled = isSuperAdmin() || getBaseCanonical(currentBase) === "3";
  const puestoKey = headers.find(h => norm(h) === "PUESTO") || null;
  const numeroKey = headers.find(h => norm(h) === "#") || null;
  const iniciaKey = headers.find(h => {
    const t = normCompact(h).replace(/[^A-Z0-9]/g, "");
    return t === "INICIA" || t === "INICIO" || t === "HORAINICIO1" || t === "HORAINICIO";
  }) || null;
  const { key1: conductor1Key, key2: conductor2Key } = getConductorKeysFromRows();
  const selectedDate = document.getElementById('filterDate').value;

  if (currentBase && !selectedDate) {
    gridBody.innerHTML = `<tr><td colspan="99" class="muted" style="padding:20px;text-align:center">
      Paso 1: selecciona una fecha para continuar con la asignacion.
    </td></tr>`;
    renderDrivers();
    return;
  }

  let filteredRows = rows.slice();
  if(currentBase){
    const currentCanonicalBase = getBaseCanonical(currentBase);
    filteredRows = filteredRows.filter(r => {
      const rowBase = getRowCanonicalBase(r, baseKey);
      return rowBase === currentCanonicalBase;
    });
  }
  if(selectedDate && fechaKey){
    filteredRows = filteredRows.filter(r => normalizeDateToISO(r[fechaKey]) === selectedDate);
  }

  if (filteredRows.length === 0) {
    const baseText = currentBase ? ` para ${currentBase}` : "";
    gridBody.innerHTML = `<tr><td colspan="99" class="muted" style="padding:20px;text-align:center">
      No hay filas disponibles${baseText} con los filtros actuales.
    </td></tr>`;
    renderDrivers();
    return;
  }

  rebuildAssigned();

  let activePuestoForFichoColor = "";
  filteredRows.forEach((r) => {
    ensureRowUiId(r);
    const tr = document.createElement('tr');
    const rowCanonicalBase = getRowCanonicalBase(r, baseKey);
    const puestoRowVal = puestoKey ? norm(r[puestoKey]) : "";
    const numeroRowVal = numeroKey ? norm(r[numeroKey]) : "";
    const baseRowVal = norm(rowCanonicalBase || "");
    const rowContextGlobal = `${puestoRowVal} ${numeroRowVal} ${baseRowVal}`;
    const isFichoRowGlobal = rowContextGlobal.includes("FICHO");

    if (!isFichoRowGlobal && puestoRowVal) {
      activePuestoForFichoColor = puestoRowVal;
    }
    const isExposRow = isFichoRowGlobal
      ? activePuestoForFichoColor.includes("EXPOSICIONES")
      : rowContextGlobal.includes("EXPOSICIONES");
    if (isFichoRowGlobal) {
      tr.classList.add(isExposRow ? "ficho-expos" : "ficho-sandiego");
    }

    headers.forEach(k => {
      const td = document.createElement('td');
      let v = r[k];
      const puestoVal = puestoKey ? norm(r[puestoKey]) : "";
      const numeroVal = numeroKey ? norm(r[numeroKey]) : "";
      const baseVal = norm(rowCanonicalBase || "");
      const rowContext = `${puestoVal} ${numeroVal} ${baseVal}`;
      const isFichoRow = rowContext.includes("FICHO");

      if(norm(k) === "FECHA") v = excelDateToReadable(v);
      if(isTimeColumnKey(k)) v = excelTimeToHHMM(v);

      if ((conductor1Key && k === conductor1Key) || (conductor2Key && k === conductor2Key)){
        td.classList.add('drop');
        const isWaiting = !v || norm(v) === UNASSIGNED_LABEL;
        const noteText = getConductorNote(r, k);
        const needsAction = isWaiting && !noteText && !isFichoRowGlobal;
        const rowLabel = getSwapRowLabel(r, { numeroKey, puestoKey, iniciaKey });
        if (!isWaiting) td.classList.add('filled');
        if (needsAction) td.classList.add("slot-unresolved");
        
        // Procesar el valor
        if (isWaiting) {
          td.innerHTML = `
            <span class="muted">${UNASSIGNED_LABEL}</span>
            <span class="estado-tag tag-pendiente">Esperando asignacion</span>
            ${needsAction ? `<span class="slot-hint">Agrega conductor o nota</span>` : ""}
            ${(!needsAction && noteText) ? `<span class="slot-note-ok">Nota registrada</span>` : ""}
            ${noteText ? `<div class="cell-note">${noteText}</div>` : ""}
            <button class="btn-note" type="button">${noteText ? "Editar nota" : "Agregar nota"}</button>
          `;
        } else if (v) {
          const match = v.match(/^(.*?)\s*\[(DISPONIBLE|INCAPACITADO|PERMISO|DESCANSO|VACACIONES|RECONOCIMIENTO DE RUTA|DIA NO REMUNERADO|CALAMIDAD)\]\s*$/);
          if (match) {
            const nombre = match[1];
            const novedad = match[2];
            const novedadDef = NOVEDADES[novedad] || NOVEDADES.PENDIENTE;
            td.innerHTML = `
              ${nombre}
              <span class="base-badge">${formatBaseLabel(rowCanonicalBase || '')}</span>
              <span class="estado-tag tag-${novedadDef.class}">${novedad}</span>
            `;
          } else {
            td.innerHTML = `
              ${v}
              <span class="base-badge">${formatBaseLabel(rowCanonicalBase || '')}</span>
            `;
          }
        }

        if (isWaiting) {
          const noteBtn = td.querySelector(".btn-note");
          if (noteBtn) {
            noteBtn.onclick = async (ev) => {
              ev.preventDefault();
              ev.stopPropagation();
              const result = await openConductorNoteModal({
                note: getConductorNote(r, k),
                label: `${rowLabel} - ${k}`
              });
              if (!result || result.action === "cancel") return;
              if (result.action === "clear") setConductorNote(r, k, "");
              else if (result.action === "save") setConductorNote(r, k, result.text);
              renderTable();
              showToast(result.action === "clear" ? "Nota eliminada." : "Nota guardada.", "ok");
              await syncProgramacionRowsToSupabase("Nota de casilla guardada.");
            };
          }
        }

        // Eventos drag & drop (solo para la tabla de programacion)
        td.ondragover = ev => {
          if (isFichoRowGlobal) return;
          ev.preventDefault();
          autoScrollDuringDrag(ev.clientY);
          td.classList.add('highlight');
        };
        td.ondragleave = () => td.classList.remove('highlight');
        
        td.ondrop = async ev => {
          if (isFichoRowGlobal) {
            ev.preventDefault();
            showToast("Fila FICHO: no se permite asignar conductor.", "warn");
            return;
          }
          ev.preventDefault();
          td.classList.remove('highlight');
          highlightDropTargets(false);
          
          try {
            const data = JSON.parse(ev.dataTransfer.getData('text/plain'));
            
            if (data.tipo === 'conductor') {
              const existingName = extractConductorName(r[k] || "");
              if (existingName && norm(existingName) !== norm(data.nombre)) {
                const ok = confirm(`La celda ya tiene a ${existingName}. Deseas reemplazarlo por ${data.nombre}?`);
                if (!ok) return;
              }
              r[k] = data.nombre;
              setConductorNote(r, k, "");
              document.getElementById('btnExport').disabled = false;
              renderTable();
              renderDrivers();
              showToast(`Asignado ${data.nombre} en ${k}`, "ok");
              await syncProgramacionRowsToSupabase(`Asignacion guardada en ${k}.`);
            }
          } catch (e) {
            console.error('Error parsing drop data', e);
            showToast("No se pudo asignar el conductor.", "err");
          }
        };

        td.ondblclick = async () => {
          if (isFichoRowGlobal) return;
          const existingName = extractConductorName(r[k] || "");
          if (!existingName) return;
          const ok = confirm(`Quitar a ${existingName} de ${k}?`);
          if (!ok) return;
          r[k] = UNASSIGNED_LABEL;
          document.getElementById('btnExport').disabled = false;
          renderTable();
          renderDrivers();
          showToast(`${existingName} fue removido de ${k}.`, "warn");
          await syncProgramacionRowsToSupabase(`Remocion guardada en ${k}.`);
        };

      } else if (vehiculoKey && k === vehiculoKey) {
        const vehLabel = v || '';
        const vehNote = getVehiculoNote(r);
        const rowLabel = getSwapRowLabel(r, { numeroKey, puestoKey, iniciaKey });
        if (vehiculoSwapEnabled) td.classList.add("veh-drop");
        td.innerHTML = `
          <div>${vehLabel}</div>
          ${vehNote ? `<div class="cell-note">${vehNote}</div>` : ""}
          <button class="btn-note" type="button">${vehNote ? "Editar comentario" : "Agregar comentario"}</button>
        `;
        td.title = vehiculoSwapEnabled
          ? (isSuperAdmin() ? "Admin: arrastra sobre otro vehiculo para intercambiar posicion" : "BASE 3: arrastra sobre otro vehiculo para intercambiar posicion")
          : "Vehiculo";
        td.draggable = !!r[k] && vehiculoSwapEnabled;

        const vehNoteBtn = td.querySelector(".btn-note");
        if (vehNoteBtn) {
          vehNoteBtn.onclick = async (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            const result = await openConductorNoteModal({
              title: "Comentario del carro",
              note: getVehiculoNote(r),
              label: `${rowLabel} - VEH ${vehLabel || "-"}`,
            });
            if (!result || result.action === "cancel") return;
            if (result.action === "clear") setVehiculoNote(r, "");
            else if (result.action === "save") setVehiculoNote(r, result.text);
            renderTable();
            showToast(result.action === "clear" ? "Comentario de carro eliminado." : "Comentario de carro guardado.", "ok");
            await syncProgramacionRowsToSupabase("Comentario de carro guardado.");
          };
        }

        if (!vehiculoSwapEnabled) {
          tr.appendChild(td);
          return;
        }

        td.ondragstart = ev => {
          const sourceValue = r[k];
          if (!sourceValue) {
            ev.preventDefault();
            return;
          }
          const sourceLabel = getSwapRowLabel(r, { numeroKey, puestoKey, iniciaKey });
          td.classList.add("highlight");
          ev.dataTransfer.setData("text/plain", JSON.stringify({
            tipo: "vehiculo_posicion",
            sourceRowUiId: ensureRowUiId(r),
            sourceRowKey: buildProgramacionRowKey(r),
            sourceVehiculoKey: k,
            sourceVehiculo: String(sourceValue),
            sourceLabel
          }));
          ev.dataTransfer.effectAllowed = "move";
          showToast(`Cambio de carro: origen ${sourceLabel} (VEH ${sourceValue}).`, "warn");
        };
        td.ondragend = () => td.classList.remove("highlight");
        td.ondragover = ev => {
          ev.preventDefault();
          autoScrollDuringDrag(ev.clientY);
          td.classList.add("highlight");
        };
        td.ondragleave = () => td.classList.remove("highlight");
        td.ondrop = async ev => {
          ev.preventDefault();
          td.classList.remove("highlight");
          try {
            const data = JSON.parse(ev.dataTransfer.getData("text/plain"));
            if (data.tipo !== "vehiculo_posicion") return;

            const sourceRow = rows.find(row => ensureRowUiId(row) === data.sourceRowUiId)
              || rows.find(row => buildProgramacionRowKey(row) === data.sourceRowKey);
            if (!sourceRow) {
              showToast("No se encontro la fila origen para intercambio.", "warn");
              return;
            }
            if (sourceRow === r) return;

            const sourceVehiculoKey = data.sourceVehiculoKey || vehiculoKey;
            const sourceValue = sourceRow[sourceVehiculoKey];
            const targetValue = r[k];
            const sourceLabel = data.sourceLabel || getSwapRowLabel(sourceRow, { numeroKey, puestoKey, iniciaKey });
            const targetLabel = getSwapRowLabel(r, { numeroKey, puestoKey, iniciaKey });
            const ok = await confirmVehicleSwapModal({
              sourceLabel,
              targetLabel,
              sourceVeh: sourceValue || "-",
              targetVeh: targetValue || "-"
            });
            if (!ok) {
              showToast("Cambio de carro cancelado.", "warn");
              return;
            }
            sourceRow[sourceVehiculoKey] = targetValue;
            r[k] = sourceValue;
            const conductorSync = syncConductoresAfterVehicleSwap(sourceRow, r, conductor1Key, conductor2Key);
            const sourceIsFicho = isFichoRowByContent(sourceRow);
            const targetIsFicho = isFichoRowByContent(r);
            const fichoUpdated = (sourceIsFicho || targetIsFicho)
              ? 0
              : syncFichoVehicleLinksAfterSwap({
                  sourceVeh: sourceValue,
                  targetVeh: targetValue,
                  selectedDate,
                  currentBase,
                  baseKey,
                  fechaKey,
                  conductorKey1: conductor1Key,
                  conductorKey2: conductor2Key,
                  excludedRows: [sourceRow, r]
                });
            const nutibaraTopUpdated = syncNutibaraTop10FromFichos({
              selectedDate,
              currentBase,
              baseKey,
              fechaKey,
              puestoKey,
              numeroKey,
              vehiculoKey
            });
            const dedupedAfterSwap = dedupeProgramacionRows(rows);
            if (dedupedAfterSwap.removed > 0) {
              rows = dedupedAfterSwap.rows;
            }
            rows = getRowsOrderedByCurrentReference(rows);

            document.getElementById('btnExport').disabled = false;
            renderTable();
            renderLiveExcelPreview();
            const conductorMsg = conductorSync.blockedByFicho
              ? " | FICHO sin conductor"
              : (conductorSync.swapped ? " | Conductores movidos con el carro" : "");
            showToast(`Cambio confirmado: ${sourceValue || "-"} <-> ${targetValue || "-"}${conductorMsg}${fichoUpdated ? ` | FICHO actualizados: ${fichoUpdated}` : ""}${nutibaraTopUpdated ? ` | NUTIBARA top10: ${nutibaraTopUpdated}` : ""}${dedupedAfterSwap.removed ? ` | Duplicados limpiados: ${dedupedAfterSwap.removed}` : ""}`, "ok");
            await syncProgramacionRowsToSupabase("Cambio de posicion de vehiculos guardado.");
          } catch (e) {
            console.error("Error intercambio vehiculos", e);
            showToast("No se pudo intercambiar la posicion de vehiculos.", "err");
          }
        };
      } else {
        td.textContent = v || '';
      }

      const isConductorCell = (conductor1Key && k === conductor1Key) || (conductor2Key && k === conductor2Key);
      if (isConductorCell && isFichoRow) {
        const contextText = `${rowContext} ${norm(currentBase)} ${norm(lblCurrentBase?.textContent || "")}`;
        if (contextText.includes("EXPOSICIONES")) {
          td.classList.add("tag-ficho-expos");
        } else {
          td.classList.add("tag-ficho-sandiego");
        }
      }

      tr.appendChild(td);
    });

    if (canDeleteRows) {
      const tdAction = document.createElement("td");
      const btnDel = document.createElement("button");
      btnDel.className = "btn-small";
      btnDel.textContent = "Eliminar fila";
      btnDel.onclick = async () => {
        const rowLabel = getSwapRowLabel(r, { numeroKey, puestoKey, iniciaKey });
        const ok = confirm(`Eliminar esta fila?\n${rowLabel}`);
        if (!ok) return;
        const idx = rows.indexOf(r);
        if (idx === -1) {
          showToast("No se encontro la fila para eliminar.", "warn");
          return;
        }
        rows.splice(idx, 1);
        document.getElementById('btnExport').disabled = false;
        renderTable();
        renderDrivers();
        renderNovedades();
        showToast("Fila eliminada por administrador.", "ok");
        await syncProgramacionRowsToSupabase("Fila eliminada por administrador.");
      };
      tdAction.appendChild(btnDel);
      tr.appendChild(tdAction);
    }
    gridBody.appendChild(tr);
  });

  renderDrivers();
  renderAdminComplianceDashboard();
  renderConsultaBaseView();
  renderLiveExcelPreview();
}

/* ===================== PESTANAS ===================== */
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    // Desactivar todas las pestanas
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    
    // Activar la pestana seleccionada
    tab.classList.add('active');
    const tabId = tab.getAttribute('data-tab');
    document.getElementById(`tab-${tabId}`).classList.add('active');
    
    // Si es la pestana de novedades, renderizar
    if (tabId === 'novedades') {
      renderNovedades();
    }
    if (tabId === 'planilla-afiliados') {
      ensureFreshPlanillaData({ force: true });
    }
    if (tabId === 'llegadas-aeropuerto') {
      ensureFreshPlanillaData({ force: true });
    }
    if (tabId === 'llegadas-san-diego') {
      ensureFreshPlanillaData({ force: true });
    }
    if (tabId === 'llegadas-nutibara') {
      ensureFreshPlanillaData({ force: true });
    }
    if (tabId === 'consulta') {
      renderConsultaBaseView();
    }
    if (tabId === 'visor') {
      refreshVisorDateOptions();
      renderLiveExcelPreview();
    }
    if (tabId === 'debugsupabase') {
      renderSupabaseDebug();
    }
    if (tabId === 'audit' && !AUDIT_DISABLED) {
      loadAuditLogFromSupabase();
    }
    adjustDynamicTableViewport();
  });
});

// Hacer que la tabla de novedades acepte drops
const novedadesGrid = document.getElementById('novedadesGrid');
if (novedadesGrid) {
  novedadesGrid.ondragover = ev => {
    ev.preventDefault();
    autoScrollDuringDrag(ev.clientY);
  };
  novedadesGrid.ondrop = async ev => {
    ev.preventDefault();
    
    try {
      const data = JSON.parse(ev.dataTransfer.getData('text/plain'));
      
      if (data.tipo === 'conductor') {
        const selectedDate = getSelectedOperativeDateISO();
        if (!selectedDate) {
          showToast("Selecciona una fecha antes de registrar novedades.", "warn");
          return;
        }
        // Verificar que el conductor no este ya en novedades
        const existe = novedades.some(n => 
          n.nombre === data.nombre &&
          sameBase(n.base, data.base) &&
          normalizeDateToISO(n.fecha) === selectedDate
        );
        
        if (existe) {
          alert('Este conductor ya esta en la tabla de novedades para la fecha seleccionada');
          showToast("Ese conductor ya tiene novedad en esta base y fecha.", "warn");
          return;
        }
        
        const nueva = await createNovedadInSupabase({
          nombre: data.nombre,
          base: formatBaseLabel(data.base),
          estado: 'PENDIENTE',
          fecha: selectedDate
        });
        novedades.unshift(nueva);
        
        renderNovedades();
        renderDrivers(); // Actualizar lista de disponibles
      }
    } catch (e) {
      console.error('Error creando novedad', e);
      const detail = String(e?.message || "");
      const duplicateHint = detail.toLowerCase().includes("duplicate key")
        ? "\nPosible causa: indice unico de novedades sin fecha."
        : "";
      alert(`No se pudo guardar la novedad en Supabase.\n${detail}${duplicateHint}`);
      setSyncStatus("err", "Error novedades");
    }
  };
}

/* ===================== ARCHIVO ===================== */
async function readFile(file){
  setSyncStatus("warn", "Validando archivo...");
  const parsedRows = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = new Uint8Array(e.target.result);
        const wb = XLSX.read(data, {type:'array'});
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(ws, { defval: "", raw: true });
        const prepared = normalizeProgramacionRows(json);
        validateProgramacionRows(prepared.normalized);
        if (prepared.unmappedVehicles > 0) {
          showToast(`Atencion: ${prepared.unmappedVehicles} vehiculos sin base mapeada.`, "warn");
          setSyncStatus("warn", "Mapeo parcial");
        }
        resolve(prepared.normalized);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });

  const adminDayDate = normalizeDateToISO(document.getElementById("adminDayDate")?.value || "");
  const scopedDayImport = isSuperAdmin() && /^\d{4}-\d{2}-\d{2}$/.test(adminDayDate);
  let nextRows = parsedRows;

  if (scopedDayImport) {
    const incomingFechaKey = getFechaKeyFromArray(parsedRows);
    const existingFechaKey = getFechaKeyFromArray(rows);
    const incomingParts = partitionRowsByDate(parsedRows, adminDayDate, incomingFechaKey);
    if (incomingParts.selected.length === 0) {
      const detectedDates = Array.from(new Set(
        parsedRows
          .map(r => getRowDateISO(r, incomingFechaKey))
          .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(String(d || "")))
      )).sort((a, b) => a.localeCompare(b));
      const detectedText = detectedDates.length
        ? detectedDates.map(excelDateToReadable).join(", ")
        : "ninguna fecha valida";
      throw new Error(
        `El archivo no contiene filas para ${excelDateToReadable(adminDayDate)}. Fechas detectadas: ${detectedText}.`
      );
    }

    const existingParts = partitionRowsByDate(rows, adminDayDate, existingFechaKey);
    const mergeResult = mergeImportedRowsPreservingAssignments(incomingParts.selected, existingParts.selected);
    nextRows = existingParts.rest.concat(mergeResult.mergedRows);
    showToast(
      `Dia ${excelDateToReadable(adminDayDate)} reemplazado (${incomingParts.selected.length} filas, ${mergeResult.preservedAssignments} asignaciones conservadas).`,
      "ok"
    );
  } else {
    const mergeResult = mergeImportedRowsPreservingAssignments(parsedRows, rows);
    // Mantener el historial de dias: combina lo importado con lo existente
    // en lugar de reemplazar por completo cuando no se usa "Dia a editar".
    nextRows = mergeLatestRowsIntoConsolidatedRows(rows, mergeResult.mergedRows);
    if (mergeResult.matchedRows > 0) {
      showToast(
        `Importacion combinada: ${mergeResult.preservedAssignments} asignaciones conservadas (${mergeResult.matchedRows} filas coinciden).`,
        "ok"
      );
    } else if (rows.length > 0) {
      const addedRows = Math.max(0, nextRows.length - rows.length);
      showToast(`Importacion anexada: ${addedRows} filas nuevas agregadas.`, "ok");
    }
  }

  rows = nextRows;
  updateExportAccess();
  fillStartBases();
  if (currentBase) refreshFilterDateOptions();
  try {
    await saveProgramacionToSupabase(file, nextRows);
  } catch (error) {
    console.error("No se pudo persistir en Supabase:", error);
    lblGlobal.textContent = `Archivo cargado localmente: ${file.name} | Filas: ${rows.length}`;
    setSyncStatus("warn", "Solo local");
    alert("El archivo se cargo, pero no se pudo guardar en Supabase. Revisa tablas/politicas.");
  }

  if(currentBase){
    operativoInner.classList.remove("hidden");
    renderTable();
    renderDrivers();
  }
}

/* ===================== NAVEGACION ===================== */
function enterBase(base){
  const nextBase = getBaseCanonical(base);
  if(!nextBase) return alert("Selecciona una base operativa valida.");
  if (isBaseOperator() && nextBase !== getBaseCanonical(currentUserBase)) {
    showToast(`Acceso restringido a ${formatBaseLabel(currentUserBase)}.`, "warn");
    return;
  }
  if (currentBase && nextBase !== currentBase && !canMoveOnFromSelectedDate("cambiar de base")) return;
  currentBase = nextBase;

  lblCurrentBase.textContent = `Base: ${formatBaseLabel(currentBase)}`;
  operativoInner.classList.remove("hidden");
  
  refreshFilterDateOptions();
  autoSelectDateForBaseOperator();
  document.getElementById("filterDrivers").value = "";
  
  rebuildAssigned();
  updateWorkflowGuide();
  renderTable();
  renderDrivers();
  renderNovedades();
  if (isSuperAdmin()) {
    showToast("Admin: puedes intercambiar posiciones de vehiculos por arrastre en cualquier base.", "ok");
  } else if (currentBase === "3") {
    showToast("BASE 3: puedes intercambiar posiciones de vehiculos arrastrando un vehiculo sobre otro.", "ok");
  }
}

function exitBase(){
  if (isBaseOperator()) {
    showToast(`La sesion esta fija en ${formatBaseLabel(currentUserBase)}.`, "warn");
    return;
  }
  if (!canMoveOnFromSelectedDate("salir de la base")) return;
  currentBase = "";
  lblCurrentBase.textContent = "Base: -";
  operativoInner.classList.add("hidden");
  refreshFilterDateOptions();
  updateWorkflowGuide();
}

/* ===================== EVENTOS ===================== */
function markTopNavActive(activeButtonId){
  const ids = ["btnGoOperativo", "btnGoLlegadasVehiculos", "btnGoAdmin", "btnGoConverter"];
  ids.forEach(id => {
    const btn = document.getElementById(id);
    if (!btn || btn.classList.contains("hidden")) return;
    const isActive = id === activeButtonId;
    btn.classList.toggle("btn-primary", isActive);
    btn.classList.toggle("btn-ghost", !isActive);
  });
}

function setOperativoViewMode(mode){
  operativoViewMode = mode === "llegadas" ? "llegadas" : "operativo";

  const tabs = Array.from(document.querySelectorAll(".tab[data-tab]"));
  const contents = Array.from(document.querySelectorAll(".tab-content[id^='tab-']"));

  tabs.forEach(tab => {
    const tabId = tab.getAttribute("data-tab") || "";
    const isArrivalTab = ARRIVALS_PANEL_TAB_IDS.includes(tabId);
    if (operativoViewMode === "llegadas" && !isArrivalTab) {
      tab.classList.add("hidden");
      tab.dataset.hiddenByLlegadasPanel = "1";
    } else if (tab.dataset.hiddenByLlegadasPanel === "1") {
      tab.classList.remove("hidden");
      delete tab.dataset.hiddenByLlegadasPanel;
    }
  });

  contents.forEach(content => {
    const contentId = content.id || "";
    const tabId = contentId.startsWith("tab-") ? contentId.slice(4) : "";
    const isArrivalContent = ARRIVALS_PANEL_TAB_IDS.includes(tabId);
    if (operativoViewMode === "llegadas" && !isArrivalContent) {
      content.classList.remove("active");
      content.classList.add("hidden");
      content.dataset.hiddenByLlegadasPanel = "1";
    } else if (content.dataset.hiddenByLlegadasPanel === "1") {
      content.classList.remove("hidden");
      delete content.dataset.hiddenByLlegadasPanel;
    }
  });

  if (operativoViewMode === "llegadas") {
    const activeId = getActiveTabId();
    if (!ARRIVALS_PANEL_TAB_IDS.includes(activeId)) {
      const firstArrivalTab = document.querySelector(`.tab[data-tab="${ARRIVALS_PANEL_TAB_IDS[0]}"]`);
      if (firstArrivalTab) firstArrivalTab.click();
    }
  }

  const operativoTitle = document.getElementById("operativoMainTitle") || document.querySelector("#operativoPanel h2");
  if (operativoTitle && !isBaseOperator()) {
    operativoTitle.textContent = operativoViewMode === "llegadas" ? "Panel de llegadas vehiculos" : "Panel de operacion";
  }
}

function showAdminPanel(){
  setOperativoViewMode("operativo");
  adminPanel.classList.remove("hidden");
  if (converterPanel) converterPanel.classList.add("hidden");
  operativoPanel.classList.add("hidden");
  markTopNavActive("btnGoAdmin");
}

function showOperativoPanel(){
  setOperativoViewMode("operativo");
  adminPanel.classList.add("hidden");
  if (converterPanel) converterPanel.classList.add("hidden");
  operativoPanel.classList.remove("hidden");
  markTopNavActive("btnGoOperativo");
}

function showLlegadasVehiculosPanel(){
  adminPanel.classList.add("hidden");
  if (converterPanel) converterPanel.classList.add("hidden");
  operativoPanel.classList.remove("hidden");
  setOperativoViewMode("llegadas");
  markTopNavActive("btnGoLlegadasVehiculos");
}

function showConverterPanel(){
  if (!isSuperAdmin()) return;
  setOperativoViewMode("operativo");
  adminPanel.classList.add("hidden");
  operativoPanel.classList.add("hidden");
  if (converterPanel) converterPanel.classList.remove("hidden");
  markTopNavActive("btnGoConverter");
}

async function handleProgramacionFileChange(e){
  const f = e.target.files[0];
  if(!f) return;
  try {
    setSyncStatus("warn", "Subiendo archivo...");
    await readFile(f);
  } catch (error) {
    console.error("Error procesando archivo:", error);
    setSyncStatus("err", "Archivo invalido");
    alert(error?.message || "No se pudo cargar el archivo en Supabase.");
  }
}

function handleExportProgramacionClick(){
  if (!canExportXlsx()) {
    showToast("Solo el super administrador puede descargar el Excel.", "warn");
    return;
  }
  const exportRows = rows.map(({Hoja,...r}) => {
    const out = { ...r };
    Object.keys(out).forEach(k => {
      if (isInternalRowKey(k)) delete out[k];
    });
    Object.keys(out).forEach(k => {
      if (isTimeColumnKey(k)) {
        out[k] = excelTimeToHHMM(out[k]);
      }
    });
    return out;
  });
  const ws = XLSX.utils.json_to_sheet(exportRows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Programacion");
  XLSX.writeFile(wb, "programacion_conductores.xlsx");
}

function handleClearProgramacionClick(){
  AppState.clearProgramacion();
  lblGlobal.textContent = "Sin archivo cargado";
  updateExportAccess();
  exitBase();
}

async function handleDeleteDayClick(){
  if (!isSuperAdmin()) {
    showToast("Solo el super administrador puede eliminar un dia.", "warn");
    return;
  }
  const dayIso = normalizeDateToISO(document.getElementById("adminDayDate")?.value || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dayIso)) {
    showToast("Selecciona un dia valido para eliminar.", "warn");
    return;
  }
  if (!AppState.hasRows) {
    showToast("No hay programacion cargada.", "warn");
    return;
  }

  const fechaKey = getFechaKeyFromArray(rows);
  const { selected, rest } = partitionRowsByDate(rows, dayIso, fechaKey);
  if (selected.length === 0) {
    showToast(`No hay filas para ${excelDateToReadable(dayIso)}.`, "warn");
    return;
  }

  AppState.replaceRows(rest);
  updateExportAccess();
  fillStartBases();
  if (currentBase) refreshFilterDateOptions();

  const filterDate = document.getElementById("filterDate");
  if (filterDate && filterDate.value === dayIso) {
    filterDate.value = "";
    filterDate.dataset.prevValue = "";
    const clearBtn = document.getElementById("clearFilter");
    if (clearBtn) clearBtn.disabled = true;
  }

  updateWorkflowGuide();
  renderTable();
  renderDrivers();
  renderNovedades();
  lblGlobal.textContent = currentProgramacionFileName
    ? `Programacion en linea: ${currentProgramacionFileName} | Filas: ${rows.length}`
    : `Programacion en linea | Filas: ${rows.length}`;

  await syncProgramacionRowsToSupabase(`Dia ${excelDateToReadable(dayIso)} eliminado (${selected.length} filas).`);
}

async function handleLoadHistoryProgramacionClick(){
  const sel = document.getElementById("historyProgramacion");
  const id = sel?.value || "";
  if (!id) {
    showToast("Selecciona una programacion del historial.", "warn");
    return;
  }
  const rec = programacionesHistory.find(r => String(r.id) === String(id));
  if (!rec) {
    showToast("No se encontro la programacion seleccionada.", "warn");
    return;
  }
  await applyProgramacionRecord(rec);
  renderAdminComplianceDashboard();
  renderConsultaBaseView();
  showToast(`Historial cargado: ${rec.file_name || rec.id}`, "ok");
}

function handleFilterDateChange(){
  const filterDate = document.getElementById("filterDate");
  if (!filterDate) return;
  const previousValue = filterDate.dataset.prevValue || "";
  const newValue = filterDate.value || "";
  if (previousValue && newValue !== previousValue) {
    const status = getDateStatusForBase(previousValue);
    if (status.state === "in_progress" || status.state === "needs_states") {
      showToast(
        `Cambio de fecha permitido. Ojo: ${excelDateToReadable(previousValue)} quedo en estado "${status.label}".`,
        "warn"
      );
    }
  }
  filterDate.dataset.prevValue = newValue;
  const clearFilter = document.getElementById("clearFilter");
  if (clearFilter) clearFilter.disabled = !newValue;
  updateWorkflowGuide();
  renderTable();
  renderNovedades();
}

function handleClearFilterClick(){
  const previousValue = getSelectedOperativeDateISO();
  if (previousValue) {
    const status = getDateStatusForBase(previousValue);
    if (status.state === "in_progress" || status.state === "needs_states") {
      showToast(
        `Filtro limpiado. Ojo: ${excelDateToReadable(previousValue)} quedo en estado "${status.label}".`,
        "warn"
      );
    }
  }
  const filterDateInput = document.getElementById("filterDate");
  if (filterDateInput) {
    filterDateInput.value = "";
    filterDateInput.dataset.prevValue = "";
  }
  const clearFilter = document.getElementById("clearFilter");
  if (clearFilter) clearFilter.disabled = true;
  updateWorkflowGuide();
  renderTable();
  renderNovedades();
}

function bindUIEvents(){
  const btnGoAdmin = document.getElementById("btnGoAdmin");
  if (btnGoAdmin) {
    btnGoAdmin.addEventListener("click", showAdminPanel);
  }

  const btnGoOperativo = document.getElementById("btnGoOperativo");
  if (btnGoOperativo) {
    btnGoOperativo.addEventListener("click", showOperativoPanel);
  }
  const btnGoLlegadasVehiculos = document.getElementById("btnGoLlegadasVehiculos");
  if (btnGoLlegadasVehiculos) {
    btnGoLlegadasVehiculos.addEventListener("click", showLlegadasVehiculosPanel);
  }

  const btnGoConverter = document.getElementById("btnGoConverter");
  if (btnGoConverter) {
    btnGoConverter.addEventListener("click", showConverterPanel);
  }

  const fileProg = document.getElementById("fileProg");
  if (fileProg) {
    fileProg.addEventListener("change", handleProgramacionFileChange);
  }

  const btnExport = document.getElementById("btnExport");
  if (btnExport) {
    btnExport.addEventListener("click", handleExportProgramacionClick);
  }

  const btnExportFormato = document.getElementById("btnExportFormato");
  if (btnExportFormato) {
    btnExportFormato.addEventListener("click", async () => {
  if (!canExportXlsx()) {
    showToast("Solo el super administrador puede descargar el Excel.", "warn");
    return;
  }
  if (!rows.length) {
    showToast("No hay datos para exportar.", "warn");
    return;
  }

  const baseKey = getBaseKey();
  const fechaKey = getFechaKey();
  const puestoKey = getHeaderKeyByNorm(["PUESTO"]);
  const numeroKey = getHeaderKeyByNorm(["#"]);
  const vehiculoKey = getHeaderKeyByNorm(["VEH", "VEHICULO", "VEHÍCULO", "MOVIL", "MÓVIL"]);
  const horaFinKey = getHeaderKeyByNorm(["HORA FIN", "HORA FINAL"]);
  const headerSet = new Set();
  rows.slice(0, 200).forEach(r => Object.keys(r || {}).forEach(k => headerSet.add(k)));
  const { key1: horaInicio1Key, key2: horaInicio2Key } = inferInicioKeysFromList(Array.from(headerSet));
  const { key1: conductor1Key, key2: conductor2Key } = getConductorKeysFromRows();

  const selectedDate = document.getElementById("filterDate")?.value || "";
  if (!selectedDate) {
    showToast("Selecciona una fecha para descargar el formato operativo completo del dia.", "warn");
    return;
  }

  let exportData = rows.slice();
  if (fechaKey) exportData = exportData.filter(r => normalizeDateToISO(r[fechaKey]) === selectedDate);
  if (!exportData.length) {
    showToast("No hay filas para la fecha seleccionada.", "warn");
    return;
  }
  if (!window.ExcelJS) {
    showToast("No se pudo cargar ExcelJS para exportar con estilos.", "err");
    return;
  }

  const ordered = dedupeProgramacionRows(exportData).rows;
  const orderedEntries = buildOperationalEntries(ordered, puestoKey, numeroKey);
  const groupedSections = groupOperationalEntriesByPuesto(orderedEntries);
  const dateForTitle = selectedDate || (fechaKey ? normalizeDateToISO(ordered[0][fechaKey]) : "");
  const titleDate = formatDateLongEs(dateForTitle || "");
  const fichoAssignments = buildFichoAssignmentsByIndex(groupedSections, vehiculoKey, { baseKey, fechaKey });

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(`DIA_${selectedDate}`);
  ws.columns = [
    { width: 8 },  // A #
    { width: 10 }, // B INICIA
    { width: 8 },  // C VEH
    { width: 36 }, // D CONDUCTOR 1
    { width: 10 }, // E INICIA 2
    { width: 36 }, // F CONDUCTOR 2
    { width: 10 }, // G HORA FIN
    { width: 3 },  // H separador
    { width: 18 }, // I BASE NOVEDAD
    { width: 34 }, // J CONDUCTOR NOVEDAD
    { width: 16 }  // K ESTADO NOVEDAD
  ];

  const styleTitle = {
    fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } },
    font: { bold: true, color: { argb: "FF0F172A" }, size: 26 },
    alignment: { horizontal: "center", vertical: "middle" }
  };
  const styleHeader = {
    fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFF00" } },
    font: { bold: true, color: { argb: "FF000000" } },
    alignment: { horizontal: "center", vertical: "middle" }
  };
  const styleFichoGreen = {
    fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FF16A34A" } },
    font: { bold: true, color: { argb: "FFFFFFFF" } }
  };
  const styleFichoBlue = {
    fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FF2563EB" } },
    font: { bold: true, color: { argb: "FFFFFFFF" } }
  };
  const styleBorderThin = {
    top: { style: "thin", color: { argb: "FF000000" } },
    left: { style: "thin", color: { argb: "FF000000" } },
    bottom: { style: "thin", color: { argb: "FF000000" } },
    right: { style: "thin", color: { argb: "FF000000" } }
  };

  const applyRowStyle = (rowNumber, styleObj, fromCol = 1, toCol = 7) => {
    for (let c = fromCol; c <= toCol; c++) {
      const cell = ws.getRow(rowNumber).getCell(c);
      cell.style = { ...(cell.style || {}), ...styleObj };
    }
  };
  const applyBorderRow = (rowNumber, fromCol = 1, toCol = 7) => {
    for (let c = fromCol; c <= toCol; c++) {
      ws.getRow(rowNumber).getCell(c).border = styleBorderThin;
    }
  };

  const formatConductorForExport = (rowObj, conductorKey) => {
    if (!conductorKey) return "";
    const raw = String(rowObj?.[conductorKey] || "");
    const note = getConductorNote(rowObj, conductorKey);
    const assigned = extractConductorName(raw);
    const isUnassigned = !raw || norm(raw) === UNASSIGNED_LABEL || !assigned;
    if (!note) return raw;
    if (!isUnassigned) return raw;
    return `${UNASSIGNED_LABEL}\nNOTA: ${note}`;
  };

  let currentRow = 1;
  const openSection = (puestoLabel) => {
    const sectionDisplay = getOperationalSectionDisplayName(puestoLabel);
    if (currentRow > 1) currentRow++;
    ws.mergeCells(currentRow, 1, currentRow, 7);
    ws.getRow(currentRow).getCell(1).value = `${String(sectionDisplay || "SIN PUESTO").toUpperCase()} ${titleDate}`;
    applyRowStyle(currentRow, styleTitle);
    applyBorderRow(currentRow, 1, 7);
    currentRow++;
    ws.getRow(currentRow).values = ["#", "INICIA", "VEH", "CONDUCTOR 1", "INICIA", "CONDUCTOR 2", "HORA FIN"];
    applyRowStyle(currentRow, styleHeader);
    applyBorderRow(currentRow, 1, 7);
    currentRow++;
  };

  groupedSections.forEach(section => {
    const sectionLabel = canonicalizePuestoLabel(section.puesto);
    const sectionEntries = getSectionEntriesForOperationalView(sectionLabel, section.entries);
    if (!sectionEntries.length) return;
    openSection(sectionLabel);
    sectionEntries.forEach(entry => {
      const r = entry.row;
      const isFichoMarker = entry.isFichoMarker;
      const vehNote = getVehiculoNote(r);
      const turnNum = getNumericTurnNumber(numeroKey ? r[numeroKey] : "");
      let vehValue = vehiculoKey ? (r[vehiculoKey] || "") : "";
      if (norm(sectionLabel).includes("NUTIBARA") && turnNum && turnNum >= 1 && turnNum <= 10) {
        const rowBase = getRowCanonicalBase(r, baseKey);
        const rowDate = getRowDateISO(r, fechaKey) || selectedDate;
        const groupKey = `${rowBase || ""}|${rowDate || ""}`;
        const assigned = fichoAssignments.get(groupKey)?.get(turnNum);
        if (assigned?.veh) vehValue = assigned.veh;
      }
      if (vehNote) vehValue = `${vehValue}\nCOMENTARIO: ${vehNote}`;

      ws.getRow(currentRow).values = [
        numeroKey ? r[numeroKey] : (entry.idx + 1),
        horaInicio1Key ? excelTimeToHHMM(r[horaInicio1Key]) : "",
        vehValue,
        formatConductorForExport(r, conductor1Key),
        horaInicio2Key ? excelTimeToHHMM(r[horaInicio2Key]) : "",
        formatConductorForExport(r, conductor2Key),
        horaFinKey ? excelTimeToHHMM(r[horaFinKey]) : ""
      ];
      ws.getRow(currentRow).getCell(1).alignment = { horizontal: "center", vertical: "middle" };
      ws.getRow(currentRow).getCell(2).alignment = { horizontal: "center", vertical: "middle" };
      ws.getRow(currentRow).getCell(3).alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      ws.getRow(currentRow).getCell(4).alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      ws.getRow(currentRow).getCell(5).alignment = { horizontal: "center", vertical: "middle" };
      ws.getRow(currentRow).getCell(6).alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      ws.getRow(currentRow).getCell(7).alignment = { horizontal: "center", vertical: "middle" };
      applyBorderRow(currentRow, 1, 7);

      if (isFichoMarker) {
        const isFichoExpos = norm(sectionLabel).includes("EXPOSICIONES");
        applyRowStyle(currentRow, isFichoExpos ? styleFichoBlue : styleFichoGreen);
      } else {
        const isNutibara = norm(sectionLabel).includes("NUTIBARA");
        let vehColor = null;
        if (isNutibara && turnNum && turnNum >= 1 && turnNum <= 10) {
          const rowBase = getRowCanonicalBase(r, baseKey);
          const rowDate = getRowDateISO(r, fechaKey) || selectedDate;
          const groupKey = `${rowBase || ""}|${rowDate || ""}`;
          vehColor = fichoAssignments.get(groupKey)?.get(turnNum)?.color || null;
        }
        if (vehColor) {
          const vehCell = ws.getRow(currentRow).getCell(3); // Columna VEH
          vehCell.style = {
            ...(vehCell.style || {}),
            fill: {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: vehColor === "blue" ? "FF2563EB" : "FF16A34A" }
            },
            font: { ...(vehCell.style?.font || {}), bold: true, color: { argb: "FFFFFFFF" } }
          };
        }
      }
      currentRow++;
    });
  });

  let novedadesDelDia = (novedades || []).filter(n => normalizeDateToISO(n.fecha) === selectedDate);
  ws.mergeCells(1, 9, 1, 11);
  ws.getRow(1).getCell(9).value = "NOVEDADES DEL DIA";
  ws.getRow(1).getCell(9).style = styleTitle;
  ws.getRow(2).getCell(9).value = "BASE";
  ws.getRow(2).getCell(10).value = "CONDUCTOR";
  ws.getRow(2).getCell(11).value = "ESTADO";
  for (let c = 9; c <= 11; c++) {
    ws.getRow(2).getCell(c).style = styleHeader;
    ws.getRow(2).getCell(c).alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(2).getCell(c).border = styleBorderThin;
  }

  let novRow = 3;
  if (novedadesDelDia.length === 0) {
    ws.getRow(novRow).getCell(9).value = "-";
    ws.getRow(novRow).getCell(10).value = "Sin novedades";
    ws.getRow(novRow).getCell(11).value = "-";
    ws.getRow(novRow).getCell(9).alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(novRow).getCell(10).alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    ws.getRow(novRow).getCell(11).alignment = { horizontal: "center", vertical: "middle" };
    applyBorderRow(novRow, 9, 11);
  } else {
    novedadesDelDia.forEach(n => {
      ws.getRow(novRow).getCell(9).value = n.base || "-";
      ws.getRow(novRow).getCell(10).value = n.nombre || "-";
      ws.getRow(novRow).getCell(11).value = n.estado || "-";
      ws.getRow(novRow).getCell(9).alignment = { horizontal: "center", vertical: "middle" };
      ws.getRow(novRow).getCell(10).alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      ws.getRow(novRow).getCell(11).alignment = { horizontal: "center", vertical: "middle" };
      applyBorderRow(novRow, 9, 11);
      novRow++;
    });
  }

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `formato_operativo_${selectedDate}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
    });
  }

  const clearProg = document.getElementById("clearProg");
  if (clearProg) {
    clearProg.addEventListener("click", handleClearProgramacionClick);
  }

  const btnDeleteDay = document.getElementById("btnDeleteDay");
  if (btnDeleteDay) {
    btnDeleteDay.addEventListener("click", handleDeleteDayClick);
  }

  const btnAddBase = document.getElementById("btnAddBase");
  if (btnAddBase) {
    btnAddBase.addEventListener("click", () => {
      const newBaseInput = document.getElementById("newBase");
      const v = newBaseInput?.value.trim() || "";
      if(v && !basesCatalog.includes(v)){
        basesCatalog.push(v);
        saveBasesToStorage();
        renderBasesAdmin();
        fillStartBases();
      }
      if (newBaseInput) newBaseInput.value = "";
    });
  }

  const btnRemoveBase = document.getElementById("btnRemoveBase");
  if (btnRemoveBase) {
    btnRemoveBase.addEventListener("click", () => {
      const sel = basesList.value;
      if(sel){
        basesCatalog = basesCatalog.filter(b => String(b) !== String(sel));
        saveBasesToStorage();
        renderBasesAdmin();
        fillStartBases();
        if(currentBase === sel) exitBase();
      }
    });
  }

  const btnReloadDrivers = document.getElementById("btnReloadDrivers");
  if (btnReloadDrivers) btnReloadDrivers.addEventListener("click", loadDriversFromCSV);
  if (btnRefreshCompliance) btnRefreshCompliance.addEventListener("click", renderAdminComplianceDashboard);
  if (adminComplianceDate) adminComplianceDate.addEventListener("change", renderAdminComplianceDashboard);
  if (btnApplyConsulta) btnApplyConsulta.addEventListener("click", renderConsultaBaseView);
  if (consultaFrom) consultaFrom.addEventListener("change", renderConsultaBaseView);
  if (consultaTo) consultaTo.addEventListener("change", renderConsultaBaseView);

  const btnLoadHistoryProgramacion = document.getElementById("btnLoadHistoryProgramacion");
  if (btnLoadHistoryProgramacion) {
    btnLoadHistoryProgramacion.addEventListener("click", handleLoadHistoryProgramacionClick);
  }

  const btnEnterBase = document.getElementById("btnEnterBase");
  if (btnEnterBase) btnEnterBase.addEventListener("click", () => enterBase(startBaseSelect.value));
  const btnExitBase = document.getElementById("btnExitBase");
  if (btnExitBase) btnExitBase.addEventListener("click", exitBase);

  if (btnRefreshDebug) btnRefreshDebug.addEventListener("click", renderSupabaseDebug);
  if (!AUDIT_DISABLED && btnRefreshAudit) btnRefreshAudit.addEventListener("click", () => loadAuditLogFromSupabase());
  if (!AUDIT_DISABLED && auditFrom) auditFrom.addEventListener("change", renderAuditLog);
  if (!AUDIT_DISABLED && auditTo) auditTo.addEventListener("change", renderAuditLog);
  if (!AUDIT_DISABLED && auditTableFilter) auditTableFilter.addEventListener("change", renderAuditLog);
  if (!AUDIT_DISABLED && auditOpFilter) auditOpFilter.addEventListener("change", renderAuditLog);
  if (!AUDIT_DISABLED && auditUserFilter) auditUserFilter.addEventListener("input", renderAuditLog);
  if (btnRefreshVisor) btnRefreshVisor.addEventListener("click", renderLiveExcelPreview);
  if (btnExportVisor) btnExportVisor.addEventListener("click", exportLiveExcelPreviewTable);
  if (visorDateSelect) visorDateSelect.addEventListener("change", renderLiveExcelPreview);
  if (visorScopeSelect) visorScopeSelect.addEventListener("change", renderLiveExcelPreview);

  const filterDrivers = document.getElementById("filterDrivers");
  if (filterDrivers) filterDrivers.addEventListener("input", renderDrivers);

  const filterDate = document.getElementById("filterDate");
  if (filterDate) {
    filterDate.addEventListener("change", handleFilterDateChange);
  }

  const clearFilter = document.getElementById("clearFilter");
  if (clearFilter) {
    clearFilter.addEventListener("click", handleClearFilterClick);
  }

  if (btnRefreshPlanilla) {
    btnRefreshPlanilla.addEventListener("click", loadPlanillaAfiliadosFromSupabase);
  }
  if (btnDownloadLlegadas) {
    btnDownloadLlegadas.addEventListener("click", handleDownloadLlegadas);
  }
  if (btnDownloadDespachos) {
    btnDownloadDespachos.addEventListener("click", handleDownloadDespachos);
  }
  if (btnRefreshLlegadasAeropuerto) {
    btnRefreshLlegadasAeropuerto.addEventListener("click", loadPlanillaAfiliadosFromSupabase);
  }
  if (aeropuertoSearch) aeropuertoSearch.addEventListener("input", renderLlegadasAeropuerto);
  if (aeropuertoEstadoFilter) aeropuertoEstadoFilter.addEventListener("change", renderLlegadasAeropuerto);
  if (aeropuertoUploadFrom) aeropuertoUploadFrom.addEventListener("change", renderLlegadasAeropuerto);
  if (aeropuertoUploadTo) aeropuertoUploadTo.addEventListener("change", renderLlegadasAeropuerto);
  if (btnDownloadLlegadasAeropuerto) {
    btnDownloadLlegadasAeropuerto.addEventListener("click", handleDownloadLlegadasAeropuerto);
  }
  if (btnRefreshLlegadasSanDiego) {
    btnRefreshLlegadasSanDiego.addEventListener("click", loadPlanillaAfiliadosFromSupabase);
  }
  if (sanDiegoSearch) sanDiegoSearch.addEventListener("input", renderLlegadasSanDiego);
  if (sanDiegoEstadoFilter) sanDiegoEstadoFilter.addEventListener("change", renderLlegadasSanDiego);
  if (sanDiegoUploadFrom) sanDiegoUploadFrom.addEventListener("change", renderLlegadasSanDiego);
  if (sanDiegoUploadTo) sanDiegoUploadTo.addEventListener("change", renderLlegadasSanDiego);
  if (btnDownloadLlegadasSanDiego) {
    btnDownloadLlegadasSanDiego.addEventListener("click", handleDownloadLlegadasSanDiego);
  }
  if (btnRefreshLlegadasNutibara) {
    btnRefreshLlegadasNutibara.addEventListener("click", loadPlanillaAfiliadosFromSupabase);
  }
  if (nutibaraSearch) nutibaraSearch.addEventListener("input", renderLlegadasNutibara);
  if (nutibaraEstadoFilter) nutibaraEstadoFilter.addEventListener("change", renderLlegadasNutibara);
  if (nutibaraUploadFrom) nutibaraUploadFrom.addEventListener("change", renderLlegadasNutibara);
  if (nutibaraUploadTo) nutibaraUploadTo.addEventListener("change", renderLlegadasNutibara);
  if (btnDownloadLlegadasNutibara) {
    btnDownloadLlegadasNutibara.addEventListener("click", handleDownloadLlegadasNutibara);
  }
  if (planillaFilterInterno) planillaFilterInterno.addEventListener("input", renderPlanillaAfiliados);
  if (planillaFilterBase) planillaFilterBase.addEventListener("input", renderPlanillaAfiliados);
  if (planillaFilterHoraLlegada) planillaFilterHoraLlegada.addEventListener("input", renderPlanillaAfiliados);
  if (planillaFilterTipo) planillaFilterTipo.addEventListener("change", renderPlanillaAfiliados);
}

// ==================== INIT ====================
async function initializeApp(){
  loadBasesFromStorage();
  await loadDriversFromCSV();
  await loadLatestProgramacionFromSupabase();
  await loadNovedadesFromSupabase();
  const pending = readPendingRowsLocal();
  if (pending && Array.isArray(pending.rows_data) && pending.rows_data.length > 0) {
    const sameProgramacion = !pending.programacion_id || !currentProgramacionId || String(pending.programacion_id) === String(currentProgramacionId);
    if (sameProgramacion) {
      AppState.replaceRows(pending.rows_data);
      fillStartBases();
      showToast("Se recuperaron cambios pendientes locales.", "warn");
      setSyncStatus("warn", "Pendiente por sincronizar");
      if (navigator.onLine) {
        await syncProgramacionRowsToSupabase("Cambios pendientes sincronizados.");
      }
    } else {
      showToast("Hay cambios pendientes de otra programacion.", "warn");
    }
  }
  adminPanel.classList.add("hidden");
  if (converterPanel) converterPanel.classList.add("hidden");
  operativoPanel.classList.remove("hidden");
  setOperativoViewMode("operativo");
  markTopNavActive("btnGoOperativo");
  applyRoleRestrictions();
  updateWorkflowGuide();
  renderTable();
  renderDrivers();
  renderNovedades();
  renderConsultaBaseView();
}

function bindWindowEvents(){
  window.addEventListener("online", async () => {
    showToast("Conexion restablecida. Sincronizando...", "ok");
    setSyncStatus("warn", "Reconectado - sincronizando");
    await syncProgramacionRowsToSupabase("Cambios pendientes sincronizados.");
    await refreshFromSupabaseIfSafe();
  });

  window.addEventListener("offline", () => {
    setSyncStatus("warn", "Sin internet - modo local");
    showToast("Sin internet. Se guardara localmente.", "warn");
  });

  window.addEventListener("beforeunload", () => {
    if (syncRowsInProgress || syncRowsPending) {
      savePendingRowsLocally("Recarga durante sincronizacion");
    }
    clearSyncRetryTimer();
    if (autoRefreshTimer) {
      clearInterval(autoRefreshTimer);
      autoRefreshTimer = null;
    }
    if (planillaAutoRefreshTimer) {
      clearInterval(planillaAutoRefreshTimer);
      planillaAutoRefreshTimer = null;
    }
  });

  window.addEventListener("focus", async () => {
    if (navigator.onLine && hasPendingRowsLocal()) {
      await syncProgramacionRowsToSupabase("Sincronizacion al volver a la ventana.");
    }
    await refreshFromSupabaseIfSafe();
  });

  document.addEventListener("visibilitychange", async () => {
    if (document.visibilityState !== "visible") return;
    if (navigator.onLine && hasPendingRowsLocal()) {
      await syncProgramacionRowsToSupabase("Sincronizacion al volver a la pestana.");
    }
    await refreshFromSupabaseIfSafe();
  });

  if (!autoRefreshTimer) {
    autoRefreshTimer = setInterval(async () => {
      if (!navigator.onLine) return;
      if (hasPendingRowsLocal()) {
        await syncProgramacionRowsToSupabase("Reintento automatico de pendientes.");
        return;
      }
      await refreshFromSupabaseIfSafe();
    }, AUTO_REFRESH_DELAY_MS);
  }

  if (!planillaAutoRefreshTimer) {
    planillaAutoRefreshTimer = setInterval(async () => {
      if (!navigator.onLine || !currentUserId) return;
      const activeTab = getActiveTabId();
      if (!isPlanillaRelatedTab(activeTab)) return;
      await ensureFreshPlanillaData({ maxAgeMs: PLANILLA_REFRESH_MAX_AGE_MS });
    }, PLANILLA_AUTO_REFRESH_MS);
  }

  window.addEventListener("resize", adjustDynamicTableViewport);
}

















