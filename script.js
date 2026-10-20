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
  { nombre: "San José de Maipo",   cx: 671.15, cy: 321.22 },
  { nombre: "Melipilla",           cx: 112.12, cy: 418.61 },
  { nombre: "Padre Hurtado",       cx: 295.37, cy: 452.51 },

  // Zona poniente lejana
  { nombre: "Pudahuel",            cx: 209.61, cy: 234.61 },
  { nombre: "Maipú",               cx: 214.90, cy: 336.93 },
  { nombre: "Peñaflor",            cx: 316.32, cy: 342.54 },
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
  { nombre: "Peñalolén",           cx: 445.16, cy: 185.11 },
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
  { nombre: "Ñuñoa",               cx: 440.0,  cy: 218.0  },
  { nombre: "Macul",               cx: 459.94, cy: 221.52 },

  // Comunas del centro
  { nombre: "Santiago",            cx: 420.43, cy: 208.90 },
  { nombre: "Estación Central",    cx: 397.64, cy: 178.07 },
  { nombre: "Cerrillos",           cx: 433.67, cy: 217.67 },
  { nombre: "San Miguel",          cx: 448.12, cy: 237.60 },
  { nombre: "San Joaquín",         cx: 438.52, cy: 238.15 },
  { nombre: "La Cisterna",         cx: 430.41, cy: 250.61 },
  { nombre: "La Granja",           cx: 442.16, cy: 251.90 },
  { nombre: "Lo Espejo",           cx: 423.11, cy: 245.72 },
  { nombre: "Pedro Aguirre Cerda", cx: 427.26, cy: 236.26 },
  { nombre: "El Bosque",           cx: 373.18, cy: 288.28 },
  { nombre: "San Ramón",           cx: 428.32, cy: 265.18 },

  // Sur oriente
  { nombre: "Pirque",              cx: 445.60, cy: 270.93 },
  { nombre: "Puente Alto",         cx: 484.39, cy: 234.16 },

  // Comunas rurales poniente
  { nombre: "Curacaví",            cx:  95.0,  cy: 310.0  },
  { nombre: "María Pinto",         cx: 130.0,  cy: 370.0  },
  { nombre: "Alhué",               cx:  80.0,  cy: 460.0  },
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

    // Ignorar polígonos residuales sin comuna real asociada
    if (!nombreComuna) return;

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
    nuevoPath.setAttribute("data-nombre", nombreComuna);
    nuevoPath.setAttribute("data-comuna", nombreComuna);
    nuevoPath.setAttribute("data-idx", pi);

    // ── Eventos ──
    nuevoPath.addEventListener("mouseenter", () => {
      if (enModoZoom) return;
      const nombre = nuevoPath.getAttribute("data-nombre");
      if (!nombre) return;
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
      const nombre = nuevoPath.getAttribute("data-nombre");
      if (!nombre) return;
      mostrarDatosComuna(nombre);
    });

    nuevoPath.addEventListener("dblclick", () => {
      if (enModoZoom) return;
      const nombre = nuevoPath.getAttribute("data-nombre");
      if (nombre) {
        mostrarDatosComuna(nombre);
        activarModoEstablecimientos(nombre);
      }
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
    const elIndice = document.getElementById("val-indice");
    if (elIndice) elIndice.innerText = info.indice !== null ? info.indice : "-";

    const colegiosMapeados = (establecimientosPorComuna[normNombre] || []).length;
    const elColegios = document.getElementById("val-colegios");
    if (elColegios) {
      if (info.colegios && info.colegios !== "-") {
        elColegios.innerHTML = `<strong>${colegiosMapeados}</strong> <span style="font-size:12.5px; color:#666; font-weight:normal;">(de ${info.colegios} registrados en la comuna)</span>`;
      } else {
        elColegios.innerText = colegiosMapeados > 0 ? colegiosMapeados : "-";
      }
    }

    const elCriticos = document.getElementById("val-criticos");
    if (elCriticos) elCriticos.innerText = info.criticos || "-";

    const elSimce = document.getElementById("val-simce");
    if (elSimce) elSimce.innerText = info.simce !== null ? info.simce : "-";

    const elPrioritarios = document.getElementById("val-prioritarios");
    if (elPrioritarios) elPrioritarios.innerText = info.prioritarios || "-";
  } else {
    const elIndice = document.getElementById("val-indice");
    if (elIndice) elIndice.innerText = "Sin registro";
    const elColegios = document.getElementById("val-colegios");
    if (elColegios) elColegios.innerText = "-";
    const elCriticos = document.getElementById("val-criticos");
    if (elCriticos) elCriticos.innerText = "-";
    const elSimce = document.getElementById("val-simce");
    if (elSimce) elSimce.innerText = "-";
    const elPrioritarios = document.getElementById("val-prioritarios");
    if (elPrioritarios) elPrioritarios.innerText = "-";
  }
  if (panel) panel.style.display = "block";

  // Si estamos en modo zoom al cambiar de comuna, resetear la vista
  if (enModoZoom) {
    resetearZoom();
  }
}

// ─── Variables de Navegación y Zoom ──────────────────────────────────────────
const VIEW_BOX_INICIAL = "0 0 800 563";
let animacionViewBoxId = null;
let colegiosComunaActual = [];

// ─── Animación suave del ViewBox SVG (Cubic-Bezier / 60fps) ───────────────────
function parseViewBox(vbString) {
  if (!vbString) return [0, 0, 800, 563];
  return vbString.trim().split(/\s+/).map(Number);
}

function animarViewBox(svgEl, targetVB, duracion = 650, callback) {
  if (animacionViewBoxId) {
    cancelAnimationFrame(animacionViewBoxId);
    animacionViewBoxId = null;
  }

  const currentAttr = svgEl.getAttribute("viewBox") || VIEW_BOX_INICIAL;
  const startVB = parseViewBox(currentAttr);
  const startTime = performance.now();

  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function frame(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duracion, 1);
    const t = easeInOutCubic(progress);

    const curX = startVB[0] + (targetVB[0] - startVB[0]) * t;
    const curY = startVB[1] + (targetVB[1] - startVB[1]) * t;
    const curW = startVB[2] + (targetVB[2] - startVB[2]) * t;
    const curH = startVB[3] + (targetVB[3] - startVB[3]) * t;

    svgEl.setAttribute("viewBox", `${curX} ${curY} ${curW} ${curH}`);

    if (progress < 1) {
      animacionViewBoxId = requestAnimationFrame(frame);
    } else {
      animacionViewBoxId = null;
      if (callback) callback();
    }
  }

  animacionViewBoxId = requestAnimationFrame(frame);
}

// ─── Resetear Zoom y volver a vista panorámica ────────────────────────────────
function resetearZoom() {
  const svg = document.getElementById("mapa-svg");
  const tooltip = document.getElementById("tooltip");
  if (tooltip) {
    tooltip.style.display = "none";
    tooltip.innerHTML = "";
  }

  animarViewBox(svg, parseViewBox(VIEW_BOX_INICIAL), 600, () => {
    document.querySelectorAll(".colegio-punto").forEach(p => p.remove());
  });

  svg.classList.remove("modo-zoom");

  document.querySelectorAll(".comuna-poligono").forEach(p => {
    p.classList.remove("comuna-activa");
  });

  // Transición suave entre paneles (regresar a vista general de comuna)
  const vistaComuna = document.getElementById("vista-comuna");
  const vistaEst = document.getElementById("vista-establecimientos");
  const vistaCorreo = document.getElementById("vista-correo");

  if (vistaEst) vistaEst.classList.remove("activa");
  if (vistaCorreo) vistaCorreo.classList.remove("activa");

  setTimeout(() => {
    if (vistaEst) vistaEst.style.display = "none";
    if (vistaCorreo) vistaCorreo.style.display = "none";
    if (vistaComuna) {
      vistaComuna.style.display = "flex";
      setTimeout(() => vistaComuna.classList.add("activa"), 20);
    }
  }, 180);

  enModoZoom = false;
}

// ─── Opción 1: Ampliación adaptativa real de la comuna ───────────────────────
function activarModoEstablecimientos(nombreComuna) {
  const svg = document.getElementById("mapa-svg");
  if (!nombreComuna) return;

  // Buscar el path de la comuna seleccionada
  const poligonos = document.querySelectorAll(".comuna-poligono");
  let poligonoObjetivo = null;
  poligonos.forEach(p => {
    if (p.getAttribute("data-nombre") === nombreComuna) {
      poligonoObjetivo = p;
    }
  });

  if (!poligonoObjetivo) return;

  const bbox = poligonoObjetivo.getBBox();
  const svgRect = svg.getBoundingClientRect();
  const containerAR = (svgRect.width && svgRect.height)
    ? (svgRect.width / svgRect.height)
    : (800 / 563);

  // Padding proporcional dinámico (14% de la mayor dimensión para elegancia y respiración visual)
  const mayorDimension = Math.max(bbox.width, bbox.height);
  const padX = Math.max(bbox.width * 0.14, mayorDimension * 0.10, 2.0);
  const padY = Math.max(bbox.height * 0.14, mayorDimension * 0.10, 2.0);

  let targetW = bbox.width + padX * 2;
  let targetH = bbox.height + padY * 2;

  // Compensar relación de aspecto del contenedor para centrar y expandir
  if (targetW / targetH < containerAR) {
    targetW = targetH * containerAR;
  } else {
    targetH = targetW / containerAR;
  }

  const cx = bbox.x + bbox.width * 0.5;
  const cy = bbox.y + bbox.height * 0.5;
  const targetX = cx - targetW * 0.5;
  const targetY = cy - targetH * 0.5;
  const targetVB = [targetX, targetY, targetW, targetH];

  // Activar estilos de zoom en el SVG
  svg.classList.add("modo-zoom");
  poligonos.forEach(p => p.classList.remove("comuna-activa"));
  poligonoObjetivo.classList.add("comuna-activa");

  // Iniciar animación cinematográfica del zoom
  animarViewBox(svg, targetVB, 650);

  // Radio adaptativo proporcional a píxeles reales en pantalla (~5.2px)
  const svgPixelWidth = svgRect.width || 600;
  const svgRadius = Math.max(0.08, 5.2 * (targetW / svgPixelWidth));

  // Renderizar establecimientos en el mapa
  dibujarColegios(nombreComuna, bbox, poligonoObjetivo, svgRadius);

  // Opción 2: Mostrar panel interactivo de establecimientos con buscador y lista
  mostrarPanelEstablecimientos(nombreComuna);

  enModoZoom = true;
}

// ─── Opción 2: Panel Lateral Interactivo y Sincronizado ───────────────────────
function mostrarPanelEstablecimientos(nombreComuna) {
  const vistaComuna = document.getElementById("vista-comuna");
  const vistaEst = document.getElementById("vista-establecimientos");
  const tituloEst = document.getElementById("est-comuna-nombre");
  const badgeTotal = document.getElementById("est-badge-total");
  const listaContenedor = document.getElementById("lista-colegios");
  const buscador = document.getElementById("buscador-colegios");
  const btnLimpiar = document.getElementById("btn-limpiar-busqueda");
  const contadorFiltrados = document.getElementById("contador-filtrados");
  const sinColegiosMsg = document.getElementById("sin-colegios-msg");

  const colegios = establecimientosPorComuna[normalizar(nombreComuna)] || [];
  colegiosComunaActual = colegios;

  tituloEst.innerText = nombreComuna;
  badgeTotal.innerText = `${colegios.length} ${colegios.length === 1 ? 'colegio' : 'colegios'}`;
  contadorFiltrados.innerText = `Mostrando ${colegios.length} establecimientos`;

  // Limpiar buscador
  if (buscador) buscador.value = "";
  if (btnLimpiar) btnLimpiar.style.display = "none";
  if (sinColegiosMsg) sinColegiosMsg.style.display = "none";

  // Generar lista de colegios
  listaContenedor.innerHTML = "";
  if (colegios.length === 0) {
    if (sinColegiosMsg) {
      sinColegiosMsg.style.display = "block";
      sinColegiosMsg.innerText = "No se encontraron establecimientos registrados para esta comuna.";
    }
  } else {
    colegios.forEach((colegio, idx) => {
      const card = document.createElement("div");
      card.className = "item-colegio";
      card.setAttribute("data-idx", idx);
      if (colegio.RBD) card.setAttribute("data-rbd", colegio.RBD);

      const simce = colegio["Promedio SIMCE"] || "-";
      const ive = colegio["IVE"] || "-";
      const alumDoc = colegio["Alumnos por docente"] || "-";
      const indColegio = limpiarNumero(colegio["Índice de Necesidad"] || colegio["Indice de Necesidad"]);
      const colorColegio = obtenerColor(indColegio);
      const catTexto = indColegio >= 58 ? "Muy alta" :
                       indColegio >= 52 ? "Alta" :
                       indColegio >= 46 ? "Media" :
                       indColegio >= 35 ? "Baja" : "Muy baja";

      card.style.borderLeftColor = colorColegio;

      card.innerHTML = `
        <div class="item-colegio-header">
          <span class="item-nombre" title="${colegio["Nombre Establecimiento"]}">${colegio["Nombre Establecimiento"]}</span>
          <span class="item-rbd">RBD: ${colegio.RBD || "-"}</span>
        </div>
        <div class="item-metricas">
          <span class="metrica-chip chip-indice" style="background:${colorColegio}; color:#ffffff;" title="Índice de Necesidad Escolar (escala 1 al 100)">Índice: <strong>${indColegio !== null && !isNaN(indColegio) ? indColegio : '-'}</strong> (${catTexto})</span>
          <span class="metrica-chip chip-simce" title="Promedio SIMCE 4° Básico">SIMCE: <strong>${simce}</strong></span>
          <span class="metrica-chip chip-ive" title="Índice de Vulnerabilidad Escolar">IVE: <strong>${ive}</strong></span>
          <span class="metrica-chip chip-docente" title="Alumnos por docente">Alum/Doc: <strong>${alumDoc}</strong></span>
        </div>
        <div class="item-colegio-footer">
          <span class="badge-contactar-item">✉️ Redactar correo →</span>
        </div>
      `;

      // Sincronización: hover en tarjeta -> resalta punto en mapa
      card.addEventListener("mouseenter", () => {
        destacarColegio(idx, true);
      });

      card.addEventListener("mouseleave", () => {
        destacarColegio(idx, false);
      });

      // Click en tarjeta -> pulso visual y transporte a la Vista 3 (Correo)
      card.addEventListener("click", () => {
        const circle = document.querySelector(`.colegio-punto[data-idx="${idx}"]`);
        if (circle) {
          circle.classList.remove("pulso-seleccion");
          void circle.offsetWidth;
          circle.classList.add("pulso-seleccion");
          mostrarTooltipPunto(circle, colegio);
        }
        mostrarPanelCorreo(colegio, idx);
      });

      listaContenedor.appendChild(card);
    });
  }

  // Transición suave entre paneles (asegurar que vista-correo también quede oculta)
  const vistaCorreo = document.getElementById("vista-correo");
  if (vistaCorreo) {
    vistaCorreo.classList.remove("activa");
    vistaCorreo.style.display = "none";
  }

  if (vistaComuna && vistaEst) {
    vistaComuna.classList.remove("activa");
    setTimeout(() => {
      vistaComuna.style.display = "none";
      vistaEst.style.display = "flex";
      setTimeout(() => vistaEst.classList.add("activa"), 20);
    }, 180);
  }
}

// ─── Vista 3: Panel de Redacción de Correo al Sostenedor ─────────────────────
function mostrarPanelCorreo(colegio, idx) {
  const vistaEst = document.getElementById("vista-establecimientos");
  const vistaCorreo = document.getElementById("vista-correo");

  const estNombreEl = document.getElementById("correo-est-nombre");
  const sostNombreEl = document.getElementById("correo-sostenedor-nombre");
  const sostEmailEl = document.getElementById("correo-sostenedor-email");
  const asuntoInput = document.getElementById("correo-asunto");
  const cuerpoTextarea = document.getElementById("correo-cuerpo");
  const notifCopiado = document.getElementById("notificacion-copiado");

  if (notifCopiado) notifCopiado.style.display = "none";

  const nombreEstablecimiento = colegio["Nombre Establecimiento"] || "el establecimiento educacional";
  const nombreSostenedor = colegio["NOMBRE_SOSTENEDOR"] || "Sostenedor";
  const correoSostenedor = (colegio["CORREO_SOSTENEDOR"] || "").trim();

  if (estNombreEl) estNombreEl.innerText = nombreEstablecimiento;
  if (sostNombreEl) sostNombreEl.innerText = nombreSostenedor;
  if (sostEmailEl) sostEmailEl.innerText = correoSostenedor || "Sin correo registrado";

  // Borrador predeterminado: saludo al sostenedor y nombre del establecimiento
  // (sin SIMCE, RBD ni IVE, y sin el RUT del sostenedor)
  const asuntoPredeterminado = `Contacto y coordinación - ${nombreEstablecimiento}`;
  const cuerpoPredeterminado = `Estimado/a representante de ${nombreSostenedor},

Me pongo en contacto con usted en relación al establecimiento ${nombreEstablecimiento}.

[Escriba aquí el detalle de su consulta o propuesta...]

Atentamente,
[Su Nombre / Institución]`;

  if (asuntoInput) asuntoInput.value = asuntoPredeterminado;
  if (cuerpoTextarea) cuerpoTextarea.value = cuerpoPredeterminado;

  // Transición suave entre paneles
  if (vistaEst && vistaCorreo) {
    vistaEst.classList.remove("activa");
    setTimeout(() => {
      vistaEst.style.display = "none";
      vistaCorreo.style.display = "flex";
      setTimeout(() => vistaCorreo.classList.add("activa"), 20);
    }, 180);
  }
}

// ─── Sincronización Bidireccional Mapa ↔ Lista ───────────────────────────────
function destacarColegio(idx, activar) {
  const circle = document.querySelector(`.colegio-punto[data-idx="${idx}"]`);
  const card = document.querySelector(`.item-colegio[data-idx="${idx}"]`);
  const tooltip = document.getElementById("tooltip");

  if (activar) {
    if (card) card.classList.add("item-activo");
    if (circle) {
      circle.classList.add("punto-destacado");
      const colegio = colegiosComunaActual[idx];
      if (colegio) mostrarTooltipPunto(circle, colegio);
    }
  } else {
    if (card) card.classList.remove("item-activo");
    if (circle) circle.classList.remove("punto-destacado");
    if (tooltip) {
      tooltip.style.display = "none";
      tooltip.innerHTML = "";
    }
  }
}

function mostrarTooltipPunto(circle, colegio) {
  const tooltip = document.getElementById("tooltip");
  if (!tooltip || !circle || !colegio) return;

  const indColegio = limpiarNumero(colegio["Índice de Necesidad"] || colegio["Indice de Necesidad"]);
  const colorColegio = obtenerColor(indColegio);
  const catTexto = indColegio >= 58 ? "Muy alta" :
                   indColegio >= 52 ? "Alta" :
                   indColegio >= 46 ? "Media" :
                   indColegio >= 35 ? "Baja" : "Muy baja";

  tooltip.innerHTML = `
    <div style="font-weight:800; font-size:13px; color:#2b0b3f; margin-bottom:4px; line-height:1.25;">${colegio["Nombre Establecimiento"]}</div>
    <div style="display:flex; align-items:center; gap:6px; margin-bottom:5px;">
      <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:${colorColegio}; box-shadow:0 0 3px ${colorColegio};"></span>
      <span style="font-size:11.5px; font-weight:700; color:${colorColegio};">Índice: ${indColegio !== null && !isNaN(indColegio) ? indColegio : '-'} / 100 (${catTexto})</span>
    </div>
    <div style="font-size:10.5px; color:#777; margin-bottom:4px;">RBD: ${colegio.RBD || "-"}</div>
    <div style="font-size:11px; color:#444; line-height:1.4;">
      <span title="Promedio nacional referencial: 256,7" style="cursor:help; border-bottom:1px dotted #888;">SIMCE: <strong>${colegio["Promedio SIMCE"] || "-"}</strong> pts</span><br>
      IVE: <strong>${colegio["IVE"] || "-"}</strong><br>
      Alumnos/docente: <strong>${colegio["Alumnos por docente"] || "-"}</strong>
    </div>
  `;

  const ptRect = circle.getBoundingClientRect();
  const mapRect = document.getElementById("contenedor-mapa").getBoundingClientRect();
  let left = ptRect.left - mapRect.left + ptRect.width * 0.5 + 12;
  let top = ptRect.top - mapRect.top - 15;

  if (left + 230 > mapRect.width) {
    left = (ptRect.left - mapRect.left) - 220;
  }
  if (top < 15) {
    top = ptRect.bottom - mapRect.top + 10;
  }

  tooltip.style.left = `${Math.max(10, left)}px`;
  tooltip.style.top  = `${top}px`;
  tooltip.style.display = "block";
}

// ─── Buscador interactivo en tiempo real ─────────────────────────────────────
function inicializarBuscadorColegios() {
  const input = document.getElementById("buscador-colegios");
  const btnLimpiar = document.getElementById("btn-limpiar-busqueda");
  const contador = document.getElementById("contador-filtrados");
  const sinResultados = document.getElementById("sin-colegios-msg");

  if (!input) return;

  input.addEventListener("input", function () {
    const q = normalizar(this.value);
    if (btnLimpiar) btnLimpiar.style.display = q ? "block" : "none";

    let visibles = 0;
    colegiosComunaActual.forEach((col, idx) => {
      const nombreNorm = normalizar(col["Nombre Establecimiento"]);
      const rbdStr = col.RBD ? col.RBD.toString() : "";
      const coincide = !q || nombreNorm.includes(q) || rbdStr.includes(q);

      const card = document.querySelector(`.item-colegio[data-idx="${idx}"]`);
      const circle = document.querySelector(`.colegio-punto[data-idx="${idx}"]`);

      if (card) card.style.display = coincide ? "block" : "none";
      if (circle) {
        circle.style.opacity = coincide ? "0.95" : "0.12";
        circle.style.pointerEvents = coincide ? "auto" : "none";
      }
      if (coincide) visibles++;
    });

    const total = colegiosComunaActual.length;
    if (contador) {
      contador.innerText = q
        ? `Mostrando ${visibles} de ${total} establecimientos`
        : `Mostrando ${total} establecimientos`;
    }

    if (sinResultados) {
      sinResultados.style.display = (visibles === 0 && total > 0) ? "block" : "none";
    }
  });

  if (btnLimpiar) {
    btnLimpiar.addEventListener("click", () => {
      input.value = "";
      input.dispatchEvent(new Event("input"));
      input.focus();
    });
  }
}

inicializarBuscadorColegios();

// ─── Inicializar controles de la Vista de Correo al Sostenedor ────────────────
function inicializarVistaCorreo() {
  const btnVolverLista = document.getElementById("btn-volver-lista");
  const btnAbrirCorreo = document.getElementById("btn-abrir-cliente-correo");
  const btnCopiarTodo = document.getElementById("btn-copiar-todo-mensaje");
  const btnCopiarEmail = document.getElementById("btn-copiar-email-solo");
  const notifCopiado = document.getElementById("notificacion-copiado");

  if (btnVolverLista) {
    btnVolverLista.addEventListener("click", () => {
      const vistaEst = document.getElementById("vista-establecimientos");
      const vistaCorreo = document.getElementById("vista-correo");
      if (vistaEst && vistaCorreo) {
        vistaCorreo.classList.remove("activa");
        setTimeout(() => {
          vistaCorreo.style.display = "none";
          vistaEst.style.display = "flex";
          setTimeout(() => vistaEst.classList.add("activa"), 20);
        }, 180);
      }
    });
  }

  if (btnAbrirCorreo) {
    btnAbrirCorreo.addEventListener("click", () => {
      const emailEl = document.getElementById("correo-sostenedor-email");
      const email = emailEl ? emailEl.innerText.trim() : "";
      const asunto = (document.getElementById("correo-asunto")?.value || "").trim();
      const cuerpo = document.getElementById("correo-cuerpo")?.value || "";

      if (!email || email === "Sin correo registrado" || email === "-") {
        alert("Este sostenedor no posee una casilla de correo registrada.");
        return;
      }

      const mailtoUrl = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`;
      window.location.href = mailtoUrl;
    });
  }

  if (btnCopiarTodo) {
    btnCopiarTodo.addEventListener("click", () => {
      const emailEl = document.getElementById("correo-sostenedor-email");
      const email = emailEl ? emailEl.innerText.trim() : "";
      const asunto = (document.getElementById("correo-asunto")?.value || "").trim();
      const cuerpo = document.getElementById("correo-cuerpo")?.value || "";

      const textoCompleto = `Destinatario: ${email}\nAsunto: ${asunto}\n\n${cuerpo}`;

      navigator.clipboard.writeText(textoCompleto).then(() => {
        if (notifCopiado) {
          notifCopiado.style.display = "block";
          setTimeout(() => {
            notifCopiado.style.display = "none";
          }, 2500);
        }
      }).catch(err => {
        console.error("Error al copiar texto:", err);
      });
    });
  }

  if (btnCopiarEmail) {
    btnCopiarEmail.addEventListener("click", () => {
      const emailEl = document.getElementById("correo-sostenedor-email");
      const email = emailEl ? emailEl.innerText.trim() : "";

      if (email && email !== "Sin correo registrado" && email !== "-") {
        navigator.clipboard.writeText(email).then(() => {
          const original = btnCopiarEmail.innerText;
          btnCopiarEmail.innerText = "✓ Copiado";
          setTimeout(() => {
            btnCopiarEmail.innerText = original;
          }, 1800);
        });
      }
    });
  }
}

inicializarVistaCorreo();

// ─── Conectar Eventos de Botones y Mapa ──────────────────────────────────────
const btnVerEstablecimientos = document.getElementById("btn-ver-establecimientos");
if (btnVerEstablecimientos) {
  btnVerEstablecimientos.addEventListener("click", function () {
    if (comunaSeleccionada) {
      activarModoEstablecimientos(comunaSeleccionada);
    }
  });
}

const btnVolverMapa = document.getElementById("btn-volver-mapa");
if (btnVolverMapa) {
  btnVolverMapa.addEventListener("click", function () {
    resetearZoom();
  });
}

// Clic en el fondo del mapa → volver a vista completa
document.getElementById("contenedor-mapa").addEventListener("click", (e) => {
  if (e.target.tagName === "svg" || e.target.id === "contenedor-mapa") {
    if (enModoZoom) {
      resetearZoom();
    }
  }
});

// ─── Dibujar colegios georreferenciados con micro-dispersión suave ────────────
function dibujarColegios(nombreComuna, bbox, pathComuna, svgRadius = 1.0) {
  const svg = document.getElementById("mapa-svg");
  const tooltip = document.getElementById("tooltip");
  document.querySelectorAll(".colegio-punto").forEach(p => p.remove());

  const colegios = establecimientosPorComuna[normalizar(nombreComuna)] || [];

  if (colegios.length === 0) {
    console.warn(`Sin establecimientos para: ${nombreComuna}`);
    return;
  }

  // Prueba de pertenencia geométrica en SVG
  let testPoint = null;
  if (svg.createSVGPoint) {
    testPoint = svg.createSVGPoint();
  } else if (window.DOMPoint) {
    testPoint = new DOMPoint();
  }

  function estaDentroDeComuna(x, y) {
    if (!pathComuna || !pathComuna.isPointInFill) return true;
    if (testPoint) {
      testPoint.x = x;
      testPoint.y = y;
      return pathComuna.isPointInFill(testPoint);
    }
    return true;
  }

  const centroideX = bbox.x + bbox.width * 0.5;
  const centroideY = bbox.y + bbox.height * 0.5;

  // 1. Obtener rango geográfico (Lat/Lng)
  const coordsValidas = colegios
    .map(c => ({ lat: parseFloat(c.Latitud), lng: parseFloat(c.Longitud) }))
    .filter(c => !isNaN(c.lat) && !isNaN(c.lng));

  let minLat = -Infinity, maxLat = Infinity, minLng = -Infinity, maxLng = Infinity;
  const tieneGeoReal = coordsValidas.length > 0;

  if (tieneGeoReal) {
    const lats = coordsValidas.map(c => c.lat);
    const lngs = coordsValidas.map(c => c.lng);
    minLat = Math.min(...lats);
    maxLat = Math.max(...lats);
    minLng = Math.min(...lngs);
    maxLng = Math.max(...lngs);

    if (maxLat === minLat) { minLat -= 0.005; maxLat += 0.005; }
    if (maxLng === minLng) { minLng -= 0.005; maxLng += 0.005; }
  }

  // Margen interno dentro del bbox (8%)
  const padX = bbox.width * 0.08;
  const padY = bbox.height * 0.08;
  const innerX = bbox.x + padX;
  const innerY = bbox.y + padY;
  const innerW = Math.max(bbox.width - padX * 2, 0.1);
  const innerH = Math.max(bbox.height - padY * 2, 0.1);

  const puntosColocados = [];
  const minDist = svgRadius * 2.1;

  colegios.forEach((colegio, idx) => {
    let px, py;
    const lat = parseFloat(colegio.Latitud);
    const lng = parseFloat(colegio.Longitud);

    if (tieneGeoReal && !isNaN(lat) && !isNaN(lng)) {
      const u = (lng - minLng) / (maxLng - minLng);
      const v = (maxLat - lat) / (maxLat - minLat);
      px = innerX + (u * innerW);
      py = innerY + (v * innerH);
    } else {
      px = centroideX;
      py = centroideY;
    }

    // 2. Si cae fuera de la silueta por concavidad, atraer hacia el centroide
    if (!estaDentroDeComuna(px, py)) {
      for (let step = 1; step <= 25; step++) {
        const factor = step * 0.04;
        const testX = px * (1 - factor) + centroideX * factor;
        const testY = py * (1 - factor) + centroideY * factor;
        if (estaDentroDeComuna(testX, testY)) {
          px = testX;
          py = testY;
          break;
        }
      }
    }

    // 3. Resolución de solapamiento proporcional al tamaño del círculo
    let intentosJitter = 0;
    while (intentosJitter < 10) {
      let solapado = false;
      for (let i = 0; i < puntosColocados.length; i++) {
        const d = distancia(px, py, puntosColocados[i].x, puntosColocados[i].y);
        if (d < minDist) {
          solapado = true;
          break;
        }
      }
      if (!solapado) break;

      const angulo = (intentosJitter * 2.399) + (idx * 0.5);
      const radioJitter = (intentosJitter + 1) * (svgRadius * 1.05);
      const nuevoX = px + Math.cos(angulo) * radioJitter;
      const nuevoY = py + Math.sin(angulo) * radioJitter;

      if (estaDentroDeComuna(nuevoX, nuevoY)) {
        px = nuevoX;
        py = nuevoY;
      }
      intentosJitter++;
    }

    puntosColocados.push({ x: px, y: py });

    // Crear el elemento SVG del punto
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", px);
    circle.setAttribute("cy", py);
    circle.setAttribute("r",  svgRadius);
    circle.setAttribute("class", "colegio-punto");
    circle.setAttribute("data-idx", idx);
    if (colegio.RBD) circle.setAttribute("data-rbd", colegio.RBD);
    circle.style.animationDelay = `${Math.min(idx * 0.01, 0.35)}s`;

    const indColegio = limpiarNumero(colegio["Índice de Necesidad"] || colegio["Indice de Necesidad"]);
    const colorColegio = obtenerColor(indColegio);
    circle.setAttribute("fill", colorColegio);
    circle.style.fill = colorColegio;
    if (indColegio !== null && !isNaN(indColegio)) {
      circle.setAttribute("data-indice", indColegio);
    }

    // Sincronización: hover en mapa -> destaca en lista con scroll suave
    circle.addEventListener("mouseenter", () => {
      destacarColegio(idx, true);
      const card = document.querySelector(`.item-colegio[data-idx="${idx}"]`);
      if (card) {
        card.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    });

    circle.addEventListener("mouseleave", () => {
      destacarColegio(idx, false);
    });

    circle.addEventListener("click", (e) => {
      e.stopPropagation();
      circle.classList.remove("pulso-seleccion");
      void circle.offsetWidth;
      circle.classList.add("pulso-seleccion");
      const card = document.querySelector(`.item-colegio[data-idx="${idx}"]`);
      if (card) {
        card.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
      mostrarPanelCorreo(colegio, idx);
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
          prioritarios: f[cPrioritarios]  ? f[cPrioritarios].toString().trim()  : "-",
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

// ─── Carga de datos de colegios con sostenedores ──────────────────────────────
Papa.parse("colegios_con_sostenedores.csv", {
  download: true,
  header: true,
  skipEmptyLines: true,
  transformHeader: function (h) { return h.replace(/^\ufeff/, "").trim(); },
  complete: function (resultado) {
    // Ordenar establecimientos por Índice de Necesidad (descendente: mayor urgencia primero)
    resultado.data.sort((a, b) => {
      const indA = parseFloat((a["Índice de Necesidad"] || a["Indice de Necesidad"] || "0").toString().replace(',', '.'));
      const indB = parseFloat((b["Índice de Necesidad"] || b["Indice de Necesidad"] || "0").toString().replace(',', '.'));
      return (isNaN(indB) ? 0 : indB) - (isNaN(indA) ? 0 : indA);
    });

    resultado.data.forEach(fila => {
      if (fila.Comuna && fila.Comuna.trim() !== "") {
        const key = normalizar(fila.Comuna);
        if (!establecimientosPorComuna[key]) establecimientosPorComuna[key] = [];
        establecimientosPorComuna[key].push(fila);
      }
    });
  }
});

// ─── Control de Navegación por Clic / Teclado (Diapositivas - Storytelling) ───
let slideActual = 0;
const totalSlides = 6; // 5 diapositivas de storytelling + 1 diapositiva con el mapa

function siguienteSlide() {
  if (slideActual < totalSlides - 1) {
    slideActual++;
  }
}

function anteriorSlide() {
  if (slideActual > 0) {
    slideActual--;
  }
}

function irASlide(index) {
  if (index >= 0 && index < totalSlides) {
    slideActual = index;
  }
}

function primerSlide() {
  slideActual = 0;
}

  // Actualizar indicadores visuales laterales (dots)
  const dots = document.querySelectorAll(".nav-dot");
  dots.forEach((dot, idx) => {
    if (idx === slideActual) {
      dot.classList.add("activo");
    } else {
      dot.classList.remove("activo");
    };
  });

  // Actualizar enlaces de la barra de navegación superior
  const navLinks = document.querySelectorAll(".nav-btn-link");
  navLinks.forEach((link, idx) => {
    if (idx === slideActual) {
      link.classList.add("activo");
    } else {
      link.classList.remove("activo");
    }
  });

// Navegación con teclado
window.addEventListener("keydown", (e) => {
  // No capturar flechas si el usuario está redactando en el formulario de correo
  if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) {
    return;
  }
  if (e.key === "ArrowDown" || e.key === "PageDown") {
    if (slideActual < totalSlides - 1) {
      slideActual++;
    };
  } else if (e.key === "ArrowUp" || e.key === "PageUp") {
    if (slideActual > 0) {
      slideActual--;
};
  }});

const slidesContainer = document.getElementById("slidesContainer");
const slides = document.querySelectorAll(".slide");
const pelotitas = document.querySelectorAll(".nav-dot");
const botonesMenu = document.querySelectorAll(".navbar-links button, .nav-btn-link");

const observador = new IntersectionObserver(
  (entradas) => {
    entradas.forEach((entrada) => {
      if (entrada.isIntersecting) {
        const indice = Array.from(slides).indexOf(entrada.target);

        pelotitas.forEach((pelotita, i) => {
          if (i === indice) {
            pelotita.classList.add("activo");
          } else {
            pelotita.classList.remove("activo");
          }
        });

        botonesMenu.forEach((boton, i) => {
          if (i === indice) {
            boton.classList.add("activo");
          } else {
            boton.classList.remove("activo");
          }
        });
      }
    });
  },
  {
    root: slidesContainer,
    threshold: 0.5,
  }
);

slides.forEach((slide) => observador.observe(slide));

pelotitas.forEach((pelotita, index) => {
  pelotita.addEventListener("click", (e) => {
    e.preventDefault();
    if (slides[index]) {
      slides[index].scrollIntoView({ behavior: "smooth" });
    }
  });
});


botonesMenu.forEach((boton, index) => {
  boton.addEventListener("click", (e) => {
    e.preventDefault();
    if (slides[index]) {
      slides[index].scrollIntoView({ behavior: "smooth" });
    }
  });
});


const botonExplorar = document.querySelector(".btn-flecha-explorar");
const contenedorMapa = document.getElementById("contenedor-mapa");

if (botonExplorar && contenedorMapa) {
  botonExplorar.addEventListener("click", (e) => {
    e.preventDefault();
    contenedorMapa.scrollIntoView({ behavior: "smooth" });
  });
}

// 4. Buscador de comunas en el mapa
const buscadorComunas = document.getElementById("buscador-comunas");
const opcionesComunas = document.getElementById("opciones-comunas");

if (buscadorComunas && opcionesComunas) {
  const normalizarTexto = (texto) => {
    return (texto || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  };

  // Esperar a que los polígonos tengan su atributo data-nombre cargado
  const esperarMapa = setInterval(() => {
    const poligonos = document.querySelectorAll(".comuna-poligono[data-nombre]");

    if (poligonos.length > 0) {
      clearInterval(esperarMapa);
      const comunasSet = new Set();

      poligonos.forEach((p) => {
        const nombre = p.getAttribute("data-nombre");
        if (nombre) {
          comunasSet.add(nombre.trim());
        }
      });

      opcionesComunas.innerHTML = "";
      Array.from(comunasSet)
        .sort()
        .forEach((comuna) => {
          const option = document.createElement("option");
          option.value = comuna;
          opcionesComunas.appendChild(option);
        });
    }
  }, 200);

  const seleccionarComunaEnMapa = (valorInput) => {
    const valorBuscado = normalizarTexto(valorInput);
    const mapaSvg = document.getElementById("mapa-svg");
    const poligonos = document.querySelectorAll(".comuna-poligono");

    // Si se borra el texto del buscador, restaurar colores del mapa
    if (!valorBuscado) {
      if (mapaSvg) {
        mapaSvg.classList.remove("mapa-filtrado");
      }
      poligonos.forEach((p) => p.classList.remove("comuna-destacada"));
      return;
    }

    const poligonoEncontrado = Array.from(poligonos).find((p) => {
      const nombreComuna = p.getAttribute("data-nombre") || "";
      return normalizarTexto(nombreComuna) === valorBuscado;
    });

    if (poligonoEncontrado && mapaSvg) {
      // 1. Disparar el clic nativo de tu código para mostrar los datos en el panel
      poligonoEncontrado.dispatchEvent(
        new MouseEvent("click", { bubbles: true })
      );

      // 2. Atenuar el resto del mapa y resaltar la comuna encontrada
      setTimeout(() => {
        poligonos.forEach((p) => p.classList.remove("comuna-destacada"));
        mapaSvg.classList.add("mapa-filtrado");
        poligonoEncontrado.classList.add("comuna-destacada");
      }, 10);
    }
  };

  buscadorComunas.addEventListener("input", (e) => {
    seleccionarComunaEnMapa(e.target.value);
  });

  buscadorComunas.addEventListener("change", (e) => {
    seleccionarComunaEnMapa(e.target.value);
  });
}

// 5. Quitar el filtro gris cuando el usuario hace clic manualmente en el mapa
const mapaElemento = document.getElementById("mapa-svg");
if (mapaElemento) {
  mapaElemento.addEventListener("click", (e) => {
    if (e.isTrusted) {
      mapaElemento.classList.remove("mapa-filtrado");
      document.querySelectorAll(".comuna-destacada").forEach((p) => {
        p.classList.remove("comuna-destacada");
      });
    }
  });
}