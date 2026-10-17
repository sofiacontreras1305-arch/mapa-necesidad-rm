const datosComunas = {};
const establecimientosPorComuna = {};
let comunaSeleccionada = null;
let enModoZoom = false;

// ─── Utilidades ───────────────────────────────────────────────────────────────
function normalizar(texto) {
  if (!texto) return "";
  return texto.toString().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function limpiarNumero(val) {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') return val;
  const limpio = val.toString().replace('%', '').replace(',', '.').trim();
  const num = parseFloat(limpio);
  return isNaN(num) ? null : num;
}

function obtenerColor(indice) {
  if (indice === null || isNaN(indice)) return "#cccccc";
  if (indice >= 58) return "#2b0b3f"; // Muy alta
  if (indice >= 52) return "#671556"; // Alta
  if (indice >= 46) return "#9d255d"; // Media
  if (indice >= 35) return "#d15664"; // Baja
  return "#eb8f7f";                   // Muy baja
}

// ─── Coordenadas de referencia por comuna en el espacio del SVG (800×563) ────
// Norte = cy pequeño | Sur = cy grande | Oeste = cx pequeño | Este = cx grande
const REFERENCIAS_COMUNAS = [
  // Comunas rurales / periféricas
  { nombre: "Tiltil",              cx: 346.40, cy:  52.77 },
  { nombre: "Lampa",               cx: 456.85, cy:  81.43 },
  { nombre: "Colina",              cx: 541.84, cy: 155.93 },
  { nombre: "Quilicura",           cx: 345.24, cy: 146.58 },
  { nombre: "San Jose de Maipo",   cx: 671.15, cy: 321.22 },
  { nombre: "Melipilla",           cx: 112.12, cy: 418.61 },
  { nombre: "Padre Hurtado",       cx: 295.37, cy: 452.51 },

  // Zona poniente lejana
  { nombre: "Pudahuel",            cx: 209.61, cy: 234.61 },
  { nombre: "Maipu",               cx: 214.90, cy: 336.93 },
  { nombre: "Penaflor",            cx: 316.32, cy: 342.54 },
  { nombre: "El Monte",            cx: 286.41, cy: 305.02 },
  { nombre: "Talagante",           cx: 342.36, cy: 309.94 },
  { nombre: "Calera de Tango",     cx: 345.99, cy: 281.55 },
  { nombre: "Isla de Maipo",       cx: 346.82, cy: 263.50 },

  // Zona sur
  { nombre: "San Bernardo",        cx: 414.05, cy: 335.21 },
  { nombre: "Buin",                cx: 411.09, cy: 374.58 },
  { nombre: "Paine",               cx: 504.27, cy: 336.59 },

  // Zona nororiente (comunas de alto ingreso)
  { nombre: "Huechuraba",          cx: 264.90, cy: 178.56 },
  { nombre: "Lo Barnechea",        cx: 497.80, cy: 203.38 },
  { nombre: "Vitacura",            cx: 464.31, cy: 189.24 },
  { nombre: "Las Condes",          cx: 487.44, cy: 216.21 },
  { nombre: "La Reina",            cx: 474.53, cy: 276.09 },
  { nombre: "Penalolen",           cx: 445.16, cy: 185.11 },
  { nombre: "La Florida",          cx: 477.82, cy: 253.17 },

  // Comunas del centro norte
  { nombre: "Conchalí",            cx: 395.50, cy: 205.05 },
  { nombre: "Renca",               cx: 368.20, cy: 205.50 },
  { nombre: "Cerro Navia",         cx: 280.0,  cy: 240.0  },
  { nombre: "Quinta Normal",       cx: 339.0,  cy: 235.0  },
  { nombre: "Lo Prado",            cx: 310.0,  cy: 258.0  },
  { nombre: "Recoleta",            cx: 405.45, cy: 284.99 },
  { nombre: "Independencia",       cx: 413.08, cy: 240.74 },
  { nombre: "Providencia",         cx: 439.54, cy: 200.72 },
  { nombre: "Nunoa",               cx: 440.0,  cy: 218.0  },
  { nombre: "Macul",               cx: 459.94, cy: 221.52 },

  // Comunas del centro
  { nombre: "Santiago",            cx: 420.43, cy: 208.90 },
  { nombre: "Estacion Central",    cx: 397.64, cy: 178.07 },
  { nombre: "Cerrillos",           cx: 433.67, cy: 217.67 },
  { nombre: "San Miguel",          cx: 448.12, cy: 237.60 },
  { nombre: "San Joaquin",         cx: 438.52, cy: 238.15 },
  { nombre: "La Cisterna",         cx: 430.41, cy: 250.61 },
  { nombre: "La Granja",           cx: 442.16, cy: 251.90 },
  { nombre: "Lo Espejo",           cx: 423.11, cy: 245.72 },
  { nombre: "Pedro Aguirre Cerda", cx: 427.26, cy: 236.26 },
  { nombre: "El Bosque",           cx: 373.18, cy: 288.28 },
  { nombre: "San Ramon",           cx: 428.32, cy: 265.18 },

  // Sur oriente
  { nombre: "Pirque",              cx: 445.60, cy: 270.93 },
  { nombre: "Puente Alto",         cx: 484.39, cy: 234.16 },

  // Comunas rurales poniente
  { nombre: "Curacavi",            cx:  95.0,  cy: 310.0  },
  { nombre: "Maria Pinto",         cx: 130.0,  cy: 370.0  },
  { nombre: "Alhue",               cx:  80.0,  cy: 460.0  },
  { nombre: "San Pedro",           cx: 240.0,  cy: 410.0  },
];

// ─── Asignación automática path → comuna por distancia mínima ─────────────────
function distancia(x1, y1, x2, y2) {
  return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);
}

function calcularCentroide(pathEl) {
  const d = pathEl.getAttribute("d");
  const nums = (d.match(/[-+]?\d+\.?\d*/g) || []).map(Number);
  const xs = [], ys = [];
  for (let i = 0; i < nums.length - 1; i += 2) {
    xs.push(nums[i]);
    ys.push(nums[i + 1]);
  }
  if (xs.length === 0) return null;
  return {
    cx: xs.reduce((a, b) => a + b, 0) / xs.length,
    cy: ys.reduce((a, b) => a + b, 0) / ys.length
  };
}

// ─── Renderizado del mapa SVG real ────────────────────────────────────────────
function renderizarMapaSVG(svgExterno) {
  const contenedorSVG = document.getElementById("mapa-svg");
  const tooltip       = document.getElementById("tooltip");

  // Ajustar viewBox al del SVG externo (800×563)
  const vb = svgExterno.getAttribute("viewBox") || "0 0 800 563";
  contenedorSVG.setAttribute("viewBox", vb);
  contenedorSVG.setAttribute("preserveAspectRatio", "xMidYMid meet");
  contenedorSVG.innerHTML = "";

  const pathArr = Array.from(svgExterno.querySelectorAll("path"));

  // Preparar referencias normalizadas
  const refs = REFERENCIAS_COMUNAS.map(r => ({
    nombreOriginal: r.nombre,
    nombreNorm:     normalizar(r.nombre),
    cx: r.cx,
    cy: r.cy,
  }));

  // Calcular centroides de todos los paths
  const centroids = pathArr.map(p => calcularCentroide(p));

  // Asignación greedy: ordenar todos los pares (path, referencia) por distancia
  // y asignar de menor a mayor sin repetir ninguno de los dos lados.
  const pares = [];
  for (let pi = 0; pi < pathArr.length; pi++) {
    const c = centroids[pi];
    if (!c) continue;
    for (let ri = 0; ri < refs.length; ri++) {
      pares.push({ pi, ri, d: distancia(c.cx, c.cy, refs[ri].cx, refs[ri].cy) });
    }
  }
  pares.sort((a, b) => a.d - b.d);

  const pathAsignado = new Array(pathArr.length).fill(false);
  const refAsignada  = new Array(refs.length).fill(false);
  const asignaciones = {}; // pi → ri

  for (const { pi, ri } of pares) {
    if (!pathAsignado[pi] && !refAsignada[ri]) {
      asignaciones[pi] = ri;
      pathAsignado[pi] = true;
      refAsignada[ri]  = true;
    }
  }

  // Insertar paths con color e interactividad
  pathArr.forEach((pathEl, pi) => {
    const c = centroids[pi];
    if (!c) return;

    const ri           = asignaciones[pi];
    const nombreComuna = ri !== undefined ? refs[ri].nombreOriginal : null;
    const nombreNorm   = nombreComuna ? normalizar(nombreComuna) : null;

    // Buscar datos en el CSV (búsqueda directa + parcial)
    let info = null;
    if (nombreNorm) {
      info = datosComunas[nombreNorm];
      if (!info) {
        for (const k of Object.keys(datosComunas)) {
          if (k.includes(nombreNorm) || nombreNorm.includes(k)) {
            info = datosComunas[k];
            break;
          }
        }
      }
    }

    const indice    = info ? info.indice : null;
    const color     = obtenerColor(indice);

    const nuevoPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    nuevoPath.setAttribute("d",          pathEl.getAttribute("d"));
    nuevoPath.setAttribute("fill",       color);
    nuevoPath.setAttribute("class",      "comuna-poligono");
    // data-nombre para compatibilidad con la función de zoom
    if (nombreComuna) {
      nuevoPath.setAttribute("data-nombre", nombreComuna);
      nuevoPath.setAttribute("data-comuna", nombreComuna);
    }
    nuevoPath.setAttribute("data-idx", pi);

    // ── Eventos ──
    nuevoPath.addEventListener("mouseenter", () => {
      if (enModoZoom) return;
      const nombre = nuevoPath.getAttribute("data-nombre") || `Sector ${pi}`;
      tooltip.innerText      = nombre;
      tooltip.style.display  = "block";
    });

    nuevoPath.addEventListener("mousemove", (e) => {
      if (enModoZoom) return;
      const rect = document.getElementById("contenedor-mapa").getBoundingClientRect();
      tooltip.style.left = (e.clientX - rect.left + 15) + "px";
      tooltip.style.top  = (e.clientY - rect.top  - 15) + "px";
    });

    nuevoPath.addEventListener("mouseleave", () => {
      if (enModoZoom) return;
      tooltip.style.display = "none";
    });

    nuevoPath.addEventListener("click", () => {
      if (enModoZoom) return;
      const nombre = nuevoPath.getAttribute("data-nombre") || `Sector ${pi}`;
      mostrarDatosComuna(nombre);
    });

    contenedorSVG.appendChild(nuevoPath);
  });
}

// ─── Panel lateral: mostrar datos de la comuna ────────────────────────────────
function mostrarDatosComuna(nombre) {
  comunaSeleccionada = nombre;
  document.getElementById("comuna-nombre").innerText = `Comuna: ${nombre}`;

  const normNombre = normalizar(nombre);
  let info = datosComunas[normNombre];
  // Búsqueda parcial si no hay coincidencia exacta
  if (!info) {
    for (const k of Object.keys(datosComunas)) {
      if (k.includes(normNombre) || normNombre.includes(k)) {
        info = datosComunas[k];
        break;
      }
    }
  }

  const panel = document.getElementById("comuna-detalles");

  if (info) {
    document.getElementById("val-indice").innerText       = info.indice !== null ? info.indice : "-";
    document.getElementById("val-colegios").innerText     = info.colegios || "-";
    document.getElementById("val-criticos").innerText     = info.criticos || "-";
    document.getElementById("val-simce").innerText        = info.simce !== null ? info.simce : "-";
    document.getElementById("val-prioritarios").innerText = info.prioritarios
      ? Number(info.prioritarios).toLocaleString("es-CL") : "-";
  } else {
    document.getElementById("val-indice").innerText       = "Sin registro";
    document.getElementById("val-colegios").innerText     = "-";
    document.getElementById("val-criticos").innerText     = "-";
    document.getElementById("val-simce").innerText        = "-";
    document.getElementById("val-prioritarios").innerText = "-";
  }
  panel.style.display = "block";

  // Asegurarse de que el botón vuelva a su estado original al cambiar de comuna
  const btn = document.querySelector(".btn-accion");
  if (btn) btn.innerText = "Ver establecimientos";
}
// ─── Botón "Ver establecimientos" / "Volver al mapa" ─────────────────────────
const VIEW_BOX_INICIAL = "0 0 800 563"; // coincide con comunas.svg

document.querySelector(".btn-accion").addEventListener("click", function () {
  const svg = document.getElementById("mapa-svg");

  // Modo volver
  if (this.innerText === "Volver al mapa") {
    svg.setAttribute("viewBox", VIEW_BOX_INICIAL);
    document.querySelectorAll(".colegio-punto").forEach(p => p.remove());
    this.innerText = "Ver establecimientos";
    enModoZoom = false;
    return;
  }

  if (!comunaSeleccionada) return;
  // Buscar el path de la comuna seleccionada
  const poligonos = document.querySelectorAll(".comuna-poligono");
  let poligonoObjetivo = null;
  poligonos.forEach(p => {
    if (p.getAttribute("data-nombre") === comunaSeleccionada) {
      poligonoObjetivo = p;
    }
  });

  if (poligonoObjetivo) {
    const bbox   = poligonoObjetivo.getBBox();
    const margen = 15;
    svg.setAttribute("viewBox",
      `${bbox.x - margen} ${bbox.y - margen} ${bbox.width + margen * 2} ${bbox.height + margen * 2}`
    );
    dibujarColegios(comunaSeleccionada, bbox);
    this.innerText = "Volver al mapa";
    enModoZoom = true;
  }
});

// Clic en el fondo del mapa → volver a vista completa
document.getElementById("contenedor-mapa").addEventListener("click", (e) => {
  if (e.target.tagName === "svg" || e.target.id === "contenedor-mapa") {
    document.getElementById("mapa-svg").setAttribute("viewBox", VIEW_BOX_INICIAL);
    document.querySelectorAll(".colegio-punto").forEach(p => p.remove());
    const btn = document.querySelector(".btn-accion");
    if (btn) btn.innerText = "Ver establecimientos";
    enModoZoom = false;
  }
});

// ─── Dibujar puntos de colegios dentro del bbox de la comuna ─────────────────
function dibujarColegios(nombreComuna, bbox) {
  const svg      = document.getElementById("mapa-svg");
  const tooltip  = document.getElementById("tooltip");
  document.querySelectorAll(".colegio-punto").forEach(p => p.remove());

  const colegios = establecimientosPorComuna[normalizar(nombreComuna)] || [];

  if (colegios.length === 0) {
    console.warn(`Sin establecimientos para: ${nombreComuna}`);
    return;
  }

  const radioFijo = 2.5;

  colegios.forEach(colegio => {
    const cx = bbox.x + (bbox.width  * 0.15) + (Math.random() * bbox.width  * 0.7);
    const cy = bbox.y + (bbox.height * 0.15) + (Math.random() * bbox.height * 0.7);

    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx",    cx);
    circle.setAttribute("cy",    cy);
    circle.setAttribute("r",     radioFijo);
    circle.setAttribute("class", "colegio-punto");

    circle.addEventListener("mouseenter", (e) => {
      tooltip.innerHTML = `
        <span style="color:#d84b65; font-size:14px;">${colegio["Nombre Establecimiento"]}</span><br>
        <span title="Promedio nacional: 256,7" style="cursor:help; border-bottom:1px dotted #ccc;">SIMCE: ${colegio["Promedio SIMCE"] || "-"}</span><br>
        IVE: ${colegio["IVE"] || "-"}<br>
        Alumnos por docente: ${colegio["Alumnos por docente"] || "-"}
      `;
      tooltip.style.display = "block";
    });

    circle.addEventListener("mousemove", (e) => {
      const rect = document.getElementById("contenedor-mapa").getBoundingClientRect();
      tooltip.style.left = (e.clientX - rect.left + 15) + "px";
      tooltip.style.top  = (e.clientY - rect.top  - 15) + "px";
    });

    circle.addEventListener("mouseleave", () => {
      tooltip.style.display = "none";
      tooltip.innerHTML = "";
    });

    svg.appendChild(circle);
  });
}

// ─── Carga del SVG externo ────────────────────────────────────────────────────
function cargarSVG() {
  fetch("comunas.svg")
    .then(r => r.text())
    .then(svgText => {
      const parser     = new DOMParser();
      const svgDoc     = parser.parseFromString(svgText, "image/svg+xml");
      const svgExterno = svgDoc.querySelector("svg");
      if (!svgExterno) {
        console.error("No se encontró <svg> en comunas.svg");
        return;
      }
      renderizarMapaSVG(svgExterno);
    })
    .catch(err => console.error("Error al cargar comunas.svg:", err));
}

// ─── Carga de datos de comunas (datos_comunas.csv) ────────────────────────────
Papa.parse("datos_comunas.csv", {
  download: true,
  header: false,
  delimiter: ";",
  skipEmptyLines: true,
  complete: function (resultado) {
    const filas = resultado.data;
    if (!filas || filas.length === 0) { cargarSVG(); return; }

    let idxHead = 0;
    for (let i = 0; i < Math.min(filas.length, 5); i++) {
      if (filas[i].some(c => normalizar(c).includes("comuna"))) {
        idxHead = i;
        break;
      }
    }

    const cabeceras     = filas[idxHead].map(c => normalizar(c));
    const cComuna       = cabeceras.findIndex(h => h.includes("comuna"));
    const cIndice       = cabeceras.findIndex(h => h.includes("indice") || h.includes("necesidad"));
    const cColegios     = cabeceras.findIndex(h => h.includes("colegios"));
    const cPrioritarios = cabeceras.findIndex(h => h.includes("prioritarios"));
    const cCriticos     = cabeceras.findIndex(h => h.includes("criticos") || h.includes("sep"));
    const cSimce        = cabeceras.findIndex(h => h.includes("simce") && h.includes("4"));

    for (let i = idxHead + 1; i < filas.length; i++) {
      const f   = filas[i];
      const nom = f[cComuna];
      if (nom && typeof nom === "string" && normalizar(nom) !== "comuna") {
        datosComunas[normalizar(nom)] = {
          indice:       limpiarNumero(f[cIndice]),
          colegios:     f[cColegios]      ? f[cColegios].toString().trim()      : "-",
          prioritarios: limpiarNumero(f[cPrioritarios]),
          criticos:     f[cCriticos]      ? f[cCriticos].toString().trim()      : "-",
          simce:        limpiarNumero(f[cSimce])
        };
      }
    }

    cargarSVG();
  },
  error: function (err) {
    console.error("Error al leer datos_comunas.csv:", err);
    cargarSVG();
  }
});

// ─── Carga de datos de colegios (datos_colegios.csv) ─────────────────────────
Papa.parse("datos_colegios.csv", {
  download: true,
  header: true,
  skipEmptyLines: true,
  transformHeader: function (h) { return h.trim(); },
  complete: function (resultado) {
    resultado.data.forEach(fila => {
      if (fila.Comuna && fila.Comuna.trim() !== "") {
        const key = normalizar(fila.Comuna);
        if (!establecimientosPorComuna[key]) establecimientosPorComuna[key] = [];
        establecimientosPorComuna[key].push(fila);
      }
    });
  }
});
// ─── Control de Navegación por Clic (Diapositivas) ──────────────────────────
let slideActual = 0;
const totalSlides = 4; // 3 de texto + 1 del mapa final

function siguienteSlide() {
  if (slideActual < totalSlides - 1) {
    slideActual++;
    actualizarPosicionSlides();
  }
}

function primerSlide() {
  slideActual = 0;
  actualizarPosicionSlides();
}

function actualizarPosicionSlides() {
  const container = document.getElementById('slidesContainer');
  if (container) {
    container.style.transform = `translateY(-${slideActual * 100}vh)`;
  }
}

// Opcional: Permitir avanzar o retroceder con las teclas de flecha del teclado
window.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown' || e.key === 'PageDown') {
    if (slideActual < totalSlides - 1) {
      slideActual++;
      actualizarPosicionSlides();
    }
  } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
    if (slideActual > 0) {
      slideActual--;
      actualizarPosicionSlides();
    }
  }
});
