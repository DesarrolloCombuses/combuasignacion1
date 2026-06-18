const USE_ONLY_NEW_DB = true;
const SUPABASE_URL = "https://cbplebkmxrkaafqdhiyi.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_DZCceNTENY4ViP17-eZrGg_bdMElZ9X";
const PLANILLA_SUPABASE_URL = "https://cbplebkmxrkaafqdhiyi.supabase.co";
const PLANILLA_SUPABASE_ANON_KEY = "sb_publishable_DZCceNTENY4ViP17-eZrGg_bdMElZ9X";
const PROGRAMACIONES_TARGET_SUPABASE_URL = "https://cbplebkmxrkaafqdhiyi.supabase.co";
const PROGRAMACIONES_TARGET_SUPABASE_ANON_KEY = "sb_publishable_DZCceNTENY4ViP17-eZrGg_bdMElZ9X";
const PLANILLA_TABLE_NAME = "planilla_afiliados_2";
// PAUSA de las pestanas de Llegadas (Aeropuerto / San Diego / Nutibara / Novedades).
// true = ocultas y SIN consultar (no carga ni realtime). Cambiar a false para reactivar.
const LLEGADAS_PAUSED = true;
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
const PLANILLA_FETCH_LIMIT = 500;
const PLANILLA_FETCH_LIMIT_RANGED = 300;
const PLANILLA_FETCH_LIMIT_WAITING = 200;
const DESPACHOS_TABLE_NAME = "despachos_realizados";
const DESPACHOS_COLABORADORES_TABLE = "colaboradores";
const DESPACHOS_SELECT_COLUMNS = [
  "id",
  "reg_id",
  "vehicle_id",
  "interno",
  "placa",
  "itinerario_id",
  "itinerario",
  "driver_id",
  "observaciones",
  "pasajeros",
  "estado",
  "cancelled_at",
  "created_at"
].join(", ");
const DESPACHOS_PAGE_SIZE = 50;
const ARRIVAL_OMIT_WINDOW_MINUTES = 30;
const WAITING_NOVEDAD_THRESHOLD_MINUTES = 180;
const MAX_COHERENT_DISPATCH_MINUTES = 360;
const STORE_ROWS_DATA_INLINE = false;
const SUPER_ADMIN_EMAIL = "administrador@combuses.com.co";
const BASE_USER_EMAIL_RE = /^base\s*([0-9]+)@combuses\.com\.co$/i;
const ALLOW_PUBLIC_SIGNUP = false;
function getProjectRefFromUrl(url){
  try {
    const host = new URL(String(url || "")).hostname || "";
    return host.split(".")[0] || host || "(sin-ref)";
  } catch (e) {
    return String(url || "(sin-ref)");
  }
}
if (!window.XLSX) {
  throw new Error("No cargo XLSX. Verifica conexion a internet o ruta del script.");
}
if (!window.supabase || typeof window.supabase.createClient !== "function") {
  throw new Error("No cargo Supabase JS. Verifica conexion a internet o ruta del script.");
}

function sameSupabaseConfig(urlA, keyA, urlB, keyB){
  return String(urlA || "") === String(urlB || "") && String(keyA || "") === String(keyB || "");
}

function createSupabaseClient(url, key, storageKey, persistSession = true){
  return window.supabase.createClient(url, key, {
    auth: {
      storageKey,
      persistSession,
      autoRefreshToken: persistSession,
      detectSessionInUrl: persistSession
    }
  });
}

const programacionesTargetClient = createSupabaseClient(
  PROGRAMACIONES_TARGET_SUPABASE_URL,
  PROGRAMACIONES_TARGET_SUPABASE_ANON_KEY,
  "combuses-programaciones-target-auth",
  true
);
const supabaseClient = sameSupabaseConfig(SUPABASE_URL, SUPABASE_ANON_KEY, PROGRAMACIONES_TARGET_SUPABASE_URL, PROGRAMACIONES_TARGET_SUPABASE_ANON_KEY)
  ? programacionesTargetClient
  : createSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY, "combuses-source-data-auth", false);
const planillaSupabaseClient = sameSupabaseConfig(PLANILLA_SUPABASE_URL, PLANILLA_SUPABASE_ANON_KEY, PROGRAMACIONES_TARGET_SUPABASE_URL, PROGRAMACIONES_TARGET_SUPABASE_ANON_KEY)
  ? programacionesTargetClient
  : createSupabaseClient(PLANILLA_SUPABASE_URL, PLANILLA_SUPABASE_ANON_KEY, "combuses-planilla-data-auth", false);
const authClient = programacionesTargetClient;
const PROGRAMACIONES_SOURCE_REF = USE_ONLY_NEW_DB ? "(desactivado)" : getProjectRefFromUrl(SUPABASE_URL);
const PROGRAMACIONES_TARGET_REF = getProjectRefFromUrl(PROGRAMACIONES_TARGET_SUPABASE_URL);
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
let syncRowsInProgressTarget = false;
let syncRowsPendingTarget = false;
let syncRetryTimerTarget = null;
let table2ReloadingMissingRows = false;
let targetEditSaveTimer = null;
let targetEditingUntil = 0;
let autoRefreshTimer = null;
const SYNC_RETRY_DELAY_MS = 8000;
const AUTO_REFRESH_DELAY_MS = 120000;
const ENABLE_PROGRAMACION_AUTO_REFRESH = false;
// Asignaciones pendientes de confirmar visualmente (se muestran en modal SOLO
// cuando la base de datos confirma el guardado, para que el aviso sea veraz).
let pendingAssignmentConfirmations = [];
let assignmentConfirmModalEl = null;
let assignmentConfirmModalTimer = null;

function getPendingRowsStorageKey(){
  return `pending_programacion_rows_${currentUserId || "anon"}`;
}

function getPendingTargetRowsStorageKey(){
  return `pending_programacion_rows_target_${currentUserId || "anon"}`;
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

function savePendingTargetRowsLocally(reason = "Cambios pendientes DB nueva", rowsInput = null, programacionId = null, fileName = null){
  try {
    const payload = {
      reason,
      saved_at: new Date().toISOString(),
      programacion_id: programacionId ?? currentProgramacionIdTarget ?? null,
      file_name: fileName ?? currentProgramacionFileNameTarget ?? "programacion_online",
      rows_data: Array.isArray(rowsInput) ? rowsInput : (Array.isArray(rowsTarget) ? rowsTarget : [])
    };
    localStorage.setItem(getPendingTargetRowsStorageKey(), JSON.stringify(payload));
  } catch (e) {
    console.error("No se pudo guardar pendiente local (DB nueva):", e);
  }
}

function readPendingTargetRowsLocal(){
  try {
    const raw = localStorage.getItem(getPendingTargetRowsStorageKey());
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function clearPendingTargetRowsLocal(){
  try {
    localStorage.removeItem(getPendingTargetRowsStorageKey());
  } catch (e) {}
}

function hasPendingTargetRowsLocal(){
  const pending = readPendingTargetRowsLocal();
  return !!(pending && Array.isArray(pending.rows_data) && pending.rows_data.length > 0);
}

function clearSyncRetryTimer(){
  if (!syncRetryTimer) return;
  clearTimeout(syncRetryTimer);
  syncRetryTimer = null;
}

function clearTargetSyncRetryTimer(){
  if (!syncRetryTimerTarget) return;
  clearTimeout(syncRetryTimerTarget);
  syncRetryTimerTarget = null;
}

function scheduleSyncRetry(reason = "Reintento automatico"){
  if (syncRetryTimer || !currentUserId) return;
  syncRetryTimer = setTimeout(async () => {
    syncRetryTimer = null;
    if (!navigator.onLine || !currentUserId || !hasPendingRowsLocal()) return;
    await syncProgramacionRowsToSupabase(reason);
  }, SYNC_RETRY_DELAY_MS);
}

function scheduleTargetSyncRetry(reason = "Reintento automatico DB nueva"){
  if (syncRetryTimerTarget || !currentUserId) return;
  syncRetryTimerTarget = setTimeout(async () => {
    syncRetryTimerTarget = null;
    if (!navigator.onLine || !currentUserId || !hasPendingTargetRowsLocal()) return;
    await syncProgramacionRowsToTargetSupabase(reason, { skipQueueSave: true });
  }, SYNC_RETRY_DELAY_MS);
}

function scheduleTargetEditSave(reason = "Cambios guardados en DB nueva."){
  if (!currentUserId || !currentProgramacionIdTarget) return;
  targetEditingUntil = Date.now() + 3000;
  savePendingTargetRowsLocally("Pendiente DB nueva", rowsTarget, currentProgramacionIdTarget, currentProgramacionFileNameTarget);
  setSyncStatus("warn", "Pendiente DB nueva");
  if (targetEditSaveTimer) clearTimeout(targetEditSaveTimer);
  const runDeferredSave = async () => {
    targetEditSaveTimer = null;
    if (isTargetTableEditing()) {
      targetEditSaveTimer = setTimeout(runDeferredSave, 1500);
      return;
    }
    if (!navigator.onLine || !currentUserId || !currentProgramacionIdTarget) {
      scheduleTargetSyncRetry(reason);
      return;
    }
    try {
      await syncProgramacionRowsToTargetSupabase(reason, { skipQueueSave: true });
    } catch (error) {
      console.warn("No se pudo guardar edicion diferida en DB nueva:", error);
      scheduleTargetSyncRetry(reason);
    }
  };
  targetEditSaveTimer = setTimeout(runDeferredSave, 1200);
}

// Fuerza que termine cualquier guardado pendiente/diferido de la DB nueva ANTES
// de recargar desde la base. Evita que una recarga (cambio de pestana, cambio de
// base) pise asignaciones que aun no se habian confirmado en Supabase.
async function flushPendingTargetSave(){
  const hadPending = !!targetEditSaveTimer;
  if (targetEditSaveTimer) {
    clearTimeout(targetEditSaveTimer);
    targetEditSaveTimer = null;
  }
  // Esperar a que termine un guardado en curso (si lo hay).
  let guard = 0;
  while (syncRowsInProgressTarget && guard < 200) {
    await new Promise(res => setTimeout(res, 50));
    guard++;
  }
  // Si habia cambios sin confirmar, guardarlos ahora y esperar la confirmacion.
  if (hadPending && currentUserId && currentProgramacionIdTarget && Array.isArray(rowsTarget) && rowsTarget.length) {
    try {
      await syncProgramacionRowsToTargetSupabase("Guardando cambios pendientes antes de recargar.", { skipQueueSave: true });
    } catch (error) {
      console.warn("No se pudo confirmar guardado pendiente antes de recargar:", error);
    }
  }
}

function isTargetTableEditing(){
  const activeEl = document.activeElement;
  return Date.now() < targetEditingUntil
    || !!(activeEl && activeEl.classList?.contains("driver-typed-input"));
}

function isViewingLatestProgramacion(){
  if (!currentProgramacionId) return true;
  if (!Array.isArray(programacionesHistory) || programacionesHistory.length === 0) return true;
  const latestKnownId = programacionesHistory[0]?.id;
  return String(currentProgramacionId) === String(latestKnownId);
}

async function refreshFromSupabaseIfSafe(){
  if (!ENABLE_PROGRAMACION_AUTO_REFRESH) return;
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

// Modal verde de confirmacion que se cierra solo (~1.6s). Se invoca unicamente
// cuando el guardado quedo CONFIRMADO en la base de datos.
function showAssignmentConfirmedModal(items){
  const list = Array.isArray(items) ? items.filter(Boolean) : [];
  if (list.length === 0) return;
  if (!assignmentConfirmModalEl) {
    assignmentConfirmModalEl = document.createElement("div");
    assignmentConfirmModalEl.id = "assignmentConfirmModal";
    assignmentConfirmModalEl.style.cssText = [
      "position:fixed", "inset:0", "z-index:99999",
      "display:flex", "align-items:center", "justify-content:center",
      "background:rgba(15,23,42,.45)",
      "opacity:0", "transition:opacity .15s ease", "pointer-events:none"
    ].join(";");
    document.body.appendChild(assignmentConfirmModalEl);
  }
  const esc = (s) => String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const detalle = list.length === 1
    ? `<div style="font-size:18px;font-weight:700;color:#0f172a;margin-bottom:4px">${esc(list[0].conductor)}</div>
       <div style="font-size:14px;color:#334155">Vehiculo ${esc(list[0].vehiculo || "-")} &middot; ${esc(list[0].slot)}</div>`
    : `<div style="font-size:18px;font-weight:700;color:#0f172a;margin-bottom:4px">${list.length} conductores</div>
       <div style="font-size:14px;color:#334155">guardados y confirmados</div>`;
  assignmentConfirmModalEl.innerHTML = `
    <div style="background:#fff;border-radius:16px;padding:26px 30px;max-width:340px;width:86%;
                box-shadow:0 20px 50px rgba(0,0,0,.3);text-align:center;border-top:6px solid #16a34a">
      <div style="font-size:44px;line-height:1;margin-bottom:10px">&#9989;</div>
      <div style="font-size:15px;font-weight:800;color:#16a34a;letter-spacing:.5px;margin-bottom:10px">
        GUARDADO Y CONFIRMADO
      </div>
      ${detalle}
    </div>`;
  requestAnimationFrame(() => {
    if (assignmentConfirmModalEl) assignmentConfirmModalEl.style.opacity = "1";
  });
  if (assignmentConfirmModalTimer) clearTimeout(assignmentConfirmModalTimer);
  assignmentConfirmModalTimer = setTimeout(() => {
    if (assignmentConfirmModalEl) assignmentConfirmModalEl.style.opacity = "0";
  }, 1600);
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
  const btnExportTurnos = document.getElementById("btnExportTurnos");
  const btnExportReporteTurnos = document.getElementById("btnExportReporteTurnos");
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
    if (btnExportTurnos) {
      btnExportTurnos.classList.remove("hidden");
      btnExportTurnos.disabled = rows.length === 0;
    }
    if (btnExportReporteTurnos) {
      btnExportReporteTurnos.classList.remove("hidden");
      btnExportReporteTurnos.disabled = false;
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
  if (btnExportTurnos) {
    btnExportTurnos.classList.add("hidden");
    btnExportTurnos.disabled = true;
  }
  if (btnExportReporteTurnos) {
    btnExportReporteTurnos.classList.add("hidden");
    btnExportReporteTurnos.disabled = true;
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

function syncFichoVehicleLinksAfterSwapInDataset(datasetRows, opts = {}){
  const sourceVeh = String(opts.sourceVeh ?? "").trim();
  const targetVeh = String(opts.targetVeh ?? "").trim();
  if (!sourceVeh || !targetVeh || sourceVeh === targetVeh) return 0;

  const rowsData = Array.isArray(datasetRows) ? datasetRows : [];
  const fechaFiltro = normalizeDateToISO(opts.selectedDate || "");
  const baseFiltro = getBaseCanonical(opts.currentBase || "");
  const excludedRows = Array.isArray(opts.excludedRows) ? opts.excludedRows : [];
  const sourceNorm = normalizeVehicleId(sourceVeh);
  const targetNorm = normalizeVehicleId(targetVeh);
  const conductorKeys = [opts.conductorKey1, opts.conductorKey2].filter(Boolean);
  let updated = 0;

  rowsData.forEach(row => {
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

function sanitizeFichoConductorSlots(datasetRows, conductorKey1, conductorKey2){
  const rowsList = Array.isArray(datasetRows) ? datasetRows : [];
  const keys = [conductorKey1, conductorKey2].filter(Boolean);
  if (!rowsList.length || !keys.length) return 0;
  let changed = 0;
  rowsList.forEach(row => {
    if (!isFichoRowByContent(row)) return;
    keys.forEach(k => {
      const hadValue = String(row?.[k] || "").trim();
      const hadNote = getConductorNote(row, k);
      if (hadValue && norm(hadValue) !== UNASSIGNED_LABEL) {
        row[k] = UNASSIGNED_LABEL;
        changed++;
      } else if (!hadValue) {
        row[k] = UNASSIGNED_LABEL;
      }
      if (hadNote) {
        setConductorNote(row, k, "");
        changed++;
      }
    });
  });
  return changed;
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
    updateExportAccess();
    startRealtimeSubscriptions();
    if(!appInitialized){
      setSyncStatus("warn", "Validando datos...");
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
    stopRealtimeSubscriptions();
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
  const { error } = await authClient.auth.signInWithPassword({ email, password });
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
  const { error } = await authClient.auth.signUp({ email, password });
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
  const { error } = await authClient.auth.signOut();
  if(error){
    setAuthStatus(error.message, "err");
  }
};

async function initAuth(){
  const { data, error } = await authClient.auth.getSession();
  if(error){
    setAuthStatus(error.message, "err");
    applyAuthState(null);
  }else{
    applyAuthState(data.session);
  }
  authClient.auth.onAuthStateChange((event, session) => {
    const sameActiveUser = appInitialized
      && session?.user?.id
      && currentUserId
      && String(session.user.id) === String(currentUserId);
    if (sameActiveUser && event !== "SIGNED_OUT") return;
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

function isDuplicateKeyError(error){
  const msg = String(error?.message || "").toLowerCase();
  const code = String(error?.code || "").trim();
  return code === "23505" || msg.includes("duplicate key") || msg.includes("unique constraint");
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
        lastResult = {
          ok: false,
          method: "programacion_filas",
          message: "Tabla programacion_filas no disponible para verificar."
        };
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
    .select("id, file_name, uploaded_by, created_at")
    .order("id", { ascending: false })
    .limit(120);
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

  try {
    const rowsResult = await loadProgramacionRowsFromSupabase(currentProgramacionId);
    if (rowsResult?.ok && Array.isArray(rowsResult.rows) && rowsResult.rows.length > 0) {
      rows = dedupeProgramacionRows(rowsResult.rows).rows;
    } else {
      rows = [];
    }
  } catch (rowsError) {
    console.warn("No se pudo leer programacion_filas durante la carga:", rowsError);
    rows = [];
  }

  if (!Array.isArray(rows) || rows.length === 0) {
    // Respaldo liviano: intenta leer solo el rows_data del ultimo registro.
    const fallback = await supabaseClient
      .from("programaciones")
      .select("rows_data")
      .eq("id", currentProgramacionId)
      .limit(1)
      .maybeSingle();
    if (!fallback.error && Array.isArray(fallback.data?.rows_data) && fallback.data.rows_data.length > 0) {
      const prepared = normalizeProgramacionRows(fallback.data.rows_data);
      rows = dedupeProgramacionRows(prepared.normalized).rows;
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
  try {
    const rowsResult = await loadProgramacionRowsFromSupabase(currentProgramacionId);
    rows = rowsResult.ok ? dedupeProgramacionRows(rowsResult.rows).rows : [];
  } catch (rowsError) {
    console.error("Error cargando filas del historial:", rowsError);
    rows = [];
  }
  if (!rows.length) {
    const fallback = await supabaseClient
      .from("programaciones")
      .select("rows_data")
      .eq("id", currentProgramacionId)
      .limit(1)
      .maybeSingle();
    if (!fallback.error && Array.isArray(fallback.data?.rows_data) && fallback.data.rows_data.length > 0) {
      const prepared = normalizeProgramacionRows(fallback.data.rows_data);
      rows = dedupeProgramacionRows(prepared.normalized).rows;
    }
  }
  lblGlobal.textContent = `Programacion en linea: ${record.file_name} | Filas: ${rows.length}`;
  updateExportAccess();
  fillStartBases();
  if (currentBase) refreshFilterDateOptions();
  renderTable();
  renderDrivers();
  renderNovedades();
  setSyncStatus("ok", "Programacion online");
}

async function saveProgramacionToSupabase(file, parsedRows){
  if (!currentUserId) {
    throw new Error("No hay sesion activa.");
  }

  // Historial: cada archivo cargado crea un nuevo registro de programacion.
  const insertResult = await supabaseClient
    .from("programaciones")
    .insert({
      uploaded_by: currentUserId,
      file_name: file.name,
      // No almacenamos el archivo binario en Supabase Storage.
      // Solo persistimos metadatos y filas normalizadas.
      file_path: null,
      rows_data: STORE_ROWS_DATA_INLINE ? parsedRows : []
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
        rows_data: STORE_ROWS_DATA_INLINE ? parsedRows : [],
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

async function saveProgramacionToTargetSupabase(file, parsedRows){
  if (!currentUserId) {
    throw new Error("No hay sesion activa.");
  }
  let targetAuth = await ensureTargetMigrationSession();
  let insertResult = await programacionesTargetClient
    .from("programaciones")
    .insert({
      uploaded_by: targetAuth.userId,
      file_name: file?.name || "programacion_online",
      file_path: null,
      rows_data: STORE_ROWS_DATA_INLINE ? parsedRows : []
    })
    .select("id")
    .single();

  const insertErrorText = String(insertResult?.error?.message || "").toLowerCase();
  const shouldRetryAuth = !!insertResult?.error && (
    isPermissionLikeError(insertResult.error)
    || insertErrorText.includes("jwt")
    || insertErrorText.includes("token")
    || insertErrorText.includes("auth")
    || insertErrorText.includes("invalid login")
  );
  if (shouldRetryAuth) {
    try {
      targetAuth = await ensureTargetMigrationSession({ forceReauth: true });
      insertResult = await programacionesTargetClient
        .from("programaciones")
        .insert({
          uploaded_by: targetAuth.userId,
          file_name: file?.name || "programacion_online",
          file_path: null,
          rows_data: STORE_ROWS_DATA_INLINE ? parsedRows : []
        })
        .select("id")
        .single();
    } catch (reauthError) {
      console.warn("No se pudo reautenticar DB nueva:", reauthError);
    }
  }

  if (insertResult.error) {
    setSyncStatus("err", "Error guardando en DB nueva");
    throw new Error(`DB nueva (${PROGRAMACIONES_TARGET_REF}): ${insertResult.error.message || "sin detalle"}`);
  }
  const targetProgramacionId = insertResult?.data?.id || null;
  if (!targetProgramacionId) {
    throw new Error("No se obtuvo ID de programacion en DB nueva.");
  }
  currentProgramacionIdTarget = targetProgramacionId;
  currentProgramacionFileNameTarget = file?.name || currentProgramacionFileNameTarget;

  const rowsSyncResult = await syncProgramacionRowsTableWithClient(
    programacionesTargetClient,
    targetProgramacionId,
    parsedRows,
    targetAuth.userId
  );
  if (!rowsSyncResult?.ok) {
    throw new Error(rowsSyncResult?.unavailable
      ? "Tabla programacion_filas no disponible en DB nueva."
      : "No se pudieron guardar filas en DB nueva.");
  }

  const verifyRowsResult = await fetchProgramacionRowsFromClient(programacionesTargetClient, targetProgramacionId);
  if (!verifyRowsResult?.ok) {
    throw new Error("No se pudo verificar programacion_filas en DB nueva.");
  }
  const ok = rowsSignature(parsedRows) === rowsSignature(verifyRowsResult.rows || []);
  if (!ok) {
    throw new Error(`Diferencia detectada en DB nueva (${(verifyRowsResult.rows || []).length}/${parsedRows.length} filas).`);
  }

  const prepared = normalizeProgramacionRows(parsedRows);
  rowsTarget = dedupeProgramacionRows(prepared.normalized).rows;
  renderTable2();

  setSyncStatus("ok", "Archivo guardado en DB nueva");
  showToast(`Archivo cargado en DB nueva (${PROGRAMACIONES_TARGET_REF}) y verificado.`, "ok");
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
        .update({ rows_data: STORE_ROWS_DATA_INLINE ? rowsToPersist : [] })
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
          rows_data: STORE_ROWS_DATA_INLINE ? rowsToPersist : []
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
          ? { ...rec, rows_data: STORE_ROWS_DATA_INLINE ? rowsToPersist : [] }
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
  const normalizedPayload = {
    user_id: currentUserId,
    nombre: String(payload?.nombre || "").trim(),
    base: formatBaseLabel(payload?.base || ""),
    estado: payload?.estado || "PENDIENTE",
    fecha: normalizeDateToISO(payload?.fecha || "") || null
  };
  const { data, error } = await supabaseClient
    .from("novedades")
    .insert(normalizedPayload)
    .select("id, nombre, base, estado, fecha")
    .single();
  if (error) {
    if (!isDuplicateKeyError(error)) throw error;

    const candidates = [];
    const baseVal = normalizedPayload.base || "";
    const nombreVal = normalizedPayload.nombre || "";
    const fechaVal = normalizedPayload.fecha || null;
    if (nombreVal && baseVal && fechaVal) {
      candidates.push({ nombre: nombreVal, base: baseVal, fecha: fechaVal, user_id: currentUserId });
    }
    if (nombreVal && baseVal) {
      candidates.push({ nombre: nombreVal, base: baseVal, user_id: currentUserId });
      candidates.push({ nombre: nombreVal, base: baseVal });
    }

    let existing = null;
    for (const where of candidates) {
      let q = supabaseClient
        .from("novedades")
        .select("id, nombre, base, estado, fecha")
        .order("id", { ascending: false })
        .limit(1);
      Object.entries(where).forEach(([k, v]) => {
        q = q.eq(k, v);
      });
      const lookup = await q;
      if (!lookup.error && Array.isArray(lookup.data) && lookup.data.length > 0) {
        existing = lookup.data[0];
        break;
      }
    }

    if (!existing?.id) {
      throw new Error(`Conflicto por clave unica en novedades y no se pudo localizar el registro existente. Detalle: ${error.message || "sin detalle"}`);
    }

    const updateResult = await supabaseClient
      .from("novedades")
      .update({
        estado: normalizedPayload.estado,
        fecha: normalizedPayload.fecha,
        base: normalizedPayload.base,
        nombre: normalizedPayload.nombre
      })
      .eq("id", existing.id)
      .select("id, nombre, base, estado, fecha")
      .single();
    if (updateResult.error) {
      throw new Error(`Existe novedad duplicada (id ${existing.id}) pero no se pudo actualizar: ${updateResult.error.message || "sin detalle"}`);
    }
    setSyncStatus("ok", "Novedad actualizada");
    showToast("La novedad ya existia y fue actualizada.", "ok");
    return updateResult.data;
  }
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
let rowsTarget = [];
let targetDbDateCatalog = [];
let targetDateCatalogLoadedAt = 0;
const TARGET_DATE_CATALOG_TTL_MS = 180000;
let currentProgramacionIdTarget = null;
let currentProgramacionFileNameTarget = "programacion_online";
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
let lastNovedadesLlegadasRows = [];
let operativoViewMode = "operativo";
const ARRIVALS_PANEL_TAB_IDS = ["llegadas-aeropuerto", "llegadas-san-diego", "llegadas-nutibara", "llegadas-novedades"];
const PLANILLA_REFRESH_MAX_AGE_MS = 180000;
const PLANILLA_AUTO_REFRESH_MS = 120000;
const DRIVERS_CACHE_KEY = "driversByBaseCacheV1";
const DRIVERS_CEDULA_CACHE_KEY = "driverCedulaByNameV1";
// Mapa nombre(normalizado por nameKeyForMatch) -> cedula, tomado del CSV de conductores.
let driverCedulaByName = new Map();

function loadDriversCache(){
  try {
    const raw = localStorage.getItem(DRIVERS_CACHE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== "object") return false;
    driversByBase = parsed;
    // Recupera tambien el mapa de cedulas si existe.
    try {
      const rawCed = localStorage.getItem(DRIVERS_CEDULA_CACHE_KEY);
      const obj = rawCed ? JSON.parse(rawCed) : null;
      if (obj && typeof obj === "object") driverCedulaByName = new Map(Object.entries(obj));
    } catch (e) {}
    return true;
  } catch (e) {
    return false;
  }
}

function saveDriversCache(){
  try {
    localStorage.setItem(DRIVERS_CACHE_KEY, JSON.stringify(driversByBase || {}));
    localStorage.setItem(DRIVERS_CEDULA_CACHE_KEY, JSON.stringify(Object.fromEntries(driverCedulaByName)));
  } catch (e) {}
}

// Asegura el mapa de cedulas del CSV; si esta vacio, recarga el CSV de conductores.
async function ensureDriverCedulaMap(){
  if (driverCedulaByName && driverCedulaByName.size) return driverCedulaByName;
  if (loadDriversCache() && driverCedulaByName.size) return driverCedulaByName;
  try { await loadDriversFromCSV(); } catch (e) { console.warn("ensureDriverCedulaMap:", e?.message || e); }
  return driverCedulaByName;
}

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
const novedadesBody2 = document.getElementById("novedadesBody2");
const novedadesBaseDisplay2 = document.getElementById("novedadesBaseDisplay2");
const novedadesCount2 = document.getElementById("novedadesCount2");
const novedadManualInput2 = document.getElementById("novedadManualInput2");
const novedadManualList2 = document.getElementById("novedadManualList2");
const btnAddNovedadManual2 = document.getElementById("btnAddNovedadManual2");
const debugOutput = document.getElementById("debugOutput");
const btnRefreshDebug = document.getElementById("btnRefreshDebug");
const migrationDbInfo = document.getElementById("migrationDbInfo");
const migrationOutput = document.getElementById("migrationOutput");
const btnMigrationStatus = document.getElementById("btnMigrationStatus");
const btnMigrateLatestProgramacion = document.getElementById("btnMigrateLatestProgramacion");
const btnMigrateSelectedProgramacion = document.getElementById("btnMigrateSelectedProgramacion");
const filterDate2 = document.getElementById("filterDate2");
const clearFilter2 = document.getElementById("clearFilter2");
const btnRefreshProgramacion2 = document.getElementById("btnRefreshProgramacion2");
const gridHead2 = document.querySelector("#grid2 thead");
const gridBody2 = document.querySelector("#grid2 tbody");
const gridViewport = document.getElementById("gridViewport");
const novedadesViewport = document.getElementById("novedadesViewport");
const novedadesViewport2 = document.getElementById("novedadesViewport2");
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
const btnRefreshLlegadasNovedades = document.getElementById("btnRefreshLlegadasNovedades");
const llegadasNovedadesTitle = document.getElementById("llegadasNovedadesTitle");
const llegadasNovedadesCount = document.getElementById("llegadasNovedadesCount");
const llegadasNovedadesStatus = document.getElementById("llegadasNovedadesStatus");
const llegadasNovedadesBody = document.getElementById("llegadasNovedadesBody");

/* ---- Despachos realizados (solo consulta, paginado) ---- */
const btnRefreshDespachos = document.getElementById("btnRefreshDespachos");
const despachoSearch = document.getElementById("despachoSearch");
const despachoEstadoFilter = document.getElementById("despachoEstadoFilter");
const despachoSentidoFilter = document.getElementById("despachoSentidoFilter");
const despachoFrom = document.getElementById("despachoFrom");
const despachoTo = document.getElementById("despachoTo");
const btnDownloadDespachos = document.getElementById("btnDownloadDespachos");
const despachoCount = document.getElementById("despachoCount");
const despachoStatus = document.getElementById("despachoStatus");
const despachoBody = document.getElementById("despachoBody");
const despachoPager = document.getElementById("despachoPager");
const despachoTitle = document.getElementById("despachoTitle");
let despachosRows = [];
let despachosPage = 0;
let despachosTotalCount = 0;
let despachosLoading = false;
let despachosLoadedOnce = false;
let despachosColabMap = null;
let despachosColabLoading = null;

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
  applyTo(novedadesViewport2);
}

function applyRoleRestrictions(){
  const navButtonsRow = document.getElementById("btnGoOperativo")?.parentElement;
  const baseSelectorRow = document.getElementById("btnEnterBase")?.parentElement;
  const btnGoConverter = document.getElementById("btnGoConverter");
  const tabDebug = document.querySelector('.tab[data-tab="debugsupabase"]');
  const tabAudit = document.querySelector('.tab[data-tab="audit"]');
  const tabVisor = document.querySelector('.tab[data-tab="visor"]');
  const tabNovedades = document.querySelector('.tab[data-tab="novedades"]');
  const tabNovedades2 = document.querySelector('.tab[data-tab="novedades2"]');
  const novedadesContent = document.getElementById("tab-novedades");
  const novedadesContent2 = document.getElementById("tab-novedades2");
  const operativoTitle = document.getElementById("operativoMainTitle") || document.querySelector("#operativoPanel h2");
  const auditContent = document.getElementById("tab-audit");

  if (tabNovedades) tabNovedades.classList.add("hidden");
  if (novedadesContent?.classList.contains("active")) {
    novedadesContent.classList.remove("active");
    if (tabNovedades) tabNovedades.classList.remove("active");
    if (tabNovedades2) tabNovedades2.classList.add("active");
    if (novedadesContent2) novedadesContent2.classList.add("active");
  }

  if (AUDIT_DISABLED) {
    if (tabAudit) tabAudit.classList.add("hidden");
    if (auditContent?.classList.contains("active")) {
      auditContent.classList.remove("active");
      const progTab = document.querySelector('.tab[data-tab="programacion2"]');
      const progContent = document.getElementById("tab-programacion2");
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
    if (tabNovedades) tabNovedades.classList.add("hidden");
    if (tabNovedades2) tabNovedades2.classList.remove("hidden");
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
      const progTab = document.querySelector('.tab[data-tab="programacion2"]');
      const progContent = document.getElementById("tab-programacion2");
      if (progTab) progTab.classList.add("active");
      if (progContent) progContent.classList.add("active");
    }
  }
  const canMigrate = isSuperAdmin() && !USE_ONLY_NEW_DB;
  if (btnMigrationStatus) btnMigrationStatus.disabled = !canMigrate;
  if (btnMigrateLatestProgramacion) btnMigrateLatestProgramacion.disabled = !canMigrate;
  if (btnMigrateSelectedProgramacion) btnMigrateSelectedProgramacion.disabled = !canMigrate;
  if (migrationOutput && !canMigrate) {
    migrationOutput.textContent = "Migracion manual disponible solo para el super administrador.";
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
    .select("id, file_name, rows_data, uploaded_by, created_at")
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
  lines.push(`Proyecto origen (viejo): ${PROGRAMACIONES_SOURCE_REF}`);
  lines.push(`Proyecto destino (nuevo): ${PROGRAMACIONES_TARGET_REF}`);
  lines.push("");
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

function refreshFilterDateOptions2(){
  if (!filterDate2) return;
  const prev = filterDate2.value || "";
  const daySet = new Set();
  (Array.isArray(targetDbDateCatalog) ? targetDbDateCatalog : []).forEach(d => {
    const iso = normalizeDateToISO(d);
    if (iso) daySet.add(iso);
  });
  const fechaKey = getFechaKeyFromArray(rowsTarget);
  (Array.isArray(rowsTarget) ? rowsTarget : []).forEach(r => {
    const iso = getRowDateISO(r, fechaKey);
    if (iso) daySet.add(iso);
  });
  const dates = Array.from(daySet).sort((a, b) => a.localeCompare(b));
  filterDate2.innerHTML = `<option value="">Selecciona fecha...</option>`;
  dates.forEach(iso => {
    const op = document.createElement("option");
    op.value = iso;
    op.textContent = excelDateToReadable(iso);
    filterDate2.appendChild(op);
  });
  if (prev && dates.includes(prev)) filterDate2.value = prev;
}

async function loadTargetDateCatalogFromSupabase(force = false){
  if (!force && targetDateCatalogLoadedAt && (Date.now() - targetDateCatalogLoadedAt) < TARGET_DATE_CATALOG_TTL_MS) {
    return;
  }
  const pageSize = 1000;
  const maxPages = 8;
  const allRows = [];
  let offset = 0;
  let page = 0;
  while (page < maxPages) {
    const { data, error } = await programacionesTargetClient
      .from("programacion_filas")
      .select("fecha")
      .not("fecha", "is", null)
      .order("fecha", { ascending: false })
      .range(offset, offset + pageSize - 1);
    if (error) {
      if (isProgramacionFilasUnavailable(error)) {
        targetDbDateCatalog = [];
        targetDateCatalogLoadedAt = Date.now();
        return;
      }
      throw error;
    }
    const chunk = Array.isArray(data) ? data : [];
    allRows.push(...chunk);
    if (chunk.length < pageSize) break;
    offset += pageSize;
    page += 1;
  }
  const uniq = new Set();
  allRows.forEach(r => {
    const iso = normalizeDateToISO(r?.fecha || "");
    if (iso) uniq.add(iso);
  });
  targetDbDateCatalog = Array.from(uniq).sort((a, b) => b.localeCompare(a));
  targetDateCatalogLoadedAt = Date.now();
}

async function loadTargetProgramacionByDate(dateIsoInput){
  const dateIso = normalizeDateToISO(dateIsoInput || "");
  if (!dateIso) {
    rowsTarget = [];
    currentProgramacionIdTarget = null;
    return;
  }

  const latestIdProbe = await programacionesTargetClient
    .from("programacion_filas")
    .select("programacion_id")
    .eq("fecha", dateIso)
    .order("programacion_id", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestIdProbe.error) {
    if (isProgramacionFilasUnavailable(latestIdProbe.error)) {
      rowsTarget = [];
      currentProgramacionIdTarget = null;
      return;
    }
    throw latestIdProbe.error;
  }
  const latestProgramacionId = Number(latestIdProbe.data?.programacion_id || 0);
  if (!latestProgramacionId) {
    rowsTarget = [];
    currentProgramacionIdTarget = null;
    return;
  }

  const pageSize = 1000;
  const allRows = [];
  let offset = 0;
  while (true) {
    const { data, error } = await programacionesTargetClient
      .from("programacion_filas")
      .select("row_data")
      .eq("fecha", dateIso)
      .eq("programacion_id", latestProgramacionId)
      .order("id", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) {
      if (isProgramacionFilasUnavailable(error)) {
        rowsTarget = [];
        currentProgramacionIdTarget = null;
        return;
      }
      throw error;
    }
    const chunk = Array.isArray(data) ? data : [];
    allRows.push(...chunk);
    if (chunk.length < pageSize) break;
    offset += pageSize;
  }

  if (allRows.length === 0) {
    rowsTarget = [];
    currentProgramacionIdTarget = null;
    return;
  }
  const rowsForSelectedProgramacion = allRows
    .map(r => r?.row_data)
    .filter(r => r && typeof r === "object");

  const prepared = normalizeProgramacionRows(rowsForSelectedProgramacion);
  rowsTarget = dedupeProgramacionRows(prepared.normalized).rows;
  {
    const { key1, key2 } = getConductorKeysFromArray(rowsTarget);
    sanitizeFichoConductorSlots(rowsTarget, key1, key2);
  }
  currentProgramacionIdTarget = latestProgramacionId || null;

  if (currentProgramacionIdTarget) {
    const info = await programacionesTargetClient
      .from("programaciones")
      .select("file_name")
      .eq("id", currentProgramacionIdTarget)
      .maybeSingle();
    if (!info.error && info.data?.file_name) {
      currentProgramacionFileNameTarget = info.data.file_name;
    }
  }
}

async function loadLatestProgramacionFromTargetSupabase(){
  await loadTargetDateCatalogFromSupabase();
  let query = programacionesTargetClient
    .from("programaciones")
    .select("id, file_name, uploaded_by, created_at")
    .order("id", { ascending: false })
    .limit(1);
  const { data, error } = await query;
  if (error) throw error;
  if (!Array.isArray(data) || data.length === 0) {
    rowsTarget = [];
    currentProgramacionIdTarget = null;
    return;
  }
  const latest = data[0];
  currentProgramacionIdTarget = latest.id;
  currentProgramacionFileNameTarget = latest.file_name || currentProgramacionFileNameTarget;

  let nextRows = [];
  try {
    const rowsResult = await fetchProgramacionRowsFromClient(programacionesTargetClient, currentProgramacionIdTarget);
    if (rowsResult?.ok && Array.isArray(rowsResult.rows) && rowsResult.rows.length > 0) {
      nextRows = rowsResult.rows;
    } else {
      const fallback = await programacionesTargetClient
        .from("programaciones")
        .select("rows_data")
        .eq("id", currentProgramacionIdTarget)
        .limit(1)
        .maybeSingle();
      if (!fallback.error && Array.isArray(fallback.data?.rows_data)) {
        nextRows = fallback.data.rows_data;
      }
    }
  } catch (rowsError) {
    console.warn("No se pudo leer programacion_filas del destino:", rowsError);
  }
  const prepared = normalizeProgramacionRows(nextRows);
  rowsTarget = dedupeProgramacionRows(prepared.normalized).rows;
  {
    const { key1, key2 } = getConductorKeysFromArray(rowsTarget);
    sanitizeFichoConductorSlots(rowsTarget, key1, key2);
  }
}

async function syncProgramacionRowsToTargetSupabase(reason = "Cambios guardados en DB nueva.", options = {}){
  if (!Array.isArray(rowsTarget) || !currentProgramacionIdTarget) return false;
  const skipQueueSave = !!options?.skipQueueSave;
  if (!skipQueueSave) {
    savePendingTargetRowsLocally("Pendiente de confirmacion en DB nueva", rowsTarget, currentProgramacionIdTarget, currentProgramacionFileNameTarget);
    setSyncStatus("warn", "Pendiente DB nueva");
  }
  if (!navigator.onLine) {
    savePendingTargetRowsLocally("Sin internet (DB nueva)", rowsTarget, currentProgramacionIdTarget, currentProgramacionFileNameTarget);
    setSyncStatus("warn", "Sin internet - pendiente DB nueva");
    scheduleTargetSyncRetry(reason);
    return false;
  }
  if (syncRowsInProgressTarget) {
    syncRowsPendingTarget = true;
    if (!skipQueueSave) savePendingTargetRowsLocally("Cambio en cola de sincronizacion (DB nueva)", rowsTarget, currentProgramacionIdTarget, currentProgramacionFileNameTarget);
    return false;
  }
  syncRowsInProgressTarget = true;
  setSyncStatus("warn", "Guardando DB nueva...");
  const targetAuth = await ensureTargetMigrationSession();
  const rowsTargetFechaKey = getFechaKeyFromArray(rowsTarget);
  const fechaScope = normalizeDateToISO(filterDate2?.value || (rowsTarget[0] ? getRowDateISO(rowsTarget[0], rowsTargetFechaKey) : ""));
  const rowsToPersist = Array.isArray(rowsTarget)
    ? (fechaScope ? rowsTarget.filter(r => getRowDateISO(r, rowsTargetFechaKey) === fechaScope) : rowsTarget.slice())
    : [];
  try {
    const rowsSyncResult = await syncProgramacionRowsTableWithClient(
      programacionesTargetClient,
      currentProgramacionIdTarget,
      rowsToPersist,
      targetAuth.userId,
      { fecha: fechaScope }
    );
    if (!rowsSyncResult?.ok) {
      throw new Error(rowsSyncResult?.unavailable
        ? "Tabla programacion_filas no disponible en DB nueva."
        : "No se pudieron guardar filas en DB nueva.");
    }

    const updateResult = await programacionesTargetClient
      .from("programaciones")
      .update({ rows_data: STORE_ROWS_DATA_INLINE ? rowsToPersist : [] })
      .eq("id", currentProgramacionIdTarget);
    if (updateResult.error) throw updateResult.error;

    const verifyRowsResult = await fetchProgramacionRowsFromClient(programacionesTargetClient, currentProgramacionIdTarget, { fecha: fechaScope });
    if (!verifyRowsResult?.ok) {
      throw new Error("No se pudo verificar programacion_filas en DB nueva.");
    }
    const ok = rowsSignature(rowsToPersist) === rowsSignature(verifyRowsResult.rows || []);
    if (!ok) {
      throw new Error(`Diferencia detectada en DB nueva (${(verifyRowsResult.rows || []).length}/${rowsToPersist.length} filas).`);
    }
    clearPendingTargetRowsLocal();
    setSyncStatus("ok", "Confirmado DB nueva");
    showToast(`${reason} (confirmado)`, "ok");
    // Aviso visible y veraz: el dato ya quedo verificado en la base de datos.
    if (pendingAssignmentConfirmations.length > 0) {
      showAssignmentConfirmedModal(pendingAssignmentConfirmations.slice());
      pendingAssignmentConfirmations = [];
    }
    return true;
  } catch (error) {
    console.error("No se pudo guardar en DB nueva:", error?.message || error, error?.code || "");
    savePendingTargetRowsLocally("Error de sincronizacion (DB nueva)", rowsToPersist, currentProgramacionIdTarget, currentProgramacionFileNameTarget);
    setSyncStatus("warn", "Pendiente DB nueva");
    showToast("Guardado local pendiente de confirmacion en DB nueva.", "warn");
    scheduleTargetSyncRetry(reason);
    return false;
  } finally {
    syncRowsInProgressTarget = false;
    if (syncRowsPendingTarget) {
      syncRowsPendingTarget = false;
      try {
        await syncProgramacionRowsToTargetSupabase("Sincronizando cola DB nueva...", { skipQueueSave: true });
      } catch (queueErr) {
        console.warn("No se pudo sincronizar cola pendiente DB nueva:", queueErr);
      }
    }
  }
}

function renderTable2(){
  if (!gridHead2 || !gridBody2) return;
  if (isTargetTableEditing() && gridBody2.children.length > 0) {
    return;
  }
  gridHead2.innerHTML = "";
  gridBody2.innerHTML = "";
  refreshFilterDateOptions2();

  if (!Array.isArray(rowsTarget) || rowsTarget.length === 0) {
    gridBody2.innerHTML = `<tr><td colspan="99" class="muted" style="padding:20px;text-align:center">
      No hay programacion en la base nueva.
    </td></tr>`;
    return;
  }

  const rawHeaders = Object.keys(rowsTarget[0]).filter(h => h.toUpperCase() !== "HOJA" && !isInternalRowKey(h));
  const preferredHeaderOrder = ["#", "INICIA", "VEH", "CONDUCTOR 1", "INICIA 2", "CONDUCTOR 2", "HORA FIN"];
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
  const headers = [];
  preferredHeaderOrder.forEach(label => {
    const bucket = aliases[label] || [];
    const found = rawHeaders.find(h => {
      if (used.has(h)) return false;
      const t = headerTokens.get(h);
      return bucket.some(a => t === normalizeHeaderToken(a));
    });
    if (found) {
      used.add(found);
      headers.push(found);
    }
  });
  rawHeaders.forEach(h => {
    if (!used.has(h)) headers.push(h);
  });
  const headRow = document.createElement("tr");
  headers.forEach(h => {
    const th = document.createElement("th");
    th.textContent = h;
    headRow.appendChild(th);
  });
  gridHead2.appendChild(headRow);

  const baseKey = getBaseKeyFromRows(rowsTarget);
  const fechaKey = getFechaKeyFromArray(rowsTarget);
  const vehiculoKey = headers.find(h => {
    const n = norm(h);
    return n === "VEH" || n === "VEHICULO" || n === "VEHÍCULO" || n === "MOVIL" || n === "MÓVIL";
  }) || null;
  const puestoKey = headers.find(h => norm(h) === "PUESTO") || null;
  const numeroKey = headers.find(h => norm(h) === "#") || null;
  const iniciaKey = headers.find(h => {
    const t = normCompact(h).replace(/[^A-Z0-9]/g, "");
    return t === "INICIA" || t === "INICIO" || t === "HORAINICIO1" || t === "HORAINICIO";
  }) || null;
  const vehiculoSwapEnabled = isSuperAdmin() || getBaseCanonical(currentBase) === "3";
  const { key1: conductor1Key, key2: conductor2Key } = getConductorKeysFromArray(rowsTarget);
  const token = (h) => normCompact(h).replace(/[^A-Z0-9]/g, "");
  const resolvedConductor1Key = conductor1Key || headers.find(h => {
    const t = token(h);
    return t.includes("CONDUCT") && (t.includes("1") || t === "CONDUCTOR");
  }) || null;
  const resolvedConductor2Key = conductor2Key || headers.find(h => {
    const t = token(h);
    return t.includes("CONDUCT") && t.includes("2");
  }) || null;
  const fichoSanitized = sanitizeFichoConductorSlots(rowsTarget, resolvedConductor1Key, resolvedConductor2Key);
  if (fichoSanitized > 0 && currentProgramacionIdTarget && !syncRowsInProgressTarget) {
    syncProgramacionRowsToTargetSupabase("FICHO sin conductor guardado en DB nueva.").catch((error) => {
      console.warn("No se pudo sincronizar limpieza de conductores FICHO:", error);
    });
  }
  const selectedDate = normalizeDateToISO(filterDate2?.value || "");
  const typedDatalistId = "driversDatalistProgramacion2";
  let typedDatalist = document.getElementById(typedDatalistId);
  if (!typedDatalist) {
    typedDatalist = document.createElement("datalist");
    typedDatalist.id = typedDatalistId;
    document.body.appendChild(typedDatalist);
  }
  let filtered = rowsTarget.slice();
  if (currentBase) {
    const baseCanonical = getBaseCanonical(currentBase);
    filtered = filtered.filter(r => getRowCanonicalBase(r, baseKey) === baseCanonical);
  }
  if (currentBase && !selectedDate) {
    gridBody2.innerHTML = `<tr><td colspan="99" class="muted" style="padding:20px;text-align:center">
      Paso 1: selecciona una fecha para continuar con la asignacion.
    </td></tr>`;
    renderDrivers();
    return;
  }
  if (selectedDate && fechaKey) {
    filtered = filtered.filter(r => normalizeDateToISO(r[fechaKey]) === selectedDate);
  }
  if (!filtered.length) {
    if (selectedDate && currentProgramacionIdTarget && !table2ReloadingMissingRows) {
      table2ReloadingMissingRows = true;
      gridBody2.innerHTML = `<tr><td colspan="99" class="muted" style="padding:20px;text-align:center">
        Recargando filas de ${excelDateToReadable(selectedDate)}...
      </td></tr>`;
      loadTargetProgramacionByDate(selectedDate)
        .then(() => renderTable2())
        .catch((error) => {
          console.error("No se pudo recargar la programacion seleccionada:", error);
          gridBody2.innerHTML = `<tr><td colspan="99" class="muted" style="padding:20px;text-align:center">
            No se pudieron recargar las filas de ${excelDateToReadable(selectedDate)}.
          </td></tr>`;
        })
        .finally(() => {
          table2ReloadingMissingRows = false;
        });
      renderDrivers();
      return;
    }
    gridBody2.innerHTML = `<tr><td colspan="99" class="muted" style="padding:20px;text-align:center">
      No hay filas en DB nueva con los filtros actuales.
    </td></tr>`;
    renderDrivers();
    return;
  }

  const setDatalistOptionsForBase = (baseCanonical) => {
    const available = getAvailableDriversForBase(baseCanonical);
    typedDatalist.innerHTML = "";
    available
      .slice()
      .sort((a, b) => String(a).localeCompare(String(b), "es"))
      .forEach((name) => {
        const op = document.createElement("option");
        op.value = name;
        typedDatalist.appendChild(op);
      });
  };

  filtered.forEach(r => {
    const tr = document.createElement("tr");
    const isFichoRow = isFichoRowByContent(r);
    if (isFichoRow) tr.classList.add("ficho-sandiego");
    headers.forEach(k => {
      const td = document.createElement("td");
      let v = r[k];
      if (norm(k) === "FECHA") v = excelDateToReadable(v);
      if (isTimeColumnKey(k)) v = excelTimeToHHMM(v);
      const isConductorCell = (resolvedConductor1Key && k === resolvedConductor1Key) || (resolvedConductor2Key && k === resolvedConductor2Key);
      if (isConductorCell) {
        if (isFichoRow) {
          r[k] = UNASSIGNED_LABEL;
          setConductorNote(r, k, "");
          td.classList.add("slot-note-ok");
          td.innerHTML = `
            <span class="muted">FICHO sin conductor</span>
            <span class="estado-tag tag-pendiente">Bloqueado</span>
          `;
          tr.appendChild(td);
          return;
        }
        td.classList.add("drop");
        const assigned = extractConductorName(v || "");
        const noteText = getConductorNote(r, k);
        const rowLabel = getSwapRowLabel(r, { numeroKey, puestoKey, iniciaKey });
        const rowBaseCanonical = getRowCanonicalBase(r, baseKey) || getBaseCanonical(currentBase);
        const rowBaseLabel = formatBaseLabel(rowBaseCanonical || currentBase || "");
        // Etiqueta de la celda en su propio contenedor para poder refrescarla
        // sin destruir el input que el usuario esta editando.
        const labelWrap = document.createElement("div");
        labelWrap.className = "driver-cell-label";

        const wireNoteButton = () => {
          const noteBtn = labelWrap.querySelector(".btn-note");
          if (!noteBtn) return;
          noteBtn.addEventListener("click", async (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            const result = await openConductorNoteModal({
              note: getConductorNote(r, k),
              label: `${rowLabel} - ${k}`
            });
            if (!result || result.action === "cancel") return;
            if (result.action === "clear") setConductorNote(r, k, "");
            else if (result.action === "save") setConductorNote(r, k, result.text);
            renderLabel();
            renderDrivers();
            await syncProgramacionRowsToTargetSupabase("Nota de casilla guardada en DB nueva.");
          });
        };

        const renderLabel = () => {
          const assignedNow = extractConductorName(r[k] || "");
          const noteNow = getConductorNote(r, k);
          if (assignedNow) {
            td.classList.add("filled");
            labelWrap.innerHTML = `
              <div>${r[k] || ""}</div>
              <span class="base-badge">${rowBaseLabel}</span>
            `;
          } else {
            td.classList.remove("filled");
            labelWrap.innerHTML = `
              <span class="muted">${UNASSIGNED_LABEL}</span>
              <span class="slot-hint">Copia una nota o asigna conductor</span>
              ${noteNow ? `<div class="cell-note">${noteNow}</div>` : ""}
              <button class="btn-note" type="button">${noteNow ? "Editar nota" : "Agregar nota"}</button>
            `;
            wireNoteButton();
          }
        };

        renderLabel();
        td.appendChild(labelWrap);

        const editorWrap = document.createElement("div");
        editorWrap.style.marginTop = "6px";
        const input = document.createElement("input");
        input.type = "text";
        input.className = "driver-typed-input";
        input.placeholder = "Escribe o pega conductor...";
        input.autocomplete = "off";
        input.setAttribute("list", typedDatalistId);
        input.style.width = "100%";
        input.style.fontSize = "12px";
        input.style.padding = "4px 6px";
        input.style.border = "1px solid #cbd5e1";
        input.style.borderRadius = "6px";
        input.value = assigned || "";
        editorWrap.appendChild(input);
        td.appendChild(editorWrap);

        let commitInProgress = false;
        const commitTypedDriver = async () => {
          if (commitInProgress) return;
          commitInProgress = true;
          try {
            const typed = String(input.value || "").trim();
            const previousName = extractConductorName(r[k] || "");
            if (!typed) {
              if (!previousName) return;
              r[k] = UNASSIGNED_LABEL;
              input.value = "";
              renderLabel();
              scheduleTargetEditSave(`Remocion guardada en DB nueva (${k}).`);
              rebuildAssigned();
              renderDrivers();
              return;
            }

            const baseCanonical = getBaseCanonical(rowBaseCanonical || currentBase);
            const pool = driversByBase[baseCanonical] || driversByBase[formatBaseLabel(baseCanonical)] || [];
            const matched = pool.find(name => norm(name) === norm(typed));
            if (!matched) {
              showToast(`"${typed}" no existe en ${formatBaseLabel(baseCanonical || currentBase || "")}.`, "warn");
              input.focus();
              input.select();
              return;
            }

            rebuildAssigned();
            const used = assignedByBase[baseCanonical] || assignedByBase[formatBaseLabel(baseCanonical)] || new Set();
            if (used.has(norm(matched)) && norm(previousName) !== norm(matched)) {
              showToast(`${matched} ya esta asignado en ${formatBaseLabel(baseCanonical)} para esta fecha.`, "warn");
              input.value = previousName || "";
              input.focus();
              input.select();
              return;
            }

            if (norm(previousName) === norm(matched)) return;
            r[k] = matched;
            setConductorNote(r, k, "");
            input.value = matched;
            renderLabel();
            pendingAssignmentConfirmations.push({
              conductor: matched,
              vehiculo: String(r[getVehiculoKey(r)] || "").trim(),
              slot: k
            });
            scheduleTargetEditSave(`Asignacion guardada en DB nueva (${k}).`);
            rebuildAssigned();
            renderDrivers();
          } finally {
            commitInProgress = false;
          }
        };

        input.addEventListener("focus", () => {
          targetEditingUntil = Date.now() + 3000;
          setDatalistOptionsForBase(getBaseCanonical(rowBaseCanonical || currentBase));
          input.select();
        });
        input.addEventListener("keydown", async (ev) => {
          if (ev.key === "Enter") {
            ev.preventDefault();
            await commitTypedDriver();
          }
          if (ev.key === "Escape") {
            ev.preventDefault();
            input.value = extractConductorName(r[k] || "");
            input.blur();
          }
        });
        input.addEventListener("change", async () => {
          await commitTypedDriver();
        });
        input.addEventListener("blur", async () => {
          await commitTypedDriver();
        });

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
            if (data.tipo !== "conductor") return;
            r[k] = data.nombre;
            setConductorNote(r, k, "");
            input.value = extractConductorName(r[k] || "");
            renderLabel();
            pendingAssignmentConfirmations.push({
              conductor: extractConductorName(r[k] || "") || String(data.nombre || ""),
              vehiculo: String(r[getVehiculoKey(r)] || "").trim(),
              slot: k
            });
            scheduleTargetEditSave(`Asignacion guardada en DB nueva (${k}).`);
            renderDrivers();
          } catch (e) {
            console.error("No se pudo asignar conductor en tabla 2:", e);
            showToast("No se pudo asignar conductor en Turnos del dia 2.", "err");
          }
        };
        td.ondblclick = async () => {
          const existingName = extractConductorName(r[k] || "");
          if (!existingName) return;
          const ok = confirm(`Quitar a ${existingName} de ${k} en DB nueva?`);
          if (!ok) return;
          r[k] = UNASSIGNED_LABEL;
          input.value = "";
          renderLabel();
          scheduleTargetEditSave(`Remocion guardada en DB nueva (${k}).`);
          renderDrivers();
        };
      } else if (vehiculoKey && k === vehiculoKey) {
        const vehLabel = v || "";
        const rowLabel = getSwapRowLabel(r, { numeroKey, puestoKey, iniciaKey });
        if (vehiculoSwapEnabled) td.classList.add("veh-drop");
        td.innerHTML = `<div>${vehLabel}</div>`;
        td.title = vehiculoSwapEnabled
          ? "Arrastra este vehiculo sobre otro para intercambiar posicion"
          : "Vehiculo";
        td.draggable = !!r[k] && vehiculoSwapEnabled;

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
          td.classList.add("highlight");
          ev.dataTransfer.setData("text/plain", JSON.stringify({
            tipo: "vehiculo_posicion",
            sourceRowUiId: ensureRowUiId(r),
            sourceRowKey: buildProgramacionRowKey(r),
            sourceVehiculoKey: k,
            sourceVehiculo: String(sourceValue),
            sourceLabel: rowLabel
          }));
          ev.dataTransfer.effectAllowed = "move";
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

            const sourceRow = rowsTarget.find(row => ensureRowUiId(row) === data.sourceRowUiId)
              || rowsTarget.find(row => buildProgramacionRowKey(row) === data.sourceRowKey);
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
            if (!ok) return;

            sourceRow[sourceVehiculoKey] = targetValue;
            r[k] = sourceValue;
            // Regla operativa: el carro se lleva sus conductores al cambiar de posicion.
            const conductorSync = syncConductoresAfterVehicleSwap(sourceRow, r, resolvedConductor1Key, resolvedConductor2Key);
            const sourceIsFicho = isFichoRowByContent(sourceRow);
            const targetIsFicho = isFichoRowByContent(r);
            const fichoUpdated = (sourceIsFicho || targetIsFicho)
              ? 0
              : syncFichoVehicleLinksAfterSwapInDataset(rowsTarget, {
                  sourceVeh: sourceValue,
                  targetVeh: targetValue,
                  selectedDate,
                  currentBase,
                  baseKey,
                  fechaKey,
                  conductorKey1: resolvedConductor1Key,
                  conductorKey2: resolvedConductor2Key,
                  excludedRows: [sourceRow, r]
                });
            const deduped = dedupeProgramacionRows(rowsTarget);
            if (deduped.removed > 0) rowsTarget = deduped.rows;

            renderTable2();
            renderDrivers();
            const conductorMsg = conductorSync.blockedByFicho
              ? " | FICHO sin conductor"
              : (conductorSync.swapped ? " | Conductores movidos con el carro" : "");
            showToast(`Cambio confirmado: ${sourceValue || "-"} <-> ${targetValue || "-"}${conductorMsg}${fichoUpdated ? ` | FICHO actualizados: ${fichoUpdated}` : ""}`, "ok");
            await syncProgramacionRowsToTargetSupabase("Cambio de posicion de vehiculos guardado en DB nueva.");
          } catch (e) {
            console.error("Error intercambio vehiculos en DB nueva", e);
            showToast("No se pudo intercambiar la posicion de vehiculos en DB nueva.", "err");
          }
        };
      } else {
        td.textContent = v || "";
      }
      tr.appendChild(td);
    });
    gridBody2.appendChild(tr);
  });
  rebuildAssigned();
  renderDrivers();
}

function getBaseKeyFromRows(inputRows){
  if (!Array.isArray(inputRows) || inputRows.length === 0) return null;
  const headerSet = new Set();
  inputRows.slice(0, 200).forEach(r => Object.keys(r || {}).forEach(k => headerSet.add(k)));
  const keys = Array.from(headerSet);
  return keys.find(k => BASE_COLUMN_ALIASES.includes(norm(k))) || null;
}

function setMigrationOutput(linesInput){
  if (!migrationOutput) return;
  const list = Array.isArray(linesInput) ? linesInput : [String(linesInput || "")];
  migrationOutput.textContent = list.join("\n");
}

function renderMigrationDbInfo(){
  if (!migrationDbInfo) return;
  if (USE_ONLY_NEW_DB) {
    migrationDbInfo.textContent = `Base vieja desactivada | Proyecto activo: ${PROGRAMACIONES_TARGET_REF}`;
    return;
  }
  migrationDbInfo.textContent = `Origen viejo: ${PROGRAMACIONES_SOURCE_REF} | Destino nuevo: ${PROGRAMACIONES_TARGET_REF}`;
}

async function fetchProgramacionRowsFromClient(client, programacionId, options = {}){
  if (!programacionId) return { ok: true, rows: [] };
  const fechaScope = normalizeDateToISO(options?.fecha || "");
  const pageSize = 1000;
  const allRows = [];
  let offset = 0;

  while (true) {
    let query = client
      .from("programacion_filas")
      .select("row_data")
      .eq("programacion_id", programacionId)
      .order("id", { ascending: true });
    if (fechaScope) query = query.eq("fecha", fechaScope);
    const { data, error } = await query.range(offset, offset + pageSize - 1);
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

async function syncProgramacionRowsTableWithClient(client, programacionId, rowsInput, updatedByOverride = null, options = {}){
  if (!programacionId) return { ok: false, skipped: true };
  const fechaScope = normalizeDateToISO(options?.fecha || "");
  const payload = buildProgramacionFilaPayload(rowsInput, programacionId).map(item => ({
    ...item,
    updated_by: updatedByOverride || item.updated_by || null
  }));
  const pageSize = 1000;
  const existingRows = [];
  let offset = 0;
  while (true) {
    let existingQuery = client
      .from("programacion_filas")
      .select("row_key")
      .eq("programacion_id", programacionId)
      .order("id", { ascending: true });
    if (fechaScope) existingQuery = existingQuery.eq("fecha", fechaScope);
    const existingResult = await existingQuery.range(offset, offset + pageSize - 1);
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
    let deleteQuery = client
      .from("programacion_filas")
      .delete()
      .eq("programacion_id", programacionId)
      .in("row_key", keyChunk);
    if (fechaScope) deleteQuery = deleteQuery.eq("fecha", fechaScope);
    const delResult = await deleteQuery;
    if (delResult.error) throw delResult.error;
  }

  for (const upsertChunk of chunkArray(payload, 300)) {
    if (upsertChunk.length === 0) continue;
    const upsertResult = await client
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

async function ensureTargetMigrationSession(options = {}){
  if (authClient === programacionesTargetClient && currentUserId) {
    return { userId: currentUserId, email: currentUserEmail || "" };
  }
  const forceReauth = !!options?.forceReauth;
  const sessionResult = await programacionesTargetClient.auth.getSession();
  const existingUser = sessionResult?.data?.session?.user || null;
  const sameEmail = norm(existingUser?.email || "") === norm(currentUserEmail || "");

  if (!forceReauth && existingUser?.id && sameEmail) {
    return { userId: existingUser.id, email: existingUser.email || "" };
  }

  if (existingUser?.id && (forceReauth || !sameEmail)) {
    try {
      await programacionesTargetClient.auth.signOut();
    } catch (signOutError) {
      console.warn("No se pudo cerrar sesion previa del proyecto nuevo:", signOutError);
    }
  }

  const email = String(currentUserEmail || "").trim();
  if (!email) {
    throw new Error("No hay correo autenticado en la sesion principal para iniciar sesion en el destino.");
  }

  const pwd = prompt(`Ingresa la contrasena de ${email} para autenticar el proyecto nuevo (${PROGRAMACIONES_TARGET_REF}):`, "");
  if (pwd === null) {
    throw new Error("Migracion cancelada: no se ingreso contrasena para el proyecto nuevo.");
  }
  const password = String(pwd || "").trim();
  if (!password) {
    throw new Error("Migracion cancelada: contrasena vacia.");
  }

  const signInResult = await programacionesTargetClient.auth.signInWithPassword({ email, password });
  if (signInResult.error) {
    throw new Error(`No se pudo iniciar sesion en destino (${PROGRAMACIONES_TARGET_REF}): ${signInResult.error.message || "sin detalle"}`);
  }
  const user = signInResult?.data?.user || signInResult?.data?.session?.user || null;
  if (!user?.id) {
    throw new Error("Sesion iniciada en destino, pero no se obtuvo user id.");
  }
  return { userId: user.id, email: user.email || email };
}

async function getLatestProgramacionSummaryFromClient(client){
  const { data, error } = await client
    .from("programaciones")
    .select("id, file_name, uploaded_by, created_at")
    .order("id", { ascending: false })
    .limit(1);
  if (error) throw error;
  if (!Array.isArray(data) || data.length === 0) return null;
  const latest = data[0];
  let filasCount = 0;
  if (latest?.id) {
    const countResult = await client
      .from("programacion_filas")
      .select("id", { count: "exact", head: true })
      .eq("programacion_id", latest.id);
    if (countResult.error) throw countResult.error;
    filasCount = Number(countResult.count || 0);
  }
  return {
    id: latest.id,
    file_name: latest.file_name || "programacion_online",
    created_at: latest.created_at || "",
    uploaded_by: latest.uploaded_by || "",
    rows_data_count: null,
    filas_count: filasCount
  };
}

async function renderMigrationStatus(){
  if (!migrationOutput) return;
  renderMigrationDbInfo();
  if (USE_ONLY_NEW_DB) {
    setMigrationOutput(`Modo actual: solo DB nueva (${PROGRAMACIONES_TARGET_REF}).\nMigracion vieja->nueva desactivada.`);
    return;
  }
  setMigrationOutput("Consultando estado de origen y destino...");
  try {
    const [source, target] = await Promise.all([
      getLatestProgramacionSummaryFromClient(supabaseClient),
      getLatestProgramacionSummaryFromClient(programacionesTargetClient)
    ]);
    const lines = [];
    lines.push(`Origen viejo (${PROGRAMACIONES_SOURCE_REF})`);
    if (!source) lines.push("- Sin programaciones.");
    else {
      lines.push(`- ID: ${source.id}`);
      lines.push(`- Archivo: ${source.file_name}`);
      lines.push(`- Filas rows_data: ${source.rows_data_count ?? "n/a (optimizado)"}`);
      lines.push(`- Filas programacion_filas: ${source.filas_count}`);
      lines.push(`- Creado: ${source.created_at || "sin dato"}`);
    }
    lines.push("");
    lines.push(`Destino nuevo (${PROGRAMACIONES_TARGET_REF})`);
    if (!target) lines.push("- Sin programaciones.");
    else {
      lines.push(`- ID: ${target.id}`);
      lines.push(`- Archivo: ${target.file_name}`);
      lines.push(`- Filas rows_data: ${target.rows_data_count ?? "n/a (optimizado)"}`);
      lines.push(`- Filas programacion_filas: ${target.filas_count}`);
      lines.push(`- Creado: ${target.created_at || "sin dato"}`);
    }
    setMigrationOutput(lines);
  } catch (e) {
    setMigrationOutput(`Error consultando estado de migracion:\n${e?.message || String(e)}`);
  }
}

async function fetchSourceProgramacionRecord(recordId){
  if (recordId) {
    const parsedId = Number(recordId);
    if (!Number.isFinite(parsedId)) {
      throw new Error("ID de programacion invalido para migracion.");
    }
    const one = await supabaseClient
      .from("programaciones")
      .select("id, file_name, rows_data, uploaded_by, created_at")
      .eq("id", parsedId)
      .limit(1)
      .maybeSingle();
    if (one.error) throw one.error;
    return one.data || null;
  }
  const latest = await supabaseClient
    .from("programaciones")
    .select("id, file_name, rows_data, uploaded_by, created_at")
    .order("id", { ascending: false })
    .limit(1);
  if (latest.error) throw latest.error;
  return Array.isArray(latest.data) && latest.data.length > 0 ? latest.data[0] : null;
}

async function migrateProgramacionToNewProject(recordId = null){
  if (USE_ONLY_NEW_DB) {
    setMigrationOutput(`Migracion desactivada: el sistema ya trabaja solo con DB nueva (${PROGRAMACIONES_TARGET_REF}).`);
    return;
  }
  if (!isSuperAdmin()) {
    showToast("Solo el super administrador puede migrar programaciones.", "warn");
    return;
  }
  if (!currentUserId) {
    showToast("Inicia sesion antes de migrar.", "warn");
    return;
  }
  renderMigrationDbInfo();
  setMigrationOutput("Preparando migracion manual...");

  try {
    const targetAuth = await ensureTargetMigrationSession();
    const sourceRecord = await fetchSourceProgramacionRecord(recordId);
    if (!sourceRecord?.id) {
      setMigrationOutput("No se encontro la programacion origen para migrar.");
      return;
    }

    let sourceRows = [];
    const sourceRowsResult = await fetchProgramacionRowsFromClient(supabaseClient, sourceRecord.id);
    if (sourceRowsResult?.ok && Array.isArray(sourceRowsResult.rows) && sourceRowsResult.rows.length > 0) {
      sourceRows = sourceRowsResult.rows;
    } else {
      sourceRows = Array.isArray(sourceRecord.rows_data) ? sourceRecord.rows_data : [];
    }
    const prepared = normalizeProgramacionRows(sourceRows);
    const deduped = dedupeProgramacionRows(prepared.normalized);
    const rowsToMigrate = deduped.rows;

    const targetFileName = `${sourceRecord.file_name || "programacion_online"} [migrada_${PROGRAMACIONES_SOURCE_REF}_id_${sourceRecord.id}]`;
    const insertResult = await programacionesTargetClient
      .from("programaciones")
      .insert({
        uploaded_by: targetAuth.userId,
        file_name: targetFileName,
        file_path: null,
        rows_data: STORE_ROWS_DATA_INLINE ? rowsToMigrate : []
      })
      .select("id, created_at")
      .single();
    if (insertResult.error) throw insertResult.error;
    const targetProgramacionId = insertResult.data?.id || null;
    if (!targetProgramacionId) {
      throw new Error("No se pudo obtener el ID de programacion destino.");
    }

    const syncRowsResult = await syncProgramacionRowsTableWithClient(
      programacionesTargetClient,
      targetProgramacionId,
      rowsToMigrate,
      targetAuth.userId
    );
    if (!syncRowsResult?.ok) {
      if (syncRowsResult?.unavailable) {
        throw new Error("La tabla programacion_filas no esta disponible en el destino.");
      }
      throw new Error("No se pudieron sincronizar las filas en el destino.");
    }

    const verifyRowsResult = await fetchProgramacionRowsFromClient(programacionesTargetClient, targetProgramacionId);
    if (!verifyRowsResult?.ok) {
      throw new Error("No se pudo verificar la lectura de programacion_filas en el destino.");
    }
    const expectedScoped = getRowsScopedForCurrentUser(rowsToMigrate);
    const actualScoped = getRowsScopedForCurrentUser(verifyRowsResult.rows || []);
    const verified = rowsSignature(expectedScoped) === rowsSignature(actualScoped);
    if (!verified) {
      throw new Error(`Migracion incompleta: diferencia detectada (${actualScoped.length}/${expectedScoped.length} filas).`);
    }

    const lines = [];
    lines.push("Migracion completada.");
    lines.push(`Origen viejo: ${PROGRAMACIONES_SOURCE_REF} | ID ${sourceRecord.id}`);
    lines.push(`Destino nuevo: ${PROGRAMACIONES_TARGET_REF} | ID ${targetProgramacionId}`);
    lines.push(`Usuario destino autenticado: ${targetAuth.email || targetAuth.userId}`);
    lines.push(`Archivo origen: ${sourceRecord.file_name || "programacion_online"}`);
    lines.push(`Filas migradas (dedupe): ${rowsToMigrate.length}`);
    lines.push(`Vehiculos sin base mapeada: ${prepared.unmappedVehicles}`);
    lines.push(`Duplicados removidos: ${deduped.removed}`);
    lines.push("Verificacion: OK en programacion_filas (destino).");
    setMigrationOutput(lines);
    showToast(`Migracion completada al proyecto nuevo (${PROGRAMACIONES_TARGET_REF}).`, "ok");
    await renderMigrationStatus();
  } catch (e) {
    const message = e?.message || String(e);
    setMigrationOutput(`Error en migracion manual:\n${message}`);
    showToast("Fallo la migracion manual. Revisa el detalle en Diagnostico.", "err");
  }
}

async function handleMigrateLatestProgramacionClick(){
  await migrateProgramacionToNewProject(null);
}

async function handleMigrateSelectedProgramacionClick(){
  const selectedId = String(document.getElementById("historyProgramacion")?.value || "").trim();
  if (!selectedId) {
    showToast("Selecciona una programacion en el historial para migrarla.", "warn");
    return;
  }
  await migrateProgramacionToNewProject(selectedId);
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
  { title: "Hora llegada", value: (row) => formatPlanillaDateTime(row?.hora_llegada || row?.generado_en || row?.created_at) },
  { title: "Tipo", value: (row) => mapTipoLlegada(row?.tipo_llegada) },
  { title: "Base", value: (row) => row?.base },
  { title: "Interno", value: (row) => row?.interno },
  { title: "Itinerario llegada", value: (row) => row?.itinerario_llegada },
  { title: "Hora despacho", value: (row) => getDespachoDateTimeText(row) },
  { title: "Itinerario despacho", value: (row) => getItinerarioDespachoText(row) },
  { title: "Conductor", value: (row) => hasValidDespacho(row) ? row?.conductor : "-" },
  { title: "Estado", value: (row) => getOperacionEstadoText(row) },
  { title: "Espera", value: (row) => getEsperaText(row) },
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
  const ordered = filtered.sort(compareRowsByDespachoDesc);
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

function compareRowsByDespachoDesc(a, b){
  const aDesp = hasValidDespacho(a) ? parsePlanillaDateTime(a?.hora_despacho) : null;
  const bDesp = hasValidDespacho(b) ? parsePlanillaDateTime(b?.hora_despacho) : null;

  if (aDesp && bDesp) {
    const diff = bDesp.getTime() - aDesp.getTime();
    if (diff !== 0) return diff;
  } else if (aDesp && !bDesp) {
    return -1;
  } else if (!aDesp && bDesp) {
    return 1;
  }

  const aArr = parsePlanillaDateTime(a?.hora_llegada || a?.generado_en || a?.created_at || a?.hora_despacho);
  const bArr = parsePlanillaDateTime(b?.hora_llegada || b?.generado_en || b?.created_at || b?.hora_despacho);
  if (!aArr && !bArr) return 0;
  if (!aArr) return 1;
  if (!bArr) return -1;
  return bArr.getTime() - aArr.getTime();
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

function getArrivalDateTime(row){
  return parsePlanillaDateTime(row?.hora_llegada || row?.generado_en || row?.created_at);
}

function getDispatchDateTime(row){
  return parsePlanillaDateTime(row?.hora_despacho);
}

function getDispatchLagMs(row){
  const arrival = getArrivalDateTime(row);
  const dispatch = getDispatchDateTime(row);
  if (!arrival || !dispatch) return null;
  return dispatch.getTime() - arrival.getTime();
}

function isDispatchTimeCoherent(row){
  const raw = String(row?.hora_despacho ?? "").trim();
  if (!raw || raw === "-") return false;
  const dispatch = getDispatchDateTime(row);
  if (!dispatch) return false;
  const arrival = getArrivalDateTime(row);
  if (!arrival) return true; // sin llegada no se puede validar, se conserva
  const lag = dispatch.getTime() - arrival.getTime();
  if (lag < 0) return false;
  return lag <= (MAX_COHERENT_DISPATCH_MINUTES * 60000);
}

function hasValidDespacho(row){
  return isDispatchTimeCoherent(row);
}

function getDespachoDateTimeText(row){
  if (!hasValidDespacho(row)) return "-";
  return formatPlanillaDateTime(row?.hora_despacho);
}

function getOperacionEstadoText(row){
  if (hasValidDespacho(row)) return "Despachado";
  return "En espera";
}

function getEsperaText(row){
  if (!hasValidDespacho(row)) return "-";
  const lag = getDispatchLagMs(row);
  if (lag === null || lag < 0) return "-";
  const mins = Math.floor(lag / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h <= 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
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
  if (!hasValidDespacho(row)) return "-";
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
  return active
    ? "background:#b45309;border-color:#b45309;color:#ffffff"
    : "background:#fff7ed;border-color:#fdba74;color:#9a3412";
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

function buildArrivalCrossKey(row){
  const interno = formatPlanillaCell(row?.interno).trim();
  const base = formatPlanillaCell(row?.base).trim();
  if (!interno) return "";
  return `${base}|${interno}`;
}

function omitArrivalsNearRecentDispatch(rowsInput, contextRowsInput, windowMinutes = ARRIVAL_OMIT_WINDOW_MINUTES){
  const rows = Array.isArray(rowsInput) ? rowsInput : [];
  if (!rows.length) return rows;
  const contextRows = Array.isArray(contextRowsInput) ? contextRowsInput : [];
  const windowMs = Math.max(1, Number(windowMinutes) || ARRIVAL_OMIT_WINDOW_MINUTES) * 60000;

  const dispatchMap = new Map(); // key -> [dispatchTimeMs...]
  contextRows.forEach(row => {
    if (!hasValidDespacho(row)) return;
    const key = buildArrivalCrossKey(row);
    if (!key) return;
    const dispatchDt = parsePlanillaDateTime(row?.hora_despacho);
    if (!dispatchDt) return;
    if (!dispatchMap.has(key)) dispatchMap.set(key, []);
    dispatchMap.get(key).push(dispatchDt.getTime());
  });

  dispatchMap.forEach(list => list.sort((a, b) => b - a));

  return rows.filter(row => {
    if (hasValidDespacho(row)) return true; // siempre conservar el registro completo
    const key = buildArrivalCrossKey(row);
    if (!key) return true;
    const arrivalDt = parsePlanillaDateTime(row?.hora_llegada || row?.generado_en || row?.created_at);
    if (!arrivalDt) return true;
    const arrMs = arrivalDt.getTime();
    const dispatchTimes = dispatchMap.get(key) || [];
    for (let i = 0; i < dispatchTimes.length; i++) {
      const dispMs = dispatchTimes[i];
      const diff = arrMs - dispMs;
      if (diff >= 0 && diff <= windowMs) {
        return false; // omitir llegada "suelta" que cae poco despues de un despacho
      }
      if (dispMs < arrMs - windowMs) break;
    }
    return true;
  });
}

function hasDispatchAfterArrivalForRow(row, contextRowsInput){
  const contextRows = Array.isArray(contextRowsInput) ? contextRowsInput : [];
  const key = buildArrivalCrossKey(row);
  if (!key) return false;
  const arrivalDt = parsePlanillaDateTime(row?.hora_llegada || row?.generado_en || row?.created_at);
  if (!arrivalDt) return false;
  const arrivalMs = arrivalDt.getTime();

  for (let i = 0; i < contextRows.length; i++) {
    const candidate = contextRows[i];
    if (!hasValidDespacho(candidate)) continue;
    if (buildArrivalCrossKey(candidate) !== key) continue;
    const dispatchDt = parsePlanillaDateTime(candidate?.hora_despacho);
    if (!dispatchDt) continue;
    if (dispatchDt.getTime() >= arrivalMs) return true;
  }
  return false;
}

function getWaitingOverThresholdRows(rowsInput, thresholdMinutes = WAITING_NOVEDAD_THRESHOLD_MINUTES){
  const rows = Array.isArray(rowsInput) ? rowsInput : [];
  const thresholdMs = Math.max(1, Number(thresholdMinutes) || WAITING_NOVEDAD_THRESHOLD_MINUTES) * 60000;
  const nowMs = Date.now();
  return rows.filter(row => {
    if (hasValidDespacho(row)) return false;
    const arrivalDt = parsePlanillaDateTime(row?.hora_llegada || row?.generado_en || row?.created_at);
    if (!arrivalDt) return false;
    return (nowMs - arrivalDt.getTime()) >= thresholdMs;
  });
}

function isWaitingOverThreshold(row, thresholdMinutes = WAITING_NOVEDAD_THRESHOLD_MINUTES){
  if (hasValidDespacho(row)) return false;
  const arrivalDt = parsePlanillaDateTime(row?.hora_llegada || row?.generado_en || row?.created_at);
  if (!arrivalDt) return false;
  const thresholdMs = Math.max(1, Number(thresholdMinutes) || WAITING_NOVEDAD_THRESHOLD_MINUTES) * 60000;
  return (Date.now() - arrivalDt.getTime()) >= thresholdMs;
}

function shouldMoveToWaitingNovedades(row, contextRowsInput, thresholdMinutes = WAITING_NOVEDAD_THRESHOLD_MINUTES){
  if (!isWaitingOverThreshold(row, thresholdMinutes)) return false;
  // Si ya tiene despacho posterior asociado, no se considera novedad.
  if (hasDispatchAfterArrivalForRow(row, contextRowsInput)) return false;
  return true;
}

function getLlegadasRowsForView(tipoCode, options = {}){
  const searchTerm = String(options.searchTerm || "");
  const fromIso = String(options.fromIso || "").trim();
  const toIso = String(options.toIso || "").trim();
  const estadoMode = String(options.estadoMode || "");
  const hasExplicitFilters = !!searchTerm.trim() || !!fromIso || !!toIso || !!estadoMode;
  const rows = getLlegadasRowsByTipo(tipoCode, { preferToday: !hasExplicitFilters });
  const reconciled = omitArrivalsNearRecentDispatch(rows, planillaAfiliadosRows, ARRIVAL_OMIT_WINDOW_MINUTES);
  // Los "en espera" mayores al umbral van a la pestana de Novedades Llegadas
  // y se ocultan en las pestanas principales de llegadas.
  const withoutLongWaiting = reconciled.filter(row => !isWaitingOverThreshold(row, WAITING_NOVEDAD_THRESHOLD_MINUTES));
  const byEstado = getRowsFilteredByEstado(withoutLongWaiting, estadoMode);
  const byDate = getRowsFilteredByUploadDate(byEstado, fromIso, toIso);
  return getRowsFilteredBySearchTerm(byDate, searchTerm);
}

function renderLlegadasNovedades(){
  if (!llegadasNovedadesBody) return;
  const source = Array.isArray(planillaAfiliadosRows) ? planillaAfiliadosRows : [];
  const waitingRows = getWaitingOverThresholdRows(source, WAITING_NOVEDAD_THRESHOLD_MINUTES)
    .filter(row => !hasDispatchAfterArrivalForRow(row, source))
    .sort((a, b) => {
      const da = parsePlanillaDateTime(a?.hora_llegada || a?.generado_en || a?.created_at);
      const db = parsePlanillaDateTime(b?.hora_llegada || b?.generado_en || b?.created_at);
      if (!da && !db) return 0;
      if (!da) return 1;
      if (!db) return -1;
      return da.getTime() - db.getTime(); // mas antiguos primero
    });

  lastNovedadesLlegadasRows = waitingRows.slice();
  if (llegadasNovedadesCount) llegadasNovedadesCount.textContent = String(waitingRows.length);
  if (llegadasNovedadesTitle) llegadasNovedadesTitle.textContent = `Novedades de llegadas en espera (+${Math.floor(WAITING_NOVEDAD_THRESHOLD_MINUTES / 60)}h)`;
  if (llegadasNovedadesStatus) {
    const stamp = new Date().toLocaleString("es-CO");
    llegadasNovedadesStatus.textContent = `Actualizado: ${stamp}`;
  }

  if (!waitingRows.length) {
    llegadasNovedadesBody.innerHTML = `<tr><td colspan="8" class="muted" style="text-align:center;padding:12px">Sin novedades de llegadas pendientes de validacion.</td></tr>`;
    return;
  }

  llegadasNovedadesBody.innerHTML = waitingRows.map(row => {
    const arrivalDt = parsePlanillaDateTime(row?.hora_llegada || row?.generado_en || row?.created_at);
    const horaTxt = formatPlanillaDateTime(row?.hora_llegada || row?.generado_en || row?.created_at);
    const haceTxt = formatTimeAgoEs(arrivalDt);
    const baseTxt = formatPlanillaCell(row?.base);
    const internoTxt = formatPlanillaCell(row?.interno);
    const tipoTxt = mapTipoLlegada(row?.tipo_llegada);
    const itinTxt = getItinerarioLlegadaText(row);
    return `
    <tr>
      <td>${escapeHtml(horaTxt)}</td>
      <td><strong style="color:#1d4ed8">${escapeHtml(haceTxt)}</strong></td>
      <td>${escapeHtml(baseTxt)}</td>
      <td><strong style="color:#065f46">${escapeHtml(internoTxt)}</strong></td>
      <td>${escapeHtml(tipoTxt)}</td>
      <td><strong style="color:#9a3412">${escapeHtml(itinTxt)}</strong></td>
      <td><span style="display:inline-block;padding:2px 8px;border:1px solid #f59e0b;border-radius:999px;background:#fffbeb;color:#92400e;font-size:12px;line-height:1.2">En espera > 3h</span></td>
      <td>Validar enturnamiento, despacho y GPS</td>
    </tr>`;
  }).join("");
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
    const estadoTxt = getOperacionEstadoText(row);
    const esperaTxt = getEsperaText(row);
    const conductorTxt = hasValidDespacho(row) ? formatPlanillaCell(row?.conductor) : "-";
    const horaDespTxt = getDespachoDateTimeText(row);
    const itinDespTxt = getItinerarioDespachoText(row);
    const base = {
      "Fecha subida": getPlanillaUploadDateText(row),
      "Tipo": mapTipoLlegada(row?.tipo_llegada),
      "Base": formatPlanillaCell(row?.base),
      "Interno": formatPlanillaCell(row?.interno),
      "Conductor": conductorTxt,
      "Estado": estadoTxt,
      "Espera": esperaTxt
    };
    if (mode === "despachos") {
      return {
        "Hora despacho": horaDespTxt,
        "Itinerario despacho": itinDespTxt,
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
    .sort(compareRowsByDespachoDesc);
  return dedupeLlegadasByHour(sorted);
}

function renderLlegadasAeropuerto(){
  if (!llegadasAeropuertoBody) return;
  const estadoMode = "en_espera";
  if (aeropuertoEstadoFilter) aeropuertoEstadoFilter.value = "en_espera";
  const rowsSource = getLlegadasRowsForView("104", {
    searchTerm: aeropuertoSearch?.value || "",
    estadoMode,
    fromIso: aeropuertoUploadFrom?.value || "",
    toIso: aeropuertoUploadTo?.value || ""
  });
  const rows = rowsSource;
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
  const estadoMode = "en_espera";
  if (sanDiegoEstadoFilter) sanDiegoEstadoFilter.value = "en_espera";
  const rowsSource = getLlegadasRowsForView("101", {
    searchTerm: sanDiegoSearch?.value || "",
    estadoMode,
    fromIso: sanDiegoUploadFrom?.value || "",
    toIso: sanDiegoUploadTo?.value || ""
  });
  const rows = rowsSource;
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
  const estadoMode = "en_espera";
  if (nutibaraEstadoFilter) nutibaraEstadoFilter.value = "en_espera";
  const rowsSource = getLlegadasRowsForView("110", {
    searchTerm: nutibaraSearch?.value || "",
    estadoMode,
    fromIso: nutibaraUploadFrom?.value || "",
    toIso: nutibaraUploadTo?.value || ""
  });
  const rows = rowsSource;
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

function getLocalIsoDate(value){
  const d = value instanceof Date ? value : new Date(value);
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getPlanillaVisibleDateRange(){
  const activeTab = getActiveTabId();
  const readRange = (fromEl, toEl) => ({
    fromIso: normalizeDateToISO(fromEl?.value || ""),
    toIso: normalizeDateToISO(toEl?.value || "")
  });

  if (activeTab === "llegadas-aeropuerto") {
    const r = readRange(aeropuertoUploadFrom, aeropuertoUploadTo);
    if (r.fromIso || r.toIso) return { ...r, source: "filtro_aeropuerto", explicit: true };
  }
  if (activeTab === "llegadas-san-diego") {
    const r = readRange(sanDiegoUploadFrom, sanDiegoUploadTo);
    if (r.fromIso || r.toIso) return { ...r, source: "filtro_san_diego", explicit: true };
  }
  if (activeTab === "llegadas-nutibara") {
    const r = readRange(nutibaraUploadFrom, nutibaraUploadTo);
    if (r.fromIso || r.toIso) return { ...r, source: "filtro_nutibara", explicit: true };
  }

  const now = new Date();
  return {
    fromIso: getLocalIsoDate(now),
    toIso: getLocalIsoDate(now),
    source: "dia_actual",
    explicit: false
  };
}

function getPlanillaFetchMode(){
  const activeTab = getActiveTabId();
  if (ARRIVALS_PANEL_TAB_IDS.includes(activeTab)) return "waiting_only";
  return "default";
}

function isPlanillaRelatedTab(tabId){
  const id = String(tabId || "");
  return id === "planilla-afiliados"
    || id === "llegadas-aeropuerto"
    || id === "llegadas-san-diego"
    || id === "llegadas-nutibara"
    || id === "llegadas-novedades";
}

async function ensureFreshPlanillaData(options = {}){
  if (LLEGADAS_PAUSED) return; // Llegadas en pausa: no consultar.
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
  renderLlegadasNovedades();
}

async function loadPlanillaAfiliadosFromSupabase(){
  if (LLEGADAS_PAUSED) return; // Llegadas en pausa: no consultar Supabase.
  if (planillaAfiliadosLoading) return;
  if (!currentUserId) return;
  planillaAfiliadosLoading = true;
  if (planillaStatus) planillaStatus.textContent = "Consultando Supabase...";
  try {
    const range = getPlanillaVisibleDateRange();
    const fetchMode = getPlanillaFetchMode();
    const hasRange = !!(range?.fromIso || range?.toIso);
    const fromStamp = range?.fromIso ? `${range.fromIso} 00:00:00` : "";
    const toStamp = range?.toIso ? `${range.toIso} 23:59:59` : "";

    const buildQuery = (withRange) => {
      const limitValue = fetchMode === "waiting_only"
        ? PLANILLA_FETCH_LIMIT_WAITING
        : (withRange ? PLANILLA_FETCH_LIMIT_RANGED : PLANILLA_FETCH_LIMIT);
      let q = planillaSupabaseClient
        .from(PLANILLA_TABLE_NAME)
        .select(PLANILLA_SELECT_COLUMNS)
        .order("hora_llegada", { ascending: false, nullsFirst: false })
        .limit(limitValue);
      if (withRange && fromStamp) q = q.gte("generado_en", fromStamp);
      if (withRange && toStamp) q = q.lte("generado_en", toStamp);
      if (fetchMode === "waiting_only") {
        q = q.or("hora_despacho.is.null,hora_despacho.eq.-,hora_despacho.eq.");
      }
      return q;
    };

    let { data, error } = await buildQuery(hasRange);
    if (error && hasRange) {
      console.warn("Filtro por rango fallo, reintentando sin rango:", error);
      const retry = await buildQuery(false);
      data = retry.data;
      error = retry.error;
    }
    if (error) throw error;
    planillaAfiliadosRows = Array.isArray(data) ? data : [];
    planillaAfiliadosLoadedOnce = true;
    planillaLastLoadedAt = Date.now();
    renderPlanillaAfiliados();
    renderLlegadasAeropuerto();
    renderLlegadasSanDiego();
    renderLlegadasNutibara();
    renderLlegadasNovedades();
    if (planillaStatus) {
      const stamp = new Date().toLocaleString("es-CO");
      if (hasRange) {
        const fromText = range?.fromIso ? excelDateToReadable(range.fromIso) : "-";
        const toText = range?.toIso ? excelDateToReadable(range.toIso) : "-";
        const modeText = fetchMode === "waiting_only" ? " | Modo: solo en espera" : "";
        planillaStatus.textContent = `Actualizado: ${stamp} | Rango: ${fromText} - ${toText}${modeText}`;
      } else {
        planillaStatus.textContent = `Actualizado: ${stamp}`;
      }
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
    if (llegadasNovedadesStatus) {
      const stamp4 = new Date().toLocaleString("es-CO");
      llegadasNovedadesStatus.textContent = `Actualizado: ${stamp4}`;
    }
  } catch (error) {
    console.error(`Error cargando ${PLANILLA_TABLE_NAME}:`, error);
    if (planillaStatus) planillaStatus.textContent = `Error: ${error?.message || "consulta fallida"}`;
    if (llegadasAeropuertoStatus) llegadasAeropuertoStatus.textContent = `Error: ${error?.message || "consulta fallida"}`;
    if (llegadasSanDiegoStatus) llegadasSanDiegoStatus.textContent = `Error: ${error?.message || "consulta fallida"}`;
    if (llegadasNutibaraStatus) llegadasNutibaraStatus.textContent = `Error: ${error?.message || "consulta fallida"}`;
    if (llegadasNovedadesStatus) llegadasNovedadesStatus.textContent = `Error: ${error?.message || "consulta fallida"}`;
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
"759":"BASE 3","15":"BASE 5","17":"BASE 3","59":"BASE 5","64":"BASE 5",
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

function getActiveProgramacionMode(){
  const tabId = getActiveTabId();
  if (tabId === "programacion2" || tabId === "novedades2") return "target";
  return "source";
}

function getActiveRowsForDrivers(){
  return getActiveProgramacionMode() === "target" ? rowsTarget : rows;
}

function getActiveSelectedDateISO(){
  if (getActiveProgramacionMode() === "target") {
    return normalizeDateToISO(filterDate2?.value || "");
  }
  return getSelectedOperativeDateISO();
}

function resolveDriverNameForCurrentBase(rawName){
  const base = getBaseCanonical(currentBase);
  const typed = String(rawName || "").trim();
  if (!base || !typed) return "";
  const pool = driversByBase[base] || driversByBase[formatBaseLabel(base)] || [];
  const found = pool.find(n => norm(n) === norm(typed));
  return found || typed;
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

function getDateAssignmentStatsForBase(dateIso, baseValue = currentBase, sourceRows = rows){
  const rowsList = Array.isArray(sourceRows) ? sourceRows : [];
  const fechaKey = sourceRows === rows ? getFechaKey() : getFechaKeyFromArray(rowsList);
  const baseKey = sourceRows === rows ? getBaseKey() : getBaseKeyFromRows(rowsList);
  const { key1, key2 } = sourceRows === rows ? getConductorKeysFromRows() : getConductorKeysFromArray(rowsList);
  const canonicalBase = getBaseCanonical(baseValue);
  let requiredSlots = 0;
  let filledSlots = 0;

  if (!fechaKey || (!key1 && !key2) || !canonicalBase) {
    return { requiredSlots, filledSlots, pendingSlots: 0 };
  }

  rowsList.forEach(r => {
    const rowBase = getRowCanonicalBase(r, baseKey);
    if (canonicalBase && rowBase !== canonicalBase) return;
    const rowDate = getRowDateISO(r, fechaKey);
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

function getRemainingDriversCountForDate(dateIso, baseValue = currentBase, sourceRows = rows){
  const rowsList = Array.isArray(sourceRows) ? sourceRows : [];
  const canonicalBase = getBaseCanonical(baseValue);
  if (!canonicalBase) return 0;

  const pool = driversByBase[canonicalBase] || driversByBase[formatBaseLabel(canonicalBase)] || [];
  if (!pool.length) return 0;

  const fechaKey = sourceRows === rows ? getFechaKey() : getFechaKeyFromArray(rowsList);
  const baseKey = sourceRows === rows ? getBaseKey() : getBaseKeyFromRows(rowsList);
  const { key1, key2 } = sourceRows === rows ? getConductorKeysFromRows() : getConductorKeysFromArray(rowsList);
  const assigned = new Set();

  if (fechaKey && (key1 || key2)) {
    rowsList.forEach(r => {
      const rowBase = getRowCanonicalBase(r, baseKey);
      if (canonicalBase && rowBase !== canonicalBase) return;
      const rowDate = getRowDateISO(r, fechaKey);
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

function getDateStatusForBase(dateIso, baseValue = currentBase, sourceRows = rows){
  const stats = getDateAssignmentStatsForBase(dateIso, baseValue, sourceRows);
  const remaining = getRemainingDriversCountForDate(dateIso, baseValue, sourceRows);

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

function getAllBasesInProgramacion(sourceRows = rows){
  const rowsList = Array.isArray(sourceRows) ? sourceRows : [];
  const baseKey = sourceRows === rows ? getBaseKey() : getBaseKeyFromRows(rowsList);
  const bases = new Set();
  rowsList.forEach(r => {
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

async function renderAdminComplianceDashboard(){
  if (!adminComplianceCard || !adminComplianceBody || !adminComplianceDate || !adminComplianceSummary) return;
  adminComplianceCard.classList.toggle("hidden", !isSuperAdmin());
  if (!isSuperAdmin()) return;

  try {
    await loadTargetDateCatalogFromSupabase(true);
  } catch (error) {
    console.error("No se pudo cargar catalogo de fechas desde programacion_filas:", error);
    adminComplianceBody.innerHTML = `<tr><td colspan="5" class="muted" style="text-align:center;padding:12px">No se pudieron cargar fechas desde programacion_filas.</td></tr>`;
    adminComplianceSummary.textContent = "Error fechas";
    return;
  }

  const availableDates = (Array.isArray(targetDbDateCatalog) ? targetDbDateCatalog : [])
    .map(d => normalizeDateToISO(d))
    .filter(iso => /^\d{4}-\d{2}-\d{2}$/.test(String(iso || "")))
    .filter((iso, idx, list) => list.indexOf(iso) === idx)
    .sort((a, b) => b.localeCompare(a));
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

  const targetFechaKey = getFechaKeyFromArray(rowsTarget);
  const targetHasSelectedDate = Array.isArray(rowsTarget)
    && rowsTarget.some(r => getRowDateISO(r, targetFechaKey) === dateIso);
  if (!targetHasSelectedDate) {
    adminComplianceSummary.textContent = `Cargando ${excelDateToReadable(dateIso)}...`;
    adminComplianceBody.innerHTML = `<tr><td colspan="5" class="muted" style="text-align:center;padding:12px">Cargando filas de programacion...</td></tr>`;
    try {
      await loadTargetProgramacionByDate(dateIso);
      if (getActiveTabId() === "programacion2") renderTable2();
    } catch (error) {
      console.error("No se pudo cargar programacion_filas para cumplimiento:", error);
      adminComplianceBody.innerHTML = `<tr><td colspan="5" class="muted" style="text-align:center;padding:12px">No se pudieron cargar las filas de la fecha seleccionada.</td></tr>`;
      adminComplianceSummary.textContent = "Error filas";
      return;
    }
  }

  const complianceRows = Array.isArray(rowsTarget) ? rowsTarget : [];
  const bases = getAllBasesInProgramacion(complianceRows);
  if (bases.length === 0) {
    adminComplianceBody.innerHTML = `<tr><td colspan="5" class="muted" style="text-align:center;padding:12px">No hay bases en la programacion.</td></tr>`;
    adminComplianceSummary.textContent = `${excelDateToReadable(dateIso)} | 0 bases`;
    return;
  }

  let completeCount = 0;
  adminComplianceBody.innerHTML = "";
  bases.forEach(base => {
    const status = getDateStatusForBase(dateIso, base, complianceRows);
    if (status.state === "complete") completeCount++;
    const stats = getDateAssignmentStatsForBase(dateIso, base, complianceRows);
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

  const baseSheetUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vThNrFZLbNklMFtPeg0wF4TA1vZHnZ4YNMmGcnHfty_RoNuAQw__iV2GMXqTsv36MPiks1ARpYui1JK";
  const csvUrls = [
    `${baseSheetUrl}/pub?gid=0&single=true&output=csv`,
    `${baseSheetUrl}/pub?output=csv&gid=0`,
    `${baseSheetUrl}/gviz/tq?tqx=out:csv&gid=0`
  ];

  const parseCsvRow = (line) => {
    const out = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        const next = line[i + 1];
        if (inQuotes && next === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === "," && !inQuotes) {
        out.push(cur.trim());
        cur = "";
      } else {
        cur += ch;
      }
    }
    out.push(cur.trim());
    return out.map(v => String(v || "").replace(/^"(.*)"$/, "$1").trim());
  };
  
  csvStatus.innerHTML = 'Cargando conductores...';
  
  try {
    let csvText = "";
    let lastError = null;
    for (const csvUrl of csvUrls) {
      try {
        const response = await fetch(csvUrl, { cache: "no-cache" });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const txt = await response.text();
        const normalized = String(txt || "").replace(/^\uFEFF/, "").trim();
        if (!normalized || normalized.startsWith("<!DOCTYPE html") || normalized.startsWith("<html")) {
          throw new Error("Respuesta no CSV");
        }
        csvText = normalized;
        break;
      } catch (e) {
        lastError = e;
      }
    }
    if (!csvText) {
      throw (lastError || new Error("No se pudo leer CSV de Google Sheets"));
    }

    const lines = csvText.split(/\r?\n/).filter(line => line.trim() !== "");
    if (lines.length === 0) throw new Error("CSV vacio");

    const headers = parseCsvRow(lines[0]);
    
    const nombreIdx = headers.findIndex(h => norm(h) === 'NOMBRE');
    const emailIdx = headers.findIndex(h => norm(h) === 'EMAIL');
    const statusIdx = headers.findIndex(h => norm(h) === 'STATUS');
    const cedulaIdx = headers.findIndex(h => ['CEDULA', 'RUT', 'DOCUMENTO', 'IDENTIFICACION', 'NUMERO DOCUMENTO', 'NRO DOCUMENTO', 'DOC'].includes(norm(h)));
    if (nombreIdx < 0 || emailIdx < 0) {
      throw new Error("Columnas NOMBRE/EMAIL no encontradas en CSV");
    }

    const newDriversByBase = {};
    const newCedulaByName = new Map();
    let totalEnabled = 0;

    for (let i = 1; i < lines.length; i++) {
      const values = parseCsvRow(lines[i]);
      const nombre = values[nombreIdx]?.trim() || '';
      const email = values[emailIdx]?.trim() || '';
      const status = statusIdx !== -1 ? values[statusIdx]?.trim().toUpperCase() : 'ENABLED';
      const cedula = cedulaIdx !== -1 ? (values[cedulaIdx]?.trim() || '') : '';

      // Cedula por nombre: para TODOS (habilitados o no), para tener el RUT de cualquiera.
      if (nombre && cedula) {
        const k = nameKeyForMatch(nombre);
        if (!newCedulaByName.has(k)) newCedulaByName.set(k, cedula);
      }

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
    if (newCedulaByName.size) driverCedulaByName = newCedulaByName;
    saveDriversCache();
    
    const totalBases = Object.keys(driversByBase).length;
    lblDriversCount.textContent = `Conductores: ${totalEnabled} en ${totalBases} bases`;
    csvStatus.innerHTML = `Cargados ${totalEnabled} conductores`;
    
    fillStartBases();
    if (currentBase) {
      rebuildAssigned();
      renderDrivers();
      if (getActiveTabId() === "programacion2" || getActiveTabId() === "novedades2") {
        renderTable2();
        renderNovedades2();
      } else {
        renderTable();
        renderNovedades();
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
    const loadedFromCache = loadDriversCache();
    if (loadedFromCache) {
      const totalBases = Object.keys(driversByBase || {}).length;
      const totalEnabled = Object.values(driversByBase || {}).reduce((acc, list) => acc + (Array.isArray(list) ? list.length : 0), 0);
      lblDriversCount.textContent = `Conductores: ${totalEnabled} en ${totalBases} bases (cache)`;
      csvStatus.innerHTML = 'Sin internet para Google Sheet; usando cache local de conductores';
      fillStartBases();
      rebuildAssigned();
      renderDrivers();
    } else {
      lblDriversCount.textContent = "Conductores: 0 en 0 bases";
      csvStatus.innerHTML = 'Error al cargar conductores';
      showToast(`No se pudo leer conductores desde Google Sheets (${String(error?.message || "sin detalle")}).`, "err");
    }
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
  const activeRows = getActiveRowsForDrivers();
  const baseKey = getBaseKeyFromRows(activeRows);
  const fechaKey = getFechaKeyFromArray(activeRows);
  const { key1: conductor1Key, key2: conductor2Key } = getConductorKeysFromArray(activeRows);
  const selectedDate = getActiveSelectedDateISO();

  activeRows.forEach(r => {
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
  const selectedDate = getActiveSelectedDateISO();
  
  // Excluir conductores en novedades de la misma base y misma fecha operativa.
  const enNovedades = new Set(
    novedades
      .filter(n => sameBase(n.base, base) && (!selectedDate || normalizeDateToISO(n.fecha) === selectedDate))
      .map(n => norm(n.nombre))
  );
  
  return pool.filter(d => !used.has(norm(d)) && !enNovedades.has(norm(d)));
}

function refreshNovedadesManualAutocomplete2(){
  if (!novedadManualList2) return;
  const base = getBaseCanonical(currentBase);
  const selectedDate = getActiveSelectedDateISO();
  novedadManualList2.innerHTML = "";
  if (!base || !selectedDate) return;
  const available = getAvailableDriversForBase(base).slice().sort((a, b) => String(a).localeCompare(String(b), "es"));
  available.forEach(name => {
    const op = document.createElement("option");
    op.value = name;
    novedadManualList2.appendChild(op);
  });
}

async function addNovedadByName(rawName){
  const selectedDate = getActiveSelectedDateISO();
  if (!selectedDate) {
    showToast("Selecciona una fecha antes de registrar novedades.", "warn");
    return false;
  }
  const base = getBaseCanonical(currentBase);
  if (!base) {
    showToast("Selecciona una base operativa antes de registrar novedades.", "warn");
    return false;
  }
  const typed = String(rawName || "").trim();
  if (!typed) {
    showToast("Escribe un nombre de conductor para asignar.", "warn");
    return false;
  }

  const pool = driversByBase[base] || driversByBase[formatBaseLabel(base)] || [];
  const matched = pool.find(name => norm(name) === norm(typed));
  if (!matched) {
    showToast(`El conductor "${typed}" no existe en ${formatBaseLabel(base)}.`, "warn");
    return false;
  }

  const exists = novedades.some(n =>
    norm(n.nombre) === norm(matched) &&
    sameBase(n.base, base) &&
    normalizeDateToISO(n.fecha) === selectedDate
  );
  if (exists) {
    showToast("Ese conductor ya tiene novedad en esta base y fecha.", "warn");
    return false;
  }

  const nueva = await createNovedadInSupabase({
    nombre: matched,
    base: formatBaseLabel(base),
    estado: "PENDIENTE",
    fecha: selectedDate
  });
  await loadNovedadesFromSupabase({ silent: true });
  if (!novedades.some(n => String(n.id) === String(nueva?.id))) {
    novedades.unshift(nueva);
  }
  renderNovedades();
  renderNovedades2();
  renderDrivers();
  if (novedadManualInput2) novedadManualInput2.value = "";
  return true;
}

async function refreshNovedadesFromDbAndRender(){
  await loadNovedadesFromSupabase({ silent: true });
  renderNovedades();
  renderNovedades2();
  renderDrivers();
}

function renderDrivers(){
  rebuildAssigned();
  const base = getBaseCanonical(currentBase);
  const selectedDate = getActiveSelectedDateISO();
  const filterInput = document.getElementById('filterDrivers');
  const filterText = String(filterInput?.value || "").toLowerCase();
  const list = document.getElementById('driversList');
  if (!list || !currentBaseDisplay) return;
  list.innerHTML = '';
  refreshNovedadesManualAutocomplete2();

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

  const visible = available.filter(d => d.toLowerCase().includes(filterText));
  if (visible.length === 0) {
    list.innerHTML = `<div class="muted" style="padding:12px;text-align:center">${
      available.length === 0
        ? "Todos los conductores asignados"
        : "No hay coincidencias con ese filtro"
    }</div>`;
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

  visible.forEach(name => {
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
  refreshNovedadesManualAutocomplete2();
}

/* ===================== NOVEDADES ===================== */
function renderNovedades(){
  renderNovedadesInto({
    bodyEl: novedadesBody,
    countEl: novedadesCount,
    baseEl: novedadesBaseDisplay
  });
  renderNovedades2();
  renderLiveExcelPreview();
}

function renderNovedadesInto(opts = {}){
  const bodyEl = opts.bodyEl;
  const countEl = opts.countEl;
  const baseEl = opts.baseEl;
  const mode = String(opts.mode || "source");
  if (!bodyEl) return;
  adjustDynamicTableViewport();
  const selectedDate = mode === "target"
    ? normalizeDateToISO(filterDate2?.value || "")
    : getSelectedOperativeDateISO();
  const novedadesBase = novedades.filter(n =>
    sameBase(n.base, currentBase) &&
    (!!selectedDate && normalizeDateToISO(n.fecha) === selectedDate)
  );
  if (countEl) countEl.textContent = novedadesBase.length;
  if (baseEl) baseEl.textContent = currentBase ? formatBaseLabel(currentBase) : '-';
  bodyEl.innerHTML = '';

  if (!selectedDate) {
    bodyEl.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:20px" class="muted">
      Selecciona una fecha para ver y registrar novedades
    </td></tr>`;
    return;
  }
  if (novedadesBase.length === 0) {
    bodyEl.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:20px" class="muted">
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
          <option value="PENDIENTE" ${n.estado === 'PENDIENTE' ? 'selected' : ''}>Pendiente</option>
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
    bodyEl.appendChild(tr);
  });

  bodyEl.querySelectorAll('.estado-select').forEach(select => {
    select.addEventListener('change', async (e) => {
      const id = e.target.getAttribute('data-id');
      const nuevoEstado = e.target.value;
      const globalIndex = novedades.findIndex(n => String(n.id) === String(id));
      if (globalIndex === -1) return;
      try {
        await updateNovedadEstadoInSupabase(id, nuevoEstado);
        await refreshNovedadesFromDbAndRender();
      } catch (error) {
        console.error("Error actualizando novedad:", error);
        alert(`No se pudo actualizar la novedad en Supabase.\n${error?.message || ""}`);
        renderNovedades();
      }
    });
  });

  bodyEl.querySelectorAll('.btn-small').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = e.target.getAttribute('data-id');
      const globalIndex = novedades.findIndex(n => String(n.id) === String(id));
      if (globalIndex === -1) return;
      try {
        await deleteNovedadInSupabase(id);
        await refreshNovedadesFromDbAndRender();
      } catch (error) {
        console.error("Error eliminando novedad:", error);
        alert("No se pudo eliminar la novedad en Supabase.");
      }
    });
  });
}

function renderNovedades2(){
  renderNovedadesInto({
    bodyEl: novedadesBody2,
    countEl: novedadesCount2,
    baseEl: novedadesBaseDisplay2,
    mode: "target"
  });
  refreshNovedadesManualAutocomplete2();
}

async function refreshVisorDateOptions(){
  if (!visorDateSelect) return;
  try {
    await loadTargetDateCatalogFromSupabase(true);
  } catch (error) {
    console.error("No se pudo cargar catalogo de fechas para el visor:", error);
  }
  const prev = visorDateSelect.value || "";
  const dateSource = (Array.isArray(targetDbDateCatalog) && targetDbDateCatalog.length)
    ? targetDbDateCatalog
    : getAllAvailableDatesFromRows();
  const dates = Array.from(new Set(
    dateSource
      .map(d => normalizeDateToISO(d))
      .filter(iso => /^\d{4}-\d{2}-\d{2}$/.test(String(iso || "")))
  )).sort((a, b) => b.localeCompare(a));
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
    visorDateSelect.value = dates[0];
  } else {
    visorDateSelect.value = "";
  }
}

async function renderLiveExcelPreview(){
  if (!liveExcelPreview) return;
  const visorDate = normalizeDateToISO(visorDateSelect?.value || "");
  if (!visorDate) {
    liveExcelPreview.innerHTML = `<div class="muted" style="padding:12px;text-align:center">Selecciona una fecha en el visor para ver toda la programacion de todas las bases.</div>`;
    return;
  }

  const targetFechaKey = getFechaKeyFromArray(rowsTarget);
  const targetHasSelectedDate = Array.isArray(rowsTarget)
    && rowsTarget.some(r => getRowDateISO(r, targetFechaKey) === visorDate);
  if (!targetHasSelectedDate) {
    liveExcelPreview.innerHTML = `<div class="muted" style="padding:12px;text-align:center">Cargando programacion de ${excelDateToReadable(visorDate)}...</div>`;
    try {
      await loadTargetProgramacionByDate(visorDate);
    } catch (error) {
      console.error("No se pudo cargar programacion_filas para el visor:", error);
      liveExcelPreview.innerHTML = `<div class="muted" style="padding:12px;text-align:center">No se pudieron cargar las filas de ${excelDateToReadable(visorDate)} desde programacion_filas.</div>`;
      return;
    }
  }

  const sourceRows = Array.isArray(rowsTarget) && rowsTarget.length ? rowsTarget : rows;
  if (!sourceRows.length) {
    liveExcelPreview.innerHTML = `<div class="muted" style="padding:12px;text-align:center">No hay datos para visualizar.</div>`;
    return;
  }

  const headerSet = new Set();
  sourceRows.slice(0, 200).forEach(r => Object.keys(r || {}).forEach(k => headerSet.add(k)));
  const headerKeys = Array.from(headerSet);
  const getHeaderKeyByNormFromSource = (aliases) => headerKeys.find(k => aliases.includes(norm(k))) || null;
  const fechaKey = getFechaKeyFromArray(sourceRows);
  const puestoKey = getHeaderKeyByNormFromSource(["PUESTO"]);
  const numeroKey = getHeaderKeyByNormFromSource(["#"]);
  const vehiculoKey = getHeaderKeyByNormFromSource(["VEH", "VEHICULO", "VEHÍCULO", "MOVIL", "MÓVIL"]);
  const horaFinKey = getHeaderKeyByNormFromSource(["HORA FIN", "HORA FINAL"]);
  const { key1: horaInicio1Key, key2: horaInicio2Key } = inferInicioKeysFromList(headerKeys);
  const { key1: conductor1Key, key2: conductor2Key } = getConductorKeysFromArray(sourceRows);

  let ordered = sourceRows.slice();
  if (fechaKey) ordered = ordered.filter(r => getRowDateISO(r, fechaKey) === visorDate);
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
  const baseKey = getBaseKeyFromRows(ordered);
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
  renderTable2();
}

/* ===================== DESPACHOS REALIZADOS ===================== */
// Vista de solo consulta sobre la tabla `despachos_realizados`.
// Paginacion server-side (mas reciente primero) + cruce de cedula->nombre con colaboradores.

function despachoPickKey(sampleObj, candidates){
  const keys = Object.keys(sampleObj || {});
  const lower = keys.map(k => ({ k, l: String(k).toLowerCase() }));
  for (const c of candidates) {
    const hit = lower.find(x => x.l === c);
    if (hit) return hit.k;
  }
  for (const c of candidates) {
    const hit = lower.find(x => x.l.includes(c));
    if (hit) return hit.k;
  }
  return "";
}

// Carga (una sola vez) la tabla colaboradores y construye un mapa cedula -> nombre.
// Autodetecta las columnas para no depender de un esquema fijo. Si RLS lo bloquea
// o falla, deja el mapa vacio y la vista cae a mostrar la cedula.
async function ensureDespachosColaboradores(){
  if (despachosColabMap) return despachosColabMap;
  if (despachosColabLoading) return despachosColabLoading;
  despachosColabLoading = (async () => {
    const map = new Map();
    try {
      const { data, error } = await planillaSupabaseClient
        .from(DESPACHOS_COLABORADORES_TABLE)
        .select("*")
        .limit(5000);
      if (error) throw error;
      const rows = Array.isArray(data) ? data : [];
      if (rows.length) {
        const sample = rows[0];
        const cedKey = despachoPickKey(sample, ["cedula", "documento", "identificacion", "numero_documento", "num_documento", "nro_documento", "doc", "driver_id", "id_conductor"]);
        const nameKey = despachoPickKey(sample, ["nombre_completo", "nombrecompleto", "nombre", "nombres", "full_name", "razon_social"]);
        const apeKey = despachoPickKey(sample, ["apellidos", "apellido"]);
        const combineApellido = nameKey && /^nombres?$/i.test(nameKey) && apeKey;
        rows.forEach(r => {
          const ced = cedKey ? String(r[cedKey] ?? "").trim() : "";
          if (!ced) return;
          let nom = nameKey ? String(r[nameKey] ?? "").trim() : "";
          if (combineApellido) {
            const ape = String(r[apeKey] ?? "").trim();
            if (ape) nom = `${nom} ${ape}`.trim();
          }
          if (nom) map.set(ced, nom);
        });
      }
    } catch (e) {
      console.warn("No se pudo cargar colaboradores para nombres de conductor:", e?.message || e);
    }
    despachosColabMap = map;
    return map;
  })();
  return despachosColabLoading;
}

function resolveConductorNombre(cedula){
  const ced = String(cedula ?? "").trim();
  if (!ced) return "-";
  const nom = despachosColabMap ? despachosColabMap.get(ced) : "";
  return nom || ced;
}

// Clave de comparacion de nombres tolerante a orden de palabras y acentos/n~.
// "OCAMPO HERRERA JOHN JAIRO" y "JOHN JAIRO OCAMPO HERRERA" producen la misma clave.
function nameKeyForMatch(s){
  const base = String(s ?? "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "") // quita acentos y la tilde de la n~
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, " ");
  return base.split(/\s+/).filter(Boolean).sort().join(" ");
}

// Mapa nombre(normalizado) -> cedula, a partir de la tabla colaboradores.
let nombreToCedulaMap = null;
let nombreToCedulaLoading = null;
async function ensureNombreToCedula(){
  if (nombreToCedulaMap) return nombreToCedulaMap;
  if (nombreToCedulaLoading) return nombreToCedulaLoading;
  nombreToCedulaLoading = (async () => {
    const map = new Map();
    try {
      const { data, error } = await planillaSupabaseClient
        .from(DESPACHOS_COLABORADORES_TABLE)
        .select("*")
        .limit(10000);
      if (error) throw error;
      const rows = Array.isArray(data) ? data : [];
      if (rows.length) {
        const sample = rows[0];
        const cedKey = despachoPickKey(sample, ["cedula", "documento", "identificacion", "numero_documento", "num_documento", "nro_documento", "doc", "driver_id", "id_conductor"]);
        const nameKey = despachoPickKey(sample, ["nombre_completo", "nombrecompleto", "nombre", "nombres", "full_name", "razon_social"]);
        const apeKey = despachoPickKey(sample, ["apellidos", "apellido"]);
        const combineApellido = nameKey && /^nombres?$/i.test(nameKey) && apeKey;
        rows.forEach(r => {
          const ced = cedKey ? String(r[cedKey] ?? "").trim() : "";
          if (!ced) return;
          let nom = nameKey ? String(r[nameKey] ?? "").trim() : "";
          if (combineApellido) {
            const ape = String(r[apeKey] ?? "").trim();
            if (ape) nom = `${nom} ${ape}`.trim();
          }
          const key = nameKeyForMatch(nom);
          if (key && !map.has(key)) map.set(key, ced);
        });
      }
    } catch (e) {
      console.warn("No se pudo cargar colaboradores (nombre->cedula):", e?.message || e);
    }
    nombreToCedulaMap = map;
    return map;
  })();
  return nombreToCedulaLoading;
}

// Descarga la "Planilla de turnos": lista plana de los turnos del operativo.
// Bloque 1 = CONDUCTOR 1 de cada turno (hora = relevo / INICIA 2).
// Bloque 2 = CONDUCTOR 2 de cada turno (hora = HORA FIN).
// Columnas: #, TURNO, CEDULA, CONDUCTOR, HORA.
async function handleExportPlanillaTurnos(){
  if (!canExportXlsx()) { showToast("Solo el super administrador puede descargar el Excel.", "warn"); return; }
  const usingTargetFormato = USE_ONLY_NEW_DB || getActiveProgramacionMode() === "target" || (Array.isArray(rowsTarget) && rowsTarget.length > 0);
  let sourceRows = usingTargetFormato ? rowsTarget : rows;
  if (!sourceRows.length) { showToast("No hay datos para exportar.", "warn"); return; }

  const selectedDate = normalizeDateToISO((usingTargetFormato ? filterDate2?.value : document.getElementById("filterDate")?.value) || "");
  if (!selectedDate) { showToast("Selecciona una fecha para descargar la planilla de turnos.", "warn"); return; }

  if (usingTargetFormato) {
    const currentFechaKey = getFechaKeyFromArray(sourceRows);
    const hasSelectedDate = sourceRows.some(r => getRowDateISO(r, currentFechaKey) === selectedDate);
    if (!hasSelectedDate) {
      try { await loadTargetProgramacionByDate(selectedDate); }
      catch (error) { console.error("No se pudo cargar fecha para planilla de turnos:", error); }
    }
  }

  sourceRows = usingTargetFormato ? rowsTarget : sourceRows;
  const headerSet = new Set();
  sourceRows.slice(0, 200).forEach(r => Object.keys(r || {}).forEach(k => headerSet.add(k)));
  const headerKeys = Array.from(headerSet);
  const findHeaderByNorm = (aliases) => headerKeys.find(k => aliases.includes(norm(k))) || null;
  const fechaKey = usingTargetFormato ? getFechaKeyFromArray(sourceRows) : getFechaKey();
  const numeroKey = findHeaderByNorm(["#"]);
  const horaFinKey = findHeaderByNorm(["HORA FIN", "HORA FINAL"]);
  const { key2: horaInicio2Key } = inferInicioKeysFromList(headerKeys);
  const { key1: conductor1Key, key2: conductor2Key } = getConductorKeysFromArray(sourceRows);

  let exportData = sourceRows.slice();
  if (fechaKey) exportData = exportData.filter(r => getRowDateISO(r, fechaKey) === selectedDate);
  if (!exportData.length) { showToast("No hay filas para la fecha seleccionada.", "warn"); return; }
  if (!window.ExcelJS) { showToast("No se pudo cargar ExcelJS para exportar con estilos.", "err"); return; }

  const ordered = dedupeProgramacionRows(exportData).rows;
  // Solo turnos reales (sin filas FICHO), ordenados por numero de turno.
  const dataRows = ordered
    .filter(r => !isFichoRowByContent(r))
    .sort((a, b) => (getNumericTurnNumber(numeroKey ? a[numeroKey] : null) ?? 9999) - (getNumericTurnNumber(numeroKey ? b[numeroKey] : null) ?? 9999));

  const cedulaCsv = await ensureDriverCedulaMap();
  const nombreCedula = await ensureNombreToCedula();
  const cedulaDe = (rawConductor) => {
    const nom = extractConductorName(rawConductor || "");
    if (!nom) return "";
    const k = nameKeyForMatch(nom);
    return cedulaCsv.get(k) || nombreCedula.get(k) || "";
  };
  const nombreDe = (rawConductor) => extractConductorName(rawConductor || "") || UNASSIGNED_LABEL;

  const N = dataRows.length;
  const filas = [];
  dataRows.forEach((r, i) => {
    const raw = conductor1Key ? r[conductor1Key] : "";
    filas.push({ turno: i + 1, cedula: cedulaDe(raw), conductor: nombreDe(raw), hora: horaInicio2Key ? excelTimeToHHMM(r[horaInicio2Key]) : "" });
  });
  dataRows.forEach((r, i) => {
    const raw = conductor2Key ? r[conductor2Key] : "";
    filas.push({ turno: N + i + 1, cedula: cedulaDe(raw), conductor: nombreDe(raw), hora: horaFinKey ? excelTimeToHHMM(r[horaFinKey]) : "" });
  });

  const border = {
    top: { style: "thin", color: { argb: "FF000000" } },
    left: { style: "thin", color: { argb: "FF000000" } },
    bottom: { style: "thin", color: { argb: "FF000000" } },
    right: { style: "thin", color: { argb: "FF000000" } }
  };

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(`TURNOS_${selectedDate}`);
  ws.columns = [{ width: 8 }, { width: 12 }, { width: 16 }, { width: 42 }, { width: 10 }];

  ws.mergeCells(1, 1, 1, 5);
  ws.getRow(1).getCell(1).value = `PLANILLA DE TURNOS ${formatDateLongEs(selectedDate || "")}`.toUpperCase();
  ws.getRow(1).getCell(1).style = {
    fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } },
    font: { bold: true, size: 18, color: { argb: "FF0F172A" } },
    alignment: { horizontal: "center", vertical: "middle" }
  };

  ws.getRow(2).values = ["#", "TURNO", "CEDULA", "CONDUCTOR", "HORA"];
  for (let c = 1; c <= 5; c++) {
    const cell = ws.getRow(2).getCell(c);
    cell.style = {
      fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFF00" } },
      font: { bold: true, color: { argb: "FF000000" } },
      alignment: { horizontal: "center", vertical: "middle" }
    };
    cell.border = border;
  }

  let rn = 3;
  filas.forEach(f => {
    const row = ws.getRow(rn);
    row.values = [f.turno, `TURNO ${f.turno}`, f.cedula || "", f.conductor, f.hora || ""];
    row.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
    row.getCell(2).alignment = { horizontal: "center", vertical: "middle" };
    row.getCell(3).alignment = { horizontal: "center", vertical: "middle" };
    row.getCell(4).alignment = { horizontal: "left", vertical: "middle", wrapText: true };
    row.getCell(5).alignment = { horizontal: "center", vertical: "middle" };
    for (let c = 1; c <= 5; c++) row.getCell(c).border = border;
    rn++;
  });

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `planilla_turnos_${selectedDate}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);

  const sinCedula = filas.filter(f => f.conductor !== UNASSIGNED_LABEL && !f.cedula).length;
  showToast(`Planilla de turnos generada (${filas.length} turnos)${sinCedula ? ` | ${sinCedula} sin cedula encontrada` : ""}.`, sinCedula ? "warn" : "ok");
}

// ================= REPORTE DE TURNOS (matriz persona x dias) =================
// Recrea la plantilla "ReporteTurnosColaboradores": filas = colaboradores,
// columnas = Nombre, RUT, Area, Supervisor + una por fecha. Cada celda lleva
// el "TURNO N" (1..102) que la persona tuvo ese dia, o vacio si no tuvo.

// Lista completa de colaboradores [{cedula, nombre}] (autodetecta columnas).
async function fetchColaboradoresList(){
  const list = [];
  try {
    const { data, error } = await planillaSupabaseClient.from(DESPACHOS_COLABORADORES_TABLE).select("*").limit(10000);
    if (error) throw error;
    const rows = Array.isArray(data) ? data : [];
    if (rows.length) {
      const sample = rows[0];
      const cedKey = despachoPickKey(sample, ["cedula", "documento", "identificacion", "numero_documento", "num_documento", "nro_documento", "doc", "driver_id", "id_conductor"]);
      const nameKey = despachoPickKey(sample, ["nombre_completo", "nombrecompleto", "nombre", "nombres", "full_name", "razon_social"]);
      const apeKey = despachoPickKey(sample, ["apellidos", "apellido"]);
      const combineApellido = nameKey && /^nombres?$/i.test(nameKey) && apeKey;
      rows.forEach(r => {
        const ced = cedKey ? String(r[cedKey] ?? "").trim() : "";
        let nom = nameKey ? String(r[nameKey] ?? "").trim() : "";
        if (combineApellido) { const ape = String(r[apeKey] ?? "").trim(); if (ape) nom = `${nom} ${ape}`.trim(); }
        if (ced || nom) list.push({ cedula: ced, nombre: nom });
      });
    }
  } catch (e) { console.warn("fetchColaboradoresList:", e?.message || e); }
  list.sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), "es", { sensitivity: "base" }));
  return list;
}

// Trae las filas de programacion de una fecha (sin tocar la pantalla / globales).
async function fetchProgramacionRowsForDate(dateIso){
  const iso = normalizeDateToISO(dateIso || "");
  if (!iso) return [];
  try {
    const probe = await programacionesTargetClient
      .from("programacion_filas").select("programacion_id")
      .eq("fecha", iso).order("programacion_id", { ascending: false }).limit(1).maybeSingle();
    if (probe.error || !probe.data) return [];
    const pid = Number(probe.data.programacion_id || 0);
    if (!pid) return [];
    const pageSize = 1000; const all = []; let offset = 0;
    while (true) {
      const { data, error } = await programacionesTargetClient
        .from("programacion_filas").select("row_data")
        .eq("fecha", iso).eq("programacion_id", pid)
        .order("id", { ascending: true }).range(offset, offset + pageSize - 1);
      if (error) return [];
      const chunk = Array.isArray(data) ? data : [];
      all.push(...chunk);
      if (chunk.length < pageSize) break;
      offset += pageSize;
    }
    const raw = all.map(r => r?.row_data).filter(r => r && typeof r === "object");
    if (!raw.length) return [];
    const prepared = normalizeProgramacionRows(raw);
    const rowsOut = dedupeProgramacionRows(prepared.normalized).rows;
    const { key1, key2 } = getConductorKeysFromArray(rowsOut);
    sanitizeFichoConductorSlots(rowsOut, key1, key2);
    return rowsOut;
  } catch (e) { console.warn("fetchProgramacionRowsForDate", iso, e?.message || e); return []; }
}

// Para un dia: devuelve { turnos: Map(nameKey->turnoN 1..102), nombres: Map(nameKey->nombreVisible) }.
function buildTurnoMapForRows(rowsInput){
  const turnos = new Map();
  const nombres = new Map();
  const rowsArr = Array.isArray(rowsInput) ? rowsInput : [];
  if (!rowsArr.length) return { turnos, nombres };
  const headerKeys = Array.from(new Set(rowsArr.slice(0, 200).flatMap(r => Object.keys(r || {}))));
  const numeroKey = headerKeys.find(k => norm(k) === "#") || null;
  const { key1: c1, key2: c2 } = getConductorKeysFromArray(rowsArr);
  const dataRows = rowsArr
    .filter(r => !isFichoRowByContent(r))
    .sort((a, b) => (getNumericTurnNumber(numeroKey ? a[numeroKey] : null) ?? 9999) - (getNumericTurnNumber(numeroKey ? b[numeroKey] : null) ?? 9999));
  const N = dataRows.length;
  const add = (rawName, turnoN) => {
    const nom = extractConductorName(rawName || "");
    if (!nom) return;
    const k = nameKeyForMatch(nom);
    if (!turnos.has(k)) turnos.set(k, turnoN);
    if (!nombres.has(k)) nombres.set(k, nom);
  };
  dataRows.forEach((r, i) => {
    add(c1 ? r[c1] : "", i + 1);
    add(c2 ? r[c2] : "", N + i + 1);
  });
  return { turnos, nombres };
}

// Novedades de un rango de fechas (consulta directa a la tabla).
async function fetchNovedadesRange(desdeIso, hastaIso){
  try {
    let query = supabaseClient
      .from("novedades")
      .select("nombre, base, estado, fecha")
      .gte("fecha", desdeIso).lte("fecha", hastaIso);
    if (typeof canViewAllRowsByRole === "function" && !canViewAllRowsByRole() && currentUserId) {
      query = query.eq("user_id", currentUserId);
    }
    const { data, error } = await query;
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  } catch (e) { console.warn("fetchNovedadesRange:", e?.message || e); return []; }
}

async function handleExportReporteTurnos(){
  if (!canExportXlsx()) { showToast("Solo el super administrador puede descargar el Excel.", "warn"); return; }
  const desde = normalizeDateToISO(document.getElementById("reporteTurnosDesde")?.value || "");
  const hasta = normalizeDateToISO(document.getElementById("reporteTurnosHasta")?.value || "");
  if (!desde || !hasta) { showToast("Selecciona el rango de fechas (desde y hasta) del reporte.", "warn"); return; }
  if (desde > hasta) { showToast("La fecha 'desde' no puede ser mayor que 'hasta'.", "warn"); return; }
  if (!window.ExcelJS) { showToast("No se pudo cargar ExcelJS para exportar.", "err"); return; }

  // Lista de fechas del rango (inclusive).
  const pad = (n) => String(n).padStart(2, "0");
  const dates = [];
  let cur = new Date(`${desde}T00:00:00`);
  const end = new Date(`${hasta}T00:00:00`);
  while (cur <= end) { dates.push(`${cur.getFullYear()}-${pad(cur.getMonth() + 1)}-${pad(cur.getDate())}`); cur.setDate(cur.getDate() + 1); }
  if (dates.length > 62) { showToast("El rango es muy grande (maximo ~2 meses).", "warn"); return; }

  const btn = document.getElementById("btnExportReporteTurnos");
  if (btn) btn.disabled = true;
  showToast(`Generando reporte de turnos (${dates.length} dias)...`, "ok");
  try {
    // Personas = SOLO las que aparecen en la programacion del rango + las de novedades.
    const personasMap = new Map(); // nameKey -> nombre visible
    const dayMaps = {};            // fecha -> Map(nameKey -> turnoN)
    for (const ds of dates) {
      const { turnos, nombres } = buildTurnoMapForRows(await fetchProgramacionRowsForDate(ds));
      dayMaps[ds] = turnos;
      nombres.forEach((nom, k) => { if (!personasMap.has(k)) personasMap.set(k, nom); });
    }
    // Agregar personas de novedades del rango + indexar novedad por persona+fecha.
    const novs = await fetchNovedadesRange(desde, hasta);
    const novedadByKeyDate = new Map(); // `${nameKey}|${fechaIso}` -> estado
    novs.forEach(n => {
      const nom = String(n?.nombre || "").trim();
      if (!nom) return;
      const k = nameKeyForMatch(nom);
      if (!personasMap.has(k)) personasMap.set(k, nom);
      const f = normalizeDateToISO(n?.fecha || "");
      const est = String(n?.estado || "").trim().toUpperCase();
      if (f && est) novedadByKeyDate.set(`${k}|${f}`, est);
    });

    if (!personasMap.size) { showToast("No se encontraron personas en la programacion ni en novedades para ese rango.", "warn"); return; }

    // Cedula (RUT): primero el CSV de conductores (trae 'cedula'); respaldo: colaboradores.
    const cedulaCsv = await ensureDriverCedulaMap();
    const nombreCedula = await ensureNombreToCedula();
    const cedulaDe = (k) => cedulaCsv.get(k) || nombreCedula.get(k) || "";

    const personas = Array.from(personasMap.entries())
      .map(([k, nombre]) => ({ key: k, nombre, cedula: cedulaDe(k) }))
      .sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), "es", { sensitivity: "base" }));

    const AREA_FIJA = "OPERATIVA";
    const SUPERVISOR_FIJO = "JOHN MILLER CORREA ROMERO";
    const fmtHdr = (iso) => { const [y, m, d] = iso.split("-"); return `${d}-${m}-${y}`; };

    const border = {
      top: { style: "thin", color: { argb: "FFD0D5DD" } },
      left: { style: "thin", color: { argb: "FFD0D5DD" } },
      bottom: { style: "thin", color: { argb: "FFD0D5DD" } },
      right: { style: "thin", color: { argb: "FFD0D5DD" } }
    };

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Reporte Turnos");
    const fixedHeaders = ["Nombre del Colaborador", "RUT", "Área", "Supervisor"];
    const headers = fixedHeaders.concat(dates.map(fmtHdr));
    ws.columns = headers.map((h, i) => ({ width: i === 0 ? 34 : (i < 4 ? 16 : 15) }));
    ws.views = [{ state: "frozen", xSplit: 1, ySplit: 1 }];

    const headRow = ws.getRow(1);
    headRow.values = headers;
    for (let c = 1; c <= headers.length; c++) {
      const cell = headRow.getCell(c);
      cell.style = {
        fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFF00" } },
        font: { bold: true, color: { argb: "FF000000" } },
        alignment: { horizontal: c <= 1 ? "left" : "center", vertical: "middle", wrapText: true }
      };
      cell.border = border;
    }

    let rn = 2;
    let conTurno = 0;
    personas.forEach(p => {
      const values = [p.nombre, p.cedula || "", AREA_FIJA, SUPERVISOR_FIJO];
      let tuvoAlguno = false;
      dates.forEach(ds => {
        const n = dayMaps[ds].get(p.key);
        if (n) {
          values.push(`TURNO ${n}`);
          tuvoAlguno = true;
        } else {
          // Sin turno ese dia: mostrar la novedad si existe; si no, NO PROGRAMADO.
          const est = novedadByKeyDate.get(`${p.key}|${ds}`);
          values.push(est ? est : "NO PROGRAMADO");
        }
      });
      if (tuvoAlguno) conTurno++;
      const row = ws.getRow(rn);
      row.values = values;
      for (let c = 1; c <= headers.length; c++) {
        const cell = row.getCell(c);
        cell.alignment = { horizontal: c === 1 ? "left" : "center", vertical: "middle" };
        cell.border = border;
      }
      rn++;
    });

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reporte_turnos_${desde}_a_${hasta}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    const sinCedula = personas.filter(p => !p.cedula).length;
    showToast(`Reporte generado: ${personas.length} personas, ${dates.length} dias (${conTurno} con turno)${sinCedula ? ` | ${sinCedula} sin cedula` : ""}.`, sinCedula ? "warn" : "ok");
  } catch (err) {
    console.error("Reporte de turnos:", err);
    showToast("Error al generar el reporte: " + (err?.message || "desconocido"), "err");
  } finally {
    if (btn) btn.disabled = false;
  }
}

// Construye UNA hoja del formato operativo (para una fecha) dentro del workbook `wb`.
// rowsForDate = filas (row_data) de esa fecha; novedadesAll = todas las novedades (se filtran por fecha).
// Devuelve el numero de filas de turnos escritas.
function buildOperativoSheet(wb, dateIso, rowsForDate, novedadesAll){
  const rowsArr = Array.isArray(rowsForDate) ? rowsForDate : [];
  const headerSet = new Set();
  rowsArr.slice(0, 200).forEach(r => Object.keys(r || {}).forEach(k => headerSet.add(k)));
  const headerKeys = Array.from(headerSet);
  const findHeaderByNorm = (aliases) => headerKeys.find(k => aliases.includes(norm(k))) || null;
  const baseKey = getBaseKeyFromRows(rowsArr);
  const fechaKey = getFechaKeyFromArray(rowsArr);
  const puestoKey = findHeaderByNorm(["PUESTO"]);
  const numeroKey = findHeaderByNorm(["#"]);
  const vehiculoKey = findHeaderByNorm(["VEH", "VEHICULO", "VEHÍCULO", "MOVIL", "MÓVIL"]);
  const horaFinKey = findHeaderByNorm(["HORA FIN", "HORA FINAL"]);
  const { key1: horaInicio1Key, key2: horaInicio2Key } = inferInicioKeysFromList(headerKeys);
  const { key1: conductor1Key, key2: conductor2Key } = getConductorKeysFromArray(rowsArr);

  const selectedDate = dateIso;
  const ordered = dedupeProgramacionRows(rowsArr).rows;
  const orderedEntries = buildOperationalEntries(ordered, puestoKey, numeroKey);
  const groupedSections = groupOperationalEntriesByPuesto(orderedEntries);
  const titleDate = formatDateLongEs(dateIso || "");
  const fichoAssignments = buildFichoAssignmentsByIndex(groupedSections, vehiculoKey, { baseKey, fechaKey });

  const ws = wb.addWorksheet(`DIA_${dateIso}`);
  ws.columns = [
    { width: 8 }, { width: 10 }, { width: 8 }, { width: 36 }, { width: 10 },
    { width: 36 }, { width: 10 }, { width: 3 }, { width: 18 }, { width: 34 }, { width: 16 }
  ];

  const styleTitle = { fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } }, font: { bold: true, color: { argb: "FF0F172A" }, size: 26 }, alignment: { horizontal: "center", vertical: "middle" } };
  const styleHeader = { fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFF00" } }, font: { bold: true, color: { argb: "FF000000" } }, alignment: { horizontal: "center", vertical: "middle" } };
  const styleFichoGreen = { fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FF16A34A" } }, font: { bold: true, color: { argb: "FFFFFFFF" } } };
  const styleFichoBlue = { fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FF2563EB" } }, font: { bold: true, color: { argb: "FFFFFFFF" } } };
  const styleRedRow = { fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFFF0000" } }, font: { bold: true, color: { argb: "FFFFFFFF" } } };
  const OPERATIVO_RED_TURNS = new Set([24, 26, 28, 30, 32, 34]);
  const styleBorderThin = {
    top: { style: "thin", color: { argb: "FF000000" } }, left: { style: "thin", color: { argb: "FF000000" } },
    bottom: { style: "thin", color: { argb: "FF000000" } }, right: { style: "thin", color: { argb: "FF000000" } }
  };

  const applyRowStyle = (rowNumber, styleObj, fromCol = 1, toCol = 7) => {
    for (let c = fromCol; c <= toCol; c++) { const cell = ws.getRow(rowNumber).getCell(c); cell.style = { ...(cell.style || {}), ...styleObj }; }
  };
  const applyBorderRow = (rowNumber, fromCol = 1, toCol = 7) => {
    for (let c = fromCol; c <= toCol; c++) { ws.getRow(rowNumber).getCell(c).border = styleBorderThin; }
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
  let turnosEscritos = 0;
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
      for (let c = 1; c <= 7; c++){
        const wrap = (c === 3 || c === 4 || c === 6);
        ws.getRow(currentRow).getCell(c).alignment = { horizontal: "center", vertical: "middle", wrapText: wrap };
      }
      applyBorderRow(currentRow, 1, 7);

      if (isFichoMarker) {
        const isFichoExpos = norm(sectionLabel).includes("EXPOSICIONES");
        applyRowStyle(currentRow, isFichoExpos ? styleFichoBlue : styleFichoGreen);
      } else if (Number.isFinite(turnNum) && OPERATIVO_RED_TURNS.has(turnNum)) {
        applyRowStyle(currentRow, styleRedRow, 1, 7);
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
          const vehCell = ws.getRow(currentRow).getCell(3);
          vehCell.style = { ...(vehCell.style || {}), fill: { type: "pattern", pattern: "solid", fgColor: { argb: vehColor === "blue" ? "FF2563EB" : "FF16A34A" } }, font: { ...(vehCell.style?.font || {}), bold: true, color: { argb: "FFFFFFFF" } } };
        }
      }
      if (!isFichoMarker) turnosEscritos++;
      currentRow++;
    });
  });

  const novedadesDelDia = (novedadesAll || []).filter(n => normalizeDateToISO(n.fecha) === dateIso);
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
  return turnosEscritos;
}

// Resuelve la base del vehiculo del despacho a partir del interno.
// Fuente principal: VEHICLE_TO_BASE_MAP (mapeo interno->base definido en el codigo).
// Complemento: la programacion cargada en memoria (rowsTarget / rows) por si algun
// vehiculo tiene base explicita que no este en el mapa estatico.
function resolveVehiculoBase(row){
  const interno = normalizeVehicleId(row?.interno);
  if (!interno) return "-";
  const fromMap = VEHICLE_TO_BASE_MAP[interno];
  if (fromMap) return fromMap;
  const fromProg = despachoBaseFromProgramacion(interno);
  return fromProg || "-";
}

function despachoBaseFromProgramacion(interno){
  if (!interno) return "";
  const pools = [typeof rowsTarget !== "undefined" ? rowsTarget : null, typeof rows !== "undefined" ? rows : null];
  for (const pool of pools) {
    if (!Array.isArray(pool)) continue;
    for (const r of pool) {
      const vk = getVehiculoKey(r);
      if (!vk) continue;
      if (normalizeVehicleId(r[vk]) === interno) {
        const canon = getRowCanonicalBase(r);
        if (canon) return /^\d+$/.test(canon) ? `BASE ${canon}` : canon;
      }
    }
  }
  return "";
}

function getDespachoFilters(){
  return {
    search: String(despachoSearch?.value || "").trim(),
    estado: despachoEstadoFilter?.value || "",
    sentido: despachoSentidoFilter?.value || "",
    fromIso: despachoFrom?.value || "",
    toIso: despachoTo?.value || ""
  };
}

async function loadDespachosPage(opts = {}){
  if (despachosLoading) return;
  if (!currentUserId) {
    if (despachoStatus) despachoStatus.textContent = "Inicia sesion para ver despachos.";
    return;
  }
  if (opts.resetPage) despachosPage = 0;
  despachosLoading = true;
  despachosLoadedOnce = true;
  if (despachoStatus) despachoStatus.textContent = "Consultando Supabase...";
  try {
    await ensureDespachosColaboradores();
    const f = getDespachoFilters();
    const from = despachosPage * DESPACHOS_PAGE_SIZE;
    const to = from + DESPACHOS_PAGE_SIZE - 1;
    let q = planillaSupabaseClient
      .from(DESPACHOS_TABLE_NAME)
      .select(DESPACHOS_SELECT_COLUMNS, { count: "exact" })
      .order("created_at", { ascending: false, nullsFirst: false })
      .range(from, to);
    if (f.estado) q = q.eq("estado", f.estado);
    // Sentido respecto al aeropuerto (server-side para no romper la paginacion):
    //  BAJADA = itinerario empieza en "Aeropuerto"; SUBIDA = termina en "Aeropuerto".
    if (f.sentido === "BAJADA") q = q.ilike("itinerario", "Aeropuerto%");
    else if (f.sentido === "SUBIDA") q = q.ilike("itinerario", "%Aeropuerto");
    if (f.fromIso) q = q.gte("created_at", `${f.fromIso} 00:00:00`);
    if (f.toIso) q = q.lte("created_at", `${f.toIso} 23:59:59`);
    if (f.search) {
      const term = f.search.replace(/[,()%]/g, " ").trim();
      if (term) {
        q = q.or(`interno.ilike.%${term}%,placa.ilike.%${term}%,itinerario.ilike.%${term}%,observaciones.ilike.%${term}%,vehicle_id.ilike.%${term}%`);
      }
    }
    const { data, count, error } = await q;
    if (error) throw error;
    despachosRows = Array.isArray(data) ? data : [];
    despachosTotalCount = typeof count === "number" ? count : despachosRows.length;
    // Si tras un filtro la pagina actual quedo fuera de rango, reposiciona y recarga.
    const maxPage = Math.max(0, Math.ceil(despachosTotalCount / DESPACHOS_PAGE_SIZE) - 1);
    if (despachosPage > maxPage && despachosTotalCount > 0 && despachosRows.length === 0) {
      despachosPage = maxPage;
      despachosLoading = false;
      return loadDespachosPage();
    }
    renderDespachos();
    if (despachoStatus) {
      despachoStatus.textContent = `Actualizado: ${new Date().toLocaleString("es-CO")}`;
    }
  } catch (e) {
    console.error("Error cargando despachos_realizados:", e);
    if (despachoStatus) despachoStatus.textContent = `Error: ${e?.message || "consulta fallida"}`;
    showToast("No se pudo cargar despachos realizados desde Supabase.", "err");
  } finally {
    despachosLoading = false;
  }
}

// Clasifica un itinerario en sentido respecto al aeropuerto:
//  - BAJADA del aeropuerto: el itinerario EMPIEZA en "Aeropuerto".
//  - SUBIDA al aeropuerto:  el itinerario TERMINA en "Aeropuerto".
// Regla acordada con el usuario (2026-06). Tolerante a acentos/mayusculas y a
// separadores "-", espacios o flechas.
function getDespachoSentido(itin){
  const raw = String(itin ?? "").trim();
  if (!raw || raw === "-") return { kind: "", label: "-" };
  const tokens = raw.split(/[\s\-–—>]+/).filter(Boolean);
  if (!tokens.length) return { kind: "", label: "-" };
  const norm = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
  const first = norm(tokens[0]);
  const last = norm(tokens[tokens.length - 1]);
  if (first === "AEROPUERTO") return { kind: "BAJADA", label: "Bajada del aeropuerto" };
  if (last === "AEROPUERTO") return { kind: "SUBIDA", label: "Subida al aeropuerto" };
  return { kind: "", label: "-" };
}

function getDespachoSentidoBadgeHtml(itin){
  const s = getDespachoSentido(itin);
  if (s.kind === "BAJADA") {
    return `<span title="${escapeHtml(s.label)}" style="display:inline-block;padding:3px 9px;border-radius:999px;font-size:11px;font-weight:600;background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;white-space:nowrap">&#8595; Bajada</span>`;
  }
  if (s.kind === "SUBIDA") {
    return `<span title="${escapeHtml(s.label)}" style="display:inline-block;padding:3px 9px;border-radius:999px;font-size:11px;font-weight:600;background:#fffbeb;color:#b45309;border:1px solid #fde68a;white-space:nowrap">&#8593; Subida</span>`;
  }
  return `<span class="muted">-</span>`;
}

function renderDespachos(){
  if (!despachoBody) return;
  const rows = despachosRows;
  const total = despachosTotalCount;
  const totalPages = Math.max(1, Math.ceil(total / DESPACHOS_PAGE_SIZE));
  const pageNum = despachosPage + 1;
  if (despachoCount) despachoCount.textContent = String(total);
  if (rows.length === 0) {
    despachoBody.innerHTML = `<tr><td colspan="9" class="muted" style="text-align:center;padding:12px">Sin despachos para los filtros actuales.</td></tr>`;
  } else {
    despachoBody.innerHTML = rows.map(row => {
      const fecha = formatPlanillaDateTime(row?.created_at);
      const interno = formatPlanillaCell(row?.interno);
      const base = resolveVehiculoBase(row);
      const itin = formatPlanillaCell(row?.itinerario) || "-";
      const estadoUp = String(row?.estado ?? "").trim().toUpperCase();
      const isCancel = estadoUp === "CANCELADO";
      const badgeStyle = isCancel
        ? "background:#fef2f2;color:#b91c1c;border:1px solid #fecaca;"
        : "background:#f0fdf4;color:#15803d;border:1px solid #bbf7d0;";
      const canceladoTxt = row?.cancelled_at ? formatPlanillaDateTime(row.cancelled_at) : "-";
      const obs = formatPlanillaCell(row?.observaciones) || "";
      return `<tr>
        <td>${escapeHtml(fecha)}</td>
        <td><strong>${escapeHtml(interno)}</strong></td>
        <td>${escapeHtml(base)}</td>
        <td>${escapeHtml(itin)}</td>
        <td style="text-align:center">${getDespachoSentidoBadgeHtml(row?.itinerario)}</td>
        <td style="text-align:center"><span title="Esta funcion se integrara proximamente" style="display:inline-block;padding:2px 9px;border-radius:999px;font-size:11px;font-weight:600;background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;white-space:nowrap">Proximamente</span></td>
        <td><span style="display:inline-block;padding:3px 9px;border-radius:999px;font-size:11px;font-weight:600;${badgeStyle}">${escapeHtml(estadoUp || "-")}</span></td>
        <td>${escapeHtml(canceladoTxt)}</td>
        <td>${escapeHtml(obs)}</td>
      </tr>`;
    }).join("");
  }
  if (despachoPager) {
    const disPrev = despachosPage <= 0 ? "disabled" : "";
    const disNext = despachosPage >= totalPages - 1 ? "disabled" : "";
    despachoPager.innerHTML = `
      <button class="btn btn-ghost" id="despachoFirst" ${disPrev}>&laquo; Primero</button>
      <button class="btn btn-ghost" id="despachoPrev" ${disPrev}>&lsaquo; Anterior</button>
      <span class="muted" style="font-weight:600">Pagina ${pageNum} de ${totalPages}</span>
      <button class="btn btn-ghost" id="despachoNext" ${disNext}>Siguiente &rsaquo;</button>
      <button class="btn btn-ghost" id="despachoLast" ${disNext}>Ultimo &raquo;</button>`;
    const go = (p) => { despachosPage = Math.max(0, Math.min(totalPages - 1, p)); loadDespachosPage(); };
    despachoPager.querySelector("#despachoFirst")?.addEventListener("click", () => go(0));
    despachoPager.querySelector("#despachoPrev")?.addEventListener("click", () => go(despachosPage - 1));
    despachoPager.querySelector("#despachoNext")?.addEventListener("click", () => go(despachosPage + 1));
    despachoPager.querySelector("#despachoLast")?.addEventListener("click", () => go(totalPages - 1));
  }
}

function ensureFreshDespachosData(){
  if (!despachosLoadedOnce) {
    loadDespachosPage({ resetPage: true });
  }
}

function handleDownloadDespachos(){
  if (!window.XLSX) { showToast("No se pudo cargar XLSX para exportar.", "err"); return; }
  if (!despachosRows.length) { showToast("No hay datos para exportar.", "warn"); return; }
  const mapped = despachosRows.map(row => ({
    "Fecha creacion": formatPlanillaDateTime(row?.created_at),
    "Interno": formatPlanillaCell(row?.interno),
    "Base": resolveVehiculoBase(row),
    "Placa": (String(row?.placa ?? "").trim().toUpperCase() === "EMPTY" ? "" : formatPlanillaCell(row?.placa)),
    "Vehiculo": formatPlanillaCell(row?.vehicle_id),
    "Itinerario": formatPlanillaCell(row?.itinerario),
    "Sentido": getDespachoSentido(row?.itinerario).label,
    "Conductor": resolveConductorNombre(row?.driver_id),
    "Cedula conductor": formatPlanillaCell(row?.driver_id),
    "Pasajeros": "Proximamente",
    "Estado": formatPlanillaCell(row?.estado),
    "Cancelado en": row?.cancelled_at ? formatPlanillaDateTime(row.cancelled_at) : "",
    "Observaciones": formatPlanillaCell(row?.observaciones)
  }));
  const ws = XLSX.utils.json_to_sheet(mapped);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Despachos");
  const s = new Date();
  const stamp = `${s.getFullYear()}${String(s.getMonth() + 1).padStart(2, "0")}${String(s.getDate()).padStart(2, "0")}_${String(s.getHours()).padStart(2, "0")}${String(s.getMinutes()).padStart(2, "0")}`;
  XLSX.writeFile(wb, safeFileName(`despachos_realizados_p${despachosPage + 1}_${stamp}.xlsx`));
}

/* ===================== REALTIME (Supabase) ===================== */
// Actualizacion instantanea de las vistas cuando cambian las tablas en Supabase.
// Se suscribe tras iniciar sesion y se limpia al cerrar. Recarga solo la vista
// relevante y solo si esta activa (para no consultar de mas en segundo plano).
let realtimeChannels = [];
let realtimeStarted = false;

function isTabActive(tabId){
  const el = document.getElementById("tab-" + tabId);
  return !!(el && el.classList.contains("active"));
}

function makeDebounced(fn, ms){
  let t = null;
  return function(){
    if (t) clearTimeout(t);
    t = setTimeout(() => { t = null; fn(); }, ms);
  };
}

function startRealtimeSubscriptions(){
  if (realtimeStarted) return;
  if (!planillaSupabaseClient || typeof planillaSupabaseClient.channel !== "function") return;
  realtimeStarted = true;

  // Recargas con debounce: agrupan rafagas de eventos (p.ej. posiciones GPS).
  const reloadLlegadas104 = makeDebounced(() => {
    if (document.hidden) return;
    if (!(isTabActive("llegadas-104") || isTabActive("mapa-aeropuerto"))) return;
    if (typeof window.__reloadLlegadas104 === "function") window.__reloadLlegadas104();
  }, 800);

  const reloadPlanilla = makeDebounced(() => {
    if (document.hidden) return;
    if (!(isTabActive("llegadas-aeropuerto") || isTabActive("llegadas-san-diego") || isTabActive("llegadas-nutibara") || isTabActive("llegadas-novedades"))) return;
    if (typeof loadPlanillaAfiliadosFromSupabase === "function") loadPlanillaAfiliadosFromSupabase();
  }, 800);

  const reloadDespachos = makeDebounced(() => {
    if (document.hidden) return;
    if (!isTabActive("despachos-realizados")) return;
    if (typeof loadDespachosPage === "function") loadDespachosPage();
  }, 800);

  const subs = [
    { table: "llegadas_104", handler: reloadLlegadas104 },
    // planilla_afiliados_2 solo si las Llegadas NO estan en pausa.
    ...(LLEGADAS_PAUSED ? [] : [{ table: "planilla_afiliados_2", handler: reloadPlanilla }]),
    { table: "despachos_realizados", handler: reloadDespachos }
  ];

  subs.forEach(s => {
    try {
      const ch = planillaSupabaseClient
        .channel("rt-" + s.table)
        .on("postgres_changes", { event: "*", schema: "public", table: s.table }, s.handler)
        .subscribe((status) => {
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            console.warn("[realtime] canal", s.table, "estado:", status);
          }
        });
      realtimeChannels.push(ch);
    } catch (e) {
      console.warn("[realtime] no se pudo suscribir a", s.table, e?.message || e);
    }
  });
}

function stopRealtimeSubscriptions(){
  realtimeChannels.forEach(ch => {
    try { planillaSupabaseClient.removeChannel(ch); } catch (e) {}
  });
  realtimeChannels = [];
  realtimeStarted = false;
}

/* ===================== PESTANAS ===================== */
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', async () => {
    // Desactivar todas las pestanas
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

    // Activar la pestana seleccionada
    tab.classList.add('active');
    const tabId = tab.getAttribute('data-tab');
    document.getElementById(`tab-${tabId}`).classList.add('active');

    // CLAVE: confirmar cualquier asignacion pendiente ANTES de recargar datos,
    // para que ninguna recarga pise asignaciones recien hechas (DB nueva).
    await flushPendingTargetSave();

    // Si es la pestana de novedades, renderizar
    if (tabId === 'novedades') {
      refreshNovedadesFromDbAndRender().catch((error) => {
        console.error("No se pudieron refrescar novedades:", error);
        renderNovedades();
      });
    }
    if (tabId === 'programacion2') {
      loadLatestProgramacionFromTargetSupabase()
        .then(async () => {
          const selected = normalizeDateToISO(filterDate2?.value || "");
          if (selected) {
            await loadTargetProgramacionByDate(selected);
          }
          renderTable2();
          renderDrivers();
        })
        .catch((e) => {
          console.error("Error cargando programacion 2:", e);
          showToast("No se pudo cargar la programacion de DB nueva.", "err");
          renderTable2();
          renderDrivers();
        });
    }
    if (tabId === 'novedades2') {
      refreshNovedadesFromDbAndRender().catch((error) => {
        console.error("No se pudieron refrescar novedades DB nueva:", error);
        renderNovedades2();
      });
    }
    if (tabId === 'planilla-afiliados') {
      ensureFreshPlanillaData({ force: false });
    }
    if (tabId === 'llegadas-aeropuerto') {
      ensureFreshPlanillaData({ force: false });
    }
    if (tabId === 'llegadas-san-diego') {
      ensureFreshPlanillaData({ force: false });
    }
    if (tabId === 'llegadas-nutibara') {
      ensureFreshPlanillaData({ force: false });
    }
    if (tabId === 'llegadas-novedades') {
      ensureFreshPlanillaData({ force: false });
    }
    if (tabId === 'despachos-realizados') {
      // Refresca al entrar (primera vez o al volver). Las actualizaciones en vivo
      // llegan por la suscripcion Realtime de despachos_realizados.
      loadDespachosPage({ resetPage: !despachosLoadedOnce });
    }
    if (tabId === 'consulta') {
      renderConsultaBaseView();
    }
    if (tabId === 'visor') {
      refreshVisorDateOptions()
        .then(() => renderLiveExcelPreview())
        .catch((error) => {
          console.error("No se pudo actualizar el visor:", error);
          renderLiveExcelPreview();
        });
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

async function handleNovedadesDropData(data){
  if (!data || data.tipo !== "conductor") return;
  await addNovedadByName(data.nombre);
}

function attachNovedadesDropHandlers(gridEl){
  if (!gridEl) return;
  gridEl.ondragover = ev => {
    ev.preventDefault();
    autoScrollDuringDrag(ev.clientY);
  };
  gridEl.ondrop = async ev => {
    ev.preventDefault();
    try {
      const data = JSON.parse(ev.dataTransfer.getData('text/plain'));
      await handleNovedadesDropData(data);
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

attachNovedadesDropHandlers(document.getElementById("novedadesGrid"));
attachNovedadesDropHandlers(document.getElementById("novedadesGrid2"));

/* ===================== ARCHIVO ===================== */
async function readFile(file, options = {}){
  const mode = String(options?.mode || "source");
  const baseRowsForMode = mode === "target"
    ? (Array.isArray(rowsTarget) ? rowsTarget.slice() : [])
    : (Array.isArray(rows) ? rows.slice() : []);
  setSyncStatus("warn", "Validando archivo...");
  const parsed = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = new Uint8Array(e.target.result);
        const wb = XLSX.read(data, {type:'array'});
        const ws = wb.Sheets[wb.SheetNames[0]];
        const jsonRaw = XLSX.utils.sheet_to_json(ws, { defval: "", raw: true });
        const prepared = normalizeProgramacionRows(jsonRaw);
        validateProgramacionRows(prepared.normalized);
        if (prepared.unmappedVehicles > 0) {
          showToast(`Atencion: ${prepared.unmappedVehicles} vehiculos sin base mapeada.`, "warn");
          setSyncStatus("warn", "Mapeo parcial");
        }
        resolve({
          normalized: prepared.normalized,
          raw: Array.isArray(jsonRaw) ? jsonRaw : []
        });
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
  const parsedRows = Array.isArray(parsed?.normalized) ? parsed.normalized : [];
  const parsedRowsOriginal = Array.isArray(parsed?.raw) ? parsed.raw : [];

  const adminDayDate = normalizeDateToISO(document.getElementById("adminDayDate")?.value || "");
  const scopedDayImport = isSuperAdmin() && /^\d{4}-\d{2}-\d{2}$/.test(adminDayDate);
  let nextRows = parsedRows;
  if (mode === "target") {
    nextRows = parsedRowsOriginal.slice();
    showToast(`Importacion DB nueva: ${nextRows.length} filas guardadas tal cual Excel.`, "ok");
  } else if (scopedDayImport) {
    const incomingFechaKey = getFechaKeyFromArray(parsedRows);
    const existingFechaKey = getFechaKeyFromArray(baseRowsForMode);
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

    const existingParts = partitionRowsByDate(baseRowsForMode, adminDayDate, existingFechaKey);
    const mergeResult = mergeImportedRowsPreservingAssignments(incomingParts.selected, existingParts.selected);
    nextRows = existingParts.rest.concat(mergeResult.mergedRows);
    showToast(
      `Dia ${excelDateToReadable(adminDayDate)} reemplazado (${incomingParts.selected.length} filas, ${mergeResult.preservedAssignments} asignaciones conservadas).`,
      "ok"
    );
  } else {
    const mergeResult = mergeImportedRowsPreservingAssignments(parsedRows, baseRowsForMode);
    // Mantener el historial de dias: combina lo importado con lo existente
    // en lugar de reemplazar por completo cuando no se usa "Dia a editar".
    nextRows = mergeLatestRowsIntoConsolidatedRows(baseRowsForMode, mergeResult.mergedRows);
    if (mergeResult.matchedRows > 0) {
      showToast(
        `Importacion combinada: ${mergeResult.preservedAssignments} asignaciones conservadas (${mergeResult.matchedRows} filas coinciden).`,
        "ok"
      );
    } else if (baseRowsForMode.length > 0) {
      const addedRows = Math.max(0, nextRows.length - baseRowsForMode.length);
      showToast(`Importacion anexada: ${addedRows} filas nuevas agregadas.`, "ok");
    }
  }

  if (mode === "target") {
    rowsTarget = normalizeProgramacionRows(nextRows).normalized;
  } else {
    rows = nextRows.slice();
    updateExportAccess();
    fillStartBases();
    if (currentBase) refreshFilterDateOptions();
  }
  try {
    if (mode === "target") {
      await saveProgramacionToTargetSupabase(file, nextRows);
    } else {
      await saveProgramacionToSupabase(file, nextRows);
    }
  } catch (error) {
    console.error("No se pudo persistir en Supabase:", error);
    const detail = String(error?.message || "").trim();
    if (mode === "target") {
      showToast(`Archivo cargado localmente para DB nueva: ${file.name} | Filas: ${rowsTarget.length}`, "warn");
    } else {
      lblGlobal.textContent = `Archivo cargado localmente: ${file.name} | Filas: ${rows.length}`;
    }
    setSyncStatus("warn", "Solo local");
    alert(mode === "target"
      ? `El archivo se cargo, pero no se pudo guardar en la base nueva de Supabase.\n\nDetalle: ${detail || "sin detalle"}`
      : "El archivo se cargo, pero no se pudo guardar en Supabase. Revisa tablas/politicas.");
  }

  if(currentBase){
    operativoInner.classList.remove("hidden");
    if (mode === "target") {
      renderTable2();
    } else {
      renderTable();
      renderDrivers();
    }
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

  const activeTab = getActiveTabId();
  const usingTargetView = activeTab === "programacion2" || activeTab === "novedades2";
  refreshFilterDateOptions();
  refreshFilterDateOptions2();
  if (!usingTargetView) {
    autoSelectDateForBaseOperator();
  }
  document.getElementById("filterDrivers").value = "";

  rebuildAssigned();
  updateWorkflowGuide();
  if (usingTargetView) {
    const selectedDate2 = normalizeDateToISO(filterDate2?.value || "");
    if (selectedDate2) {
      flushPendingTargetSave()
        .then(() => loadTargetProgramacionByDate(selectedDate2))
        .catch((e) => console.error("No se pudo cargar Programacion 2 por fecha al cambiar base:", e))
        .finally(() => {
          renderTable2();
          renderDrivers();
          renderNovedades2();
        });
      return;
    }
    renderTable2();
    renderDrivers();
    renderNovedades2();
  } else {
    renderTable();
    renderDrivers();
    renderNovedades();
  }
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
  refreshFilterDateOptions2();
  updateWorkflowGuide();
}

/* ===================== EVENTOS ===================== */
function markTopNavActive(activeButtonId){
  const ids = ["btnGoOperativo", "btnGoAdmin", "btnGoConverter"];
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
  setOperativoViewMode("operativo");
  markTopNavActive("btnGoOperativo");
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
  } finally {
    if (e?.target) e.target.value = "";
  }
}

async function handleProgramacionFileChangeNewDb(e){
  const f = e.target.files[0];
  if(!f) return;
  try {
    setSyncStatus("warn", "Subiendo archivo a DB nueva...");
    await readFile(f, { mode: "target" });
  } catch (error) {
    console.error("Error procesando archivo para DB nueva:", error);
    setSyncStatus("err", "Archivo invalido (DB nueva)");
    alert(error?.message || "No se pudo cargar el archivo en la base nueva de Supabase.");
  } finally {
    if (e?.target) e.target.value = "";
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

  const btnGoConverter = document.getElementById("btnGoConverter");
  if (btnGoConverter) {
    btnGoConverter.addEventListener("click", showConverterPanel);
  }

  const fileProg = document.getElementById("fileProg");
  if (fileProg) {
    fileProg.addEventListener("change", handleProgramacionFileChange);
  }
  const fileProgNewDb = document.getElementById("fileProgNewDb");
  if (fileProgNewDb) {
    fileProgNewDb.addEventListener("change", handleProgramacionFileChangeNewDb);
  }

  const btnExport = document.getElementById("btnExport");
  if (btnExport) {
    btnExport.addEventListener("click", handleExportProgramacionClick);
  }

  const btnExportTurnos = document.getElementById("btnExportTurnos");
  if (btnExportTurnos) {
    btnExportTurnos.addEventListener("click", handleExportPlanillaTurnos);
  }

  const btnExportReporteTurnos = document.getElementById("btnExportReporteTurnos");
  if (btnExportReporteTurnos) {
    btnExportReporteTurnos.addEventListener("click", handleExportReporteTurnos);
  }

  const btnExportFormato = document.getElementById("btnExportFormato");
  if (btnExportFormato) {
    btnExportFormato.addEventListener("click", async () => {
  if (!canExportXlsx()) {
    showToast("Solo el super administrador puede descargar el Excel.", "warn");
    return;
  }
  const usingTargetFormato = USE_ONLY_NEW_DB || getActiveProgramacionMode() === "target" || (Array.isArray(rowsTarget) && rowsTarget.length > 0);
  let sourceRows = usingTargetFormato ? rowsTarget : rows;
  if (!sourceRows.length) {
    showToast("No hay datos para exportar.", "warn");
    return;
  }

  if (!window.ExcelJS) {
    showToast("No se pudo cargar ExcelJS para exportar con estilos.", "err");
    return;
  }

  // Rango opcional (1 hoja por dia). Vacio = solo el dia seleccionado en Turnos del dia 2.
  const expDesde = normalizeDateToISO(document.getElementById("operativoExpDesde")?.value || "");
  const expHasta = normalizeDateToISO(document.getElementById("operativoExpHasta")?.value || "");
  if ((expDesde && !expHasta) || (!expDesde && expHasta)) {
    showToast("Para el formato por rango indica Desde Y Hasta.", "warn");
    return;
  }
  const usarRango = !!(expDesde && expHasta);

  let opDates = [];
  if (usarRango) {
    if (expDesde > expHasta) { showToast("La fecha 'Desde' no puede ser mayor que 'Hasta'.", "warn"); return; }
    const pad2 = (n) => String(n).padStart(2, "0");
    let cur = new Date(`${expDesde}T00:00:00`);
    const end = new Date(`${expHasta}T00:00:00`);
    while (cur <= end) { opDates.push(`${cur.getFullYear()}-${pad2(cur.getMonth() + 1)}-${pad2(cur.getDate())}`); cur.setDate(cur.getDate() + 1); }
    if (opDates.length > 62) { showToast("El rango es muy grande (maximo ~2 meses).", "warn"); return; }
  } else {
    const selectedDate = normalizeDateToISO((usingTargetFormato ? filterDate2?.value : document.getElementById("filterDate")?.value) || "");
    if (!selectedDate) {
      showToast(`Selecciona una fecha en ${usingTargetFormato ? "Turnos del dia 2" : "Turnos del dia"} (o un rango) para descargar el formato operativo.`, "warn");
      return;
    }
    opDates = [selectedDate];
  }

  // Novedades: del rango (si aplica) o las ya cargadas en memoria.
  let novedadesAll = Array.isArray(novedades) ? novedades : [];
  if (usarRango && typeof fetchNovedadesRange === "function") {
    try { const nr = await fetchNovedadesRange(opDates[0], opDates[opDates.length - 1]); if (Array.isArray(nr)) novedadesAll = nr; }
    catch (e) { console.warn("novedades rango:", e?.message || e); }
  }

  const wb = new ExcelJS.Workbook();
  let hojas = 0;
  const sinDatos = [];
  for (const d of opDates) {
    let rowsForDate = [];
    if (usarRango) {
      rowsForDate = (typeof fetchProgramacionRowsForDate === "function") ? await fetchProgramacionRowsForDate(d) : [];
    } else {
      let src = usingTargetFormato ? rowsTarget : rows;
      const fkNow = usingTargetFormato ? getFechaKeyFromArray(src) : getFechaKey();
      const has = fkNow && src.some(r => getRowDateISO(r, fkNow) === d);
      if (usingTargetFormato && !has) {
        try { await loadTargetProgramacionByDate(d); } catch (e) { console.error("No se pudo cargar fecha para formato operativo:", e); }
        src = rowsTarget;
      }
      const fk2 = usingTargetFormato ? getFechaKeyFromArray(src) : getFechaKey();
      rowsForDate = fk2 ? src.filter(r => getRowDateISO(r, fk2) === d) : src.slice();
    }
    if (!rowsForDate.length) { sinDatos.push(d); continue; }
    buildOperativoSheet(wb, d, rowsForDate, novedadesAll);
    hojas++;
  }

  if (hojas === 0) {
    showToast("No hay datos para la(s) fecha(s) seleccionada(s).", "warn");
    return;
  }

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = usarRango ? `formato_operativo_${opDates[0]}_a_${opDates[opDates.length - 1]}.xlsx` : `formato_operativo_${opDates[0]}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  const avisoSin = sinDatos.length ? ` | sin datos: ${sinDatos.length} dia(s)` : "";
  showToast(`Formato operativo: ${hojas} hoja(s) generada(s)${avisoSin}.`, sinDatos.length ? "warn" : "ok");
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
  if (btnMigrationStatus) btnMigrationStatus.addEventListener("click", renderMigrationStatus);
  if (btnMigrateLatestProgramacion) btnMigrateLatestProgramacion.addEventListener("click", handleMigrateLatestProgramacionClick);
  if (btnMigrateSelectedProgramacion) btnMigrateSelectedProgramacion.addEventListener("click", handleMigrateSelectedProgramacionClick);
  if (!AUDIT_DISABLED && btnRefreshAudit) btnRefreshAudit.addEventListener("click", () => loadAuditLogFromSupabase());
  if (!AUDIT_DISABLED && auditFrom) auditFrom.addEventListener("change", renderAuditLog);
  if (!AUDIT_DISABLED && auditTo) auditTo.addEventListener("change", renderAuditLog);
  if (!AUDIT_DISABLED && auditTableFilter) auditTableFilter.addEventListener("change", renderAuditLog);
  if (!AUDIT_DISABLED && auditOpFilter) auditOpFilter.addEventListener("change", renderAuditLog);
  if (!AUDIT_DISABLED && auditUserFilter) auditUserFilter.addEventListener("input", renderAuditLog);
  if (btnRefreshVisor) {
    btnRefreshVisor.addEventListener("click", async () => {
      await refreshVisorDateOptions();
      await renderLiveExcelPreview();
    });
  }
  if (btnExportVisor) btnExportVisor.addEventListener("click", exportLiveExcelPreviewTable);
  if (visorDateSelect) visorDateSelect.addEventListener("change", renderLiveExcelPreview);
  if (visorScopeSelect) visorScopeSelect.addEventListener("change", renderLiveExcelPreview);

  const filterDrivers = document.getElementById("filterDrivers");
  if (filterDrivers) filterDrivers.addEventListener("input", renderDrivers);
  if (btnAddNovedadManual2) {
    btnAddNovedadManual2.addEventListener("click", async () => {
      try {
        await addNovedadByName(novedadManualInput2?.value || "");
      } catch (error) {
        console.error("Error asignando novedad manual:", error);
        showToast("No se pudo asignar el conductor por nombre.", "err");
      }
    });
  }
  if (novedadManualInput2) {
    novedadManualInput2.addEventListener("keydown", async (ev) => {
      if (ev.key !== "Enter") return;
      ev.preventDefault();
      try {
        await addNovedadByName(novedadManualInput2.value || "");
      } catch (error) {
        console.error("Error asignando novedad manual:", error);
        showToast("No se pudo asignar el conductor por nombre.", "err");
      }
    });
  }

  const filterDate = document.getElementById("filterDate");
  if (filterDate) {
    filterDate.addEventListener("change", handleFilterDateChange);
  }

  const clearFilter = document.getElementById("clearFilter");
  if (clearFilter) {
    clearFilter.addEventListener("click", handleClearFilterClick);
  }
  if (filterDate2) {
    filterDate2.addEventListener("change", async () => {
      await flushPendingTargetSave();
      try {
        const selected = normalizeDateToISO(filterDate2.value || "");
        if (selected) {
          await loadTargetProgramacionByDate(selected);
        } else {
          await loadLatestProgramacionFromTargetSupabase();
        }
        await loadNovedadesFromSupabase({ silent: true });
      } catch (e) {
        console.error("No se pudo cargar fecha seleccionada desde DB nueva:", e);
      }
      renderTable2();
      renderDrivers();
      renderNovedades2();
    });
  }
  if (clearFilter2) {
    clearFilter2.addEventListener("click", async () => {
      if (filterDate2) filterDate2.value = "";
      try {
        await loadLatestProgramacionFromTargetSupabase();
      } catch (e) {
        console.error("No se pudo recargar Programacion 2 al limpiar filtro:", e);
      }
      renderTable2();
      renderDrivers();
    });
  }
  if (btnRefreshProgramacion2) {
    btnRefreshProgramacion2.addEventListener("click", async () => {
      try {
        await flushPendingTargetSave();
        await loadLatestProgramacionFromTargetSupabase();
        const selected = normalizeDateToISO(filterDate2?.value || "");
        if (selected) {
          await loadTargetProgramacionByDate(selected);
        }
        renderTable2();
        renderDrivers();
        showToast("Programacion 2 actualizada desde DB nueva.", "ok");
      } catch (e) {
        console.error("No se pudo actualizar programacion 2:", e);
        showToast("No se pudo actualizar Programacion 2.", "err");
      }
    });
  }

  if (btnRefreshPlanilla) {
    btnRefreshPlanilla.addEventListener("click", loadPlanillaAfiliadosFromSupabase);
  }
  if (btnDownloadLlegadas) {
    btnDownloadLlegadas.addEventListener("click", handleDownloadLlegadas);
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
  if (btnRefreshLlegadasNovedades) {
    btnRefreshLlegadasNovedades.addEventListener("click", loadPlanillaAfiliadosFromSupabase);
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
  if (btnRefreshDespachos) btnRefreshDespachos.addEventListener("click", () => loadDespachosPage({ resetPage: true }));
  if (btnDownloadDespachos) btnDownloadDespachos.addEventListener("click", handleDownloadDespachos);
  if (despachoEstadoFilter) despachoEstadoFilter.addEventListener("change", () => loadDespachosPage({ resetPage: true }));
  if (despachoSentidoFilter) despachoSentidoFilter.addEventListener("change", () => loadDespachosPage({ resetPage: true }));
  if (despachoFrom) despachoFrom.addEventListener("change", () => loadDespachosPage({ resetPage: true }));
  if (despachoTo) despachoTo.addEventListener("change", () => loadDespachosPage({ resetPage: true }));
  if (despachoSearch) despachoSearch.addEventListener("keydown", (e) => { if (e.key === "Enter") loadDespachosPage({ resetPage: true }); });
}

// ==================== INIT ====================
async function initializeApp(){
  renderMigrationDbInfo();
  loadBasesFromStorage();
  if (loadDriversCache()) {
    fillStartBases();
  }
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
  try {
    await loadLatestProgramacionFromTargetSupabase();
  } catch (targetLoadError) {
    console.warn("No se pudo cargar programacion inicial de DB nueva:", targetLoadError);
  }
  const pendingTarget = readPendingTargetRowsLocal();
  if (pendingTarget && Array.isArray(pendingTarget.rows_data) && pendingTarget.rows_data.length > 0) {
    const sameTargetProgramacion = !pendingTarget.programacion_id
      || !currentProgramacionIdTarget
      || String(pendingTarget.programacion_id) === String(currentProgramacionIdTarget);
    if (sameTargetProgramacion) {
      rowsTarget = dedupeProgramacionRows(pendingTarget.rows_data).rows;
      if (pendingTarget.programacion_id) currentProgramacionIdTarget = pendingTarget.programacion_id;
      if (pendingTarget.file_name) currentProgramacionFileNameTarget = pendingTarget.file_name;
      setSyncStatus("warn", "Pendiente DB nueva");
      if (ENABLE_PROGRAMACION_AUTO_REFRESH && navigator.onLine) {
        try {
          await syncProgramacionRowsToTargetSupabase("Pendientes DB nueva sincronizados.", { skipQueueSave: true });
        } catch (syncTargetError) {
          console.warn("Pendientes DB nueva siguen en cola:", syncTargetError);
        }
      }
    }
  }
  renderTable2();
  renderConsultaBaseView();
  if (isSuperAdmin()) {
    try {
      await renderMigrationStatus();
    } catch (migrationError) {
      console.warn("No se pudo renderizar estado de migracion:", migrationError);
    }
  }
}

function bindWindowEvents(){
  window.addEventListener("online", async () => {
    if (!ENABLE_PROGRAMACION_AUTO_REFRESH) return;
    showToast("Conexion restablecida. Sincronizando...", "ok");
    setSyncStatus("warn", "Reconectado - sincronizando");
    await syncProgramacionRowsToSupabase("Cambios pendientes sincronizados.");
    if (hasPendingTargetRowsLocal()) {
      try {
        await syncProgramacionRowsToTargetSupabase("Pendientes DB nueva sincronizados.", { skipQueueSave: true });
      } catch (targetSyncError) {
        console.warn("No se pudieron sincronizar pendientes DB nueva:", targetSyncError);
      }
    }
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
    if (syncRowsInProgressTarget || syncRowsPendingTarget) {
      savePendingTargetRowsLocally("Recarga durante sincronizacion (DB nueva)");
    }
    clearSyncRetryTimer();
    clearTargetSyncRetryTimer();
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
    if (!ENABLE_PROGRAMACION_AUTO_REFRESH) return;
    if (isTargetTableEditing()) return;
    if (navigator.onLine && hasPendingRowsLocal()) {
      await syncProgramacionRowsToSupabase("Sincronizacion al volver a la ventana.");
    }
    if (navigator.onLine && hasPendingTargetRowsLocal()) {
      try {
        await syncProgramacionRowsToTargetSupabase("Sincronizacion DB nueva al volver a la ventana.", { skipQueueSave: true });
      } catch (targetSyncError) {
        console.warn("Pendiente DB nueva al volver a la ventana:", targetSyncError);
      }
    }
    await refreshFromSupabaseIfSafe();
  });

  document.addEventListener("visibilitychange", async () => {
    if (!ENABLE_PROGRAMACION_AUTO_REFRESH) return;
    if (document.visibilityState !== "visible") return;
    if (isTargetTableEditing()) return;
    if (navigator.onLine && hasPendingRowsLocal()) {
      await syncProgramacionRowsToSupabase("Sincronizacion al volver a la pestana.");
    }
    if (navigator.onLine && hasPendingTargetRowsLocal()) {
      try {
        await syncProgramacionRowsToTargetSupabase("Sincronizacion DB nueva al volver a la pestana.", { skipQueueSave: true });
      } catch (targetSyncError) {
        console.warn("Pendiente DB nueva al volver a la pestana:", targetSyncError);
      }
    }
    await refreshFromSupabaseIfSafe();
  });

  if (ENABLE_PROGRAMACION_AUTO_REFRESH && !autoRefreshTimer) {
    autoRefreshTimer = setInterval(async () => {
      if (!navigator.onLine) return;
      if (isTargetTableEditing()) return;
      if (hasPendingRowsLocal()) {
        await syncProgramacionRowsToSupabase("Reintento automatico de pendientes.");
        return;
      }
      if (hasPendingTargetRowsLocal()) {
        try {
          await syncProgramacionRowsToTargetSupabase("Reintento automatico pendientes DB nueva.", { skipQueueSave: true });
        } catch (targetSyncError) {
          console.warn("Reintento automatico DB nueva no confirmado:", targetSyncError);
        }
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


/* =====================================================================
   MODULO: Asistencias (entradas/salidas con foto, geolocalizacion y Buk)
   Solo lectura. Lee de la tabla `asistencias` y embebe `colaboradores`/`obras`.
   ===================================================================== */
(function bootstrapAsistencias(){
  const ASIST_TABLE = "asistencias";
  const ASIST_FETCH_LIMIT = 20000;

  // SELECT con embed defensivo: si la FK esta definida, trae el colaborador.
  // El alias singular es estandar PostgREST.
  const SELECT_WITH_EMBED = "*, colaborador:colaboradores(*)";
  const SELECT_PLAIN = "*";

  const state = {
    rows: [],
    loading: false,
    loadedOnce: false,
    embedAvailable: true
  };

  // Indice memoizado: nombre normalizado -> numero de base (segun CSV Google Sheets).
  let _baseByName = null;

  function normalizeName(s){
    return String(s == null ? "" : s)
      .toUpperCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function buildBaseByNameIndex(){
    _baseByName = new Map();
    const dbb = (typeof driversByBase === "object" && driversByBase) ? driversByBase : {};
    Object.keys(dbb).forEach(baseKey => {
      const list = Array.isArray(dbb[baseKey]) ? dbb[baseKey] : [];
      list.forEach(name => {
        const k = normalizeName(name);
        if (k && !_baseByName.has(k)) _baseByName.set(k, String(baseKey));
      });
    });
  }

  function getBaseDesdeCsv(nombre){
    if (!_baseByName) buildBaseByNameIndex();
    const k = normalizeName(nombre);
    if (!k) return "";
    return _baseByName.get(k) || "";
  }

  // Base activa para filtrar asistencias:
  //   - Operador de base (login con email base{N}@) -> fija a currentUserBase
  //   - Admin -> usa currentBase (la "abierta" desde el selector). Vacio = sin filtro.
  function getActiveBase(){
    const canon = (typeof getBaseCanonical === "function") ? getBaseCanonical : (v) => String(v || "");
    if (typeof isBaseOperator === "function" && isBaseOperator()){
      return String(canon(currentUserBase) || "");
    }
    return String(canon(currentBase) || "");
  }

  function setBaseHint(){
    const el = $("asistenciasBaseHint");
    if (!el) return;
    el.textContent = "Mostrando todas las bases";
  }

  const $ = (id) => document.getElementById(id);

  function setStatus(msg, isErr = false){
    const el = $("asistenciasStatus");
    if (!el) return;
    el.textContent = msg;
    el.style.color = isErr ? "var(--color-danger, #b91c1c)" : "";
  }

  function setCount(n){
    const el = $("asistenciasCount");
    if (el) el.textContent = String(n);
  }

  function getColaboradorNombre(row){
    const c = row && row.colaborador;
    if (c && typeof c === "object"){
      const candidate =
        c.nombre_completo ||
        c.nombre ||
        c.nombres ||
        (c.nombres && c.apellidos ? `${c.nombres} ${c.apellidos}` : null) ||
        c.full_name ||
        c.name ||
        c.display_name;
      if (candidate) return String(candidate);
      if (c.id) return shortId(c.id);
    }
    return shortId(row && row.colaborador_id);
  }

  function shortId(id){
    if (!id) return "";
    const str = String(id);
    return str.length > 8 ? str.slice(0, 8) + "..." : str;
  }

  function formatHora(value){
    if (!value) return "";
    const str = String(value);
    // "06:22:25.366914" -> "06:22:25"
    const dot = str.indexOf(".");
    return dot >= 0 ? str.slice(0, dot) : str;
  }

  async function loadAsistencias(){
    if (state.loading) return;
    if (typeof planillaSupabaseClient === "undefined" || !planillaSupabaseClient){
      setStatus("Cliente Supabase no inicializado.", true);
      return;
    }
    state.loading = true;
    setStatus("Cargando...");
    try {
      const desde = $("asistenciasFrom") && $("asistenciasFrom").value;
      const hasta = $("asistenciasTo") && $("asistenciasTo").value;

      // PostgREST limita cada respuesta (tipicamente 1000 filas). Por eso paginamos
      // por bloques con .range() hasta completar todo o alcanzar ASIST_FETCH_LIMIT.
      const PAGE = 1000;
      const buildQuery = (selectStr, from, to) => {
        let q = planillaSupabaseClient
          .from(ASIST_TABLE)
          .select(selectStr)
          .order("fecha", { ascending: false, nullsFirst: false })
          .order("hora",  { ascending: false, nullsFirst: false })
          .range(from, to);
        if (desde) q = q.gte("fecha", desde);
        if (hasta) q = q.lte("fecha", hasta);
        return q;
      };

      let selectStr = state.embedAvailable ? SELECT_WITH_EMBED : SELECT_PLAIN;
      const all = [];
      let from = 0;
      while (from < ASIST_FETCH_LIMIT){
        const to = Math.min(from + PAGE, ASIST_FETCH_LIMIT) - 1;
        const expected = to - from + 1;
        let { data, error } = await buildQuery(selectStr, from, to);

        // Si falla el embed por FK ausente, cambio a select plano y reintento este bloque.
        if (error && state.embedAvailable){
          const msg = (error.message || "").toLowerCase();
          const isEmbedErr = msg.includes("relationship") || msg.includes("could not find") || msg.includes("schema cache");
          if (isEmbedErr){
            state.embedAvailable = false;
            selectStr = SELECT_PLAIN;
            console.warn("[asistencias] Embed no disponible, usando select plano:", error.message);
            ({ data, error } = await buildQuery(selectStr, from, to));
          }
        }

        if (error) throw error;

        const batch = Array.isArray(data) ? data : [];
        all.push(...batch);
        setStatus(`Cargando... ${all.length}`);
        if (batch.length < expected) break; // bloque incompleto = no hay mas registros
        from += PAGE;
      }

      state.rows = all;
      state.loadedOnce = true;
      // Reconstruir indice base-por-nombre con el CSV actual (driversByBase puede
      // haber cambiado entre cargas).
      _baseByName = null;
      setStatus(`Cargadas ${state.rows.length} (limite ${ASIST_FETCH_LIMIT}).`);
      render();
    } catch (err){
      console.error("[asistencias] error de carga:", err);
      setStatus("Error al cargar: " + (err && err.message ? err.message : "desconocido"), true);
      if (typeof showToast === "function") showToast("No se pudieron cargar las asistencias.", "err");
    } finally {
      state.loading = false;
    }
  }

  function getFilteredRows(){
    let rows = state.rows.slice();

    // Sin filtro por base: la vista de asistencias muestra todas las bases.

    const sentido = ($("asistenciasSentido") && $("asistenciasSentido").value || "").trim().toLowerCase();
    // En vista "entrada y salida" no aplicamos el filtro de sentido (necesitamos ambos para emparejar).
    if (sentido && getVista() !== "pares") rows = rows.filter(r => (r.sentido || "").toLowerCase() === sentido);

    const term = ($("asistenciasSearch") && $("asistenciasSearch").value || "").trim().toLowerCase();
    if (term){
      rows = rows.filter(r => {
        const nombre = getColaboradorNombre(r);
        const baseCsv = getBaseDesdeCsv(nombre);
        const haystack = [
          nombre,
          baseCsv ? `BASE ${baseCsv}` : "",
          r.base_operativa,
          r.fecha,
          r.hora
        ].filter(Boolean).map(v => String(v).toLowerCase()).join(" | ");
        return haystack.includes(term);
      });
    }
    return rows;
  }

  function getVista(){
    const v = ($("asistenciasVista") && $("asistenciasVista").value) || "detalle";
    return v === "pares" ? "pares" : "detalle";
  }

  function setHead(vista){
    const head = $("asistenciasHead");
    if (!head) return;
    head.innerHTML = (vista === "pares")
      ? "<th>Fecha</th><th>Colaborador</th><th>Base</th><th>Entrada</th><th>Salida</th><th>Horas</th>"
      : "<th>Fecha</th><th>Hora</th><th>Jornada</th><th>Sentido</th><th>Colaborador</th><th>Base</th>";
  }

  function hhmmssToSec(h){
    const m = String(h || "").match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (!m) return null;
    return (+m[1]) * 3600 + (+m[2]) * 60 + (+(m[3] || 0));
  }
  function secToHHMM(s){
    if (s == null) return "";
    if (s < 0) s += 86400; // turno que cruza medianoche
    const h = Math.floor(s / 3600), mn = Math.floor((s % 3600) / 60);
    return `${String(h).padStart(2, "0")}:${String(mn).padStart(2, "0")}`;
  }

  // Agrupa las marcas por colaborador + jornada -> { fecha, nombre, base, entrada, salida }.
  function buildPares(rows){
    const groups = new Map();
    rows.forEach(r => {
      const nombre = getColaboradorNombre(r);
      const personKey = String(r.colaborador_id || nombre || "").trim();
      const jornada = String(r.jornada || r.fecha || "").trim();
      const key = `${personKey}|${jornada}`;
      let g = groups.get(key);
      if (!g){
        const bcsv = getBaseDesdeCsv(nombre);
        g = { fecha: r.fecha || jornada, jornada, nombre, base: bcsv ? `BASE ${bcsv}` : (r.base_operativa || ""), entrada: null, salida: null };
        groups.set(key, g);
      }
      const hora = formatHora(r.hora);
      const s = String(r.sentido || "").toLowerCase();
      if (s === "entrada"){ if (!g.entrada || hora < g.entrada) g.entrada = hora; }
      else if (s === "salida"){ if (!g.salida || hora > g.salida) g.salida = hora; }
    });
    const out = Array.from(groups.values());
    out.sort((a, b) => String(b.jornada).localeCompare(String(a.jornada)) || String(a.nombre).localeCompare(String(b.nombre), "es"));
    return out;
  }

  function render(){
    const tbody = $("asistenciasBody");
    if (!tbody) return;
    setBaseHint();
    const vista = getVista();
    setHead(vista);
    const rows = getFilteredRows();

    if (!state.loadedOnce){
      setCount(rows.length);
      tbody.innerHTML = `<tr><td colspan="6" class="muted" style="text-align:center;padding:12px">Sin datos. Pulsa "Actualizar" para cargar.</td></tr>`;
      return;
    }
    if (!rows.length){
      setCount(0);
      tbody.innerHTML = `<tr><td colspan="6" class="muted" style="text-align:center;padding:12px">Sin resultados con los filtros aplicados.</td></tr>`;
      return;
    }

    const esc = (typeof escapeHtml === "function") ? escapeHtml : (v) => String(v == null ? "" : v);

    if (vista === "pares"){
      const pares = buildPares(rows);
      setCount(pares.length);
      tbody.innerHTML = pares.map(g => {
        const segs = (g.entrada != null && g.salida != null) ? (hhmmssToSec(g.salida) - hhmmssToSec(g.entrada)) : null;
        const horas = (segs == null) ? "-" : secToHHMM(segs);
        const ent = g.entrada ? `<span class="estado-tag tag-disponible" style="white-space:nowrap">${esc(g.entrada)}</span>` : '<span class="muted">-</span>';
        const sal = g.salida ? `<span class="estado-tag tag-vacaciones" style="white-space:nowrap">${esc(g.salida)}</span>` : '<span class="muted">-</span>';
        return `<tr>
          <td>${esc(g.fecha || "")}</td>
          <td>${esc(g.nombre)}</td>
          <td style="white-space:nowrap">${esc(g.base)}</td>
          <td style="text-align:center">${ent}</td>
          <td style="text-align:center">${sal}</td>
          <td style="text-align:center">${esc(horas)}</td>
        </tr>`;
      }).join("");
      return;
    }

    setCount(rows.length);
    tbody.innerHTML = rows.map(r => {
      const sentidoCls = (r.sentido === "entrada") ? "tag-disponible" : (r.sentido === "salida" ? "tag-vacaciones" : "tag-pendiente");
      const nombre = getColaboradorNombre(r);
      const baseCsv = getBaseDesdeCsv(nombre);
      const baseLabel = baseCsv ? `BASE ${baseCsv}` : (r.base_operativa || "");
      return `<tr>
        <td>${esc(r.fecha || "")}</td>
        <td>${esc(formatHora(r.hora))}</td>
        <td>${esc(r.jornada || "")}</td>
        <td><span class="estado-tag ${sentidoCls}" style="white-space:nowrap">${esc(r.sentido || "")}</span></td>
        <td>${esc(nombre)}</td>
        <td style="white-space:nowrap">${esc(baseLabel)}</td>
      </tr>`;
    }).join("");
  }

  function exportToExcel(){
    if (typeof XLSX === "undefined"){
      if (typeof showToast === "function") showToast("XLSX no disponible.", "err");
      return;
    }
    const rows = getFilteredRows();
    if (!rows.length){
      if (typeof showToast === "function") showToast("No hay filas para exportar.", "warn");
      return;
    }
    let data;
    if (getVista() === "pares"){
      data = buildPares(rows).map(g => {
        const segs = (g.entrada != null && g.salida != null) ? (hhmmssToSec(g.salida) - hhmmssToSec(g.entrada)) : null;
        return {
          Fecha: g.fecha || "",
          Colaborador: g.nombre,
          Base: g.base || "",
          Entrada: g.entrada || "",
          Salida: g.salida || "",
          Horas: (segs == null) ? "" : secToHHMM(segs)
        };
      });
    } else {
      data = rows.map(r => {
        const nombre = getColaboradorNombre(r);
        const baseCsv = getBaseDesdeCsv(nombre);
        const baseLabel = baseCsv ? `BASE ${baseCsv}` : (r.base_operativa || "");
        return {
          Fecha: r.fecha || "",
          Hora: formatHora(r.hora),
          Jornada: r.jornada || "",
          Sentido: r.sentido || "",
          Colaborador: nombre,
          ColaboradorId: r.colaborador_id || "",
          Base: baseLabel,
          Latitud: r.latitud == null ? "" : r.latitud,
          Longitud: r.longitud == null ? "" : r.longitud,
          PrecisionM: r.ubicacion_precision_m == null ? "" : r.ubicacion_precision_m,
          CreatedAt: r.created_at || ""
        };
      });
    }
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Asistencias");
    const fname = (typeof safeFileName === "function" ? safeFileName : (s) => s)(
      `asistencias_${new Date().toISOString().slice(0,10)}.xlsx`
    );
    XLSX.writeFile(wb, fname);
  }

  function bind(){
    const btnRefresh = $("btnRefreshAsistencias");
    const btnDownload = $("btnDownloadAsistencias");
    const search = $("asistenciasSearch");
    const sentido = $("asistenciasSentido");
    const vista = $("asistenciasVista");
    const fromI = $("asistenciasFrom");
    const toI = $("asistenciasTo");

    if (btnRefresh) btnRefresh.addEventListener("click", loadAsistencias);
    if (btnDownload) btnDownload.addEventListener("click", exportToExcel);
    if (search) search.addEventListener("input", render);
    if (sentido) sentido.addEventListener("change", render);
    if (vista) vista.addEventListener("change", render);
    // Filtros de fecha re-consultan al servidor (porque limit=500).
    if (fromI) fromI.addEventListener("change", () => { if (state.loadedOnce) loadAsistencias(); });
    if (toI)   toI.addEventListener("change",   () => { if (state.loadedOnce) loadAsistencias(); });

    // Reaccionar al cambio de base (entrar/salir desde la cabecera).
    // El handler original muta `currentBase` sincronicamente, asi que un re-render
    // en el mismo tick es suficiente.
    const btnEnter = document.getElementById("btnEnterBase");
    const btnExit  = document.getElementById("btnExitBase");
    if (btnEnter) btnEnter.addEventListener("click", () => { if (state.loadedOnce) setTimeout(render, 0); else setBaseHint(); });
    if (btnExit)  btnExit.addEventListener("click",  () => { if (state.loadedOnce) setTimeout(render, 0); else setBaseHint(); });

    // Al cerrar sesion, limpiar el estado en memoria para no exponer datos del
    // usuario anterior a uno nuevo que use la misma pestana.
    const btnLogoutEl = document.getElementById("btnLogout");
    if (btnLogoutEl) btnLogoutEl.addEventListener("click", () => {
      state.rows = [];
      state.loadedOnce = false;
      _baseByName = null;
      const tbody = $("asistenciasBody");
      if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="muted" style="text-align:center;padding:12px">Sin datos. Pulsa "Actualizar" para cargar.</td></tr>`;
      setCount(0);
      setStatus("Sin cargar");
    });

    // Lazy load: cargar al primer click en la pestana Asistencias.
    // Si ya hay datos, re-render por si cambio la base desde la ultima visita.
    document.querySelectorAll('.tab[data-tab="asistencias"]').forEach(tab => {
      tab.addEventListener("click", () => {
        if (!state.loadedOnce && !state.loading) loadAsistencias();
        else if (state.loadedOnce) render();
      });
    });

    // Pintar el hint apenas se vincula, antes de cargar nada.
    setBaseHint();
  }

  // functions.js se carga al final del body: el DOM ya esta listo.
  if (document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", bind);
  } else {
    bind();
  }
})();


/* =====================================================================
   MODULO: Llegadas 104 (lectura de la tabla `llegadas_104` de Supabase)
   Solo lectura. Filtros por rango de fechas sobre `hora_llegada` y
   export a Excel.
   ===================================================================== */
(function bootstrapLlegadas104(){
  const TABLE = "llegadas_104";
  const FETCH_LIMIT = 500;
  // Columnas reales (2026-05-20):
  //   vehicle_id text PK, interno text, itinerario text, posicion int4,
  //   hora_llegada timestamptz, base text, driver_id text, distancia_m int/numeric,
  //   listo bool, ubicacion text, updated_at timestamptz, lat float8, lon float8.
  const SELECT = "*";

  const state = {
    rows: [],
    loading: false,
    loadedOnce: false,
    map: null,
    markersLayer: null,
    activeItin: ""   // "" = Todos. Sino: nombre del itinerario o ITIN_SIN_LLEGADA.
  };

  // Centro por defecto: aeropuerto Jose Maria Cordoba (Rionegro, Antioquia).
  const DEFAULT_CENTER = [6.1645, -75.4231];
  const DEFAULT_ZOOM = 12;

  const $ = (id) => document.getElementById(id);

  function ensureMap(){
    if (state.map) return state.map;
    if (typeof L === "undefined") return null; // Leaflet aun no cargado
    const container = $("mapaAeropuerto");
    if (!container) return null;

    // CSS para el marcador compacto tipo bus con el numero interno.
    if (!document.getElementById("mapaAeropuertoStyles")){
      const style = document.createElement("style");
      style.id = "mapaAeropuertoStyles";
      style.textContent = `
        .bus-pin-wrap { background:transparent !important; border:none !important; }
        .bus-pin {
          position:absolute;
          left:0; top:0;
          transform: translate(-50%, -100%);
          display:flex; align-items:center; gap:4px;
          background: var(--pin, #1d4ed8); color:#fff;
          padding:3px 8px 3px 6px; border-radius:999px;
          font-weight:700; font-size:11px; line-height:1;
          border:1.5px solid #fff;
          box-shadow:0 1px 3px rgba(0,0,0,.45);
          white-space:nowrap;
        }
        .bus-pin svg { display:block; flex:0 0 auto; }
        .bus-pin-num { font-variant-numeric: tabular-nums; letter-spacing:.2px; }
      `;
      document.head.appendChild(style);
    }

    state.map = L.map(container, {
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      scrollWheelZoom: true
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(state.map);
    state.markersLayer = L.layerGroup().addTo(state.map);
    return state.map;
  }

  function syncMarkers(rows){
    const map = ensureMap();
    if (!map || !state.markersLayer) return;
    state.markersLayer.clearLayers();

    const points = [];
    rows.forEach(r => {
      const lat = Number(r.lat);
      const lon = Number(r.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
      if (lat === 0 && lon === 0) return; // descartar coordenadas claramente invalidas
      const interno = String(r.interno == null ? "" : r.interno);
      const esc = (typeof escapeHtml === "function") ? escapeHtml : (v) => String(v == null ? "" : v);
      const listo = r.listo === true;
      const color = listo ? "#16a34a" : "#1d4ed8"; // verde = listo, azul = en espera
      const busSvg = '<svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><path fill="#fff" d="M4 16c0 .88.39 1.67 1 2.22V20c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h8v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4S4 2.5 4 6v10zm3.5 1c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM18 11H6V6h12v5z"/></svg>';
      const icon = L.divIcon({
        className: "bus-pin-wrap",
        html: `<div class="bus-pin" style="--pin:${color}">${busSvg}<span class="bus-pin-num">${esc(interno || "?")}</span></div>`,
        iconSize: [0, 0],
        iconAnchor: [0, 0]
      });
      const m = L.marker([lat, lon], { icon });
      const popupHtml = [
        `<strong>Interno:</strong> ${interno || "-"}`,
        `<strong>Vehiculo:</strong> ${r.vehicle_id || "-"}`,
        `<strong>Itinerario:</strong> ${r.itinerario || "-"}`,
        `<strong>Posicion:</strong> ${r.posicion == null ? "-" : r.posicion}`,
        `<strong>Base:</strong> ${r.base || "-"}`,
        `<strong>Conductor:</strong> ${r.driver_id || "-"}`,
        `<strong>Hora llegada:</strong> ${fmtIsoCompacto(r.hora_llegada) || "-"}`,
        `<strong>Listo:</strong> ${r.listo === true ? "Si" : (r.listo === false ? "No" : "-")}`
      ].join("<br>");
      m.bindPopup(popupHtml);
      m.addTo(state.markersLayer);
      points.push([lat, lon]);
    });

    if (points.length === 1){
      map.setView(points[0], 15);
    } else if (points.length > 1){
      map.fitBounds(L.latLngBounds(points), { padding: [30, 30] });
    }
  }

  function setStatus(msg, isErr = false){
    const color = isErr ? "var(--color-danger, #b91c1c)" : "";
    ["llegadas104Status", "mapaAeropuertoStatus"].forEach(id => {
      const el = $(id);
      if (!el) return;
      el.textContent = msg;
      el.style.color = color;
    });
  }

  function setCount(n){
    const s = String(n);
    ["llegadas104Count", "mapaAeropuertoCount"].forEach(id => {
      const el = $(id);
      if (el) el.textContent = s;
    });
  }

  function splitFechaHora(iso){
    // PostgREST timestamptz -> "2026-05-20T13:38:10.366914+00:00" (normalmente UTC).
    // Convertimos el instante a hora local de Colombia (America/Bogota) para que
    // la HORA mostrada coincida con la realidad y con la columna "HACE".
    if (!iso) return { fecha: "", hora: "" };
    const str = String(iso);
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      try {
        const fecha = new Intl.DateTimeFormat("en-CA", {
          timeZone: "America/Bogota",
          year: "numeric", month: "2-digit", day: "2-digit"
        }).format(d); // YYYY-MM-DD
        const hora = new Intl.DateTimeFormat("en-GB", {
          timeZone: "America/Bogota",
          hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false
        }).format(d); // HH:mm:ss (24h)
        return { fecha, hora };
      } catch (e) {
        // Si Intl/timeZone no esta disponible, caemos al corte de cadena.
      }
    }
    // Fallback: corte de cadena sin conversion (comportamiento anterior).
    const tIdx = str.indexOf("T");
    if (tIdx < 0) return { fecha: str, hora: "" };
    const fecha = str.slice(0, tIdx);
    let resto = str.slice(tIdx + 1);
    const offIdx = resto.search(/[+\-Z]/);
    if (offIdx >= 0) resto = resto.slice(0, offIdx);
    const dotIdx = resto.indexOf(".");
    if (dotIdx >= 0) resto = resto.slice(0, dotIdx);
    return { fecha, hora: resto };
  }

  function fmtCoord(v){
    if (v == null || v === "") return "";
    const n = Number(v);
    if (!Number.isFinite(n)) return String(v);
    return n.toFixed(6);
  }

  function fmtIsoCompacto(iso){
    const { fecha, hora } = splitFechaHora(iso);
    if (!fecha && !hora) return "";
    return `${fecha} ${hora}`.trim();
  }

  function fmtHoraAmPm(hora){
    if (!hora) return "";
    const [hh, mm = "00", ss = "00"] = String(hora).split(":");
    const h = parseInt(hh, 10);
    if (!Number.isFinite(h)) return hora;
    const ampm = h >= 12 ? "p. m." : "a. m.";
    const h12 = ((h + 11) % 12) + 1;
    return `${String(h12).padStart(2,"0")}:${mm}:${ss} ${ampm}`;
  }

  function fmtHace(iso){
    if (!iso) return "";
    const t = Date.parse(iso);
    if (!Number.isFinite(t)) return "";
    const diff = Math.max(0, Date.now() - t);
    const totalMin = Math.floor(diff / 60000);
    if (totalMin < 1) return "hace <1 min";
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    if (h === 0) return `hace ${m} min`;
    return `hace ${h} h ${m} min`;
  }

  const ITIN_SIN_LLEGADA = "__sin_llegada__";

  async function loadLlegadas104(){
    if (state.loading) return;
    if (typeof planillaSupabaseClient === "undefined" || !planillaSupabaseClient){
      setStatus("Cliente Supabase no inicializado.", true);
      return;
    }
    state.loading = true;
    setStatus("Cargando...");
    try {
      const desde = $("llegadas104From") && $("llegadas104From").value;
      const hasta = $("llegadas104To") && $("llegadas104To").value;

      let q = planillaSupabaseClient
        .from(TABLE)
        .select(SELECT)
        .order("hora_llegada", { ascending: false, nullsFirst: false })
        .limit(FETCH_LIMIT);

      if (desde) q = q.gte("hora_llegada", `${desde}T00:00:00`);
      if (hasta) q = q.lte("hora_llegada", `${hasta}T23:59:59.999`);

      const { data, error } = await q;
      if (error) throw error;

      state.rows = Array.isArray(data) ? data : [];
      state.loadedOnce = true;
      // Si el itinerario activo ya no existe en el dataset nuevo, vuelvo a "Todos".
      if (state.activeItin){
        const stillExists = state.rows.some(r => itinKey(r) === state.activeItin);
        if (!stillExists) state.activeItin = "";
      }
      setStatus(`Cargadas ${state.rows.length} (limite ${FETCH_LIMIT}).`);
      render();
    } catch (err){
      console.error("[llegadas_104] error de carga:", err);
      setStatus("Error al cargar: " + (err && err.message ? err.message : "desconocido"), true);
      if (typeof showToast === "function") showToast("No se pudieron cargar las llegadas 104.", "err");
    } finally {
      state.loading = false;
    }
  }

  function posNum(v){
    const n = Number(v);
    return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY;
  }

  function itinKey(r){
    const v = String(r.itinerario || "").trim();
    return v || ITIN_SIN_LLEGADA;
  }

  function itinDisplay(key){
    return key === ITIN_SIN_LLEGADA ? "Sin llegada 104 hoy" : key;
  }

  function getFilteredRows(){
    let rows = state.rows.slice();
    const sel = state.activeItin; // "" = Todos, key concreto, o ITIN_SIN_LLEGADA
    if (sel){
      rows = rows.filter(r => itinKey(r) === sel);
      rows.sort((a, b) => posNum(a.posicion) - posNum(b.posicion));
    } else {
      rows.sort((a, b) => {
        const cmp = itinKey(a).localeCompare(itinKey(b));
        if (cmp !== 0) return cmp;
        return posNum(a.posicion) - posNum(b.posicion);
      });
    }
    return rows;
  }

  function renderChips(){
    const cont = $("lleg104Chips");
    if (!cont) return;
    const counts = state.rows.reduce((acc, r) => {
      const k = itinKey(r);
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {});
    const realItins = Object.keys(counts).filter(k => k !== ITIN_SIN_LLEGADA).sort((a,b) => a.localeCompare(b));
    const allKeys = realItins.concat(counts[ITIN_SIN_LLEGADA] ? [ITIN_SIN_LLEGADA] : []);
    const total = state.rows.length;
    const esc = (typeof escapeHtml === "function") ? escapeHtml : (v) => String(v == null ? "" : v);

    const chipHtml = (key, label, n) => {
      const active = state.activeItin === key ? " active" : "";
      const dataVal = (key || "").replace(/"/g, "&quot;");
      return `<span class="lleg104-chip${active}" data-itin="${dataVal}">${esc(label)} <span class="lleg104-chip-count">${n}</span></span>`;
    };

    cont.innerHTML = chipHtml("", "Todos", total) + allKeys.map(k => chipHtml(k, itinDisplay(k), counts[k])).join("");
  }

  function renderMetrics(rows){
    // rows = filas filtradas por el itinerario activo (o todas si "Todos").
    const total = rows.length;
    const listos = rows.filter(r => r.listo === true).length;
    const espera = total - listos;
    const t = $("lleg104MetricTotal"); if (t) t.textContent = total;
    const l = $("lleg104MetricListos"); if (l) l.textContent = listos;
    const e = $("lleg104MetricEspera"); if (e) e.textContent = espera;
  }

  function render(){
    const tbody = $("llegadas104Body");
    if (!tbody) return;
    renderChips();

    const rows = getFilteredRows();
    renderMetrics(rows);
    setCount(rows.length);
    syncMarkers(rows);

    // Titulo de seccion + contador (refleja el itinerario activo).
    const secName = $("lleg104SectionName");
    const secCount = $("lleg104SectionCount");
    if (secName) secName.textContent = state.activeItin ? itinDisplay(state.activeItin) : "Todos";
    if (secCount) secCount.textContent = String(rows.length);

    if (!state.loadedOnce){
      tbody.innerHTML = `<tr><td colspan="5" class="muted" style="text-align:center;padding:12px">Sin datos. Pulsa "Actualizar" para cargar.</td></tr>`;
      return;
    }
    if (!rows.length){
      tbody.innerHTML = `<tr><td colspan="5" class="muted" style="text-align:center;padding:12px">Sin resultados con los filtros aplicados.</td></tr>`;
      return;
    }

    const esc = (typeof escapeHtml === "function") ? escapeHtml : (v) => String(v == null ? "" : v);
    const showGroupHeaders = !state.activeItin;
    const itinCounts = rows.reduce((acc, r) => { const k = itinKey(r); acc[k] = (acc[k] || 0) + 1; return acc; }, {});

    const html = [];
    let lastItin = null;
    rows.forEach((r, idx) => {
      const ik = itinKey(r);
      if (showGroupHeaders && ik !== lastItin){
        const n = itinCounts[ik] || 0;
        html.push(`<tr class="itin-group-row"><td colspan="5" style="background:#0f172a;color:#fff;font-weight:700;padding:10px 14px;font-size:13px">${esc(itinDisplay(ik))} <span style="opacity:.7;font-weight:500;margin-left:8px">- ${n} bus${n === 1 ? "" : "es"}</span></td></tr>`);
        lastItin = ik;
      }
      const { hora } = splitFechaHora(r.hora_llegada);
      const horaAmPm = fmtHoraAmPm(hora);
      const hace = fmtHace(r.hora_llegada);

      const pos = r.posicion == null ? "" : r.posicion;
      const baseLabel = r.base ? `BASE ${r.base}` : "";
      html.push(`<tr>
        <td><strong>${esc(pos)}</strong></td>
        <td style="white-space:nowrap">${esc(horaAmPm)}</td>
        <td class="muted" style="white-space:nowrap">${esc(hace)}</td>
        <td><strong>${esc(r.interno || "")}</strong></td>
        <td style="white-space:nowrap">${esc(baseLabel)}</td>
      </tr>`);
    });
    tbody.innerHTML = html.join("");
  }

  function exportToExcel(){
    if (typeof XLSX === "undefined"){
      if (typeof showToast === "function") showToast("XLSX no disponible.", "err");
      return;
    }
    // Excel respeta el filtro de itinerario y el orden por posicion.
    const rows = getFilteredRows();
    if (!rows.length){
      if (typeof showToast === "function") showToast("No hay filas para exportar.", "warn");
      return;
    }
    const data = rows.map(r => {
      const { fecha, hora } = splitFechaHora(r.hora_llegada);
      return {
        Fecha: fecha,
        Hora: hora,
        Vehiculo: r.vehicle_id || "",
        Interno: r.interno || "",
        Itinerario: r.itinerario || "",
        Posicion: r.posicion == null ? "" : r.posicion,
        Base: r.base || "",
        Conductor: r.driver_id || "",
        DistanciaM: r.distancia_m == null ? "" : r.distancia_m,
        Listo: r.listo === true ? "SI" : (r.listo === false ? "NO" : ""),
        Ubicacion: r.ubicacion || "",
        Lat: r.lat == null ? "" : r.lat,
        Lon: r.lon == null ? "" : r.lon,
        HoraLlegadaISO: r.hora_llegada || "",
        ActualizadoISO: r.updated_at || ""
      };
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Enturnamiento aeropuerto");
    const fname = (typeof safeFileName === "function" ? safeFileName : (s) => s)(
      `planilla_enturnamiento_aeropuerto_${new Date().toISOString().slice(0,10)}.xlsx`
    );
    XLSX.writeFile(wb, fname);
  }

  function bind(){
    const btnRefresh = $("btnRefreshLlegadas104");
    const btnDownload = $("btnDownloadLlegadas104");
    const fromI = $("llegadas104From");
    const toI = $("llegadas104To");

    const btnRefreshMapa = $("btnRefreshMapaAeropuerto");
    const chipsCont = $("lleg104Chips");

    if (btnRefresh) btnRefresh.addEventListener("click", loadLlegadas104);
    if (btnRefreshMapa) btnRefreshMapa.addEventListener("click", loadLlegadas104);
    if (btnDownload) btnDownload.addEventListener("click", exportToExcel);
    if (fromI) fromI.addEventListener("change", () => { if (state.loadedOnce) loadLlegadas104(); });
    if (toI)   toI.addEventListener("change",   () => { if (state.loadedOnce) loadLlegadas104(); });

    // Click en un chip -> cambia el itinerario activo (sin re-consultar Supabase).
    if (chipsCont){
      chipsCont.addEventListener("click", (ev) => {
        const chip = ev.target.closest(".lleg104-chip");
        if (!chip) return;
        state.activeItin = chip.getAttribute("data-itin") || "";
        render();
      });
    }

    // Lazy load comun para las dos pestanas (planilla y mapa) — comparten
    // `state.rows`. El mapa ademas necesita invalidateSize al hacerse visible
    // (Leaflet no mide bien sobre un contenedor display:none).
    function onPlanillaClick(){
      if (!state.loadedOnce && !state.loading) loadLlegadas104();
    }
    function onMapaClick(){
      if (!state.loadedOnce && !state.loading){
        loadLlegadas104(); // syncMarkers se invoca dentro de render()
      } else {
        setTimeout(() => {
          ensureMap();
          if (state.map) state.map.invalidateSize();
          if (state.loadedOnce) syncMarkers(state.rows);
        }, 50);
      }
    }
    document.querySelectorAll('.tab[data-tab="llegadas-104"]').forEach(tab => tab.addEventListener("click", onPlanillaClick));
    document.querySelectorAll('.tab[data-tab="mapa-aeropuerto"]').forEach(tab => tab.addEventListener("click", onMapaClick));

    // Recarga expuesta para el modulo de Realtime (suscripcion a llegadas_104).
    window.__reloadLlegadas104 = function(){ if (!state.loading) loadLlegadas104(); };

    // Respaldo del Realtime: refresco automatico cada 15s mientras se ve la
    // Planilla de enturnamiento o el Mapa (por si Supabase Realtime no entrega
    // eventos de la tabla llegadas_104). Solo si la pestana esta activa y visible.
    if (!window.__llegadas104PollTimer){
      window.__llegadas104PollTimer = setInterval(() => {
        if (document.hidden) return;
        if (state.loading || !state.loadedOnce) return;
        const viendo = (typeof isTabActive === "function") &&
          (isTabActive("llegadas-104") || isTabActive("mapa-aeropuerto"));
        if (viendo) loadLlegadas104();
      }, 15000);
    }

    // Limpiar estado al cerrar sesion.
    const btnLogoutEl = document.getElementById("btnLogout");
    if (btnLogoutEl) btnLogoutEl.addEventListener("click", () => {
      state.rows = [];
      state.loadedOnce = false;
      state.activeItin = "";
      if (state.markersLayer) state.markersLayer.clearLayers();
      const tbody = $("llegadas104Body");
      if (tbody) tbody.innerHTML = `<tr><td colspan="5" class="muted" style="text-align:center;padding:12px">Sin datos. Pulsa "Actualizar" para cargar.</td></tr>`;
      const chipsCont = $("lleg104Chips");
      if (chipsCont) chipsCont.innerHTML = "";
      renderMetrics([]);
      setCount(0);
      setStatus("Sin cargar");
    });
  }

  if (document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", bind);
  } else {
    bind();
  }
})();


/* =====================================================================
   MODULO: Parque automotor (tabla `parque_automotor` + `parque_documentos`)
   Muestra vehiculos VINCULADOS, por base, con el vencimiento de SOAT,
   Tecnomecanica y Tarjeta de operacion. Las bases pueden EDITAR las fechas
   y subir una foto de cada documento (se guarda en `parque_documentos`,
   tabla aparte que no se pisa al reimportar el CSV).
   La base se deduce del interno con VEHICLE_TO_BASE_MAP (igual que despachos).
   ===================================================================== */
(function bootstrapParqueAutomotor(){
  const TABLE = "parque_automotor";
  const DOCS_TABLE = "parque_documentos";
  const BUCKET = "parque-docs";
  // tipo -> { csv: columna del CSV, venc: campo fecha en docs, foto: campo foto en docs }
  const DOCS = {
    soat:  { csv: "Fecha Vencimiento Soat",          venc: "venc_soat",          foto: "foto_soat" },
    tecno: { csv: "Fecha Vencimiento Tecnomecanica",  venc: "venc_tecnomecanica", foto: "foto_tecnomecanica" },
    oper:  { csv: "Fecha Vencimiento Operacion",      venc: "venc_operacion",     foto: "foto_operacion" }
  };
  const state = { rows: [], docs: new Map(), loading: false, loadedOnce: false, editInterno: null };
  const $ = (id) => document.getElementById(id);
  const esc = (typeof escapeHtml === "function") ? escapeHtml : (v) => String(v == null ? "" : v);

  function val(r, key){ return (r && r[key] != null) ? String(r[key]) : ""; }
  // Nombre de la ruta: usa "Nombre Ruta"; si no, el codigo "Ruta".
  function rutaLabel(r){
    const nombre = val(r, "Nombre Ruta").trim();
    if (nombre) return nombre;
    return val(r, "Ruta").trim();
  }
  function isVinculado(r){
    // Quita todo lo que no sea letra (espacios, NBSP del CSV, tabs, etc.) antes de comparar.
    const s = val(r, "Estado").replace(/[^A-Za-z]/g, "").toUpperCase();
    return s === "VINCULADO"; // excluye DESVINCULADO, NULL y vacios
  }

  function baseLabelOf(r){
    if (typeof resolveVehiculoBase === "function"){
      const b = resolveVehiculoBase({ interno: val(r, "Interno") });
      return (b && b !== "-") ? b : "";
    }
    return "";
  }
  function baseCanonOf(r){
    const lbl = baseLabelOf(r);
    if (!lbl) return "";
    return (typeof getBaseCanonical === "function") ? getBaseCanonical(lbl) : lbl;
  }
  function isAdmin(){ return typeof isSuperAdmin === "function" ? isSuperAdmin() : false; }
  function isOperator(){ return typeof isBaseOperator === "function" && isBaseOperator(); }
  function userBase(){ return (typeof currentUserBase !== "undefined" && currentUserBase) ? String(currentUserBase) : ""; }
  function canEdit(r){ return isAdmin() || (isOperator() && baseCanonOf(r) === userBase()); }
  function getRow(interno){ return state.rows.find(r => val(r, "Interno") === String(interno)); }

  function setStatus(msg, isErr){
    const el = $("parqueStatus"); if (!el) return;
    el.textContent = msg; el.style.color = isErr ? "var(--color-danger,#b91c1c)" : "";
  }
  function setCount(n){ const el = $("parqueCount"); if (el) el.textContent = String(n); }

  // --- Fechas: acepta dd/mm/yyyy (CSV) y yyyy-mm-dd (editado) ---
  function parseFecha(s){
    const str = String(s || "").trim();
    let m = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (m){ const dt = new Date(+m[1], +m[2] - 1, +m[3]); return isNaN(dt.getTime()) ? null : dt; }
    m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (m){ const d = +m[1], mo = +m[2], y = +m[3]; if (!d || !mo || !y || mo > 12 || d > 31) return null; const dt = new Date(y, mo - 1, d); return isNaN(dt.getTime()) ? null : dt; }
    return null;
  }
  function fmtDMY(dt){ return `${String(dt.getDate()).padStart(2,"0")}/${String(dt.getMonth()+1).padStart(2,"0")}/${dt.getFullYear()}`; }
  function toInputDate(raw){ const dt = parseFecha(raw); if (!dt) return ""; return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,"0")}-${String(dt.getDate()).padStart(2,"0")}`; }

  // Valor efectivo: si hay edicion en docs manda esa; si no, la del CSV.
  function effVenc(r, tipo){
    const d = state.docs.get(val(r, "Interno"));
    const edited = d && d[DOCS[tipo].venc];
    if (edited) return String(edited);
    return val(r, DOCS[tipo].csv);
  }
  function fotoUrl(r, tipo){
    const d = state.docs.get(val(r, "Interno"));
    return (d && d[DOCS[tipo].foto]) ? String(d[DOCS[tipo].foto]) : "";
  }

  function docCell(r, tipo){
    const raw = String(effVenc(r, tipo) || "").trim();
    const foto = fotoUrl(r, tipo);
    const link = foto ? ` <a class="parque-foto-link" href="${esc(foto)}" target="_blank" rel="noopener" title="Ver foto">[foto]</a>` : "";
    if (!raw) return `<span class="muted">-</span>${link}`;
    const dt = parseFecha(raw);
    if (!dt) return `<span class="muted">${esc(raw)}</span>${link}`;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const days = Math.round((dt.getTime() - today.getTime()) / 86400000);
    let style, title;
    if (days < 0){ style = "background:#fef2f2;color:#b91c1c;border:1px solid #fecaca;"; title = "vencido"; }
    else if (days <= 30){ style = "background:#fffbeb;color:#b45309;border:1px solid #fde68a;"; title = `vence en ${days} dias`; }
    else { style = "background:#f0fdf4;color:#15803d;border:1px solid #bbf7d0;"; title = "vigente"; }
    return `<span title="${esc(title)}" style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600;${style}">${esc(fmtDMY(dt))}</span>${link}`;
  }

  function populateBaseOptions(){
    const sel = $("parqueBaseFilter");
    const hint = $("parqueBaseHint");
    if (isOperator()){
      if (sel) sel.style.display = "none";
      if (hint) hint.textContent = `Base ${userBase() || "-"}`;
      return;
    }
    if (hint) hint.textContent = "";
    if (!sel) return;
    sel.style.display = "";
    const bases = Array.from(new Set(state.rows.map(baseCanonOf).filter(Boolean)))
      .sort((a, b) => (parseInt(a, 10) || 999) - (parseInt(b, 10) || 999));
    const cur = sel.value;
    sel.innerHTML = '<option value="">Base: todas</option>' + bases.map(b => `<option value="${esc(b)}">Base ${esc(b)}</option>`).join("");
    if (cur) sel.value = cur;
  }

  // Llena el desplegable de rutas con las rutas visibles para el usuario
  // (operador: solo su base; admin: respeta la base seleccionada arriba).
  function populateRutaOptions(){
    const sel = $("parqueRutaFilter");
    if (!sel) return;
    let base = state.rows.slice();
    if (isOperator()){
      const ub = userBase();
      base = base.filter(r => baseCanonOf(r) === ub);
    } else {
      const selBase = (($("parqueBaseFilter") || {}).value || "").trim();
      if (selBase) base = base.filter(r => baseCanonOf(r) === selBase);
    }
    const rutas = Array.from(new Set(base.map(rutaLabel).filter(Boolean)))
      .sort((a, b) => a.localeCompare(b, "es", { numeric: true, sensitivity: "base" }));
    const cur = sel.value;
    sel.innerHTML = '<option value="">Ruta: todas</option>' + rutas.map(r => `<option value="${esc(r)}">${esc(r)}</option>`).join("");
    // Conserva la seleccion si la ruta sigue disponible; si no, vuelve a "todas".
    sel.value = (cur && rutas.indexOf(cur) >= 0) ? cur : "";
  }

  async function loadDocs(){
    state.docs = new Map();
    try {
      const { data, error } = await planillaSupabaseClient.from(DOCS_TABLE).select("*").limit(5000);
      if (error) throw error;
      (Array.isArray(data) ? data : []).forEach(d => { if (d && d.interno != null) state.docs.set(String(d.interno), d); });
    } catch (e){
      // Si la tabla aun no existe, seguimos solo con el CSV (sin romper la vista).
      console.warn("[parque_documentos] no disponible:", e && e.message ? e.message : e);
    }
  }

  async function load(){
    if (state.loading) return;
    if (typeof planillaSupabaseClient === "undefined" || !planillaSupabaseClient){ setStatus("Cliente Supabase no inicializado.", true); return; }
    state.loading = true; setStatus("Cargando...");
    try {
      const { data, error } = await planillaSupabaseClient.from(TABLE).select("*").limit(5000);
      if (error) throw error;
      state.rows = (Array.isArray(data) ? data : []).filter(isVinculado);
      await loadDocs();
      state.loadedOnce = true;
      populateBaseOptions();
      populateRutaOptions();
      setStatus(`Cargados ${state.rows.length} vehiculos vinculados.`);
      render();
    } catch (err){
      console.error("[parque_automotor] error de carga:", err);
      setStatus("Error al cargar: " + (err && err.message ? err.message : "desconocido"), true);
      if (typeof showToast === "function") showToast("No se pudo cargar el parque automotor. Verifica que la tabla 'parque_automotor' exista en Supabase.", "err");
    } finally { state.loading = false; }
  }

  function internoNum(r){ const n = parseInt(String(val(r, "Interno")).replace(/\D/g, ""), 10); return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY; }

  function getFilteredRows(){
    let rows = state.rows.slice();
    if (isOperator()){
      const ub = userBase();
      rows = rows.filter(r => baseCanonOf(r) === ub);
    } else {
      const selBase = (($("parqueBaseFilter") || {}).value || "").trim();
      if (selBase) rows = rows.filter(r => baseCanonOf(r) === selBase);
    }
    const selRuta = (($("parqueRutaFilter") || {}).value || "").trim();
    if (selRuta) rows = rows.filter(r => rutaLabel(r) === selRuta);
    const term = (($("parqueSearch") || {}).value || "").trim().toLowerCase();
    if (term){
      rows = rows.filter(r => ["Interno", "Placa", "Marca", "Modelo", "Clase", "Nombres Propietarios", "Ruta", "Nombre Ruta"]
        .map(k => val(r, k)).join(" | ").toLowerCase().includes(term));
    }
    rows.sort((a, b) => internoNum(a) - internoNum(b));
    return rows;
  }

  function render(){
    const tbody = $("parqueBody"); if (!tbody) return;
    const rows = getFilteredRows();
    setCount(rows.length);
    if (!state.loadedOnce){ tbody.innerHTML = '<tr><td colspan="10" class="muted" style="text-align:center;padding:12px">Sin datos. Pulsa "Actualizar" para cargar.</td></tr>'; return; }
    if (!rows.length){ tbody.innerHTML = '<tr><td colspan="10" class="muted" style="text-align:center;padding:12px">Sin vehiculos para mostrar.</td></tr>'; return; }
    tbody.innerHTML = rows.map(r => {
      const base = baseCanonOf(r);
      const interno = val(r, "Interno");
      // Edicion deshabilitada temporalmente: se muestra "Proximamente".
      const acciones = `<span title="La edicion de documentos se habilitara proximamente" style="display:inline-block;padding:2px 9px;border-radius:999px;font-size:11px;font-weight:600;background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;white-space:nowrap">Proximamente</span>`;
      return `<tr>
        <td><strong>${esc(interno)}</strong></td>
        <td>${esc(val(r, "Placa"))}</td>
        <td>${esc(val(r, "Marca"))}</td>
        <td>${esc(val(r, "Modelo"))}</td>
        <td>${base ? "BASE " + esc(base) : '<span class="muted">-</span>'}</td>
        <td>${rutaLabel(r) ? esc(rutaLabel(r)) : '<span class="muted">-</span>'}</td>
        <td>${docCell(r, "soat")}</td>
        <td>${docCell(r, "tecno")}</td>
        <td>${docCell(r, "oper")}</td>
        <td>${acciones}</td>
      </tr>`;
    }).join("");
    renderVenc();
  }

  // ---------------- Vista: Por renovar / Vencidos ----------------
  const DOC_META = [
    { tipo: "soat",  label: "SOAT",                  icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>' },
    { tipo: "tecno", label: "Tecnomecanica",         icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>' },
    { tipo: "oper",  label: "Tarjeta de operacion",  icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 9h20"/><path d="M6 14h6"/><path d="M16 14h2"/></svg>' }
  ];

  function vencThreshold(){
    const sel = $("parqueVencDias");
    const n = sel ? parseInt(sel.value, 10) : 30;
    return Number.isFinite(n) && n > 0 ? n : 30;
  }

  // Devuelve {vencidos:[], proximos:[]} para un documento, ordenados por urgencia.
  function buildVencList(rows, tipo, limite){
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const vencidos = [], proximos = [];
    rows.forEach(r => {
      const dt = parseFecha(String(effVenc(r, tipo) || "").trim());
      if (!dt) return; // sin fecha registrada -> no entra al tablero
      const days = Math.round((dt.getTime() - today.getTime()) / 86400000);
      const item = { interno: val(r, "Interno"), placa: val(r, "Placa"), base: baseCanonOf(r), ruta: rutaLabel(r), dt, days };
      if (days < 0) vencidos.push(item);
      else if (days <= limite) proximos.push(item);
    });
    vencidos.sort((a, b) => a.days - b.days); // mas vencido primero
    proximos.sort((a, b) => a.days - b.days); // mas proximo primero
    return { vencidos, proximos };
  }

  function pvRow(it, cls){
    const fecha = fmtDMY(it.dt);
    const dias = cls === "bad"
      ? `vencido hace ${Math.abs(it.days)} d`
      : (it.days === 0 ? "vence hoy" : `en ${it.days} d`);
    const baseTxt = it.base ? `BASE ${esc(it.base)}` : "";
    const ruta = it.ruta ? esc(it.ruta) : "-";
    return `<div class="pv-row ${cls}">
      <span class="pv-interno">${esc(it.interno)}</span>
      <span class="pv-placa">${esc(it.placa || "-")}</span>
      <span class="pv-ruta" title="${ruta}">${ruta}</span>
      <span class="pv-base">${baseTxt}</span>
      <span class="pv-fecha ${cls}">${esc(fecha)}<span class="pv-dias">${esc(dias)}</span></span>
    </div>`;
  }

  function renderVenc(){
    const cont = $("parqueVencBody"); if (!cont) return;
    if (!state.loadedOnce){ cont.innerHTML = '<div class="pv-empty">Sin datos. Pulsa "Actualizar" para cargar.</div>'; return; }
    const rows = getFilteredRows();
    const limite = vencThreshold();
    let totalVenc = 0, totalProx = 0;

    cont.innerHTML = DOC_META.map(meta => {
      const { vencidos, proximos } = buildVencList(rows, meta.tipo, limite);
      totalVenc += vencidos.length; totalProx += proximos.length;

      const venSect = vencidos.length
        ? `<div class="pv-sect-title bad">Vencidos · se deben renovar (${vencidos.length})</div>${vencidos.map(it => pvRow(it, "bad")).join("")}`
        : `<div class="pv-sect-title bad">Vencidos (0)</div><div class="pv-empty">Ninguno vencido.</div>`;
      const proxSect = proximos.length
        ? `<div class="pv-sect-title warn">Proximos a renovar · ${limite} dias (${proximos.length})</div>${proximos.map(it => pvRow(it, "warn")).join("")}`
        : `<div class="pv-sect-title warn">Proximos a renovar (0)</div><div class="pv-empty">Ninguno por vencer.</div>`;

      return `<div class="pv-card">
        <div class="pv-head">
          <span class="pv-ico">${meta.icon}</span>
          <span class="pv-title">${esc(meta.label)}</span>
          <span class="pv-counts">
            <span class="pv-pill bad">${vencidos.length} venc.</span>
            <span class="pv-pill warn">${proximos.length} prox.</span>
          </span>
        </div>
        <div class="pv-sect">${venSect}${proxSect}</div>
      </div>`;
    }).join("");

    const resumen = $("parqueVencResumen");
    if (resumen){
      resumen.textContent = totalVenc === 0 && totalProx === 0
        ? "Todo al dia ✓"
        : `${totalVenc} vencidos · ${totalProx} por vencer (en ${limite} dias)`;
    }
  }

  function setParqueView(view){
    const listBtn = $("parqueViewListBtn"), vencBtn = $("parqueViewVencBtn");
    const listWrap = $("parqueListWrap"), vencWrap = $("parqueVencWrap");
    const isVenc = view === "venc";
    if (listWrap) listWrap.classList.toggle("hidden", isVenc);
    if (vencWrap) vencWrap.classList.toggle("hidden", !isVenc);
    if (listBtn) listBtn.classList.toggle("active", !isVenc);
    if (vencBtn) vencBtn.classList.toggle("active", isVenc);
    if (isVenc) renderVenc();
  }

  function exportToExcel(){
    if (typeof XLSX === "undefined"){ if (typeof showToast === "function") showToast("XLSX no disponible.", "err"); return; }
    const rows = getFilteredRows();
    if (!rows.length){ if (typeof showToast === "function") showToast("No hay filas para exportar.", "warn"); return; }
    const data = rows.map(r => ({
      Interno: val(r, "Interno"), Placa: val(r, "Placa"), Marca: val(r, "Marca"), Modelo: val(r, "Modelo"),
      Base: baseCanonOf(r) ? "BASE " + baseCanonOf(r) : "",
      Ruta: rutaLabel(r),
      "Vence SOAT": effVenc(r, "soat"),
      "Vence Tecnomecanica": effVenc(r, "tecno"),
      "Vence T. Operacion": effVenc(r, "oper"),
      "Foto SOAT": fotoUrl(r, "soat"),
      "Foto Tecnomecanica": fotoUrl(r, "tecno"),
      "Foto T. Operacion": fotoUrl(r, "oper")
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Parque automotor");
    const fname = (typeof safeFileName === "function" ? safeFileName : (s) => s)(`parque_automotor_${new Date().toISOString().slice(0, 10)}.xlsx`);
    XLSX.writeFile(wb, fname);
  }

  // ---------------- Edicion (modal) ----------------
  function setDocStatus(msg, isErr){ const el = $("parqueDocStatus"); if (!el) return; el.textContent = msg || ""; el.style.color = isErr ? "var(--color-danger,#b91c1c)" : ""; }

  // Estado de vigencia a partir de un valor de fecha (dd/mm/yyyy o yyyy-mm-dd).
  function vencInfo(raw){
    const dt = parseFecha(String(raw || "").trim());
    if (!dt) return { cls: "is-none", label: "sin fecha" };
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const days = Math.round((dt.getTime() - today.getTime()) / 86400000);
    if (days < 0) return { cls: "is-bad", label: `vencido hace ${Math.abs(days)} dias` };
    if (days === 0) return { cls: "is-bad", label: "vence hoy" };
    if (days <= 30) return { cls: "is-warn", label: `vence en ${days} dias` };
    return { cls: "is-ok", label: "vigente" };
  }

  function applyDocBadge(cardId, badgeId, raw){
    const card = $(cardId), badge = $(badgeId);
    const info = vencInfo(raw);
    if (card){ card.classList.remove("is-ok", "is-warn", "is-bad", "is-none"); card.classList.add(info.cls); }
    if (badge){ badge.classList.remove("is-ok", "is-warn", "is-bad", "is-none"); badge.classList.add(info.cls); badge.textContent = info.label; }
  }

  function setThumb(linkId, thumbId, url){
    const link = $(linkId), thumb = $(thumbId);
    if (thumb) thumb.src = url || "";
    if (link){
      if (url){ link.href = url; link.classList.add("show"); }
      else { link.href = "#"; link.classList.remove("show"); }
    }
  }

  function openModal(interno){
    const r = getRow(interno);
    if (!r) return;
    if (!canEdit(r)){ if (typeof showToast === "function") showToast("No tienes permiso para editar este vehiculo.", "warn"); return; }
    state.editInterno = interno;
    const sub = $("parqueDocSub");
    if (sub){
      const baseTxt = baseCanonOf(r) ? "BASE " + baseCanonOf(r) : "sin base";
      sub.innerHTML =
        `<span class="pdoc-chip">Interno <strong>${esc(String(interno))}</strong></span>` +
        `<span class="pdoc-chip">Placa <strong>${esc(val(r, "Placa") || "-")}</strong></span>` +
        `<span class="pdoc-chip">${esc(baseTxt)}</span>`;
    }
    // [tipo, inputFecha, inputFile, link, thumb, card, badge]
    const map = [
      ["soat",  "docSoatFecha",  "docSoatFoto",  "docSoatLink",  "docSoatThumb",  "pdocSoat",  "docSoatBadge"],
      ["tecno", "docTecnoFecha", "docTecnoFoto", "docTecnoLink", "docTecnoThumb", "pdocTecno", "docTecnoBadge"],
      ["oper",  "docOperFecha",  "docOperFoto",  "docOperLink",  "docOperThumb",  "pdocOper",  "docOperBadge"]
    ];
    map.forEach(([tipo, fId, fileId, linkId, thumbId, cardId, badgeId]) => {
      const raw = effVenc(r, tipo);
      const f = $(fId); if (f) f.value = toInputDate(raw);
      const file = $(fileId); if (file) file.value = "";
      setThumb(linkId, thumbId, fotoUrl(r, tipo));
      applyDocBadge(cardId, badgeId, raw);
    });
    setDocStatus("");
    const modal = $("parqueDocModal"); if (modal) modal.classList.remove("hidden");
  }
  function closeModal(){ const modal = $("parqueDocModal"); if (modal) modal.classList.add("hidden"); state.editInterno = null; }

  async function uploadFoto(interno, tipo, file){
    const extRaw = (file.name && file.name.indexOf(".") >= 0) ? file.name.split(".").pop() : "jpg";
    const ext = String(extRaw || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const path = `${interno}/${tipo}-${Date.now()}.${ext}`;
    const { error } = await planillaSupabaseClient.storage.from(BUCKET).upload(path, file, { upsert: true, contentType: file.type || undefined });
    if (error) throw error;
    const { data } = planillaSupabaseClient.storage.from(BUCKET).getPublicUrl(path);
    return (data && data.publicUrl) ? data.publicUrl : "";
  }

  async function saveModal(){
    const interno = state.editInterno;
    const r = getRow(interno);
    if (!r) return;
    const btn = $("parqueDocSave");
    if (btn) btn.disabled = true;
    setDocStatus("Guardando...");
    try {
      const prev = state.docs.get(String(interno)) || {};
      const rec = {
        interno: String(interno),
        base: baseCanonOf(r),
        venc_soat: ($("docSoatFecha") && $("docSoatFecha").value) || null,
        venc_tecnomecanica: ($("docTecnoFecha") && $("docTecnoFecha").value) || null,
        venc_operacion: ($("docOperFecha") && $("docOperFecha").value) || null,
        foto_soat: prev.foto_soat || null,
        foto_tecnomecanica: prev.foto_tecnomecanica || null,
        foto_operacion: prev.foto_operacion || null,
        actualizado_por: (typeof currentUserEmail !== "undefined" && currentUserEmail) ? currentUserEmail : "",
        actualizado_en: new Date().toISOString()
      };
      // Subir fotos seleccionadas (si hay).
      const uploads = [["soat", "docSoatFoto", "foto_soat"], ["tecno", "docTecnoFoto", "foto_tecnomecanica"], ["oper", "docOperFoto", "foto_operacion"]];
      for (const [tipo, fileId, field] of uploads){
        const fileEl = $(fileId);
        const file = fileEl && fileEl.files && fileEl.files[0];
        if (file){ setDocStatus(`Subiendo foto ${tipo}...`); rec[field] = await uploadFoto(interno, tipo, file); }
      }
      const { error } = await planillaSupabaseClient.from(DOCS_TABLE).upsert(rec, { onConflict: "interno" });
      if (error) throw error;
      state.docs.set(String(interno), rec);
      if (typeof showToast === "function") showToast("Documentos actualizados.", "ok");
      closeModal();
      render();
    } catch (err){
      console.error("[parque_documentos] error al guardar:", err);
      setDocStatus("Error al guardar: " + (err && err.message ? err.message : "desconocido"), true);
      if (typeof showToast === "function") showToast("No se pudo guardar. Revisa que exista la tabla 'parque_documentos' y el bucket 'parque-docs'.", "err");
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  function bind(){
    const btnRefresh = $("btnRefreshParque");
    const btnDownload = $("btnDownloadParque");
    const search = $("parqueSearch");
    const baseSel = $("parqueBaseFilter");
    const rutaSel = $("parqueRutaFilter");
    if (btnRefresh) btnRefresh.addEventListener("click", load);
    if (btnDownload) btnDownload.addEventListener("click", exportToExcel);
    if (search) search.addEventListener("input", () => { if (state.loadedOnce) render(); });
    // Al cambiar la base se recalculan las rutas disponibles y luego se renderiza.
    if (baseSel) baseSel.addEventListener("change", () => { if (state.loadedOnce){ populateRutaOptions(); render(); } });
    if (rutaSel) rutaSel.addEventListener("change", () => { if (state.loadedOnce) render(); });

    const body = $("parqueBody");
    if (body) body.addEventListener("click", (ev) => {
      const btn = ev.target.closest && ev.target.closest(".parque-edit-btn");
      if (btn) openModal(btn.getAttribute("data-interno"));
    });
    const cancel = $("parqueDocCancel"); if (cancel) cancel.addEventListener("click", closeModal);
    const save = $("parqueDocSave"); if (save) save.addEventListener("click", saveModal);
    const modal = $("parqueDocModal"); if (modal) modal.addEventListener("click", (ev) => { if (ev.target === modal) closeModal(); });

    // Badge en vivo al cambiar la fecha + vista previa al elegir foto.
    const live = [
      ["docSoatFecha",  "docSoatFoto",  "docSoatLink",  "docSoatThumb",  "pdocSoat",  "docSoatBadge"],
      ["docTecnoFecha", "docTecnoFoto", "docTecnoLink", "docTecnoThumb", "pdocTecno", "docTecnoBadge"],
      ["docOperFecha",  "docOperFoto",  "docOperLink",  "docOperThumb",  "pdocOper",  "docOperBadge"]
    ];
    live.forEach(([fId, fileId, linkId, thumbId, cardId, badgeId]) => {
      const f = $(fId);
      if (f) f.addEventListener("input", () => applyDocBadge(cardId, badgeId, f.value));
      const file = $(fileId);
      if (file) file.addEventListener("change", () => {
        const sel = file.files && file.files[0];
        if (!sel){ return; }
        const reader = new FileReader();
        reader.onload = (e) => setThumb(linkId, thumbId, e.target.result);
        reader.readAsDataURL(sel);
      });
    });

    // Selector de vista Listado / Por renovar.
    const listBtn = $("parqueViewListBtn"), vencBtn = $("parqueViewVencBtn");
    if (listBtn) listBtn.addEventListener("click", () => setParqueView("list"));
    if (vencBtn) vencBtn.addEventListener("click", () => setParqueView("venc"));
    const vencDias = $("parqueVencDias");
    if (vencDias) vencDias.addEventListener("change", () => { if (state.loadedOnce) renderVenc(); });

    document.querySelectorAll('.tab[data-tab="parque-automotor"]').forEach(tab => tab.addEventListener("click", () => {
      if (!state.loadedOnce && !state.loading) load();
    }));
  }

  if (document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", bind);
  } else {
    bind();
  }
})();






















