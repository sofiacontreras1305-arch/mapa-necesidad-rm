const datosComunas = {};
const establecimientosPorComuna = {};
let comunaSeleccionada = null;
let enModoZoom = false;

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
  if (indice === null || isNaN(indice)) return "#eb8f7f";
  if (indice >= 58) return "#2b0b3f"; // Muy alta
  if (indice >= 52) return "#671556"; // Alta
  if (indice >= 46) return "#9d255d"; // Media
  if (indice >= 35) return "#d15664"; // Baja
  return "#eb8f7f";                   // Muy baja
}

const mapaComunasSantiago = [
  { nombre: "Lo Barnechea", puntos: "280,130 330,140 370,170 360,200 310,190 270,180 250,160" },
  { nombre: "Vitacura", puntos: "245,170 290,180 300,210 250,220 220,195" },
  { nombre: "Las Condes", puntos: "260,215 320,210 370,240 360,290 280,310 240,250" },
  { nombre: "Huechuraba", puntos: "185,160 230,170 240,215 195,225 170,190" },
  { nombre: "Conchalí", puntos: "170,225 210,220 215,255 175,260" },
  { nombre: "Recoleta", puntos: "210,220 245,215 240,270 205,270" },
  { nombre: "Independencia", puntos: "185,260 215,260 210,295 180,295" },
  { nombre: "Quilicura", puntos: "110,180 180,180 175,230 115,225" },
  { nombre: "Renca", puntos: "125,230 180,230 180,275 120,275" },
  { nombre: "Cerro Navia", puntos: "95,275 145,275 140,315 90,315" },
  { nombre: "Quinta Normal", puntos: "145,275 180,275 180,315 140,315" },
  { nombre: "Lo Prado", puntos: "105,315 150,315 145,350 100,350" },
  { nombre: "Pudahuel", puntos: "60,250 110,250 100,350 135,350 120,400 50,340" },
  { nombre: "Santiago", puntos: "180,285 235,280 230,345 175,345" },
  { nombre: "Providencia", puntos: "235,260 275,265 270,315 228,310" },
  { nombre: "Ñuñoa", puntos: "235,315 285,315 280,370 230,365" },
  { nombre: "La Reina", puntos: "285,275 340,280 350,335 285,335" },
  { nombre: "Peñalolén", puntos: "285,340 375,340 405,385 330,420 280,395" },
  { nombre: "Macul", puntos: "235,370 280,370 275,420 230,415" },
  { nombre: "San Joaquín", puntos: "195,365 230,365 225,425 190,420" },
  { nombre: "San Miguel", puntos: "165,365 195,365 190,425 160,420" },
  { nombre: "Pedro Aguirre Cerda", puntos: "135,365 165,365 160,425 130,420" },
  { nombre: "Estación Central", puntos: "140,325 180,325 175,370 135,365" },
  { nombre: "Cerrillos", puntos: "115,370 155,370 145,435 105,425" },
  { nombre: "Maipú", puntos: "65,360 125,370 140,440 100,510 50,470" },
  { nombre: "Lo Espejo", puntos: "130,425 165,425 160,465 125,465" },
  { nombre: "La Cisterna", puntos: "165,425 195,425 190,465 160,465" },
  { nombre: "San Ramón", puntos: "195,425 220,425 215,475 190,475" },
  { nombre: "La Granja", puntos: "220,425 245,425 240,490 215,485" },
  { nombre: "La Florida", puntos: "245,395 315,400 300,505 240,490" },
  { nombre: "El Bosque", puntos: "145,465 190,465 180,540 135,530" },
  { nombre: "San Bernardo", puntos: "130,535 185,540 195,640 140,630" },
  { nombre: "Puente Alto", puntos: "225,495 285,490 270,610 210,600" },
  { nombre: "Pirque", puntos: "265,580 330,570 315,645 250,635" },
  { nombre: "Padre Hurtado", puntos: "45,480 85,485 70,545 30,530" }
];

function renderizarMapaSVG() {
  const svg = document.getElementById("mapa-svg");
  const tooltip = document.getElementById("tooltip");
  svg.innerHTML = "";

  mapaComunasSantiago.forEach(c => {
    const info = datosComunas[normalizar(c.nombre)];
    const indice = info ? info.indice : null;
    const color = obtenerColor(indice);

    const polygon = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
    polygon.setAttribute("points", c.puntos);
    polygon.setAttribute("fill", color);
    polygon.setAttribute("class", "comuna-poligono");
    polygon.setAttribute("data-nombre", c.nombre);

    polygon.addEventListener("mouseenter", (e) => {
      if (enModoZoom) return;
      tooltip.innerText = c.nombre;
      tooltip.style.display = "block";
    });

    polygon.addEventListener("mousemove", (e) => {
      if (enModoZoom) return;
      const rect = document.getElementById("contenedor-mapa").getBoundingClientRect();
      tooltip.style.left = (e.clientX - rect.left + 15) + "px";
      tooltip.style.top = (e.clientY - rect.top - 15) + "px";
    });

    polygon.addEventListener("mouseleave", () => {
      if (enModoZoom) return;
      tooltip.style.display = "none";
    });

    polygon.addEventListener("click", () => {
      if (enModoZoom) return;
      mostrarDatosComuna(c.nombre);
    });

    svg.appendChild(polygon);
  });
}

function mostrarDatosComuna(nombre) {
  comunaSeleccionada = nombre;
  document.getElementById("comuna-nombre").innerText = `Comuna: ${nombre}`;
  const info = datosComunas[normalizar(nombre)];
  const panel = document.getElementById("comuna-detalles");

  if (info) {
    document.getElementById("val-indice").innerText = info.indice !== null ? info.indice : "-";
    document.getElementById("val-colegios").innerText = info.colegios || "-";
    document.getElementById("val-criticos").innerText = info.criticos || "-";
    document.getElementById("val-simce").innerText = info.simce !== null ? info.simce : "-";
    document.getElementById("val-prioritarios").innerText = info.prioritarios ? Number(info.prioritarios).toLocaleString("es-CL") : "-";
  } else {
    document.getElementById("val-indice").innerText = "Sin registro";
    document.getElementById("val-colegios").innerText = "-";
    document.getElementById("val-criticos").innerText = "-";
    document.getElementById("val-simce").innerText = "-";
    document.getElementById("val-prioritarios").innerText = "-";
  }
  panel.style.display = "block";

  const btnOriginal = document.querySelector('.btn-accion');
  if (btnOriginal) btnOriginal.innerText = "Ver establecimientos";
}

// botón zoom
document.querySelector('.btn-accion').addEventListener('click', function() {
  const svg = document.getElementById("mapa-svg");

  if (this.innerText === "Volver al mapa") {
    svg.setAttribute("viewBox", "0 0 850 750"); 
    document.querySelectorAll('.colegio-punto').forEach(p => p.remove());
    this.innerText = "Ver establecimientos";

    enModoZoom = false;
    return;
  }

  if (!comunaSeleccionada) return;

  const poligonos = document.querySelectorAll('.comuna-poligono');
  let poligonoObjetivo = null;

  poligonos.forEach(p => {
    if (p.getAttribute('data-nombre') === comunaSeleccionada) {
      poligonoObjetivo = p;
    }
  });

  if (poligonoObjetivo) {
    const bbox = poligonoObjetivo.getBBox();
    const margen = 15; 
    
    const nuevoViewBox = `${bbox.x - margen} ${bbox.y - margen} ${bbox.width + margen * 2} ${bbox.height + margen * 2}`;
    svg.setAttribute("viewBox", nuevoViewBox);

    dibujarColegios(comunaSeleccionada, bbox);

    this.innerText = "Volver al mapa";

    enModoZoom = true;
  }
});

function dibujarColegios(nombreComuna, bbox) {
  const svg = document.getElementById("mapa-svg");
  document.querySelectorAll('.colegio-punto').forEach(p => p.remove());

  const comunaNorm = normalizar(nombreComuna);
  const colegios = establecimientosPorComuna[comunaNorm] || [];

  if (colegios.length === 0) {
    console.warn(`No se encontraron establecimientos en base_web.csv para: ${nombreComuna}`);
    return;
  }

  const radioFijo = 2.5; 
  const tooltip = document.getElementById("tooltip");
  
  colegios.forEach(colegio => {
    const cx = bbox.x + (bbox.width * 0.15) + (Math.random() * bbox.width * 0.7);
    const cy = bbox.y + (bbox.height * 0.15) + (Math.random() * bbox.height * 0.7);

    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", cx);
    circle.setAttribute("cy", cy);
    circle.setAttribute("r", radioFijo);
    circle.setAttribute("class", "colegio-punto");

    circle.addEventListener("mouseenter", (e) => {
      tooltip.innerHTML = `
        <span style="color:#d84b65; font-size:14px;">${colegio['Nombre Establecimiento']}</span><br>
        <span title="Promedio nacional: 256,7" style="cursor: help; border-bottom: 1px dotted #ccc;">SIMCE: ${colegio['Promedio SIMCE'] || '-'}</span><br>
        IVE: ${colegio['IVE'] || '-'}<br>
        Alumnos por docente: ${colegio['Alumnos por docente'] || '-'}
      `;
      tooltip.style.display = "block";
    });

    circle.addEventListener("mousemove", (e) => {
      const rect = document.getElementById("contenedor-mapa").getBoundingClientRect();
      tooltip.style.left = (e.clientX - rect.left + 15) + "px";
      tooltip.style.top = (e.clientY - rect.top - 15) + "px";
    });

    circle.addEventListener("mouseleave", () => {
      tooltip.style.display = "none";
      tooltip.innerHTML = ""; 
    });

    svg.appendChild(circle);
  });
}

document.getElementById("contenedor-mapa").addEventListener("click", (e) => {
  if (e.target.tagName === "svg" || e.target.id === "contenedor-mapa") {
    document.getElementById("mapa-svg").setAttribute("viewBox", "0 0 850 750"); 
    document.querySelectorAll('.colegio-punto').forEach(p => p.remove());

    const btnOriginal = document.querySelector('.btn-accion');
    if (btnOriginal) {
      btnOriginal.innerText = "Ver establecimientos";
    }
    enModoZoom = false;
  }
});

//datos de las comunas//
Papa.parse("datos_comunas.csv", {
  download: true,
  header: false,
  skipEmptyLines: true,
  complete: function(resultado) {
    const filas = resultado.data;
    if (!filas || filas.length === 0) return;

    let idxHead = 0;
    for (let i = 0; i < Math.min(filas.length, 5); i++) {
      if (filas[i].some(c => normalizar(c).includes("comuna"))) {
        idxHead = i;
        break;
      }
    }

    const cabeceras = filas[idxHead].map(c => normalizar(c));
    const cComuna = cabeceras.findIndex(h => h.includes("comuna"));
    const cIndice = cabeceras.findIndex(h => h.includes("indice") || h.includes("necesidad"));
    const cColegios = cabeceras.findIndex(h => h.includes("colegios"));
    const cPrioritarios = cabeceras.findIndex(h => h.includes("prioritarios"));
    const cCriticos = cabeceras.findIndex(h => h.includes("criticos") || h.includes("sep"));
    const cSimce = cabeceras.findIndex(h => h.includes("simce") && h.includes("4"));

    for (let i = idxHead + 1; i < filas.length; i++) {
      const f = filas[i];
      const nom = f[cComuna];
      if (nom && typeof nom === "string" && normalizar(nom) !== "comuna") {
        datosComunas[normalizar(nom)] = {
          indice: limpiarNumero(f[cIndice]),
          colegios: f[cColegios] ? f[cColegios].toString().trim() : "-",
          prioritarios: limpiarNumero(f[cPrioritarios]),
          criticos: f[cCriticos] ? f[cCriticos].toString().trim() : "-",
          simce: limpiarNumero(f[cSimce])
        };
      }
    }

    renderizarMapaSVG();
  },
  error: function(err) {
    console.error("Error al leer datos.csv:", err);
    renderizarMapaSVG();
  }
});

// datos de los colegios
Papa.parse("datos_colegios.csv", {
  download: true,
  header: true,
  skipEmptyLines: true,
  transformHeader: function(header) {
    return header.trim(); 
  },
  complete: function(resultado) {
    const filas = resultado.data;
    
    filas.forEach(fila => {
      if (fila.Comuna && fila.Comuna.trim() !== "") {
        const comunaNorm = normalizar(fila.Comuna);
        
        if (!establecimientosPorComuna[comunaNorm]) {
          establecimientosPorComuna[comunaNorm] = [];
        }
        establecimientosPorComuna[comunaNorm].push(fila);
      }
    });
  },
});