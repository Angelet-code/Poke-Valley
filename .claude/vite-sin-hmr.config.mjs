// Servidor de pruebas sin recarga automática (launch.json "juego-c"): cuando otra sesión edita src/,
// la pestaña de pruebas no se recarga a media prueba. Recarga a mano para ver los cambios.
import base from '../vite.config.ts';
export default { ...base, server: { ...base.server, port: 5176, hmr: false } };
