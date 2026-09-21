// Version del codigo que se esta ejecutando DE VERDAD. La pildora del topbar
// pinta lo que dice version.json, que es otra cosa: con los scripts viejos en
// cache puede anunciar "v2.9.1" mientras corre el functions.js anterior. Esta
// constante viaja dentro del propio codigo, asi que pwa.js la compara con
// version.json y, si no coinciden, fuerza una descarga limpia.
// OJO: se actualiza en cada publicacion (lo hace `python bump.py <version>`).
window.APP_CODE_VERSION = "2.9.1";

bindUIEvents();
bindWindowEvents();
initAuth();

