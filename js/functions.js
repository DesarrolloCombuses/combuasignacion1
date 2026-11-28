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
// Bases habilitadas para intercambiar la posicion de los vehiculos y sus fichos
// (ademas del super administrador). Para habilitar otra base, agrega su numero.
const VEHICLE_SWAP_BASES = ["3", "4"];
// Bases cuyos conductores tambien quedan disponibles en otra base.
// Clave: base en la que se trabaja. Valor: bases de las que se suman conductores.
// BASE 3 ve ademas los conductores de BASE 5 (vehiculos trasladados de esa base).
const EXTRA_DRIVER_BASES = { "3": ["5"] };

// Bases a las que se avisa, al iniciar sesion, de que ya pueden cambiar los
// carros de posicion. El aviso se muestra una sola vez por usuario y version:
// para volver a mostrarlo, sube SWAP_NOTICE_VERSION.
const SWAP_NOTICE_BASES = ["4"];
const SWAP_NOTICE_VERSION = "2.9.0";
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
// v2.14.1: desde el primer cambio sin guardar, cuanto se espera como mucho a que la persona salga de la casilla.
const TARGET_EDIT_ESPERA_MAX_MS = 4000;
let targetEditPrimerCambio = 0;
let recuperablesTurnos = [];        // [{ k, campo, nombre }]
let estadoGuardadoTurnos = null;    // { tipo: ok|guardando|falta|error, hora }
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
  if (!targetEditPrimerCambio) targetEditPrimerCambio = Date.now();
  savePendingTargetRowsLocally("Pendiente DB nueva", rowsTarget, currentProgramacionIdTarget, currentProgramacionFileNameTarget);
  setSyncStatus("warn", "Pendiente DB nueva");
  if (targetEditSaveTimer) clearTimeout(targetEditSaveTimer);
  const runDeferredSave = async () => {
    targetEditSaveTimer = null;
    // v2.14.1: se espera a que la persona termine de escribir, pero como mucho unos segundos. Antes, con el
    // cursor dentro de una casilla de nombre no se guardaba NUNCA, y si se cerraba la pagina asi se perdia todo.
    if (isTargetTableEditing() && Date.now() - targetEditPrimerCambio < TARGET_EDIT_ESPERA_MAX_MS) {
      targetEditSaveTimer = setTimeout(runDeferredSave, 1000);
      return;
    }
    targetEditPrimerCambio = 0;
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
    if (!AUDIT_DISABLED && isSuperAdmin()) renderAuditLog();
  } catch (refreshError) {
    console.error("No se pudo refrescar desde Supabase:", refreshError);
  }
}

function setAuthStatus(msg, type){
  authStatus.textContent = msg;
  authStatus.className = `auth-status ${type}`;
}

// showToast(msg, tipo, error?): un aviso de error ("err"), o cualquier aviso al
// que se le pase el error, se puede tocar para abrir el reporte copiable.
function showToast(msg, type = "ok", error){
  if (!appToast) return;
  const reportable = type === "err" || (error != null && error !== "");
  const report = reportable ? buildErrorReport(msg, error) : null;
  if (report) {
    lastErrorReport = report;
    console.error(`[${report.ref}] ${msg}`, error ?? "");
  }
  appToast.textContent = msg;
  appToast.onclick = null;
  appToast.onkeydown = null;
  appToast.removeAttribute("role");
  appToast.removeAttribute("tabindex");
  if (report) {
    const cta = document.createElement("span");
    cta.className = "toast-cta";
    cta.textContent = "Toca aqui para ver y copiar el error";
    appToast.appendChild(cta);
    const open = () => {
      clearTimeout(dragFeedbackTimer);
      appToast.className = `toast ${type}`;
      openErrorReportModal(report);
    };
    appToast.onclick = open;
    appToast.onkeydown = (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); open(); } };
    appToast.setAttribute("role", "button");
    appToast.setAttribute("tabindex", "0");
  }
  appToast.className = `toast ${type} show${report ? " toast-action" : ""}`;
  clearTimeout(dragFeedbackTimer);
  // Un error se queda mas tiempo: hay que alcanzar a leerlo y a tocarlo.
  dragFeedbackTimer = setTimeout(() => {
    appToast.className = `toast ${type}`;
  }, report ? 9000 : 2600);
}

function setSyncStatus(type, msg){
  lblSync.textContent = msg;
  lblSync.className = `pill pill-${type}`;
  // v2.14.1: lo mismo, en palabras claras, en la barra de avance de Turnos del dia.
  if (/DB nueva/.test(String(msg || ""))) {
    const texto = String(msg || "");
    estadoGuardadoTurnos = type === "ok"
      ? { tipo: "ok", hora: new Date().toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" }) }
      : /Guardando/i.test(texto) ? { tipo: "guardando" }
      : type === "err" ? { tipo: "error" }
      : /Error/i.test(texto) ? { tipo: "error" } : { tipo: "falta" };
    const chip = document.getElementById("avGuardado");
    if (chip) chip.outerHTML = chipGuardadoTurnos();
    else if (document.querySelector("#avanceTurnos .avance-chips")) {
      document.querySelector("#avanceTurnos .avance-chips").insertAdjacentHTML("beforeend", chipGuardadoTurnos());
    }
  }
  // En rojo, la pildora abre el ultimo error: el aviso flotante se va solo y
  // la pildora es lo que queda a la vista.
  const clickable = type === "err";
  lblSync.classList.toggle("pill-clickable", clickable);
  lblSync.title = clickable ? "Toca para ver y copiar el error" : "";
}

/* ===================== REPORTE DE ERRORES =====================
   Los errores salian en un alert() o en un aviso rojo de 2,6 segundos: no se
   alcanzaban a leer, no se podian copiar y a soporte le llegaba "salio un
   error" sin ningun detalle. Ahora cada error arma un reporte de texto (que
   paso, el mensaje tecnico, donde estaba el usuario, que version corria) que
   se copia con un boton y se pega en el WhatsApp de soporte.
   - reportError(titulo, error, { hint }): abre la ventana del reporte. Para
     errores de acciones del usuario (guardar, asignar, cambiar carro...).
   - showToast(msg, "err", error): aviso rojo que no tapa la pantalla; al
     tocarlo abre el mismo reporte. Para cargas en segundo plano, que pueden
     repetirse cada pocos segundos y no deben abrir una ventana cada vez. */

const ERROR_REPORT_MAX_JUNTOS = 5;
let lastErrorReport = null;
let errorModalReports = [];
let errorModalCopied = false;
let errorModalCloseWarned = false;

function safeErrorValue(fn, fallback = ""){
  try {
    const v = fn();
    return v == null || v === "" ? fallback : v;
  } catch (e) {
    return fallback;
  }
}

function describeBrowserForReport(){
  const ua = navigator.userAgent || "";
  const major = (re) => { const m = ua.match(re); return m ? m[1].split(".")[0] : ""; };
  let nav = "Navegador desconocido";
  if (/Edg\//.test(ua)) nav = `Edge ${major(/Edg\/([\d.]+)/)}`;
  else if (/OPR\//.test(ua)) nav = `Opera ${major(/OPR\/([\d.]+)/)}`;
  else if (/SamsungBrowser\//.test(ua)) nav = `Samsung Internet ${major(/SamsungBrowser\/([\d.]+)/)}`;
  else if (/Chrome\//.test(ua)) nav = `Chrome ${major(/Chrome\/([\d.]+)/)}`;
  else if (/Firefox\//.test(ua)) nav = `Firefox ${major(/Firefox\/([\d.]+)/)}`;
  else if (/Safari\//.test(ua)) nav = `Safari ${major(/Version\/([\d.]+)/)}`;
  let so = "";
  if (/Windows/.test(ua)) so = "Windows";
  else if (/Android/.test(ua)) so = "Android";
  else if (/iPhone|iPad|iPod/.test(ua)) so = "iOS";
  else if (/Mac OS X/.test(ua)) so = "Mac";
  else if (/Linux/.test(ua)) so = "Linux";
  return so ? `${nav} / ${so}` : nav;
}

// Las lineas tecnicas del error. Sirve para Error de JS, errores de Supabase
// (message, code, details, hint) y textos sueltos.
function describeErrorForReport(error){
  if (error == null || error === "") return [];
  if (typeof error === "string") return [`Error: ${error}`];
  const lines = [];
  const message = error.message || error.error_description || error.msg || "";
  let fallback = "";
  if (!message) {
    try { fallback = JSON.stringify(error); } catch (e) { fallback = String(error); }
  }
  lines.push(`Error: ${message || fallback || "sin detalle"}`);
  if (error.name && error.name !== "Error" && !String(message).startsWith(error.name)) lines.push(`Tipo: ${error.name}`);
  if (error.code) lines.push(`Codigo: ${error.code}`);
  if (error.status) lines.push(`Estado HTTP: ${error.status}`);
  if (error.details) lines.push(`Detalle tecnico: ${error.details}`);
  if (error.hint) lines.push(`Pista: ${error.hint}`);
  if (error.stack) {
    // Solo las primeras lineas del rastro, con las URL reducidas al archivo
    // (".../js/functions.js?v=2.9.5:8916:25" -> "functions.js:8916:25").
    const rastro = String(error.stack).split("\n").slice(1, 5)
      .map(l => l.trim().replace(/https?:\/\/[^\s)]*\/([^\/\s?)]+)(?:\?[^\s:)]*)?/g, "$1"))
      .filter(Boolean);
    if (rastro.length) lines.push("Rastro:", ...rastro.map(l => `  ${l}`));
  }
  return lines;
}

function buildErrorReport(title, error, opts = {}){
  const now = new Date();
  const ref = `ERR-${now.getTime().toString(36).toUpperCase().slice(-6)}`;
  const tabName = safeErrorValue(() => document.querySelector(".tab.active")?.textContent.trim(), "-");
  const base = safeErrorValue(() => currentBase ? formatBaseLabel(currentBase) : "", "sin base abierta");
  const fecha = safeErrorValue(() => getActiveSelectedDateISO(), "sin fecha");
  const usuario = safeErrorValue(() => currentUserEmail, "sin sesion");
  const version = safeErrorValue(() => window.APP_CODE_VERSION, "?");
  const hora = safeErrorValue(() => now.toLocaleString("es-CO"), now.toISOString());
  const lines = [
    `*Error en CombuAsigna* (${ref})`,
    `Que paso: ${String(title || "Error sin titulo").trim()}`,
    ...describeErrorForReport(error),
    "",
    `Usuario: ${usuario}`,
    `Base: ${base}`,
    `Pestana: ${tabName}`,
    `Fecha de trabajo: ${fecha}`,
    `Version: ${version}`,
    `Navegador: ${describeBrowserForReport()}`,
    `Conexion: ${navigator.onLine ? "con internet" : "SIN INTERNET"}`,
    `Hora: ${hora}`
  ];
  return {
    ref,
    title: String(title || "Ocurrio un error").trim(),
    hint: String(opts.hint || "").trim(),
    text: lines.join("\n")
  };
}

function reportError(title, error, opts = {}){
  const report = buildErrorReport(title, error, opts);
  lastErrorReport = report;
  console.error(`[${report.ref}] ${report.title}`, error ?? "");
  openErrorReportModal(report);
  return report;
}

function getErrorReportText(){
  return errorModalReports.map(r => r.text).join("\n\n------\n\n");
}

function renderErrorReportModal(){
  const first = errorModalReports[0];
  if (!first) return;
  const titleEl = document.getElementById("errorReportTitle");
  const subEl = document.getElementById("errorReportSub");
  const textEl = document.getElementById("errorReportText");
  const extra = errorModalReports.length - 1;
  if (titleEl) titleEl.textContent = first.title;
  if (subEl) {
    const base = first.hint || "La accion no se completo.";
    subEl.textContent = extra > 0
      ? `${base} Ademas ocurrieron ${extra} error(es) mas; van todos juntos en el reporte.`
      : base;
  }
  if (textEl) {
    textEl.value = getErrorReportText();
    textEl.scrollTop = 0;
  }
}

function setErrorReportStatus(kind, msg){
  const el = document.getElementById("errorReportStatus");
  if (!el) return;
  el.textContent = msg || "";
  el.className = `errrep-status errrep-status-${kind}${msg ? "" : " hidden"}`;
}

function openErrorReportModal(report){
  const modal = document.getElementById("errorReportModal");
  if (!modal) {
    // Sin la ventana (HTML viejo en cache): al menos que se pueda copiar.
    window.prompt("Copia este error y pegalo en el WhatsApp de soporte:", report.text);
    return;
  }
  const isOpen = !modal.classList.contains("hidden");
  if (isOpen) {
    // Ya hay un reporte abierto: el nuevo se suma en vez de reemplazarlo,
    // porque el primero suele ser la causa de los siguientes.
    if (errorModalReports.some(r => r.ref === report.ref)) return;
    if (errorModalReports.length >= ERROR_REPORT_MAX_JUNTOS) return;
    errorModalReports.push(report);
    errorModalCopied = false;
    errorModalCloseWarned = false;
    setErrorReportStatus("info", "");
    const copyBtn = document.getElementById("btnErrorReportCopy");
    if (copyBtn) copyBtn.textContent = "Copiar error";
    renderErrorReportModal();
    return;
  }
  errorModalReports = [report];
  errorModalCopied = false;
  errorModalCloseWarned = false;
  setErrorReportStatus("info", "");
  const copyBtn = document.getElementById("btnErrorReportCopy");
  if (copyBtn) copyBtn.textContent = "Copiar error";
  const closeBtn = document.getElementById("btnErrorReportClose");
  if (closeBtn) closeBtn.textContent = "Cerrar";
  renderErrorReportModal();
  modal.classList.remove("hidden");
  setTimeout(() => copyBtn?.focus(), 0);
}

function closeErrorReportModal(force = false){
  const modal = document.getElementById("errorReportModal");
  if (!modal || modal.classList.contains("hidden")) return;
  if (!force && !errorModalCopied && !errorModalCloseWarned) {
    // Un solo recordatorio: si cierra sin copiar, soporte se queda sin el detalle.
    errorModalCloseWarned = true;
    setErrorReportStatus("warn", "Antes de cerrar, copia el error y envialo por WhatsApp a soporte para que lo podamos revisar.");
    const closeBtn = document.getElementById("btnErrorReportClose");
    if (closeBtn) closeBtn.textContent = "Cerrar sin copiar";
    document.getElementById("btnErrorReportCopy")?.focus();
    return;
  }
  modal.classList.add("hidden");
  errorModalReports = [];
}

async function copyErrorReportText(){
  const text = getErrorReportText();
  const textEl = document.getElementById("errorReportText");
  let ok = false;
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      ok = true;
    }
  } catch (e) {
    ok = false;
  }
  if (!ok && textEl) {
    try {
      textEl.focus();
      textEl.select();
      textEl.setSelectionRange(0, text.length);
      ok = !!document.execCommand("copy");
    } catch (e) {
      ok = false;
    }
  }
  const copyBtn = document.getElementById("btnErrorReportCopy");
  if (ok) {
    errorModalCopied = true;
    if (copyBtn) copyBtn.textContent = "Copiado ✓";
    const closeBtn = document.getElementById("btnErrorReportClose");
    if (closeBtn) closeBtn.textContent = "Cerrar";
    setErrorReportStatus("ok", "Copiado. Ahora pegalo en el WhatsApp de soporte y envialo.");
  } else {
    // No se pudo copiar solo: el texto queda seleccionado para copiarlo a mano.
    if (textEl) { textEl.focus(); textEl.select(); }
    setErrorReportStatus("warn", "No se pudo copiar automaticamente. El texto quedo seleccionado: copialo con Ctrl+C (en el celular, manten presionado y elige Copiar).");
  }
  return ok;
}

function bindErrorReportModal(){
  const modal = document.getElementById("errorReportModal");
  if (!modal || modal.dataset.bound === "1") return;
  modal.dataset.bound = "1";
  document.getElementById("btnErrorReportCopy")?.addEventListener("click", () => { copyErrorReportText(); });
  document.getElementById("btnErrorReportClose")?.addEventListener("click", () => closeErrorReportModal());
  modal.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape") { ev.preventDefault(); closeErrorReportModal(); }
  });
  lblSync?.addEventListener("click", () => {
    if (!lblSync.classList.contains("pill-clickable")) return;
    openErrorReportModal(lastErrorReport || buildErrorReport(lblSync.textContent || "Error", null));
  });
}

bindErrorReportModal();

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
    // Red de seguridad, por si algun camino lo dejara encendido: al volver a la
    // pantalla, si ya no hay temporizador de cierre pendiente, se apaga.
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && !assignmentConfirmModalTimer) {
        hideAssignmentConfirmedModal();
      }
    });
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
  // Se muestra forzando un reflow, NO con requestAnimationFrame: si la pestana
  // esta en segundo plano el navegador congela los rAF, pero no los setTimeout.
  // Antes eso invertia el orden (primero corria el cierre de 1600 ms y despues,
  // al volver a la pestana, el rAF lo volvia a encender) y el velo se quedaba
  // pegado en pantalla sin nadie que lo apagara.
  assignmentConfirmModalEl.style.display = "flex";
  void assignmentConfirmModalEl.offsetHeight;
  assignmentConfirmModalEl.style.opacity = "1";
  if (assignmentConfirmModalTimer) clearTimeout(assignmentConfirmModalTimer);
  assignmentConfirmModalTimer = setTimeout(() => {
    assignmentConfirmModalTimer = null;
    hideAssignmentConfirmedModal();
  }, 1600);
}

// Lo apaga y ademas lo saca de la pantalla con display:none. Antes solo se
// bajaba la opacidad a 0: el nodo seguia cubriendo la pagina y cualquier cosa
// que volviera a subir la opacidad lo dejaba visible para siempre.
function hideAssignmentConfirmedModal(){
  if (assignmentConfirmModalTimer) {
    clearTimeout(assignmentConfirmModalTimer);
    assignmentConfirmModalTimer = null;
  }
  const el = assignmentConfirmModalEl;
  if (!el) return;
  el.style.opacity = "0";
  setTimeout(() => {
    if (assignmentConfirmModalEl === el && el.style.opacity === "0") {
      el.style.display = "none";
    }
  }, 220);
}

function getSwapNoticeStorageKey(){
  const who = currentUserId || currentUserEmail || "anon";
  return `combuses-swap-notice-${SWAP_NOTICE_VERSION}-${who}`;
}

// Solo para operadores de una base listada en SWAP_NOTICE_BASES que ademas
// tenga el permiso real de mover vehiculos, y que no lo hayan visto ya.
function shouldShowSwapEnabledNotice(){
  if (!isBaseOperator()) return false;
  const base = getBaseCanonical(currentUserBase);
  if (!base) return false;
  if (!SWAP_NOTICE_BASES.includes(base)) return false;
  if (!VEHICLE_SWAP_BASES.includes(base)) return false;
  try {
    return localStorage.getItem(getSwapNoticeStorageKey()) !== "1";
  } catch (e) {
    return true;  // sin localStorage se muestra igual: mejor avisar de mas
  }
}

function closeSwapEnabledNotice(){
  const ov = document.getElementById("swapEnabledNotice");
  if (ov) ov.remove();
  try { localStorage.setItem(getSwapNoticeStorageKey(), "1"); } catch (e) {}
}

// Aviso de que la base ya puede intercambiar la posicion de los vehiculos.
function showSwapEnabledModal(){
  if (document.getElementById("swapEnabledNotice")) return;
  const ov = document.createElement("div");
  ov.id = "swapEnabledNotice";
  ov.style.cssText = [
    "position:fixed", "inset:0", "z-index:99998",
    "display:flex", "align-items:center", "justify-content:center",
    "background:rgba(15,23,42,.45)", "padding:16px"
  ].join(";");
  ov.innerHTML = `
    <div style="background:#fff;border-radius:16px;padding:26px 28px;max-width:430px;width:100%;
                box-shadow:0 20px 50px rgba(0,0,0,.3);border-top:6px solid #1e40af;
                font-family:system-ui,Segoe UI,sans-serif;text-align:center">
      <div style="font-size:42px;line-height:1;margin-bottom:8px">&#128666;</div>
      <div style="font-size:13px;font-weight:800;color:#1d4ed8;letter-spacing:.5px;margin-bottom:8px">
        NUEVA FUNCION PARA ${escapeHtml(formatBaseLabel(currentUserBase))}
      </div>
      <div style="font-size:17px;font-weight:800;color:#0f172a;margin-bottom:10px">
        Ya puedes cambiar los carros de posicion
      </div>
      <div style="font-size:14px;color:#334155;line-height:1.5;text-align:left">
        En <strong>Turnos del dia</strong>, arrastra un vehiculo sobre otro para
        intercambiar su posicion. Se te pedira confirmacion antes de aplicar el cambio.
        <ul style="margin:10px 0 0;padding-left:18px">
          <li>El <strong>conductor viaja con el carro</strong> al cambiarlo de puesto.</li>
          <li>Si el origen o el destino es un <strong>FICHO</strong>, el carro se mueve
              pero el ficho queda <strong>sin conductor</strong>.</li>
        </ul>
      </div>
      <button type="button" id="swapNoticeOk"
              style="margin-top:18px;width:100%;padding:11px 16px;border:0;border-radius:10px;
                     background:#1e40af;color:#fff;font-size:14px;font-weight:700;cursor:pointer">
        Entendido
      </button>
    </div>`;
  document.body.appendChild(ov);
  const ok = document.getElementById("swapNoticeOk");
  if (ok) ok.onclick = closeSwapEnabledNotice;
  ov.addEventListener("click", (ev) => {
    if (ev.target === ov) closeSwapEnabledNotice();
  });
  document.addEventListener("keydown", function onEsc(ev){
    if (ev.key !== "Escape") return;
    document.removeEventListener("keydown", onEsc);
    closeSwapEnabledNotice();
  });
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

function canSwapVehiclePositions(){
  return isSuperAdmin() || VEHICLE_SWAP_BASES.includes(getBaseCanonical(currentBase));
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

/* ---------- Datos del arrastre (conductores y vehiculos) ----------
   Cada arrastre propio viaja como JSON en dataTransfer ("text/plain"). Antes
   cada destino hacia JSON.parse(getData(...)) a pelo: si el navegador entregaba
   ese texto vacio al soltar, JSON.parse("") reventaba con "Unexpected end of
   JSON input" y, en Estados del personal, el aviso decia "No se pudo guardar la
   novedad en Supabase" aunque Supabase ni siquiera se habia tocado.
   Ahora el origen guarda ademas una copia en memoria: origen y destino viven en
   la misma pagina, asi que si dataTransfer llega vacio la copia sirve igual.
   readDragPayload nunca lanza: devuelve el objeto o null. */
const DRAG_PAYLOAD_MAX_AGE_MS = 120000;
let activeDragPayload = null;
let activeDragPayloadAt = 0;

function clearDragPayload(){
  activeDragPayload = null;
  activeDragPayloadAt = 0;
}

function setDragPayload(ev, payload){
  activeDragPayload = payload;
  activeDragPayloadAt = Date.now();
  try {
    ev.dataTransfer.setData("text/plain", JSON.stringify(payload));
  } catch (e) {
    console.warn("[arrastre] el navegador no acepto los datos del arrastre:", e?.message || e);
  }
}

function readDragPayload(ev){
  const dt = ev?.dataTransfer;
  const types = Array.from(dt?.types || []);
  let raw = "";
  try { raw = String(dt?.getData("text/plain") || ""); } catch (e) { raw = ""; }
  const memo = activeDragPayload;
  const memoFresh = !!memo && (Date.now() - activeDragPayloadAt) < DRAG_PAYLOAD_MAX_AGE_MS;
  // Se consume al leer: un mismo arrastre no puede servir para dos soltadas.
  clearDragPayload();

  if (raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && parsed.tipo) return parsed;
    } catch (e) {}
    // Texto que no es nuestro (una seleccion, algo de otra aplicacion): no se
    // usa la copia en memoria, porque no corresponde a lo que se solto.
    console.warn("[arrastre] se solto texto que no es un conductor ni un vehiculo:", raw.slice(0, 120));
    return null;
  }

  // dataTransfer llego vacio. Si viene un archivo es algo de fuera de la app;
  // si no, se usa la copia que dejo el origen al empezar el arrastre.
  if (memoFresh && !types.includes("Files")) {
    console.warn("[arrastre] dataTransfer llego vacio; se usa la copia en memoria. Tipos:", types);
    return memo;
  }
  console.warn("[arrastre] se solto algo sin datos reconocibles. Tipos:", types);
  return null;
}

// Todo arrastre nuevo empieza limpio (en captura: corre antes que el
// ondragstart del elemento, que es el que guarda la copia nueva) y la copia
// se descarta al terminar, se haya soltado donde se haya soltado.
document.addEventListener("dragstart", clearDragPayload, true);
document.addEventListener("dragend", clearDragPayload, true);

function autoScrollDuringDrag(clientY){
  // v2.12.0: si la tabla de Turnos del dia tiene su propio scroll (celular), se mueve ella; antes solo se movia la
  // pagina y para llevar un conductor a una fila de abajo habia que soltarlo, bajar y volver a arrastrarlo.
  const vp = document.getElementById("gridViewport2");
  if (vp && vp.offsetParent !== null && vp.scrollHeight > vp.clientHeight + 2) {
    const rc = vp.getBoundingClientRect();
    if (clientY >= rc.top - 10 && clientY <= rc.bottom + 10) {
      const borde = 70;
      if (clientY < rc.top + borde && vp.scrollTop > 0) {
        vp.scrollTop -= Math.max(6, Math.round(((rc.top + borde - clientY) / borde) * 24));
        return;
      }
      if (clientY > rc.bottom - borde && vp.scrollTop + vp.clientHeight < vp.scrollHeight) {
        vp.scrollTop += Math.max(6, Math.round(((clientY - (rc.bottom - borde)) / borde) * 24));
        return;
      }
    }
  }
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
    // Aviso de "ya puedes mover los carros" para las bases recien habilitadas.
    if (shouldShowSwapEnabledNotice()) {
      setTimeout(() => { if (currentUserId) showSwapEnabledModal(); }, 700);
    }
    if(!appInitialized){
      setSyncStatus("warn", "Validando datos...");
      appInitialized = true;
      initializeApp().catch((error) => {
        setSyncStatus("err", "Error inicializando");
        reportError("No se pudo iniciar la aplicacion", error, {
          hint: "Recarga la pagina. Si vuelve a salir, envia este error."
        });
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

/* ---------- Foto de referencia de la DB nueva ----------
   Guarda como se leyeron las filas de la base, para poder distinguir lo que
   ESTE equipo cambio de lo que solo esta de paso en memoria. Hace falta para
   el usuario que trabaja SIN abrir una base (ve todas a la vez): ahi no se
   puede acotar el guardado por base, asi que se acota a lo que de verdad
   cambio. Regla de seguridad: si no hay foto, se considera que todo cambio y
   se escribe todo, que es el comportamiento de siempre -- nunca al reves, para
   que un fallo aqui no deje cambios sin guardar. */
let rowsTargetBaseline = new Map();   // row_key -> contenido tal como se leyo

function rowFingerprint(row){
  return stableStringify(sanitizeRowForStorage(row || {}));
}

// v2.14.1: ademas de la huella, una copia de cada fila tal como se leyo. Sirve para saber, casilla por casilla,
// que cambio ESTE equipo y que cambio otro equipo que guardo despues (ver traerCambiosDeOtrosEquipos).
let rowsTargetBaselineFilas = new Map();   // row_key -> copia de la fila tal como se leyo

function copiaFilaBaseline(row){
  return JSON.parse(JSON.stringify(sanitizeRowForStorage(row || {})));
}

function snapshotTargetRowsBaseline(rowsInput){
  const map = new Map();
  const copias = new Map();
  (Array.isArray(rowsInput) ? rowsInput : []).forEach(row => {
    const key = buildProgramacionRowKey(row);
    if (key) {
      map.set(key, rowFingerprint(row));
      copias.set(key, copiaFilaBaseline(row));
    }
  });
  rowsTargetBaseline = map;
  rowsTargetBaselineFilas = copias;
}

function clearTargetRowsBaseline(){
  rowsTargetBaseline = new Map();
  rowsTargetBaselineFilas = new Map();
}

// Sin foto, todo cuenta como cambiado (se escribe todo, como antes).
function isTargetRowChanged(row){
  if (rowsTargetBaseline.size === 0) return true;
  const key = buildProgramacionRowKey(row);
  if (!key) return true;
  const previo = rowsTargetBaseline.get(key);
  if (previo === undefined) return true;   // fila que no estaba: es nueva
  return previo !== rowFingerprint(row);
}

// Filas que estaban en la base al cargar y ya no estan en memoria: esas si se
// borran. Cualquier otra fila de la base se deja en paz.
function getTargetBaselineRemovedKeys(currentRows){
  if (rowsTargetBaseline.size === 0) return [];
  const presentes = new Set(
    (Array.isArray(currentRows) ? currentRows : [])
      .map(r => buildProgramacionRowKey(r))
      .filter(Boolean)
  );
  const fuera = [];
  rowsTargetBaseline.forEach((_sig, key) => {
    if (!presentes.has(key)) fuera.push(key);
  });
  return fuera;
}

// Tras un guardado confirmado, la foto se pone al dia con lo que quedo escrito;
// si no, las mismas filas se volverian a reenviar en el siguiente guardado.
function updateTargetBaselineAfterSave(rowsWritten, deletedKeys){
  if (rowsTargetBaseline.size === 0) return;
  (Array.isArray(rowsWritten) ? rowsWritten : []).forEach(row => {
    const key = buildProgramacionRowKey(row);
    if (key) {
      rowsTargetBaseline.set(key, rowFingerprint(row));
      rowsTargetBaselineFilas.set(key, copiaFilaBaseline(row));
    }
  });
  (Array.isArray(deletedKeys) ? deletedKeys : []).forEach(key => {
    rowsTargetBaseline.delete(key);
    rowsTargetBaselineFilas.delete(key);
  });
}

// v2.14.1: una base guarda SIEMPRE todas sus filas del dia tal como las tiene en pantalla. Si la misma cuenta
// estaba abierta en otro equipo (otro PC o el celular) y ese otro equipo guardo despues de que este leyo el dia,
// este equipo, con la pantalla vieja, le borraba lo guardado (Base 4, 27-nov: dos PC y un celular a la vez).
// Ahora, antes de escribir, se lee lo guardado: en cada casilla que otro equipo cambio se toma lo guardado; en las
// demas se queda lo de este equipo. Si los dos cambiaron la MISMA casilla, se respeta lo que ya estaba guardado y
// se avisa aqui (este equipo tenia la pantalla vieja). Devuelve cuantas filas y casillas se trajeron, y los choques.
async function traerCambiosDeOtrosEquipos(fechaScope, baseScope){
  const resultado = { filas: 0, casillas: 0, choques: 0 };
  if (!baseScope || !currentProgramacionIdTarget || rowsTargetBaseline.size === 0) return resultado;
  const guardado = await fetchProgramacionRowsFromClient(programacionesTargetClient, currentProgramacionIdTarget, { fecha: fechaScope, base: baseScope });
  if (!guardado?.ok) throw new Error("No se pudo leer lo guardado para compararlo antes de guardar.");
  const filasGuardadas = dedupeProgramacionRows(normalizeProgramacionRows(guardado.rows || []).normalized).rows;
  const enMemoria = new Map();
  rowsTarget.forEach(r => {
    const k = buildProgramacionRowKey(r);
    if (k && !enMemoria.has(k)) enMemoria.set(k, r);
  });
  const igual = (a, b) => stableStringify(a === undefined ? null : a) === stableStringify(b === undefined ? null : b);
  filasGuardadas.forEach(guardada => {
    const k = buildProgramacionRowKey(guardada);
    if (!k) return;
    const huella = rowsTargetBaseline.get(k);
    if (huella !== undefined && huella === rowFingerprint(guardada)) return;   // nadie mas la toco
    const mia = enMemoria.get(k);
    if (!mia) {
      if (huella === undefined) {             // fila que agrego otro equipo
        rowsTarget.push(copiaFilaBaseline(guardada));
        resultado.filas++;
      }
      return;
    }
    const comoSeLeyo = rowsTargetBaselineFilas.get(k);
    if (!comoSeLeyo) return;
    const campos = new Set([...Object.keys(comoSeLeyo), ...Object.keys(mia), ...Object.keys(guardada)]);
    let trajo = false;
    campos.forEach(c => {
      if (c === ROW_UI_ID_KEY) return;
      if (igual(guardada[c], comoSeLeyo[c])) return;   // el otro equipo no la toco: se queda la de este equipo
      if (igual(mia[c], guardada[c])) return;          // los dos pusieron lo mismo
      if (!igual(mia[c], comoSeLeyo[c])) resultado.choques++;   // los dos la cambiaron: se respeta lo guardado
      if (guardada[c] === undefined) delete mia[c];
      else mia[c] = guardada[c];
      trajo = true;
      resultado.casillas++;
    });
    if (trajo) resultado.filas++;
  });
  return resultado;
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
    showToast("No se pudieron cargar las programaciones.", "err", error);
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
      showToast("Cambios pendientes por permisos en Supabase (RLS). Contacta al administrador.", "err", error);
    } else {
      showToast(`Cambios pendientes. Se reintentara al reconectar.${detail ? ` (${detail})` : ""}`, "warn", error);
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
    showToast("No se pudo cargar Estados del personal.", "err", error);
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
// Quien queda FUERA del listado y por que. La app solo puede usar a un conductor
// si en la hoja esta habilitado Y tiene base; quien no cumple las dos cosas
// desaparecia sin dejar rastro, y averiguarlo obligaba a bajar el CSV a mano.
let driversSinBaseAsignada = [];   // habilitados a los que no se les puso base
let driversInactivosCount = 0;     // filas con status distinto de ENABLED
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

// v2.12.0: el ERP (employees, el del Kardex) es el que sabe quien trabaja hoy. La hoja de conductores (la lista de
// Sonar) sigue con retirados habilitados: el 25-nov eran 64 de los 201 que veian las bases. Esos no se le muestran a
// ninguna base; el resumen de la carga dice cuantos y quienes.
const RPC_NO_ACTIVOS_ERP = "afiliados_conductores_no_activos";
const ERP_NO_ACTIVOS_CACHE_KEY = "conductoresNoActivosErpV1";
let driversFueraPorErp = [];   // [{ nombre, base, motivo: "retirado" | "no_esta" }]
let erpRevisionNota = "";      // aviso cuando no se pudo revisar con el ERP
let driversHojaPorBase = {};   // { "3": [{ nombre, cedula }] } los habilitados de la hoja con base, activos o no (historial)

// v2.14.0: los conductores ACTIVOS del ERP salen tambien en la base que dice el ERP. Asi el conductor nuevo sale apenas
// Gestion Humana lo crea en el ERP (sin esperar a que lo creen en Sonar y se refresque la hoja), y el que en Sonar quedo
// sin base o con otra base sale tambien en la suya. No se le quita a nadie la base donde lo tiene la hoja: solo se suma.
const RPC_CONDUCTORES_ERP = "afiliados_conductores_erp";
let driversSumadosErp = [];    // [{ nombre, base, hoja: "no_esta" | "sin_base" | "otra_base" | "deshabilitado", base_hoja }]
let erpSumaNota = "";          // aviso cuando no se pudo traer la lista del ERP

// Devuelve { lista: [{ n, c, b }], nota }. Una cuenta de base recibe solo su base (la 3 tambien la 5); el
// administrador, todas. Si la consulta falla: lista vacia y una nota (quedan solo los de la hoja, como antes).
async function conductoresActivosERP(){
  const cli = (typeof planillaSupabaseClient !== "undefined" && planillaSupabaseClient) ? planillaSupabaseClient : null;
  if (!cli || !currentUserId) return { lista: [], nota: "" };
  try {
    const { data, error } = await cli.rpc(RPC_CONDUCTORES_ERP);
    if (error) throw error;
    const lista = (Array.isArray(data) ? data : [])
      .map(x => ({ n: String(x?.n || "").trim(), c: String(x?.c || "").trim(), b: String(x?.b || "").trim().replace(/^0+/, "") }))
      .filter(x => x.n && /^[1-9]\d*$/.test(x.b));
    return { lista, nota: "" };
  } catch (e) {
    console.warn("[conductores] no se pudo traer los conductores del ERP:", e?.message || e);
    return { lista: [], nota: "No se pudo traer del ERP los conductores de cada base: se muestran solo los de la hoja de conductores." };
  }
}

// Suma a cada base los activos del ERP que la hoja no le muestra. Cada uno se busca en la hoja por cedula y, si no,
// por el nombre (sin tildes y en cualquier orden): si esta, se usa el nombre de la hoja (el mismo de la programacion).
// Cambia porBase, cedulaPorNombre, sinBase y fueraErp; devuelve la lista de los que sumo.
function sumarConductoresDelErp(listaErp, filasHoja, porBase, cedulaPorNombre, sinBase, fueraErp){
  const limpiar = c => String(c || "").replace(/[^0-9A-Za-z]/g, "").toUpperCase();
  // La hoja puede traer a la misma persona en dos filas (una sin base y otra con base): vale la mejor, la habilitada
  // y con base.
  const puntos = f => (f.status === "ENABLED" ? 2 : 0) + (f.base ? 1 : 0);
  const guardar = (mapa, k, f) => { if (k && (!mapa.has(k) || puntos(f) > puntos(mapa.get(k)))) mapa.set(k, f); };
  const porCedula = new Map(), porNombre = new Map();
  filasHoja.forEach(f => {
    const c = limpiar(f.cedula);
    if (c.length >= 5) guardar(porCedula, c, f);
    guardar(porNombre, nameKeyForMatch(f.nombre), f);
  });
  const quitarDeSinBase = nombre => {
    const i = sinBase.findIndex(n => norm(n) === norm(nombre));
    if (i >= 0) sinBase.splice(i, 1);
  };
  const sumados = [];
  (listaErp || []).forEach(e => {
    const c = limpiar(e.c);
    const f = (c.length >= 5 && porCedula.get(c)) || porNombre.get(nameKeyForMatch(e.n)) || null;
    const nombre = f ? f.nombre : e.n;
    const lista = porBase[e.b] || (porBase[e.b] = []);
    if (lista.some(n => norm(n) === norm(nombre))) {           // la hoja ya lo tiene en esa base
      quitarDeSinBase(nombre);                                 // (si tambien tenia una fila sin base, ya no cuenta)
      return;
    }
    lista.push(nombre);
    const k = nameKeyForMatch(nombre);
    if (c.length >= 5 && !cedulaPorNombre.has(k)) cedulaPorNombre.set(k, c);
    quitarDeSinBase(nombre);                                   // ya tiene base: la del ERP
    for (let j = fueraErp.length - 1; j >= 0; j--) {          // el ERP lo tiene activo
      if (norm(fueraErp[j].nombre) === norm(nombre)) fueraErp.splice(j, 1);
    }
    sumados.push({
      nombre, base: e.b,
      hoja: !f ? "no_esta" : (f.status !== "ENABLED" ? "deshabilitado" : (f.base ? "otra_base" : "sin_base")),
      base_hoja: f && f.base ? f.base : ""
    });
  });
  return sumados;
}

// Cuantos de la hoja en esta base (y sus bases extra) no salen en el panel porque en el ERP no estan activos.
function conductoresFueraDelPanel(base){
  const bases = getDriverBasesForBase(base);
  const fuera = new Set();
  (driversFueraPorErp || []).forEach(x => {
    if (x.base && bases.some(b => sameBase(x.base, b))) fuera.add(norm(x.nombre));
  });
  return fuera.size;
}

// Abre Mi base · Historial de conductores (desde el aviso del panel de conductores).
function abrirHistorialConductores(){
  const tab = document.querySelector('.tab[data-tab="novedades-base"]');
  if (!tab || tab.offsetParent === null) return;
  tab.click();
  setTimeout(() => document.querySelector('#nbVistas .nb-vista[data-vista="conductores"]')?.click(), 0);
}

function claveConductorErp(nombre, cedula){
  const c = String(cedula || "").replace(/[^0-9A-Za-z]/g, "").toUpperCase();
  return c.length >= 5 ? c : `N:${nameKeyForMatch(nombre)}`;
}

// Devuelve { mapa: Map(clave -> motivo) con los que NO estan activos en el ERP, nota }. Si la consulta falla usa la
// ultima revision guardada en este navegador; si tampoco hay, mapa = null (se muestran todos y se avisa).
async function conductoresNoActivosERP(lista){
  if (!lista.length) return { mapa: new Map(), nota: "" };
  const cli = (typeof planillaSupabaseClient !== "undefined" && planillaSupabaseClient) ? planillaSupabaseClient : null;
  if (cli && currentUserId) {
    try {
      const { data, error } = await cli.rpc(RPC_NO_ACTIVOS_ERP, {
        p_conductores: lista.map(x => ({ k: x.k, c: x.cedula, n: x.nombre }))
      });
      if (error) throw error;
      const mapa = new Map((Array.isArray(data) ? data : []).map(x => [String(x.k), x.motivo === "no_esta" ? "no_esta" : "retirado"]));
      try {
        localStorage.setItem(ERP_NO_ACTIVOS_CACHE_KEY, JSON.stringify({ en: Date.now(), fuera: Object.fromEntries(mapa) }));
      } catch (e) {}
      return { mapa, nota: "" };
    } catch (e) {
      console.warn("[conductores] no se pudo revisar con el ERP:", e?.message || e);
    }
  }
  try {
    const guardado = JSON.parse(localStorage.getItem(ERP_NO_ACTIVOS_CACHE_KEY) || "null");
    if (guardado && guardado.fuera && typeof guardado.fuera === "object") {
      const cuando = new Date(Number(guardado.en) || 0).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" });
      return {
        mapa: new Map(Object.entries(guardado.fuera)),
        nota: `No se pudo revisar con el ERP quien esta activo; se usa la ultima revision (${cuando}).`
      };
    }
  } catch (e) {}
  return { mapa: null, nota: "No se pudo revisar con el ERP quien esta activo: se muestran todos los habilitados de la hoja." };
}

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
  // Fecha de la pestana activa. Antes se leia <select id="filterDate">, que es
  // el de la base vieja: esta oculto y nunca se llena, asi que la guia se
  // quedaba clavada en el paso 1 y de paso dejaba el buscador deshabilitado.
  const selectedDate = getActiveSelectedDateISO();
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
  const status = getDateStatusForBase(selectedDate, currentBase, getActiveRowsForDrivers());

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
    if (typeof updateNovedadesBaseTabVisibility === "function") updateNovedadesBaseTabVisibility();
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
  if (typeof updateNovedadesBaseTabVisibility === "function") updateNovedadesBaseTabVisibility();
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

// Dias que ya tienen programacion en la DB nueva: catalogo de Supabase mas las
// filas cargadas en memoria. Lo comparten el <select> y el calendario.
function getProgramacionDaySet2(){
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
  return daySet;
}

function refreshFilterDateOptions2(){
  if (!filterDate2) return;
  const prev = filterDate2.value || "";
  const dates = Array.from(getProgramacionDaySet2()).sort((a, b) => a.localeCompare(b));
  filterDate2.innerHTML = `<option value="">Selecciona fecha...</option>`;
  dates.forEach(iso => {
    const op = document.createElement("option");
    op.value = iso;
    op.textContent = excelDateToReadable(iso);
    filterDate2.appendChild(op);
  });
  if (prev && dates.includes(prev)) filterDate2.value = prev;
  renderDateCalendar2();
}

/* ---------- Calendario de fecha (DB nueva) ----------
   Reemplaza visualmente al <select id="filterDate2">, que sigue oculto en el
   DOM como fuente de verdad: al pulsar un dia se escribe su valor y se dispara
   "change", de modo que todo el flujo existente sigue funcionando igual.
   Arranca en el mes en curso y pinta los dias que ya tienen programacion. */
let calendarCursor2 = null;    // primer dia del mes visible
let calendarLastSeen2 = null;  // ultima fecha seleccionada que se dibujo
let calendarGlobalBound2 = false;

function isoFromParts2(year, monthIdx, day){
  return `${year}-${String(monthIdx + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function setCalendarCursorFromIso2(iso){
  const [y, m] = String(iso || "").split("-").map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m)) return;
  calendarCursor2 = new Date(y, m - 1, 1);
}

function renderDateCalendar2(){
  const grid = document.getElementById("cal2Grid");
  const title = document.getElementById("cal2Title");
  if (!grid || !title) return;

  const daySet = getProgramacionDaySet2();
  const selected = normalizeDateToISO(filterDate2?.value || "");
  const todayIso = getLocalIsoDate(new Date());

  // Mes visible: el de la fecha elegida y, si no hay ninguna, el mes en curso.
  if (!calendarCursor2) setCalendarCursorFromIso2(selected || todayIso);
  // Si la fecha cambio desde fuera del calendario, saltar a su mes.
  if (selected && selected !== calendarLastSeen2) setCalendarCursorFromIso2(selected);
  calendarLastSeen2 = selected;

  const year = calendarCursor2.getFullYear();
  const month = calendarCursor2.getMonth();

  const monthLabel = new Date(year, month, 1).toLocaleDateString("es-CO", { month: "long", year: "numeric" });
  title.textContent = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);

  // getDay() devuelve 0=domingo; lo giramos para que la semana empiece en lunes.
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  grid.innerHTML = "";
  for (let i = 0; i < firstWeekday; i++) {
    const filler = document.createElement("span");
    filler.className = "cal2-day is-empty";
    grid.appendChild(filler);
  }

  let conProgramacion = 0;
  let ultimoDiaConProgramacion = 0;
  for (let day = 1; day <= daysInMonth; day++) {
    const iso = isoFromParts2(year, month, day);
    const tieneProgramacion = daySet.has(iso);
    if (tieneProgramacion) {
      conProgramacion++;
      ultimoDiaConProgramacion = day;
    }

    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = `cal2-day ${tieneProgramacion ? "is-on" : "is-off"}`;
    if (iso === todayIso) cell.classList.add("is-today");
    if (iso && iso === selected) cell.classList.add("is-selected");
    cell.textContent = String(day);
    cell.disabled = !tieneProgramacion;
    cell.title = tieneProgramacion
      ? `Ver programacion del ${excelDateToReadable(iso)}`
      : `Sin programacion cargada el ${excelDateToReadable(iso)}`;
    if (tieneProgramacion) {
      cell.onclick = () => {
        if (!filterDate2) return;
        // El <select> solo acepta un valor que exista como <option>. Normalmente
        // ya esta (ambos salen del mismo catalogo), pero si faltara se agrega
        // para que el clic nunca quede sin efecto.
        if (!Array.from(filterDate2.options).some(op => op.value === iso)) {
          const op = document.createElement("option");
          op.value = iso;
          op.textContent = excelDateToReadable(iso);
          filterDate2.appendChild(op);
        }
        filterDate2.value = iso;
        setCalendarCursorFromIso2(iso);
        setCalendar2Open(false);   // elegir un dia cierra el calendario
        filterDate2.dispatchEvent(new Event("change"));
        renderDateCalendar2();
      };
    }
    grid.appendChild(cell);
  }

  // Texto del boton: la fecha elegida se ve sin abrir el calendario.
  const triggerText = document.getElementById("cal2TriggerText");
  if (triggerText) {
    triggerText.textContent = selected ? excelDateToReadable(selected) : "Selecciona fecha...";
  }

  const ultimoIso = ultimoDiaConProgramacion
    ? excelDateToReadable(isoFromParts2(year, month, ultimoDiaConProgramacion))
    : "";
  const hint = document.getElementById("cal2Hint");
  if (hint) {
    hint.textContent = conProgramacion === 0
      ? "Sin programacion este mes."
      : `Programacion hasta el ${ultimoIso}.`;
  }
  const status = document.getElementById("cal2Status");
  if (status) {
    status.textContent = conProgramacion === 0
      ? "Sin programacion en este mes."
      : `${conProgramacion} dia(s) cargado(s).`;
  }

  // onclick (no addEventListener) para no acumular handlers en cada repintado.
  const btnPrev = document.getElementById("cal2Prev");
  const btnNext = document.getElementById("cal2Next");
  const btnToday = document.getElementById("cal2Today");
  const trigger = document.getElementById("cal2Trigger");
  if (btnPrev) btnPrev.onclick = () => {
    calendarCursor2 = new Date(year, month - 1, 1);
    renderDateCalendar2();
  };
  if (btnNext) btnNext.onclick = () => {
    calendarCursor2 = new Date(year, month + 1, 1);
    renderDateCalendar2();
  };
  if (btnToday) btnToday.onclick = () => {
    setCalendarCursorFromIso2(getLocalIsoDate(new Date()));
    renderDateCalendar2();
  };
  if (trigger) trigger.onclick = (ev) => {
    ev.stopPropagation();
    setCalendar2Open(!isCalendar2Open());
  };
  bindCalendar2GlobalEvents();
  // Cambiar de mes puede cambiar el alto (5 o 6 filas): recolocar si esta abierto.
  if (isCalendar2Open()) positionCalendar2Pop();
}

function isCalendar2Open(){
  const pop = document.getElementById("cal2Pop");
  return !!(pop && !pop.hidden);
}

function setCalendar2Open(open){
  const pop = document.getElementById("cal2Pop");
  const wrap = document.getElementById("dateCalendar2");
  const trigger = document.getElementById("cal2Trigger");
  if (!pop || !wrap) return;
  pop.hidden = !open;
  wrap.classList.toggle("is-open", !!open);
  if (trigger) trigger.setAttribute("aria-expanded", open ? "true" : "false");
  if (open) positionCalendar2Pop();
}

/* Coloca el panel pegado al boton usando coordenadas de pantalla. Se abre hacia
   abajo; si ahi no cabe completo y arriba hay mas sitio, se abre hacia arriba.
   Si tampoco cabe entero (pantallas muy bajas) se le deja scroll propio, pero
   nunca queda cortado ni por la ventana ni por un contenedor con overflow. */
function positionCalendar2Pop(){
  const pop = document.getElementById("cal2Pop");
  const trigger = document.getElementById("cal2Trigger");
  if (!pop || pop.hidden || !trigger) return;

  const MARGEN = 8;   // aire contra el borde de la pantalla
  const SEP = 6;      // separacion entre el boton y el panel
  const ALTO_MIN = 180;

  // Medir el alto natural: hay que soltar el max-height de una apertura previa.
  pop.style.maxHeight = "";
  const boton = trigger.getBoundingClientRect();
  const anchoVista = document.documentElement.clientWidth;
  const altoVista = document.documentElement.clientHeight;
  const altoNatural = pop.offsetHeight;
  const ancho = pop.offsetWidth;

  const espacioAbajo = altoVista - boton.bottom - SEP - MARGEN;
  const espacioArriba = boton.top - SEP - MARGEN;
  const haciaArriba = altoNatural > espacioAbajo && espacioArriba > espacioAbajo;

  const disponible = Math.max(haciaArriba ? espacioArriba : espacioAbajo, ALTO_MIN);
  const alto = Math.min(altoNatural, disponible);
  pop.style.maxHeight = `${alto}px`;

  let left = boton.left;
  if (left + ancho > anchoVista - MARGEN) left = anchoVista - MARGEN - ancho;
  if (left < MARGEN) left = MARGEN;

  const top = haciaArriba ? boton.top - SEP - alto : boton.bottom + SEP;

  pop.style.left = `${Math.round(left)}px`;
  pop.style.top = `${Math.round(Math.max(MARGEN, top))}px`;
}

// Cerrar al pulsar fuera del calendario o con Escape. Se registra una sola vez.
function bindCalendar2GlobalEvents(){
  if (calendarGlobalBound2) return;
  calendarGlobalBound2 = true;
  document.addEventListener("click", (ev) => {
    if (!isCalendar2Open()) return;
    const wrap = document.getElementById("dateCalendar2");
    if (wrap && !wrap.contains(ev.target)) setCalendar2Open(false);
  });
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape" && isCalendar2Open()) setCalendar2Open(false);
  });
  // El panel va en coordenadas de pantalla: si el boton se mueve hay que
  // seguirlo. El scroll se escucha en captura para enterarse tambien del que
  // ocurre dentro de contenedores (la tabla, el panel de la pestana).
  window.addEventListener("resize", () => {
    if (isCalendar2Open()) positionCalendar2Pop();
  });
  window.addEventListener("scroll", () => {
    if (isCalendar2Open()) positionCalendar2Pop();
  }, true);
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
  // La foto anterior deja de valer en cuanto se recarga: se limpia al entrar y
  // se vuelve a tomar si la carga llega a buen puerto.
  clearTargetRowsBaseline();
  recuperablesTurnos = [];
  estadoGuardadoTurnos = null;
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
  // La foto se toma ANTES de sanear los FICHO: asi, si el saneo cambia algo,
  // ese cambio se detecta y se guarda como cualquier otra edicion.
  snapshotTargetRowsBaseline(rowsTarget);
  {
    const { key1, key2 } = getConductorKeysFromArray(rowsTarget);
    sanitizeFichoConductorSlots(rowsTarget, key1, key2);
  }
  currentProgramacionIdTarget = latestProgramacionId || null;
  recuperablesTurnos = buscarAsignacionesSinGuardar(dateIso);

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
  clearTargetRowsBaseline();
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
  snapshotTargetRowsBaseline(rowsTarget);
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
  // Solo se escriben las filas de la base que esta abierta. La tabla nada mas
  // deja editar esas (renderTable2 filtra por currentBase), pero en memoria
  // esta el dia COMPLETO de todas las bases, y antes se reenviaba entero: el
  // guardado de una base repetia su foto vieja encima de lo que otra base
  // acababa de asignar y lo dejaba "como estaba antes". Acotando el ambito,
  // cada base escribe y borra unicamente lo suyo y ya no se pisan entre si.
  const baseScope = getBaseCanonical(currentBase);
  // v2.14.1: antes de escribir la base entera se traen los cambios que otro equipo guardo despues (si falla la
  // lectura no se escribe nada: queda pendiente y se reintenta, mejor que pisar lo de otro).
  let traidos = { filas: 0, casillas: 0, choques: 0 };
  if (baseScope) {
    try {
      traidos = await traerCambiosDeOtrosEquipos(fechaScope, baseScope);
    } catch (lecturaError) {
      console.error("No se pudo comparar con lo guardado antes de guardar:", lecturaError?.message || lecturaError);
      savePendingTargetRowsLocally("Error de sincronizacion (DB nueva)", rowsTarget, currentProgramacionIdTarget, currentProgramacionFileNameTarget);
      setSyncStatus("warn", "Pendiente DB nueva");
      showToast("Guardado local pendiente de confirmacion en DB nueva.", "warn", lecturaError);
      scheduleTargetSyncRetry(reason);
      syncRowsInProgressTarget = false;
      return false;
    }
  }
  const rowsEnAmbito = Array.isArray(rowsTarget)
    ? rowsTarget.filter(r =>
        (!fechaScope || getRowDateISO(r, rowsTargetFechaKey) === fechaScope) &&
        (!baseScope || getRowCanonicalBase(r) === baseScope))
    : [];
  // Sin base abierta (un administrador que ve todas a la vez) no hay ambito que
  // acotar, asi que se escribe solo lo que cambio en ESTE equipo, comparado con
  // la foto de como se leyo la programacion. Y se borra unicamente lo que
  // estaba al cargar y ya no esta: nunca por diferencia contra el envio, que
  // arrasaria con las filas que otros estan editando.
  const soloCambios = !baseScope;
  const rowsToPersist = soloCambios ? rowsEnAmbito.filter(isTargetRowChanged) : rowsEnAmbito;
  const deleteKeys = soloCambios ? getTargetBaselineRemovedKeys(rowsTarget) : null;
  try {
    if (soloCambios && rowsToPersist.length === 0 && deleteKeys.length === 0) {
      // Nada que escribir: no hay por que tocar la base.
      clearPendingTargetRowsLocal();
      setSyncStatus("ok", "Confirmado DB nueva");
      pendingAssignmentConfirmations = [];
      return true;
    }
    const rowsSyncResult = await syncProgramacionRowsTableWithClient(
      programacionesTargetClient,
      currentProgramacionIdTarget,
      rowsToPersist,
      targetAuth.userId,
      { fecha: fechaScope, base: baseScope, ...(deleteKeys ? { deleteKeys } : {}) }
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

    const verifyRowsResult = await fetchProgramacionRowsFromClient(programacionesTargetClient, currentProgramacionIdTarget, { fecha: fechaScope, base: baseScope });
    if (!verifyRowsResult?.ok) {
      throw new Error("No se pudo verificar programacion_filas en DB nueva.");
    }
    let ok;
    if (soloCambios) {
      // La base tiene mas filas de las que se enviaron (las que no se tocaron),
      // asi que no sirve comparar el conjunto entero: se comprueba que cada
      // fila escrita quedo tal cual y que las borradas ya no estan.
      const actualPorClave = new Map();
      (verifyRowsResult.rows || []).forEach(r => {
        const k = buildProgramacionRowKey(r);
        if (k) actualPorClave.set(k, rowFingerprint(r));
      });
      const escritasOk = rowsToPersist.every(r => actualPorClave.get(buildProgramacionRowKey(r)) === rowFingerprint(r));
      const borradasOk = deleteKeys.every(k => !actualPorClave.has(k));
      ok = escritasOk && borradasOk;
      if (!ok) {
        throw new Error(`Diferencia detectada en DB nueva (${rowsToPersist.length} fila(s) enviada(s), ${deleteKeys.length} borrada(s)).`);
      }
    } else {
      ok = rowsSignature(rowsToPersist) === rowsSignature(verifyRowsResult.rows || []);
      if (!ok) {
        throw new Error(`Diferencia detectada en DB nueva (${(verifyRowsResult.rows || []).length}/${rowsToPersist.length} filas).`);
      }
    }
    // Lo confirmado pasa a ser la nueva foto de referencia.
    updateTargetBaselineAfterSave(rowsToPersist, deleteKeys || []);
    clearPendingTargetRowsLocal();
    setSyncStatus("ok", "Confirmado DB nueva");
    showToast(`${reason} (confirmado)`, "ok");
    // v2.14.1: si se trajeron cambios de otro equipo, se pintan y se avisa (la pantalla de este equipo estaba vieja).
    if (traidos.filas > 0) {
      renderTable2();
      renderDrivers();
      showToast(traidos.choques > 0
        ? `Otro equipo con esta misma cuenta ya había llenado ${traidos.choques} casilla(s) que usted también cambió: se dejó lo que estaba guardado. Revise la tabla. Use un solo equipo por base.`
        : `Se sumaron ${traidos.casillas} cambio(s) que se guardaron desde otro equipo con esta misma cuenta. Use un solo equipo por base.`, "warn");
    }
    // Aviso visible y veraz: el dato ya quedo verificado en la base de datos. Si la persona sigue escribiendo en
    // una casilla (v2.14.1 ya guarda aunque el cursor siga ahi) no se le tapa la pantalla: basta el aviso de abajo.
    // Si hubo choques no se muestra: alguna de esas asignaciones no quedo.
    if (pendingAssignmentConfirmations.length > 0) {
      if (!isTargetTableEditing() && !traidos.choques) showAssignmentConfirmedModal(pendingAssignmentConfirmations.slice());
      pendingAssignmentConfirmations = [];
    }
    return true;
  } catch (error) {
    console.error("No se pudo guardar en DB nueva:", error?.message || error, error?.code || "");
    // La copia pendiente guarda rowsTarget COMPLETO, no el subconjunto que se
    // acaba de intentar escribir: al recuperarla se repone rowsTarget tal cual,
    // y dejarla recortada por fecha o por base borraria de memoria el resto del
    // dia y las demas bases.
    savePendingTargetRowsLocally("Error de sincronizacion (DB nueva)", rowsTarget, currentProgramacionIdTarget, currentProgramacionFileNameTarget);
    setSyncStatus("warn", "Pendiente DB nueva");
    // El cambio no se pierde (queda en este equipo y se reintenta), pero el
    // error se adjunta: si se repite, soporte necesita saber por que.
    showToast("Guardado local pendiente de confirmacion en DB nueva.", "warn", error);
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

/* ---------- Turnos del dia mas claro (v2.12.0) ----------
   Barra de avance, asignar con un toque (conductor del panel -> casilla vacia), "solo lo que falta" y "siguiente
   vacia". Todo sale de lo que se ve en la tabla (#grid2): las casillas con conductor (td.drop.filled), las vacias con
   nota (td.drop.con-nota) y las vacias sin nada. */
let conductorElegido = null;     // conductor tocado en el panel, esperando la casilla
let soloFaltanTurnos = false;    // "Ver solo lo que falta"
let ultimaVaciaMostrada = null;  // para que "Ir a la siguiente vacia" avance

function marcarFilaTurnos(tr){
  if (!tr) return;
  const falta = [...tr.querySelectorAll("td.drop")].some(td => !td.classList.contains("filled") && !td.classList.contains("con-nota"));
  tr.classList.toggle("fila-completa", !falta);
  tr.classList.toggle("fila-falta", falta);
}

function elegirConductor(nombre){
  conductorElegido = (conductorElegido === nombre) ? null : nombre;
  pintarEleccionConductor();
}

function soltarConductorElegido(){
  if (!conductorElegido) return;
  conductorElegido = null;
  pintarEleccionConductor();
}

function pintarEleccionConductor(){
  document.querySelectorAll("#driversList .driver-item").forEach(d => d.classList.toggle("elegido", d.dataset.nombre === conductorElegido));
  const grid = document.getElementById("grid2");
  if (grid) grid.classList.toggle("eligiendo", !!conductorElegido);
  const aviso = document.getElementById("avisoElegido");
  if (aviso) {
    aviso.hidden = !conductorElegido;
    aviso.innerHTML = conductorElegido
      ? `<span>Va a poner a <b>${escapeHtml(conductorElegido)}</b>: toque la casilla <b>sin conductor</b> donde va.</span>`
        + `<button type="button" id="avisoElegidoCancelar">Cancelar</button>`
      : "";
  }
}

/* ---------- v2.14.1: lo que quedo sin guardar en este equipo ----------
   Cada cambio deja una copia en este navegador hasta que la base de datos lo confirma. Si la pagina se cerro antes
   (o la base de datos no respondio), esa copia quedaba escondida: al volver, el dia salia vacio. Ahora, al abrir el
   dia, se buscan en esa copia los conductores que no alcanzaron a guardarse en casillas que siguen vacias, y se
   ofrece recuperarlos. Nunca se pisa una casilla que ya tiene a alguien guardado. */

function buscarAsignacionesSinGuardar(dateIso){
  const pendiente = readPendingTargetRowsLocal();
  if (!pendiente || !Array.isArray(pendiente.rows_data) || !pendiente.rows_data.length || !dateIso) return [];
  if (pendiente.programacion_id && currentProgramacionIdTarget
      && String(pendiente.programacion_id) !== String(currentProgramacionIdTarget)) return [];
  const base = getBaseCanonical(currentBase);
  const fechaKeyPend = getFechaKeyFromArray(pendiente.rows_data);
  const fechaKeyAct = getFechaKeyFromArray(rowsTarget);
  const { key1, key2 } = getConductorKeysFromArray(rowsTarget);
  const campos = [key1, key2].filter(Boolean);
  if (!campos.length) return [];
  const actuales = new Map();
  const yaPuestos = new Set();
  rowsTarget.forEach(r => {
    if (getRowDateISO(r, fechaKeyAct) !== dateIso) return;
    if (base && getRowCanonicalBase(r) !== base) return;
    const k = buildProgramacionRowKey(r);
    if (k) actuales.set(k, r);
    campos.forEach(c => { const n = extractConductorName(r[c] || ""); if (n) yaPuestos.add(norm(n)); });
  });
  const salida = [];
  pendiente.rows_data.forEach(p => {
    if (getRowDateISO(p, fechaKeyPend) !== dateIso) return;
    if (base && getRowCanonicalBase(p) !== base) return;
    const k = buildProgramacionRowKey(p);
    const actual = k ? actuales.get(k) : null;
    if (!actual || isFichoRowByContent(actual)) return;
    campos.forEach(c => {
      const nombre = extractConductorName(p[c] || "");
      if (!nombre || yaPuestos.has(norm(nombre))) return;
      if (extractConductorName(actual[c] || "")) return;     // ya tiene a alguien guardado: no se pisa
      yaPuestos.add(norm(nombre));
      salida.push({ k, campo: c, nombre });
    });
  });
  return salida;
}

function recuperarAsignacionesSinGuardar(){
  const lista = recuperablesTurnos.slice();
  recuperablesTurnos = [];
  const porClave = new Map();
  rowsTarget.forEach(r => { const k = buildProgramacionRowKey(r); if (k && !porClave.has(k)) porClave.set(k, r); });
  let puestos = 0;
  lista.forEach(x => {
    const r = porClave.get(x.k);
    if (!r || extractConductorName(r[x.campo] || "")) return;
    r[x.campo] = x.nombre;
    setConductorNote(r, x.campo, "");
    puestos++;
  });
  renderTable2();
  renderDrivers();
  if (puestos > 0) {
    scheduleTargetEditSave(`${puestos} conductor(es) recuperado(s) y guardado(s) en DB nueva.`);
    showToast(`Se recuperaron ${puestos} conductor(es). Guardando...`, "ok");
  }
}

function descartarAsignacionesSinGuardar(){
  recuperablesTurnos = [];
  clearPendingTargetRowsLocal();
  pintarAvanceTurnos();
}

function hayTurnosSinGuardar(){
  return !!targetEditSaveTimer || syncRowsInProgressTarget || syncRowsPendingTarget || !!syncRetryTimerTarget;
}

function chipGuardadoTurnos(){
  const e = estadoGuardadoTurnos;
  if (!e) return "";
  const txt = e.tipo === "ok" ? `&#10003; Guardado${e.hora ? " " + e.hora : ""}`
    : e.tipo === "guardando" ? "Guardando&hellip;"
    : e.tipo === "error" ? "&#9888; No se pudo guardar: se reintenta"
    : "&#9888; Falta guardar";
  const clase = e.tipo === "ok" ? "av-ok" : e.tipo === "guardando" ? "av-info" : e.tipo === "error" ? "av-falta" : "av-nota";
  return `<span class="av-chip av-guardado ${clase}" id="avGuardado">${txt}</span>`;
}

function pintarAvanceTurnos(){
  const caja = document.getElementById("avanceTurnos");
  if (!caja || !gridBody2) return;
  const celdas = [...gridBody2.querySelectorAll("td.drop")];
  const fecha = normalizeDateToISO(filterDate2?.value || "");
  if (!currentBase || !fecha || !celdas.length) {
    caja.hidden = true;
    soltarConductorElegido();
    return;
  }
  const total = celdas.length;
  const conConductor = celdas.filter(td => td.classList.contains("filled")).length;
  const conNota = celdas.filter(td => td.classList.contains("con-nota")).length;
  const faltan = total - conConductor - conNota;
  const libres = getAvailableDriversForBase(getBaseCanonical(currentBase));
  if (conductorElegido && !libres.includes(conductorElegido)) conductorElegido = null;
  const listas = conConductor + conNota;
  const pct = total ? Math.round((listas / total) * 100) : 100;
  caja.hidden = false;
  caja.classList.toggle("completo", faltan === 0);
  caja.innerHTML =
    `<div class="avance-num"><b>${listas}</b> de ${total} casillas listas</div>`
    + `<div class="avance-barra" role="progressbar" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${listas}"><span style="width:${pct}%"></span></div>`
    + `<div class="avance-acciones">`
    +   `<label class="av-solo"><input type="checkbox" id="avSoloFaltan"${soloFaltanTurnos ? " checked" : ""}> Ver solo lo que falta</label>`
    +   `<button type="button" class="av-btn" id="avSiguiente"${faltan ? "" : " disabled"}>Ir a la siguiente vacía &#8595;</button>`
    + `</div>`
    + `<div class="avance-chips">`
    +   `<span class="av-chip av-ok">${conConductor} con conductor</span>`
    +   (faltan ? `<span class="av-chip av-falta">${faltan} sin conductor</span>` : `<span class="av-chip av-ok">Ninguna vacía</span>`)
    +   (conNota ? `<span class="av-chip av-nota">${conNota} con nota (taller, etc.)</span>` : "")
    +   `<span class="av-chip av-info">${libres.length} ${libres.length === 1 ? "conductor" : "conductores"} sin ubicar</span>`
    +   chipGuardadoTurnos()
    + `</div>`
    + (recuperablesTurnos.length
        ? `<div class="aviso-recuperar" id="avisoRecuperar"><span>En este equipo quedaron <b>${recuperablesTurnos.length}</b> `
          + `${recuperablesTurnos.length === 1 ? "conductor" : "conductores"} de este d&iacute;a <b>sin guardar</b>.</span>`
          + `<span class="ar-botones"><button type="button" id="btnRecuperarTurnos">Recuperarlos</button>`
          + `<button type="button" id="btnDescartarTurnos" class="ar-sec">Descartar</button></span></div>`
        : "")
    + `<div class="aviso-elegido" id="avisoElegido" hidden></div>`;
  const grid = document.getElementById("grid2");
  if (grid) grid.classList.toggle("solo-faltan", soloFaltanTurnos);
  pintarEleccionConductor();
  const tab = document.getElementById("tab-programacion2");
  if (tab) tab.style.setProperty("--av-alto", `${caja.offsetHeight}px`);
}

function irASiguienteVacia(){
  const pend = [...(gridBody2?.querySelectorAll("td.drop:not(.filled):not(.con-nota)") || [])].filter(td => td.offsetParent !== null);
  if (!pend.length) {
    showToast("No quedan casillas sin conductor.", "ok");
    return;
  }
  const i = pend.indexOf(ultimaVaciaMostrada);
  const sig = pend[(i + 1) % pend.length];
  ultimaVaciaMostrada = sig;
  sig.scrollIntoView({ behavior: "smooth", block: "center" });
  sig.classList.remove("destello");
  void sig.offsetWidth;
  sig.classList.add("destello");
  setTimeout(() => sig.classList.remove("destello"), 1700);
  if (!conductorElegido) sig.querySelector("input.driver-typed-input")?.focus({ preventScroll: true });
}

document.addEventListener("click", (ev) => {
  if (ev.target.closest("#avSiguiente")) irASiguienteVacia();
  else if (ev.target.closest("#avisoElegidoCancelar")) soltarConductorElegido();
  else if (ev.target.closest("#btnRecuperarTurnos")) recuperarAsignacionesSinGuardar();
  else if (ev.target.closest("#btnDescartarTurnos")) descartarAsignacionesSinGuardar();
});
// v2.14.1: al irse a otra pestana/aplicacion se guarda de una vez lo pendiente; al cerrar o recargar la pagina con
// algo sin guardar, el navegador pregunta antes de salir.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden" && targetEditSaveTimer) {
    flushPendingTargetSave().catch(() => {});
  }
});
window.addEventListener("beforeunload", (ev) => {
  if (!hayTurnosSinGuardar()) return;
  if (targetEditSaveTimer) flushPendingTargetSave().catch(() => {});
  ev.preventDefault();
  ev.returnValue = "";
});
document.addEventListener("change", (ev) => {
  if (ev.target && ev.target.id === "avSoloFaltan") {
    soloFaltanTurnos = !!ev.target.checked;
    document.getElementById("grid2")?.classList.toggle("solo-faltan", soloFaltanTurnos);
  }
});
document.addEventListener("keydown", (ev) => {
  if (ev.key === "Escape" && conductorElegido) soltarConductorElegido();
});

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
    th.dataset.campo = h;   // v2.12.0: para esconder FECHA y BASE con una base abierta (ya estan arriba)
    headRow.appendChild(th);
  });
  gridHead2.appendChild(headRow);
  document.getElementById("grid2")?.classList.toggle("con-base", !!currentBase);

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
  const vehiculoSwapEnabled = canSwapVehiclePositions();
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
    // Para marcar quien cambio cada celda (modulo Mi base: cambios): la misma clave con que se guarda la fila.
    try { tr.dataset.rowKey = buildProgramacionRowKey(r); } catch (_) { /* sin clave: no se marca */ }
    const isFichoRow = isFichoRowByContent(r);
    if (isFichoRow) tr.classList.add("ficho-sandiego");
    headers.forEach(k => {
      const td = document.createElement("td");
      td.dataset.campo = k;
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
          td.classList.toggle("con-nota", !assignedNow && !!noteNow);
          if (assignedNow) {
            td.classList.add("filled");
            labelWrap.innerHTML = `
              <div>${r[k] || ""}</div>
              <span class="base-badge">${rowBaseLabel}</span>
            `;
          } else {
            td.classList.remove("filled");
            labelWrap.innerHTML = `
              <span class="slot-vacio">${noteNow ? "Sin conductor · con nota" : "Sin conductor"}</span>
              ${noteNow ? `<div class="cell-note">${noteNow}</div>` : ""}
              <button class="btn-note" type="button">${noteNow ? "Editar nota" : "Agregar nota"}</button>
            `;
            wireNoteButton();
          }
          if (tr.isConnected) {
            marcarFilaTurnos(tr);
            pintarAvanceTurnos();
          }
        };

        renderLabel();
        td.appendChild(labelWrap);

        const editorWrap = document.createElement("div");
        editorWrap.className = "driver-cell-editor";
        const input = document.createElement("input");
        input.type = "text";
        input.className = "driver-typed-input";
        input.placeholder = "Escriba el nombre…";
        input.autocomplete = "off";
        input.setAttribute("list", typedDatalistId);
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
            const pool = getDriverPoolForBase(baseCanonical);
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
            const data = readDragPayload(ev);
            if (!data) {
              showToast("No se reconocio lo que soltaste. Arrastra el conductor desde el panel o escribelo en la casilla.", "warn");
              return;
            }
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
            reportError("No se pudo asignar el conductor en Turnos del dia", e);
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
        // v2.12.0: asignar con un toque: se escoge el conductor en el panel y se toca la casilla sin conductor.
        // Al apretar (mousedown), no al soltar: el "click" sobre la casilla a veces no llega (la lista de nombres que
        // se abre al tocarla se lo come, en el celular) y asi tampoco se abre el teclado.
        td.addEventListener("mousedown", (ev) => {
          if (!conductorElegido || extractConductorName(r[k] || "")) return;
          // con un conductor escogido, cualquier parte de la casilla vacia lo pone (tambien donde esta "Agregar nota")
          ev.preventDefault();
          ev.stopPropagation();
          const nombre = conductorElegido;
          try {
            r[k] = nombre;
            setConductorNote(r, k, "");
            input.value = extractConductorName(r[k] || "");
            renderLabel();
            pendingAssignmentConfirmations.push({
              conductor: extractConductorName(r[k] || "") || String(nombre || ""),
              vehiculo: String(r[getVehiculoKey(r)] || "").trim(),
              slot: k
            });
            scheduleTargetEditSave(`Asignacion guardada en DB nueva (${k}).`);
            conductorElegido = null;
            if (document.activeElement === input) input.blur();
            renderDrivers();
          } catch (e) {
            reportError("No se pudo asignar el conductor en Turnos del dia", e);
          }
        }, true);
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
          setDragPayload(ev, {
            tipo: "vehiculo_posicion",
            sourceRowUiId: ensureRowUiId(r),
            sourceRowKey: buildProgramacionRowKey(r),
            sourceVehiculoKey: k,
            sourceVehiculo: String(sourceValue),
            sourceLabel: rowLabel
          });
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
            const data = readDragPayload(ev);
            if (!data) {
              showToast("No se reconocio el vehiculo arrastrado. Vuelve a arrastrarlo desde su casilla de vehiculo.", "warn");
              return;
            }
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
            reportError("No se pudo cambiar el carro de posicion", e, {
              hint: "Revisa la tabla: si los carros no quedaron donde debian, vuelve a intentarlo despues de enviar el error."
            });
          }
        };
      } else {
        td.textContent = v || "";
      }
      tr.appendChild(td);
    });
    gridBody2.appendChild(tr);
    marcarFilaTurnos(tr);
  });
  rebuildAssigned();
  renderDrivers();
  pintarAvanceTurnos();
  if (typeof window.combuasignaMarcarCambios === "function") window.combuasignaMarcarCambios();
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
  // Ambito opcional de base: se compara contra la columna 'base', que se guarda
  // con la etiqueta completa ("BASE 4"), no con el canonico ("4").
  const baseCanonical = getBaseCanonical(options?.base || "");
  const baseScope = baseCanonical ? formatBaseLabel(baseCanonical) : "";
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
    if (baseScope) query = query.eq("base", baseScope);
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
  // Ambito opcional de base. Acota TANTO el inventario de filas existentes como
  // el borrado, de modo que un guardado nunca pueda eliminar filas de otra base.
  const baseCanonicalScope = getBaseCanonical(options?.base || "");
  const baseScope = baseCanonicalScope ? formatBaseLabel(baseCanonicalScope) : "";
  const payload = buildProgramacionFilaPayload(rowsInput, programacionId).map(item => ({
    ...item,
    updated_by: updatedByOverride || item.updated_by || null
  }));
  // Dos formas de decidir que se borra:
  //  - Lista explicita (deleteKeys): se borra solo eso. La usa el guardado por
  //    cambios, donde el envio NO es el contenido completo del ambito; inferir
  //    ahi borraria filas que nadie toco.
  //  - Por diferencia (sin deleteKeys): se borra lo que hay en la base dentro
  //    del ambito y ya no viene en el envio. Vale cuando el envio SI es el
  //    ambito completo (una base abierta, o una carga de Excel).
  const borradoExplicito = Array.isArray(options?.deleteKeys);
  let toDelete = [];
  if (borradoExplicito) {
    toDelete = options.deleteKeys.map(k => String(k || "")).filter(Boolean);
  } else {
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
      if (baseScope) existingQuery = existingQuery.eq("base", baseScope);
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
    toDelete = Array.from(existingKeys).filter(k => !nextKeys.has(k));
  }

  for (const keyChunk of chunkArray(toDelete, 300)) {
    let deleteQuery = client
      .from("programacion_filas")
      .delete()
      .eq("programacion_id", programacionId)
      .in("row_key", keyChunk);
    if (fechaScope) deleteQuery = deleteQuery.eq("fecha", fechaScope);
    if (baseScope) deleteQuery = deleteQuery.eq("base", baseScope);
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
    showToast("Fallo la migracion manual. Revisa el detalle en Diagnostico.", "err", e);
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
    showToast(`No se pudo cargar ${PLANILLA_TABLE_NAME} desde Supabase.`, "err", error);
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
  "703":"BASE 4","705":"BASE 4","707":"BASE 4","708":"BASE 3","709":"BASE 3",
  "714":"BASE 3","715":"BASE 4","710":"BASE 3","717":"BASE 4","718":"BASE 3",
  "719":"BASE 2","720":"BASE 3","721":"BASE 4","722":"BASE 3","723":"BASE 3",
  "724":"BASE 3","725":"BASE 4","726":"BASE 3","727":"BASE 3","728":"BASE 4",
  "729":"BASE 1","730":"BASE 1","731":"BASE 4","732":"BASE 1","733":"BASE 3",
  "734":"BASE 3","735":"BASE 4","736":"BASE 8","737":"BASE 3","738":"BASE 3",
  "739":"BASE 3","740":"BASE 3","741":"BASE 3","742":"BASE 3","743":"BASE 3",
  "744":"BASE 3","745":"BASE 3","746":"BASE 4","747":"BASE 8","748":"BASE 2",
  "749":"BASE 2","750":"BASE 3","751":"BASE 3","752":"BASE 3","753":"BASE 3",
  "754":"BASE 3","755":"BASE 3","756":"BASE 8","757":"BASE 3","758":"BASE 3",
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
  const pool = getDriverPoolForBase(base);
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

  const pool = getDriverPoolForBase(canonicalBase);
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

// v2.11.0 (19-nov-2026): se quitó la pestaña "Consulta por fechas" (ensureConsultaDateDefaults y
// renderConsultaBaseView, con su línea de tiempo). En Supabase no se tocó nada.

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
// Resumen de la carga de conductores: no solo cuantos entraron, sino cuantos
// quedaron fuera y por que. Un conductor habilitado al que no se le puso base
// no aparece en NINGUNA pantalla de la aplicacion, y hasta ahora la unica forma
// de enterarse era descargar el CSV y contarlo a mano.
function renderDriversCsvSummary(totalEnabled, totalBases, opts = {}){
  const sufijo = opts.cache ? " (cache)" : "";
  const sinBase = driversSinBaseAsignada.length;
  const fueraErp = driversFueraPorErp.length;
  const retirados = driversFueraPorErp.filter(x => x.motivo === "retirado").length;
  const noEstan = fueraErp - retirados;
  const sumadosErp = (driversSumadosErp || []).length;

  if (lblDriversCount) {
    lblDriversCount.textContent = `Conductores: ${totalEnabled} en ${totalBases} bases`
      + (sumadosErp ? ` - ${sumadosErp} por el ERP` : "")
      + (fueraErp ? ` - ${fueraErp} fuera por el ERP` : "")
      + (sinBase ? ` - ${sinBase} sin base` : "") + sufijo;
    lblDriversCount.classList.toggle("pill-warn", sinBase > 0 || !!erpRevisionNota || !!erpSumaNota);
    lblDriversCount.title = [
      "Conductores habilitados en la hoja de conductores, con base y activos en el ERP.",
      sumadosErp ? `${sumadosErp} salen en la base que dice el ERP porque en la hoja no estan, no tienen base o tienen otra.` : "",
      fueraErp ? `${fueraErp} habilitados en la hoja no salen porque en el ERP no estan activos.` : "",
      sinBase ? `${sinBase} conductores habilitados no tienen base en la hoja de conductores, asi que no aparecen en ninguna base de la aplicacion.` : "",
      erpRevisionNota,
      erpSumaNota
    ].filter(Boolean).join(" ");
  }

  if (!csvStatus) return;
  const partes = [];
  if (opts.nota) partes.push(`<div>${escapeHtml(opts.nota)}</div>`);
  if (erpRevisionNota) {
    partes.push(`<div style="margin-bottom:6px;padding:8px;border:1px solid #fcd34d;border-radius:8px;background:#fffbeb">${escapeHtml(erpRevisionNota)}</div>`);
  }
  if (erpSumaNota) {
    partes.push(`<div style="margin-bottom:6px;padding:8px;border:1px solid #fcd34d;border-radius:8px;background:#fffbeb">${escapeHtml(erpSumaNota)}</div>`);
  }
  partes.push(`<div>Cargados <strong>${totalEnabled}</strong> conductores en ${totalBases} bases${sufijo}.</div>`);
  if (sumadosErp) {
    const porQue = x => x.hoja === "no_esta" ? "todavia no esta en la hoja de Sonar"
      : x.hoja === "sin_base" ? "en Sonar no tiene base"
      : x.hoja === "deshabilitado" ? "en Sonar esta deshabilitado"
      : `en Sonar dice Base ${x.base_hoja} (tambien sale alla)`;
    partes.push(
      `<div class="csv-sumados-erp" style="margin-top:8px;padding:8px;border:1px solid #bbf7d0;border-radius:8px;background:#f0fdf4">` +
        `<strong>${sumadosErp} conductores salen en la base que dice el ERP</strong>: estan activos en el ERP con esa base, ` +
        `pero en la hoja de conductores (Sonar) no estan, no tienen base o tienen otra. Lo correcto es corregirlos en Sonar; ` +
        `mientras tanto salen en la base del ERP.` +
        `<details style="margin-top:6px"><summary style="cursor:pointer">Ver los ${sumadosErp} nombres</summary>` +
          `<div style="max-height:180px;overflow:auto;margin-top:6px;font-size:12px;line-height:1.6">` +
            driversSumadosErp.map(x => `Base ${escapeHtml(x.base)} · ${escapeHtml(x.nombre)} · ${escapeHtml(porQue(x))}`).join("<br>") +
          `</div>` +
        `</details>` +
      `</div>`
    );
  }
  if (fueraErp) {
    const porque = [retirados ? `${retirados} estan retirados` : "", noEstan ? `${noEstan} no estan creados` : ""].filter(Boolean).join(" y ");
    partes.push(
      `<div class="csv-fuera-erp" style="margin-top:8px;padding:8px;border:1px solid #cbd5e1;border-radius:8px;background:#f8fafc">` +
        `<strong>${fueraErp} conductores habilitados en la hoja no se muestran a las bases</strong> porque en el ERP ${porque}. ` +
        `Si alguno si esta trabajando, que Gestion Humana lo active (o lo cree) en el ERP y aparecera en la siguiente carga.` +
        `<details style="margin-top:6px"><summary style="cursor:pointer">Ver los ${fueraErp} nombres</summary>` +
          `<div style="max-height:180px;overflow:auto;margin-top:6px;font-size:12px;line-height:1.6">` +
            driversFueraPorErp.map(x =>
              `${escapeHtml(x.base ? "Base " + x.base : "Sin base")} · ${escapeHtml(x.nombre)} · ` +
              (x.motivo === "no_esta" ? "no esta en el ERP" : "retirado en el ERP")).join("<br>") +
          `</div>` +
        `</details>` +
      `</div>`
    );
  }
  if (driversInactivosCount) {
    partes.push(`<div>${driversInactivosCount} filas inactivas (status distinto de ENABLED). Es lo normal: no se cargan.</div>`);
  }
  if (sinBase) {
    partes.push(
      `<div style="margin-top:8px;padding:8px;border:1px solid #fcd34d;border-radius:8px;background:#fffbeb">` +
        `<strong>${sinBase} conductores habilitados sin base asignada.</strong> ` +
        `No salen en ninguna base porque en la hoja de conductores esa columna esta vacia ` +
        `o trae un correo en lugar de "BASE n". Escribe ahi la base que les corresponde y ` +
        `apareceran en la siguiente carga.` +
        `<details style="margin-top:6px"><summary style="cursor:pointer">Ver los ${sinBase} nombres</summary>` +
          `<div style="max-height:180px;overflow:auto;margin-top:6px;font-size:12px;line-height:1.6">` +
            driversSinBaseAsignada.map(n => escapeHtml(n)).join("<br>") +
          `</div>` +
        `</details>` +
      `</div>`
    );
  }
  csvStatus.innerHTML = partes.join("");
}

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
    const sinBase = [];      // habilitados sin base: no se pueden usar en ninguna
    let inactivos = 0;       // status distinto de ENABLED
    const habilitados = [];  // ENABLED, con base o sin ella; antes de cruzarlos con el ERP
    const filasHoja = [];    // v2.14.0: todas las filas con nombre, para buscar en la hoja a los activos del ERP

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

      // Tres destinos posibles, y los tres se cuentan: antes solo se contaba el
      // primero y los otros dos se perdian en silencio.
      const baseMatch = email.match(/BASE\s*(\d+)/i);
      if (nombre) filasHoja.push({ nombre, cedula, status, base: baseMatch ? baseMatch[1] : "" });
      if (!nombre) {
        // fila sin nombre: no es un conductor
      } else if (status !== 'ENABLED') {
        inactivos++;
      } else {
        habilitados.push({ k: claveConductorErp(nombre, cedula), nombre, cedula, base: baseMatch ? baseMatch[1] : "" });
      }
    }

    // v2.12.0: fuera los que en el ERP no estan activos (retirados o sin crear), tengan base o no.
    const revisionErp = await conductoresNoActivosERP(habilitados);
    const fueraErp = [];
    const hojaPorBase = {};
    for (const h of habilitados) {
      if (h.base) (hojaPorBase[h.base] = hojaPorBase[h.base] || []).push({ nombre: h.nombre, cedula: h.cedula });
      const motivo = revisionErp.mapa ? revisionErp.mapa.get(h.k) : null;
      if (motivo) {
        fueraErp.push({ nombre: h.nombre, base: h.base, motivo });
      } else if (h.base) {
        if (!newDriversByBase[h.base]) newDriversByBase[h.base] = [];
        newDriversByBase[h.base].push(h.nombre);
        totalEnabled++;
      } else {
        sinBase.push(h.nombre);
      }
    }

    // v2.14.0: los activos del ERP salen tambien en la base que dice el ERP (solo se suma).
    const delErp = await conductoresActivosERP();
    const sumadosErp = sumarConductoresDelErp(delErp.lista, filasHoja, newDriversByBase, newCedulaByName, sinBase, fueraErp);
    totalEnabled += sumadosErp.length;

    // Ordenar
    Object.keys(newDriversByBase).forEach(base => {
      newDriversByBase[base].sort((a, b) => a.localeCompare(b));
    });

    driversByBase = newDriversByBase;
    driversSinBaseAsignada = sinBase.slice().sort((a, b) => a.localeCompare(b, "es"));
    driversInactivosCount = inactivos;
    driversFueraPorErp = fueraErp.sort((a, b) =>
      ((Number(a.base) || 999) - (Number(b.base) || 999)) || a.nombre.localeCompare(b.nombre, "es"));
    erpRevisionNota = revisionErp.nota;
    driversSumadosErp = sumadosErp.sort((a, b) =>
      ((Number(a.base) || 999) - (Number(b.base) || 999)) || a.nombre.localeCompare(b.nombre, "es"));
    erpSumaNota = delErp.nota;
    driversHojaPorBase = hojaPorBase;
    if (newCedulaByName.size) driverCedulaByName = newCedulaByName;
    saveDriversCache();

    const totalBases = Object.keys(driversByBase).length;
    renderDriversCsvSummary(totalEnabled, totalBases);
    
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
      // El cache solo guarda el listado por base: no sabe quien quedo fuera, y
      // conviene no arrastrar la cuenta de la carga anterior como si fuera de esta.
      driversSinBaseAsignada = [];
      driversInactivosCount = 0;
      driversFueraPorErp = [];   // el cache se guardo ya sin los que no estan activos en el ERP
      erpRevisionNota = "";
      driversSumadosErp = [];    // el cache ya trae sumados los del ERP
      erpSumaNota = "";
      renderDriversCsvSummary(totalEnabled, totalBases, {
        cache: true,
        nota: "Sin internet para Google Sheet; usando cache local de conductores."
      });
      fillStartBases();
      rebuildAssigned();
      renderDrivers();
    } else {
      driversSinBaseAsignada = [];
      driversInactivosCount = 0;
      driversFueraPorErp = [];
      erpRevisionNota = "";
      driversSumadosErp = [];
      erpSumaNota = "";
      lblDriversCount.textContent = "Conductores: 0 en 0 bases";
      lblDriversCount.classList.remove("pill-warn");
      csvStatus.innerHTML = 'Error al cargar conductores';
      showToast("No se pudo leer el listado de conductores (Google Sheets).", "err", error);
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
    const count = getDriverPoolForBase(canonical).length || 0;
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

// Bases de las que se toman conductores al trabajar en `base`: la propia mas
// las configuradas en EXTRA_DRIVER_BASES.
function getDriverBasesForBase(base){
  const canonical = getBaseCanonical(base);
  if (!canonical) return [];
  return [canonical, ...(EXTRA_DRIVER_BASES[canonical] || [])];
}

// Lista de conductores de una base, incluidos los de sus bases adicionales.
// Sustituye al patron driversByBase[base] || driversByBase[formatBaseLabel(base)].
function getDriverPoolForBase(base){
  const pool = [];
  const seen = new Set();
  getDriverBasesForBase(base).forEach(b => {
    const list = driversByBase[b] || driversByBase[formatBaseLabel(b)] || [];
    list.forEach(nombre => {
      const key = norm(nombre);
      if (!key || seen.has(key)) return;
      seen.add(key);
      pool.push(nombre);
    });
  });
  return pool;
}

// Reparto del listado de conductores de una base para la fecha activa: quien
// tiene turno, quien tiene estado registrado y quien queda sin ubicar. El panel
// y el texto que lo explica salen de esta misma cuenta a proposito: calculados
// por separado acabarian contando distinto y el mensaje terminaria mintiendo.
function getDriverAvailabilityBreakdown(base){
  const canonical = getBaseCanonical(base);
  if (!canonical) return { pool: [], asignados: [], conEstado: [], libres: [] };
  const relatedBases = getDriverBasesForBase(canonical);
  const pool = getDriverPoolForBase(canonical);

  // Ya asignados: se revisan todas las bases del pool para no ofrecer dos veces
  // a un conductor que ya esta puesto en un carro de su base de origen.
  const used = new Set();
  relatedBases.forEach(b => {
    const set = assignedByBase[b] || assignedByBase[formatBaseLabel(b)] || null;
    if (set) set.forEach(nombre => used.add(nombre));
  });
  const selectedDate = getActiveSelectedDateISO();

  // Novedades de esas bases en la misma fecha operativa. Sacan del panel con
  // CUALQUIER estado, PENDIENTE y DISPONIBLE incluidos; por eso se guarda cual
  // es, para poder decirlo en pantalla.
  const estadoPorNombre = new Map();
  novedades.forEach(n => {
    if (!relatedBases.some(b => sameBase(n.base, b))) return;
    if (selectedDate && normalizeDateToISO(n.fecha) !== selectedDate) return;
    estadoPorNombre.set(norm(n.nombre), String(n.estado || "").trim() || "PENDIENTE");
  });

  const asignados = [];
  const conEstado = [];
  const libres = [];
  pool.forEach(nombre => {
    const key = norm(nombre);
    if (used.has(key)) asignados.push(nombre);
    else if (estadoPorNombre.has(key)) conEstado.push({ nombre, estado: estadoPorNombre.get(key) });
    else libres.push(nombre);
  });

  return { pool, asignados, conEstado, libres };
}

function getAvailableDriversForBase(base){
  return getDriverAvailabilityBreakdown(base).libres;
}

// Texto del panel cuando no queda nadie por arrastrar. Antes decia siempre
// "Todos los conductores asignados", aunque en realidad estuvieran en Estados
// del personal: el operador se quedaba sin saber donde buscarlos.
function describeDriverPanelEmpty(reparto){
  const total = reparto.pool.length;
  if (total === 0) return "Esta base no tiene conductores en el listado.";
  const partes = [];
  if (reparto.asignados.length) partes.push(`${reparto.asignados.length} con turno asignado`);
  if (reparto.conEstado.length) partes.push(`${reparto.conEstado.length} con estado registrado`);
  return `Los ${total} conductores de la base ya estan ubicados: ${partes.join(" y ")}.`;
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

  const pool = getDriverPoolForBase(base);
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
  const reparto = getDriverAvailabilityBreakdown(base);
  const available = reparto.libres;
  // El estado del dia se mide sobre las filas que se estan viendo. El tercer
  // argumento por defecto es `rows`, el dataset de la base vieja: en esta
  // pestana no es el mismo, y por eso el aviso de sobrantes nunca salia.
  const dateStatus = getDateStatusForBase(selectedDate, base, getActiveRowsForDrivers());

  const visible = available.filter(d => d.toLowerCase().includes(filterText));
  if (visible.length === 0) {
    list.innerHTML = `<div class="muted" style="padding:12px;text-align:center">${
      available.length === 0
        ? describeDriverPanelEmpty(reparto)
        : "No hay coincidencias con ese filtro"
    }</div>`;
    // Tambien aqui: al quedarse el panel sin nadie, la guia de pasos se
    // quedaba con el texto de la vez anterior.
    updateWorkflowGuide();
    return;
  }

  // Resumen siempre a la vista: un panel con un solo nombre y una base de
  // veintidos parece una falla, y hasta ahora no habia forma de saber si el
  // resto estaba con turno o en Estados del personal.
  const resumen = document.createElement("div");
  resumen.className = "muted";
  resumen.style.padding = "6px 8px";
  resumen.style.marginBottom = "8px";
  resumen.style.fontSize = "11px";
  resumen.style.textAlign = "center";
  resumen.textContent = `${reparto.pool.length} en la base: `
    + `${reparto.asignados.length} con turno, `
    + `${reparto.conEstado.length} con estado, `
    + `${reparto.libres.length} sin ubicar.`;
  list.appendChild(resumen);

  // v2.12.0: los que la hoja tiene en la base pero en el ERP estan retirados (o no estan creados) no salen en el
  // panel; se dice cuantos y "Ver cuales" abre Mi base · Historial de conductores.
  const fueraErp = conductoresFueraDelPanel(base);
  if (fueraErp) {
    const aviso = document.createElement("div");
    aviso.className = "muted driver-fuera-erp";
    aviso.style.cssText = "padding:6px 8px;margin-bottom:8px;font-size:11px;text-align:center;border:1px dashed #cbd5e1;border-radius:8px";
    const tabMiBase = document.querySelector('.tab[data-tab="novedades-base"]');
    aviso.innerHTML = `No se muestran <b>${fueraErp}</b> ${fueraErp === 1 ? "conductor que en el ERP esta retirado o no esta creado"
      : "conductores que en el ERP estan retirados o no estan creados"}.`
      + (tabMiBase && tabMiBase.offsetParent !== null
        ? ` <button type="button" class="driver-fuera-ver" style="background:none;border:0;padding:0;font:inherit;color:var(--color-primary);font-weight:600;text-decoration:underline;cursor:pointer">Ver cuales</button>`
        : "");
    aviso.querySelector(".driver-fuera-ver")?.addEventListener("click", abrirHistorialConductores);
    list.appendChild(aviso);
  }

  if (dateStatus.state === "needs_states") {
    const info = document.createElement("div");
    info.className = "muted";
    info.style.padding = "8px";
    info.style.marginBottom = "8px";
    info.style.border = "1px solid #fcd34d";
    info.style.borderRadius = "8px";
    info.style.background = "#fffbeb";
    // El numero sale del propio panel, no de getRemainingDriversCountForDate:
    // esa funcion descarta las filas FICHO y el panel no, asi que las dos
    // cuentas podian salir distintas en la misma pantalla.
    info.textContent = `Quedan ${available.length} conductores sobrantes. Arrastralos a la pestana "Estados del personal".`;
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
        // Primero los datos: si algo de lo que sigue fallara, el arrastre
        // ya lleva al conductor.
        setDragPayload(ev, {
          tipo: 'conductor',
          nombre: name,
          base: base
        });
        ev.dataTransfer.effectAllowed = 'move';
        highlightDropTargets(true);
      };
      div.ondragend = () => highlightDropTargets(false);
      // v2.12.0: tocar el conductor lo escoge; despues se toca la casilla vacia (o se arrastra, como antes).
      div.dataset.nombre = name;
      div.title = "Toque para escogerlo y luego toque la casilla vacia (o arrastrelo)";
      if (name === conductorElegido) div.classList.add("elegido");
      div.addEventListener("click", () => elegirConductor(name));
      div.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); elegirConductor(name); }
      });
      div.addEventListener("dragstart", () => soltarConductorElegido());
      
      list.appendChild(div);
    });
  updateWorkflowGuide();
  refreshNovedadesManualAutocomplete2();
  pintarAvanceTurnos();
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
        reportError("No se pudo cambiar el estado del conductor", error, {
          hint: "El estado no se guardo; la tabla vuelve a mostrar el que tenia."
        });
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
        reportError("No se pudo quitar al conductor de Estados del personal", error, {
          hint: "El conductor sigue en la lista."
        });
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

// El Excel del visor sale igual al visor: colores, celdas unidas y anchos (18-nov-2026). Desde la 2.11.1 (20-nov-2026)
// sale SIN protección (pedido del usuario) y los colores se toman del estilo que escribe el propio visor (#hex), no de lo
// que diga el navegador: en un PC el Excel salió sin fondos y con la letra blanca, y los buses y los FICHO parecían vacíos.
// Acepta #rgb, #rrggbb, rgb()/rgba() con comas o espacios y color(srgb ...). Devuelve "FFRRGGBB" o null (transparente).
function colorArgbDesdeCss(css){
  const s = String(css || "").trim().toLowerCase();
  if (!s || s === "transparent" || s === "none") return null;
  let m = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6})\b/);
  if (m) {
    const h = m[1].length === 3 ? m[1].split("").map(c => c + c).join("") : m[1];
    return "FF" + h.toUpperCase();
  }
  let rgb = null;
  let alfa = null;
  m = s.match(/rgba?\(\s*([\d.]+%?)[\s,]+([\d.]+%?)[\s,]+([\d.]+%?)(?:\s*[,/]\s*([\d.]+%?))?\s*\)/);
  if (m) {
    rgb = [m[1], m[2], m[3]].map(v => v.endsWith("%") ? parseFloat(v) * 2.55 : parseFloat(v));
    alfa = m[4];
  } else {
    m = s.match(/color\(\s*srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+%?))?\s*\)/);
    if (m) { rgb = [m[1], m[2], m[3]].map(v => parseFloat(v) * 255); alfa = m[4]; }
  }
  if (!rgb || rgb.some(v => !Number.isFinite(v))) return null;
  if (alfa !== undefined && alfa !== null && parseFloat(alfa) === 0) return null;
  return "FF" + rgb.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("").toUpperCase();
}

// Color de una celda del visor: primero el que escribió el visor en su estilo (no depende del navegador); si no tiene,
// el que pinta el navegador (las franjas de las filas). que = "fondo" | "letra".
function colorCeldaVisor(td, que){
  const estilo = String(td.getAttribute("style") || "");
  const m = que === "fondo"
    ? estilo.match(/(?:^|;)\s*background(?:-color)?\s*:\s*([^;]+)/i)
    : estilo.match(/(?:^|;)\s*color\s*:\s*([^;]+)/i);
  const propio = m ? colorArgbDesdeCss(m[1]) : null;
  if (propio) return propio;
  const est = getComputedStyle(td);
  return colorArgbDesdeCss(que === "fondo" ? est.backgroundColor : est.color);
}

function colorEsClaro(argb){
  if (!argb || argb.length !== 8) return false;
  const [r, g, b] = [2, 4, 6].map(k => parseInt(argb.slice(k, k + 2), 16));
  return (0.299 * r + 0.587 * g + 0.114 * b) > 200;
}

async function exportLiveExcelPreviewTable(){
  if (!liveExcelPreview) {
    showToast("Visor no disponible.", "warn");
    return;
  }
  const table = liveExcelPreview.querySelector("table");
  if (!table) {
    showToast("No hay tabla en el visor para exportar.", "warn");
    return;
  }
  if (!window.ExcelJS) {
    showToast("No se pudo cargar ExcelJS para exportar el visor.", "err");
    return;
  }
  const visorDate = normalizeDateToISO(visorDateSelect?.value || "");
  const scopeMode = String(visorScopeSelect?.value || "all");
  const scopeText = scopeMode === "base" ? "base" : "todo";
  const fileDate = visorDate || "sin_fecha";
  try {
    const wb = new ExcelJS.Workbook();
    wb.creator = "CombuAsigna";
    wb.created = new Date();
    const ws = wb.addWorksheet("Visor", {
      views: [{ showGridLines: false }],
      // al imprimir: horizontal y a lo ancho de una hoja (lo largo, en las hojas que hagan falta)
      pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, horizontalCentered: true,
                   margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 } }
    });
    const anchos = Array.from(table.querySelectorAll("colgroup col")).map(c => parseFloat(c.style.width) || 8);
    if (anchos.length) ws.columns = anchos.map(p => ({ width: Math.max(3, Math.round(p * 1.7)) }));
    const borde = { style: "thin", color: { argb: "FFBFBFBF" } };
    const ocupada = new Set();
    let ultimaFila = 0;
    Array.from(table.rows).forEach((tr, ri) => {
      let ci = 0;
      let lineas = 1;
      Array.from(tr.cells).forEach(td => {
        while (ocupada.has(`${ri}:${ci}`)) ci++;
        const cs = Math.max(1, td.colSpan || 1);
        const rs = Math.max(1, td.rowSpan || 1);
        const texto = String(td.innerText || td.textContent || "").replace(/\r/g, "").trim();
        const est = getComputedStyle(td);   // letra, negrilla, tamaño y alineación (los colores, con colorCeldaVisor)
        const cell = ws.getCell(ri + 1, ci + 1);
        cell.value = texto;   // como texto: lo mismo que se ve en el visor
        const fondo = colorCeldaVisor(td, "fondo");
        const conFondo = !!fondo && fondo !== "FFFFFFFF";
        // el relleno como lo guarda Excel (fgColor + bgColor 64): algunos programas no pintan el fondo sin el bgColor
        if (conFondo) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fondo }, bgColor: { indexed: 64 } };
        let letra = colorCeldaVisor(td, "letra");
        // nunca letra blanca sin fondo: si el fondo no sale, el dato igual se lee
        if (letra && colorEsClaro(letra) && !(conFondo && !colorEsClaro(fondo))) letra = "FF0F172A";
        const peso = parseInt(est.fontWeight, 10) || 400;
        const px = parseFloat(est.fontSize) || 13;
        cell.font = { name: "Calibri", size: Math.max(8, Math.round(px * 0.75)), bold: peso >= 600, ...(letra ? { color: { argb: letra } } : {}) };
        const horiz = est.textAlign === "center" ? "center" : (est.textAlign === "right" || est.textAlign === "end") ? "right" : "left";
        cell.alignment = { horizontal: horiz, vertical: "middle", wrapText: true };
        cell.border = { top: borde, left: borde, bottom: borde, right: borde };
        lineas = Math.max(lineas, texto.split("\n").length);
        if (cs > 1 || rs > 1) ws.mergeCells(ri + 1, ci + 1, ri + rs, ci + cs);
        for (let r = 0; r < rs; r++) for (let c = 0; c < cs; c++) ocupada.add(`${ri + r}:${ci + c}`);
        ci += cs;
      });
      ws.getRow(ri + 1).height = Math.max(18, lineas * 15);
      ultimaFila = ri + 1;
    });
    const nota = ws.getCell(ultimaFila + 2, 1);
    nota.value = `Descargado de CombuAsigna el ${new Date().toLocaleString("es-CO")}. Si algo de la programación está mal, `
      + "corríjalo en CombuAsigna para que todos lo vean igual y descargue el visor de nuevo.";
    nota.font = { italic: true, size: 9, color: { argb: "FF64748B" } };
    nota.alignment = { wrapText: true, vertical: "top" };
    ws.mergeCells(ultimaFila + 2, 1, ultimaFila + 2, Math.max(1, anchos.length || 11));
    ws.getRow(ultimaFila + 2).height = 30;
    // 2.11.1: sin protección (pedido del usuario 20-nov-2026); se puede editar todo.
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `visor_excel_${fileDate}_${scopeText}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast("Visor descargado en Excel, con sus colores.", "ok");
  } catch (error) {
    console.error("No se pudo descargar el visor:", error);
    showToast(`No se pudo descargar el visor: ${error?.message || error}`, "err");
  }
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
  const vehiculoSwapEnabled = canSwapVehiclePositions();
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
            const data = readDragPayload(ev);
            if (!data) {
              showToast("No se reconocio lo que soltaste. Arrastra el conductor desde el panel.", "warn");
              return;
            }

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
            reportError("No se pudo asignar el conductor", e);
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
          setDragPayload(ev, {
            tipo: "vehiculo_posicion",
            sourceRowUiId: ensureRowUiId(r),
            sourceRowKey: buildProgramacionRowKey(r),
            sourceVehiculoKey: k,
            sourceVehiculo: String(sourceValue),
            sourceLabel
          });
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
            const data = readDragPayload(ev);
            if (!data) {
              showToast("No se reconocio el vehiculo arrastrado. Vuelve a arrastrarlo desde su casilla de vehiculo.", "warn");
              return;
            }
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
            reportError("No se pudo cambiar el carro de posicion", e, {
              hint: "Revisa la tabla: si los carros no quedaron donde debian, vuelve a intentarlo despues de enviar el error."
            });
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
    reportError("No se pudo generar el reporte de turnos", err);
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
    showToast("No se pudo cargar despachos realizados desde Supabase.", "err", e);
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
          showToast("No se pudo cargar la programacion de Turnos del dia.", "err", e);
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

function attachNovedadesDropHandlers(gridEl){
  if (!gridEl) return;
  gridEl.ondragover = ev => {
    ev.preventDefault();
    autoScrollDuringDrag(ev.clientY);
  };
  gridEl.ondrop = async ev => {
    ev.preventDefault();
    // Leer lo que se solto NO es un fallo de Supabase: se resuelve aqui, con su
    // propio mensaje, y el aviso de Supabase queda solo para errores reales.
    const data = readDragPayload(ev);
    if (!data) {
      showToast("No se reconocio lo que soltaste. Arrastra el conductor desde el panel \"Conductores disponibles\" o usa \"Asignar por nombre\".", "warn");
      return;
    }
    if (data.tipo !== "conductor") {
      showToast("Aqui solo se sueltan conductores del panel \"Conductores disponibles\".", "warn");
      return;
    }
    try {
      await addNovedadByName(data.nombre);
    } catch (e) {
      const detail = String(e?.message || "");
      const duplicate = detail.toLowerCase().includes("duplicate key");
      setSyncStatus("err", "Error novedades");
      reportError(`No se pudo registrar a ${data.nombre} en Estados del personal`, e, {
        hint: duplicate
          ? "El conductor no quedo registrado. Posible causa: indice unico de novedades sin fecha."
          : "El conductor no quedo registrado."
      });
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
    reportError(`El archivo ${file.name} se leyo, pero no se pudo guardar en Supabase`, error, {
      hint: mode === "target"
        ? "La programacion solo quedo en este equipo; los demas no la ven."
        : "La programacion solo quedo en este equipo. Revisa tablas/politicas."
    });
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
    setSyncStatus("err", "Archivo invalido");
    reportError(`No se pudo cargar el archivo ${f.name}`, error);
  } finally {
    if (e?.target) e.target.value = "";
  }
}

async function handleProgramacionFileChangeNewDb(e){
  const files = Array.from(e?.target?.files || []);
  if (files.length === 0) return;
  try {
    if (files.length === 1) {
      setSyncStatus("warn", "Subiendo archivo a DB nueva...");
      await readFile(files[0], { mode: "target" });
    } else {
      // Subida multiple: se procesan en secuencia (uno tras otro) para no
      // pisar el estado ni provocar carreras al guardar en Supabase.
      let ok = 0;
      const errores = [];
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        setSyncStatus("warn", `Subiendo ${i + 1} de ${files.length} a DB nueva...`);
        showToast(`Subiendo archivo ${i + 1} de ${files.length}: ${f.name}`, "warn");
        try {
          await readFile(f, { mode: "target" });
          ok++;
        } catch (err) {
          console.error(`Error subiendo ${f.name} a DB nueva:`, err);
          errores.push(`${f.name}: ${err?.message || "error desconocido"}`);
        }
      }
      // Refrescar el catalogo de fechas para que aparezcan los dias cargados.
      try {
        await loadTargetDateCatalogFromSupabase(true);
        refreshFilterDateOptions2();
      } catch (refreshErr) {
        console.warn("No se pudo refrescar el catalogo de fechas tras la subida multiple:", refreshErr);
      }
      if (errores.length === 0) {
        setSyncStatus("ok", "Archivos cargados");
        showToast(`${ok} archivos cargados en la base nueva.`, "ok");
      } else {
        setSyncStatus("warn", `Cargados ${ok}/${files.length}`);
        reportError(`Se cargaron ${ok} de ${files.length} archivos; ${errores.length} fallaron`,
          `Fallaron:\n- ${errores.join("\n- ")}`,
          { hint: "Los archivos que fallaron no quedaron guardados." });
      }
    }
  } catch (error) {
    setSyncStatus("err", "Archivo invalido (DB nueva)");
    reportError("No se pudo cargar el archivo de programacion", error);
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
  const legible = excelDateToReadable(dayIso);
  const confirmar = confirm(
    `Vas a ELIMINAR toda la programacion del dia ${legible} en la base de datos (incluidas las asignaciones de conductores).\n\n` +
    `Esta accion no se puede deshacer. Deseas continuar?`
  );
  if (!confirmar) return;

  setSyncStatus("warn", "Eliminando dia...");
  const btnDeleteDay = document.getElementById("btnDeleteDay");
  if (btnDeleteDay) btnDeleteDay.disabled = true;

  try {
    // Bajo USE_ONLY_NEW_DB la programacion vive en programacion_filas (DB nueva),
    // donde cada fila tiene su columna 'fecha'. Borrar el dia = borrar esas filas.
    await ensureTargetMigrationSession();
    let totalEliminadas = 0;
    while (true) {
      const { data, error } = await programacionesTargetClient
        .from("programacion_filas")
        .delete()
        .eq("fecha", dayIso)
        .select("id");
      if (error) throw error;
      const n = Array.isArray(data) ? data.length : 0;
      totalEliminadas += n;
      if (n === 0) break;
    }

    if (totalEliminadas === 0) {
      setSyncStatus("ok", "Sin cambios");
      showToast(`No habia programacion guardada para ${legible}.`, "warn");
      return;
    }

    // Quitar la fecha de los arreglos locales (vista nueva y vieja).
    const fechaKeyTgt = getFechaKeyFromArray(rowsTarget);
    if (Array.isArray(rowsTarget) && rowsTarget.length) {
      rowsTarget = partitionRowsByDate(rowsTarget, dayIso, fechaKeyTgt).rest;
    }
    if (AppState.hasRows) {
      const fechaKeySrc = getFechaKeyFromArray(rows);
      AppState.replaceRows(partitionRowsByDate(rows, dayIso, fechaKeySrc).rest);
      updateExportAccess();
      fillStartBases();
      if (currentBase) refreshFilterDateOptions();
    }

    // Refrescar el catalogo de fechas y el selector de la DB nueva.
    await loadTargetDateCatalogFromSupabase(true);
    refreshFilterDateOptions2();

    // Si se estaba viendo justo ese dia, limpiar la vista.
    if (normalizeDateToISO(filterDate2?.value || "") === dayIso) {
      if (filterDate2) filterDate2.value = "";
      rowsTarget = [];
      currentProgramacionIdTarget = null;
    }
    const filterDate = document.getElementById("filterDate");
    if (filterDate && filterDate.value === dayIso) {
      filterDate.value = "";
      filterDate.dataset.prevValue = "";
      const clearBtn = document.getElementById("clearFilter");
      if (clearBtn) clearBtn.disabled = true;
    }

    updateWorkflowGuide();
    renderTable2();
    renderTable();
    renderDrivers();
    renderNovedades2();
    renderNovedades();

    setSyncStatus("ok", "Dia eliminado");
    showToast(`Dia ${legible} eliminado (${totalEliminadas} filas) de la base de datos.`, "ok");
  } catch (error) {
    setSyncStatus("err", "Error al eliminar");
    reportError(`No se pudo eliminar el dia ${legible}`, error);
  } finally {
    if (btnDeleteDay) btnDeleteDay.disabled = !AppState.hasRows;
  }
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
        reportError("No se pudo registrar al conductor por nombre en Estados del personal", error, {
          hint: "El conductor no quedo registrado."
        });
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
        reportError("No se pudo registrar al conductor por nombre en Estados del personal", error, {
          hint: "El conductor no quedo registrado."
        });
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
      await flushPendingTargetSave();   // v2.14.1: lo pendiente se guarda antes de recargar
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
        reportError("No se pudo actualizar la programacion", e);
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


/* v2.11.0 (19-nov-2026): se quitó la pestaña "Asistencias" (módulo bootstrapAsistencias). Las marcas de cada base
   y sus novedades se ven en Mi base. En Supabase no se tocó nada. */
/* v2.11.0 (19-nov-2026): se quitaron las pestañas "Planilla de enturnamiento aeropuerto" y "Mapa enturnamiento
   aeropuerto" (módulo Llegadas 104, su canal en vivo de llegadas_104 y Leaflet) y "Datos compartidos con el cliente".
   La fila del aeropuerto se ve en Mi base -> Enturnamiento en vivo. En Supabase no se tocó nada. */
/* v2.11.0 (19-nov-2026): se quitó la pestaña "Parque automotor y documentacion de vehiculos". Los vehículos y sus
   documentos los maneja el Kardex, que además cerró la tabla parque_automotor a las demás cuentas. Las tablas
   parque_automotor y parque_documentos y el bucket parque-docs siguen en Supabase, sin cambios. */
/* =====================================================================
   MODULO: Mi base (v2.11.0, 18-nov-2026)
   Pestana para las cuentas de base (y el administrador), en 3 partes:
     A. Novedades del dia: entradas contra el turno, motivos escritos, los que
        faltan y salidas/jornadas. Cada novedad la REVISA la base: escribe que
        se hizo y queda quien y cuando ("Por revisar").
     B. Viaje a viaje de sus carros, con la plata (misma vista que Control).
     C. El nuevo enturnamiento: la fila de cada punto con sus buses resaltados
        y donde esta cada bus suyo.
   Los datos los dan las funciones afiliados_* y es la BASE DE DATOS la que
   decide la base: una cuenta baseN@ ve solo la BASE N aunque alguien cambie
   este codigo; solo ella revisa. El administrador ve la base que abra.
   Las fotos estan en un bucket privado y se firman por 10 minutos.
   ===================================================================== */
(function bootstrapMiBase(){
  const RPC_NOVEDADES = "afiliados_novedades_base";
  const RPC_REVISAR = "afiliados_revisar_novedad";
  const RPC_VIAJES = "afiliados_viajes_base";
  const RPC_FILA = "afiliados_fila_base";
  const RPC_CAMBIOS = "combuasigna_cambios_dia";
  const RPC_HISTORIAL = "afiliados_historial_conductores";   // v2.12.0: historial de conductores de la base (con el ERP)
  const RPC_RELEVOS = "afiliados_relevos_base";   // v2.12.0: a qué hora se entregó el carro (GPS + marcas)
  const FOTO_BUCKET = "asistencia-fotos";
  const FOTO_SEG = 600;            // vigencia de cada foto firmada
  const FOTO_DIAS = 15;            // el biometrico borra las fotos a los 15 dias
  const SIN_CERRAR_H = 12;         // una entrada sin salida de mas de 12 h es un turno sin cerrar
  const DIAS_ATRAS = 62;           // las funciones aceptan hasta 2 meses atras
  const FILA_VIEJA_MS = 3 * 60 * 1000;
  // Cada cuanto se actualiza sola cada parte (solo con la pestana abierta y la pantalla a la vista).
  const CADA_MS = { novedades: 60 * 1000, viajes: 2 * 60 * 1000, fila: 30 * 1000, cambios: 60 * 1000, relevos: 2 * 60 * 1000,
    conductores: 10 * 60 * 1000 };
  // Los cambios se pueden ver hasta 7 dias adelante: las bases arman la programacion de manana.
  const DIAS_ADELANTE_CAMBIOS = 7;
  const PUNTOS_FILA = ["Aeropuerto", "Almacentro", "Nutibara", "Terminal Norte"];
  const PUNTO_POR_ITINERARIO = "Aeropuerto";
  // El dia de la tarjeta (viaje a viaje) va de 02:30 a 02:30, como en Control.
  const INICIO_TARJETA = "02:30";
  // Orden de los grupos de "Por revisar": primero lo mas grave.
  // Novedades por página en Por revisar (window.NB_REV_POR_PAGINA solo para las pruebas).
  const REV_POR_PAGINA = Math.max(1, Number(window.NB_REV_POR_PAGINA) || 10);
  const ORDEN_REVISAR = ["No ha entrado", "No entró", "Turno sin cerrar", "Jornada de más de 16 h", "Llegó tarde",
    "Revisar el tipo de marca", "Cambio de turno", "Entrada fuera de horario", "Salida fuera de horario",
    "Entró antes de tiempo", "Salida manual", "Motivo"];
  // Como se agrupan "Sus buses ahora".
  const LUGARES = [
    { k: "fila", txt: "En la fila", cls: "ok" },
    { k: "ruta", txt: "En ruta", cls: "info" },
    { k: "quieto", txt: "GPS sin reportar", cls: "warn" },
    { k: "sin", txt: "Sin despacho", cls: "mut" }
  ];

  const ORIGEN = {
    admin_form: "Biométrico",
    movil: "Celular",
    manual: "Manual (administración)",
    cierre_declarado: "Cierre declarado",
    web: "Web"
  };
  const LLEGADA = {
    a_tiempo: { txt: "A tiempo", cls: "ok" },
    temprano: { txt: "Temprano", cls: "warn" },
    tarde: { txt: "Tarde", cls: "err" },
    sin_programacion: { txt: "Sin turno", cls: "mut" }
  };

  const st = {
    vista: "novedades",
    fecha: "",
    datos: null,          // novedades
    viajes: null,
    fila: null,
    cambios: null,
    relevos: null,
    conductores: null,    // historial de conductores
    conductoresFiltro: "",
    conductoresBuscar: "",
    relevosFiltro: "",
    relevosBuscar: "",
    cambiosFiltro: "",
    cambiosBuscar: "",
    cargando: { novedades: false, viajes: false, fila: false, cambios: false, relevos: false, conductores: false },
    pedido: { novedades: 0, viajes: 0, fila: 0, cambios: 0, relevos: 0, conductores: 0 },
    cargadoEn: { novedades: 0, viajes: 0, fila: 0, cambios: 0, relevos: 0, conductores: 0 },
    filtro: "",
    buscar: "",
    revFiltro: "pendientes",
    buscarViajes: "",
    horasDesde: "",       // filtro de horas de viaje a viaje ("HH:MM"; vacio = todo el dia)
    horasHasta: "",
    viajesAbiertos: false,
    revItem: null,
    urls: new Map()       // ruta de la foto -> { url, vence }
  };

  const el = (id) => document.getElementById(id);
  const esc = (v) => (typeof escapeHtml === "function")
    ? escapeHtml(v == null ? "" : String(v))
    : String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /* ---------- fechas, numeros y textos ---------- */
  function hoy(){
    try {
      return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    } catch (_) {
      return new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 10);
    }
  }
  function masDias(iso, n){
    const d = new Date(`${iso}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }
  function diasEntre(a, b){
    return Math.round((new Date(`${b}T12:00:00Z`) - new Date(`${a}T12:00:00Z`)) / 86400000);
  }
  function fechaLarga(iso){
    try {
      const t = new Date(`${iso}T12:00:00Z`).toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
      return t.charAt(0).toUpperCase() + t.slice(1);
    } catch (_) {
      return iso;
    }
  }
  function fechaCorta(iso){
    try {
      return new Date(`${iso}T12:00:00Z`).toLocaleDateString("es-CO", { day: "numeric", month: "short", timeZone: "UTC" }).replace(".", "");
    } catch (_) {
      return iso;
    }
  }
  // La base de datos manda las horas como "2026-11-18T18:22:12+00" (la zona sin los minutos)
  // y el navegador no las entiende asi: se completa a "+00:00" antes de leerlas.
  function tsMs(isoTs){
    if (!isoTs) return NaN;
    let t = String(isoTs).trim().replace(" ", "T");
    if (/[+-]\d{2}$/.test(t)) t += ":00";
    return Date.parse(t);
  }
  function horaDe(isoTs){
    const ms = tsMs(isoTs);
    if (isNaN(ms)) return "";
    return new Date(ms).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Bogota" });
  }
  function minutosDesde(isoTs){
    const t = tsMs(isoTs);
    return isNaN(t) ? null : Math.max(0, Math.round((Date.now() - t) / 60000));
  }
  function horasTxt(n){
    return n == null ? "" : `${Number(n).toLocaleString("es-CO", { maximumFractionDigits: 1 })} h`;
  }
  function minutosTxt(m){
    const a = Math.abs(Math.round(Number(m) || 0));
    if (a < 60) return `${a} min`;
    const h = Math.floor(a / 60);
    const r = a % 60;
    return r ? `${h} h ${r} min` : `${h} h`;
  }
  function numero(n){
    return Number(n || 0).toLocaleString("es-CO");
  }
  function plata(n){
    if (n == null || n === "") return "—";
    try {
      return Number(n).toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
    } catch (_) {
      return `$ ${numero(n)}`;
    }
  }
  function cedula(dni){
    const s = String(dni || "").trim();
    if (!s) return "";
    return /^\d+$/.test(s) ? `CC ${Number(s).toLocaleString("es-CO")}` : `CC ${s}`;
  }
  function sinTildes(s){
    return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  }
  // "703 - NNN123" -> { num: "703", resto: "NNN123" }
  function partirBus(bus){
    const s = String(bus || "").trim();
    if (!s) return { num: "", resto: "" };
    const p = s.split(/\s*-\s*/);
    return { num: p[0], resto: p.slice(1).join(" - ") };
  }
  function plural(n, uno, varios){
    return `${n} ${n === 1 ? uno : varios}`;
  }
  function numBus(v){
    const n = parseInt(String(v || "").replace(/\D/g, ""), 10);
    return isNaN(n) ? 1e9 : n;
  }

  /* ---------- quien puede ver y que base ---------- */
  function puedeVer(){
    try {
      return (typeof isSuperAdmin === "function" && isSuperAdmin())
        || (typeof isBaseOperator === "function" && isBaseOperator());
    } catch (_) {
      return false;
    }
  }
  function baseActiva(){
    try {
      if (typeof isBaseOperator === "function" && isBaseOperator()) return currentUserBase || "";
      return (typeof currentBase !== "undefined" && currentBase) ? currentBase : "";
    } catch (_) {
      return "";
    }
  }
  function etiquetaBase(b){
    return (typeof formatBaseLabel === "function") ? formatBaseLabel(b) : String(b || "");
  }
  function tabActiva(){
    const c = el("tab-novedades-base");
    return !!(c && c.classList.contains("active"));
  }
  function cliente(){
    return (typeof planillaSupabaseClient !== "undefined" && planillaSupabaseClient) ? planillaSupabaseClient : null;
  }

  // Se llama desde applyRoleRestrictions: la pestana solo existe para las cuentas
  // de base y el administrador.
  function actualizarVisibilidad(){
    const tab = document.querySelector('.tab[data-tab="novedades-base"]');
    if (!tab) return;
    const ver = puedeVer();
    tab.classList.toggle("hidden", !ver);
    meterPestanas(ver);   // v2.11.0: Despachos en vivo y Visor Excel van dentro de Mi base
    if (!ver) {
      olvidar();
      const cont = el("tab-novedades-base");
      if (cont && cont.classList.contains("active")) {
        cont.classList.remove("active");
        tab.classList.remove("active");
        document.querySelector('.tab[data-tab="programacion2"]')?.classList.add("active");
        el("tab-programacion2")?.classList.add("active");
      }
    }
  }
  window.updateNovedadesBaseTabVisibility = actualizarVisibilidad;

  /* ---------- estado y errores ---------- */
  function setEstado(txt, tipo){
    const e = el("nbEstado");
    if (!e) return;
    e.textContent = txt;
    e.className = `nb-estado${tipo ? ` nb-estado-${tipo}` : ""}`;
  }
  function errorEsperado(err){
    const c = String(err?.code || "");
    return c === "42501" || c === "22023" || c === "PGRST202";
  }
  function mensajeError(err, que){
    const c = String(err?.code || "");
    const m = String(err?.message || err || "");
    if (c === "PGRST202") return "Esta parte todavía no está activa en la base de datos.";
    if (c === "42501" || c === "22023") return m;
    if (!navigator.onLine || /fetch|network|Failed to fetch|NetworkError|abort/i.test(m)) {
      return "Sin conexión a internet. Se vuelve a intentar sola en un minuto.";
    }
    return `No se pudo cargar ${que}: ${m}`;
  }

  function olvidar(){
    ["novedades", "viajes", "fila", "cambios", "relevos", "conductores"].forEach((k) => {
      st.pedido[k]++;
      st.cargando[k] = false;
      st.cargadoEn[k] = 0;
    });
    st.datos = null;
    st.viajes = null;
    st.fila = null;
    st.cambios = null;
    st.relevos = null;
    st.conductores = null;
    st.urls.clear();
    ["nbResumen", "nbPersonal", "nbRevisar", "nbEntradas", "nbMotivos", "nbFaltan", "nbSalidas",
      "nbViajesResumen", "nbViajes", "nbFilaAviso", "nbMisBuses", "nbFila", "nbCambiosResumen", "nbCambios", "nbRelevosResumen", "nbRelevos",
      "nbConductoresResumen", "nbConductores"].forEach((id) => {
      const e = el(id);
      if (e) e.innerHTML = "";
    });
    ["nbCuentaRevisar", "nbCuentaEntradas", "nbCuentaMotivos", "nbCuentaFaltan", "nbCuentaSalidas",
      "nbCuentaViajes", "nbCuentaMisBuses", "nbNumRevisar", "nbCuentaCambios", "nbNumCambios", "nbCuentaRelevos", "nbNumRelevos",
      "nbCuentaConductores"].forEach((id) => {
      const e = el(id);
      if (e) e.textContent = "";
    });
    setEstado("Abra esta pestaña para ver su base.");
  }

  // Hasta que dia se puede ir: hoy (novedades y viajes) o hasta 7 dias adelante (cambios a la programacion).
  function diaMaximo(){
    return st.vista === "cambios" ? masDias(hoy(), DIAS_ADELANTE_CAMBIOS) : hoy();
  }

  function pintarCabeza(base){
    const t = el("nbTitulo");
    const s = el("nbSub");
    const f = el("nbFecha");
    const h = hoy();
    if (t) t.textContent = base ? `Mi base · ${etiquetaBase(base)}` : "Mi base";
    if (s) {
      s.textContent = EXTERNAS[st.vista] ? EXTERNAS[st.vista].nombre : st.vista === "fila"
        ? "Enturnamiento en vivo"
        : st.vista === "conductores" ? "Historial de conductores"
        : (st.fecha ? `${fechaLarga(st.fecha)}${st.fecha === h ? " · hoy" : ""}` : "");
    }
    const maxDia = diaMaximo();
    if (f) {
      f.max = maxDia;
      f.min = masDias(h, -DIAS_ATRAS);
      if (st.fecha && f.value !== st.fecha) f.value = st.fecha;
    }
    const sig = el("nbSiguiente");
    if (sig) sig.disabled = !st.fecha || st.fecha >= maxDia;
    const ant = el("nbAnterior");
    if (ant) ant.disabled = !st.fecha || st.fecha <= masDias(h, -DIAS_ATRAS);
    // La fila es en vivo y el historial es de todos los dias: no tienen dia para escoger.
    el("nbDia")?.classList.toggle("nb-dia-vivo", st.vista === "fila" || st.vista === "conductores");
    // v2.13.0: el Excel de los ingresos, salidas y relevos sale desde Novedades y Relevos
    el("nbExcel")?.classList.toggle("hidden", !(st.vista === "novedades" || st.vista === "relevos"));
  }

  /* ---------- carga ---------- */
  const QUE = {
    novedades: { rpc: RPC_NOVEDADES, txt: "las novedades", conFecha: true },
    viajes: { rpc: RPC_VIAJES, txt: "el viaje a viaje", conFecha: true },
    fila: { rpc: RPC_FILA, txt: "la fila", conFecha: false },
    cambios: { rpc: RPC_CAMBIOS, txt: "los cambios", conFecha: true },
    relevos: { rpc: RPC_RELEVOS, txt: "los relevos", conFecha: true },
    conductores: { rpc: RPC_HISTORIAL, txt: "el historial de conductores", conFecha: false }
  };

  async function cargar(opc = {}){
    if (!puedeVer()) return;
    const vista = opc.vista || st.vista;
    const q = QUE[vista];
    if (!q) return;   // Despachos y Visor se cargan solos
    if (!st.fecha) st.fecha = hoy();
    const base = baseActiva();
    pintarCabeza(base);
    if (!base) {
      olvidar();
      setEstado("Abra una base arriba (Abrir base) para ver sus novedades.", "info");
      return;
    }
    const cli = cliente();
    if (!cli) {
      setEstado("No hay conexión con la base de datos.", "err");
      return;
    }
    const pedido = ++st.pedido[vista];
    st.cargando[vista] = true;
    const btn = el("nbActualizar");
    if (btn && vista === st.vista) btn.disabled = true;
    if (!opc.silencioso && vista === st.vista) setEstado(`Cargando ${q.txt}…`, "cargando");
    try {
      const args = q.conFecha ? { p_fecha: st.fecha, p_base: etiquetaBase(base) } : { p_base: etiquetaBase(base) };
      if (vista === "conductores") args.p_hoja = hojaDeLaBase(base);
      const { data, error } = await cli.rpc(q.rpc, args);
      if (pedido !== st.pedido[vista]) return;   // ya se pidio otro dia u otra base
      if (error) throw error;
      if (!data || !data.ok) throw new Error("La base de datos no devolvió los datos.");
      if (vista === "novedades") st.datos = data;
      else if (vista === "viajes") st.viajes = data;
      else if (vista === "cambios") st.cambios = data;
      else if (vista === "relevos") st.relevos = data;
      else if (vista === "conductores") st.conductores = data;
      else st.fila = data;
      st.cargadoEn[vista] = Date.now();
      if (vista === st.vista) {
        pintarVista(vista);
        const h = new Date().toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit" });
        const vivo = vista === "fila" || data.es_hoy;
        const cada = vista === "fila" ? "30 segundos" : (vista === "viajes" || vista === "relevos") ? "2 minutos" : "minuto";
        if (vista === "cambios") setEstado(`Actualizado a las ${h}${data.es_hoy ? " · se actualiza solo cada minuto" : ""}`, "ok");
        if (vista !== "cambios") setEstado(`Actualizado a las ${h}${vivo ? ` · se actualiza solo cada ${cada}` : ""}`, "ok");
      }
      if (vista === "novedades") firmarFotos().catch((e) => console.warn("[mi-base] fotos:", e));
    } catch (err) {
      if (pedido !== st.pedido[vista]) return;
      if (vista === st.vista) setEstado(mensajeError(err, q.txt), "err");
      if (!opc.silencioso && !errorEsperado(err) && typeof reportError === "function" && navigator.onLine) {
        reportError(`No se pudo cargar ${q.txt} de la base`, err, {
          hint: "Toque Actualizar. Si vuelve a salir, envíe este error."
        });
      }
    } finally {
      if (pedido === st.pedido[vista]) {
        st.cargando[vista] = false;
        if (btn && vista === st.vista) btn.disabled = false;
      }
    }
  }

  function pintarVista(vista){
    if (vista === "novedades") pintar();
    else if (vista === "viajes") pintarViajes();
    else if (vista === "cambios") pintarCambios();
    else if (vista === "relevos") pintarRelevos();
    else if (vista === "conductores") pintarConductores();
    else pintarFila();
  }

  // v2.11.0 (19-nov-2026): "Despachos en vivo" y "Visor Excel" van DENTRO de Mi base (pedido del usuario). Su contenido
  // (#tab-despachos-realizados, #tab-visor) se pasa a Mi base solo para las cuentas que ven Mi base; para las demás sigue
  // siendo una pestaña. Se cargan igual que al abrir su pestaña, y isTabActive() sigue sirviendo: su contenido lleva la
  // clase "active" mientras se ve.
  const EXTERNAS = {
    despachos: { tab: "despachos-realizados", caja: "nbVistaDespachos", nombre: "Despachos en vivo" },
    visor: { tab: "visor", caja: "nbVistaVisor", nombre: "Visor Excel en línea" }
  };
  const EXT_ORIGEN = {};

  function meterPestanas(dentro){
    Object.keys(EXTERNAS).forEach((k) => {
      const x = EXTERNAS[k];
      const c = el("tab-" + x.tab);
      const t = document.querySelector(`.tab[data-tab="${x.tab}"]`);
      const caja = el(x.caja);
      if (!c || !caja) return;
      if (!EXT_ORIGEN[k]) EXT_ORIGEN[k] = { padre: c.parentNode, sig: c.nextSibling };
      if (dentro) {
        const estaba = !!(t && t.classList.contains("active"));
        if (c.parentNode !== caja) caja.appendChild(c);
        if (t) { t.classList.add("mb-dentro"); t.classList.remove("active"); }
        if (estaba) {   // estaba abierta como pestaña: se sigue viendo, ahora dentro de Mi base
          document.querySelectorAll(".tab-content").forEach((n) => n.classList.remove("active"));
          document.querySelector('.tab[data-tab="novedades-base"]')?.classList.add("active");
          el("tab-novedades-base")?.classList.add("active");
          mostrarExterna(k);
        }
      } else {
        if (c.parentNode === caja) EXT_ORIGEN[k].padre.insertBefore(c, EXT_ORIGEN[k].sig);
        if (t) t.classList.remove("mb-dentro");
        caja.classList.add("hidden");
        if (st.vista === k) st.vista = "novedades";
      }
    });
  }

  function mostrarExterna(v){
    st.vista = v;
    el("nbVistas")?.querySelectorAll(".nb-vista").forEach((b) => {
      const on = b.dataset.vista === v;
      b.classList.toggle("activa", on);
      b.setAttribute("aria-selected", on ? "true" : "false");
    });
    ["nbVistaNovedades", "nbVistaViajes", "nbVistaFila", "nbVistaCambios", "nbVistaRelevos", "nbVistaConductores"].forEach((id) => el(id)?.classList.add("hidden"));
    Object.keys(EXTERNAS).forEach((k) => {
      const on = k === v;
      el(EXTERNAS[k].caja)?.classList.toggle("hidden", !on);
      el("tab-" + EXTERNAS[k].tab)?.classList.toggle("active", on && tabActiva());
    });
    el("nbDia")?.classList.add("hidden");      // tienen su propio filtro de fechas
    el("nbEstado")?.classList.add("hidden");
    pintarCabeza(baseActiva());
    if (!tabActiva()) return;
    if (v === "despachos" && typeof loadDespachosPage === "function") loadDespachosPage({ resetPage: !despachosLoadedOnce });
    if (v === "visor" && typeof refreshVisorDateOptions === "function") {
      refreshVisorDateOptions()
        .then(() => renderLiveExcelPreview())
        .catch((err) => {
          console.error("No se pudo actualizar el visor:", err);
          renderLiveExcelPreview();
        });
    }
    if (typeof adjustDynamicTableViewport === "function") adjustDynamicTableViewport();
  }

  function ocultarExternas(){
    Object.keys(EXTERNAS).forEach((k) => {
      el(EXTERNAS[k].caja)?.classList.add("hidden");
      el("tab-" + EXTERNAS[k].tab)?.classList.remove("active");
    });
    el("nbDia")?.classList.remove("hidden");
    el("nbEstado")?.classList.remove("hidden");
  }

  function cambiarVista(v){
    if (EXTERNAS[v]) { mostrarExterna(v); return; }
    if (!QUE[v]) return;
    ocultarExternas();
    st.vista = v;
    if (st.fecha && st.fecha > diaMaximo()) {   // de Cambios (un dia futuro) a Novedades o Viaje a viaje: hoy
      st.fecha = hoy();
      st.datos = null;
      st.viajes = null;
      st.relevos = null;
    }
    el("nbVistas")?.querySelectorAll(".nb-vista").forEach((b) => {
      const on = b.dataset.vista === v;
      b.classList.toggle("activa", on);
      b.setAttribute("aria-selected", on ? "true" : "false");
    });
    el("nbVistaNovedades")?.classList.toggle("hidden", v !== "novedades");
    el("nbVistaViajes")?.classList.toggle("hidden", v !== "viajes");
    el("nbVistaFila")?.classList.toggle("hidden", v !== "fila");
    el("nbVistaCambios")?.classList.toggle("hidden", v !== "cambios");
    el("nbVistaRelevos")?.classList.toggle("hidden", v !== "relevos");
    el("nbVistaConductores")?.classList.toggle("hidden", v !== "conductores");
    pintarCabeza(baseActiva());
    const d = datosDe(v);
    const mismoDia = !QUE[v].conFecha || (d && d.fecha === st.fecha);
    if (d && mismoDia) {
      pintarVista(v);
      if (Date.now() - st.cargadoEn[v] > CADA_MS[v]) cargar({ silencioso: true });
    } else {
      cargar();
    }
  }

  /* ---------- fotos (bucket privado, firmadas por 10 min) ---------- */
  function fotoVigente(p){
    const f = st.urls.get(p);
    return !!f && f.vence > Date.now();
  }
  async function firmar(paths){
    const faltan = [...new Set((paths || []).filter((p) => p && !fotoVigente(p)))];
    const cli = cliente();
    if (!faltan.length || !cli) return;
    for (let i = 0; i < faltan.length; i += 100) {
      const lote = faltan.slice(i, i + 100);
      const { data, error } = await cli.storage.from(FOTO_BUCKET).createSignedUrls(lote, FOTO_SEG);
      if (error || !Array.isArray(data)) continue;
      const vence = Date.now() + (FOTO_SEG - 60) * 1000;
      data.forEach((r) => {
        if (r && r.path) st.urls.set(r.path, { url: r.signedUrl || "", vence });
      });
    }
  }
  function fotosBorradas(){
    return !!st.datos && diasEntre(st.datos.fecha, hoy()) > FOTO_DIAS;
  }
  async function firmarFotos(){
    const d = st.datos;
    if (!d || fotosBorradas()) return;
    // las de entrada, y las de salida que salen en Motivos escritos y en Por revisar
    const fotos = [];
    (d.entradas || []).forEach((e) => {
      fotos.push(e.foto);
      if (e.salida && ((e.salida.motivos && e.salida.motivos.length) || e.jornada_excedida)) fotos.push(e.salida.foto);
    });
    await firmar(fotos);
    if (d === st.datos) pintarFotos();
  }
  function fotoHtml(path, grande){
    const cls = `nb-foto${grande ? " nb-foto-grande" : ""}`;
    if (!path) return `<span class="${cls} sin" title="Sin foto"></span>`;
    const f = st.urls.get(path);
    const src = f && f.url ? ` src="${esc(f.url)}"` : "";
    const sin = (f && !f.url) || fotosBorradas() ? " sin" : "";
    return `<span class="${cls}${sin}"><img data-foto="${esc(path)}"${src} alt="Foto de la marca" loading="lazy" /></span>`;
  }
  function pintarFotos(){
    document.querySelectorAll("#tab-novedades-base img[data-foto], #nbModal img[data-foto]").forEach((img) => {
      const f = st.urls.get(img.dataset.foto);
      if (!f) return;
      if (f.url) {
        if (img.getAttribute("src") !== f.url) img.src = f.url;
        img.parentElement?.classList.remove("sin");
      } else {
        img.parentElement?.classList.add("sin");
      }
    });
  }

  /* ---------- lectura de los motivos ---------- */
  function leerMotivo(m){
    const t = String(m || "").trim();
    const partir = (s) => {
      const k = String(s).match(/^(.*?\))\s*:\s*([\s\S]+)$/);
      return k ? [k[1].trim(), k[2].trim()] : ["", String(s).trim()];
    };
    const limpiar = (d) => d
      .replace(/\bvs programada\b/i, "· turno de las")
      .replace(/\bvs su turno (\d+) de las\b/i, "· su turno $1 es a las");
    let r;
    if ((r = t.match(/^ENTRADA ANTES DE TIEMPO:\s*([\s\S]*)$/i))) {
      const [d, x] = partir(r[1]);
      return { tipo: "Entró antes de tiempo", cls: "warn", det: limpiar(d), txt: x };
    }
    if ((r = t.match(/^CAMBIO DE TURNO:\s*([\s\S]*)$/i))) {
      const [d, x] = partir(r[1]);
      return { tipo: "Cambio de turno", cls: "info", det: limpiar(d), txt: x };
    }
    if (/^(ENTRADA|SALIDA) \d{1,2}:\d{2} vs programada/i.test(t)) {
      const [d, x] = partir(t);
      return { tipo: /^SALIDA/i.test(t) ? "Salida fuera de horario" : "Entrada fuera de horario", cls: "warn", det: limpiar(d), txt: x };
    }
    if (/^Jornada de/i.test(t)) {
      const [d, x] = partir(t);
      return { tipo: "Jornada de más de 16 h", cls: "err", det: d, txt: x };
    }
    if ((r = t.match(/^Salida manual\.?\s*Motivo:\s*([\s\S]*)$/i))) {
      return { tipo: "Salida manual", cls: "mut", det: "", txt: r[1].trim() };
    }
    if (/^⚠/.test(t)) {
      return { tipo: "Revisar el tipo de marca", cls: "err", det: "", txt: t.replace(/^⚠\s*/, "") };
    }
    return { tipo: "Motivo", cls: "warn", det: "", txt: t };
  }

  // El motivo de una jornada de mas de 16 h: el de la tabla jornadas_excedidas o, si
  // todavia no llego ahi, el que quedo escrito en la marca de salida.
  function motivoJornada(e){
    if (e.jornada_excedida && e.jornada_excedida.motivo) return e.jornada_excedida.motivo;
    const m = ((e.salida && e.salida.motivos) || []).find((t) => /^Jornada de/i.test(String(t)));
    return m ? leerMotivo(m).txt : "";
  }

  /* =====================================================================
     A. NOVEDADES
     ===================================================================== */
  function entradaPorId(id){
    return ((st.datos && st.datos.entradas) || []).find((x) => String(x.id) === String(id)) || null;
  }
  function programadoDe(it){
    const partes = String(it.clave || "").split("|");
    const dni = partes[0];
    const turno = partes[2];
    return ((st.datos && st.datos.programados) || [])
      .find((p) => String(p.dni) === dni && String(p.turno ?? "") === String(turno ?? "")) || null;
  }

  // Lo que se muestra de cada novedad por revisar: tipo, hora, quien, que paso y la foto.
  function describir(it){
    const e = it.ref ? entradaPorId(it.ref) : null;
    const base = { tipo: "Novedad", cls: "warn", hora: "", nombre: it.nombre || "", dni: it.dni || "", bus: "", det: "", txt: "", foto: "", ref: it.ref };
    if (it.tipo === "motivo" && e) {
      const marca = it.de === "salida" ? e.salida : e;
      const ms = (marca && marca.motivos) || [];
      const r = leerMotivo(ms[0]);
      return {
        ...base, tipo: r.tipo, cls: r.cls, hora: `${it.de === "salida" ? "Salida" : "Entrada"} ${marca ? marca.hora : ""}`,
        bus: partirBus(e.bus).num, det: ms.map((m) => leerMotivo(m).det).filter(Boolean).join(" · "),
        txt: ms.map((m) => leerMotivo(m).txt).join(" / "), foto: marca ? marca.foto : ""
      };
    }
    if (it.tipo === "tarde" && e) {
      return {
        ...base, tipo: "Llegó tarde", cls: "err", hora: `Entrada ${e.hora}`, bus: partirBus(e.bus).num,
        det: `Su turno ${e.turno || ""} era a las ${e.hora_prog || "—"}: llegó ${minutosTxt(e.dif)} tarde. No escribió motivo.`, foto: e.foto
      };
    }
    if (it.tipo === "no_entro") {
      const p = programadoDe(it);
      const sigue = !!p && p.estado === "tarde";
      return {
        ...base, tipo: sigue ? "No ha entrado" : "No entró", cls: "err", hora: p ? `Turno ${p.turno} · ${p.hora_entrada}` : "",
        bus: p ? partirBus(p.bus).num : "",
        det: p ? (sigue ? `Debía entrar a las ${p.hora_entrada} y no ha marcado: van ${minutosTxt(p.minutos)}.`
          : `Debía entrar a las ${p.hora_entrada} y no marcó entrada.`) : ""
      };
    }
    if (it.tipo === "sin_cerrar" && e) {
      return {
        ...base, tipo: "Turno sin cerrar", cls: "err", hora: `Entrada ${e.hora}`, bus: partirBus(e.bus).num,
        det: `Entró a las ${e.hora} y no ha marcado la salida: van ${horasTxt(e.abierta_horas)}.`, foto: e.foto
      };
    }
    if (it.tipo === "jornada_larga" && e) {
      const mj = motivoJornada(e);
      const horas = (e.jornada_excedida && e.jornada_excedida.horas) || e.horas;
      return {
        ...base, tipo: "Jornada de más de 16 h", cls: "err", hora: `Entrada ${e.hora}${e.salida ? ` · Salida ${e.salida.hora}` : ""}`,
        bus: partirBus(e.bus).num, det: `Trabajó ${horasTxt(horas)}; Buk rechaza las de más de 16 h.${mj ? "" : " Sin explicar."}`,
        txt: mj, foto: e.salida ? e.salida.foto : e.foto
      };
    }
    return base;
  }

  function revisionTxt(r){
    if (!r) return "";
    const cuando = r.en ? `${fechaCorta(r.en.slice(0, 10))} ${r.en.slice(11, 16)}` : "";
    const veces = Number(r.veces) || 1;
    return `Revisada por ${r.por || ""}${cuando ? ` el ${cuando}` : ""}${veces > 1 ? ` (nota cambiada ${veces - 1} ${veces === 2 ? "vez" : "veces"})` : ""}`;
  }

  function pendientes(d){
    return ((d && d.por_revisar) || []).filter((r) => !r.revision);
  }

  function pintarRevisar(d){
    const box = el("nbRevisar");
    const todas = d.por_revisar || [];
    const pend = pendientes(d);
    el("nbCuentaRevisar").textContent = todas.length ? `${pend.length} de ${todas.length} sin revisar` : "";
    el("nbNumRevisar").textContent = pend.length ? String(pend.length) : "";
    const icono = document.querySelector("#nbH0 .nb-num-revisar");
    if (icono) {
      icono.textContent = pend.length ? "!" : "✓";
      icono.classList.toggle("nb-num-pendiente", pend.length > 0);
    }
    if (!todas.length) {
      box.innerHTML = `<div class="nb-vacio nb-vacio-ok">No hay novedades por revisar${d.es_hoy ? " hoy" : " ese día"}.</div>`;
      return;
    }
    const lista = st.revFiltro === "todas" ? todas : pend;
    if (!lista.length) {
      box.innerHTML = `<div class="nb-vacio nb-vacio-ok">Todas las novedades${d.es_hoy ? " de hoy" : " de ese día"} ya están revisadas.</div>`;
      return;
    }
    const puede = !!d.puede_revisar;
    // v2.11.0 (19-nov-2026): lo más grave primero (no entró, sin cerrar, tarde...) y al final las entradas antes de
    // tiempo; dentro de cada tipo, por hora. Arriba, un filtro por tipo con cuántas hay; abajo, páginas.
    const pos = (k) => { const i = ORDEN_REVISAR.indexOf(k); return i < 0 ? 50 : i; };
    const items = lista.map((it, i) => ({ it, x: describir(it), i }))
      .sort((a, b) => pos(a.x.tipo) - pos(b.x.tipo) || a.i - b.i);
    const tipos = [];
    const porTipo = {};
    items.forEach((o) => {
      if (!porTipo[o.x.tipo]) { porTipo[o.x.tipo] = { n: 0, cls: o.x.cls }; tipos.push(o.x.tipo); }
      porTipo[o.x.tipo].n++;
    });
    if (st.revTipo && !porTipo[st.revTipo]) st.revTipo = "";
    const firma = `${d.fecha}|${st.revFiltro}|${st.revTipo || ""}`;
    if (st.revFirma !== firma) { st.revFirma = firma; st.revPagina = 1; }
    const vis = st.revTipo ? items.filter((o) => o.x.tipo === st.revTipo) : items;
    const paginas = Math.max(1, Math.ceil(vis.length / REV_POR_PAGINA));
    st.revPagina = Math.min(Math.max(1, st.revPagina || 1), paginas);
    const desde = (st.revPagina - 1) * REV_POR_PAGINA;
    const pagina = vis.slice(desde, desde + REV_POR_PAGINA);
    const filtros = tipos.length > 1
      ? `<div class="nb-rev-filtros" role="group" aria-label="Ver por tipo">`
        + `<button type="button" class="nb-rev-tipo${st.revTipo ? "" : " activo"}" data-t="">Todas <b>${items.length}</b></button>`
        + tipos.map((k) => `<button type="button" class="nb-rev-tipo${st.revTipo === k ? " activo" : ""}" data-t="${esc(k)}">`
          + `<i class="nb-rev-punto ${porTipo[k].cls}"></i>${esc(k)} <b>${porTipo[k].n}</b></button>`).join("")
        + `</div>`
      : "";
    box.innerHTML = (puede ? "" : `<div class="nb-vacio">Las revisa la cuenta de la base; aquí se ve lo que lleva.</div>`)
      + filtros
      + `<div class="nb-rev-lista">${pagina.map((o) => tarjetaRevisar(o.it, o.x, puede)).join("")}</div>`
      + paginador(vis.length, desde, pagina.length, paginas);
  }

  // "1–10 de 31" y los botones de página (en el celular solo Anterior, la actual y Siguiente).
  function paginador(total, desde, n, paginas){
    const txt = `<span class="nb-pag-txt">${total ? `${desde + 1}–${desde + n} de ${total}` : "0"}</span>`;
    if (paginas <= 1) return `<div class="nb-pag">${txt}</div>`;
    const p = st.revPagina;
    const nums = [];
    for (let i = 1; i <= paginas; i++) {
      if (i === 1 || i === paginas || Math.abs(i - p) <= 1) nums.push(i);
      else if (nums[nums.length - 1] !== "…") nums.push("…");
    }
    return `<div class="nb-pag" role="navigation" aria-label="Páginas de Por revisar">${txt}<div class="nb-pag-btns">`
      + `<button type="button" class="nb-pag-btn" data-pag="prev"${p <= 1 ? " disabled" : ""}>‹ Anterior</button>`
      + nums.map((x) => (x === "…" ? `<span class="nb-pag-gap">…</span>`
        : `<button type="button" class="nb-pag-btn nb-pag-num${x === p ? " activo" : ""}" data-pag="${x}"${x === p ? ' aria-current="page"' : ""}>${x}</button>`)).join("")
      + `<button type="button" class="nb-pag-btn" data-pag="next"${p >= paginas ? " disabled" : ""}>Siguiente ›</button>`
      + `</div></div>`;
  }

  // Una novedad: su tipo, la hora, quién y qué pasó.
  function tarjetaRevisar(it, x, puede){
    const hecha = !!it.revision;
    const accion = puede
      ? `<button type="button" class="btn ${hecha ? "btn-ghost" : "btn-primary"} nb-btn-revisar" data-tipo="${esc(it.tipo)}" data-clave="${esc(it.clave)}">${hecha ? "Cambiar nota" : "Revisar"}</button>`
      : (hecha ? "" : `<span class="nb-badge warn">Sin revisar</span>`);
    const abrir = x.ref ? ` data-id="${esc(x.ref)}" role="button" tabindex="0"` : "";
    return `<div class="nb-rev nb-m-${x.cls}${hecha ? " nb-rev-hecha" : ""}"${abrir}>`
      + `<span class="nb-motivo-foto">${x.foto ? fotoHtml(x.foto) : `<span class="nb-foto sin nb-foto-vacia"></span>`}</span>`
      + `<span class="nb-motivo-cuerpo">`
      + `<span class="nb-motivo-top"><span class="nb-badge ${x.cls}">${esc(x.tipo)}</span>${x.hora ? `<strong>${esc(x.hora)}</strong>` : ""}`
      + `<span class="nb-rev-quien">${esc(x.nombre)}</span>`
      + `<span class="nb-mut">${esc(cedula(x.dni))}${x.bus ? ` · Bus <b>${esc(x.bus)}</b>` : ""}</span></span>`
      + (x.det ? `<span class="nb-motivo-det">${esc(x.det)}</span>` : "")
      + (x.txt ? `<span class="nb-motivo-txt">“${esc(x.txt)}”</span>` : "")
      + (hecha ? `<span class="nb-rev-nota"><b>✔ ${esc(revisionTxt(it.revision))}:</b> ${esc(it.revision.nota)}</span>` : "")
      + `</span><span class="nb-rev-accion">${accion}</span></div>`;
  }

  function pintar(){
    const d = st.datos;
    if (!d) return;
    const x = derivar(d);
    pintarCabeza(d.base);
    pintarResumen(d, x);
    pintarPersonal(d);
    pintarRevisar(d);
    pintarEntradas();
    pintarMotivos(x);
    pintarFaltan(d, x);
    pintarSalidas(d, x);
  }

  function derivar(d){
    const E = Array.isArray(d.entradas) ? d.entradas : [];
    const P = Array.isArray(d.programados) ? d.programados : [];
    const turnos = P.filter((p) => p.puesto !== "DISPONIBLE");
    const disp = P.filter((p) => p.puesto === "DISPONIBLE");
    const motivos = [];
    E.forEach((e) => {
      (e.motivos || []).forEach((m) => motivos.push({ e, m, de: "entrada", hora: e.hora }));
      ((e.salida && e.salida.motivos) || []).forEach((m) => motivos.push({ e, m, de: "salida", hora: e.salida.hora }));
    });
    const abiertas = E.filter((e) => !e.salida);
    return {
      E,
      P,
      turnos,
      disp,
      motivos,
      conSalida: E.filter((e) => e.salida),
      sinCerrar: abiertas.filter((e) => Number(e.abierta_horas || 0) > SIN_CERRAR_H),
      enTurno: d.es_hoy ? abiertas.filter((e) => Number(e.abierta_horas || 0) <= SIN_CERRAR_H) : [],
      largas: E.filter((e) => e.jornada_excedida),
      tarde: turnos.filter((p) => p.estado === "tarde"),
      noEntro: turnos.filter((p) => p.estado === "no_entro"),
      proximos: turnos.filter((p) => p.estado === "proximo"),
      despues: turnos.filter((p) => p.estado === "despues"),
      cuenta: (k) => E.filter((e) => e.puntualidad === k).length
    };
  }

  function tile(num, titulo, sub, cls, destino){
    return `<button type="button" class="nb-tile${cls ? ` nb-tile-${cls}` : ""}${destino ? "" : " nb-tile-quieto"}"${destino ? ` data-ir="${destino}"` : ""}>`
      + `<span class="nb-tile-num">${esc(num)}</span>`
      + `<span class="nb-tile-tit">${esc(titulo)}</span>`
      + (sub ? `<span class="nb-tile-sub">${esc(sub)}</span>` : "")
      + `</button>`;
  }

  function pintarResumen(d, x){
    const faltan = x.tarde.length + x.noEntro.length;
    const pend = pendientes(d).length;
    const t = [];
    t.push(tile(pend, "Sin revisar", plural((d.por_revisar || []).length, "novedad", "novedades"), pend ? "err" : "ok", "nbSecRevisar"));
    t.push(tile(x.turnos.length, "Programados", x.disp.length ? plural(x.disp.length, "disponible", "disponibles") : "", "", "nbSecFaltan"));
    t.push(tile(x.E.length, "Entraron",
      `${x.cuenta("a_tiempo")} a tiempo · ${x.cuenta("temprano")} temprano · ${x.cuenta("tarde")} tarde`, "", "nbSecEntradas"));
    t.push(tile(faltan, d.es_hoy ? "Ya debían entrar" : "No entraron", "", faltan ? "err" : "ok", "nbSecFaltan"));
    if (d.es_hoy) t.push(tile(x.proximos.length, "Entran en la próxima hora", "", x.proximos.length ? "info" : "", "nbSecFaltan"));
    t.push(tile(x.motivos.length, "Con motivo escrito", "", x.motivos.length ? "warn" : "", "nbSecMotivos"));
    if (d.es_hoy) t.push(tile(x.enTurno.length, "En turno ahora", "", "", "nbSecSalidas"));
    t.push(tile(x.sinCerrar.length, "Sin cerrar", `más de ${SIN_CERRAR_H} h sin salida`, x.sinCerrar.length ? "err" : "", "nbSecSalidas"));
    t.push(tile(x.largas.length, "Más de 16 horas", "Buk las rechaza", x.largas.length ? "err" : "", "nbSecSalidas"));
    el("nbResumen").innerHTML = t.join("");
  }

  function pintarPersonal(d){
    const box = el("nbPersonal");
    const L = Array.isArray(d.estados_personal) ? d.estados_personal : [];
    if (!L.length) {
      box.innerHTML = `<div class="nb-personal-vacio">No hay estados del personal registrados para este día.</div>`;
      return;
    }
    const grupos = new Map();
    L.forEach((n) => {
      const k = n.estado || "OTRO";
      if (!grupos.has(k)) grupos.set(k, []);
      grupos.get(k).push(n.nombre || "");
    });
    const nombreEstado = (k) => k.charAt(0) + k.slice(1).toLowerCase();
    const chips = [...grupos.entries()].map(([k, v]) => `<span class="nb-pchip">${esc(nombreEstado(k))} <b>${v.length}</b></span>`).join("");
    const lista = [...grupos.entries()].map(([k, v]) =>
      `<div class="nb-pgrupo"><strong>${esc(nombreEstado(k))}</strong><span>${v.map(esc).join(" · ")}</span></div>`).join("");
    box.innerHTML = `<details class="nb-personal-det"><summary><span class="nb-personal-tit">Estados del personal</span>${chips}<span class="nb-ver">ver nombres</span></summary>`
      + `<div class="nb-personal-lista">${lista}</div></details>`;
  }

  function badgeLlegada(e){
    const p = LLEGADA[e.puntualidad] || LLEGADA.sin_programacion;
    if (e.puntualidad === "temprano" && e.dif != null) return `<span class="nb-badge warn">${esc(minutosTxt(e.dif))} antes</span>`;
    if (e.puntualidad === "tarde" && e.dif != null) return `<span class="nb-badge err">${esc(minutosTxt(e.dif))} tarde</span>`;
    if (e.puntualidad === "a_tiempo") {
      const det = e.dif ? `${minutosTxt(e.dif)} ${e.dif < 0 ? "antes" : "después"}` : "en punto";
      return `<span class="nb-badge ok">A tiempo</span><small>${esc(det)}</small>`;
    }
    return `<span class="nb-badge ${p.cls}">${esc(p.txt)}</span>`;
  }

  function celdaSalida(e){
    if (e.salida) {
      const otroDia = e.salida.fecha && e.salida.fecha !== e.fecha ? ` <small>(${esc(fechaCorta(e.salida.fecha))})</small>` : "";
      return `<span class="nb-sal"><strong>${esc(e.salida.hora)}</strong>${otroDia}</span><small>${esc(horasTxt(e.horas))}</small>`;
    }
    const h = Number(e.abierta_horas || 0);
    if (h > SIN_CERRAR_H) return `<span class="nb-badge err">Sin cerrar</span><small>van ${esc(horasTxt(h))}</small>`;
    if (st.datos && st.datos.es_hoy) return `<span class="nb-badge info">En turno</span><small>van ${esc(horasTxt(h))}</small>`;
    return `<span class="nb-badge mut">Sin salida</span>`;
  }

  function busHtml(e){
    const b = partirBus(e.bus);
    const prog = partirBus(e.bus_prog);
    if (!b.num && !prog.num) return `<span class="nb-mut">—</span>`;
    let h = `<span class="nb-bus">${esc(b.num || prog.num)}</span>`;
    if (b.resto) h += `<small>${esc(b.resto)}</small>`;
    if (b.num && prog.num && b.num !== prog.num) h += `<small class="nb-aviso">programado ${esc(prog.num)}</small>`;
    return h;
  }

  function pintarEntradas(){
    const box = el("nbEntradas");
    const d = st.datos;
    if (!box || !d) return;
    const E = Array.isArray(d.entradas) ? d.entradas : [];
    const q = sinTildes(st.buscar).trim();
    const lista = E.filter((e) => {
      if (st.filtro && e.puntualidad !== st.filtro) return false;
      if (!q) return true;
      return sinTildes(`${e.nombre} ${e.dni} ${e.bus} ${e.bus_prog}`).includes(q);
    });
    el("nbCuentaEntradas").textContent = E.length ? `${lista.length === E.length ? E.length : `${lista.length} de ${E.length}`}` : "";
    if (!E.length) {
      box.innerHTML = `<div class="nb-vacio">${d.es_hoy ? "Todavía no ha entrado ningún conductor de la base hoy." : "Ese día no entró ningún conductor de la base."}</div>`;
      return;
    }
    if (!lista.length) {
      box.innerHTML = `<div class="nb-vacio">Ninguna entrada coincide con el filtro.</div>`;
      return;
    }
    const cab = `<div class="nb-fila nb-fila-cab" aria-hidden="true"><span></span><span>Entró</span><span>Conductor</span><span>Bus</span><span>Llegó</span><span>Marcó en</span><span>Salida</span></div>`;
    box.innerHTML = cab + lista.map((e) => {
      const turno = e.turno ? `Turno ${e.turno} · ${e.hora_prog || ""}` : "Sin turno";
      const motivo = (e.motivos && e.motivos.length) || (e.salida && e.salida.motivos && e.salida.motivos.length)
        ? `<span class="nb-tiene-motivo" title="Tiene motivo escrito">motivo</span>` : "";
      return `<div class="nb-fila" data-id="${esc(e.id)}" role="button" tabindex="0" aria-label="Ver detalle de ${esc(e.nombre)}">`
        + `<span class="nb-c nb-c-foto">${fotoHtml(e.foto)}</span>`
        + `<span class="nb-c nb-c-hora"><strong>${esc(e.hora)}</strong><small>${esc(turno)}</small></span>`
        + `<span class="nb-c nb-c-quien"><strong>${esc(e.nombre)}</strong><small>${esc(cedula(e.dni))}</small>${motivo}</span>`
        + `<span class="nb-c nb-c-bus" data-l="Bus">${busHtml(e)}</span>`
        + `<span class="nb-c nb-c-llego" data-l="Llegó">${badgeLlegada(e)}</span>`
        + `<span class="nb-c nb-c-donde" data-l="Marcó en"><span>${esc(ORIGEN[e.origen] || e.origen || "—")}</span><small>${esc(e.punto || "")}</small></span>`
        + `<span class="nb-c nb-c-salida" data-l="Salida">${celdaSalida(e)}</span>`
        + `</div>`;
    }).join("");
  }

  function pintarMotivos(x){
    const box = el("nbMotivos");
    el("nbCuentaMotivos").textContent = x.motivos.length ? String(x.motivos.length) : "";
    if (!x.motivos.length) {
      box.innerHTML = `<div class="nb-vacio">Nadie tuvo que escribir un motivo${st.datos.es_hoy ? " hoy" : " ese día"}.</div>`;
      return;
    }
    const orden = x.motivos.slice().sort((a, b) => String(b.hora).localeCompare(String(a.hora)));
    box.innerHTML = orden.map(({ e, m, de }) => {
      const r = leerMotivo(m);
      const foto = de === "salida" ? (e.salida && e.salida.foto) : e.foto;
      const hora = de === "salida" ? e.salida.hora : e.hora;
      const bus = partirBus(e.bus).num;
      return `<div class="nb-motivo nb-m-${r.cls}" data-id="${esc(e.id)}" role="button" tabindex="0" aria-label="Ver detalle de ${esc(e.nombre)}">`
        + `<span class="nb-motivo-foto">${fotoHtml(foto)}</span>`
        + `<span class="nb-motivo-cuerpo">`
        + `<span class="nb-motivo-top"><span class="nb-badge ${r.cls}">${esc(r.tipo)}</span>`
        + `<strong>${esc(de === "salida" ? "Salida" : "Entrada")} ${esc(hora)}</strong>`
        + `<span class="nb-mut">${esc(e.nombre)} · ${esc(cedula(e.dni))}${bus ? ` · Bus ${esc(bus)}` : ""}</span></span>`
        + (r.det ? `<span class="nb-motivo-det">${esc(r.det)}</span>` : "")
        + `<span class="nb-motivo-txt">“${esc(r.txt)}”</span>`
        + `</span></div>`;
    }).join("");
  }

  function item(p, badge){
    const bus = partirBus(p.bus).num;
    return `<div class="nb-item">`
      + `<span class="nb-item-quien"><strong>${esc(p.nombre || "")}</strong><small>${esc(cedula(p.dni))}</small></span>`
      + `<span class="nb-item-dato">${bus ? `Bus <b>${esc(bus)}</b>` : `<span class="nb-mut">Sin bus</span>`}</span>`
      + `<span class="nb-item-dato">${p.puesto === "DISPONIBLE" ? "Disponible" : `Turno ${esc(p.turno)}`} · ${esc(p.hora_entrada || "")}${p.puesto && p.puesto !== "DISPONIBLE" ? ` <small>${esc(p.puesto.toLowerCase())}</small>` : ""}</span>`
      + `<span class="nb-item-badge">${badge}</span>`
      + `</div>`;
  }

  function grupo(titulo, cls, n, cuerpo, abierto){
    if (!n) return "";
    return `<details class="nb-grupo nb-grupo-${cls}"${abierto ? " open" : ""}><summary><span class="nb-grupo-tit">${esc(titulo)}</span><span class="nb-grupo-n">${n}</span></summary>`
      + `<div class="nb-grupo-cuerpo">${cuerpo}</div></details>`;
  }

  function pintarFaltan(d, x){
    const box = el("nbFaltan");
    const partes = [];
    partes.push(grupo("Ya debían entrar", "err", x.tarde.length,
      x.tarde.map((p) => item(p, `<span class="nb-badge err">van ${esc(minutosTxt(p.minutos))}</span>`)).join(""), true));
    partes.push(grupo(d.es_hoy ? "No entraron (pasaron más de 6 h)" : "No entraron", "err", x.noEntro.length,
      x.noEntro.map((p) => item(p, `<span class="nb-badge err">no marcó</span>`)).join(""), true));
    partes.push(grupo("Entran en la próxima hora", "info", x.proximos.length,
      x.proximos.map((p) => item(p, `<span class="nb-badge info">en ${esc(minutosTxt(p.minutos))}</span>`)).join(""), true));
    const dispTxt = (p) => {
      if (p.estado === "entro") return `<span class="nb-badge ok">Entró ${esc(p.entrada_hora || "")}</span>`;
      return `<span class="nb-badge mut">${d.es_hoy ? "No ha marcado" : "No marcó"}</span>`;
    };
    partes.push(grupo("Disponibles del día (turno de 2:00 a 9:00)", "mut", x.disp.length, x.disp.map((p) => item(p, dispTxt(p))).join(""), true));
    partes.push(grupo("Entran más tarde", "mut", x.despues.length,
      x.despues.map((p) => item(p, `<span class="nb-badge mut">a las ${esc(p.hora_entrada || "")}</span>`)).join(""), false));
    const cuerpo = partes.filter(Boolean).join("");
    const faltan = x.tarde.length + x.noEntro.length;
    el("nbCuentaFaltan").textContent = faltan ? String(faltan) : "";
    if (cuerpo) {
      box.innerHTML = (faltan ? "" : `<div class="nb-vacio nb-vacio-ok">${x.turnos.length ? "Todos los programados que ya debían entrar, entraron." : "No hay programación de la base para este día."}</div>`) + cuerpo;
    } else {
      box.innerHTML = `<div class="nb-vacio">${x.turnos.length ? "Todos los programados entraron." : "No hay programación de la base para este día."}</div>`;
    }
  }

  function filaSalida(e, badge){
    const bus = partirBus(e.bus).num;
    const sal = e.salida
      ? `${esc(e.salida.hora)}${e.salida.fecha && e.salida.fecha !== e.fecha ? ` <small>(${esc(fechaCorta(e.salida.fecha))})</small>` : ""}`
      : "—";
    return `<div class="nb-item nb-item-click" data-id="${esc(e.id)}" role="button" tabindex="0">`
      + `<span class="nb-item-quien"><strong>${esc(e.nombre || "")}</strong><small>${esc(cedula(e.dni))}</small></span>`
      + `<span class="nb-item-dato">${bus ? `Bus <b>${esc(bus)}</b>` : `<span class="nb-mut">Sin bus</span>`}</span>`
      + `<span class="nb-item-dato">Entró <b>${esc(e.hora)}</b> · Salió <b>${sal}</b></span>`
      + `<span class="nb-item-badge">${badge}</span>`
      + `</div>`;
  }

  function pintarSalidas(d, x){
    const box = el("nbSalidas");
    const partes = [];
    partes.push(grupo("Sin cerrar", "err", x.sinCerrar.length,
      x.sinCerrar.map((e) => filaSalida(e, `<span class="nb-badge err">van ${esc(horasTxt(e.abierta_horas))}</span>`)).join(""), true));
    partes.push(grupo("Jornadas de más de 16 horas", "err", x.largas.length,
      x.largas.map((e) => {
        const je = e.jornada_excedida || {};
        const mj = motivoJornada(e);
        const motivo = mj ? `<span class="nb-motivo-txt nb-motivo-chico">“${esc(mj)}”</span>` : `<span class="nb-badge err">Sin explicar</span>`;
        return filaSalida(e, `<span class="nb-badge err">${esc(horasTxt(je.horas || e.horas))}</span>`) + `<div class="nb-item-extra">${motivo}</div>`;
      }).join(""), true));
    if (d.es_hoy) {
      partes.push(grupo("En turno ahora", "info", x.enTurno.length,
        x.enTurno.map((e) => filaSalida(e, `<span class="nb-badge info">van ${esc(horasTxt(e.abierta_horas))}</span>`)).join(""), false));
    }
    const ordenSal = x.conSalida.slice().sort((a, b) => `${b.salida.fecha} ${b.salida.hora}`.localeCompare(`${a.salida.fecha} ${a.salida.hora}`));
    partes.push(grupo("Salidas del día", "ok", ordenSal.length,
      ordenSal.map((e) => filaSalida(e, `<span class="nb-badge ${e.jornada_excedida ? "err" : "ok"}">${esc(horasTxt(e.horas))}</span>`)).join(""), true));
    const malas = x.sinCerrar.length + x.largas.length;
    el("nbCuentaSalidas").textContent = malas ? String(malas) : "";
    const cuerpo = partes.filter(Boolean).join("");
    box.innerHTML = cuerpo || `<div class="nb-vacio">${d.es_hoy ? "Todavía no ha salido nadie." : "No hubo salidas ese día."}</div>`;
  }

  /* ---------- detalle de una marca ---------- */
  function bloqueMarca(titulo, m, fechaEntrada){
    if (!m) return "";
    const otroDia = m.fecha && fechaEntrada && m.fecha !== fechaEntrada ? ` (${fechaCorta(m.fecha)})` : "";
    const motivos = (m.motivos || []).map((t) => {
      const r = leerMotivo(t);
      return `<div class="nb-det-motivo"><span class="nb-badge ${r.cls}">${esc(r.tipo)}</span>${r.det ? `<small>${esc(r.det)}</small>` : ""}<span class="nb-motivo-txt">“${esc(r.txt)}”</span></div>`;
    }).join("");
    return `<div class="nb-det-col"><h5>${esc(titulo)} · ${esc(m.hora)}${esc(otroDia)}</h5>${fotoHtml(m.foto, true)}`
      + `<div class="nb-det-datos"><span>${esc(ORIGEN[m.origen] || m.origen || "")}</span>${m.punto ? `<span>${esc(m.punto)}</span>` : ""}</div>`
      + motivos + `</div>`;
  }

  function abrirDetalle(id){
    const d = st.datos;
    const e = d && (d.entradas || []).find((x) => String(x.id) === String(id));
    if (!e) return;
    el("nbModal")?.querySelector(".nb-modal-card")?.classList.remove("nb-modal-relevo");
    const bus = partirBus(e.bus);
    el("nbModalTitulo").textContent = e.nombre || "Conductor";
    el("nbModalSub").textContent = [
      cedula(e.dni),
      bus.num ? `Bus ${bus.num}${bus.resto ? ` (${bus.resto})` : ""}` : "",
      e.turno ? `Turno ${e.turno} a las ${e.hora_prog || ""}` : "Sin turno programado",
      fechaLarga(e.fecha)
    ].filter(Boolean).join(" · ");
    const llegada = `<div class="nb-det-llegada">${badgeLlegada(e)}</div>`;
    const salida = e.salida
      ? bloqueMarca("Salida", e.salida, e.fecha)
      : `<div class="nb-det-col"><h5>Salida</h5><div class="nb-det-vacio">${celdaSalida(e)}</div></div>`;
    const mj = motivoJornada(e);
    const je = e.jornada_excedida
      ? `<div class="nb-det-jornada"><span class="nb-badge err">Jornada de ${esc(horasTxt(e.jornada_excedida.horas))}</span> ${mj ? `<span class="nb-motivo-txt">“${esc(mj)}”</span>` : "<b>Sin explicar</b>"}</div>`
      : (e.horas != null ? `<div class="nb-det-jornada">Jornada de <b>${esc(horasTxt(e.horas))}</b></div>` : "");
    const revs = (d.por_revisar || []).filter((r) => String(r.ref) === String(e.id) && r.revision);
    const notas = revs.map((r) => `<div class="nb-rev-nota"><b>✔ ${esc(revisionTxt(r.revision))}:</b> ${esc(r.revision.nota)}</div>`).join("");
    const nota = fotosBorradas() ? `<div class="nb-det-nota">Las fotos se guardan ${FOTO_DIAS} días; las de este día ya se borraron.</div>` : "";
    el("nbModalCuerpo").innerHTML = llegada + `<div class="nb-det">${bloqueMarca("Entrada", e, e.fecha)}${salida}</div>` + je + notas + nota
      + `<div class="nb-det-relevo" id="nbDetRelevo" data-id="${esc(e.id)}"></div>`;
    el("nbModal").classList.remove("hidden");
    el("nbModalCerrar")?.focus();
    if (!fotosBorradas()) firmar([e.foto, e.salida && e.salida.foto]).then(pintarFotos).catch(() => {});
    relevoDelConductor(e).catch((err) => console.warn("[mi-base] relevo del conductor:", err?.message || err));
  }
  // Su relevo de ese día (turno 1 = le entregó el carro a; turno 2 = recibió el carro de), con el GPS del carro.
  const relevosDia = new Map();
  async function relevosDelDia(fecha){
    const base = baseActiva();
    const cli = cliente();
    if (!base || !cli || !fecha) return null;
    const clave = `${fecha}|${etiquetaBase(base)}`;
    const c = relevosDia.get(clave);
    if (c && Date.now() - c.en < CADA_MS.relevos) return c.data;
    const { data, error } = await cli.rpc(RPC_RELEVOS, { p_fecha: fecha, p_base: etiquetaBase(base) });
    if (error) {
      if (errorEsperado(error)) return null;
      throw error;
    }
    if (!data || !data.ok) return null;
    relevosDia.set(clave, { en: Date.now(), data });
    return data;
  }
  async function relevoDelConductor(e){
    const bus = partirBus(e.bus).num || partirBus(e.bus_prog).num;
    const turno = String(e.turno || "");
    const caja = () => {
      const b = el("nbDetRelevo");
      return b && b.dataset.id === String(e.id) && !el("nbModal")?.classList.contains("hidden") ? b : null;
    };
    if (!bus || (turno !== "1" && turno !== "2") || !caja()) return;
    caja().innerHTML = `<div class="nb-mut">Buscando el relevo del bus ${esc(bus)}…</div>`;
    const d = await relevosDelDia(e.fecha);
    const box = caja();
    if (!box) return;   // ya la cerraron o abrieron otra
    const r = d && (d.relevos || []).find((x) => String(x.interno) === String(bus));
    if (!r) {
      box.innerHTML = d ? `<div class="nb-mut">El bus ${esc(bus)} no tiene relevo ese día (turno 1 y turno 2 de personas distintas).</div>` : "";
      return;
    }
    const quien = turno === "1"
      ? `Le entregó el carro a <b>${esc(r.recibe_nombre || "—")}</b> (conductor 2)`
      : `Recibió el carro de <b>${esc(r.entrega_nombre || "—")}</b> (conductor 1)`;
    box.innerHTML = `<h5>Relevo del bus ${esc(bus)} · ${esc(r.relevo)} en ${esc(lugarRelevo(r.punto))}</h5>`
      + `<div class="nb-det-rl-quien">${quien}</div>`
      + `<div class="nb-det-rl-entrega"><span class="nb-rl-rol">Entrega del carro</span> ${entregaRelevo(r)}<div>${porqueRelevo(r)}</div></div>`
      + `<div class="nb-det-rl-cond">${conductoresRelevo(r, e.fecha)}</div>`
      + `<button type="button" class="btn btn-secondary nb-det-rl-fotos">Ver las fotos de los dos conductores</button>`;
    box.querySelector(".nb-det-rl-fotos")?.addEventListener("click", () => pintarRelevoModal(r, e.fecha));
  }
  function cerrarDetalle(){
    xl.cancelado = true;
    cerrarFotoGrande();
    el("nbModal")?.classList.add("hidden");
    el("nbModal")?.querySelector(".nb-modal-card")?.classList.remove("nb-modal-relevo");
  }

  /* ---------- revisar una novedad ---------- */
  function abrirRevisar(tipo, clave){
    const d = st.datos;
    const it = d && (d.por_revisar || []).find((r) => r.tipo === tipo && r.clave === clave);
    if (!it || !d.puede_revisar) return;
    st.revItem = it;
    const x = describir(it);
    el("nbRevTitulo").textContent = it.revision ? "Cambiar la nota de la revisión" : "Revisar novedad";
    el("nbRevSub").textContent = [x.nombre, cedula(x.dni), x.bus ? `Bus ${x.bus}` : "", fechaLarga(d.fecha)].filter(Boolean).join(" · ");
    el("nbRevQue").innerHTML = `<span class="nb-badge ${x.cls}">${esc(x.tipo)}</span>${x.hora ? ` <strong>${esc(x.hora)}</strong>` : ""}`
      + (x.det ? `<div class="nb-motivo-det">${esc(x.det)}</div>` : "")
      + (x.txt ? `<div class="nb-motivo-txt">“${esc(x.txt)}”</div>` : "")
      + (it.revision ? `<div class="nb-rev-nota">${esc(revisionTxt(it.revision))}</div>` : "");
    const ta = el("nbRevNota");
    ta.value = it.revision ? it.revision.nota : "";
    el("nbRevError").textContent = "";
    el("nbRevCuenta").textContent = `${ta.value.length}/500`;
    el("nbRevGuardar").disabled = false;
    el("nbRevModal").classList.remove("hidden");
    setTimeout(() => ta.focus(), 30);
  }
  function cerrarRevisar(){
    el("nbRevModal")?.classList.add("hidden");
    st.revItem = null;
  }
  async function guardarRevision(){
    const it = st.revItem;
    const d = st.datos;
    const cli = cliente();
    if (!it || !d || !cli) return;
    const nota = String(el("nbRevNota").value || "").replace(/\s+/g, " ").trim();
    if (nota.length < 5) {
      el("nbRevError").textContent = "Escriba qué se hizo (mínimo 5 letras).";
      el("nbRevNota").focus();
      return;
    }
    const btn = el("nbRevGuardar");
    btn.disabled = true;
    el("nbRevError").textContent = "";
    try {
      const { data, error } = await cli.rpc(RPC_REVISAR, { p_fecha: d.fecha, p_tipo: it.tipo, p_clave: it.clave, p_nota: nota });
      if (error) throw error;
      if (!data || !data.ok) throw new Error("No se guardó la revisión.");
      // La base de datos devuelve la revision guardada: se pinta sin esperar la proxima carga.
      (d.por_revisar || []).forEach((r) => {
        if (r.tipo === it.tipo && r.clave === it.clave) r.revision = data.revision;
      });
      cerrarRevisar();
      pintar();
      if (typeof showToast === "function") showToast("Revisión guardada.", "ok");
    } catch (err) {
      const c = String(err?.code || "");
      el("nbRevError").textContent = (c === "42501" || c === "22023")
        ? String(err.message || "")
        : (!navigator.onLine ? "Sin conexión: no se guardó. Intente de nuevo." : `No se guardó: ${String(err?.message || err)}`);
      btn.disabled = false;
    }
  }

  /* =====================================================================
     B. VIAJE A VIAJE
     ===================================================================== */
  // Filtro de horas: cuenta el viaje que SALIO desde "desde" y antes de "hasta". El dia de la tarjeta va de 02:30 a
  // 02:30, asi que un rango como 18:00 a 02:00 pasa la medianoche (y "hasta" vacio es el fin del dia de la tarjeta).
  function minutosHora(t){
    const m = String(t || "").match(/^(\d{1,2}):(\d{2})/);
    return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
  }
  function filtroHoras(){
    if (!st.horasDesde && !st.horasHasta) return null;
    return { desde: st.horasDesde || INICIO_TARJETA, hasta: st.horasHasta || INICIO_TARJETA };
  }
  function enHoras(x, f){
    if (!f) return true;
    const m = minutosHora(x.salida || x.arranco);
    if (isNaN(m)) return false;
    const a = minutosHora(f.desde);
    const b = minutosHora(f.hasta);
    if (a === b) return true;
    return a < b ? (m >= a && m < b) : (m >= a || m < b);
  }
  function pintarHoras(){
    const d = el("nbHoraDesde");
    const h = el("nbHoraHasta");
    if (d && document.activeElement !== d) d.value = st.horasDesde;
    if (h && document.activeElement !== h) h.value = st.horasHasta;
    const actual = st.horasDesde || st.horasHasta ? `${st.horasDesde}-${st.horasHasta}` : "";
    el("nbHorasChips")?.querySelectorAll(".nb-chip").forEach((c) => c.classList.toggle("activo", (c.dataset.h || "") === actual));
  }

  function pintarViajes(){
    const v = st.viajes;
    if (!v) return;
    pintarCabeza(v.base);
    pintarHoras();
    const todos = Array.isArray(v.viajes) ? v.viajes : [];
    const fh = filtroHoras();
    const V = todos.filter((x) => enHoras(x, fh));
    const buses = Array.isArray(v.buses) ? v.buses.map(String) : [];
    const porBus = new Map();
    V.forEach((x) => {
      const k = String(x.interno || "");
      if (!porBus.has(k)) porBus.set(k, []);
      porBus.get(k).push(x);
    });
    const suma = (L, k) => L.reduce((a, x) => a + (Number(x[k]) || 0), 0);
    const llenos = V.filter((x) => x.pasajeros_conductor != null);
    const sinViaje = buses.filter((b) => !porBus.has(b)).length;
    const dif = suma(llenos, "diferencia_plata");
    const t = [];
    t.push(tile(`${porBus.size} de ${buses.length}`, "Buses con viajes", sinViaje ? `${sinViaje} sin viajes${fh ? " en esas horas" : ""}` : "", "", ""));
    t.push(tile(numero(V.length), "Viajes", fh ? `de ${fh.desde} a ${fh.hasta} · ${numero(todos.length)} en el día` : "", "", ""));
    t.push(tile(numero(suma(V, "pasajeros_sensor")), "Pasajeros (sensor)", "", "", ""));
    t.push(tile(`${llenos.length} de ${V.length}`, "Viajes que llenó el conductor", llenos.length ? `dijo ${numero(suma(llenos, "pasajeros_conductor"))} pasajeros` : "", llenos.length < V.length ? "warn" : "ok", ""));
    t.push(tile(plata(suma(V, "plata_sensor")), "Plata según el sensor", "", "", ""));
    t.push(tile(plata(suma(llenos, "plata_conductor")), "Plata según el conductor", llenos.length ? `en ${plural(llenos.length, "viaje", "viajes")}` : "", "", ""));
    t.push(tile(plata(dif), "Diferencia conductor − sensor", "solo los viajes que llenó", dif < 0 ? "err" : "", ""));
    // Los totales en tres grupos con titulo: lo que se movio, lo que lleno el conductor y la plata.
    const grupo = (tit, tiles) => `<div class="nb-rgrupo"><div class="nb-rgrupo-tit">${esc(tit)}</div>`
      + `<div class="nb-rgrupo-tiles">${tiles.join("")}</div></div>`;
    el("nbViajesResumen").innerHTML = grupo("Buses y viajes", t.slice(0, 3)) + grupo("Tarjeta del conductor", t.slice(3, 4))
      + grupo("Plata", t.slice(4));

    const q = sinTildes(st.buscarViajes).trim();
    const orden = [...new Set([...buses, ...porBus.keys()])].sort((a, b) => numBus(a) - numBus(b));
    const visibles = orden.filter((bus) => {
      if (!q) return true;
      const L = porBus.get(bus) || [];
      return sinTildes(`${bus} ${L.map((x) => `${x.placa} ${x.conductor} ${x.ruta}`).join(" ")}`).includes(q);
    });
    el("nbCuentaViajes").textContent = !todos.length ? ""
      : fh ? `${numero(V.length)} de ${plural(todos.length, "viaje", "viajes")} · de ${fh.desde} a ${fh.hasta}` : plural(V.length, "viaje", "viajes");
    const box = el("nbViajes");
    if (!todos.length) {
      box.innerHTML = `<div class="nb-vacio">${v.es_hoy ? "Todavía no hay viajes de sus carros hoy." : "Ese día sus carros no tienen viajes."}</div>`;
      return;
    }
    if (!V.length) {
      box.innerHTML = `<div class="nb-vacio">Ningún viaje de sus carros salió de ${esc(fh.desde)} a ${esc(fh.hasta)}.</div>`;
      return;
    }
    const conViajes = visibles.filter((b) => porBus.has(b));
    const sinViajes = visibles.filter((b) => !porBus.has(b));
    const cabeza = conViajes.length ? `<div class="nb-buses-cab" aria-hidden="true"><span class="nb-bf-bus">Bus</span>`
      + `<span class="nb-bf-n">Viajes</span><span class="nb-bf-n">Pasajeros</span><span class="nb-bf-n">Llenó el conductor</span>`
      + `<span class="nb-bf-n">Plata (sensor)</span><span class="nb-bf-n">Último</span></div>` : "";
    box.innerHTML = cabeza + conViajes.map((bus) => {
      const L = porBus.get(bus);
      const placa = (L.find((x) => x.placa) || {}).placa || "";
      const filas = L.map((x) => {
        const avisos = [
          x.sin_despacho ? `<span class="nb-badge warn">Sin despacho</span>` : "",
          x.salio_cancelado ? `<span class="nb-badge err">Cancelado en Sonar</span>` : "",
          x.estado && x.estado !== "definitivo" ? `<span class="nb-badge info">En curso</span>` : ""
        ].join("");
        const dijo = x.pasajeros_conductor == null ? `<span class="nb-mut">no llenó</span>` : esc(x.pasajeros_conductor);
        const difP = x.pasajeros_conductor == null || x.diferencia == null || Number(x.diferencia) === 0 ? ""
          : ` <small class="${Number(x.diferencia) < 0 ? "nb-neg" : "nb-pos"}">(${Number(x.diferencia) > 0 ? "+" : ""}${esc(x.diferencia)})</small>`;
        return `<tr>`
          + `<td class="n">${esc(x.viaje ?? "")}</td>`
          + `<td class="nb-col-hora"><b>${esc(x.salida || "—")}</b>${x.llego ? `<small> → ${esc(x.llego)}</small>` : ""}</td>`
          + `<td class="nb-col-ruta">${esc(x.ruta || "")}${avisos ? `<div class="nb-avisos">${avisos}</div>` : ""}</td>`
          + `<td class="nb-col-cond">${esc(x.conductor || "")}</td>`
          + `<td class="n">${esc(x.pasajeros_sensor ?? "—")}${Number(x.personal) > 0 ? `<small> (${esc(x.personal)} personal)</small>` : ""}</td>`
          + `<td class="n">${dijo}${difP}</td>`
          + `<td class="n">${esc(x.civicas ?? "—")}</td>`
          + `<td class="n">${esc(x.tiquetes ?? "—")}</td>`
          + `<td class="n">${esc(plata(x.plata_sensor))}</td>`
          + `<td class="n">${x.plata_conductor == null ? `<span class="nb-mut">—</span>` : esc(plata(x.plata_conductor))}</td>`
          + `</tr>`;
      }).join("");
      // El ultimo viaje del dia de la tarjeta (despues de medianoche cuenta como mas tarde).
      const ordenTarjeta = (h) => { const m = minutosHora(h); return isNaN(m) ? -1 : (m < minutosHora(INICIO_TARJETA) ? m + 1440 : m); };
      const ultimo = L.map((x) => x.salida).filter(Boolean).sort((a, b) => ordenTarjeta(a) - ordenTarjeta(b)).pop();
      const lleno = L.filter((x) => x.pasajeros_conductor != null).length;
      return `<details class="nb-bus-viajes"${st.viajesAbiertos ? " open" : ""}><summary class="nb-bus-fila">`
        + `<span class="nb-bf-bus"><span class="nb-bus">${esc(bus)}</span> <small>${esc(placa)}</small></span>`
        + `<span class="nb-bf-n" data-l="Viajes">${esc(numero(L.length))}</span>`
        + `<span class="nb-bf-n" data-l="Pasajeros">${esc(numero(suma(L, "pasajeros_sensor")))}</span>`
        + `<span class="nb-bf-n${lleno < L.length ? " nb-bf-falta" : ""}" data-l="Llenó el conductor">${esc(`${lleno} de ${L.length}`)}</span>`
        + `<span class="nb-bf-n nb-bf-plata" data-l="Plata">${esc(plata(suma(L, "plata_sensor")))}</span>`
        + `<span class="nb-bf-n" data-l="Último">${esc(ultimo || "—")}</span></summary>`
        + `<div class="nb-tabla-caja"><table class="nb-tabla nb-tabla-viajes"><thead><tr><th class="n">#</th><th>Salió</th><th>Ruta</th><th>Conductor</th>`
        + `<th class="n">Pasajeros sensor</th><th class="n">Dijo el conductor</th><th class="n">Cívicas</th><th class="n">Tiquetes</th>`
        + `<th class="n">Plata sensor</th><th class="n">Plata conductor</th></tr></thead><tbody>${filas}</tbody></table></div></details>`;
    }).join("") + (sinViajes.length ? `<div class="nb-vacio">${fh ? "Sin viajes en esas horas" : "Sin viajes este día"}: ${sinViajes.map((b) => `<b>${esc(b)}</b>`).join(", ")}</div>` : "")
      + (!conViajes.length && !sinViajes.length ? `<div class="nb-vacio">Ningún bus coincide con la búsqueda.</div>` : "");
  }

  /* =====================================================================
     C. ENTURNAMIENTO (fila en vivo)
     ===================================================================== */
  // Como entro a la fila: solo se marca lo que no es lo normal (llegar con despacho).
  function comoEntro(r){
    if (r.llegada_tipo === "a_mano") return ` <span class="nb-badge info" title="Lo metieron a mano desde el Portal de Control">A mano</span>`;
    if (r.llegada_tipo === "vigilante") return r.itinerario_id ? ` <span class="nb-badge warn">Vigilante</span>` : ` <span class="nb-badge warn" title="Parqueado sin despacho: lo metió el vigilante de la fila">Parqueado</span>`;
    return "";
  }

  // La fila de cada punto ya ordenada como se muestra; en el Aeropuerto, por itinerario.
  function filaPorPunto(f){
    const porPunto = {};
    (f.filas || []).forEach((r) => { (porPunto[r.punto] || (porPunto[r.punto] = [])).push(r); });
    const puntos = PUNTOS_FILA.concat(Object.keys(porPunto).filter((p) => PUNTOS_FILA.indexOf(p) < 0).sort());
    const orden = (a, b) => (a.pos == null) - (b.pos == null) || (a.pos || 0) - (b.pos || 0)
      || (tsMs(a.llego_en) || 0) - (tsMs(b.llego_en) || 0);
    return puntos.map((p) => {
      const lista = (porPunto[p] || []).slice().sort(orden);
      let grupos;
      if (p === PUNTO_POR_ITINERARIO) {
        const g = {};
        lista.forEach((r) => { const k = r.itinerario || "Sin itinerario"; (g[k] || (g[k] = [])).push(r); });
        grupos = Object.keys(g).sort((a, b) => (a === "Sin itinerario") - (b === "Sin itinerario") || a.localeCompare(b, "es"))
          .map((k) => ({ nombre: k, filas: g[k] }));
      } else {
        grupos = lista.length ? [{ nombre: "", filas: lista }] : [];
      }
      return { punto: p, total: lista.length, mios: lista.filter((r) => r.mio).length, grupos };
    });
  }

  function pintarFila(){
    const f = st.fila;
    if (!f) return;
    pintarCabeza(f.base);
    const pub = tsMs(f.publicada_en);
    const vieja = isNaN(pub) || Date.now() - pub > FILA_VIEJA_MS;
    el("nbFilaAviso").innerHTML = vieja
      ? `<div class="nb-vacio nb-vacio-err">El programa de la fila no publica desde ${isNaN(pub) ? "hace rato" : `las ${esc(horaDe(f.publicada_en))}`}: la lista puede estar vieja.</div>`
      : `<div class="nb-fila-pub">Fila al día: publicada a las <b>${esc(horaDe(f.publicada_en))}</b>. Se actualiza sola cada 30 segundos.</div>`;

    const puntos = filaPorPunto(f);
    // Donde esta cada bus suyo en la fila: el mismo turno que sale en la tabla de su punto.
    const enFila = new Map();
    puntos.forEach((p) => p.grupos.forEach((g) => g.filas.forEach((r, i) => {
      if (r.mio) enFila.set(String(r.interno), { punto: p.punto, turno: i + 1, de: g.filas.length, grupo: g.nombre, r });
    })));

    // Sus buses ahora. La fila manda: si el bus esta en una fila, sale ahi aunque ya tenga su
    // siguiente despacho. Si a un bus le cambiaron el GPS sale dos veces: se queda el del GPS mas nuevo.
    const por = new Map();
    (f.mis_buses || []).forEach((b) => {
      const k = String(b.interno || "");
      const prev = por.get(k);
      if (!prev || (tsMs(b.gps_en) || 0) > (tsMs(prev.gps_en) || 0)) por.set(k, b);
    });
    enFila.forEach((x, k) => { if (!por.has(k)) por.set(k, { interno: k, conductor: x.r.conductor }); });
    const lugarDe = (b) => enFila.has(String(b.interno)) ? "fila"
      : b.estado === "despachado" ? "ruta" : b.estado === "quieto" ? "quieto" : "sin";
    const ordenPunto = (p) => { const i = PUNTOS_FILA.indexOf(p); return i < 0 ? 99 : i; };
    const mis = [...por.values()];
    const cuenta = {};
    mis.forEach((b) => { const l = lugarDe(b); cuenta[l] = (cuenta[l] || 0) + 1; });
    el("nbCuentaMisBuses").textContent = mis.length
      ? `${plural(mis.length, "bus", "buses")} · ${LUGARES.filter((l) => cuenta[l.k]).map((l) => `${cuenta[l.k]} ${l.txt.toLowerCase()}`).join(" · ")}` : "";
    const filaBus = (b) => {
      const fi = enFila.get(String(b.interno));
      let donde;
      if (fi) donde = `<b>${esc(fi.punto)}</b> · turno <b>${fi.turno}</b> de ${fi.de}${fi.grupo ? ` <small>${esc(fi.grupo)}</small>` : ""}`;
      else if (b.estado === "despachado") donde = b.itinerario ? esc(b.itinerario) : "Con despacho";
      else donde = b.punto ? esc(b.punto) : `<span class="nb-mut">—</span>`;
      const gps = minutosDesde(b.gps_en);
      const gpsTxt = gps == null ? `<span class="nb-badge err">Sin GPS</span>`
        : gps > 15 ? `<span class="nb-badge warn">hace ${esc(minutosTxt(gps))}</span>` : `<span class="nb-mut">hace ${esc(minutosTxt(gps))}</span>`;
      return `<tr${fi ? ` class="nb-mio"` : ""}><td class="nb-td-bus"><span class="nb-bus">${esc(b.interno)}</span> <small>${esc(b.placa || "")}</small>${b.conductor ? `<div class="nb-mut nb-chico">${esc(b.conductor)}</div>` : ""}</td>`
        + `<td class="nb-td-donde">${donde}</td><td class="n" data-l="Viajes hoy">${esc(b.viajes_hoy ?? 0)}</td><td class="n" data-l="Pasajeros hoy">${esc(numero(b.movilizados_hoy))}</td>`
        + `<td data-l="Último viaje">${esc(horaDe(b.ultimo_viaje) || "—")}</td><td data-l="GPS">${gpsTxt}</td></tr>`;
    };
    el("nbMisBuses").innerHTML = mis.length ? `<div class="nb-tabla-caja"><table class="nb-tabla nb-tabla-buses"><thead><tr><th>Bus</th><th>Dónde está</th><th class="n">Viajes hoy</th><th class="n">Pasajeros hoy</th><th>Último viaje</th><th>GPS</th></tr></thead><tbody>`
      + LUGARES.filter((l) => cuenta[l.k]).map((l) => {
        const lista = mis.filter((b) => lugarDe(b) === l.k).sort(l.k === "fila"
          ? (a, b) => {
            const x = enFila.get(String(a.interno));
            const y = enFila.get(String(b.interno));
            return ordenPunto(x.punto) - ordenPunto(y.punto) || String(x.grupo).localeCompare(String(y.grupo), "es") || x.turno - y.turno;
          }
          : (a, b) => numBus(a.interno) - numBus(b.interno));
        return `<tr class="nb-fila-grupo nb-grupo-${l.k}"><th colspan="6"><span class="nb-badge ${l.cls}">${esc(l.txt)}</span> <small>${plural(lista.length, "bus", "buses")}</small></th></tr>`
          + lista.map(filaBus).join("");
      }).join("") + `</tbody></table></div>` : `<div class="nb-vacio">No se encontraron buses de la base en la flota.</div>`;

    // La fila de cada punto, como Control y la app del aeropuerto.
    const renglon = (r, i) => {
      const espera = minutosDesde(r.llego_en);
      return `<tr class="${r.mio ? "nb-mio" : ""}"><td class="n"><b>${i + 1}</b></td>`
        + `<td><span class="nb-bus">${esc(r.interno)}</span>${r.mio ? ` <span class="nb-badge ok">Suyo</span>` : ""}${comoEntro(r)}${r.mio && r.conductor ? `<div class="nb-mut nb-chico">${esc(r.conductor)}</div>` : ""}</td>`
        + `<td>${esc(horaDe(r.llego_en) || "—")}</td><td class="n">${espera == null ? "—" : esc(minutosTxt(espera))}</td></tr>`;
    };
    const cab = `<thead><tr><th class="n">Turno</th><th>Bus</th><th>Llegó</th><th class="n">Espera</th></tr></thead>`;
    el("nbFila").innerHTML = puntos.map((p) => {
      const cuerpo = !p.total ? `<p class="nb-mut nb-fila-vacia">Nadie esperando.</p>`
        : `<table class="nb-tabla">${cab}<tbody>` + p.grupos.map((g) =>
          (g.nombre ? `<tr class="nb-fila-grupo"><th colspan="4">${esc(g.nombre)} <small>${plural(g.filas.length, "bus", "buses")}</small></th></tr>` : "")
          + g.filas.map(renglon).join("")).join("") + `</tbody></table>`;
      return `<section class="nb-punto${p.mios ? " nb-punto-mio" : ""}${p.total ? "" : " nb-punto-vacio"}"><h5>${esc(p.punto)} <small>${plural(p.total, "bus", "buses")}${p.mios ? ` · <b>${p.mios} ${p.mios === 1 ? "suyo" : "suyos"}</b>` : ""}</small></h5>`
        + `<div class="nb-tabla-caja">${cuerpo}</div></section>`;
    }).join("");
  }


  /* =====================================================================
     D. CAMBIOS: quien cambio que (lo anota la base de datos al guardar)
     ===================================================================== */
  const CAMPO_TXT = {
    "VEH": "Bus", "PUESTO": "Puesto", "INICIA": "Inicia", "CONDUCTOR 1": "Conductor 1", "INICIA 2": "Inicia 2",
    "CONDUCTOR 2": "Conductor 2", "HORA FIN": "Hora fin", "__NOTE__CONDUCTOR 1": "Nota del conductor 1",
    "__NOTE__CONDUCTOR 2": "Nota del conductor 2", "ESTADO": "Estado"
  };
  function normCampo(c){
    return sinTildes(String(c || "")).toUpperCase().replace(/\s+/g, " ").trim();
  }
  // Quien hizo el cambio: la cuenta de base, el administrador, el sistema u otra cuenta (su correo).
  function quienTxt(q){
    const e = String(q || "").trim().toLowerCase();
    const m = e.match(/^base\s*(\d+)@/);
    if (m) return { txt: `BASE ${m[1]}`, cls: "ok" };
    if (!e || e === "sistema") return { txt: "Sistema", cls: "mut" };
    try {
      if (typeof SUPER_ADMIN_EMAIL !== "undefined" && e === String(SUPER_ADMIN_EMAIL).toLowerCase()) return { txt: "Administrador", cls: "info" };
    } catch (_) { /* sin admin definido */ }
    return { txt: e, cls: "warn" };
  }
  function tipoCambio(c){
    if (c.origen === "estados") return "estados";
    if (c.accion !== "cambio") return "filas";
    const k = normCampo(c.campo);
    return /^CONDUCTOR [12]$/.test(k) || /^__NOTE__/.test(k) ? "conductores" : "buses";
  }
  // "2026-11-18T10:32:05" -> "10:32" (y el dia si no es el de la programacion)
  function cuandoTxt(en, fecha){
    const s = String(en || "");
    const hora = s.slice(11, 16);
    const dia = s.slice(0, 10);
    return dia && fecha && dia !== fecha ? `${fechaCorta(dia)} ${hora}` : hora;
  }
  function valorTxt(v){
    return v == null || v === "" ? `<span class="nb-mut">(vacío)</span>` : `<b>${esc(v)}</b>`;
  }
  function dondeTxt(c){
    if (c.origen === "estados") return c.persona ? `<b>${esc(c.persona)}</b>` : "";
    return [c.vehiculo ? `Bus <b>${esc(c.vehiculo)}</b>` : "", c.puesto ? esc(c.puesto) : "",
      c.inicia ? `inicia ${esc(c.inicia)}` : ""].filter(Boolean).join(" · ");
  }
  function queTxt(c){
    if (c.accion === "cambio") {
      const campo = CAMPO_TXT[normCampo(c.campo)] || esc(c.campo || "");
      return `<span class="nb-cambio-campo">${campo}:</span> <span class="nb-cambio-antes">${valorTxt(c.antes)}</span> → ${valorTxt(c.despues)}`;
    }
    if (c.origen === "estados") {
      return c.accion === "agregada" ? `Le puso el estado ${valorTxt(c.despues)}` : `Le quitó el estado ${valorTxt(c.antes)}`;
    }
    return c.accion === "agregada" ? `Agregó la fila <small>${esc(c.despues || "")}</small>` : `Quitó la fila <small>${esc(c.antes || "")}</small>`;
  }
  // Una carga de programacion son muchas filas agregadas (o quitadas) por la misma cuenta en el mismo minuto:
  // se muestran juntas en un renglon que se abre.
  function agruparCargas(lista){
    const out = [];
    for (let i = 0; i < lista.length; i++) {
      const c = lista[i];
      if (c.origen === "turnos" && c.accion !== "cambio") {
        let j = i;
        while (j + 1 < lista.length && lista[j + 1].origen === "turnos" && lista[j + 1].accion === c.accion
          && lista[j + 1].quien === c.quien && String(lista[j + 1].en).slice(0, 16) === String(c.en).slice(0, 16)) j++;
        if (j - i + 1 >= 3) {
          out.push({ grupo: true, accion: c.accion, quien: c.quien, en: c.en, filas: lista.slice(i, j + 1) });
          i = j;
          continue;
        }
      }
      out.push(c);
    }
    return out;
  }

  function pintarCambios(){
    const d = st.cambios;
    if (!d) return;
    pintarCabeza(d.base);
    const todos = Array.isArray(d.cambios) ? d.cambios : [];
    const n = el("nbNumCambios");
    if (n) n.textContent = todos.length ? String(todos.length) : "";
    const cuenta = (t) => todos.filter((c) => tipoCambio(c) === t).length;
    const porQuien = new Map();
    todos.forEach((c) => {
      const q = quienTxt(c.quien);
      const k = `${q.cls}|${q.txt}`;
      porQuien.set(k, (porQuien.get(k) || 0) + 1);
    });
    const t = [
      tile(numero(todos.length), "Cambios", d.es_hoy ? "en la programación de hoy" : `en la programación del ${fechaCorta(d.fecha)}`, "", ""),
      tile(numero(cuenta("conductores")), "De conductores", "", cuenta("conductores") ? "info" : "", ""),
      tile(numero(cuenta("buses")), "De buses y horas", "", "", ""),
      tile(numero(cuenta("filas")), "Filas agregadas o quitadas", "", "", ""),
      tile(numero(cuenta("estados")), "Estados del personal", "", "", "")
    ];
    const quienes = [...porQuien.entries()].sort((a, b) => b[1] - a[1])
      .map(([k, v]) => { const [cls, txt] = k.split("|"); return `<span class="nb-badge ${cls}">${esc(txt)} · ${numero(v)}</span>`; }).join(" ");
    el("nbCambiosResumen").innerHTML = `<div class="nb-rgrupo"><div class="nb-rgrupo-tit">Cambios del día</div><div class="nb-rgrupo-tiles">${t.join("")}</div></div>`
      + (quienes ? `<div class="nb-quienes"><span class="nb-rgrupo-tit">Los hizo</span> ${quienes}</div>` : "");

    const q = sinTildes(st.cambiosBuscar).trim();
    const lista = todos.filter((c) => {
      if (st.cambiosFiltro && tipoCambio(c) !== st.cambiosFiltro) return false;
      if (!q) return true;
      return sinTildes(`${c.vehiculo || ""} ${c.persona || ""} ${c.antes || ""} ${c.despues || ""} ${quienTxt(c.quien).txt} ${c.puesto || ""}`).includes(q);
    });
    el("nbCuentaCambios").textContent = todos.length ? (lista.length === todos.length ? plural(todos.length, "cambio", "cambios")
      : `${numero(lista.length)} de ${plural(todos.length, "cambio", "cambios")}`) : "";
    const box = el("nbCambios");
    if (!todos.length) {
      box.innerHTML = `<div class="nb-vacio nb-vacio-ok">Nadie ha cambiado nada en la programación ni en los estados del personal de este día.</div>`;
      return;
    }
    if (!lista.length) {
      box.innerHTML = `<div class="nb-vacio">Ningún cambio coincide con el filtro.</div>`;
      return;
    }
    const renglon = (c) => {
      const qn = quienTxt(c.quien);
      return `<tr><td class="nb-col-hora"><b>${esc(cuandoTxt(c.en, d.fecha))}</b></td>`
        + `<td><span class="nb-badge ${qn.cls}">${esc(qn.txt)}</span></td>`
        + `<td>${dondeTxt(c) || `<span class="nb-mut">—</span>`}</td>`
        + `<td>${queTxt(c)}</td></tr>`;
    };
    const filas = agruparCargas(lista).map((c) => {
      if (!c.grupo) return renglon(c);
      const qn = quienTxt(c.quien);
      return `<tr class="nb-cambio-carga"><td class="nb-col-hora"><b>${esc(cuandoTxt(c.en, d.fecha))}</b></td>`
        + `<td><span class="nb-badge ${qn.cls}">${esc(qn.txt)}</span></td>`
        + `<td colspan="2"><details><summary>${c.accion === "agregada" ? "Cargó la programación" : "Quitó filas de la programación"}: `
        + `<b>${plural(c.filas.length, "fila", "filas")}</b></summary><ul>${c.filas.map((f) => `<li>${esc((c.accion === "agregada" ? f.despues : f.antes) || "")}</li>`).join("")}</ul></details></td></tr>`;
    }).join("");
    box.innerHTML = `<div class="nb-tabla-caja"><table class="nb-tabla nb-tabla-cambios"><thead><tr><th>Hora</th><th>Quién</th>`
      + `<th>Dónde</th><th>Qué cambió</th></tr></thead><tbody>${filas}</tbody></table></div>`;
  }

  /* ---------- Historial de conductores (v2.12.0): con el ERP ---------- */
  // Todos los que han trabajado en la base (la programación) y los que la hoja de conductores tiene en la base, con su
  // estado en el ERP (afiliados_historial_conductores). Solo los activos que están en la hoja salen para programar.
  const ESTADO_CONDUCTOR = {
    activo: { txt: "Activo", cls: "ok" },
    retirado: { txt: "Retirado", cls: "err" },
    no_esta: { txt: "No está en el ERP", cls: "warn" }
  };
  // Los de la hoja en esta base (activos o no en el ERP), para que el historial también muestre a los que no han
  // trabajado: los arma loadDriversFromCSV.
  function hojaDeLaBase(base){
    const num = String(etiquetaBase(base) || base || "").replace(/\D/g, "");
    const lista = (typeof driversHojaPorBase !== "undefined" && driversHojaPorBase && driversHojaPorBase[num]) || [];
    return lista.map((x) => ({ c: x.cedula || "", n: x.nombre }));
  }
  function fechaConAnio(iso){
    try {
      return new Date(`${iso}T12:00:00Z`).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
        .replace(".", "").replace(/ de /g, " ");
    } catch (_) {
      return iso;
    }
  }
  function pintarConductores(){
    const d = st.conductores;
    if (!d) return;
    pintarCabeza(d.base);
    const todos = Array.isArray(d.conductores) ? d.conductores : [];
    const de = (e) => todos.filter((c) => c.estado === e);
    const activos = de("activo");
    const retirados = de("retirado");
    const noEstan = de("no_esta");
    const activosSinHoja = activos.filter((c) => !c.en_hoja).length;
    const retiradosEnHoja = retirados.filter((c) => c.en_hoja).length;
    const t = [
      tile(numero(activos.length), "Activos", activosSinHoja
        ? `${activosSinHoja} ${activosSinHoja === 1 ? "no está" : "no están"} en la hoja de su base` : "salen para programar", "ok", ""),
      tile(numero(retirados.length), "Retirados", retiradosEnHoja
        ? `${retiradosEnHoja} ${retiradosEnHoja === 1 ? "sigue habilitado" : "siguen habilitados"} en la hoja` : "ya no salen para programar",
        retirados.length ? "err" : "", ""),
      tile(numero(noEstan.length), "No están en el ERP", noEstan.length ? "no salen para programar" : "", noEstan.length ? "warn" : "", "")
    ];
    el("nbConductoresResumen").innerHTML = `<div class="nb-rgrupo"><div class="nb-rgrupo-tit">Conductores de su base`
      + `${d.desde ? ` desde el ${esc(fechaConAnio(d.desde))}` : ""}</div><div class="nb-rgrupo-tiles">${t.join("")}</div></div>`;

    const q = sinTildes(st.conductoresBuscar).trim();
    const lista = todos.filter((c) => {
      if (st.conductoresFiltro && c.estado !== st.conductoresFiltro) return false;
      if (!q) return true;
      return sinTildes(`${c.nombre || ""} ${c.bus || ""}`).includes(q);
    });
    el("nbCuentaConductores").textContent = todos.length ? (lista.length === todos.length ? plural(todos.length, "conductor", "conductores")
      : `${numero(lista.length)} de ${plural(todos.length, "conductor", "conductores")}`) : "";
    const box = el("nbConductores");
    if (!todos.length) {
      box.innerHTML = `<div class="nb-vacio">Todavía no hay conductores en el historial de esta base.</div>`;
      return;
    }
    if (!lista.length) {
      box.innerHTML = `<div class="nb-vacio">Ningún conductor coincide con el filtro.</div>`;
      return;
    }
    const filas = lista.map((c) => {
      const e = ESTADO_CONDUCTOR[c.estado] || ESTADO_CONDUCTOR.no_esta;
      const desde = c.estado === "retirado" && c.salida ? `<div class="nb-mut">desde el ${esc(fechaConAnio(c.salida))}</div>` : "";
      let nota = "";
      if (c.estado !== "activo" && c.en_hoja) nota = "Sigue habilitado en la hoja de conductores, pero no sale para programar.";
      else if (c.estado === "activo" && !c.en_hoja) nota = "No está en la hoja de conductores de esta base: no sale para programar.";
      const trabajo = c.primero
        ? `${esc(fechaConAnio(c.primero))} → ${esc(fechaConAnio(c.ultimo))}<div class="nb-mut">${esc(plural(Number(c.dias) || 0, "día", "días"))}</div>`
        : `<span class="nb-mut">No ha trabajado en su base${d.desde ? ` desde el ${esc(fechaConAnio(d.desde))}` : ""}</span>`;
      const bus = c.bus ? `<b>${esc(partirBus(c.bus).num)}</b>` : `<span class="nb-mut">—</span>`;
      return `<tr data-estado="${esc(c.estado)}"><td><b>${esc(c.nombre)}</b>${nota ? `<div class="nb-hc-nota">${esc(nota)}</div>` : ""}</td>`
        + `<td><span class="nb-badge ${e.cls}">${esc(e.txt)}</span>${desde}</td>`
        + `<td>${trabajo}</td><td>${bus}</td></tr>`;
    }).join("");
    box.innerHTML = `<div class="nb-tabla-caja"><table class="nb-tabla nb-tabla-conductores"><thead><tr><th>Conductor</th>`
      + `<th>Estado en el ERP</th><th>Trabajó en su base</th><th>Último bus</th></tr></thead><tbody>${filas}</tbody></table></div>`;
  }

  /* ---------- Relevos (v2.12.0): a qué hora se entregó de verdad el carro ---------- */
  // Lo calcula la base de datos (afiliados_relevos_base) con el GPS del carro (dónde estuvo, guardado por el programa
  // de la tarjeta) y las marcas del biométrico: la entrega es la primera vez que el carro está en el punto del relevo
  // con el que recibe ya marcado. La salida que marca el que entrega llega después (el carro ya se fue): no sirve.
  function datosDe(v){
    return v === "novedades" ? st.datos : v === "viajes" ? st.viajes : v === "cambios" ? st.cambios
      : v === "relevos" ? st.relevos : v === "conductores" ? st.conductores : st.fila;
  }
  const CAUSA_RELEVO = {
    antes: { txt: "Se relevaron antes de la hora", cls: "info", grupo: "antes" },
    a_tiempo: { txt: "A tiempo", cls: "ok", grupo: "a_tiempo" },
    aeropuerto: { txt: "El carro estaba en el aeropuerto esperando despacho", cls: "err", grupo: "tarde" },
    iba_aeropuerto: { txt: "El carro iba para el aeropuerto a la hora del relevo", cls: "err", grupo: "tarde" },
    venia_aeropuerto: { txt: "El carro venía del aeropuerto", cls: "warn", grupo: "tarde" },
    recibe_tarde: { txt: "El que recibe llegó tarde", cls: "warn", grupo: "tarde" },
    en_punto: { txt: "El carro estaba en el punto", cls: "warn", grupo: "tarde" },
    otro: { txt: "El carro venía de otro lado", cls: "warn", grupo: "tarde" }
  };
  function grupoRelevo(r){
    if (r.estado === "entregado") return (CAUSA_RELEVO[r.causa] || {}).grupo || "tarde";
    if (r.estado === "en_curso" || r.estado === "falta") return "en_curso";
    return "sin_dato";
  }
  function nombrePunto(p){
    return p === "Terminal Norte" ? "Terminal del Norte" : (p || "?");
  }
  function lugarRelevo(p){
    return p === "Aeropuerto" ? "el aeropuerto" : nombrePunto(p);
  }
  function delLugar(p){
    return p === "Aeropuerto" ? "del aeropuerto" : `de ${nombrePunto(p)}`;
  }
  function alLugar(p){
    return p === "Aeropuerto" ? "al aeropuerto" : `a ${nombrePunto(p)}`;
  }
  // Dónde andaba el carro a una hora en que no estaba en ningún punto, mirando el recorrido del GPS (el punto de antes
  // y el de después). Si entre los dos pasó más de hora y media, no "iba en la vía": estuvo por fuera de los puntos
  // (parqueado, en el taller…). Si salió de un punto y volvió al mismo, se dice así. Devuelve { via, txt } sin verbo.
  const VIA_MAX_MIN = 90;
  function viaRelevo(r, hora, de, a){
    const viejo = () => ((de || a)
      ? { via: true, txt: `en la vía${de ? ` ${delLugar(de)}` : ""}${a ? ` ${alLugar(a)}` : ""}` } : null);
    if (!hora || !r.gps_desde || r.recorrido === undefined) return viejo();
    const rec = Array.isArray(r.recorrido) ? r.recorrido : [];   // null = no pasó por ningún punto
    if (!rec.length) {
      return { via: false, txt: `por fuera de los puntos (el GPS no lo muestra en ninguno de las ${r.gps_desde} a las ${r.gps_hasta || "?"})` };
    }
    const min = (h) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));
    const base = min(r.gps_desde);
    const o = (h) => ((min(h) - base) % 1440 + 1440) % 1440;
    const t = o(hora);
    const fin = r.gps_hasta ? o(r.gps_hasta) : t;
    if (t > fin + 5) return viejo();
    let antes = null, despues = null;
    for (const [p, d, h] of rec) {
      if (h && o(h) <= t) antes = { p, h };
      if (!despues && o(d) >= t) despues = { p, h: d };
    }
    if (!antes && !despues) return viejo();
    if (antes && despues) {
      const rato = o(despues.h) - o(antes.h);
      if (antes.p === despues.p) {
        return rato <= 15
          ? { via: false, txt: `cerca ${delLugar(antes.p)} (salió a las ${antes.h} y volvió a las ${despues.h})` }
          : { via: false, txt: `por fuera de los puntos (salió ${delLugar(antes.p)} a las ${antes.h} y volvió a las ${despues.h})` };
      }
      return rato <= VIA_MAX_MIN
        ? { via: true, txt: `en la vía ${delLugar(antes.p)} ${alLugar(despues.p)}` }
        : { via: false, txt: `por fuera de los puntos (salió ${delLugar(antes.p)} a las ${antes.h} y llegó ${alLugar(despues.p)} a las ${despues.h})` };
    }
    if (despues) {
      return o(despues.h) <= VIA_MAX_MIN
        ? { via: true, txt: `en la vía ${alLugar(despues.p)}` }
        : { via: false, txt: `por fuera de los puntos (de las ${r.gps_desde} a las ${despues.h} no pasó por ninguno)` };
    }
    const enCurso = r.estado === "en_curso" || r.estado === "falta";
    return fin - o(antes.h) <= VIA_MAX_MIN
      ? { via: true, txt: `en la vía (salió ${delLugar(antes.p)} a las ${antes.h})` }
      : { via: false, txt: `por fuera de los puntos (salió ${delLugar(antes.p)} a las ${antes.h} y no ${enCurso ? "ha vuelto" : "volvió"} a pasar por ninguno)` };
  }
  function aLaHoraRelevo(r){
    const a = r.a_la_hora;
    if (!a || r.estado === "sin_gps") {
      return r.estado === "falta" || r.estado === "en_curso"
        ? `<span class="nb-mut">Todavía no es la hora</span>` : `<span class="nb-mut">Sin GPS a esa hora</span>`;
    }
    if (a.en) {
      const desde = a.desde ? ` desde las ${esc(a.desde)}` : "";
      const hasta = a.hasta ? `<div class="nb-rl-nota">Salió a las ${esc(a.hasta)}</div>`
        : (r.estado === "en_curso" ? `<div class="nb-rl-nota">Sigue allá</div>` : "");
      return `En ${esc(lugarRelevo(a.en))}${desde}${hasta}`;
    }
    const via = viaRelevo(r, r.relevo, a.de, a.a);
    if (via) return esc(via.txt.charAt(0).toUpperCase() + via.txt.slice(1));
    return "En la vía";
  }
  function minutosRelevo(r){
    const m = Number(r.minutos);
    if (r.minutos === null || r.minutos === undefined || !Number.isFinite(m)) return "";
    if (m < -30) return `<span class="nb-badge info">${numero(-m)} min antes</span>`;
    if (m <= 10) {
      return `<span class="nb-badge ok">${m < 0 ? `${numero(-m)} min antes` : m === 0 ? "a la hora" : `${numero(m)} min después`}</span>`;
    }
    return `<span class="nb-badge ${m > 30 ? "err" : "warn"}">${numero(m)} min tarde</span>`;
  }
  function entregaRelevo(r){
    if (r.estado === "entregado") {
      const det = [];
      if (r.llego_al_punto) det.push(`Llegó ${esc(alLugar(r.punto))} ${esc(r.llego_al_punto)}`);
      if (r.salio_del_punto) det.push(`salió ${esc(r.salio_del_punto)}`);
      return `<b>${esc(r.entrega)}</b> ${minutosRelevo(r)}${det.length ? `<div class="nb-rl-nota">${det.join(" · ")}</div>` : ""}`;
    }
    if (r.estado === "falta") return `<span class="nb-mut">El relevo es a las ${esc(r.relevo)}</span>`;
    if (r.estado === "en_curso") {
      const a = r.ahora;
      let donde = "";
      if (a && a.en) donde = `Ahora en ${esc(lugarRelevo(a.en))}${a.desde ? ` desde las ${esc(a.desde)}` : ""}`;
      else if (a && a.salio_de) donde = `Ahora en la vía: salió ${esc(delLugar(a.salio_de))}${a.salio ? ` a las ${esc(a.salio)}` : ""}`;
      return `<span class="nb-badge info">Todavía no lo entrega</span>`
        + (donde ? `<div class="nb-rl-ahora">${donde}${a && a.gps ? ` · GPS de las ${esc(a.gps)}` : ""}</div>` : "");
    }
    if (r.estado === "sin_gps") return `<span class="nb-badge mut">Sin GPS del carro</span>`;
    return `<span class="nb-badge mut">No se pudo saber</span>`;
  }
  // v4: el conductor 2 marcó en un punto y recibió el carro en otro (donde el conductor 1 marcó la salida con el carro).
  function notaPuntoRelevo(r){
    if (!r.entrega_en_salida) return "";
    return `<div class="nb-rl-nota nb-rl-otro-punto">Se entregó donde el conductor 1 marcó la salida, con el carro ahí.`
      + `${r.punto_recibe ? ` El conductor 2 había marcado la entrada en ${esc(nombrePunto(r.punto_recibe))}.` : ""}</div>`;
  }
  function porqueRelevo(r){
    if (r.estado !== "entregado") {
      if (r.estado === "sin_dato" && r.gps_hasta && !(Array.isArray(r.recorrido) && r.recorrido.length)) {
        return `<span class="nb-mut">El GPS no muestra el carro en ningún punto en todo ese rato: estuvo quieto o por fuera de los puntos (¿parqueado, en el taller o cambiaron de carro?)</span>`;
      }
      if (r.estado === "sin_dato") return `<span class="nb-mut">El carro no pasó por ${esc(lugarRelevo(r.punto))} con los dos conductores</span>`;
      if (r.estado === "sin_gps") return `<span class="nb-mut">No hay GPS de este carro para ese rato</span>`;
      if (r.estado === "en_curso" && !r.recibe_marco) return `<span class="nb-mut">El que recibe todavía no marca la entrada</span>`;
      return "";
    }
    const c = CAUSA_RELEVO[r.causa] || { txt: "—", cls: "mut" };
    let t = `<span class="nb-badge ${c.cls}">${esc(c.txt)}</span>`;
    const ae = Number(r.aeropuerto_despues_min);
    if (r.causa === "aeropuerto" && Number.isFinite(ae) && ae > 0) {
      t += `<div class="nb-rl-nota">Salió del aeropuerto ${numero(ae)} min después de la hora del relevo</div>`;
    }
    if (r.otra_pasada) {
      t += `<div class="nb-rl-ojo">Ojo: el carro volvió a pasar por el punto antes de que el que entrega marcara la salida; la entrega pudo ser en esa otra pasada.</div>`;
    }
    return t;
  }
  function duracionRelevo(min){
    const m = Math.abs(Math.round(Number(min) || 0));
    if (m < 60) return `${numero(m)} min`;
    return `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ""}`;
  }
  // El que recibe contra su hora (de 15 min antes, la regla del biométrico, a 10 min después).
  function entradaRelevo(r){
    const h = r.recibe_horario;
    const m = Number(r.recibe_vs_hora_min);
    if (h === "en_horario") return { cls: "ok", txt: "En su horario" };
    if (h === "temprano") return { cls: "warn", txt: `${duracionRelevo(m)} antes de su hora` };
    if (h === "tarde") return { cls: "err", txt: `${duracionRelevo(m)} tarde a su hora` };
    if (h === "sin_marca") return { cls: "err", txt: "No marcó entrada" };
    return null;
  }
  // La salida del que entrega contra la entrega (de 5 min antes a 30 min después de que el carro salió con el otro).
  function salidaRelevo(r){
    const s = r.entrega_salida;
    const m = Number(r.entrega_salida_min);
    if (s === "cuadra") return { cls: "ok", txt: "Cuadra con la entrega" };
    if (s === "despues") return { cls: "warn", txt: `La marcó ${duracionRelevo(m)} después de entregar` };
    if (s === "antes") return { cls: "err", txt: "La marcó antes de entregar el carro" };
    if (s === "sin_marca") return { cls: "err", txt: "No marcó salida" };
    return null;
  }
  // Dónde estaba el carro cuando marcó cada uno (salida del 1, entrada del 2), con el GPS. «malo» = la marca no
  // cuadra con el carro: lo marcó donde el carro no pasó, antes de que llegara, o cuando ya se había ido hace rato.
  function carroEnMarca(r, cual){
    const v = cual === "salida" ? r.carro_en_salida : r.carro_en_entrada;
    if (!v) return null;
    if (!v.gps) return { cls: "mut", txt: "Sin GPS del carro a esa hora", malo: false };
    const marca = marcaDe(r, cual === "salida" ? "s1" : "e2");
    const via = v.en ? null : viaRelevo(r, marca && marca.hora, v.de, v.a);
    const donde = v.en ? `estaba en ${lugarRelevo(v.en)}${v.desde ? ` desde las ${v.desde}` : ""}`
      : via ? `${via.via ? "iba" : "estaba"} ${via.txt}`
      : "no estaba en ningún punto";
    if (v.alli === undefined) return { cls: "mut", txt: `El carro ${donde}`, malo: false };
    if (v.alli) return { cls: "ok", txt: `El carro estaba ahí${v.desde ? ` (llegó a las ${v.desde})` : ""}`, malo: false };
    const enCurso = r.estado === "en_curso" || r.estado === "falta";
    if (cual === "salida") {
      const fue = v.se_fue ? Number(v.se_fue_min) : null;
      const llega = v.llego ? Number(v.llego_min) : null;
      if (fue !== null && fue <= 60) {
        return { cls: "ok", txt: `El carro estuvo ahí: salió a las ${v.se_fue} (${duracionRelevo(fue)} antes)`, malo: false };
      }
      if (llega !== null && (fue === null || llega < fue)) {
        return { cls: "warn", txt: `Marcó antes de que llegara el carro: llegó a las ${v.llego} (${duracionRelevo(llega)} después). A esa hora ${donde}`, malo: true };
      }
      if (fue !== null) {
        return { cls: "warn", txt: `El carro se había ido de ahí a las ${v.se_fue} (${duracionRelevo(fue)} antes). A esa hora ${donde}`, malo: true };
      }
      return { cls: "err", txt: `El carro no pasó por ahí: a esa hora ${donde}`, malo: true };
    }
    if (r.entrega_en_salida && r.estado === "entregado") {
      return { cls: "warn", txt: `El carro no estaba ahí: ${donde}. Lo recibió en ${lugarRelevo(r.punto)} a las ${r.entrega}, donde salió el conductor 1`, malo: true };
    }
    if (v.llego) {
      return { cls: "info", txt: `El carro no estaba: ${donde}. Llegó a las ${v.llego} (${duracionRelevo(v.llego_min)} después)`, malo: false };
    }
    if (enCurso) return { cls: "info", txt: `El carro no estaba: ${donde}. Todavía no llega`, malo: false };
    if (v.se_fue && Number(v.se_fue_min) <= 30) {
      return { cls: "warn", txt: `El carro acababa de irse de ahí: salió a las ${v.se_fue} (${duracionRelevo(v.se_fue_min)} antes)`, malo: true };
    }
    if (v.se_fue) {
      return { cls: "err", txt: `El carro no volvió a pasar por ahí después de que marcó (había salido a las ${v.se_fue}). A esa hora ${donde}`, malo: true };
    }
    return { cls: "err", txt: `El carro no pasó por ahí: a esa hora ${donde}`, malo: true };
  }
  function marcaFuera(r, cual){
    if (cual === "m_entrada") return ["temprano", "tarde", "sin_marca"].includes(r.recibe_horario);
    if (cual === "m_gps") return !!((carroEnMarca(r, "salida") || {}).malo || (carroEnMarca(r, "entrada") || {}).malo);
    return ["despues", "antes", "sin_marca"].includes(r.entrega_salida);
  }
  // Por dónde anduvo el carro, con las marcas de los dos y la entrega, en orden de hora.
  function recorridoRelevo(r, abierto){
    const rec = Array.isArray(r.recorrido) ? r.recorrido : [];
    if (!rec.length) return "";
    const min = (h) => (h ? Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5)) : null);
    const base = min(r.gps_desde || rec[0][1]) || 0;
    const orden = (h) => ((min(h) - base) % 1440 + 1440) % 1440;
    const cosas = rec.map(([p, a, b]) => ({ h: a, txt: `${b ? `${esc(a)}–${esc(b)}` : `desde ${esc(a)}`} · el carro en <b>${esc(nombrePunto(p))}</b>`, cls: "" }));
    if (r.recibe_marco) cosas.push({ h: r.recibe_marco, txt: `${esc(r.recibe_marco)} · el conductor 2 marcó entrada${r.recibe_marco_en ? ` en ${esc(nombrePunto(r.recibe_marco_en))}` : ""}`, cls: "nb-rl-rec-marca" });
    if (r.entrega_marco) cosas.push({ h: r.entrega_marco, txt: `${esc(r.entrega_marco)} · el conductor 1 marcó salida${r.entrega_marco_en ? ` en ${esc(nombrePunto(r.entrega_marco_en))}` : ""}`, cls: "nb-rl-rec-marca" });
    if (r.estado === "entregado" && r.entrega) cosas.push({ h: r.entrega, txt: `${esc(r.entrega)} · entrega del carro en ${esc(lugarRelevo(r.punto))}`, cls: "nb-rl-rec-entrega" });
    cosas.push({ h: r.relevo, txt: `${esc(r.relevo)} · hora programada del relevo`, cls: "nb-rl-rec-hora" });
    cosas.sort((x, y) => orden(x.h) - orden(y.h));
    const tit = `Por dónde anduvo el carro${r.gps_desde && r.gps_hasta ? ` (GPS de ${esc(r.gps_desde)} a ${esc(r.gps_hasta)})` : ""}`;
    return `<details class="nb-rl-rec"${abierto ? " open" : ""}><summary>${tit}</summary><ol>${cosas.map((c) => `<li class="${c.cls}">${c.txt}</li>`).join("")}</ol></details>`;
  }
  // Las marcas: de la v3 (marcas.e1/s1/e2/s2 con foto) o, si la base de datos todavía no la tiene, de los campos viejos.
  function marcaDe(r, k){
    const m = (r.marcas || {})[k];
    if (m) return m;
    const v = { e1: [r.entrega_entro, r.entrega_entro_en], s1: [r.entrega_marco, r.entrega_marco_en],
      e2: [r.recibe_marco, r.recibe_marco_en] }[k];
    return v && v[0] ? { hora: v[0], punto: v[1] } : null;
  }
  function marcaTxt(m, fecha){
    const otroDia = m.fecha && fecha && m.fecha !== fecha ? ` <small>(${esc(fechaCorta(m.fecha))})</small>` : "";
    return `${esc(m.hora)}${otroDia}${m.punto ? ` en ${esc(nombrePunto(m.punto))}` : ""}`;
  }
  function origenTxt(m){
    const o = m && (ORIGEN[m.origen] || m.origen);
    return o ? ` <span class="nb-rl-origen">· ${esc(o)}</span>` : "";
  }
  function turnoTxt(n, x){
    return x && x.desde ? `<div class="nb-rl-turno">Turno ${n}: de ${esc(x.desde)} a ${esc(x.hasta || "?")}</div>` : "";
  }
  function conductoresRelevo(r, fecha){
    const insignia = (x) => (x ? ` <span class="nb-badge ${x.cls}">${esc(x.txt)}</span>` : "");
    const gps = (x) => (x ? `<div class="nb-rl-gps nb-rl-gps-${x.cls}">${esc(x.txt)}</div>` : "");
    const t = r.turnos || {};
    const e1 = marcaDe(r, "e1"), s1 = marcaDe(r, "s1"), e2 = marcaDe(r, "e2"), s2 = marcaDe(r, "s2");
    const juntos = r.estado === "entregado"
      ? `<div class="nb-rl-juntos">Se juntaron a las ${esc(r.entrega)} en ${esc(lugarRelevo(r.punto))}</div>${notaPuntoRelevo(r)}` : "";
    // conductor 1: trae el carro y lo entrega
    const sale1 = s1
      ? `Salió ${marcaTxt(s1, fecha)}`
        + (Number(r.salida_despues_min) > 0 ? ` (${duracionRelevo(r.salida_despues_min)} después de que el carro se fue)` : "")
        + origenTxt(s1)
      : (r.entrega_salida === "sin_marca" ? "" : "No ha marcado salida");
    // conductor 2: lo recibe
    const entro2 = e2 ? `Entró ${marcaTxt(e2, fecha)}${origenTxt(e2)}` : (r.recibe_horario === "sin_marca" ? "" : "No ha marcado entrada");
    const esperas = [];
    if (Number(r.recibe_espero_min) > 0) esperas.push(`esperó el carro ${duracionRelevo(r.recibe_espero_min)}`);
    if (Number(r.carro_espero_min) > 0) esperas.push(`llegó después del carro: el carro lo esperó ${duracionRelevo(r.carro_espero_min)}`);
    return juntos
      + `<div class="nb-rl-per"><div><span class="nb-rl-rol">Conductor 1 · entrega</span> ${esc(r.entrega_nombre || "—")}</div>`
      + turnoTxt(1, t.t1)
      + (e1 ? `<div class="nb-rl-marca">Entró ${marcaTxt(e1, fecha)}${origenTxt(e1)}</div>` : "")
      + `<div class="nb-rl-marca">${sale1}${insignia(salidaRelevo(r))}</div>`
      + (s1 ? gps(carroEnMarca(r, "salida")) : "") + `</div>`
      + `<div class="nb-rl-per"><div><span class="nb-rl-rol">Conductor 2 · recibe</span> ${esc(r.recibe_nombre || "—")}</div>`
      + turnoTxt(2, t.t2)
      + `<div class="nb-rl-marca">${entro2}${insignia(entradaRelevo(r))}</div>`
      + (e2 ? gps(carroEnMarca(r, "entrada")) : "")
      + (esperas.length ? `<div class="nb-rl-nota">${esperas.map(esc).join(" · ")}</div>` : "")
      + (s2 ? `<div class="nb-rl-marca">Salió ${marcaTxt(s2, fecha)}${origenTxt(s2)}</div>` : "") + `</div>`
      + recorridoRelevo(r);
  }
  // Tocar el bus: la ventana del relevo con las fotos de las marcas de los dos conductores.
  function abrirRelevo(bus){
    const d = st.relevos;
    const r = d && (d.relevos || []).find((x) => String(x.interno) === String(bus));
    if (r) pintarRelevoModal(r, d.fecha);
  }
  // La ventana del relevo (25-nov, más ordenada): 1) la entrega en grande y en palabras, 2) si cuadran las marcas,
  // 3) el paso a paso de lo que importa, 4) los dos conductores lado a lado con fotos pequeñas (tocar = grande),
  // 5) todo el recorrido del carro (cerrado) y 6) qué quiere decir cada color.
  function tonoRelevo(r){
    const g = grupoRelevo(r);
    return g === "tarde" ? "err" : g === "a_tiempo" ? "ok" : g === "antes" || g === "en_curso" ? "info" : "mut";
  }
  function fraseEntrega(r){
    const lugar = lugarRelevo(r.punto);
    if (r.estado === "entregado") {
      const m = Number(r.minutos);
      const vs = !Number.isFinite(m) ? "" : m === 0 ? "justo a la hora del relevo"
        : `${duracionRelevo(m)} ${m < 0 ? "antes" : "después"} de la hora del relevo (${r.relevo})`;
      return `El carro y el conductor 2 se juntaron en ${lugar} a las ${r.entrega}${vs ? `: ${vs}` : ""}.`;
    }
    if (r.estado === "falta") return `Todavía no es la hora: el relevo es a las ${r.relevo} en ${lugar}.`;
    if (r.estado === "en_curso") return `El carro todavía no se ha juntado con el conductor 2 en ${lugar}.`;
    if (r.estado === "sin_gps") return "No hay GPS de este carro para ese rato: no se puede saber a qué hora se entregó.";
    return "Con el GPS no se pudo saber a qué hora se entregó el carro.";
  }
  function chequeosRelevo(r){
    const items = [];
    const e = entradaRelevo(r);
    if (e) items.push(["Entrada del conductor 2", e]);
    const s = salidaRelevo(r);
    if (s) items.push(["Salida del conductor 1", s]);
    const g = [marcaDe(r, "s1") ? carroEnMarca(r, "salida") : null, marcaDe(r, "e2") ? carroEnMarca(r, "entrada") : null]
      .filter((x) => x && x.cls !== "mut");
    if (g.some((x) => x.cls === "err")) items.push(["El carro en las marcas (GPS)", { cls: "err", txt: "Una marca donde el carro no pasó" }]);
    else if (g.some((x) => x.cls === "warn")) items.push(["El carro en las marcas (GPS)", { cls: "warn", txt: "Una marca no cuadra con el carro" }]);
    else if (g.length) items.push(["El carro en las marcas (GPS)", { cls: "ok", txt: "Cuadran con el carro" }]);
    if (!items.length) return "";
    return `<h4 class="nb-rv-tit">¿Cuadran las marcas?</h4><div class="nb-rv-chks">`
      + items.map(([et, x]) => `<div class="nb-rv-chk"><span class="nb-rv-chk-et">${esc(et)}</span><span class="nb-badge ${x.cls}">${esc(x.txt)}</span></div>`).join("")
      + `</div>`;
  }
  function pasosRelevo(r){
    const aMin = (h) => Number(String(h).slice(0, 2)) * 60 + Number(String(h).slice(3, 5));
    const base = aMin(r.relevo || "00:00") - 360;                 // seis horas antes del relevo: así ordena después de medianoche
    const orden = (h) => (((aMin(h) - base) % 1440) + 1440) % 1440;
    const e2 = marcaDe(r, "e2"), s1 = marcaDe(r, "s1");
    const entregado = r.estado === "entregado";
    const p = [];
    if (entregado && r.llego_al_punto) p.push({ h: r.llego_al_punto, txt: `El carro llega ${alLugar(r.punto)}`, cls: "carro" });
    if (e2 && e2.hora) p.push({ h: e2.hora, txt: `El conductor 2 marca la entrada${e2.punto ? ` en ${nombrePunto(e2.punto)}` : ""}`, cls: "marca" });
    if (entregado && r.entrega) p.push({ h: r.entrega, txt: `Entrega: el conductor 2 recibe el carro en ${lugarRelevo(r.punto)}`, cls: "entrega" });
    if (s1 && s1.hora) p.push({ h: s1.hora, txt: `El conductor 1 marca la salida${s1.punto ? ` en ${nombrePunto(s1.punto)}` : ""}`, cls: "marca" });
    if (r.relevo) p.push({ h: r.relevo, txt: "Hora programada del relevo", cls: "hora" });
    if (entregado && r.salio_del_punto) p.push({ h: r.salio_del_punto, txt: `El carro sale ${delLugar(r.punto)} con el conductor 2`, cls: "carro" });
    if (p.length < 2) return "";
    p.sort((a, b) => orden(a.h) - orden(b.h));
    return `<h4 class="nb-rv-tit">Paso a paso</h4><ol class="nb-rv-pasos">`
      + p.map((x) => `<li class="nb-rv-p-${x.cls}"><span class="nb-rv-h">${esc(x.h)}</span><span>${esc(x.txt)}</span></li>`).join("")
      + `</ol>`;
  }
  // v5: qué cuenta registró la marca (la del conductor, la del biométrico o del celular de un punto, u otra) y dónde
  // estaba el celular cuando se tomó la foto.
  function cuentaMarca(m){
    if (m.cuenta_tipo === "propia") return "con la cuenta del conductor";
    if (m.cuenta_tipo === "empresa") return m.cuenta ? `cuenta ${m.cuenta}` : "cuenta de la empresa";
    if (m.cuenta_tipo === "otra") return `otra cuenta${m.cuenta ? ` (${m.cuenta})` : ""}`;
    if (m.cuenta_tipo === "ninguna") return "sin cuenta";
    return "";
  }
  function ubicacionMarca(m){
    if (m.lat === undefined || m.lat === null || m.lon === undefined || m.lon === null) return "";
    const p = Number(m.precision_m);
    const prec = m.precision_m !== undefined && Number.isFinite(p) ? ` (GPS ±${numero(p)} m${p >= 100 ? ", aproximado" : ""})` : "";
    const sitio = m.punto ? `en ${nombrePunto(m.punto)}` : "fuera de los puntos de marca";
    const url = `https://www.google.com/maps?q=${encodeURIComponent(`${m.lat},${m.lon}`)}`;
    return `<div class="nb-rv-ml nb-rv-ubic">Foto tomada ${esc(sitio)}${esc(prec)} · `
      + `<a href="${esc(url)}" target="_blank" rel="noopener">ver en el mapa</a></div>`;
  }
  function motivosMarca(m){
    const ms = Array.isArray(m.motivos) ? m.motivos : [];
    return ms.map((t) => {
      const x = leerMotivo(t);
      return `<div class="nb-rv-motivo"><span class="nb-badge ${x.cls}">${esc(x.tipo)}</span>${x.det ? ` <small>${esc(x.det)}</small>` : ""}`
        + `${x.txt ? `<div class="nb-rv-motivo-txt">«${esc(x.txt)}»</div>` : ""}</div>`;
    }).join("");
  }
  function marcaModal(r, k, titulo, fecha, extra, quien){
    const m = marcaDe(r, k);
    if (!m) {
      const falta = k === "s2" ? "Todavía no marca la salida" : k === "s1" ? "No ha marcado la salida" : "No marcó la entrada";
      return `<div class="nb-rv-marca nb-rv-sin"><span class="nb-rv-foto nb-rv-foto-vacia">${fotoHtml(null)}</span>`
        + `<div class="nb-rv-md"><div class="nb-rv-mt">${esc(titulo)}</div><div class="nb-det-vacio">${esc(falta)}</div>${extra || ""}</div></div>`;
    }
    const otroDia = m.fecha && fecha && m.fecha !== fecha ? ` (${fechaCorta(m.fecha)})` : "";
    const donde = m.punto ? ` en ${nombrePunto(m.punto)}` : "";
    const cuenta = cuentaMarca(m);
    const ubic = ubicacionMarca(m);
    // con la ubicación del celular el punto va en «Foto tomada en …»; si no, en la línea del origen, como antes
    const lugar = [ubic ? "" : (m.punto ? nombrePunto(m.punto) : ""), ORIGEN[m.origen] || m.origen || "", cuenta].filter(Boolean).join(" · ");
    const cap = `${quien} · ${titulo} ${m.hora}${otroDia}${donde}${cuenta ? ` · ${cuenta}` : ""}`;
    return `<div class="nb-rv-marca"><span class="nb-rv-foto" role="button" tabindex="0" title="Ver la foto grande" data-cap="${esc(cap)}">${fotoHtml(m.foto)}</span>`
      + `<div class="nb-rv-md"><div class="nb-rv-mt">${esc(titulo)} · <b>${esc(m.hora)}</b>${esc(otroDia)}</div>`
      + (lugar ? `<div class="nb-rv-ml">${esc(lugar)}</div>` : "") + ubic + motivosMarca(m) + (extra || "") + `</div></div>`;
  }
  function conductorModal(r, n, fecha){
    const t = (r.turnos || {})[`t${n}`];
    const gps = (x) => (x ? `<div class="nb-rl-gps nb-rl-gps-${x.cls}">${esc(x.txt)}</div>` : "");
    const insignia = (x) => (x ? `<div><span class="nb-badge ${x.cls}">${esc(x.txt)}</span></div>` : "");
    const quien = `Conductor ${n}`;
    let marcas;
    if (n === 1) {
      marcas = marcaModal(r, "e1", "Entrada", fecha, "", quien)
        + marcaModal(r, "s1", "Salida", fecha, insignia(salidaRelevo(r)) + gps(marcaDe(r, "s1") ? carroEnMarca(r, "salida") : null), quien);
    } else {
      const esperas = [];
      if (Number(r.recibe_espero_min) > 0) esperas.push(`Esperó el carro ${duracionRelevo(r.recibe_espero_min)}`);
      if (Number(r.carro_espero_min) > 0) esperas.push(`Llegó después del carro: el carro lo esperó ${duracionRelevo(r.carro_espero_min)}`);
      marcas = marcaModal(r, "e2", "Entrada", fecha, insignia(entradaRelevo(r))
          + gps(marcaDe(r, "e2") ? carroEnMarca(r, "entrada") : null)
          + (esperas.length ? `<div class="nb-rl-nota">${esperas.map(esc).join(" · ")}</div>` : ""), quien)
        + marcaModal(r, "s2", "Salida", fecha, "", quien);
    }
    return `<section class="nb-rv-cond"><div class="nb-rv-ch"><span class="nb-rl-rol">Conductor ${n} · ${n === 1 ? "entrega el carro" : "recibe el carro"}</span>`
      + `<div class="nb-rv-nom">${esc((n === 1 ? r.entrega_nombre : r.recibe_nombre) || "—")}</div>`
      + (t && t.desde ? `<div class="nb-rl-turno">Turno ${n}: de ${esc(t.desde)} a ${esc(t.hasta || "?")}</div>` : "")
      + `</div>${marcas}</section>`;
  }
  function pintarRelevoModal(r, fecha){
    const viejas = diasEntre(fecha, hoy()) > FOTO_DIAS;
    el("nbModalTitulo").textContent = `Bus ${r.interno} · relevo de las ${r.relevo} en ${nombrePunto(r.punto)}`;
    el("nbModalSub").textContent = [fechaLarga(fecha), r.puesto ? `Puesto ${r.puesto}` : ""].filter(Boolean).join(" · ");
    el("nbModal")?.querySelector(".nb-modal-card")?.classList.add("nb-modal-relevo");
    const grande = r.estado === "entregado"
      ? `<b>${esc(r.entrega)}</b> <span class="nb-rv-en">en ${esc(lugarRelevo(r.punto))}</span> ${minutosRelevo(r)}`
      : entregaRelevo(r);
    const porque = porqueRelevo(r);
    el("nbModalCuerpo").innerHTML =
      `<div class="nb-rv-resumen nb-rv-${tonoRelevo(r)}"><span class="nb-rl-rol">Entrega del carro</span>`
      + `<div class="nb-rv-big">${grande}</div>`
      + `<div class="nb-rv-frase">${esc(fraseEntrega(r))}</div>`
      + (porque ? `<div class="nb-rv-porque">${porque}</div>` : "") + notaPuntoRelevo(r) + `</div>`
      + chequeosRelevo(r)
      + pasosRelevo(r)
      + `<h4 class="nb-rv-tit">Los dos conductores <small>${viejas ? "" : "Toque una foto para verla grande"}</small></h4>`
      + `<div class="nb-rv-conds">${conductorModal(r, 1, fecha)}${conductorModal(r, 2, fecha)}</div>`
      + recorridoRelevo(r, false)
      + `<div class="nb-rv-ley"><span><b class="nb-rv-c-ok">Verde</b>: el carro estaba en el punto</span>`
      + `<span><b class="nb-rv-c-warn">Amarillo</b>: revisar (no cuadra del todo)</span>`
      + `<span><b class="nb-rv-c-err">Rojo</b>: la marca no cuadra con el carro</span></div>`
      + (viejas ? `<div class="nb-det-nota">Las fotos se guardan ${FOTO_DIAS} días; las de este día ya se borraron.</div>` : "");
    el("nbModal").classList.remove("hidden");
    el("nbModalCerrar")?.focus();
    const m = r.marcas || {};
    if (!viejas) firmar([m.e1, m.s1, m.e2, m.s2].map((x) => x && x.foto)).then(pintarFotos).catch(() => {});
  }
  // La foto grande: encima de la ventana; se cierra tocando en cualquier parte o con Escape (la ventana sigue abierta).
  function verFotoGrande(img){
    const src = img && img.getAttribute("src");
    if (!src) return;
    let v = el("nbFotoVisor");
    if (!v) {
      v = document.createElement("div");
      v.id = "nbFotoVisor";
      v.className = "nb-rv-visor hidden";
      v.setAttribute("role", "dialog");
      v.setAttribute("aria-label", "Foto de la marca");
      v.innerHTML = `<figure><img alt="Foto de la marca" /><figcaption></figcaption></figure>`
        + `<button type="button" class="btn btn-primary">Cerrar la foto</button>`;
      v.addEventListener("click", (ev) => { ev.stopPropagation(); cerrarFotoGrande(); });
      el("nbModal")?.appendChild(v);
    }
    v.querySelector("img").src = src;
    v.querySelector("figcaption").textContent = img.closest(".nb-rv-foto")?.dataset.cap || "";
    v.classList.remove("hidden");
    v.querySelector("button")?.focus();
  }
  function cerrarFotoGrande(){
    const v = el("nbFotoVisor");
    if (v && !v.classList.contains("hidden")) {
      v.classList.add("hidden");
      return true;
    }
    return false;
  }
  function pintarRelevos(){
    const d = st.relevos;
    if (!d) return;
    pintarCabeza(d.base);
    const todos = Array.isArray(d.relevos) ? d.relevos : [];
    const de = (g) => todos.filter((r) => grupoRelevo(r) === g);
    const tarde = de("tarde");
    const aero = tarde.filter((r) => r.causa === "aeropuerto" || r.causa === "iba_aeropuerto");
    const mediana = (xs) => {
      const v = xs.map((r) => Number(r.minutos)).filter(Number.isFinite).sort((a, b) => a - b);
      return v.length ? v[Math.floor(v.length / 2)] : null;
    };
    const mAero = mediana(aero);
    const n = el("nbNumRelevos");
    if (n) n.textContent = tarde.length ? String(tarde.length) : "";
    const t = [
      tile(numero(todos.length), "Relevos", d.es_hoy ? "programados hoy" : `programados el ${fechaCorta(d.fecha)}`, "", ""),
      tile(numero(tarde.length), "Entregaron tarde",
        aero.length ? `${numero(aero.length)} por el aeropuerto${mAero !== null ? ` · ${numero(mAero)} min en la mitad` : ""}` : "",
        tarde.length ? "err" : "ok", ""),
      tile(numero(de("a_tiempo").length), "A tiempo", "hasta 10 min", "ok", ""),
      tile(numero(de("antes").length), "Antes de la hora", "más de 30 min antes", "info", "")
    ];
    if (d.es_hoy) t.push(tile(numero(de("en_curso").length), "Todavía no", "el carro no ha llegado al punto", "", ""));
    t.push(tile(numero(de("sin_dato").length), "No se pudo saber", "", "", ""));
    const fueraE = todos.filter((r) => marcaFuera(r, "m_entrada"));
    const fueraS = todos.filter((r) => marcaFuera(r, "m_salida"));
    const antesS = todos.filter((r) => r.entrega_salida === "antes").length;
    const fueraG = todos.filter((r) => marcaFuera(r, "m_gps"));
    const noPaso = todos.filter((r) => ["salida", "entrada"].some((c) => (carroEnMarca(r, c) || {}).cls === "err")).length;
    const m = [
      tile(numero(fueraE.length), "Entradas fuera de horario", "el que recibe, contra su hora", fueraE.length ? "warn" : "ok", ""),
      tile(numero(fueraS.length), "Salidas que no cuadran",
        antesS ? `${plural(antesS, "marcó", "marcaron")} antes de entregar` : "el que entrega, contra la entrega",
        antesS ? "err" : fueraS.length ? "warn" : "ok", "")
    ];
    if (todos.some((r) => r.carro_en_salida || r.carro_en_entrada)) {
      m.push(tile(numero(fueraG.length), "Marcaron donde no estaba el carro",
        noPaso ? `${numero(noPaso)} donde el carro no pasó` : "contra el GPS del carro",
        noPaso ? "err" : fueraG.length ? "warn" : "ok", ""));
    }
    el("nbRelevosResumen").innerHTML = `<div class="nb-rgrupo"><div class="nb-rgrupo-tit">Relevos del día</div>`
      + `<div class="nb-rgrupo-tiles">${t.join("")}</div></div>`
      + `<div class="nb-rgrupo"><div class="nb-rgrupo-tit">Marcas de los conductores</div>`
      + `<div class="nb-rgrupo-tiles">${m.join("")}</div></div>`;

    const q = sinTildes(st.relevosBuscar).trim();
    const lista = todos.filter((r) => {
      if (st.relevosFiltro === "m_entrada" || st.relevosFiltro === "m_salida" || st.relevosFiltro === "m_gps") {
        if (!marcaFuera(r, st.relevosFiltro)) return false;
      } else if (st.relevosFiltro && grupoRelevo(r) !== st.relevosFiltro) return false;
      if (!q) return true;
      return sinTildes(`${r.interno || ""} ${r.entrega_nombre || ""} ${r.recibe_nombre || ""} ${r.punto || ""}`).includes(q);
    });
    el("nbCuentaRelevos").textContent = todos.length ? (lista.length === todos.length ? plural(todos.length, "relevo", "relevos")
      : `${numero(lista.length)} de ${plural(todos.length, "relevo", "relevos")}`) : "";
    const box = el("nbRelevos");
    if (!todos.length) {
      box.innerHTML = `<div class="nb-vacio">Ningún carro de la base tiene relevo (turno 1 y turno 2) en la programación de este día.</div>`;
      return;
    }
    if (!lista.length) {
      box.innerHTML = `<div class="nb-vacio">Ningún relevo coincide con el filtro.</div>`;
      return;
    }
    const filas = lista.map((r) => {
      const c = r.estado === "entregado" ? (CAUSA_RELEVO[r.causa] || {}).cls : "";
      const marca = r.estado === "entregado" && Number(r.minutos) > 10 ? ` nb-rl-${c === "err" ? "err" : "warn"}` : "";
      return `<tr class="nb-rl nb-rl-click${marca}" data-bus="${esc(r.interno)}" tabindex="0" title="Ver las fotos de las marcas">`
        + `<td class="nb-rl-c-bus" data-l="Bus"><span class="nb-rl-bus">${esc(r.interno)}</span><div class="nb-rl-nota">${esc(nombrePunto(r.punto))}</div>`
        + `<div class="nb-rl-verfotos">Ver fotos</div></td>`
        + `<td class="nb-rl-c-hora" data-l="Relevo"><b>${esc(r.relevo)}</b></td>`
        + `<td class="nb-rl-c-donde" data-l="A esa hora el carro estaba">${aLaHoraRelevo(r)}</td>`
        + `<td class="nb-rl-c-entrega" data-l="Entrega del carro">${entregaRelevo(r)}</td>`
        + `<td class="nb-rl-c-porque" data-l="Por qué">${porqueRelevo(r)}</td>`
        + `<td class="nb-rl-c-cond" data-l="Los dos conductores: turnos, marcas y el carro">${conductoresRelevo(r, d.fecha)}</td></tr>`;
    }).join("");
    box.innerHTML = `<div class="nb-tabla-caja"><table class="nb-tabla nb-tabla-relevos"><thead><tr><th>Bus</th><th>Relevo</th>`
      + `<th>A esa hora el carro estaba</th><th>Entrega del carro</th><th>Por qué</th><th>Los dos conductores: turnos, marcas y el carro</th></tr></thead>`
      + `<tbody>${filas}</tbody></table></div>`;
  }

  /* ---------- Turnos del dia: la celda cambiada dice quien y cuando ---------- */
  const marcas = { clave: "", en: 0, datos: null, cargando: false, reloj: null };
  function fechaTurnos(){
    try {
      return (typeof filterDate2 !== "undefined" && filterDate2 && typeof normalizeDateToISO === "function")
        ? normalizeDateToISO(filterDate2.value || "") : "";
    } catch (_) {
      return "";
    }
  }
  function turnosActiva(){
    return !!el("tab-programacion2")?.classList.contains("active");
  }
  async function cargarMarcas(forzar){
    if (!puedeVer()) return;
    const fecha = fechaTurnos();
    const base = baseActiva();
    if (!fecha || !base) { marcas.datos = null; pintarMarcas(); return; }
    const clave = `${fecha}|${etiquetaBase(base)}`;
    if (!forzar && marcas.clave === clave && Date.now() - marcas.en < CADA_MS.cambios) { pintarMarcas(); return; }
    const cli = cliente();
    if (!cli || marcas.cargando) return;
    marcas.cargando = true;
    try {
      const { data, error } = await cli.rpc(RPC_CAMBIOS, { p_fecha: fecha, p_base: etiquetaBase(base) });
      if (error) throw error;
      marcas.datos = data && data.ok ? data : null;
    } catch (err) {
      marcas.datos = null;   // sin la funcion todavia o sin permiso: no se marca nada
      if (!errorEsperado(err)) console.warn("[cambios] no se pudieron leer los cambios:", err?.message || err);
    } finally {
      marcas.clave = clave;
      marcas.en = Date.now();
      marcas.cargando = false;
    }
    if (fechaTurnos() === fecha) pintarMarcas();
  }
  function pintarBarraTurnos(lista, fecha){
    const body = (typeof gridBody2 !== "undefined") ? gridBody2 : null;
    const tabla = body?.closest("table");
    if (!tabla || !tabla.parentNode) return;
    let barra = el("cambiosTurnosBarra");
    if (!barra) {
      barra = document.createElement("div");
      barra.id = "cambiosTurnosBarra";
      barra.className = "cambios-barra";
      tabla.parentNode.insertBefore(barra, tabla);
      barra.addEventListener("click", (ev) => {
        if (!ev.target.closest("[data-ver-cambios]")) return;
        st.fecha = fechaTurnos() || st.fecha;
        st.cambios = null;
        st.vista = "cambios";
        document.querySelector('.tab[data-tab="novedades-base"]')?.click();
        cambiarVista("cambios");
      });
    }
    if (!lista) { barra.innerHTML = ""; barra.hidden = true; return; }
    barra.hidden = false;
    if (!lista.length) {
      barra.innerHTML = `<span class="nb-mut">Nadie ha cambiado la programación de este día.</span>`;
      return;
    }
    const porQuien = new Map();
    lista.forEach((c) => { const q = quienTxt(c.quien); porQuien.set(q.txt, { cls: q.cls, n: ((porQuien.get(q.txt) || {}).n || 0) + 1 }); });
    const quienes = [...porQuien.entries()].sort((a, b) => b[1].n - a[1].n)
      .map(([txt, v]) => `<span class="nb-badge ${v.cls}">${esc(txt)} · ${numero(v.n)}</span>`).join(" ");
    barra.innerHTML = `<span>✎ <b>${plural(lista.length, "cambio", "cambios")}</b> en la programación de este día</span> ${quienes}`
      + ` <button type="button" class="btn btn-ghost nb-btn-mini" data-ver-cambios>Ver quién cambió qué</button>`;
  }
  function pintarMarcas(){
    const body = (typeof gridBody2 !== "undefined") ? gridBody2 : null;
    if (!body) return;
    body.querySelectorAll(".cambio-marca").forEach((x) => x.remove());
    body.querySelectorAll("td.td-cambiada").forEach((x) => x.classList.remove("td-cambiada"));
    const d = marcas.datos;
    const lista = d && Array.isArray(d.cambios) ? d.cambios.filter((c) => c.origen === "turnos") : null;
    pintarBarraTurnos(puedeVer() && fechaTurnos() && baseActiva() ? lista : null);
    if (!lista || !lista.length) return;
    const ultimo = new Map();   // fila|campo -> el cambio mas nuevo (la lista viene de la mas nueva a la mas vieja)
    lista.forEach((c) => {
      if (c.accion !== "cambio" || !c.row_key || !c.campo) return;
      const k = `${c.row_key}|${normCampo(c.campo)}`;
      if (!ultimo.has(k)) ultimo.set(k, c);
    });
    if (!ultimo.size) return;
    body.querySelectorAll("tr[data-row-key]").forEach((tr) => {
      tr.querySelectorAll("td[data-campo]").forEach((td) => {
        const c = ultimo.get(`${tr.dataset.rowKey}|${normCampo(td.dataset.campo)}`);
        if (!c) return;
        const q = quienTxt(c.quien);
        const s = document.createElement("span");
        s.className = `cambio-marca cambio-${q.cls}`;
        s.textContent = `✎ ${q.txt} · ${cuandoTxt(c.en, d.fecha)}`;
        s.title = `Cambiado por ${q.txt} (${cuandoTxt(c.en, "")}). Antes: ${c.antes == null || c.antes === "" ? "(vacío)" : c.antes}`;
        td.classList.add("td-cambiada");
        td.appendChild(s);
      });
    });
  }
  // La tabla de turnos se vuelve a pintar seguido (al asignar, al guardar): se marcan de una vez con lo que ya se
  // sabe y se piden los cambios otra vez a los pocos segundos (sin pedir mas de una vez cada 8 s).
  window.combuasignaMarcarCambios = function(){
    pintarMarcas();
    clearTimeout(marcas.reloj);
    const espera = Math.max(1500, 8000 - (Date.now() - marcas.en));
    marcas.reloj = setTimeout(() => { if (turnosActiva()) cargarMarcas(true); }, espera);
  };
  setInterval(() => {
    if (turnosActiva() && document.visibilityState === "visible") cargarMarcas(false);
  }, 20 * 1000);

  /* =====================================================================
     G. EXCEL (v2.13.0): los ingresos y salidas del biométrico, los programados y los relevos de la base, de un día o
        de varios (hasta 31). Se le pide a la base de datos lo mismo que muestra la pantalla, día por día, y se arma
        el libro con ExcelJS. Hojas: Resumen, Ingresos y salidas, Programados y Relevos.
     ===================================================================== */
  const XL_MAX_DIAS = 31;
  const xl = { corriendo: false, cancelado: false };
  const XL_PROG = { entro: "Entró", tarde: "Ya debía entrar", no_entro: "No entró", proximo: "Entra en la próxima hora",
    despues: "Entra más tarde" };
  const XL_GRUPO = { tarde: "Entregó tarde", a_tiempo: "A tiempo", antes: "Antes de la hora" };
  const XL_COLOR = { ok: "FFDCFCE7", warn: "FFFEF3C7", err: "FFFDE2E2", info: "FFDBEAFE", mut: "FFF1F5F9" };

  // El texto de un pedazo de pantalla (los mismos textos de la vista), sin etiquetas.
  function plano(html){
    const d = document.createElement("div");
    d.innerHTML = html || "";
    d.querySelectorAll("div, li, br").forEach((n) => n.insertAdjacentText("beforebegin", " · "));
    d.querySelectorAll("span, small, b, strong").forEach((n) => n.insertAdjacentText("beforebegin", " "));
    return d.textContent.replace(/\s+/g, " ").replace(/(\s*·\s*)+/g, " · ").replace(/^\s*·\s*|\s*·\s*$/g, "").trim();
  }
  function fechaXl(iso){
    const [y, m, d] = String(iso || "").split("-").map(Number);
    return y ? new Date(Date.UTC(y, m - 1, d)) : null;
  }
  function cedulaXl(dni){
    const s = String(dni || "").trim();
    return /^\d{1,12}$/.test(s) ? Number(s) : s;
  }
  function numXl(v){
    if (v === null || v === undefined || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  function puntoXl(p){
    return p ? nombrePunto(p) : "";
  }
  function llegadaXl(e){
    if (e.puntualidad === "temprano" && e.dif != null) return `${minutosTxt(e.dif)} antes`;
    if (e.puntualidad === "tarde" && e.dif != null) return `${minutosTxt(e.dif)} tarde`;
    if (e.puntualidad === "a_tiempo") return "A tiempo";
    return (LLEGADA[e.puntualidad] || LLEGADA.sin_programacion).txt;
  }
  function motivosXl(lista){
    return (Array.isArray(lista) ? lista : []).map((m) => {
      const x = leerMotivo(m);
      return [x.tipo, x.det, x.txt ? `«${x.txt}»` : ""].filter(Boolean).join(" · ");
    }).join(" | ");
  }
  function estadoSalidaXl(e, esHoy){
    if (e.salida) return "Cerrado";
    if (Number(e.abierta_horas || 0) > SIN_CERRAR_H) return "Sin cerrar";
    return esHoy ? "En turno" : "Sin salida";
  }
  function marcaXl(m, fecha){
    if (!m || !m.hora) return "";
    const otroDia = m.fecha && fecha && m.fecha !== fecha ? ` (${fechaCorta(m.fecha)})` : "";
    const partes = [`${m.hora}${otroDia}${m.punto ? ` en ${nombrePunto(m.punto)}` : ""}`];
    const o = ORIGEN[m.origen] || m.origen;
    if (o) partes.push(o);
    const c = cuentaMarca(m);
    if (c) partes.push(c);
    return partes.join(" · ");
  }
  function turnoXl(x){
    return x && x.desde ? `${x.desde} a ${x.hasta || "?"}` : "";
  }
  function resultadoRelevoXl(r){
    if (r.estado === "entregado") return XL_GRUPO[grupoRelevo(r)] || "Entregó tarde";
    if (r.estado === "en_curso") return "Todavía no lo entrega";
    if (r.estado === "falta") return "Todavía no es la hora";
    if (r.estado === "sin_gps") return "Sin GPS del carro";
    return "No se pudo saber";
  }

  async function leerDiaXl(cli, base, fecha){
    const args = { p_fecha: fecha, p_base: etiquetaBase(base) };
    const [n, r] = await Promise.all([cli.rpc(RPC_NOVEDADES, args), cli.rpc(RPC_RELEVOS, args)]);
    if (n.error) throw n.error;
    if (!n.data || !n.data.ok) throw new Error("La base de datos no devolvió las novedades.");
    let rel = null;
    let relFalta = false;
    if (r.error) {
      if (String(r.error.code || "") === "PGRST202") relFalta = true;
      else throw r.error;
    } else if (r.data && r.data.ok) {
      rel = r.data;
    }
    return { fecha, nov: n.data, rel, relFalta };
  }

  function hojaXl(wb, nombre, cols, filas, vacio){
    const ws = wb.addWorksheet(nombre, { views: [{ state: "frozen", ySplit: 1 }] });
    ws.columns = cols.map((c) => ({ header: c.t, width: c.w || 12, style: c.f ? { numFmt: c.f } : {} }));
    if (filas.length) filas.forEach((f) => ws.addRow(f));
    else ws.addRow([vacio || "No hay datos en esas fechas."]);
    const cab = ws.getRow(1);
    cab.height = 32;
    cab.eachCell((c) => {
      c.font = { bold: true, color: { argb: "FFFFFFFF" } };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E40AF" } };
      c.alignment = { vertical: "middle", wrapText: true };
    });
    cols.forEach((c, i) => {
      if (c.wrap) ws.getColumn(i + 1).alignment = { wrapText: true, vertical: "top" };
    });
    if (filas.length) ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1 + filas.length, column: cols.length } };
    return ws;
  }
  // Colorea una columna según su texto (tono(valor) -> "ok" | "warn" | "err" | "info" | "mut" | "").
  function tonoXl(ws, col, tono){
    ws.eachRow((row, n) => {
      if (n === 1) return;
      const c = row.getCell(col);
      const k = tono(String(c.value == null ? "" : c.value));
      if (k && XL_COLOR[k]) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: XL_COLOR[k] } };
    });
  }

  function armarExcel(base, desde, hasta, dias){
    const wb = new ExcelJS.Workbook();
    wb.creator = "CombuAsigna";
    wb.created = new Date();
    const res = [], ing = [], prog = [], rel = [];
    let relFalta = false;
    dias.forEach(({ fecha, nov, rel: R, relFalta: falta }) => {
      const x = derivar(nov);
      const esHoy = !!nov.es_hoy;
      const revs = Array.isArray(nov.por_revisar) ? nov.por_revisar : [];
      x.E.forEach((e) => {
        const s = e.salida;
        const notas = revs.filter((r) => String(r.ref) === String(e.id) && r.revision)
          .map((r) => `${r.revision.nota} (${revisionTxt(r.revision)})`).join(" | ");
        const mj = motivoJornada(e);
        ing.push([fechaXl(fecha), e.nombre || "", cedulaXl(e.dni), partirBus(e.bus).num || "", partirBus(e.bus_prog).num || "",
          numXl(e.turno) ?? (e.turno || ""), e.hora_prog || "", e.hora || "", llegadaXl(e), numXl(e.dif),
          ORIGEN[e.origen] || e.origen || "", puntoXl(e.punto), motivosXl(e.motivos),
          s ? fechaXl(s.fecha || fecha) : null, s ? (s.hora || "") : "", s ? (ORIGEN[s.origen] || s.origen || "") : "",
          s ? puntoXl(s.punto) : "", s ? motivosXl(s.motivos) : "",
          numXl(e.horas), estadoSalidaXl(e, esHoy),
          e.jornada_excedida ? `Sí · ${mj ? `«${mj}»` : "sin explicar"}` : "", notas]);
      });
      x.P.forEach((p) => {
        const disp = p.puesto === "DISPONIBLE";
        prog.push([fechaXl(fecha), p.nombre || "", cedulaXl(p.dni), disp ? "Disponible" : (numXl(p.turno) ?? (p.turno || "")),
          p.hora_entrada || "", p.hora_salida || "", partirBus(p.bus).num || "", p.puesto || "",
          XL_PROG[p.estado] || (esHoy ? "No ha marcado" : "No marcó"), p.entrada_hora || ""]);
      });
      if (falta) relFalta = true;
      const RL = (R && Array.isArray(R.relevos)) ? R.relevos.slice() : [];
      RL.sort((a, b) => String(a.relevo || "").localeCompare(String(b.relevo || "")) || numBus(a.interno) - numBus(b.interno));
      RL.forEach((r) => {
        const t = r.turnos || {};
        const e1 = marcaDe(r, "e1"), s1 = marcaDe(r, "s1"), e2 = marcaDe(r, "e2"), s2 = marcaDe(r, "s2");
        const entregado = r.estado === "entregado";
        const motivos = [e1, s1, e2, s2].filter(Boolean).map((m) => motivosXl(m.motivos)).filter(Boolean).join(" | ");
        rel.push([fechaXl(fecha), r.interno || "", r.puesto || "", puntoXl(r.punto), r.relevo || "",
          resultadoRelevoXl(r), entregado ? (r.entrega || "") : "", entregado ? numXl(r.minutos) : null,
          plano(porqueRelevo(r)), plano(aLaHoraRelevo(r)), plano(entregaRelevo(r) + notaPuntoRelevo(r)),
          r.entrega_nombre || "", turnoXl(t.t1), marcaXl(e1, fecha), marcaXl(s1, fecha), (salidaRelevo(r) || {}).txt || "",
          s1 ? ((carroEnMarca(r, "salida") || {}).txt || "") : "",
          r.recibe_nombre || "", turnoXl(t.t2), marcaXl(e2, fecha), (entradaRelevo(r) || {}).txt || "",
          e2 ? ((carroEnMarca(r, "entrada") || {}).txt || "") : "",
          numXl(r.recibe_espero_min) > 0 ? numXl(r.recibe_espero_min) : null,
          numXl(r.carro_espero_min) > 0 ? numXl(r.carro_espero_min) : null, marcaXl(s2, fecha), motivos]);
      });
      const entregados = (k) => RL.filter((r) => r.estado === "entregado" && grupoRelevo(r) === k).length;
      res.push([fechaXl(fecha), x.turnos.length, x.E.length, x.cuenta("a_tiempo"), x.cuenta("temprano"), x.cuenta("tarde"),
        x.cuenta("sin_programacion"), x.noEntro.length + x.tarde.length, x.conSalida.length, x.sinCerrar.length, x.largas.length,
        R ? RL.length : null, R ? entregados("tarde") : null, R ? entregados("a_tiempo") : null, R ? entregados("antes") : null,
        R ? RL.filter((r) => grupoRelevo(r) === "en_curso").length : null,
        R ? RL.filter((r) => grupoRelevo(r) === "sin_dato").length : null]);
    });

    const F = "dd/mm/yyyy";
    // Resumen
    const RES = [{ t: "Día", f: F, w: 11 }, { t: "Programados", w: 12 }, { t: "Entraron", w: 10 }, { t: "A tiempo", w: 10 },
      { t: "Temprano", w: 10 }, { t: "Tarde", w: 9 }, { t: "Sin turno", w: 10 }, { t: "No entraron", w: 11 }, { t: "Salidas", w: 9 },
      { t: "Sin cerrar", w: 10 }, { t: "Jornadas de más de 16 h", w: 13 }, { t: "Relevos", w: 9 }, { t: "Entregaron tarde", w: 11 },
      { t: "Relevos a tiempo", w: 10 }, { t: "Relevos antes de la hora", w: 12 }, { t: "Todavía no", w: 10 }, { t: "No se pudo saber", w: 11 }];
    const wsR = hojaXl(wb, "Resumen", RES, res);
    if (res.length > 1) {
      const tot = ["Total"];
      for (let i = 1; i < RES.length; i++) {
        const vals = res.map((f) => f[i]).filter((v) => typeof v === "number");
        tot.push(vals.length ? vals.reduce((a, b) => a + b, 0) : null);
      }
      const fila = wsR.addRow(tot);
      fila.font = { bold: true };
      fila.eachCell((c) => { c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0E7FF" } }; });
    }
    wsR.addRow([]);
    const desc = new Date().toLocaleString("es-CO", { timeZone: "America/Bogota", day: "numeric", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit" });
    wsR.addRow([`${etiquetaBase(base)} · del ${fechaLarga(desde)} al ${fechaLarga(hasta)} · descargado el ${desc}`]);
    wsR.addRow(["Ingresos y salidas: las marcas del biométrico y del celular de los conductores de la base. Programados: quién tenía turno y si entró. Relevos: a qué hora se entregó de verdad cada carro (GPS) y las marcas de los dos conductores."]);
    if (relFalta) wsR.addRow(["Los relevos todavía no están activos en la base de datos: esa hoja sale vacía."]);
    // Ingresos y salidas
    const ING = [{ t: "Día", f: F, w: 11 }, { t: "Conductor", w: 30 }, { t: "Cédula", f: "0", w: 13 }, { t: "Bus", w: 7 },
      { t: "Bus programado", w: 10 }, { t: "Turno", w: 7 }, { t: "Hora del turno", w: 9 }, { t: "Entrada", w: 9 },
      { t: "Llegada", w: 16 }, { t: "Minutos (− antes, + tarde)", w: 12 }, { t: "Entrada marcada en", w: 13 },
      { t: "Punto de la entrada", w: 18 }, { t: "Motivo de la entrada", w: 42, wrap: true }, { t: "Día de la salida", f: F, w: 11 },
      { t: "Salida", w: 9 }, { t: "Salida marcada en", w: 13 }, { t: "Punto de la salida", w: 18 },
      { t: "Motivo de la salida", w: 42, wrap: true }, { t: "Horas", f: "0.0", w: 8 }, { t: "Estado", w: 11 },
      { t: "Jornada de más de 16 h", w: 24, wrap: true }, { t: "Revisión de la base", w: 42, wrap: true }];
    const wsI = hojaXl(wb, "Ingresos y salidas", ING, ing, "No hubo marcas de conductores de la base en esas fechas.");
    tonoXl(wsI, 9, (v) => (/tarde/i.test(v) ? "err" : /antes/i.test(v) ? "warn" : /a tiempo/i.test(v) ? "ok" : ""));
    tonoXl(wsI, 20, (v) => (v === "Sin cerrar" ? "err" : v === "En turno" ? "info" : ""));
    tonoXl(wsI, 21, (v) => (v ? "err" : ""));
    // Programados
    const PROG = [{ t: "Día", f: F, w: 11 }, { t: "Conductor", w: 30 }, { t: "Cédula", f: "0", w: 13 }, { t: "Turno", w: 11 },
      { t: "Entra", w: 8 }, { t: "Sale", w: 8 }, { t: "Bus", w: 7 }, { t: "Puesto", w: 22 }, { t: "Estado", w: 18 },
      { t: "Hora en que entró", w: 10 }];
    const wsP = hojaXl(wb, "Programados", PROG, prog, "No hay programación de la base en esas fechas.");
    tonoXl(wsP, 9, (v) => (/^Entró/.test(v) ? "ok" : /No entró|Ya debía/.test(v) ? "err" : /No marcó|No ha marcado/.test(v) ? "warn" : ""));
    // Relevos
    const REL = [{ t: "Día", f: F, w: 11 }, { t: "Bus", w: 7 }, { t: "Puesto", w: 16 }, { t: "Punto del relevo", w: 16 },
      { t: "Hora del relevo", w: 9 }, { t: "Resultado", w: 16 }, { t: "Entrega (hora)", w: 9 },
      { t: "Minutos (− antes, + tarde)", w: 12 }, { t: "Por qué", w: 40, wrap: true },
      { t: "A la hora del relevo el carro estaba", w: 34, wrap: true }, { t: "Detalle de la entrega", w: 40, wrap: true },
      { t: "Conductor 1 (entrega)", w: 28 }, { t: "Turno 1", w: 13 }, { t: "Entrada del conductor 1", w: 34, wrap: true },
      { t: "Salida del conductor 1", w: 34, wrap: true }, { t: "Salida contra la entrega", w: 24, wrap: true },
      { t: "El carro cuando marcó la salida", w: 40, wrap: true }, { t: "Conductor 2 (recibe)", w: 28 }, { t: "Turno 2", w: 13 },
      { t: "Entrada del conductor 2", w: 34, wrap: true }, { t: "Entrada contra su hora", w: 22, wrap: true },
      { t: "El carro cuando marcó la entrada", w: 40, wrap: true }, { t: "Esperó el carro (min)", w: 10 },
      { t: "El carro lo esperó (min)", w: 10 }, { t: "Salida del conductor 2", w: 34, wrap: true },
      { t: "Motivos escritos", w: 42, wrap: true }];
    const wsL = hojaXl(wb, "Relevos", REL, rel, relFalta
      ? "Los relevos todavía no están activos en la base de datos."
      : "No hubo relevos de carros de la base en esas fechas.");
    tonoXl(wsL, 6, (v) => (v === "Entregó tarde" ? "err" : v === "A tiempo" ? "ok" : v === "Antes de la hora" ? "info"
      : /Todavía/.test(v) ? "info" : v ? "mut" : ""));
    tonoXl(wsL, 16, (v) => (/^Cuadra/.test(v) ? "ok" : /antes|No marcó/.test(v) ? "err" : v ? "warn" : ""));
    tonoXl(wsL, 21, (v) => (/^En su horario/.test(v) ? "ok" : /tarde|No marcó/.test(v) ? "err" : v ? "warn" : ""));
    return wb;
  }

  function nombreXl(base, desde, hasta){
    // con espacios, como lo guardaría una persona; solo se quitan los signos que Windows no deja en un nombre
    return `Mi base ${etiquetaBase(base)} - biometrico y relevos ${desde}${hasta !== desde ? ` a ${hasta}` : ""}.xlsx`
      .replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim();
  }

  async function descargarExcel(){
    if (xl.corriendo) return;
    const base = baseActiva();
    const cli = cliente();
    const estado = el("nbXlEstado");
    const btn = el("nbXlBajar");
    const aviso = (txt, tipo) => {
      if (!estado) return;
      estado.textContent = txt;
      estado.className = `nb-xl-estado${tipo ? ` nb-estado-${tipo}` : ""}`;
    };
    const desde = el("nbXlDesde")?.value || "";
    const hasta = el("nbXlHasta")?.value || "";
    const h = hoy();
    const min = masDias(h, -DIAS_ATRAS);
    if (!base || !cli) { aviso("Abra una base arriba (Abrir base) para descargar.", "err"); return; }
    if (!window.ExcelJS) { aviso("No se pudo cargar la herramienta de Excel. Recargue la página e intente de nuevo.", "err"); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(desde) || !/^\d{4}-\d{2}-\d{2}$/.test(hasta)) { aviso("Escoja las dos fechas.", "err"); return; }
    if (desde > hasta) { aviso("La fecha «Desde» va antes que «Hasta».", "err"); return; }
    if (desde < min || hasta > h) { aviso(`Escoja días entre el ${fechaCorta(min)} y hoy.`, "err"); return; }
    const n = diasEntre(desde, hasta) + 1;
    if (n > XL_MAX_DIAS) { aviso(`Son ${n} días: escoja máximo ${XL_MAX_DIAS} por archivo.`, "err"); return; }
    xl.corriendo = true;
    xl.cancelado = false;
    if (btn) btn.disabled = true;
    try {
      const dias = [];
      for (let i = 0; i < n; i++) {
        if (xl.cancelado) return;
        aviso(n === 1 ? "Leyendo el día…" : `Leyendo ${i + 1} de ${n} días…`, "cargando");
        dias.push(await leerDiaXl(cli, base, masDias(desde, i)));
      }
      if (xl.cancelado) return;
      aviso("Armando el Excel…", "cargando");
      const wb = armarExcel(base, desde, hasta, dias);
      const buffer = await wb.xlsx.writeBuffer();
      if (xl.cancelado) return;
      const nombre = nombreXl(base, desde, hasta);
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = nombre;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      const marcas = dias.reduce((s, d) => s + ((d.nov.entradas || []).length), 0);
      const relevos = dias.reduce((s, d) => s + ((d.rel && d.rel.relevos) || []).length, 0);
      aviso(`Listo: se descargó «${nombre}» (${plural(marcas, "ingreso", "ingresos")} y ${plural(relevos, "relevo", "relevos")}).`, "ok");
    } catch (err) {
      if (!xl.cancelado) {
        aviso(mensajeError(err, "los datos para el Excel").replace("Se vuelve a intentar sola en un minuto.", "Intente de nuevo."), "err");
        if (!errorEsperado(err) && typeof reportError === "function" && navigator.onLine) {
          reportError("No se pudo descargar el Excel de Mi base", err, { hint: "Intente de nuevo. Si vuelve a salir, envíe este error." });
        }
      }
    } finally {
      xl.corriendo = false;
      if (btn) btn.disabled = false;
    }
  }

  function abrirExcel(){
    if (!puedeVer()) return;
    const base = baseActiva();
    if (!base) { setEstado("Abra una base arriba (Abrir base) para descargar el Excel.", "info"); return; }
    const h = hoy();
    const dia = st.fecha && st.fecha <= h ? st.fecha : h;
    const min = masDias(h, -DIAS_ATRAS);
    xl.cancelado = true;   // si había una descarga a medias, se suelta
    el("nbModal")?.querySelector(".nb-modal-card")?.classList.remove("nb-modal-relevo");
    el("nbModalTitulo").textContent = "Descargar en Excel";
    el("nbModalSub").textContent = `${etiquetaBase(base)} · ingresos y salidas del biométrico, programados y relevos`;
    el("nbModalCuerpo").innerHTML = `<div class="nb-xl">`
      + `<div class="nb-xl-fechas">`
      + `<label>Desde <input type="date" id="nbXlDesde" min="${esc(min)}" max="${esc(h)}" value="${esc(dia)}"></label>`
      + `<label>Hasta <input type="date" id="nbXlHasta" min="${esc(min)}" max="${esc(h)}" value="${esc(dia)}"></label>`
      + `</div>`
      + `<div class="nb-xl-atajos">`
      + `<button type="button" class="nb-chip" data-xl="dia">Solo el ${esc(fechaCorta(dia))}</button>`
      + `<button type="button" class="nb-chip" data-xl="7">Últimos 7 días</button>`
      + `<button type="button" class="nb-chip" data-xl="mes">Este mes</button>`
      + `</div>`
      + `<ul class="nb-xl-hojas">`
      + `<li><b>Resumen</b>: por día, cuántos entraron (a tiempo, temprano, tarde), no entraron, salidas, sin cerrar y relevos.</li>`
      + `<li><b>Ingresos y salidas</b>: cada marca del biométrico o del celular, con turno, llegada, punto, motivo, salida y horas.</li>`
      + `<li><b>Programados</b>: quién tenía turno y si entró.</li>`
      + `<li><b>Relevos</b>: a qué hora se entregó cada carro, por qué y las marcas de los dos conductores.</li>`
      + `</ul>`
      + `<p class="nb-xl-nota">Hasta ${XL_MAX_DIAS} días por archivo, de los últimos dos meses.</p>`
      + `<div class="nb-xl-pie"><button type="button" class="btn btn-primary" id="nbXlBajar">Descargar Excel</button>`
      + `<div class="nb-xl-estado" id="nbXlEstado" role="status"></div></div>`
      + `</div>`;
    const poner = (d, a) => {
      el("nbXlDesde").value = d < min ? min : d;
      el("nbXlHasta").value = a > h ? h : a;
    };
    el("nbModalCuerpo").querySelectorAll("[data-xl]").forEach((b) => b.addEventListener("click", () => {
      const k = b.dataset.xl;
      if (k === "dia") poner(dia, dia);
      else if (k === "7") poner(masDias(h, -6), h);
      else {
        const ini = `${h.slice(0, 8)}01`;
        poner(ini, h);
      }
    }));
    el("nbXlBajar")?.addEventListener("click", descargarExcel);
    xl.cancelado = false;
    el("nbModal").classList.remove("hidden");
    el("nbXlBajar")?.focus();
  }

  /* ---------- eventos ---------- */
  function irA(fecha){
    const h = hoy();
    let f = fecha || h;
    if (f > diaMaximo()) f = diaMaximo();
    if (f < masDias(h, -DIAS_ATRAS)) f = masDias(h, -DIAS_ATRAS);
    if (f === st.fecha && datosDe(st.vista)) return;
    st.fecha = f;
    st.datos = null;
    st.viajes = null;
    st.cambios = null;
    st.relevos = null;
    cargar();
  }

  function bind(){
    const tab = document.querySelector('.tab[data-tab="novedades-base"]');
    if (!tab) return;
    tab.addEventListener("click", () => {
      if (!st.fecha) st.fecha = hoy();
      if (EXTERNAS[st.vista]) { mostrarExterna(st.vista); return; }   // vuelve a Despachos o al Visor
      cargar({ silencioso: !!datosDe(st.vista) });
    });
    el("nbVistas")?.addEventListener("click", (ev) => {
      const b = ev.target.closest(".nb-vista");
      if (b) cambiarVista(b.dataset.vista);
    });
    el("nbActualizar")?.addEventListener("click", () => cargar());
    el("nbFecha")?.addEventListener("change", (ev) => irA(ev.target.value));
    el("nbAnterior")?.addEventListener("click", () => irA(masDias(st.fecha || hoy(), -1)));
    el("nbSiguiente")?.addEventListener("click", () => irA(masDias(st.fecha || hoy(), 1)));
    el("nbHoy")?.addEventListener("click", () => irA(hoy()));
    el("nbExcel")?.addEventListener("click", abrirExcel);
    el("nbBuscar")?.addEventListener("input", (ev) => { st.buscar = ev.target.value || ""; pintarEntradas(); });
    el("nbChips")?.addEventListener("click", (ev) => {
      const b = ev.target.closest(".nb-chip");
      if (!b) return;
      st.filtro = b.dataset.f || "";
      el("nbChips").querySelectorAll(".nb-chip").forEach((c) => c.classList.toggle("activo", c === b));
      pintarEntradas();
    });
    el("nbChipsRevisar")?.addEventListener("click", (ev) => {
      const b = ev.target.closest(".nb-chip");
      if (!b) return;
      st.revFiltro = b.dataset.r || "pendientes";
      el("nbChipsRevisar").querySelectorAll(".nb-chip").forEach((c) => c.classList.toggle("activo", c === b));
      if (st.datos) pintarRevisar(st.datos);
    });
    // Filtro por tipo y páginas de Por revisar.
    el("nbRevisar")?.addEventListener("click", (ev) => {
      const t = ev.target.closest(".nb-rev-tipo");
      if (t) {
        st.revTipo = t.dataset.t || "";
        if (st.datos) pintarRevisar(st.datos);
        return;
      }
      const p = ev.target.closest(".nb-pag-btn");
      if (p && !p.disabled && st.datos) {
        const v = p.dataset.pag;
        st.revPagina = v === "prev" ? (st.revPagina || 1) - 1 : v === "next" ? (st.revPagina || 1) + 1 : Number(v) || 1;
        pintarRevisar(st.datos);
        el("nbSecRevisar")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
    el("nbViajesBuscar")?.addEventListener("input", (ev) => { st.buscarViajes = ev.target.value || ""; pintarViajes(); });
    el("nbCambiosBuscar")?.addEventListener("input", (ev) => { st.cambiosBuscar = ev.target.value || ""; pintarCambios(); });
    el("nbCambiosChips")?.addEventListener("click", (ev) => {
      const b = ev.target.closest(".nb-chip");
      if (!b) return;
      st.cambiosFiltro = b.dataset.c || "";
      el("nbCambiosChips").querySelectorAll(".nb-chip").forEach((c) => c.classList.toggle("activo", c === b));
      pintarCambios();
    });
    el("nbRelevosBuscar")?.addEventListener("input", (ev) => { st.relevosBuscar = ev.target.value || ""; pintarRelevos(); });
    el("nbRelevos")?.addEventListener("click", (ev) => {
      if (ev.target.closest("details, summary, a, button, input")) return;
      const tr = ev.target.closest("tr[data-bus]");
      if (tr) abrirRelevo(tr.dataset.bus);
    });
    el("nbRelevos")?.addEventListener("keydown", (ev) => {
      if ((ev.key === "Enter" || ev.key === " ") && ev.target.matches("tr[data-bus]")) {
        ev.preventDefault();
        abrirRelevo(ev.target.dataset.bus);
      }
    });
    el("nbRelevosChips")?.addEventListener("click", (ev) => {
      const b = ev.target.closest(".nb-chip");
      if (!b) return;
      st.relevosFiltro = b.dataset.r || "";
      el("nbRelevosChips").querySelectorAll(".nb-chip").forEach((c) => c.classList.toggle("activo", c === b));
      pintarRelevos();
    });
    el("nbConductoresBuscar")?.addEventListener("input", (ev) => { st.conductoresBuscar = ev.target.value || ""; pintarConductores(); });
    el("nbConductoresChips")?.addEventListener("click", (ev) => {
      const b = ev.target.closest(".nb-chip");
      if (!b) return;
      st.conductoresFiltro = b.dataset.h || "";
      el("nbConductoresChips").querySelectorAll(".nb-chip").forEach((c) => c.classList.toggle("activo", c === b));
      pintarConductores();
    });
    ["nbHoraDesde", "nbHoraHasta"].forEach((id) => el(id)?.addEventListener("change", (ev) => {
      if (id === "nbHoraDesde") st.horasDesde = ev.target.value || "";
      else st.horasHasta = ev.target.value || "";
      pintarViajes();
    }));
    el("nbHorasChips")?.addEventListener("click", (ev) => {
      const b = ev.target.closest(".nb-chip");
      if (!b) return;
      const [d, h] = (b.dataset.h || "").split("-");
      st.horasDesde = d || "";
      st.horasHasta = h || "";
      pintarViajes();
    });
    el("nbViajesAbrir")?.addEventListener("click", () => {
      st.viajesAbiertos = !st.viajesAbiertos;
      el("nbViajesAbrir").textContent = st.viajesAbiertos ? "Cerrar todos" : "Abrir todos";
      pintarViajes();
    });
    const cont = el("tab-novedades-base");
    // Con "Mi base" abierta la pagina usa todo el ancho: el cuadro "Conductores disponibles"
    // es de la asignacion de turnos y aqui solo quita espacio. Vuelve al cambiar de pestana.
    const ajustarAncho = () => el("operativoInner")?.classList.toggle("nb-ancho", tabActiva());
    if (cont && typeof MutationObserver === "function") {
      new MutationObserver(ajustarAncho).observe(cont, { attributes: true, attributeFilter: ["class"] });
    }
    ajustarAncho();
    cont?.addEventListener("click", (ev) => {
      const ir = ev.target.closest("[data-ir]");
      if (ir) {
        el(ir.dataset.ir)?.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
      const rev = ev.target.closest(".nb-btn-revisar");
      if (rev) {
        abrirRevisar(rev.dataset.tipo, rev.dataset.clave);
        return;
      }
      if (ev.target.closest("summary")) return;
      const f = ev.target.closest("[data-id]");
      if (f && cont.contains(f)) abrirDetalle(f.dataset.id);
    });
    cont?.addEventListener("keydown", (ev) => {
      if ((ev.key === "Enter" || ev.key === " ") && ev.target.matches("[data-id]")) {
        ev.preventDefault();
        abrirDetalle(ev.target.dataset.id);
      }
    });
    el("nbModalCerrar")?.addEventListener("click", cerrarDetalle);
    // la ventana del relevo: tocar una foto pequeña la muestra grande
    el("nbModalCuerpo")?.addEventListener("click", (ev) => {
      const f = ev.target.closest && ev.target.closest(".nb-rv-foto");
      if (f) verFotoGrande(f.querySelector("img"));
    });
    el("nbModalCuerpo")?.addEventListener("keydown", (ev) => {
      const f = ev.target.closest && ev.target.closest(".nb-rv-foto");
      if (f && (ev.key === "Enter" || ev.key === " ")) { ev.preventDefault(); verFotoGrande(f.querySelector("img")); }
    });
    el("nbModal")?.addEventListener("click", (ev) => { if (ev.target === el("nbModal")) cerrarDetalle(); });
    el("nbRevCancelar")?.addEventListener("click", cerrarRevisar);
    el("nbRevGuardar")?.addEventListener("click", guardarRevision);
    el("nbRevModal")?.addEventListener("click", (ev) => { if (ev.target === el("nbRevModal")) cerrarRevisar(); });
    el("nbRevNota")?.addEventListener("input", (ev) => {
      el("nbRevCuenta").textContent = `${ev.target.value.length}/500`;
      el("nbRevError").textContent = "";
    });
    document.addEventListener("keydown", (ev) => {
      if (ev.key !== "Escape") return;
      if (cerrarFotoGrande()) return;                       // primero la foto grande; la ventana sigue abierta
      if (!el("nbRevModal")?.classList.contains("hidden")) cerrarRevisar();
      else if (!el("nbModal")?.classList.contains("hidden")) cerrarDetalle();
    });

    // El administrador cambia de base desde la cabecera: los datos viejos no sirven.
    ["btnEnterBase", "btnExitBase"].forEach((id) => {
      el(id)?.addEventListener("click", () => setTimeout(() => {
        olvidar();
        if (tabActiva()) cargar();
      }, 0));
    });
    el("btnLogout")?.addEventListener("click", () => { cerrarDetalle(); cerrarRevisar(); olvidar(); });

    // Cada parte se actualiza sola, solo con la pestana abierta y la pantalla a la vista.
    // Novedades y viajes solo si se esta viendo el dia de hoy; la fila siempre es en vivo.
    const tocaActualizar = () => {
      const v = st.vista;
      if (!QUE[v]) return false;
      if (!tabActiva() || document.visibilityState !== "visible" || st.cargando[v]) return false;
      if (QUE[v].conFecha && st.fecha !== hoy()) return false;
      if (!el("nbRevModal")?.classList.contains("hidden")) return false;   // no repintar mientras escribe
      return Date.now() - st.cargadoEn[v] >= CADA_MS[v] - 1000;
    };
    setInterval(() => { if (tocaActualizar()) cargar({ silencioso: true }); }, 10 * 1000);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && tabActiva() && !st.cargando[st.vista]
          && QUE[st.vista] && (!QUE[st.vista].conFecha || st.fecha === hoy())
          && el("nbRevModal")?.classList.contains("hidden")) {
        cargar({ silencioso: true });
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bind);
  } else {
    bind();
  }
})();
