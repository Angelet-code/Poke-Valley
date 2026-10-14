// Modo muestra (?muestra): muchos Pokémon distintos paseando por el pueblo, solo para ver cómo quedan
// (con la luz del día y sus normales). Son adorno: no entran en la simulación ni en la partida guardada.
// Boot lee su AnimData.xml como aldeanos con clave `m<dex>` (Preload carga sus hojas y crea Walk/Idle);
// WorldScene.crearMuestra los reparte y los hace pasear.

export const MUESTRA = new URLSearchParams(location.search).has('muestra');

export const DEX_MUESTRA = [
  '0010', '0016', '0025', '0026', '0035', '0041', '0043', '0050', '0054', '0058', '0063', '0066', '0068', '0074', '0081', '0092',
  '0094', '0163', '0175', '0177', '0183', '0191', '0198', '0200', '0218', '0220', '0241', '0261', '0280', '0296', '0302', '0304',
  '0361', '0374', '0399', '0415', '0443', '0529', '0532', '0568', '0582', '0607', '0610', '0669', '0749', '0761', '0821', '0831',
  // Grandes: Snorlax, Dragonite, Tyranitar, Lapras, Rhydon, Wailord, Avalugg, Onix, Steelix, Aggron, Metagross, Mamoswine.
  '0143', '0149', '0248', '0131', '0112', '0321', '0713', '0095', '0208', '0306', '0376', '0473',
];

export const claveMuestra = (dex: string) => 'm' + dex;
